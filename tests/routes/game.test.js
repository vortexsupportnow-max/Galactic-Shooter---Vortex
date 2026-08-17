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
const { GENERIC_ERROR } = require('../../lib/respond');

// Inject req.user without a real JWT so we can test game logic in isolation
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

// Helpers
function buildSupabase(overrides = {}) {
  const defaults = {
    fromImpl: () => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null })
    }),
    rpcImpl: jest.fn().mockResolvedValue({ data: null, error: null })
  };

  const from = overrides.from || defaults.fromImpl;
  const rpc = overrides.rpc || defaults.rpcImpl;
  return { from: jest.fn(from), rpc };
}

// ─── POST /api/game/save-score ────────────────────────────────────────────────

describe('POST /api/game/save-score', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('calculates coins and includes wave/milestone gem rewards', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 0, games_played: 2, coins: 0, gems: 0 };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: userData, error: null }) // user fetch
          .mockResolvedValue({ data: {}, error: null })            // fallback
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 3000, wave: 5, enemiesKilled: 50 });

    expect(res.body.success).toBe(true);
    expect(res.body.data.coinsEarned).toBe(30);
    expect(res.body.data.gemsEarned).toBe(11);
    expect(res.body.data.newMaxScore).toBe(3000);
    expect(res.body.data.newMaxWave).toBe(5);
  });

  it('awards 5 gems when wave first crosses milestone 20', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 10, games_played: 0, coins: 0, gems: 0 };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: userData, error: null })
          .mockResolvedValue({ data: {}, error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 1000, wave: 20, enemiesKilled: 0 });

    expect(res.body.success).toBe(true);
    expect(res.body.data.gemsEarned).toBe(9);
  });

  it('awards 10 gems when wave first crosses milestones 20 and 50 simultaneously', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 0, games_played: 0, coins: 0, gems: 0 };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: userData, error: null })
          .mockResolvedValue({ data: {}, error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 5000, wave: 55, enemiesKilled: 0 });

    expect(res.body.success).toBe(true);
    expect(res.body.data.gemsEarned).toBe(31);
  });

  it('awards all wave and milestone gem rewards when jumping to wave 100', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 0, games_played: 0, coins: 0, gems: 0 };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: userData, error: null })
          .mockResolvedValue({ data: {}, error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 5000, wave: 100, enemiesKilled: 0 });

    expect(res.body.success).toBe(true);
    expect(res.body.data.gemsEarned).toBe(40);
  });

  it('does not award milestone gems when wave milestone was already reached', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 25, games_played: 0, coins: 0, gems: 0 };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: userData, error: null })
          .mockResolvedValue({ data: {}, error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 2000, wave: 20, enemiesKilled: 0 });

    expect(res.body.success).toBe(true);
    expect(res.body.data.gemsEarned).toBe(4);
  });

  it('treats missing enemiesKilled as 0', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 0, games_played: 0, coins: 0, gems: 0 };
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn()
          .mockResolvedValueOnce({ data: userData, error: null })
          .mockResolvedValue({ data: {}, error: null })
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 500, wave: 3 });

    expect(res.body.success).toBe(true);
  });

  it('returns error on score insert failure', async () => {
    const userData = { nickname: 'Tester', max_score: 0, max_wave: 0, games_played: 0, coins: 0, gems: 0 };
    let callCount = 0;
    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: userData, error: null }),
        // First from() is user fetch; second is scores insert
        error: callCount++ === 0 ? null : { message: 'scores insert error' }
      })),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };

    // Simpler: override so first call succeeds, second fails
    let fromCount = 0;
    const supabase2 = {
      from: jest.fn(() => {
        fromCount++;
        if (fromCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: userData, error: null })
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'scores insert error' } }),
          // for the chained insert call pattern
          then: undefined
        };
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };

    // Use a pattern where the insert chain returns an error
    let fromIdx = 0;
    const supabase3 = {
      from: jest.fn(() => {
        const idx = fromIdx++;
        if (idx === 0) {
          // user fetch
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: userData, error: null })
          };
        }
        // scores insert - needs to be an awaitable that returns error
        const chain = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          insert: jest.fn(() => Promise.resolve({ error: { message: 'scores insert error' } }))
        };
        return chain;
      }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null })
    };
    getDB.mockReturnValue(supabase3);

    const res = await request(app)
      .post('/api/game/save-score')
      .send({ score: 100, wave: 1, enemiesKilled: 0 });

    // Route inserts into scores table (second from() call returns error)
    expect(res.body.success).toBe(false);
  });
});

