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

// ── Skin system ───────────────────────────────────────────────────────────────

const SKINS = {
  aurora:            { id: 'aurora',            name: 'Aurora Drift',      rarity: 'common',    boost: { coins_mult: 1.10, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false } },
  solar_flare:       { id: 'solar_flare',        name: 'Solar Flare',       rarity: 'common',    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.05, extra_lives: 0, starting_shield: false } },
  ice_storm:         { id: 'ice_storm',          name: 'Ice Storm',         rarity: 'common',    boost: { coins_mult: 1.00, gems_mult: 1.05, score_mult: 1.00, extra_lives: 0, starting_shield: false } },
  toxic_drift:       { id: 'toxic_drift',        name: 'Toxic Drift',       rarity: 'common',    boost: { coins_mult: 1.05, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false } },
  phantom:           { id: 'phantom',            name: 'Phantom Eclipse',   rarity: 'rare',      boost: { coins_mult: 1.15, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false } },
  crimson_nova:      { id: 'crimson_nova',       name: 'Crimson Nova',      rarity: 'rare',      boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.10, extra_lives: 0, starting_shield: false } },
  nebula:            { id: 'nebula',             name: 'Nebula Ghost',      rarity: 'rare',      boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.00, extra_lives: 0, starting_shield: false } },
  thunder:           { id: 'thunder',            name: 'Thunder Strike',    rarity: 'rare',      boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.00, extra_lives: 1, starting_shield: false } },
  void_wraith:       { id: 'void_wraith',        name: 'Void Wraith',       rarity: 'epic',      boost: { coins_mult: 1.25, gems_mult: 1.10, score_mult: 1.00, extra_lives: 0, starting_shield: false } },
  celestial:         { id: 'celestial',          name: 'Celestial Dragon',  rarity: 'epic',      boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.20, extra_lives: 1, starting_shield: false } },
  quantum_rift:      { id: 'quantum_rift',       name: 'Quantum Rift',      rarity: 'epic',      boost: { coins_mult: 1.15, gems_mult: 1.15, score_mult: 1.00, extra_lives: 0, starting_shield: true  } },
  galactic_overlord: { id: 'galactic_overlord',  name: 'Galactic Overlord', rarity: 'legendary', boost: { coins_mult: 1.30, gems_mult: 1.30, score_mult: 1.25, extra_lives: 2, starting_shield: false } },
  // Japan Season (pass-exclusive)
  rising_sun:        { id: 'rising_sun',         name: 'Rising Sun',        rarity: 'epic',      season_exclusive: true, boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.20, extra_lives: 0, starting_shield: false } },
  torii_gate:        { id: 'torii_gate',         name: 'Torii Gate',        rarity: 'legendary', season_exclusive: true, boost: { coins_mult: 1.25, gems_mult: 1.25, score_mult: 1.00, extra_lives: 1, starting_shield: true  } }
};

const SKINS_BY_RARITY = {
  common:    ['aurora', 'solar_flare', 'ice_storm', 'toxic_drift'],
  rare:      ['phantom', 'crimson_nova', 'nebula', 'thunder'],
  epic:      ['void_wraith', 'celestial', 'quantum_rift'],
  legendary: ['galactic_overlord']
  // Note: rising_sun and torii_gate are excluded — pass-exclusive only
};

const SKIN_CRATE_TYPES = {
  stellar: {
    costCoins: 200, costGems: 5,
    pool: [...Array(50).fill('common'), ...Array(35).fill('rare'), ...Array(12).fill('epic'), ...Array(3).fill('legendary')]
  },
  nova: {
    costCoins: 1000, costGems: 20,
    pool: [...Array(15).fill('common'), ...Array(40).fill('rare'), ...Array(35).fill('epic'), ...Array(10).fill('legendary')]
  }
};

// ── Japan Season (pass-exclusive abilities) ───────────────────────────────────
// These IDs exist in the game but are NOT in the regular ABILITIES_BY_RARITY crate pools.
const SEASON_EXCLUSIVE_ABILITIES = ['bushido_blade', 'sakura_storm'];
const SEASON_EXCLUSIVE_SKINS     = ['rising_sun', 'torii_gate'];

// ── Season Pass ───────────────────────────────────────────────────────────────

const SEASON_ID   = 'japan_s1';
const SEASON_NAME = 'JAPAN SEASON';
const SEASON_END  = new Date('2026-06-30T23:59:59Z');

// Season start = May 12 2026 (week anchor for unlocking missions)
const SEASON_START = new Date('2026-05-12T00:00:00Z');

// difficulty → pulsar/coins/gems rewards
const MISSION_REWARDS = {
  easy:   { pulsar: 400,  coins: 500,   gems: 0  },
  medium: { pulsar: 700,  coins: 1500,  gems: 5  },
  hard:   { pulsar: 1200, coins: 3000,  gems: 15 },
  epic:   { pulsar: 1800, coins: 6000,  gems: 30 }
};

