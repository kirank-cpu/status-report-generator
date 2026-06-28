// ─── MSR archive API ─────────────────────────────────────────────────────────
// Express service backing the Monthly Status Report archive. CRUD over reports,
// each report being the full `{ report, teams }` document the front end already
// uses. Storage lives behind reportStore.js (libSQL/Turso, or local SQLite in
// dev), so this layer is pure HTTP.

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const store = require('./reportStore');
const users = require('./userStore');
const org = require('./orgStore');
const resets = require('./resetStore');
const mailer = require('./mailer');
const presence = require('./presenceStore');

// Base URL used to build password-reset links in emails. Prefer an explicit
// APP_URL (e.g. https://status-report-generator.onrender.com); otherwise derive
// it from the incoming request so dev/local still produces working links.
const baseUrl = (req) =>
  (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

const app = express();
app.use(cors());
// Reports embed every squad's tables/highlights, so payloads are large.
app.use(express.json({ limit: '25mb' }));

// Liveness check — must answer the moment the process is listening, so it stays
// ABOVE the DB gate below. Render uses this to confirm the port is up; gating it
// on the database would make a slow/misconfigured DB fail the whole deploy.
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Seed default accounts on first run so logins work out of the box. Seeding (and
// the schema it depends on) is async now, so gate the data routes on it: the
// first request waits for the database to be ready, the rest resolve instantly.
const dbReady = users.seedUsers();
// Attach a handler so a startup DB failure logs instead of surfacing as an
// unhandled rejection; per-request awaits below still see the same promise.
dbReady.catch((err) => console.error('Database initialisation failed:', err));
app.use(async (_req, res, next) => {
  try {
    await dbReady;
    next();
  } catch (err) {
    console.error('Database initialisation failed:', err);
    res.status(503).json({ error: 'Database unavailable' });
  }
});

// ── Auth + users ──────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await users.verifyLogin(username, password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });
  res.json(user);
});

// Change password while signed in: requires the current password.
app.post('/api/auth/change-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body || {};
  if (!username || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'username, currentPassword and newPassword are required.' });
  }
  const { user, error } = await users.changePassword(username, currentPassword, newPassword);
  if (error) return res.status(400).json({ error });
  res.json(user);
});

// Self-service: set/clear the signed-in user's own email (needed for reset).
app.put('/api/account/email', async (req, res) => {
  const { username, email } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username is required.' });
  const { user, error } = await users.setEmail(username, email);
  if (error) return res.status(400).json({ error });
  res.json(user);
});

// Forgot password: issue a reset token and email a link. Always responds 200 with
// the same message so the endpoint can't be used to probe which emails exist.
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const generic = { ok: true, message: 'If an account with that email exists, a reset link has been sent.' };
  try {
    const user = await users.findByEmail(email);
    if (user && user.email) {
      const { token } = await resets.createToken(user.username);
      const link = `${baseUrl(req)}/reset-password?token=${token}`;
      await mailer.sendResetEmail(user.email, link, resets.TTL_MINUTES);
    }
  } catch (err) {
    // Log, but still return the generic response (don't leak failures/existence).
    console.error('forgot-password error:', err);
  }
  res.json(generic);
});

// Reset password using a valid token from the email link.
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'token and newPassword are required.' });
  }
  const username = await resets.usernameForToken(token);
  if (!username) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
  }
  const { error } = await users.setPassword(username, newPassword);
  if (error) return res.status(400).json({ error });
  await resets.consumeToken(token);
  res.json({ ok: true });
});

app.get('/api/users', async (_req, res) => res.json(await users.listUsers()));

app.post('/api/users', async (req, res) => {
  const { user, error } = await users.upsertUser(req.body || {});
  if (error) return res.status(400).json({ error });
  res.status(201).json(user);
});

app.put('/api/users/:username', async (req, res) => {
  const { user, error } = await users.upsertUser(req.body || {}, req.params.username);
  if (error) return res.status(400).json({ error });
  res.json(user);
});

app.delete('/api/users/:username', async (req, res) => {
  if (!(await users.deleteUser(req.params.username))) return res.status(404).json({ error: 'User not found' });
  res.status(204).end();
});

// ── Organisation ──────────────────────────────────────────────────────────
app.get('/api/organisation', async (_req, res) => res.json(await org.getOrganisation()));

app.put('/api/organisation', async (req, res) => {
  const { data } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'An organisation "data" object is required' });
  }
  res.json(await org.saveOrganisation(data));
});

// List metadata (no heavy `data` blob), newest first.
app.get('/api/reports', async (_req, res) => {
  res.json(await store.listReports());
});

