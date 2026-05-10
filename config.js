'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const JWT_SECRET = process.env.JWT_SECRET || 'galactic-shooter-secret-2024';

if (!process.env.JWT_SECRET) {
  console.warn(
    'WARNING: JWT_SECRET env var not set. Using insecure default secret. ' +
    'Set JWT_SECRET in production environments.'
  );
}

module.exports = { JWT_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY };
