const express = require('express');
const { getDB } = require('../db/database');

const router = express.Router();

const CRATE_TYPES = {
  mystery: {
    cost: 10,
    pool: [
      ...Array(50).fill('common'),
      ...Array(30).fill('rare'),
      ...Array(15).fill('epic'),
      ...Array(5).fill('legendary')
    ]
  },
  galactic: {
    cost: 50,
    pool: [
      ...Array(20).fill('common'),
      ...Array(40).fill('rare'),
      ...Array(30).fill('epic'),
      ...Array(10).fill('legendary')
    ]
  },
  void: {
    cost: 150,
    pool: [
      ...Array(10).fill('rare'),
      ...Array(50).fill('epic'),
      ...Array(40).fill('legendary')
    ]
  }
};

const ABILITIES_BY_RARITY = {
  common: ['shield', 'speed_boost', 'triple_shot', 'frag_bomb', 'rapid_fire', 'heal', 'spread_shot', 'homing'],
  rare: ['laser', 'magnetic_field', 'clone', 'time_slow', 'piercing', 'ricochet', 'overcharge', 'drone'],
  epic: ['black_hole', 'emp', 'rain_of_fire', 'chain_lightning', 'vortex', 'gravity_well', 'turret', 'freeze'],
  legendary: ['god_mode', 'nuke', 'time_warp', 'phoenix', 'singularity', 'storm']
};

const WHEEL_COOLDOWN_MS = 12 * 60 * 60 * 1000;
const WHEEL_REWARDS = [
  { id: 'coins', kind: 'coins', amount: 750, weight: 28, title: 'COINS', description: '🪙 +750 COINS' },
  { id: 'gems', kind: 'gems', amount: 25, weight: 22, title: 'GEMS', description: '💎 +25 GEMS' },
  { id: 'ability_common', kind: 'ability', rarity: 'common', weight: 16, title: 'COMMON ABILITY', description: 'Unlock or upgrade a COMMON ability' },
  { id: 'ability_rare', kind: 'ability', rarity: 'rare', weight: 12, title: 'RARE ABILITY', description: 'Unlock or upgrade a RARE ability' },
  { id: 'ability_epic', kind: 'ability', rarity: 'epic', weight: 8, title: 'EPIC ABILITY', description: 'Unlock or upgrade an EPIC ability' },
  { id: 'ability_legendary', kind: 'ability', rarity: 'legendary', weight: 4, title: 'LEGENDARY ABILITY', description: 'Unlock or upgrade a LEGENDARY ability' },
  { id: 'crate_mystery', kind: 'crate', crateType: 'mystery', weight: 7, title: 'MYSTERY CRATE', description: '📦 Free 10-gem crate' },
  { id: 'crate_void', kind: 'crate', crateType: 'void', weight: 3, title: 'VOID CRATE', description: '🕳️ Free 150-gem crate' }
];
const MAXED_ABILITY_COMPENSATION = { common: 1000, rare: 2500, epic: 6000, legendary: 15000 };

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function getWheelAvailability(lastSpinAt) {
  if (!lastSpinAt) {
    return { canSpin: true, nextSpinAt: null, remainingMs: 0 };
  }

  const nextSpinAt = new Date(new Date(lastSpinAt).getTime() + WHEEL_COOLDOWN_MS);
  const remainingMs = nextSpinAt.getTime() - Date.now();

  return {
    canSpin: remainingMs <= 0,
    nextSpinAt: nextSpinAt.toISOString(),
    remainingMs: Math.max(0, remainingMs)
  };
}

function pickWheelReward() {
  const totalWeight = WHEEL_REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const reward of WHEEL_REWARDS) {
    roll -= reward.weight;
    if (roll <= 0) return reward;
  }

  return WHEEL_REWARDS[0];
}

async function grantAbilityReward(supabase, userId, rarity) {
  const abilityId = pickRandom(ABILITIES_BY_RARITY[rarity] || ABILITIES_BY_RARITY.common);
  const { data: existing, error: existingErr } = await supabase
    .from('user_abilities')
    .select('level')
    .eq('user_id', userId)
    .eq('ability_id', abilityId)
    .maybeSingle();

  if (existingErr) throw new Error(existingErr.message);

  if (!existing) {
    const { error: insertErr } = await supabase.from('user_abilities').insert({ user_id: userId, ability_id: abilityId, level: 1 });
    if (insertErr) throw new Error(insertErr.message);
    return {
      abilityId,
      rarity,
      level: 1,
      alreadyOwned: false,
      maxedOut: false,
      title: `${rarity.toUpperCase()} ABILITY`,
      description: `Unlocked ${abilityId.replace(/_/g, ' ').toUpperCase()} (LV 1)`
    };
  }

  if (existing.level < 10) {
    const { error: updateErr } = await supabase
      .from('user_abilities')
      .update({ level: existing.level + 1 })
      .eq('user_id', userId)
      .eq('ability_id', abilityId);
    if (updateErr) throw new Error(updateErr.message);

    return {
      abilityId,
      rarity,
      level: existing.level + 1,
      alreadyOwned: true,
      maxedOut: false,
      title: `${rarity.toUpperCase()} ABILITY`,
      description: `${abilityId.replace(/_/g, ' ').toUpperCase()} upgraded to LV ${existing.level + 1}`
    };
  }

  const compensation = MAXED_ABILITY_COMPENSATION[rarity] || 1000;
  return {
    abilityId,
    rarity,
    level: existing.level,
    alreadyOwned: true,
    maxedOut: true,
    coinsCompensation: compensation,
    title: `${rarity.toUpperCase()} ABILITY`,
    description: `${abilityId.replace(/_/g, ' ').toUpperCase()} is MAX — converted into 🪙 ${compensation}`
  };
}

