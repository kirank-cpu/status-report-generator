// ─── Report store ────────────────────────────────────────────────────────────
// Thin data-access layer over the `reports` table. The HTTP layer (server.js)
// only ever talks to these functions, so the storage engine stays swappable.
// Backend-agnostic: everything goes through db.js's async execute()/ready.

const crypto = require('crypto');
const { execute, ready } = require('./db');

const nowIso = () => new Date().toISOString();

// Query helpers: await schema readiness, then run. `get` returns one row or null.
const all = async (sql, args = []) => {
  await ready;
  return (await execute({ sql, args })).rows;
};
const get = async (sql, args = []) => (await all(sql, args))[0] || null;
const run = async (sql, args = []) => {
  await ready;
  return execute({ sql, args });
};

// Opaque, stable id. Deliberately NOT derived from month/title — those are
// editable, so embedding them produced misleading ids/URLs (e.g. a report whose
// month was changed to July still read "june-..." in the address bar).
const makeId = () => `msr-${crypto.randomBytes(6).toString('hex')}`;

// Shape of a current (post-migration) id.
const OPAQUE_ID = /^msr-[0-9a-f]{12}$/;

// One-time migration: rename any legacy month-based id to an opaque one and record
// an alias so existing URLs/bookmarks still resolve. Idempotent.
const migrateLegacyIds = async () => {
  const rows = await all('SELECT id FROM reports');
  for (const { id } of rows) {
    if (OPAQUE_ID.test(id)) continue;
    const newId = makeId();
    await run('UPDATE reports SET id = ? WHERE id = ?', [newId, id]);
    await run('INSERT OR REPLACE INTO report_aliases (old_id, new_id) VALUES (?, ?)', [id, newId]);
    await run('UPDATE report_aliases SET new_id = ? WHERE new_id = ?', [newId, id]); // keep older aliases pointing at the live id
  }
};

// Resolve a possibly-legacy id to the current report id (or return it unchanged).
const resolveId = async (id) => {
  if (await get('SELECT 1 FROM reports WHERE id = ?', [id])) return id;
  const alias = await get('SELECT new_id FROM report_aliases WHERE old_id = ?', [id]);
  return alias ? alias.new_id : id;
};

// Pull the human-facing month/title out of the report document so they can be
// stored as their own columns (keeps the list endpoint cheap).
const monthOf = (data) => String(data?.report?.month || '').trim();
const titleOf = (data) => String(data?.report?.title || 'Monthly Status Report').trim();

// Metadata only — never returns the heavy `data` blob, so listing stays light.
const listReports = async () =>
  (await all('SELECT id, month, title, created_at, modified_at FROM reports ORDER BY created_at DESC')).map(
    (r) => ({
      id: r.id,
      month: r.month,
      title: r.title,
      createdAt: r.created_at,
      modifiedAt: r.modified_at,
    })
  );

// Full report with `data` parsed back into an object, or null when unknown.
const getReport = async (id) => {
  const row = await get('SELECT * FROM reports WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    month: row.month,
    title: row.title,
    data: JSON.parse(row.data),
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
};

const createReport = async ({ data, month, title } = {}) => {
  const m = month != null ? String(month).trim() : monthOf(data);
  const t = title != null ? String(title).trim() : titleOf(data);
  const id = makeId();
  const ts = nowIso();
  await run(
    'INSERT INTO reports (id, month, title, data, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, m, t, JSON.stringify(data ?? {}), ts, ts]
  );
  return getReport(id);
};

// Updates the document and bumps modified_at. month/title are re-derived from the
// incoming data (falling back to explicit args), so the columns track the doc.
const updateReport = async (id, { data, month, title } = {}) => {
  const existing = await get('SELECT id FROM reports WHERE id = ?', [id]);
  if (!existing) return null;
  const m = month != null ? String(month).trim() : monthOf(data);
  const t = title != null ? String(title).trim() : titleOf(data);
  await run('UPDATE reports SET month = ?, title = ?, data = ?, modified_at = ? WHERE id = ?', [
    m,
    t,
    JSON.stringify(data ?? {}),
    nowIso(),
    id,
  ]);
  return getReport(id);
};

const deleteReport = async (id) => {
  const info = await run('DELETE FROM reports WHERE id = ?', [id]);
  return Number(info.rowsAffected) > 0;
};

// Copy an existing report into a brand-new archive entry (fresh id/timestamps).
const duplicateReport = async (id) => {
  const src = await getReport(id);
  if (!src) return null;
  const copyTitle = `${src.title} (copy)`;
  const data = { ...src.data, report: { ...src.data.report, title: copyTitle } };
  return createReport({ data, month: src.month, title: copyTitle });
};

// One-time import helper: seed the archive from a legacy single-document state.
const seedFromState = (state) => createReport({ data: state });

module.exports = {
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  duplicateReport,
  seedFromState,
  makeId,
  migrateLegacyIds,
  resolveId,
};
