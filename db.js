// Database layer: PostgreSQL when DATABASE_URL is set (production, e.g. Neon), otherwise SQLite for local development.
const path = require('path');
const url = process.env.DATABASE_URL;

if (url) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: url, max: 3 });
  const q = (sql, p = []) => { let i = 0; return pool.query(sql.replace(/\?/g, () => '$' + (++i)), p); };
  module.exports = {
    kind: 'postgres',
    get: async (s, p) => (await q(s, p)).rows[0],
    all: async (s, p) => (await q(s, p)).rows,
    run: async (s, p) => { await q(s, p); },
    init: () => pool.query(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, created TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS saved(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL, created TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY(user_id, exercise_id));`),
  };
} else {
  const { DatabaseSync } = require('node:sqlite');
  const file = process.env.DB_PATH || (process.env.VERCEL ? '/tmp/app.db' : path.join(__dirname, 'data', 'app.db'));
  if (process.env.VERCEL) console.warn('DATABASE_URL is not set: using temporary storage. Accounts will be lost on cold starts.');
  const db = new DatabaseSync(file);
  module.exports = {
    kind: 'sqlite',
    get: async (s, p = []) => db.prepare(s).get(...p),
    all: async (s, p = []) => db.prepare(s).all(...p),
    run: async (s, p = []) => { db.prepare(s).run(...p); },
    init: async () => db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS saved(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, exercise_id TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, exercise_id));`),
  };
}
