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
const gameRouter = require('../../routes/game');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { userId: 'test-user-id', nickname: 'Tester' };
    next();
  });
  app.use('/api/game', gameRouter);
  return app;
}

// A DB that fails loudly: validation must reject before any query runs.
function poisonedDB() {
  return {
    from: jest.fn(() => { throw new Error('DB should not be touched for a rejected run'); }),
    rpc: jest.fn(() => { throw new Error('DB should not be touched for a rejected run'); })
  };
}

describe('POST /api/game/save-score — run validation', () => {
  let app;
  beforeAll(() => { app = buildApp(); });
  beforeEach(() => { getDB.mockReturnValue(poisonedDB()); });

  const rejected = [
    ['a score no run could reach',   { score: 999999999, wave: 3, enemiesKilled: 10 }],
    ['more kills than waves allow',  { score: 1000, wave: 1, enemiesKilled: 5000 }],
    ['gems out of thin air',         { score: 1000, wave: 5, enemiesKilled: 10, gemsCollected: 9000 }],
    ['a wave beyond the cap',        { score: 1000, wave: 999999, enemiesKilled: 0 }],
    ['a negative score',             { score: -50, wave: 2, enemiesKilled: 0 }],
    ['wave zero',                    { score: 100, wave: 0, enemiesKilled: 0 }],
    ['non-numeric values',           { score: 'NaN', wave: 'lots', enemiesKilled: 0 }],
    ['an empty body',                {}]
  ];

  rejected.forEach(([desc, body]) => {
    it(`rejects ${desc}`, async () => {
      const res = await request(app).post('/api/game/save-score').send(body);
      expect(res.body.success).toBe(false);
      expect(getDB().from).not.toHaveBeenCalled();
    });
  });

  it('accepts a plausible run', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 0, games_played: 0, coins: 0, gems: 0 };
    getDB.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: userData, error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    });

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 12000, wave: 8, enemiesKilled: 120, gemsCollected: 6 });

    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/game/save-boss-rush-score — run validation', () => {
  let app;
  beforeAll(() => { app = buildApp(); });
  beforeEach(() => { getDB.mockReturnValue(poisonedDB()); });

  const rejected = [
    ['more bosses than a run contains', { bossesDefeated: 500, score: 1000 }],
    ['an implausible score',            { bossesDefeated: 5, score: 999999999 }],
    ['a streak longer than the run',    { bossesDefeated: 1, fastBossStreak: 5 }],
    ['forged kill counts',              { bossesDefeated: 1, bossKillCounts: { nebulox: 999 } }],
    ['an absurd run time',              { bossesDefeated: 1, totalTimeMs: 999999999999 }]
  ];

  rejected.forEach(([desc, body]) => {
    it(`rejects ${desc}`, async () => {
      const res = await request(app).post('/api/game/save-boss-rush-score').send(body);
      expect(res.body.success).toBe(false);
      expect(getDB().from).not.toHaveBeenCalled();
    });
  });

  it('drops unknown boss ids instead of writing them to the stats blob', async () => {
    const captured = {};
    // Chainable + awaitable stub: every builder method returns the same object,
    // and `then` lets `await supabase.from(x).insert(y)` resolve.
    const table = () => {
      const t = {
        select: jest.fn(() => t),
        eq: jest.fn(() => t),
        insert: jest.fn(() => t),
        update: jest.fn(() => t),
        upsert: jest.fn(stats => { captured.stats = stats; return t; }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null }),
        single: jest.fn().mockResolvedValue({ data: { nickname: 'Tester', coins: 0, gems: 0 }, error: null }),
        then: resolve => resolve({ data: null, error: null })
      };
      return t;
    };
    getDB.mockReturnValue({ from: jest.fn(table) });

    const res = await request(app)
      .post('/api/game/save-boss-rush-score')
      .send({ bossesDefeated: 2, score: 5000, bossKillCounts: { nebulox: 1, __proto__evil: 50, made_up_boss: 99 } });

    expect(res.body.success).toBe(true);
    expect(captured.stats.boss_kill_counts).toEqual({ nebulox: 1 });
  });
});

describe('POST /api/game/upgrade-ability — ability id validation', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('rejects an ability id that does not exist', async () => {
    getDB.mockReturnValue(poisonedDB());
    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: 'not_a_real_ability' });
    expect(res.body).toEqual({ success: false, error: 'Unknown ability' });
  });

  it('rejects a non-string ability id', async () => {
    getDB.mockReturnValue(poisonedDB());
    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: { toString: 'shield' } });
    expect(res.body).toEqual({ success: false, error: 'Unknown ability' });
  });
});
