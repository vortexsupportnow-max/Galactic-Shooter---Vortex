'use strict';
// The sandbox database: db/localDb.js persisted to this browser's localStorage.
const { createLocalClient } = require('../../db/localDb');

const KEY = 'gs_sandbox_db_v1';
const adapter = {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
  },
  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked: keep in memory */ }
  }
};

const client = createLocalClient(adapter);
module.exports = { getDB: () => client, initDB: async () => {}, SANDBOX_DB_KEY: KEY };
