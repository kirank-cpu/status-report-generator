// ─── Presence + section locks (in-memory) ────────────────────────────────────
// Tracks who currently has each report open (presence) and who holds each
// editable section (locks), so the UI can show collaborators and prevent two
// people editing the same table at once. Deliberately in-memory: this is
// ephemeral, per-instance state (Render free runs a single instance), and losing
// it on restart is harmless — clients re-announce on their next ~3s heartbeat.
//
// A "section" is an editable unit within a report, keyed as `${squadId}:${field}`
// (e.g. execution, defects, deliverables) or `report:settings`. Locks and
// presence both expire on a TTL so a closed tab or crashed client frees up.

const PRESENCE_TTL_MS = 12_000; // ~4 missed 3s heartbeats
const LOCK_TTL_MS = 20_000;

// reportId -> Map<username, { name, lastSeen }>
const presence = new Map();
// reportId -> Map<sectionKey, { username, name, lastSeen }>
const locks = new Map();

const now = () => Date.now();
const mapFor = (store, reportId) => {
  if (!store.has(reportId)) store.set(reportId, new Map());
  return store.get(reportId);
};

// Drop entries older than `ttl` from a per-report Map; clean up empty reports.
const prune = (store, reportId, ttl) => {
  const m = store.get(reportId);
  if (!m) return null;
  const cutoff = now() - ttl;
  for (const [key, val] of m) if (val.lastSeen < cutoff) m.delete(key);
  if (m.size === 0) store.delete(reportId);
  return store.get(reportId) || null;
};

// Record/refresh a user's presence in a report. Also renews any locks they hold,
// so a section stays locked while its editor is present (heartbeating), and only
// frees on explicit release, leave, or when their heartbeats stop (TTL).
const heartbeat = (reportId, username, name) => {
  if (!reportId || !username) return;
  const ts = now();
  mapFor(presence, reportId).set(username, { name: name || username, lastSeen: ts });
  const lk = locks.get(reportId);
  if (lk) for (const entry of lk.values()) if (entry.username === username) entry.lastSeen = ts;
};

// Active users in a report: [{ username, name }].
const listPresence = (reportId) => {
  const m = prune(presence, reportId, PRESENCE_TTL_MS);
  if (!m) return [];
  return [...m.entries()].map(([username, v]) => ({ username, name: v.name }));
};

// Active locks in a report: { sectionKey: { username, name } }.
const listLocks = (reportId) => {
  const m = prune(locks, reportId, LOCK_TTL_MS);
  const out = {};
  if (!m) return out;
  for (const [key, v] of m) out[key] = { username: v.username, name: v.name };
  return out;
};

// Try to take (or renew) a section lock. Succeeds if the section is free or
// already held by this user; otherwise reports the current owner. Renewing also
// refreshes presence, so an actively-editing user never looks idle.
const acquireLock = (reportId, sectionKey, username, name) => {
  heartbeat(reportId, username, name);
  const m = mapFor(locks, reportId);
  const existing = m.get(sectionKey);
  const live = existing && existing.lastSeen >= now() - LOCK_TTL_MS;
  if (live && existing.username !== username) {
    return { ok: false, owner: { username: existing.username, name: existing.name } };
  }
  m.set(sectionKey, { username, name: name || username, lastSeen: now() });
  return { ok: true, owner: { username, name: name || username } };
};

// Release a lock, but only if this user holds it (avoids stealing on a stale call).
const releaseLock = (reportId, sectionKey, username) => {
  const m = locks.get(reportId);
  if (!m) return;
  const existing = m.get(sectionKey);
  if (existing && existing.username === username) m.delete(sectionKey);
  if (m.size === 0) locks.delete(reportId);
};

// Remove a user from a report entirely (closed tab / navigated away): clears
// their presence and frees every lock they held.
const leave = (reportId, username) => {
  presence.get(reportId)?.delete(username);
  if (presence.get(reportId)?.size === 0) presence.delete(reportId);
  const m = locks.get(reportId);
  if (m) {
    for (const [key, v] of m) if (v.username === username) m.delete(key);
    if (m.size === 0) locks.delete(reportId);
  }
};

// Home-page summary: { reportId: [{ username, name }] } for every report that
// currently has at least one active user.
const homeSummary = () => {
  const out = {};
  for (const reportId of [...presence.keys()]) {
    const users = listPresence(reportId);
    if (users.length) out[reportId] = users;
  }
  return out;
};

module.exports = {
  heartbeat,
  listPresence,
  listLocks,
  acquireLock,
  releaseLock,
  leave,
  homeSummary,
  PRESENCE_TTL_MS,
  LOCK_TTL_MS,
};
