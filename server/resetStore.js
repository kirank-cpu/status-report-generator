// ─── Password-reset token store ──────────────────────────────────────────────
// Single-use, time-limited tokens backing the forgot-password flow. A token maps
// to a username; redeeming it sets a new password (see server.js). Tokens expire
// after TTL_MINUTES and can be used once. Backend-agnostic via db.js.

const crypto = require('crypto');
const { execute, ready } = require('./db');

const TTL_MINUTES = 60;
const nowMs = () => Date.now();

const run = async (sql, args = []) => {
  await ready;
  return execute({ sql, args });
};
const get = async (sql, args = []) => (await run(sql, args)).rows[0] || null;

// Issue a fresh token for a username. Any still-valid tokens for that user are
// invalidated first, so only the latest reset link works (limits the attack
// window if an earlier email is intercepted).
const createToken = async (username) => {
  await run('UPDATE password_resets SET used = 1 WHERE lower(username) = lower(?) AND used = 0', [
    username,
  ]);
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date(nowMs()).toISOString();
  const expiresAt = new Date(nowMs() + TTL_MINUTES * 60 * 1000).toISOString();
  await run(
    'INSERT INTO password_resets (token, username, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)',
    [token, username, expiresAt, createdAt]
  );
  return { token, expiresAt };
};

// Return the username for a usable (unused, unexpired) token, else null.
const usernameForToken = async (token) => {
  if (!token) return null;
  const row = await get('SELECT username, expires_at, used FROM password_resets WHERE token = ?', [
    String(token),
  ]);
  if (!row) return null;
  if (Number(row.used) === 1) return null;
  if (new Date(row.expires_at).getTime() < nowMs()) return null;
  return row.username;
};

// Mark a token spent so it cannot be redeemed again.
const consumeToken = async (token) => {
  await run('UPDATE password_resets SET used = 1 WHERE token = ?', [String(token)]);
};

module.exports = { TTL_MINUTES, createToken, usernameForToken, consumeToken };
