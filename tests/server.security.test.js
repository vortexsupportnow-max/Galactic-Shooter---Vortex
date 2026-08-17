'use strict';

jest.mock('../db/database', () => ({
  getDB: jest.fn(),
  initDB: jest.fn().mockResolvedValue(undefined)
}));

process.env.JWT_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_ANON_KEY = 'test-key';

const request = require('supertest');
const app = require('../server');

describe('security headers', () => {
  it('sends a strict CSP and the usual hardening headers', async () => {
    const res = await request(app).get('/api/leaderboard/nope');

    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy']).toContain("script-src 'self'");
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('does not advertise the framework', async () => {
    const res = await request(app).get('/');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('keeps API responses out of shared caches', async () => {
    const res = await request(app).get('/api/leaderboard/nope');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('API surface', () => {
  it('404s unknown API paths instead of serving the SPA shell', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Not found' });
  });

  it('requires a token on game routes', async () => {
    const res = await request(app).get('/api/game/profile');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a forged token', async () => {
    const res = await request(app)
      .get('/api/game/profile')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.status).toBe(401);
  });

  it('answers malformed JSON in the API response shape', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"nickname": broken');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'Invalid request body' });
  });

  it('rejects bodies larger than the 16kb cap', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ nickname: 'a'.repeat(20000), password: 'x'.repeat(20000) });
    expect(res.status).toBe(400);
  });
});