// ─── GET /api/game/profile ────────────────────────────────────────────────────

describe('GET /api/game/profile', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('returns user profile with abilities and achievements', async () => {
    const user = { id: 'test-user-id', nickname: 'Tester', coins: 200, gems: 10, games_played: 5, max_score: 8000, max_wave: 15, created_at: '2024-01-01' };
    const abilities = [{ ability_id: 'shield', level: 2 }];
    const achievements = [{ achievement_id: 'score_1k', unlocked_at: '2024-01-02' }];

    // Now 6 tables: users, user_abilities, achievements, user_skins, user_season_pass, user_mission_progress
    let tableIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: user, error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: abilities, error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: achievements, error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) }
    ];

    const supabase = {
      from: jest.fn(() => tables[tableIdx++] || tables[tables.length - 1])
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/game/profile');
    expect(res.body.success).toBe(true);
    expect(res.body.data.nickname).toBe('Tester');
  });

  it('returns error when user not found', async () => {
    let tableIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) }
    ];
    const supabase = { from: jest.fn(() => tables[tableIdx++] || tables[tables.length - 1]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/game/profile');
    expect(res.body).toEqual({ success: false, error: 'User not found' });
  });

  it('returns error on DB user query failure', async () => {
    let tableIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: 'db failure' } }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), then: (resolve) => resolve({ data: [], error: null }) }
    ];
    const supabase = { from: jest.fn(() => tables[tableIdx++] || tables[tables.length - 1]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/game/profile');
    expect(res.body).toEqual({ success: false, error: GENERIC_ERROR });
  });
});

// ─── POST /api/game/upgrade-ability ──────────────────────────────────────────

describe('POST /api/game/upgrade-ability', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('returns error when ability is not unlocked', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: 'shield' });
    expect(res.body).toEqual({ success: false, error: 'Ability not unlocked' });
  });

  it('returns error when ability is already max level', async () => {
    let idx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 10 } }) }
    ];
    const supabase = { from: jest.fn(() => tables[0]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: 'shield' });
    expect(res.body).toEqual({ success: false, error: 'Already max level' });
  });

  it('returns error when user does not have enough coins', async () => {
    let fromIdx = 0;
    const tables = [
      // user_abilities - ability exists at level 1
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 1 } }) },
      // users - not enough coins (common lvl1→2 costs 1*500*1 = 500)
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 100 }, error: null }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[1]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: 'shield' });
    expect(res.body).toEqual({ success: false, error: 'Not enough coins' });
  });

  it('upgrades ability and deducts coins on success (common ability)', async () => {
    let fromIdx = 0;
    const tables = [
      // user_abilities query
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 1 } }) },
      // users coins query
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 5000 }, error: null }) },
      // users update (deduct) – chain: .update(...).eq('id', userId)
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) },
      // user_abilities update – chain: .update(...).eq('user_id').eq('ability_id')
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: 'shield' });
    expect(res.body.success).toBe(true);
    expect(res.body.data.newLevel).toBe(2);
    // common rarity, level 1 → 2: cost = (1+1) * 500 * 1 = 1000
    expect(res.body.data.coinsSpent).toBe(1000);
  });

  it('computes correct cost for legendary ability', async () => {
    let fromIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 2 } }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 99999 }, error: null }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    // 'god_mode' is legendary, currentLevel=2 → cost = (2+1) * 500 * 8 = 12000
    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: 'god_mode' });
    expect(res.body.success).toBe(true);
    expect(res.body.data.coinsSpent).toBe(12000);
  });

  it('computes correct cost for season-exclusive abilities', async () => {
    let fromIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 2 } }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 99999 }, error: null }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    // 'sakura_storm' is epic, currentLevel=2 → cost = (2+1) * 500 * 4 = 6000
    const res = await request(app).post('/api/game/upgrade-ability').send({ abilityId: 'sakura_storm' });
    expect(res.body.success).toBe(true);
    expect(res.body.data.coinsSpent).toBe(6000);
  });
});

