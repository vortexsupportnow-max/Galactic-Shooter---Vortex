'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getDB() {
  return supabase;
}

async function initDB() {
  // Schema is managed via the Supabase SQL Editor (see db/schema.sql).
  // Here we just verify connectivity on startup.
  const { error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    throw new Error(`Supabase connectivity check failed: ${error.message}`);
  }
  console.log('Supabase database connected');
}

module.exports = { getDB, initDB };
