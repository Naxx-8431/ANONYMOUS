'use strict';

/**
 * db.js – SQLite via sql.js (pure JS/WASM, no native compilation needed)
 *
 * sql.js runs SQLite entirely in JavaScript. Because it's in-memory,
 * we save the .db file to disk after every write and reload it on startup.
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'anonymous.db');

/* ── The synchronous db wrapper ────────────────────────────────── */
let _db = null;  // sql.js Database instance

/* Save current in-memory DB to disk */
function save() {
  const data = _db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/* ── Public API (mirrors better-sqlite3 interface used in routes) ─ */
const db = {
  /** Run a statement that returns no rows (INSERT/UPDATE/DELETE/CREATE) */
  prepare(sql) {
    return {
      run(...args) { _db.run(sql, flattenArgs(args)); save(); return this; },
      get(...args) { const s = _db.prepare(sql); try { s.bind(flattenArgs(args)); return s.step() ? rowToObj(s) : undefined; } finally { s.free(); } },
      all(...args) { const s = _db.prepare(sql); const rows = []; try { s.bind(flattenArgs(args)); while (s.step()) rows.push(rowToObj(s)); } finally { s.free(); } return rows; },
    };
  },

  /** Execute a multi-statement string (schema init) */
  exec(sql) {
    _db.run(sql);
    save();
  },

  /** Wrap multiple operations in a pseudo-transaction (sql.js auto-commits) */
  transaction(fn) {
    return function (...args) {
      _db.run('BEGIN');
      try {
        const result = fn(...args);
        _db.run('COMMIT');
        save();
        return result;
      } catch (e) {
        _db.run('ROLLBACK');
        throw e;
      }
    };
  },
};

/* ── Helpers ─────────────────────────────────────────────────────── */
function flattenArgs(args) {
  if (args.length === 0) return [];
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}
function rowToObj(stmt) {
  const cols = stmt.getColumnNames();
  const vals = stmt.get();
  const obj = {};
  cols.forEach((c, i) => { obj[c] = vals[i]; });
  return obj;
}

/* ── Initialisation (must be awaited before starting the server) ─── */
async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  // Enable foreign keys
  _db.run('PRAGMA foreign_keys = ON');

  // Schema
  _db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      username   TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email      TEXT UNIQUE NOT NULL,
      pw_hash    TEXT NOT NULL,
      joined     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id         TEXT PRIMARY KEY,
      author_id  TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL,
      likes      INTEGER DEFAULT 0,
      dislikes   INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id         TEXT PRIMARY KEY,
      post_id    TEXT NOT NULL,
      author_id  TEXT NOT NULL,
      body       TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_id)   REFERENCES posts(id)  ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)  ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS votes (
      user_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      type    TEXT NOT NULL CHECK(type IN ('like','dislike')),
      PRIMARY KEY (user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users(id)  ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts(id)  ON DELETE CASCADE
    );
  `);

  save(); // persist schema
  console.log('  Database ready →', DB_PATH);
}

module.exports = { db, init };
