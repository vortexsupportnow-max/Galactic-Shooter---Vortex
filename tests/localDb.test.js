'use strict';
const { createLocalClient } = require('../db/localDb');

test('nicknames are unique case-insensitively', async () => {
  const db = createLocalClient(null);
  await db.from('users').insert({ nickname: 'Pilot', password_hash: 'x' });
  const { error } = await db.from('users').insert({ nickname: 'pilot', password_hash: 'y' });
  expect(error && error.code).toBe('23505');
});

test('insert applies schema defaults; single/maybeSingle behave like supabase-js', async () => {
  const db = createLocalClient(null);
  const { data } = await db.from('users').insert({ nickname: 'A1', password_hash: 'x' }).select('id, coins, equipped_skin').single();
  expect(data).toEqual({ id: 1, coins: 0, equipped_skin: 'default' });
  const none = await db.from('users').select('id').eq('nickname', 'nope').maybeSingle();
  expect(none).toEqual({ data: null, error: null });
  const bad = await db.from('users').select('id').eq('nickname', 'nope').single();
  expect(bad.error).toBeTruthy();
});

test('deleting a user cascades to their rows', async () => {
  const db = createLocalClient(null);
  const { data: u } = await db.from('users').insert({ nickname: 'Gone', password_hash: 'x' }).select('id').single();
  await db.from('user_skins').insert({ user_id: u.id, skin_id: 'aurora' });
  await db.from('scores').insert({ user_id: u.id, nickname: 'Gone', score: 10, wave: 1 });
  const { data: deleted } = await db.from('users').delete().eq('id', u.id).select('id');
  expect(deleted).toHaveLength(1);
  expect((await db.from('user_skins').select('*')).data).toEqual([]);
  expect((await db.from('scores').select('*')).data).toEqual([]);
});

test('leaderboard keeps the best score per player', async () => {
  const db = createLocalClient(null);
  for (const [user_id, score] of [[1, 100], [1, 900], [2, 500]]) {
    await db.from('scores').insert({ user_id, nickname: 'P' + user_id, score, wave: 1 });
  }
  const { data } = await db.rpc('get_score_leaderboard', { filter_date: null });
  expect(data.map(r => [r.user_id, r.score])).toEqual([[1, 900], [2, 500]]);
});
