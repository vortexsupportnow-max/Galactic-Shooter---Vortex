'use strict';

// config.js reads the environment once, at import time, so each case re-imports
// it with a fresh module registry.
function loadConfig(env) {
  let config;
  jest.isolateModules(() => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    for (const key of Object.keys(env)) {
      if (env[key] === undefined) delete process.env[key];
    }
    try {
      config = require('../config');
    } finally {
      process.env = saved;
    }
  });
  return config;
}

function loadConfigExpectingThrow(env) {
  let error = null;
  try {
    loadConfig(env);
  } catch (err) {
    error = err;
  }
  return error;
}

const PROD = { NODE_ENV: 'production', SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'k' };

describe('JWT secret policy', () => {
  it('refuses to boot in production without a secret', () => {
    const err = loadConfigExpectingThrow({ ...PROD, JWT_SECRET: undefined });
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/JWT_SECRET environment variable is required/);
  });

  it('refuses to boot in production with the published development secret', () => {
    const err = loadConfigExpectingThrow({
      ...PROD,
      JWT_SECRET: 'galactic-shooter-dev-secret-do-not-use-in-production'
    });
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/development secret/);
  });

  // Regression: a length check that threw here took the whole deployment down.
  it('boots in production with a short private secret, flagging it as weak', () => {
    const config = loadConfig({ ...PROD, JWT_SECRET: 'twenty-chars-secret!' });
    expect(config.JWT_SECRET).toBe('twenty-chars-secret!');
    expect(config.JWT_SECRET_IS_WEAK).toBe(true);
  });

  it('does not flag a long secret', () => {
    const config = loadConfig({ ...PROD, JWT_SECRET: 'a'.repeat(48) });
    expect(config.JWT_SECRET_IS_WEAK).toBe(false);
  });

  it('falls back to the development secret outside production', () => {
    const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: undefined, SUPABASE_ANON_KEY: 'k' });
    expect(config.JWT_SECRET).toContain('dev-secret');
  });
});

describe('Supabase key selection', () => {
  it('prefers the service-role key when both are present', () => {
    const config = loadConfig({ ...PROD, JWT_SECRET: 'a'.repeat(48), SUPABASE_SERVICE_ROLE_KEY: 'service-key' });
    expect(config.SUPABASE_KEY).toBe('service-key');
    expect(config.USING_SERVICE_ROLE_KEY).toBe(true);
  });

  it('falls back to the anon key', () => {
    const config = loadConfig({ ...PROD, JWT_SECRET: 'a'.repeat(48), SUPABASE_SERVICE_ROLE_KEY: undefined });
    expect(config.SUPABASE_KEY).toBe('k');
    expect(config.USING_SERVICE_ROLE_KEY).toBe(false);
  });
});
