'use strict';

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

// ── Supabase keys ─────────────────────────────────────────────────────────────
// The service-role key is the correct key for a trusted backend: it bypasses RLS,
// so every table can be locked down (see db/schema_rls.sql) and a leaked anon key
// — which in Supabase is a *public* key by design — grants an attacker nothing.
// The anon key is kept as a fallback so existing deployments keep working, but it
// is only safe while the tables have no RLS, i.e. while the key itself is secret.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
const USING_SERVICE_ROLE_KEY = Boolean(SUPABASE_SERVICE_ROLE_KEY);

// ── JWT signing secret ────────────────────────────────────────────────────────
const DEV_JWT_SECRET = 'galactic-shooter-dev-secret-do-not-use-in-production';
const MIN_JWT_SECRET_LENGTH = 32;

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (isProduction) {
    // Never fall back to a hard-coded secret in production: anyone who reads this
    // file could then forge tokens for any account.
    throw new Error(
      'JWT_SECRET environment variable is required in production. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
  JWT_SECRET = DEV_JWT_SECRET;
  if (!isTest) {
    console.warn('WARNING: JWT_SECRET not set — using the development secret. Set JWT_SECRET before deploying.');
  }
} else if (JWT_SECRET.length < MIN_JWT_SECRET_LENGTH && !isTest) {
  const msg = `JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters and is brute-forceable.`;
  if (isProduction) throw new Error(msg);
  console.warn(`WARNING: ${msg}`);
}

if (isProduction && !USING_SERVICE_ROLE_KEY) {
  console.warn(
    'WARNING: running with SUPABASE_ANON_KEY. Anon keys are meant to be public — ' +
    'set SUPABASE_SERVICE_ROLE_KEY and apply db/schema_rls.sql so a leaked anon key is inert.'
  );
}

// Comma-separated list of origins allowed to call the API from a browser.
// Empty (the default) means same-origin only, which is what this app needs.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

module.exports = {
  NODE_ENV,
  isProduction,
  isTest,
  JWT_SECRET,
  SUPABASE_URL,
  SUPABASE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  USING_SERVICE_ROLE_KEY,
  ALLOWED_ORIGINS
};