// 70 missions – 10 per week for 7 weeks. Each has: id, week, difficulty, title, desc, type, target
// pulsar/reward_coins/reward_gems are derived from MISSION_REWARDS at runtime.
const SEASON_MISSIONS_DEF = [
  // ── Week 1: Il Risveglio ─────────────────────────────────────────────────
  { id: 'w1_1',  week: 1, difficulty: 'easy',   title: 'Prima Partita',          desc: 'Gioca 1 partita',                      type: 'games_played',          target: 1    },
  { id: 'w1_2',  week: 1, difficulty: 'easy',   title: 'Sparatorie Iniziali',    desc: 'Abbatti 20 nemici',                    type: 'enemies_killed',        target: 20   },
  { id: 'w1_3',  week: 1, difficulty: 'easy',   title: 'Sopravvissuto',          desc: "Raggiungi l'onda 3",                   type: 'max_wave_single',       target: 3    },
  { id: 'w1_4',  week: 1, difficulty: 'easy',   title: 'Prime Monete',           desc: 'Guadagna 300 monete in una partita',   type: 'coins_earned_session',  target: 300  },
  { id: 'w1_5',  week: 1, difficulty: 'medium', title: 'Pilota Promettente',     desc: 'Gioca 5 partite',                      type: 'games_played',          target: 5    },
  { id: 'w1_6',  week: 1, difficulty: 'medium', title: 'Battesimo del Fuoco',    desc: 'Abbatti 80 nemici in totale',          type: 'enemies_killed',        target: 80   },
  { id: 'w1_7',  week: 1, difficulty: 'medium', title: 'Cacciatore',             desc: "Raggiungi l'onda 5",                   type: 'max_wave_single',       target: 5    },
  { id: 'w1_8',  week: 1, difficulty: 'hard',   title: 'Sfida dell\'Onda',       desc: "Raggiungi l'onda 8",                   type: 'max_wave_single',       target: 8    },
  { id: 'w1_9',  week: 1, difficulty: 'hard',   title: 'Cacciatore di Bottino',  desc: 'Guadagna 1,000 monete in una partita', type: 'coins_earned_session',  target: 1000 },
  { id: 'w1_10', week: 1, difficulty: 'epic',   title: 'Veterano della Settimana','desc': "Raggiungi l'onda 12",               type: 'max_wave_single',       target: 12   },

  // ── Week 2: Il Guerriero ─────────────────────────────────────────────────
  { id: 'w2_1',  week: 2, difficulty: 'easy',   title: 'Di Ritorno',             desc: 'Gioca 3 partite',                      type: 'games_played',          target: 3    },
  { id: 'w2_2',  week: 2, difficulty: 'easy',   title: 'Raffica Nemica',         desc: 'Abbatti 40 nemici',                    type: 'enemies_killed',        target: 40   },
  { id: 'w2_3',  week: 2, difficulty: 'easy',   title: 'Primo Uso',              desc: 'Usa 2 abilità in una partita',         type: 'abilities_used_single', target: 2    },
  { id: 'w2_4',  week: 2, difficulty: 'easy',   title: 'Raccoglitore',           desc: 'Raccogli 10 gemme in totale',          type: 'gems_collected',        target: 10   },
  { id: 'w2_5',  week: 2, difficulty: 'medium', title: 'Sterminio',              desc: 'Abbatti 180 nemici in totale',         type: 'enemies_killed',        target: 180  },
  { id: 'w2_6',  week: 2, difficulty: 'medium', title: 'Profondo Spazio',        desc: "Raggiungi l'onda 7",                   type: 'max_wave_single',       target: 7    },
  { id: 'w2_7',  week: 2, difficulty: 'medium', title: 'Cacciatore di Gemme',    desc: 'Raccogli 30 gemme in totale',          type: 'gems_collected',        target: 30   },
  { id: 'w2_8',  week: 2, difficulty: 'hard',   title: 'Decimazione',            desc: "Raggiungi l'onda 10",                  type: 'max_wave_single',       target: 10   },
  { id: 'w2_9',  week: 2, difficulty: 'hard',   title: 'Ninja dello Spazio',     desc: 'Usa 5 abilità in una partita',         type: 'abilities_used_single', target: 5    },
  { id: 'w2_10', week: 2, difficulty: 'epic',   title: 'Macchina da Guerra',     desc: 'Abbatti 400 nemici in totale',         type: 'enemies_killed',        target: 400  },

  // ── Week 3: Cacciatore di Stelle ─────────────────────────────────────────
  { id: 'w3_1',  week: 3, difficulty: 'easy',   title: 'Continuare a Volare',    desc: 'Gioca 5 partite',                      type: 'games_played',          target: 5    },
  { id: 'w3_2',  week: 3, difficulty: 'easy',   title: 'Pioggia di Fuoco',       desc: 'Abbatti 60 nemici',                    type: 'enemies_killed',        target: 60   },
  { id: 'w3_3',  week: 3, difficulty: 'easy',   title: 'Zona di Pericolo',       desc: "Raggiungi l'onda 5",                   type: 'max_wave_single',       target: 5    },
  { id: 'w3_4',  week: 3, difficulty: 'easy',   title: 'Bottino Galattico',      desc: 'Guadagna 500 monete in una partita',   type: 'coins_earned_session',  target: 500  },
  { id: 'w3_5',  week: 3, difficulty: 'medium', title: 'Grande Caccia',          desc: 'Abbatti 300 nemici in totale',         type: 'enemies_killed',        target: 300  },
  { id: 'w3_6',  week: 3, difficulty: 'medium', title: 'Conquistatore',          desc: "Raggiungi l'onda 10",                  type: 'max_wave_single',       target: 10   },
  { id: 'w3_7',  week: 3, difficulty: 'medium', title: 'Minatore Spaziale',      desc: 'Raccogli 60 gemme in totale',          type: 'gems_collected',        target: 60   },
  { id: 'w3_8',  week: 3, difficulty: 'hard',   title: 'Macellaio Cosmico',      desc: "Raggiungi l'onda 13",                  type: 'max_wave_single',       target: 13   },
  { id: 'w3_9',  week: 3, difficulty: 'hard',   title: 'Colpo Grosso',           desc: 'Guadagna 2,000 monete in una partita', type: 'coins_earned_session',  target: 2000 },
  { id: 'w3_10', week: 3, difficulty: 'epic',   title: 'Asso dello Spazio',      desc: 'Abbatti 700 nemici in totale',         type: 'enemies_killed',        target: 700  },

  // ── Week 4: Leggenda della Galassia ──────────────────────────────────────
  { id: 'w4_1',  week: 4, difficulty: 'easy',   title: 'Routine Galattica',      desc: 'Gioca 8 partite',                      type: 'games_played',          target: 8    },
  { id: 'w4_2',  week: 4, difficulty: 'easy',   title: 'Caccia Continua',        desc: 'Abbatti 80 nemici',                    type: 'enemies_killed',        target: 80   },
  { id: 'w4_3',  week: 4, difficulty: 'easy',   title: 'Tattico',                desc: 'Usa 3 abilità in una partita',         type: 'abilities_used_single', target: 3    },
  { id: 'w4_4',  week: 4, difficulty: 'easy',   title: 'Gemme Celesti',          desc: 'Raccogli 20 gemme',                    type: 'gems_collected',        target: 20   },
  { id: 'w4_5',  week: 4, difficulty: 'medium', title: 'Sterminatore',           desc: 'Abbatti 500 nemici in totale',         type: 'enemies_killed',        target: 500  },
  { id: 'w4_6',  week: 4, difficulty: 'medium', title: 'Profondo Abisso',        desc: "Raggiungi l'onda 12",                  type: 'max_wave_single',       target: 12   },
  { id: 'w4_7',  week: 4, difficulty: 'medium', title: 'Veterano',               desc: 'Gioca 15 partite in totale',           type: 'games_played',          target: 15   },
  { id: 'w4_8',  week: 4, difficulty: 'hard',   title: 'Signore delle Onde',     desc: "Raggiungi l'onda 15",                  type: 'max_wave_single',       target: 15   },
  { id: 'w4_9',  week: 4, difficulty: 'hard',   title: 'Tesoro Cosmico',         desc: 'Raccogli 100 gemme in totale',         type: 'gems_collected',        target: 100  },
  { id: 'w4_10', week: 4, difficulty: 'epic',   title: 'Mille Battaglie',        desc: 'Abbatti 1,000 nemici in totale',       type: 'enemies_killed',        target: 1000 },

  // ── Week 5: Sterminatore Cosmico ─────────────────────────────────────────
  { id: 'w5_1',  week: 5, difficulty: 'easy',   title: 'Ancora in Volo',         desc: 'Gioca 5 partite',                      type: 'games_played',          target: 5    },
  { id: 'w5_2',  week: 5, difficulty: 'easy',   title: 'Piombo Galattico',       desc: 'Abbatti 100 nemici',                   type: 'enemies_killed',        target: 100  },
  { id: 'w5_3',  week: 5, difficulty: 'easy',   title: 'Sopravvissuto Plus',     desc: "Raggiungi l'onda 6",                   type: 'max_wave_single',       target: 6    },
  { id: 'w5_4',  week: 5, difficulty: 'easy',   title: 'Ricco Spaziale',         desc: 'Guadagna 800 monete in una partita',   type: 'coins_earned_session',  target: 800  },
  { id: 'w5_5',  week: 5, difficulty: 'medium', title: 'Sinfonia di Fuoco',      desc: 'Abbatti 700 nemici in totale',         type: 'enemies_killed',        target: 700  },
  { id: 'w5_6',  week: 5, difficulty: 'medium', title: 'Cacciatore di Boss',     desc: "Raggiungi l'onda 14",                  type: 'max_wave_single',       target: 14   },
  { id: 'w5_7',  week: 5, difficulty: 'medium', title: 'Combo Letale',           desc: 'Usa 8 abilità in una partita',         type: 'abilities_used_single', target: 8    },
  { id: 'w5_8',  week: 5, difficulty: 'hard',   title: 'Predatore dell\'Onda',   desc: "Raggiungi l'onda 18",                  type: 'max_wave_single',       target: 18   },
  { id: 'w5_9',  week: 5, difficulty: 'hard',   title: 'Grande Fortuna',         desc: 'Guadagna 3,500 monete in una partita', type: 'coins_earned_session',  target: 3500 },
  { id: 'w5_10', week: 5, difficulty: 'epic',   title: 'Flagello Cosmico',       desc: 'Abbatti 1,500 nemici in totale',       type: 'enemies_killed',        target: 1500 },

  // ── Week 6: Maestro del Vortex ────────────────────────────────────────────
  { id: 'w6_1',  week: 6, difficulty: 'easy',   title: 'Routine da Maestro',     desc: 'Gioca 5 partite',                      type: 'games_played',          target: 5    },
  { id: 'w6_2',  week: 6, difficulty: 'easy',   title: 'Distruzione Metodica',   desc: 'Abbatti 100 nemici',                   type: 'enemies_killed',        target: 100  },
  { id: 'w6_3',  week: 6, difficulty: 'easy',   title: 'Arsenal Galattico',      desc: 'Usa 5 abilità in una partita',         type: 'abilities_used_single', target: 5    },
  { id: 'w6_4',  week: 6, difficulty: 'easy',   title: 'Gemme del Vortex',       desc: 'Raccogli 30 gemme',                    type: 'gems_collected',        target: 30   },
  { id: 'w6_5',  week: 6, difficulty: 'medium', title: 'Devastazione',           desc: 'Abbatti 1,000 nemici in totale',       type: 'enemies_killed',        target: 1000 },
  { id: 'w6_6',  week: 6, difficulty: 'medium', title: 'Guardiano del Vortex',   desc: "Raggiungi l'onda 16",                  type: 'max_wave_single',       target: 16   },
  { id: 'w6_7',  week: 6, difficulty: 'medium', title: 'Veterano Esperto',       desc: 'Gioca 25 partite in totale',           type: 'games_played',          target: 25   },
  { id: 'w6_8',  week: 6, difficulty: 'hard',   title: 'Onda Perfetta',          desc: "Raggiungi l'onda 20",                  type: 'max_wave_single',       target: 20   },
  { id: 'w6_9',  week: 6, difficulty: 'hard',   title: 'Vault Cosmico',          desc: 'Raccogli 200 gemme in totale',         type: 'gems_collected',        target: 200  },
  { id: 'w6_10', week: 6, difficulty: 'epic',   title: 'Ira del Vortex',         desc: 'Abbatti 2,500 nemici in totale',       type: 'enemies_killed',        target: 2500 },

  // ── Week 7: Campione Galattico ────────────────────────────────────────────
  { id: 'w7_1',  week: 7, difficulty: 'easy',   title: 'Ultimo Capitolo',        desc: 'Gioca 5 partite',                      type: 'games_played',          target: 5    },
  { id: 'w7_2',  week: 7, difficulty: 'easy',   title: 'Falce Galattica',        desc: 'Abbatti 150 nemici',                   type: 'enemies_killed',        target: 150  },
  { id: 'w7_3',  week: 7, difficulty: 'easy',   title: 'Onda Finale',            desc: "Raggiungi l'onda 8",                   type: 'max_wave_single',       target: 8    },
  { id: 'w7_4',  week: 7, difficulty: 'easy',   title: 'Tattico Supremo',        desc: 'Usa 5 abilità in una partita',         type: 'abilities_used_single', target: 5    },
  { id: 'w7_5',  week: 7, difficulty: 'medium', title: 'Genocidio Stellare',     desc: 'Abbatti 1,500 nemici in totale',       type: 'enemies_killed',        target: 1500 },
  { id: 'w7_6',  week: 7, difficulty: 'medium', title: 'Ascesa Finale',          desc: "Raggiungi l'onda 18",                  type: 'max_wave_single',       target: 18   },
  { id: 'w7_7',  week: 7, difficulty: 'medium', title: 'Grande Veterano',        desc: 'Gioca 35 partite in totale',           type: 'games_played',          target: 35   },
  { id: 'w7_8',  week: 7, difficulty: 'hard',   title: 'Vetta dell\'Universo',   desc: "Raggiungi l'onda 25",                  type: 'max_wave_single',       target: 25   },
  { id: 'w7_9',  week: 7, difficulty: 'hard',   title: 'Tesoro Leggendario',     desc: 'Raccogli 350 gemme in totale',         type: 'gems_collected',        target: 350  },
  { id: 'w7_10', week: 7, difficulty: 'epic',   title: 'Il Grande Campione',     desc: 'Abbatti 4,000 nemici in totale',       type: 'enemies_killed',        target: 4000 }
];

