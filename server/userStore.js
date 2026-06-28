// ─── User store ──────────────────────────────────────────────────────────────
// The single editable account store. Each user has a role (admin | manager |
// employee) and, for employees, a `squads` list of squad ids/names they may edit.
// Passwords are stored as-is (front-end-only trust model, same as before) but are
// never returned to clients. Backend-agnostic via db.js's async execute()/ready.

const { execute, ready } = require('./db');

const nowIso = () => new Date().toISOString();
const ROLES = ['admin', 'manager', 'employee'];
const MIN_PASSWORD = 6;

// Light email sanity check — not RFC-perfect, just enough to reject obvious junk.
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

// Normalize an email to a stored form (trimmed, lowercased) or '' when blank.
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

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
// `status` is 'pending' (awaiting admin approval) or 'active'; `emailVerified`
// gates login. Older rows without the columns read as active + verified.
const safe = (row) =>
  row && {
    username: row.username,
    name: row.name || row.username,
    email: row.email || '',
    role: row.role,
    squads: JSON.parse(row.squads || '[]'),
    status: row.status || 'active',
    emailVerified: row.email_verified == null ? true : Number(row.email_verified) === 1,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };

const rawByName = (username) =>
  get('SELECT * FROM users WHERE lower(username) = lower(?)', [String(username || '').trim()]);

// Lookup by email (used by the forgot-password flow). Case-insensitive.
const rawByEmail = (email) => {
  const e = normalizeEmail(email);
  if (!e) return null;
  return get('SELECT * FROM users WHERE lower(email) = ?', [e]);
};

