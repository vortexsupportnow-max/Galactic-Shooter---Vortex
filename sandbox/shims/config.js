'use strict';
// Sandbox: no secrets, no network, nothing production about it.
module.exports = {
  NODE_ENV: 'sandbox', isProduction: false, isTest: false,
  JWT_SECRET: 'sandbox', JWT_SECRET_IS_WEAK: false,
  SUPABASE_URL: null, SUPABASE_KEY: null, SUPABASE_ANON_KEY: null, SUPABASE_SERVICE_ROLE_KEY: null,
  USING_SERVICE_ROLE_KEY: false, LOCAL_DB: true, ALLOWED_ORIGINS: []
};