// Attach reward fields from MISSION_REWARDS based on difficulty
const SEASON_MISSIONS = SEASON_MISSIONS_DEF.map(m => ({
  ...m,
  pulsar:        MISSION_REWARDS[m.difficulty].pulsar,
  reward_coins:  MISSION_REWARDS[m.difficulty].coins,
  reward_gems:   MISSION_REWARDS[m.difficulty].gems
}));

// Pass rewards per tier (each tier unlocked at pulsar threshold)
const PASS_TIERS = [
  { tier: 1,  pulsar: 1000,  reward: { type: 'coins',   amount: 1000 } },
  { tier: 2,  pulsar: 2000,  reward: { type: 'gems',    amount: 20 } },
  { tier: 3,  pulsar: 3500,  reward: { type: 'coins',   amount: 2500 } },
  { tier: 4,  pulsar: 5000,  reward: { type: 'gems',    amount: 40 } },
  { tier: 5,  pulsar: 6500,  reward: { type: 'coins',   amount: 4000 } },
  { tier: 6,  pulsar: 8000,  reward: { type: 'ability', abilityId: 'bushido_blade' } },
  { tier: 7,  pulsar: 9500,  reward: { type: 'gems',    amount: 60 } },
  { tier: 8,  pulsar: 11000, reward: { type: 'coins',   amount: 6000 } },
  { tier: 9,  pulsar: 13000, reward: { type: 'skin',    skinId: 'rising_sun' } },
  { tier: 10, pulsar: 15000, reward: { type: 'gems',    amount: 80 } },
  { tier: 11, pulsar: 17000, reward: { type: 'coins',   amount: 8000 } },
  { tier: 12, pulsar: 19000, reward: { type: 'gems',    amount: 100 } },
  { tier: 13, pulsar: 21000, reward: { type: 'coins',   amount: 10000 } },
  { tier: 14, pulsar: 23000, reward: { type: 'ability', abilityId: 'sakura_storm' } },
  { tier: 15, pulsar: 25000, reward: { type: 'gems',    amount: 120 } },
  { tier: 16, pulsar: 27000, reward: { type: 'coins',   amount: 12000 } },
  { tier: 17, pulsar: 29000, reward: { type: 'gems',    amount: 150 } },
  { tier: 18, pulsar: 31000, reward: { type: 'coins',   amount: 15000 } },
  { tier: 19, pulsar: 33000, reward: { type: 'gems',    amount: 180 } },
  { tier: 20, pulsar: 35000, reward: { type: 'coins',   amount: 18000 } },
  { tier: 21, pulsar: 37000, reward: { type: 'gems',    amount: 200 } },
  { tier: 22, pulsar: 39000, reward: { type: 'coins',   amount: 22000 } },
  { tier: 23, pulsar: 41000, reward: { type: 'gems',    amount: 250 } },
  { tier: 24, pulsar: 43000, reward: { type: 'coins',   amount: 28000 } },
  { tier: 25, pulsar: 44500, reward: { type: 'gems',    amount: 300 } },
  { tier: 26, pulsar: 46000, reward: { type: 'coins',   amount: 35000 } },
  { tier: 27, pulsar: 47500, reward: { type: 'gems',    amount: 350 } },
  { tier: 28, pulsar: 48500, reward: { type: 'coins',   amount: 45000 } },
  { tier: 29, pulsar: 49500, reward: { type: 'gems',    amount: 400 } },
  { tier: 30, pulsar: 50000, reward: { type: 'skin',    skinId: 'torii_gate' } }
];

