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
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../../db/database');
const authRouter = require('../../routes/auth');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

// Helper: build a chainable Supabase query mock
function mockQuery(result) {
  const q = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    maybeSingle: jest.fn().mockResolvedValue(result),
    limit: jest.fn().mockReturnThis(),
  };
  return q;
}

describe('POST /api/auth/register', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('returns error when nickname is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname and password required' });
  });

  it('returns error when password is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ nickname: 'Alice' });
    expect(res.body).toEqual({ success: false, error: 'Nickname and password required' });
  });

  it('returns error when nickname is too short (< 3 chars)', async () => {
    const res = await request(app).post('/api/auth/register').send({ nickname: 'AB', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname must be 3-20 characters' });
  });

  it('returns error when nickname is too long (> 20 chars)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ nickname: 'A'.repeat(21), password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname must be 3-20 characters' });
  });

  it('returns error when password is too short (< 8 chars)', async () => {
    const res = await request(app).post('/api/auth/register').send({ nickname: 'Alice', password: 'short' });
    expect(res.body).toEqual({ success: false, error: 'Password must be at least 8 characters' });
  });

  it('returns error when nickname contains profanity', async () => {
    const res = await request(app).post('/api/auth/register').send({ nickname: 'CazzoXX', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname contains inappropriate language' });
  });

  it('returns error when nickname contains English profanity', async () => {
    const res = await request(app).post('/api/auth/register').send({ nickname: 'FuckYou', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname contains inappropriate language' });
  });

  it('returns error when nickname uses leet-speak to bypass filter', async () => {
    const res = await request(app).post('/api/auth/register').send({ nickname: 'c4zz0', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname contains inappropriate language' });
  });

  it('returns error when nickname is already taken', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'existing-id' } })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/auth/register').send({ nickname: 'Alice', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname already taken' });
  });

  it('returns token and nickname on successful registration', async () => {
    const newUserId = 'new-user-id';
    const calls = [];
    const supabase = {
      from: jest.fn((table) => {
        const q = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null }),
          single: jest.fn().mockResolvedValue({ data: { id: newUserId }, error: null })
        };
        calls.push(table);
        return q;
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/auth/register').send({ nickname: 'Alice', password: 'secret123' });
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.nickname).toBe('Alice');

    // Verify the token is valid
    const decoded = jwt.verify(res.body.data.token, 'test-secret');
    expect(decoded.userId).toBe(newUserId);
    expect(decoded.nickname).toBe('Alice');
  });

  it('returns error when DB insert fails', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/auth/register').send({ nickname: 'Alice', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'insert failed' });
  });
});

describe('POST /api/auth/login', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('returns error when nickname is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Nickname and password required' });
  });

  it('returns error when password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ nickname: 'Alice' });
    expect(res.body).toEqual({ success: false, error: 'Nickname and password required' });
  });

  it('returns error when user is not found', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/auth/login').send({ nickname: 'Ghost', password: 'secret123' });
    expect(res.body).toEqual({ success: false, error: 'Invalid nickname or password' });
  });

  it('returns error when password is wrong', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'uid', nickname: 'Alice', password_hash: hash } })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/auth/login').send({ nickname: 'Alice', password: 'wrong-password' });
    expect(res.body).toEqual({ success: false, error: 'Invalid nickname or password' });
  });

  it('returns token and nickname on successful login', async () => {
    const hash = await bcrypt.hash('secret123', 10);
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'uid-1', nickname: 'Alice', password_hash: hash } })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/auth/login').send({ nickname: 'Alice', password: 'secret123' });
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.nickname).toBe('Alice');

    const decoded = jwt.verify(res.body.data.token, 'test-secret');
    expect(decoded.userId).toBe('uid-1');
    expect(decoded.nickname).toBe('Alice');
  });
});

describe('GET /api/auth/me', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  const JWT_SECRET = 'test-secret';
  const userId = 'user-me-1';
  const token = jwt.sign({ userId, nickname: 'Alice' }, JWT_SECRET);

  it('returns error when no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.body).toEqual({ success: false, error: 'No token' });
  });

  it('returns error when token is invalid', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token');
    expect(res.body).toEqual({ success: false, error: 'Invalid token' });
  });

  it('returns error when user is not found in DB', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.body).toEqual({ success: false, error: 'User not found' });
  });

  it('returns error when DB query errors', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.body).toEqual({ success: false, error: 'Invalid token' });
  });

  it('returns user data on success', async () => {
    const userData = { id: userId, nickname: 'Alice', coins: 100, gems: 5, games_played: 3, max_score: 5000, max_wave: 10, created_at: '2024-01-01' };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: userData, error: null })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.body).toEqual({ success: true, data: userData });
  });
});
