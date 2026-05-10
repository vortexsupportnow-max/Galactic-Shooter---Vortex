const express = require('express');
const { getDB } = require('../db/database');

const router = express.Router();

const RARITY_POOL = [
  ...Array(50).fill('common'),
  ...Array(30).fill('rare'),
  ...Array(15).fill('epic'),
  ...Array(5).fill('legendary')
];

const ABILITIES_BY_RARITY = {
  common: ['shield', 'speed_boost', 'triple_shot', 'frag_bomb', 'rapid_fire', 'heal', 'spread_shot', 'homing'],
  rare: ['laser', 'magnetic_field', 'clone', 'time_slow', 'piercing', 'ricochet', 'overcharge', 'drone'],
  epic: ['black_hole', 'emp', 'rain_of_fire', 'chain_lightning', 'vortex', 'gravity_well', 'turret', 'freeze'],
  legendary: ['god_mode', 'nuke', 'time_warp', 'phoenix', 'singularity', 'storm']
};

router.post('/save-score', (req, res) => {
  try {
    const { score, wave, enemiesKilled } = req.body;
    const db = getDB();
    const userId = req.user.userId;

    db.prepare(
      'INSERT INTO scores (user_id, nickname, score, wave, enemies_killed) VALUES (?, (SELECT nickname FROM users WHERE id=?), ?, ?, ?)'
    ).run(userId, userId, score, wave, enemiesKilled || 0);

    const user = db.prepare('SELECT max_score, max_wave, games_played FROM users WHERE id=?').get(userId);
    const newMaxScore = Math.max(user.max_score, score);
    const newMaxWave = Math.max(user.max_wave, wave);
    const coinsEarned = Math.floor(score / 100);

    let gemsEarned = 0;
    const milestoneWaves = [20, 50, 100];
    for (const mw of milestoneWaves) {
      if (wave >= mw && user.max_wave < mw) {
        gemsEarned += 5;
      }
    }

    db.prepare(
      'UPDATE users SET max_score=?, max_wave=?, games_played=games_played+1, coins=coins+?, gems=gems+? WHERE id=?'
    ).run(newMaxScore, newMaxWave, coinsEarned, gemsEarned, userId);

    // Check achievements
    checkAchievements(db, userId, { score, wave, enemiesKilled: enemiesKilled || 0 });

    res.json({ success: true, data: { coinsEarned, gemsEarned, newMaxScore, newMaxWave } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/profile', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.userId;
    const user = db.prepare(
      'SELECT id, nickname, coins, gems, games_played, max_score, max_wave, created_at FROM users WHERE id=?'
    ).get(userId);
    if (!user) return res.json({ success: false, error: 'User not found' });

    const abilities = db.prepare(
      'SELECT ability_id, level FROM user_abilities WHERE user_id=?'
    ).all(userId);

    const achievements = db.prepare(
      'SELECT achievement_id, unlocked_at FROM achievements WHERE user_id=?'
    ).all(userId);

    res.json({ success: true, data: { ...user, abilities, achievements } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/upgrade-ability', (req, res) => {
  try {
    const { abilityId } = req.body;
    const db = getDB();
    const userId = req.user.userId;

    const existing = db.prepare(
      'SELECT level FROM user_abilities WHERE user_id=? AND ability_id=?'
    ).get(userId, abilityId);

    if (!existing) return res.json({ success: false, error: 'Ability not unlocked' });

    const currentLevel = existing.level;
    const maxLevel = 10;
    if (currentLevel >= maxLevel) return res.json({ success: false, error: 'Already max level' });

    const rarityMultipliers = { common: 1, rare: 2, epic: 4, legendary: 8 };
    let rarity = 'common';
    for (const [r, ids] of Object.entries(ABILITIES_BY_RARITY)) {
      if (ids.includes(abilityId)) { rarity = r; break; }
    }
    const cost = (currentLevel + 1) * 500 * rarityMultipliers[rarity];

    const user = db.prepare('SELECT coins FROM users WHERE id=?').get(userId);
    if (user.coins < cost) return res.json({ success: false, error: 'Not enough coins' });

    db.prepare('UPDATE users SET coins=coins-? WHERE id=?').run(cost, userId);
    db.prepare('UPDATE user_abilities SET level=level+1 WHERE user_id=? AND ability_id=?').run(userId, abilityId);

    const newLevel = currentLevel + 1;
    res.json({ success: true, data: { newLevel, coinsSpent: cost } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/open-crate', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.userId;

    const user = db.prepare('SELECT gems FROM users WHERE id=?').get(userId);
    if (user.gems < 10) return res.json({ success: false, error: 'Not enough gems (need 10)' });

    db.prepare('UPDATE users SET gems=gems-10 WHERE id=?').run(userId);

    const rarity = RARITY_POOL[Math.floor(Math.random() * RARITY_POOL.length)];
    const pool = ABILITIES_BY_RARITY[rarity];
    const abilityId = pool[Math.floor(Math.random() * pool.length)];

    const existing = db.prepare(
      'SELECT level FROM user_abilities WHERE user_id=? AND ability_id=?'
    ).get(userId, abilityId);

    let newLevel = 1;
    if (existing) {
      if (existing.level < 10) {
        db.prepare('UPDATE user_abilities SET level=level+1 WHERE user_id=? AND ability_id=?').run(userId, abilityId);
        newLevel = existing.level + 1;
      } else {
        // Already max level - refund 5 gems
        db.prepare('UPDATE users SET gems=gems+5 WHERE id=?').run(userId);
        newLevel = existing.level;
      }
    } else {
      db.prepare('INSERT INTO user_abilities (user_id, ability_id, level) VALUES (?,?,1)').run(userId, abilityId);
    }

    res.json({ success: true, data: { abilityId, rarity, level: newLevel, alreadyOwned: !!existing } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/achievements', (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.userId;
    const achievements = db.prepare(
      'SELECT achievement_id, unlocked_at FROM achievements WHERE user_id=?'
    ).all(userId);
    res.json({ success: true, data: achievements });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

function checkAchievements(db, userId, { score, wave, enemiesKilled }) {
  const toUnlock = [];
  if (score >= 1000) toUnlock.push('score_1k');
  if (score >= 10000) toUnlock.push('score_10k');
  if (score >= 100000) toUnlock.push('score_100k');
  if (wave >= 5) toUnlock.push('wave_5');
  if (wave >= 10) toUnlock.push('wave_10');
  if (wave >= 25) toUnlock.push('wave_25');
  if (wave >= 50) toUnlock.push('wave_50');
  if (enemiesKilled >= 100) toUnlock.push('kills_100');
  if (enemiesKilled >= 500) toUnlock.push('kills_500');

  for (const achId of toUnlock) {
    try {
      db.prepare(
        'INSERT OR IGNORE INTO achievements (user_id, achievement_id) VALUES (?,?)'
      ).run(userId, achId);
    } catch (e) { /* ignore duplicate */ }
  }
}

module.exports = router;
