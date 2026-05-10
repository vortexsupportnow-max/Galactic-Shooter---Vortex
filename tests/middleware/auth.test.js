'use strict';

// Must mock db/database before any require that transitively loads it
jest.mock('../../db/database', () => ({
  getDB: jest.fn(),
  initDB: jest.fn().mockResolvedValue(undefined)
}));

// Suppress JWT_SECRET warning during tests
process.env.JWT_SECRET = 'test-secret';

const jwt = require('jsonwebtoken');
const authMiddleware = require('../../middleware/auth');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authMiddleware', () => {
  const JWT_SECRET = 'test-secret';
  const validPayload = { userId: 'user-1', nickname: 'Tester' };

  it('returns 401 when Authorization header is missing', () => {
    const req = { headers: {} };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header has no bearer token', () => {
    const req = { headers: { authorization: 'Bearer ' } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', () => {
    const req = { headers: { authorization: 'Bearer not.a.valid.token' } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is signed with wrong secret', () => {
    const token = jwt.sign(validPayload, 'wrong-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is expired', () => {
    const token = jwt.sign(validPayload, JWT_SECRET, { expiresIn: -1 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches decoded payload to req.user with a valid token', () => {
    const token = jwt.sign(validPayload, JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = makeRes();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject(validPayload);
    expect(res.status).not.toHaveBeenCalled();
  });
});
