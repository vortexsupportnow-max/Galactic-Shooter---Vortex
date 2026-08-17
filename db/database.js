'use strict';

const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY, USING_SERVICE_ROLE_KEY } = require('../config');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables are required'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // This is a trusted server-side client: never persist or refresh sessions.
    persistSession: false,
    autoRefreshToken: false
  }
});

function getDB() {
  return supabase;
}

async function initDB() {
  // Schema is managed via the Supabase SQL Editor (see db/schema.sql and db/schema_rls.sql).
  // Here we just verify connectivity on startup.
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    throw new Error(`Supabase connectivity check failed: ${error.message}`);
  }
  console.log(`Supabase database connected (${USING_SERVICE_ROLE_KEY ? 'service-role key' : 'anon key'})`);
}

module.exports = { getDB, initDB };