function getCurrentSeasonWeek() {
  const now = Date.now();
  const ms = now - SEASON_START.getTime();
  if (ms < 0) return 0;
  return Math.min(Math.floor(ms / (7 * 24 * 60 * 60 * 1000)) + 1, 7);
}

function isSeasonActive() {
  return Date.now() < SEASON_END.getTime();
}

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
  const [userResult, abilitiesResult, achievementsResult, skinsResult, passResult, missionsResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, nickname, coins, gems, games_played, max_score, max_wave, created_at, last_wheel_spin_at, free_mystery_crates, free_void_crates, equipped_skin, free_skin_crates')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('user_abilities')
      .select('ability_id, level')
      .eq('user_id', userId),
    supabase
      .from('achievements')
      .select('achievement_id, unlocked_at')
      .eq('user_id', userId),
    supabase
      .from('user_skins')
      .select('skin_id')
      .eq('user_id', userId),
    supabase
      .from('user_season_pass')
      .select('pulsar, claimed_tiers')
      .eq('user_id', userId)
      .eq('season_id', SEASON_ID)
      .maybeSingle(),
    supabase
      .from('user_mission_progress')
      .select('mission_id, progress, completed, reward_claimed')
      .eq('user_id', userId)
  ]);

  if (userResult.error) throw new Error(userResult.error.message);
  if (!userResult.data) return null;

  return {
    ...userResult.data,
    free_mystery_crates: userResult.data.free_mystery_crates || 0,
    free_void_crates: userResult.data.free_void_crates || 0,
    equipped_skin: userResult.data.equipped_skin || 'default',
    free_skin_crates: userResult.data.free_skin_crates || 0,
    wheel_available: getWheelAvailability(userResult.data.last_wheel_spin_at),
    abilities: abilitiesResult.data || [],
    achievements: achievementsResult.data || [],
    skins: (skinsResult.data || []).map(s => s.skin_id),
    season_pass: {
      season_id: SEASON_ID,
      season_name: SEASON_NAME,
      season_end: SEASON_END.toISOString(),
      current_week: getCurrentSeasonWeek(),
      active: isSeasonActive(),
      pulsar: passResult.data?.pulsar || 0,
      claimed_tiers: passResult.data?.claimed_tiers || [],
      missions: (missionsResult.data || [])
    }
  };
}

