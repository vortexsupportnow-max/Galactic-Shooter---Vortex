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
const { generateRecoveryCode, hashRecoveryCode, normalizeRecoveryCode } = require('../../lib/recoveryCode');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

// Chainable stub that records what was written back
function dbWith(user, captured = {}) {
  return {
    from: jest.fn(() => {
      const q = {
        select: () => q,
        eq: () => q,
        insert: () => q,
        update: payload => { captured.update = payload; return q; },
        maybeSingle: async () => ({ data: user, error: null }),
        single: async () => ({ data: user, error: null }),
        then: resolve => resolve({ data: null, error: null })
      };
      return q;
    })
  };
}

describe('recovery codes', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('generates codes that are unambiguous and unique', () => {
    const codes = new Set();
    for (let i = 0; i < 200; i++) {
      const c = generateRecoveryCode();
      expect(c).toMatch(/^VRTX(-[0-9A-Z]{4}){3}$/);
      expect(c).not.toMatch(/[OIL01]/); // characters that get misread on paper
      codes.add(c);
    }
    expect(codes.size).toBe(200);
  });

  it('accepts a code retyped without dashes or in lowercase', async () => {
    const code = generateRecoveryCode();
    const hash = await hashRecoveryCode(code);
    const captured = {};
    getDB.mockReturnValue(dbWith({ id: 5, nickname: 'Alice', recovery_hash: hash }, captured));

    const res = await request(app).post('/api/auth/recover').send({
      nickname: 'Alice',
      code: code.toLowerCase().replace(/-/g, ' '),
      newPassword: 'brandnew123'
    });

    expect(res.body.success).toBe(true);
    expect(jwt.verify(res.body.data.token, 'test-secret').userId).toBe(5);
  });

  it('replaces the code after use, so it works only once', async () => {
    const code = generateRecoveryCode();
    const hash = await hashRecoveryCode(code);
    const captured = {};
    getDB.mockReturnValue(dbWith({ id: 5, nickname: 'Alice', recovery_hash: hash }, captured));

    const res = await request(app).post('/api/auth/recover')
      .send({ nickname: 'Alice', code, newPassword: 'brandnew123' });

    expect(res.body.success).toBe(true);
    expect(captured.update.recovery_hash).toBeDefined();
    expect(captured.update.recovery_hash).not.toBe(hash);      // old code invalidated
    expect(captured.update.password_hash).toBeDefined();
    // Nothing readable is stored
    expect(captured.update.recovery_hash).not.toContain(normalizeRecoveryCode(code));
    expect(res.body.data.recoveryCode).not.toBe(code);          // a fresh one is issued
  });

  it('rejects a wrong code with the same message as an unknown nickname', async () => {
    const hash = await hashRecoveryCode(generateRecoveryCode());
    getDB.mockReturnValue(dbWith({ id: 5, nickname: 'Alice', recovery_hash: hash }));
    const wrongCode = await request(app).post('/api/auth/recover')
      .send({ nickname: 'Alice', code: 'VRTX-2222-3333-4444', newPassword: 'brandnew123' });

    getDB.mockReturnValue(dbWith(null));
    const unknownUser = await request(app).post('/api/auth/recover')
      .send({ nickname: 'Ghost', code: 'VRTX-2222-3333-4444', newPassword: 'brandnew123' });

    expect(wrongCode.body).toEqual({ success: false, error: 'Nickname o codice di recupero non valido' });
    expect(unknownUser.body).toEqual(wrongCode.body);
  });

  it('refuses an account that has no code on file', async () => {
    getDB.mockReturnValue(dbWith({ id: 5, nickname: 'Alice', recovery_hash: null }));
    const res = await request(app).post('/api/auth/recover')
      .send({ nickname: 'Alice', code: 'VRTX-2222-3333-4444', newPassword: 'brandnew123' });
    expect(res.body.success).toBe(false);
  });

  it('enforces the password rules on the new password', async () => {
    const code = generateRecoveryCode();
    getDB.mockReturnValue(dbWith({ id: 5, nickname: 'Alice', recovery_hash: await hashRecoveryCode(code) }));

    const short = await request(app).post('/api/auth/recover')
      .send({ nickname: 'Alice', code, newPassword: 'abc' });
    const long = await request(app).post('/api/auth/recover')
      .send({ nickname: 'Alice', code, newPassword: 'x'.repeat(200) });

    expect(short.body.success).toBe(false);
    expect(long.body.success).toBe(false);
  });

  // Accounts that existed before this feature have recovery_hash = NULL. They must
  // pick one up on their next login, without that ever being able to block the login.
  describe('accounts created before recovery codes existed', () => {
    let passwordHash;
    beforeAll(async () => { passwordHash = await bcrypt.hash('secret123', 10); });

    it('receives a code on the next login', async () => {
      const captured = {};
      getDB.mockReturnValue(dbWith(
        { id: 7, nickname: 'Legacy', password_hash: passwordHash, recovery_hash: null }, captured));

      const res = await request(app).post('/api/auth/login')
        .send({ nickname: 'Legacy', password: 'secret123' });

      expect(res.body.success).toBe(true);
      expect(res.body.data.recoveryCode).toMatch(/^VRTX(-[0-9A-Z]{4}){3}$/);
      expect(captured.update.recovery_hash).toBeDefined();
      expect(captured.update.recovery_hash).not.toBe(res.body.data.recoveryCode);
    });

    it('is not handed a second code once it has one', async () => {
      const existing = await hashRecoveryCode(generateRecoveryCode());
      getDB.mockReturnValue(dbWith(
        { id: 7, nickname: 'Legacy', password_hash: passwordHash, recovery_hash: existing }));

      const res = await request(app).post('/api/auth/login')
        .send({ nickname: 'Legacy', password: 'secret123' });

      expect(res.body.success).toBe(true);
      expect(res.body.data.recoveryCode).toBeNull();
    });

    it('still logs in when the code cannot be stored', async () => {
      getDB.mockReturnValue({
        from: jest.fn(() => {
          const q = {
            select: () => q,
            eq: () => q,
            update: () => { throw new Error('write failed'); },
            maybeSingle: async () => ({
              data: { id: 7, nickname: 'Legacy', password_hash: passwordHash, recovery_hash: null },
              error: null
            })
          };
          return q;
        })
      });

      const res = await request(app).post('/api/auth/login')
        .send({ nickname: 'Legacy', password: 'secret123' });

      expect(res.body.success).toBe(true);           // the login is what matters
      expect(res.body.data.recoveryCode).toBeNull(); // just no code this time
    });
  });

  it('hands a code to a brand new account', async () => {
    getDB.mockReturnValue({
      from: jest.fn(() => {
        const q = {
          select: () => q, eq: () => q, insert: () => q,
          maybeSingle: async () => ({ data: null }),
          single: async () => ({ data: { id: 9 }, error: null })
        };
        return q;
      })
    });

    const res = await request(app).post('/api/auth/register')
      .send({ nickname: 'Newbie', password: 'secret123' });

    expect(res.body.success).toBe(true);
    expect(res.body.data.recoveryCode).toMatch(/^VRTX(-[0-9A-Z]{4}){3}$/);
  });
});
