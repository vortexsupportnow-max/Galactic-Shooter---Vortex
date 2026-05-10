const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'game.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const database = getDB();
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = schema.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    if (stmt.trim()) {
      database.prepare(stmt).run();
    }
  }
  console.log('Database initialized');
}

module.exports = { getDB, initDB };
