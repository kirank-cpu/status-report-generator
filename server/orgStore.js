// ─── Organisation store ──────────────────────────────────────────────────────
// One central Team → Project → Squad name structure (names only) that new reports
// are seeded from. Persisted as a single JSON row. Backend-agnostic via db.js.

const { execute, ready } = require('./db');

const nowIso = () => new Date().toISOString();
const EMPTY = { teams: [] };

const run = async (sql, args = []) => {
  await ready;
  return execute({ sql, args });
};

const getOrganisation = async () => {
  const row = (await run('SELECT data, modified_at FROM organisation WHERE id = 1')).rows[0];
  if (!row) return { ...EMPTY, modifiedAt: null };
  return { ...JSON.parse(row.data), modifiedAt: row.modified_at };
};

const saveOrganisation = async (data) => {
  const payload = JSON.stringify({ teams: Array.isArray(data?.teams) ? data.teams : [] });
  await run(
    `INSERT INTO organisation (id, data, modified_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, modified_at = excluded.modified_at`,
    [payload, nowIso()]
  );
  return getOrganisation();
};

module.exports = { getOrganisation, saveOrganisation };
