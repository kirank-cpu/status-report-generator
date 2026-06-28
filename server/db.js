// ─── Database connection (libSQL / Turso, with local SQLite fallback) ────────
// The MSR archive needs one durable store. Two backends, one async interface:
//
//   • Production: set TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) to a Turso database
//     — free, persistent, SQLite-compatible. Talks over HTTP (pure JS, no native
//     module), so it runs on ephemeral free hosts (Render) without losing data.
//   • Dev / tests: with no Turso env, falls back to Node's built-in `node:sqlite`
//     (Node 22.5+) against a local file. MSR_DB_FILE overrides the path so tests
//     can isolate their database, exactly as before.
//
// Stores only ever call `execute({ sql, args })` (async, returns { rows,
// rowsAffected }) and await `ready` (schema created). That keeps them backend-
// agnostic.

const path = require('path');

// One row per Monthly Status Report; `data` is the full `{ report, teams }`
// document as JSON, with month/title denormalized so listing stays light.
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reports (
    id          TEXT PRIMARY KEY,
    month       TEXT,
    title       TEXT,
    data        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    modified_at TEXT NOT NULL
  )`,
  // Maps a report's former (legacy, month-based) id to its current opaque id, so
  // old URLs/bookmarks keep resolving after the one-time id migration.
  `CREATE TABLE IF NOT EXISTS report_aliases (
    old_id TEXT PRIMARY KEY,
    new_id TEXT NOT NULL
  )`,
  // User accounts and their role (admin | manager | employee). `squads` is a JSON
  // array of squad ids/names an employee may edit.
  `CREATE TABLE IF NOT EXISTS users (
    username    TEXT PRIMARY KEY,
    password    TEXT NOT NULL,
    name        TEXT,
    role        TEXT NOT NULL,
    squads      TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL,
    modified_at TEXT NOT NULL
  )`,
  // Single-row central organisation (Team → Project → Squad names) that new
  // reports are seeded from. The CHECK pins it to one row (id = 1).
  `CREATE TABLE IF NOT EXISTS organisation (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    data        TEXT NOT NULL,
    modified_at TEXT NOT NULL
  )`,
];

let execute; // async ({ sql, args }) => { rows, rowsAffected }
let ready; // Promise resolved once the schema exists

if (process.env.TURSO_DATABASE_URL) {
  // ── Remote libSQL / Turso (production) ──────────────────────────────────
  // The `/web` entrypoint is pure JS (no native bindings), so it installs and
  // runs anywhere — including free hosts with no build toolchain.
  const { createClient } = require('@libsql/client/web');
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  execute = (query) => client.execute(query);
  ready = (async () => {
    for (const sql of SCHEMA) await client.execute(sql);
  })();
} else {
  // ── Local SQLite via Node's built-in driver (dev / test) ────────────────
  const { DatabaseSync } = require('node:sqlite');
  const file = process.env.MSR_DB_FILE || path.join(__dirname, 'msr.db');
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  for (const sql of SCHEMA) db.exec(sql);

  // Adapt the synchronous built-in driver to the async { rows, rowsAffected }
  // shape the stores expect. Read statements return rows; writes return a count.
  const isRead = (sql) => /^\s*(select|with|pragma)/i.test(sql);
  execute = async ({ sql, args = [] }) => {
    const stmt = db.prepare(sql);
    if (isRead(sql)) return { rows: stmt.all(...args), rowsAffected: 0 };
    const info = stmt.run(...args);
    return { rows: [], rowsAffected: Number(info.changes) };
  };
  ready = Promise.resolve();
}

module.exports = { execute, ready };