// ─── POST /api/game/open-crate ────────────────────────────────────────────────

describe('POST /api/game/open-crate', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('returns error when user does not have enough gems', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { gems: 5 }, error: null })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/open-crate').send({});
    expect(res.body).toEqual({ success: false, error: 'Not enough gems (need 10)' });
  });

  it('unlocks new ability when user has enough gems', async () => {
    let fromIdx = 0;
    const tables = [
      // user gems fetch
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { gems: 20 }, error: null }) },
      // deduct gems update
      { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) },
      // user_abilities check – new ability (not owned)
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null }) },
      // user_abilities insert
      { insert: jest.fn().mockResolvedValue({ error: null }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/open-crate').send({});
    expect(res.body.success).toBe(true);
    expect(res.body.data.results[0]).toHaveProperty('abilityId');
    expect(res.body.data.results[0]).toHaveProperty('rarity');
    expect(res.body.data.results[0].level).toBe(1);
    expect(res.body.data.results[0].alreadyOwned).toBe(false);
  });

  it('upgrades existing ability level when already owned and below max level', async () => {
    let fromIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { gems: 20 }, error: null }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 3 } }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/open-crate').send({});
    expect(res.body.success).toBe(true);
    expect(res.body.data.results[0].alreadyOwned).toBe(true);
    expect(res.body.data.results[0].level).toBe(4);
  });

  it('refunds 5 gems when ability is already at max level', async () => {
    const updateMock = jest.fn().mockReturnThis();
    const eqMock = jest.fn().mockResolvedValue({ error: null });

    let fromIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { gems: 20 }, error: null }) },
      { update: updateMock, eq: eqMock },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 10 } }) },
      { update: updateMock, eq: eqMock }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/open-crate').send({});
    expect(res.body.success).toBe(true);
    expect(res.body.data.results[0].level).toBe(10);
    expect(res.body.data.results[0].alreadyOwned).toBe(true);
  });
});

describe('POST /api/game/spin-wheel', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns cooldown error when the wheel is not ready', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { coins: 100, gems: 10, last_wheel_spin_at: new Date().toISOString(), free_mystery_crates: 0, free_void_crates: 0 },
          error: null
        })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/spin-wheel').send({});
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Wheel not ready yet');
  });

  it('awards coins when the wheel lands on the coin segment', async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 100, gems: 5, last_wheel_spin_at: null, free_mystery_crates: 0, free_void_crates: 0 }, error: null }) },
      { update: jest.fn().mockReturnValue({ eq: updateEq }) }
    ];
    let idx = 0;
    const supabase = { from: jest.fn(() => tables[idx++] || tables[1]) };
    getDB.mockReturnValue(supabase);
    jest.spyOn(Math, 'random').mockReturnValue(0.01);

    const res = await request(app).post('/api/game/spin-wheel').send({});
    expect(res.body.success).toBe(true);
    expect(res.body.data.reward.kind).toBe('coins');
    expect(res.body.data.reward.amount).toBe(750);
    expect(updateEq).toHaveBeenCalled();
  });

  it('awards a free mystery crate from the wheel', async () => {
    const updateEq = jest.fn().mockResolvedValue({ error: null });
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 100, gems: 5, last_wheel_spin_at: null, free_mystery_crates: 0, free_void_crates: 0 }, error: null }) },
      { update: jest.fn().mockReturnValue({ eq: updateEq }) }
    ];
    let idx = 0;
    const supabase = { from: jest.fn(() => tables[idx++] || tables[1]) };
    getDB.mockReturnValue(supabase);
    jest.spyOn(Math, 'random').mockReturnValue(0.91);

    const res = await request(app).post('/api/game/spin-wheel').send({});
    expect(res.body.success).toBe(true);
    expect(res.body.data.reward.kind).toBe('crate');
    expect(res.body.data.reward.crateType).toBe('mystery');
  });
});