async function fetchUserProfileData(supabase, userId) {
  const [userResult, abilitiesResult, achievementsResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, nickname, coins, gems, games_played, max_score, max_wave, created_at, last_wheel_spin_at, free_mystery_crates, free_void_crates')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_abilities')
      .select('ability_id, level')
      .eq('user_id', userId),
    supabase
      .from('achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId)
  ]);

  if (userResult.error) throw new Error(userResult.error.message);
  if (!userResult.data) return null;

  return {
    ...userResult.data,
    free_mystery_crates: userResult.data.free_mystery_crates || 0,
    free_void_crates: userResult.data.free_void_crates || 0,
    wheel_available: getWheelAvailability(userResult.data.last_wheel_spin_at),
    abilities: abilitiesResult.data || [],
    achievements: achievementsResult.data || []
  };
}

router.post('/save-score', async (req, res) => {
  try {
    const { score, wave, enemiesKilled, gemsCollected = 0 } = req.body;
    const supabase = getDB();
    const userId = req.user.userId;

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('nickname, max_score, max_wave, games_played, coins, gems')
      .eq('id', userId)
      .single();
    if (userErr) throw new Error(userErr.message);

    const { error: scoreErr } = await supabase
      .from('scores')
      .insert({ user_id: userId, nickname: user.nickname, score, wave, enemies_killed: enemiesKilled || 0 });
    if (scoreErr) throw new Error(scoreErr.message);

    const newMaxScore = Math.max(user.max_score, score);
    const newMaxWave = Math.max(user.max_wave, wave);
    const coinsEarned = Math.floor(score / 100);

    let gemsEarned = Math.max(0, Math.floor(gemsCollected));
    gemsEarned += Math.floor(wave / 5);
    const milestoneWaves = [3, 5, 10, 20];
    for (const mw of milestoneWaves) {
      if (wave >= mw && user.max_wave < mw) {
        gemsEarned += 5;
      }
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({
        max_score: newMaxScore,
        max_wave: newMaxWave,
        games_played: user.games_played + 1,
        coins: user.coins + coinsEarned,
        gems: user.gems + gemsEarned
      })
      .eq('id', userId);
    if (updateErr) throw new Error(updateErr.message);

    await checkAchievements(supabase, userId, { score, wave, enemiesKilled: enemiesKilled || 0 });

    const { error: trimErr } = await supabase.rpc('trim_user_scores', { p_user_id: userId, p_keep: 10 });
    if (trimErr) console.warn('trim_user_scores failed (non-fatal):', trimErr.message);

    res.json({ success: true, data: { coinsEarned, gemsEarned, newMaxScore, newMaxWave } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/claim-tutorial-reward', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;

    const { data: existing } = await supabase
      .from('achievements')
      .select('achievement_id')
      .eq('user_id', userId)
      .eq('achievement_id', 'tutorial_done')
      .maybeSingle();

    if (existing) return res.json({ success: false, error: 'Tutorial reward already claimed' });

    const { data: user } = await supabase
      .from('users')
      .select('coins, gems')
      .eq('id', userId)
      .single();

    await supabase
      .from('users')
      .update({ coins: user.coins + 1000, gems: user.gems + 10 })
      .eq('id', userId);

    await supabase
      .from('achievements')
      .insert({ user_id: userId, achievement_id: 'tutorial_done' });

    res.json({ success: true, data: { coinsEarned: 1000, gemsEarned: 10 } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/profile', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;
    const profile = await fetchUserProfileData(supabase, userId);

    if (!profile) return res.json({ success: false, error: 'User not found' });

    res.json({ success: true, data: profile });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/upgrade-ability', async (req, res) => {
  try {
    const { abilityId } = req.body;
    const supabase = getDB();
    const userId = req.user.userId;

    const { data: existing } = await supabase
      .from('user_abilities')
      .select('level')
      .eq('user_id', userId)
      .eq('ability_id', abilityId)
      .maybeSingle();

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

    const { data: user } = await supabase
      .from('users')
      .select('coins')
      .eq('id', userId)
      .single();

    if (user.coins < cost) return res.json({ success: false, error: 'Not enough coins' });

    const { error: deductResult } = await supabase
      .from('users')
      .update({ coins: user.coins - cost })
      .eq('id', userId);
    if (deductResult) throw new Error(deductResult.message);

    const { error: upgradeResult } = await supabase
      .from('user_abilities')
      .update({ level: currentLevel + 1 })
      .eq('user_id', userId)
      .eq('ability_id', abilityId);
    if (upgradeResult) throw new Error(upgradeResult.message);

    res.json({ success: true, data: { newLevel: currentLevel + 1, coinsSpent: cost } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/open-crate', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;

    const crateType = req.body.crateType || 'mystery';
    const crate = CRATE_TYPES[crateType];
    if (!crate) return res.json({ success: false, error: 'Invalid crate type' });

    const { data: user } = await supabase
      .from('users')
      .select('coins, gems, free_mystery_crates, free_void_crates')
      .eq('id', userId)
      .single();

    const freeCrateColumn = crateType === 'mystery' ? 'free_mystery_crates' : crateType === 'void' ? 'free_void_crates' : null;
    const freeCratesAvailable = freeCrateColumn ? Number(user[freeCrateColumn] || 0) : 0;
    const usingFreeCrate = freeCratesAvailable > 0;

    if (!usingFreeCrate && user.gems < crate.cost) {
      return res.json({ success: false, error: `Not enough gems (need ${crate.cost})` });
    }

    if (usingFreeCrate) {
      await supabase
        .from('users')
        .update({ [freeCrateColumn]: freeCratesAvailable - 1 })
        .eq('id', userId);
    } else {
      await supabase.from('users').update({ gems: user.gems - crate.cost }).eq('id', userId);
    }

    const rarity = crate.pool[Math.floor(Math.random() * crate.pool.length)];
    const pool = ABILITIES_BY_RARITY[rarity];
    const abilityId = pool[Math.floor(Math.random() * pool.length)];

    const { data: existing } = await supabase
      .from('user_abilities')
      .select('level')
      .eq('user_id', userId)
      .eq('ability_id', abilityId)
      .maybeSingle();

    let newLevel = 1;
    let coinsCompensation = 0;
    if (existing) {
      if (existing.level < 10) {
        await supabase
          .from('user_abilities')
          .update({ level: existing.level + 1 })
          .eq('user_id', userId)
          .eq('ability_id', abilityId);
        newLevel = existing.level + 1;
      } else if (usingFreeCrate) {
        coinsCompensation = MAXED_ABILITY_COMPENSATION[rarity] || 1000;
        await supabase.from('users').update({ coins: (user.coins || 0) + coinsCompensation }).eq('id', userId);
        newLevel = existing.level;
      } else {
        await supabase.from('users').update({ gems: user.gems - crate.cost + Math.floor(crate.cost / 2) }).eq('id', userId);
        newLevel = existing.level;
      }
    } else {
      await supabase.from('user_abilities').insert({ user_id: userId, ability_id: abilityId, level: 1 });
    }

    res.json({ success: true, data: { abilityId, rarity, level: newLevel, alreadyOwned: !!existing, usedFreeCrate: usingFreeCrate, coinsCompensation } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/spin-wheel', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('coins, gems, last_wheel_spin_at, free_mystery_crates, free_void_crates')
      .eq('id', userId)
      .single();
    if (userErr) throw new Error(userErr.message);

    const availability = getWheelAvailability(user.last_wheel_spin_at);
    if (!availability.canSpin) {
      return res.json({
        success: false,
        error: 'Wheel not ready yet',
        data: availability
      });
    }

    const reward = pickWheelReward();
    const userUpdate = { last_wheel_spin_at: new Date().toISOString() };
    let rewardData = {
      id: reward.id,
      kind: reward.kind,
      title: reward.title,
      description: reward.description
    };

    if (reward.kind === 'coins') {
      userUpdate.coins = (user.coins || 0) + reward.amount;
      rewardData.amount = reward.amount;
    } else if (reward.kind === 'gems') {
      userUpdate.gems = (user.gems || 0) + reward.amount;
      rewardData.amount = reward.amount;
    } else if (reward.kind === 'crate') {
      const crateColumn = reward.crateType === 'mystery' ? 'free_mystery_crates' : 'free_void_crates';
      userUpdate[crateColumn] = Number(user[crateColumn] || 0) + 1;
      rewardData.crateType = reward.crateType;
    } else if (reward.kind === 'ability') {
      rewardData = { ...rewardData, ...(await grantAbilityReward(supabase, userId, reward.rarity)) };
      if (rewardData.coinsCompensation) {
        userUpdate.coins = (user.coins || 0) + rewardData.coinsCompensation;
      }
    }

    const { error: updateErr } = await supabase.from('users').update(userUpdate).eq('id', userId);
    if (updateErr) throw new Error(updateErr.message);

    const nextSpinAt = new Date(new Date(userUpdate.last_wheel_spin_at).getTime() + WHEEL_COOLDOWN_MS).toISOString();

    res.json({
      success: true,
      data: {
        segmentId: reward.id,
        reward: rewardData,
        nextSpinAt
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.get('/achievements', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;
    const { data: achievements, error } = await supabase
      .from('achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    res.json({ success: true, data: achievements });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

async function checkAchievements(supabase, userId, { score, wave, enemiesKilled }) {
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

  await Promise.all(
    toUnlock.map(achId =>
      supabase.rpc('unlock_achievement', { p_user_id: userId, p_achievement_id: achId })
    )
  );
}

module.exports = router;
