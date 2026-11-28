'use strict';

jest.mock('../../db/database', () => ({
  getDB: jest.fn(),
  initDB: jest.fn().mockResolvedValue(undefined)
}));

process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const express = require('express');
const { getDB } = require('../../db/database');
const gameRouter = require('../../routes/game');
const { createLocalClient } = require('../../db/localDb');

let db;
let userId;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { userId, nickname: 'Ace' }; next(); });
  app.use('/api/game', gameRouter);
  return app;
}

beforeEach(async () => {
  db = createLocalClient(null); // in-memory, never touches disk
  getDB.mockReturnValue(db);
  const { data } = await db.from('users').insert({ nickname: 'Ace', password_hash: 'x' }).select('id').single();
  userId = data.id;
});

const run = extra => request(buildApp()).post('/api/game/save-score')
  .send({ score: 50000, wave: 12, enemiesKilled: 200, gemsCollected: 3, ...extra });

test('unlocks the run-detail achievements and reports only the new ones', async () => {
  const res = await run({ maxChain: 160, perfectWaves: 6, grazes: 120, medals: 60, weaponMax: true });
  expect(res.body.success).toBe(true);
  expect(res.body.data.newAchievements).toEqual(expect.arrayContaining(
    ['chain_50', 'chain_150', 'perfect_5', 'graze_100', 'medals_50', 'weapon_max', 'wave_10', 'kills_100']
  ));

  const again = await run({ maxChain: 160 });
  expect(again.body.data.newAchievements).toEqual([]);
});

test('drops implausible detail stats instead of rejecting the run', async () => {
  // a chain longer than 3× the kills (+10/boss) cannot happen
  const res = await run({ maxChain: 99999, perfectWaves: 500, grazes: 1e9, medals: 1e6 });
  expect(res.body.success).toBe(true);
  for (const id of ['chain_50', 'chain_150', 'perfect_5', 'graze_100', 'medals_50']) {
    expect(res.body.data.newAchievements).not.toContain(id);
  }
});

test('weapon_max needs a real run behind it', async () => {
  const res = await request(buildApp()).post('/api/game/save-score')
    .send({ score: 500, wave: 1, enemiesKilled: 3, weaponMax: true });
  expect(res.body.data.newAchievements).not.toContain('weapon_max');
});
