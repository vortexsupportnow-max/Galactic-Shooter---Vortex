'use strict';

const path = require('path');
const { SUPABASE_URL, SUPABASE_KEY, USING_SERVICE_ROLE_KEY, LOCAL_DB, isProduction } = require('../config');

// Local mode (npm run local): a JSON-file database, no Supabase needed.
// Refused in production — it has no access control and lives on one machine.
let client;
if (LOCAL_DB) {
  if (isProduction) throw new Error('DB_MODE=local cannot be used with NODE_ENV=production');
  const { createLocalClient } = require('./localDb');
  const file = process.env.LOCAL_DB_FILE || path.join(__dirname, 'local-data.json');
  client = createLocalClient(file);
  client._file = file;
} else {
  const { createClient } = require('@supabase/supabase-js');
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables are required ' +
      '(or run `npm run local` to play with a local database)'
    );
  }
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      // This is a trusted server-side client: never persist or refresh sessions.
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getDB() {
  return client;
}

async function initDB() {
  if (LOCAL_DB) {
    console.log(`Local database: ${client._file}`);
    return;
  }
  // Schema is managed via the Supabase SQL Editor (see db/schema.sql and db/schema_rls.sql).
  // Here we just verify connectivity on startup.
  const { error } = await client.from('users').select('id').limit(1);
  if (error) {
    throw new Error(`Supabase connectivity check failed: ${error.message}`);
  }
  console.log(`Supabase database connected (${USING_SERVICE_ROLE_KEY ? 'service-role key' : 'anon key'})`);
}

module.exports = { getDB, initDB };