// Insert a user. Admin/seed-created accounts are trusted (verified + active by
// default); the sign-up flow passes emailVerified:false + status:'pending'.
const insert = async (u) => {
  const ts = nowIso();
  await run(
    `INSERT INTO users (username, password, name, email, role, squads, status, email_verified, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      u.username.trim(),
      u.password,
      (u.name || u.username).trim(),
      normalizeEmail(u.email),
      u.role,
      JSON.stringify(u.squads || []),
      u.status || 'active',
      u.emailVerified === false ? 0 : 1,
      ts,
      ts,
    ]
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

  // Email is optional, but if supplied it must look valid and be unique so the
  // forgot-password flow can resolve a single account from it.
  const email = normalizeEmail(input.email);
  if (email && !isEmail(email)) return { error: 'Please enter a valid email address.' };
  if (email) {
    const owner = await rawByEmail(email);
    if (owner && owner.username.toLowerCase() !== (originalUsername || username).toLowerCase()) {
      return { error: `Email "${email}" is already used by another account.` };
    }
  }

  const existingSame = await rawByName(username);
  if (originalUsername) {
    const original = await rawByName(originalUsername);
    if (!original) return { error: 'User not found.' };
    // Renaming onto another existing username is a clash.
    if (existingSame && existingSame.username.toLowerCase() !== originalUsername.toLowerCase()) {
      return { error: `Username "${username}" is already taken.` };
    }
    const password = input.password ? input.password : original.password;
    // Admin approval can flip status to 'active'; otherwise keep the existing one.
    const status = input.status === 'active' || input.status === 'pending' ? input.status : original.status || 'active';
    await run(
      'UPDATE users SET username = ?, password = ?, name = ?, email = ?, role = ?, squads = ?, status = ?, modified_at = ? WHERE lower(username) = lower(?)',
      [username, password, name, email, role, JSON.stringify(squads), status, nowIso(), originalUsername]
    );
    return { user: safe(await rawByName(username)) };
  }

  if (existingSame) return { error: `Username "${username}" is already taken.` };
  if (!input.password) return { error: 'Password is required.' };
  return { user: await insert({ username, password: input.password, name, email, role, squads }) };
};

// Organisational email domains to refuse at sign-up (comma-separated env var).
// Empty by default — the UI still warns users not to use a work address.
const BLOCKED_DOMAINS = (process.env.BLOCKED_EMAIL_DOMAINS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Self-service sign-up. Creates an unverified, pending employee with no squads —
// read-only everywhere until they verify their email and an admin approves them.
const signup = async ({ username, email, password, name } = {}) => {
  const uname = String(username || '').trim();
  if (!/^[a-zA-Z0-9._-]{3,}$/.test(uname)) {
    return { error: 'Username must be at least 3 characters (letters, numbers, dot, underscore, hyphen).' };
  }
  const em = normalizeEmail(email);
  if (!isEmail(em)) return { error: 'Please enter a valid email address.' };
  if (BLOCKED_DOMAINS.includes(em.split('@')[1])) {
    return { error: 'Please sign up with a personal email address, not your organisational one.' };
  }
  if (!password || String(password).length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  if (await rawByName(uname)) return { error: `Username "${uname}" is already taken.` };
  if (await rawByEmail(em)) return { error: 'An account with that email already exists.' };
  const user = await insert({
    username: uname,
    password,
    name: name || uname,
    email: em,
    role: 'employee',
    squads: [],
    status: 'pending',
    emailVerified: false,
  });
  return { user };
};

// Mark a user's email verified (called once their verification token is redeemed).
const verifyEmail = async (username) => {
  const row = await rawByName(username);
  if (!row) return { error: 'Account not found.' };
  await run('UPDATE users SET email_verified = 1, modified_at = ? WHERE lower(username) = lower(?)', [
    nowIso(),
    username,
  ]);
  return { user: safe(await rawByName(username)) };
};

// Self-service: change a user's password after verifying the current one.
const changePassword = async (username, currentPassword, newPassword) => {
  const row = await rawByName(username);
  if (!row) return { error: 'Account not found.' };
  if (row.password !== currentPassword) return { error: 'Current password is incorrect.' };
  if (!newPassword || String(newPassword).length < MIN_PASSWORD) {
    return { error: `New password must be at least ${MIN_PASSWORD} characters.` };
  }
  if (newPassword === currentPassword) {
    return { error: 'New password must be different from the current one.' };
  }
  await run('UPDATE users SET password = ?, modified_at = ? WHERE lower(username) = lower(?)', [
    newPassword,
    nowIso(),
    username,
  ]);
  return { user: safe(await rawByName(username)) };
};

// Set a password directly without the current one — used by the reset-token flow
// once a token has been verified. Callers MUST validate the token first.
const setPassword = async (username, newPassword) => {
  if (!newPassword || String(newPassword).length < MIN_PASSWORD) {
    return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  const row = await rawByName(username);
  if (!row) return { error: 'Account not found.' };
  await run('UPDATE users SET password = ?, modified_at = ? WHERE lower(username) = lower(?)', [
    newPassword,
    nowIso(),
    username,
  ]);
  return { user: safe(row) };
};

// Self-service: update (or clear) the signed-in user's own email.
const setEmail = async (username, email) => {
  const row = await rawByName(username);
  if (!row) return { error: 'Account not found.' };
  const normalized = normalizeEmail(email);
  if (normalized && !isEmail(normalized)) return { error: 'Please enter a valid email address.' };
  if (normalized) {
    const owner = await rawByEmail(normalized);
    if (owner && owner.username.toLowerCase() !== username.toLowerCase()) {
      return { error: 'That email is already used by another account.' };
    }
  }
  await run('UPDATE users SET email = ?, modified_at = ? WHERE lower(username) = lower(?)', [
    normalized,
    nowIso(),
    username,
  ]);
  return { user: safe(await rawByName(username)) };
};

// Resolve an account from an email for the forgot-password flow. Returns the safe
// user (with username) or null. Never reveals existence to callers directly.
const findByEmail = async (email) => safe(await rawByEmail(email));

const deleteUser = async (username) => {
  const info = await run('DELETE FROM users WHERE lower(username) = lower(?)', [
    String(username || '').trim(),
  ]);
  return Number(info.rowsAffected) > 0;
};

module.exports = {
  ROLES,
  MIN_PASSWORD,
  seedUsers,
  listUsers,
  getUser,
  verifyLogin,
  upsertUser,
  deleteUser,
  signup,
  verifyEmail,
  changePassword,
  setPassword,
  setEmail,
  findByEmail,
};