describe('POST /api/game/open-crate with free crates', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('uses a free mystery crate before spending gems', async () => {
    let fromIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 0, gems: 0, free_mystery_crates: 1, free_void_crates: 0 }, error: null }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null }) },
      { insert: jest.fn().mockResolvedValue({ error: null }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/open-crate').send({ crateType: 'mystery' });
    expect(res.body.success).toBe(true);
    expect(res.body.data.usedFreeCrate).toBe(true);
  });

  it('grants coin compensation when a free crate rolls a maxed ability', async () => {
    let fromIdx = 0;
    const tables = [
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { coins: 0, gems: 0, free_mystery_crates: 1, free_void_crates: 0 }, error: null }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) },
      { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: { level: 10 } }) },
      { update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }) }
    ];
    const supabase = { from: jest.fn(() => tables[fromIdx++] || tables[3]) };
    getDB.mockReturnValue(supabase);

    const res = await request(app).post('/api/game/open-crate').send({ crateType: 'mystery' });
    expect(res.body.success).toBe(true);
    expect(res.body.data.usedFreeCrate).toBe(true);
    expect(res.body.data.results[0].coinsCompensation).toBeGreaterThan(0);
  });
});

// ─── GET /api/game/achievements ───────────────────────────────────────────────

describe('GET /api/game/achievements', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  it('returns achievements list on success', async () => {
    const achievements = [
      { achievement_id: 'score_1k', unlocked_at: '2024-01-01' },
      { achievement_id: 'wave_5', unlocked_at: '2024-01-02' }
    ];
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: achievements, error: null })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/game/achievements');
    expect(res.body).toEqual({ success: true, data: achievements });
  });

  it('returns error on DB failure', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'db error' } })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/game/achievements');
    expect(res.body).toEqual({ success: false, error: GENERIC_ERROR });
  });

  it('returns empty array when no achievements', async () => {
    const supabase = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      })
    };
    getDB.mockReturnValue(supabase);

    const res = await request(app).get('/api/game/achievements');
    expect(res.body).toEqual({ success: true, data: [] });
  });
});

// ─── checkAchievements (via save-score) ───────────────────────────────────────

describe('checkAchievements thresholds (via save-score)', () => {
  let app;
  beforeAll(() => { app = buildApp(); });

  const thresholdCases = [
    { desc: 'score_1k at score 1000', body: { score: 1000, wave: 1, enemiesKilled: 0 }, expectedIds: ['score_1k'] },
    { desc: 'score_10k at score 10000', body: { score: 10000, wave: 1, enemiesKilled: 0 }, expectedIds: ['score_1k', 'score_10k'] },
    { desc: 'score_100k at score 100000', body: { score: 100000, wave: 1, enemiesKilled: 0 }, expectedIds: ['score_1k', 'score_10k', 'score_100k'] },
    { desc: 'wave_5 at wave 5', body: { score: 0, wave: 5, enemiesKilled: 0 }, expectedIds: ['wave_5'] },
    { desc: 'wave_10 at wave 10', body: { score: 0, wave: 10, enemiesKilled: 0 }, expectedIds: ['wave_5', 'wave_10'] },
    // Waves here must be high enough for the kill count to pass run validation:
    // a wave-1 run with 500 kills is rejected as tampered before it gets this far.
    { desc: 'kills_100 at enemiesKilled 100', body: { score: 0, wave: 5, enemiesKilled: 100 }, expectedIds: ['kills_100'] },
    { desc: 'kills_500 at enemiesKilled 500', body: { score: 0, wave: 15, enemiesKilled: 500 }, expectedIds: ['kills_100', 'kills_500'] }
  ];

  thresholdCases.forEach(({ desc, body, expectedIds }) => {
    it(`triggers achievement ${desc}`, async () => {
      const userData = { nickname: 'Tester', max_score: 0, max_wave: 0, games_played: 0, coins: 0, gems: 0 };
      const rpcMock = jest.fn().mockResolvedValue({ data: null, error: null });
      const supabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          insert: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: userData, error: null })
        }),
        rpc: rpcMock
      };
      getDB.mockReturnValue(supabase);

      const res = await request(app).post('/api/game/save-score').send(body);
      expect(res.body.success).toBe(true);

      const calledIds = rpcMock.mock.calls.map(c => c[1].p_achievement_id);
      expectedIds.forEach(id => expect(calledIds).toContain(id));
    });
  });
});
