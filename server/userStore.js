// ─── User store ──────────────────────────────────────────────────────────────
// The single editable account store. Each user has a role (admin | manager |
// employee) and, for employees, a `squads` list of squad ids/names they may edit.
// Passwords are stored as-is (front-end-only trust model, same as before) but are
// never returned to clients. Backend-agnostic via db.js's async execute()/ready.

const { execute, ready } = require('./db');

const nowIso = () => new Date().toISOString();
const ROLES = ['admin', 'manager', 'employee'];

const all = async (sql, args = []) => {
  await ready;
  return (await execute({ sql, args })).rows;
};
const get = async (sql, args = []) => (await all(sql, args))[0] || null;
const run = async (sql, args = []) => {
  await ready;
  return execute({ sql, args });
};

// Map a DB row to a safe client object (no password, squads parsed).
const safe = (row) =>
  row && {
    username: row.username,
    name: row.name || row.username,
    role: row.role,
    squads: JSON.parse(row.squads || '[]'),
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };

const rawByName = (username) =>
  get('SELECT * FROM users WHERE lower(username) = lower(?)', [String(username || '').trim()]);

const insert = async (u) => {
  const ts = nowIso();
  await run(
    'INSERT INTO users (username, password, name, role, squads, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [u.username.trim(), u.password, (u.name || u.username).trim(), u.role, JSON.stringify(u.squads || []), ts, ts]
  );
  return safe(await rawByName(u.username));
};

// First-run seed mirroring the legacy src/users.js accounts, but with the admin
// account promoted to the new `admin` role.
const seedUsers = async () => {
  const row = await get('SELECT COUNT(*) AS n FROM users');
  if (Number(row.n) > 0) return;
  const defaults = [
    { username: 'admin', password: 'admin123', name: 'Admin', role: 'admin', squads: [] },
    { username: 'asha', password: 'asha123', name: 'Asha Rao', role: 'manager', squads: [] },
    { username: 'test1', password: 'test123', name: 'Test User 1', role: 'employee', squads: ['Servicing Hub'] },
  ];
  for (const u of defaults) await insert(u);
};

const listUsers = async () => (await all('SELECT * FROM users ORDER BY role, username')).map(safe);

const getUser = async (username) => safe(await rawByName(username));

// Returns the safe user when credentials match, else null.
const verifyLogin = async (username, password) => {
  const row = await rawByName(username);
  if (!row || row.password !== password) return null;
  return safe(row);
};

const normalizeRole = (role) => (ROLES.includes(role) ? role : 'employee');

// Create or update. On update (originalUsername given) a blank password keeps the
// existing one. Returns { user } or { error }.
const upsertUser = async (input, originalUsername = null) => {
  const username = String(input.username || '').trim();
  if (!username) return { error: 'Username is required.' };
  const role = normalizeRole(input.role);
  const name = String(input.name || username).trim();
  const squads = role === 'employee' && Array.isArray(input.squads) ? input.squads : [];

  const existingSame = await rawByName(username);
  if (originalUsername) {
    const original = await rawByName(originalUsername);
    if (!original) return { error: 'User not found.' };
    // Renaming onto another existing username is a clash.
    if (existingSame && existingSame.username.toLowerCase() !== originalUsername.toLowerCase()) {
      return { error: `Username "${username}" is already taken.` };
    }
    const password = input.password ? input.password : original.password;
    await run(
      'UPDATE users SET username = ?, password = ?, name = ?, role = ?, squads = ?, modified_at = ? WHERE lower(username) = lower(?)',
      [username, password, name, role, JSON.stringify(squads), nowIso(), originalUsername]
    );
    return { user: safe(await rawByName(username)) };
  }

  if (existingSame) return { error: `Username "${username}" is already taken.` };
  if (!input.password) return { error: 'Password is required.' };
  return { user: await insert({ username, password: input.password, name, role, squads }) };
};

const deleteUser = async (username) => {
  const info = await run('DELETE FROM users WHERE lower(username) = lower(?)', [
    String(username || '').trim(),
  ]);
  return Number(info.rowsAffected) > 0;
};

module.exports = {
  ROLES,
  seedUsers,
  listUsers,
  getUser,
  verifyLogin,
  upsertUser,
  deleteUser,
};