// Full report document.
app.get('/api/reports/:id', async (req, res) => {
  const report = await store.getReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  res.json(report);
});

// Create. Body: { data, month?, title?, modifiedBy? } where data is { report, teams }.
app.post('/api/reports', async (req, res) => {
  const { data, month, title, modifiedBy } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'A report "data" object is required' });
  }
  res.status(201).json(await store.createReport({ data, month, title, modifiedBy }));
});

// Duplicate an existing report into a new archive entry.
app.post('/api/reports/:id/duplicate', async (req, res) => {
  const copy = await store.duplicateReport(req.params.id);
  if (!copy) return res.status(404).json({ error: 'Report not found' });
  res.status(201).json(copy);
});

// Update. Body: { data, month?, title?, modifiedBy? }. Bumps modified_at.
app.put('/api/reports/:id', async (req, res) => {
  const { data, month, title, modifiedBy } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'A report "data" object is required' });
  }
  const updated = await store.updateReport(req.params.id, { data, month, title, modifiedBy });
  if (!updated) return res.status(404).json({ error: 'Report not found' });
  res.json(updated);
});

// Section-scoped save: merge a patch into a single squad without touching the
// rest of the document (lets collaborators edit different sections at once).
app.patch('/api/reports/:id/squad/:squadId', async (req, res) => {
  const { patch, modifiedBy } = req.body || {};
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'A "patch" object is required' });
  }
  const result = await store.patchSquad(req.params.id, req.params.squadId, patch, modifiedBy);
  if (!result) return res.status(404).json({ error: 'Report or squad not found' });
  res.json(result);
});

// Structure-scoped save (Report Settings): apply team/project/squad shape, names
// and report meta while preserving each squad's section data.
app.patch('/api/reports/:id/structure', async (req, res) => {
  const { report, teams, modifiedBy } = req.body || {};
  if (!Array.isArray(teams)) {
    return res.status(400).json({ error: 'A "teams" array is required' });
  }
  const updated = await store.patchStructure(req.params.id, { report, teams }, modifiedBy);
  if (!updated) return res.status(404).json({ error: 'Report not found' });
  res.json(updated);
});

app.delete('/api/reports/:id', async (req, res) => {
  const ok = await store.deleteReport(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Report not found' });
  res.status(204).end();
});

// ── Presence + section locks (collaboration) ──────────────────────────────
// Home-page summary: which reports currently have people in them.
app.get('/api/presence', (_req, res) => res.json(presence.homeSummary()));

// Heartbeat: announce I'm in this report; get back who else is here, the live
// locks, and the doc's modified metadata (so the client knows when to refetch).
app.post('/api/reports/:id/presence', async (req, res) => {
  const { username, name } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username is required' });
  presence.heartbeat(req.params.id, username, name);
  res.json({
    presence: presence.listPresence(req.params.id),
    locks: presence.listLocks(req.params.id),
    meta: await store.getMeta(req.params.id),
  });
});

// Acquire (or renew) a section lock. 200 { ok:true } when granted, 409 with the
// current owner when someone else holds it.
app.post('/api/reports/:id/lock', (req, res) => {
  const { username, name, section } = req.body || {};
  if (!username || !section) return res.status(400).json({ error: 'username and section are required' });
  const result = presence.acquireLock(req.params.id, section, username, name);
  res.status(result.ok ? 200 : 409).json({ ...result, locks: presence.listLocks(req.params.id) });
});

// Release a section lock I hold.
app.delete('/api/reports/:id/lock', (req, res) => {
  const { username, section } = req.body || {};
  if (!username || !section) return res.status(400).json({ error: 'username and section are required' });
  presence.releaseLock(req.params.id, section, username);
  res.status(204).end();
});

// Leave a report (closing the tab / navigating away): clear presence + my locks.
app.post('/api/reports/:id/leave', (req, res) => {
  const { username } = req.body || {};
  if (username) presence.leave(req.params.id, username);
  res.status(204).end();
});

// ── Serve the built frontend (production) ─────────────────────────────────
// After `npm run build` the SPA lives in ../dist. Serve it and fall back to
// index.html for any non-API route so client-side routes (e.g. /report/:id,
// /manage-roles) resolve on refresh/deep-link. Skipped in dev, where Vite serves
// the app and proxies /api here.
const DIST = path.join(__dirname, '..', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// Only start listening when run directly — tests import `app` via supertest.
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`MSR server listening on http://localhost:${PORT}`));
}

module.exports = app;
