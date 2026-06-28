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

// Create. Body: { data, month?, title? } where data is { report, teams }.
app.post('/api/reports', async (req, res) => {
  const { data, month, title } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'A report "data" object is required' });
  }
  res.status(201).json(await store.createReport({ data, month, title }));
});

// Duplicate an existing report into a new archive entry.
app.post('/api/reports/:id/duplicate', async (req, res) => {
  const copy = await store.duplicateReport(req.params.id);
  if (!copy) return res.status(404).json({ error: 'Report not found' });
  res.status(201).json(copy);
});

// Update. Body: { data, month?, title? }. Bumps modified_at.
app.put('/api/reports/:id', async (req, res) => {
  const { data, month, title } = req.body || {};
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'A report "data" object is required' });
  }
  const updated = await store.updateReport(req.params.id, { data, month, title });
  if (!updated) return res.status(404).json({ error: 'Report not found' });
  res.json(updated);
});

app.delete('/api/reports/:id', async (req, res) => {
  const ok = await store.deleteReport(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Report not found' });
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
