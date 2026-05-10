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
const { getDB } = require('../../db/database');
const leaderboardRouter = require('../../routes/leaderboard');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/leaderboard', leaderboardRouter);
  return app;
}

// ─── GET /api/leaderboard/scores ──────────────────────────────────────────────

describe('GET /api/leaderboard/scores', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  const mockRows = [
    { rank: 1, nickname: 'Alice', score: 9999, wave: 20 },
    { rank: 2, nickname: 'Bob', score: 8000, wave: 15 }
  ];

  it('returns leaderboard with no filter (all-time)', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: mockRows, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/scores');
    expect(res.body).toEqual({ success: true, data: mockRows });
    expect(supabase.rpc).toHaveBeenCalledWith('get_score_leaderboard', { filter_date: null });
  });

  it('passes a date filter for "daily"', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: mockRows, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/scores?filter=daily');
    expect(res.body.success).toBe(true);

    const [, args] = supabase.rpc.mock.calls[0];
    expect(args.filter_date).toBeTruthy();
    // The date should be approximately 24 hours ago
    const filterTime = new Date(args.filter_date).getTime();
    expect(Date.now() - filterTime).toBeCloseTo(86400000, -4); // within a few seconds
  });

  it('passes a date filter for "weekly"', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: mockRows, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/scores?filter=weekly');
    expect(res.body.success).toBe(true);

    const [, args] = supabase.rpc.mock.calls[0];
    expect(args.filter_date).toBeTruthy();
    const filterTime = new Date(args.filter_date).getTime();
    expect(Date.now() - filterTime).toBeCloseTo(7 * 86400000, -4);
  });

  it('treats unknown filter values as all-time (null date)', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: mockRows, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/scores?filter=monthly');
    expect(res.body.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('get_score_leaderboard', { filter_date: null });
  });

  it('returns error on DB failure', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'rpc failed' } })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/scores');
    expect(res.body).toEqual({ success: false, error: 'rpc failed' });
  });

  it('returns empty array when no scores exist', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/scores');
    expect(res.body).toEqual({ success: true, data: [] });
  });
});

// ─── GET /api/leaderboard/waves ───────────────────────────────────────────────

describe('GET /api/leaderboard/waves', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  const mockRows = [
    { rank: 1, nickname: 'Alice', max_wave: 120 },
    { rank: 2, nickname: 'Bob', max_wave: 95 }
  ];

  it('returns wave leaderboard with no filter (all-time)', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: mockRows, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/waves');
    expect(res.body).toEqual({ success: true, data: mockRows });
    expect(supabase.rpc).toHaveBeenCalledWith('get_wave_leaderboard', { filter_date: null });
  });

  it('passes a date filter for "daily" on wave leaderboard', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: mockRows, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/waves?filter=daily');
    expect(res.body.success).toBe(true);

    const [, args] = supabase.rpc.mock.calls[0];
    expect(args.filter_date).toBeTruthy();
  });

  it('passes a date filter for "weekly" on wave leaderboard', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: mockRows, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/waves?filter=weekly');
    expect(res.body.success).toBe(true);

    const [, args] = supabase.rpc.mock.calls[0];
    expect(args.filter_date).toBeTruthy();
    const filterTime = new Date(args.filter_date).getTime();
    expect(Date.now() - filterTime).toBeCloseTo(7 * 86400000, -4);
  });

  it('returns error on DB failure for waves', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'wave rpc failed' } })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/waves');
    expect(res.body).toEqual({ success: false, error: 'wave rpc failed' });
  });

  it('returns empty array when no wave scores exist', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: [], error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/leaderboard/waves');
    expect(res.body).toEqual({ success: true, data: [] });
  });
});
