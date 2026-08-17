'use strict';

jest.mock('../../db/database', () => ({
  getDB: jest.fn(),
  initDB: jest.fn().mockResolvedValue(undefined)
}));

process.env.JWT_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_ANON_KEY = 'test-key';

const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const { getDB } = require('../../db/database');
const authRouter = require('../../routes/auth');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

function poisonedDB() {
  return { from: jest.fn(() => { throw new Error('DB should not be touched for invalid input'); }) };
}

describe('POST /api/auth/register — input validation', () => {
  let app;
  beforeAll(() => { app = buildApp(); });
  beforeEach(() => { getDB.mockReturnValue(poisonedDB()); });

  it('rejects a nickname carrying markup (stored XSS vector)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nickname: '<img src=x onerror=alert(1)>', password: 'secret123' });

    expect(res.body.success).toBe(false);
    expect(getDB().from).not.toHaveBeenCalled();
  });

  it('rejects a nickname with quotes or angle brackets', async () => {
    for (const nickname of ['ab"cd', "ab'cd", 'a<b>c', 'a&b']) {
      const res = await request(app).post('/api/auth/register').send({ nickname, password: 'secret123' });
      expect(res.body.success).toBe(false);
    }
  });

  it('accepts ordinary nicknames', async () => {
    getDB.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        single: jest.fn().mockResolvedValue({ data: { id: 7 }, error: null })
      })
    });

    const res = await request(app).post('/api/auth/register').send({ nickname: 'Sam_99 .x-y', password: 'secret123' });
    expect(res.body.success).toBe(true);
  });

  it('rejects a password longer than bcrypt can read (72 bytes)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nickname: 'LongPass', password: 'x'.repeat(200) });

    expect(res.body.success).toBe(false);
    expect(getDB().from).not.toHaveBeenCalled();
  });

  it('rejects non-string credentials before they reach a DB filter', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nickname: { $ne: null }, password: ['x'] });

    expect(res.body).toEqual({ success: false, error: 'Nickname and password required' });
    expect(getDB().from).not.toHaveBeenCalled();
  });

  it('reports a duplicate when the case-insensitive index rejects the insert', async () => {
    getDB.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' }
        })
      })
    });

    const res = await request(app).post('/api/auth/register').send({ nickname: 'AlIcE', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname already taken' });
  });
});

describe('POST /api/auth/login — account enumeration', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('hashes a comparison even for an unknown nickname', async () => {
    const compareSpy = jest.spyOn(bcrypt, 'compare');
    getDB.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null })
      })
    });

    const res = await request(app).post('/api/auth/login').send({ nickname: 'ghost', password: 'secret123' });

    expect(res.body).toEqual({ success: false, error: 'Invalid nickname or password' });
    expect(compareSpy).toHaveBeenCalled(); // same work as a real account → no timing tell
    compareSpy.mockRestore();
  });
});
