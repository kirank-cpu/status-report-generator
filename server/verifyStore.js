// ─── Email-verification token store ──────────────────────────────────────────
// Single-use tokens for the sign-up email-verification flow. Mirrors
// resetStore.js but with a longer TTL (a verification link can sit in an inbox
// for a while). Backend-agnostic via db.js.

const crypto = require('crypto');
const { execute, ready } = require('./db');

const TTL_MINUTES = 60 * 24; // 24 hours
const nowMs = () => Date.now();

const run = async (sql, args = []) => {
  await ready;
  return execute({ sql, args });
};
const get = async (sql, args = []) => (await run(sql, args)).rows[0] || null;

// Issue a fresh verification token for a username, invalidating earlier ones.
const createToken = async (username) => {
  await run('UPDATE email_verifications SET used = 1 WHERE lower(username) = lower(?) AND used = 0', [
    username,
  ]);
  const token = crypto.randomBytes(32).toString('hex');
  const createdAt = new Date(nowMs()).toISOString();
  const expiresAt = new Date(nowMs() + TTL_MINUTES * 60 * 1000).toISOString();
  await run(
    'INSERT INTO email_verifications (token, username, expires_at, used, created_at) VALUES (?, ?, ?, 0, ?)',
    [token, username, expiresAt, createdAt]
  );
  return { token, expiresAt };
};

// Username for a usable (unused, unexpired) token, else null.
const usernameForToken = async (token) => {
  if (!token) return null;
  const row = await get(
    'SELECT username, expires_at, used FROM email_verifications WHERE token = ?',
    [String(token)]
  );
  if (!row) return null;
  if (Number(row.used) === 1) return null;
  if (new Date(row.expires_at).getTime() < nowMs()) return null;
  return row.username;
};

const consumeToken = async (token) => {
  await run('UPDATE email_verifications SET used = 1 WHERE token = ?', [String(token)]);
};

module.exports = { TTL_MINUTES, createToken, usernameForToken, consumeToken };
