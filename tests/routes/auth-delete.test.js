'use strict';
jest.mock('../../db/database', () => ({ getDB: jest.fn() }));
process.env.JWT_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'http://localhost';
process.env.SUPABASE_ANON_KEY = 'test-key';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getDB } = require('../../db/database');
const app = express();
app.use(express.json());
app.use('/api/auth', require('../../routes/auth'));
const token = jwt.sign({ userId: 7 }, 'test-secret');
let query;
let result;
beforeEach(() => {
  result = { data: [{ id: 7 }], error: null };
  query = {
    select: jest.fn(() => query), eq: jest.fn(() => query),
    delete: jest.fn(() => query),
    maybeSingle: jest.fn().mockResolvedValue({ data: { id: 7, password_hash: bcrypt.hashSync('password123', 4) }, error: null }),
    then: resolve => resolve(result)
  };
  getDB.mockReset().mockReturnValue({ from: jest.fn(() => query) });
});
function remove(body = { password: 'password123', confirmation: 'ELIMINA' }) {
  return request(app).delete('/api/auth/account').set('Authorization', `Bearer ${token}`).send(body);
}
test('rejects requests without authentication', async () => {
  expect((await request(app).delete('/api/auth/account').send({})).status).toBe(401);
  expect(getDB).not.toHaveBeenCalled();
});
test('requires explicit confirmation and a valid password', async () => {
  expect((await remove({ password: 'password123' })).status).toBe(400);
  expect((await remove({ password: 'wrong', confirmation: 'ELIMINA' })).status).toBe(403);
  expect(query.delete).not.toHaveBeenCalled();
});
test('deletes only the authenticated account, ignoring supplied user IDs', async () => {
  const res = await remove({ password: 'password123', confirmation: 'ELIMINA', userId: 99 });
  expect(res.body.success).toBe(true);
  expect(query.delete).toHaveBeenCalledTimes(1);
  expect(query.eq).toHaveBeenCalledWith('id', 7);
  expect(query.eq).not.toHaveBeenCalledWith('id', 99);
  expect(query.eq).toHaveBeenCalledWith('password_hash', expect.any(String));
});
test('does not report success if Supabase deletes no rows', async () => {
  result.data = [];
  expect((await remove()).status).toBe(409);
});
test('handles database failure without exposing details', async () => {
  result = { data: null, error: { message: 'private database details' } };
  const res = await remove();
  expect(res.body.success).toBe(false);
  expect(JSON.stringify(res.body)).not.toContain('private database details');
});
test('rejects tokens belonging to an already deleted account', async () => {
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  expect((await remove()).status).toBe(401);
  expect(query.delete).not.toHaveBeenCalled();
});