router.post('/save-score', async (req, res) => {
  try {
    const { score, wave, enemiesKilled, gemsCollected = 0, abilitiesUsed = 0 } = req.body;
    const supabase = getDB();
    const userId = req.user.userId;

    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('nickname, max_score, max_wave, games_played, coins, gems, equipped_skin')
      .eq('id', userId)
      .single();
    if (userErr) throw new Error(userErr.message);

    const { error: scoreErr } = await supabase
      .from('scores')
      .insert({ user_id: userId, nickname: user.nickname, score, wave, enemies_killed: enemiesKilled || 0 });
    if (scoreErr) throw new Error(scoreErr.message);

    const newMaxScore = Math.max(user.max_score, score);
    const newMaxWave = Math.max(user.max_wave, wave);

    // Apply equipped skin boost multipliers
    const skin = SKINS[user.equipped_skin] || null;
    const coinsMult = skin ? skin.boost.coins_mult : 1;
    const gemsMult  = skin ? skin.boost.gems_mult  : 1;

    const coinsEarned = Math.floor(score / 100 * coinsMult);

    let gemsEarned = Math.max(0, Math.floor(gemsCollected));
    gemsEarned += Math.floor(wave / 5);
    const milestoneWaves = [3, 5, 10, 20];
    for (const mw of milestoneWaves) {
      if (wave >= mw && user.max_wave < mw) {
        gemsEarned += 5;
      }
    }
    gemsEarned = Math.floor(gemsEarned * gemsMult);

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

    // Update season mission progress (non-fatal)
    if (isSeasonActive()) {
      updateMissionProgress(supabase, userId, {
        score,
        wave,
        enemiesKilled: enemiesKilled || 0,
        gemsCollected: gemsCollected || 0,
        coinsEarned,
        abilitiesUsed: abilitiesUsed || 0
      }).catch(e => console.warn('mission progress update failed (non-fatal):', e.message));
    }

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

// ── Skin crate endpoint ───────────────────────────────────────────────────────
router.post('/open-skin-crate', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;

    const crateType = req.body.crateType || 'stellar';
    const crate = SKIN_CRATE_TYPES[crateType];
    if (!crate) return res.json({ success: false, error: 'Invalid skin crate type' });

    const { data: user } = await supabase
      .from('users')
      .select('coins, gems, free_skin_crates')
      .eq('id', userId)
      .single();

    // Check if user has a free skin crate available
    const freeCrates = Number(user.free_skin_crates || 0);
    const usingFreeCrate = freeCrates > 0;

    if (!usingFreeCrate) {
      if (user.coins < crate.costCoins) {
        return res.json({ success: false, error: `Not enough coins (need ${crate.costCoins})` });
      }
      if (user.gems < crate.costGems) {
        return res.json({ success: false, error: `Not enough gems (need ${crate.costGems})` });
      }
    }

    // Deduct cost
    if (usingFreeCrate) {
      await supabase.from('users').update({ free_skin_crates: freeCrates - 1 }).eq('id', userId);
    } else {
      await supabase.from('users').update({
        coins: user.coins - crate.costCoins,
        gems:  user.gems  - crate.costGems
      }).eq('id', userId);
    }

    // Pick rarity then skin
    const rarity = crate.pool[Math.floor(Math.random() * crate.pool.length)];
    const pool = SKINS_BY_RARITY[rarity];
    const skinId = pool[Math.floor(Math.random() * pool.length)];

    // Check if already owned
    const { data: existing } = await supabase
      .from('user_skins')
      .select('skin_id')
      .eq('user_id', userId)
      .eq('skin_id', skinId)
      .maybeSingle();

    let coinsCompensation = 0;
    if (existing) {
      // Already owned – compensate with coins
      const compensation = { common: 500, rare: 1500, epic: 5000, legendary: 20000 };
      coinsCompensation = compensation[rarity] || 500;
      const { data: userData } = await supabase.from('users').select('coins').eq('id', userId).single();
      await supabase.from('users').update({ coins: (userData?.coins || 0) + coinsCompensation }).eq('id', userId);
    } else {
      await supabase.from('user_skins').insert({ user_id: userId, skin_id: skinId });
    }

    const skinDef = SKINS[skinId];
    res.json({
      success: true,
      data: {
        skinId,
        rarity,
        skinName: skinDef?.name || skinId,
        alreadyOwned: !!existing,
        coinsCompensation,
        usedFreeCrate: usingFreeCrate
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ── Equip skin endpoint ───────────────────────────────────────────────────────
router.post('/equip-skin', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;
    const { skinId } = req.body;

    if (!skinId || skinId === 'default') {
      await supabase.from('users').update({ equipped_skin: 'default' }).eq('id', userId);
      return res.json({ success: true, data: { equipped_skin: 'default' } });
    }

    if (!SKINS[skinId]) return res.json({ success: false, error: 'Unknown skin' });

    const { data: owned } = await supabase
      .from('user_skins')
      .select('skin_id')
      .eq('user_id', userId)
      .eq('skin_id', skinId)
      .maybeSingle();

    if (!owned) return res.json({ success: false, error: 'Skin not owned' });

    const { error } = await supabase.from('users').update({ equipped_skin: skinId }).eq('id', userId);
    if (error) throw new Error(error.message);

    res.json({ success: true, data: { equipped_skin: skinId } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

async function updateMissionProgress(supabase, userId, { score, wave, enemiesKilled, gemsCollected, coinsEarned, abilitiesUsed }) {
  const currentWeek = getCurrentSeasonWeek();
  const availableMissions = SEASON_MISSIONS.filter(m => m.week <= currentWeek);

  // Fetch existing progress
  const { data: existing } = await supabase
    .from('user_mission_progress')
    .select('mission_id, progress, completed')
    .eq('user_id', userId)
    .in('mission_id', availableMissions.map(m => m.id));

  const existingMap = {};
  for (const row of (existing || [])) existingMap[row.mission_id] = row;

  for (const mission of availableMissions) {
    const prev = existingMap[mission.id];
    if (prev?.completed) continue;

    let increment = 0;
    let isSingle = false;

    switch (mission.type) {
      case 'games_played':         increment = 1; break;
      case 'enemies_killed':       increment = enemiesKilled; break;
      case 'gems_collected':       increment = gemsCollected; break;
      case 'coins_earned_session': isSingle = true; increment = coinsEarned >= mission.target ? mission.target : 0; break;
      case 'max_wave_single':      isSingle = true; increment = wave >= mission.target ? mission.target : 0; break;
      case 'abilities_used_single':isSingle = true; increment = abilitiesUsed >= mission.target ? mission.target : 0; break;
      case 'score_single':         isSingle = true; increment = score >= mission.target ? mission.target : 0; break;
    }

    if (increment === 0 && !isSingle) continue;

    const newProgress = isSingle
      ? (increment >= mission.target ? mission.target : (prev?.progress || 0))
      : Math.min(mission.target, (prev?.progress || 0) + increment);

    const completed = newProgress >= mission.target;

    if (!prev) {
      await supabase.from('user_mission_progress').insert({
        user_id: userId,
        mission_id: mission.id,
        progress: newProgress,
        completed,
        reward_claimed: false
      });
    } else if (newProgress > prev.progress) {
      await supabase.from('user_mission_progress')
        .update({ progress: newProgress, completed })
        .eq('user_id', userId)
        .eq('mission_id', mission.id);
    }
  }
}

// ── Season Pass routes ────────────────────────────────────────────────────────

router.get('/season-pass', async (req, res) => {
  try {
    const supabase = getDB();
    const userId = req.user.userId;

    const [passResult, missionsResult] = await Promise.all([
      supabase.from('user_season_pass')
        .select('pulsar, claimed_tiers')
        .eq('user_id', userId)
        .eq('season_id', SEASON_ID)
        .maybeSingle(),
      supabase.from('user_mission_progress')
        .select('mission_id, progress, completed, reward_claimed')
        .eq('user_id', userId)
    ]);

    const currentWeek = getCurrentSeasonWeek();
    const missionProgress = missionsResult.data || [];

    res.json({
      success: true,
      data: {
        season_id: SEASON_ID,
        season_name: SEASON_NAME,
        season_end: SEASON_END.toISOString(),
        current_week: currentWeek,
        active: isSeasonActive(),
        pulsar: passResult.data?.pulsar || 0,
        claimed_tiers: passResult.data?.claimed_tiers || [],
        missions: SEASON_MISSIONS.map(m => {
          const prog = missionProgress.find(p => p.mission_id === m.id);
          return {
            ...m,
            unlocked: m.week <= currentWeek,
            progress: prog?.progress || 0,
            completed: prog?.completed || false,
            reward_claimed: prog?.reward_claimed || false
          };
        }),
        tiers: PASS_TIERS
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/claim-mission-reward', async (req, res) => {
  try {
    const { missionId } = req.body;
    const supabase = getDB();
    const userId = req.user.userId;

    const mission = SEASON_MISSIONS.find(m => m.id === missionId);
    if (!mission) return res.json({ success: false, error: 'Unknown mission' });

    if (mission.week > getCurrentSeasonWeek()) {
      return res.json({ success: false, error: 'Mission not yet unlocked' });
    }

    const { data: prog } = await supabase.from('user_mission_progress')
      .select('completed, reward_claimed')
      .eq('user_id', userId)
      .eq('mission_id', missionId)
      .maybeSingle();

    if (!prog?.completed) return res.json({ success: false, error: 'Mission not completed' });
    if (prog.reward_claimed) return res.json({ success: false, error: 'Reward already claimed' });

    // Grant Pulsar + coins + gems based on difficulty
    const { data: passRow } = await supabase.from('user_season_pass')
      .select('pulsar, claimed_tiers')
      .eq('user_id', userId)
      .eq('season_id', SEASON_ID)
      .maybeSingle();

    const newPulsar = (passRow?.pulsar || 0) + mission.pulsar;

    if (passRow) {
      await supabase.from('user_season_pass')
        .update({ pulsar: newPulsar })
        .eq('user_id', userId)
        .eq('season_id', SEASON_ID);
    } else {
      await supabase.from('user_season_pass')
        .insert({ user_id: userId, season_id: SEASON_ID, pulsar: newPulsar, claimed_tiers: [] });
    }

    // Grant coins/gems if any
    if (mission.reward_coins > 0 || mission.reward_gems > 0) {
      const { data: userRow } = await supabase.from('users').select('coins, gems').eq('id', userId).single();
      await supabase.from('users').update({
        coins: (userRow?.coins || 0) + (mission.reward_coins || 0),
        gems:  (userRow?.gems  || 0) + (mission.reward_gems  || 0)
      }).eq('id', userId);
    }

    await supabase.from('user_mission_progress')
      .update({ reward_claimed: true })
      .eq('user_id', userId)
      .eq('mission_id', missionId);

    res.json({ success: true, data: {
      pulsarEarned: mission.pulsar,
      totalPulsar: newPulsar,
      coinsEarned: mission.reward_coins || 0,
      gemsEarned:  mission.reward_gems  || 0
    } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/claim-pass-tier', async (req, res) => {
  try {
    const { tier } = req.body;
    const supabase = getDB();
    const userId = req.user.userId;

    const tierDef = PASS_TIERS.find(t => t.tier === tier);
    if (!tierDef) return res.json({ success: false, error: 'Invalid tier' });

    const { data: passRow } = await supabase.from('user_season_pass')
      .select('pulsar, claimed_tiers')
      .eq('user_id', userId)
      .eq('season_id', SEASON_ID)
      .maybeSingle();

    if (!passRow) return res.json({ success: false, error: 'No pass data found' });

    const claimedTiers = passRow.claimed_tiers || [];
    const tierKey = `tier_${tier}`;

    if (claimedTiers.includes(tierKey)) return res.json({ success: false, error: 'Tier already claimed' });
    if (passRow.pulsar < tierDef.pulsar) return res.json({ success: false, error: 'Not enough Pulsar' });

    const newClaimedTiers = [...claimedTiers, tierKey];
    await supabase.from('user_season_pass')
      .update({ claimed_tiers: newClaimedTiers })
      .eq('user_id', userId)
      .eq('season_id', SEASON_ID);

    const { data: user } = await supabase.from('users').select('coins, gems').eq('id', userId).single();
    const reward = tierDef.reward;
    let rewardDesc = '';

    if (reward.type === 'coins') {
      await supabase.from('users').update({ coins: (user.coins || 0) + reward.amount }).eq('id', userId);
      rewardDesc = `+${reward.amount} monete`;
    } else if (reward.type === 'gems') {
      await supabase.from('users').update({ gems: (user.gems || 0) + reward.amount }).eq('id', userId);
      rewardDesc = `+${reward.amount} gemme`;
    } else if (reward.type === 'ability') {
      const { data: existing } = await supabase.from('user_abilities')
        .select('level').eq('user_id', userId).eq('ability_id', reward.abilityId).maybeSingle();
      if (!existing) {
        await supabase.from('user_abilities').insert({ user_id: userId, ability_id: reward.abilityId, level: 1 });
      } else if (existing.level < 10) {
        await supabase.from('user_abilities').update({ level: existing.level + 1 })
          .eq('user_id', userId).eq('ability_id', reward.abilityId);
      }
      rewardDesc = `Abilità: ${reward.abilityId.replace(/_/g, ' ')}`;
    } else if (reward.type === 'skin') {
      const { data: ownedSkin } = await supabase.from('user_skins')
        .select('skin_id').eq('user_id', userId).eq('skin_id', reward.skinId).maybeSingle();
      if (!ownedSkin) {
        await supabase.from('user_skins').insert({ user_id: userId, skin_id: reward.skinId });
      }
      rewardDesc = `Aura: ${SKINS[reward.skinId]?.name || reward.skinId}`;
    }

    res.json({ success: true, data: { tier, reward, rewardDesc } });
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

// ===== CURRENCY EXCHANGE =====
const EXCHANGE_RATES = {
  gems_to_coins_10:   { cost_gems: 5,  give_coins: 250 },
  gems_to_coins_25:   { cost_gems: 10, give_coins: 550 },
  gems_to_coins_50:   { cost_gems: 25, give_coins: 1500 },
  coins_to_gems_100:  { cost_coins: 500,  give_gems: 1 },
  coins_to_gems_500:  { cost_coins: 2200, give_gems: 5 },
  coins_to_gems_1000: { cost_coins: 4000, give_gems: 10 }
};

router.post('/exchange', async (req, res) => {
  try {
    const userId = req.user.id;
    const { exchange_id } = req.body;
    const rate = EXCHANGE_RATES[exchange_id];
    if (!rate) return res.json({ success: false, error: 'Invalid exchange type' });

    const supabase = getDB();

    // Get current balance
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('coins, gems')
      .eq('id', userId)
      .single();
    if (pErr || !profile) return res.json({ success: false, error: 'Profile not found' });

    // Check sufficient funds
    if (rate.cost_gems && profile.gems < rate.cost_gems) {
      return res.json({ success: false, error: 'Gemme insufficienti' });
    }
    if (rate.cost_coins && profile.coins < rate.cost_coins) {
      return res.json({ success: false, error: 'Monete insufficienti' });
    }

    // Perform exchange
    let newCoins = profile.coins;
    let newGems = profile.gems;

    if (rate.cost_gems) {
      newGems -= rate.cost_gems;
      newCoins += rate.give_coins;
    } else {
      newCoins -= rate.cost_coins;
      newGems += rate.give_gems;
    }

    const { error: uErr } = await supabase
      .from('profiles')
      .update({ coins: newCoins, gems: newGems })
      .eq('id', userId);
    if (uErr) return res.json({ success: false, error: 'Exchange failed' });

    res.json({ success: true, data: { coins: newCoins, gems: newGems } });
  } catch (e) {
    res.json({ success: false, error: 'Server error' });
  }
});

module.exports = router;
