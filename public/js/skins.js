// ===== SKIN SYSTEM =====

const SKINS = {
  // ── Common ──────────────────────────────────────────────────────────────────
  aurora: {
    id: 'aurora', name: 'Aurora Drift', rarity: 'common',
    color: '#00ffff', emoji: '🔵',
    description: '+10% coins earned',
    boost: { coins_mult: 1.10, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#00ffff', '#0088ff'], count: 1, speed: 1.5, size: 3, decay: 0.04, spread: 4 }
  },
  solar_flare: {
    id: 'solar_flare', name: 'Solar Flare', rarity: 'common',
    color: '#ffff00', emoji: '🌟',
    description: '+5% score',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.05, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#ffff00', '#ffaa00'], count: 1, speed: 1.2, size: 3, decay: 0.04, spread: 4 }
  },
  ice_storm: {
    id: 'ice_storm', name: 'Ice Storm', rarity: 'common',
    color: '#aaddff', emoji: '❄️',
    description: '+5% gems earned',
    boost: { coins_mult: 1.00, gems_mult: 1.05, score_mult: 1.00, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#aaddff', '#ffffff'], count: 1, speed: 1.0, size: 2, decay: 0.035, spread: 5 }
  },
  toxic_drift: {
    id: 'toxic_drift', name: 'Toxic Drift', rarity: 'common',
    color: '#00ff88', emoji: '☣️',
    description: '+5% coins earned',
    boost: { coins_mult: 1.05, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#00ff88', '#44ff00'], count: 1, speed: 1.3, size: 3, decay: 0.04, spread: 4 }
  },

  // ── Rare ────────────────────────────────────────────────────────────────────
  phantom: {
    id: 'phantom', name: 'Phantom Eclipse', rarity: 'rare',
    color: '#aa00ff', emoji: '🔮',
    description: '+15% coins earned',
    boost: { coins_mult: 1.15, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#aa00ff', '#6600cc', '#dd88ff'], count: 2, speed: 1.8, size: 3, decay: 0.03, spread: 6 }
  },
  crimson_nova: {
    id: 'crimson_nova', name: 'Crimson Nova', rarity: 'rare',
    color: '#ff2244', emoji: '🌋',
    description: '+10% score',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.10, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#ff2244', '#ff6600', '#ffaa00'], count: 2, speed: 2.0, size: 3, decay: 0.03, spread: 5 }
  },
  nebula: {
    id: 'nebula', name: 'Nebula Ghost', rarity: 'rare',
    color: '#dd44ff', emoji: '👻',
    description: '+10% gems earned',
    boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.00, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#dd44ff', '#8800cc', '#ff88ff'], count: 2, speed: 1.5, size: 3, decay: 0.025, spread: 7 }
  },
  thunder: {
    id: 'thunder', name: 'Thunder Strike', rarity: 'rare',
    color: '#ffee00', emoji: '⚡',
    description: '+1 extra life',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.00, extra_lives: 1, starting_shield: false },
    trail: { colors: ['#ffee00', '#ffffff', '#88ccff'], count: 2, speed: 2.5, size: 2, decay: 0.05, spread: 3 }
  },

  // ── Epic ────────────────────────────────────────────────────────────────────
  void_wraith: {
    id: 'void_wraith', name: 'Void Wraith', rarity: 'epic',
    color: '#8800ff', emoji: '💀',
    description: '+25% coins, +10% gems',
    boost: { coins_mult: 1.25, gems_mult: 1.10, score_mult: 1.00, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#8800ff', '#440088', '#cc44ff', '#000000'], count: 3, speed: 2.0, size: 4, decay: 0.02, spread: 8 }
  },
  celestial: {
    id: 'celestial', name: 'Celestial Dragon', rarity: 'epic',
    color: '#ff4400', emoji: '🐉',
    description: '+20% score, +1 extra life',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.20, extra_lives: 1, starting_shield: false },
    trail: { colors: ['#ff4400', '#ff8800', '#ffcc00', '#ffffff'], count: 3, speed: 2.2, size: 4, decay: 0.025, spread: 6 }
  },
  quantum_rift: {
    id: 'quantum_rift', name: 'Quantum Rift', rarity: 'epic',
    color: '#00ffcc', emoji: '🌀',
    description: '+15% coins/gems, start shielded',
    boost: { coins_mult: 1.15, gems_mult: 1.15, score_mult: 1.00, extra_lives: 0, starting_shield: true },
    trail: { colors: ['#00ffcc', '#0088ff', '#00ffff', '#88ffee'], count: 3, speed: 1.8, size: 4, decay: 0.02, spread: 9 }
  },

  // ── Legendary ───────────────────────────────────────────────────────────────
  galactic_overlord: {
    id: 'galactic_overlord', name: 'Galactic Overlord', rarity: 'legendary',
    color: '#ffaa00', emoji: '👑',
    description: '+30% coins/gems, +25% score, +2 lives',
    boost: { coins_mult: 1.30, gems_mult: 1.30, score_mult: 1.25, extra_lives: 2, starting_shield: false },
    trail: { colors: ['#ffaa00', '#ffdd44', '#ffffff', '#ffcc88', '#ff8800'], count: 4, speed: 2.5, size: 5, decay: 0.018, spread: 10 }
  },

  // ── Japan Season (pass-exclusive) ───────────────────────────────────────────
  rising_sun: {
    id: 'rising_sun', name: 'Rising Sun', rarity: 'epic',
    color: '#ff4400', emoji: '🌅',
    description: '+20% score, +10% gems',
    season_exclusive: true,
    boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.20, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#ff4400', '#ff0000', '#ffcc00', '#ffffff'], count: 3, speed: 2.0, size: 4, decay: 0.022, spread: 7 }
  },
  torii_gate: {
    id: 'torii_gate', name: 'Torii Gate', rarity: 'legendary',
    color: '#ff0033', emoji: '⛩️',
    description: '+25% coins/gems, start shielded, +1 life',
    season_exclusive: true,
    boost: { coins_mult: 1.25, gems_mult: 1.25, score_mult: 1.00, extra_lives: 1, starting_shield: true },
    trail: { colors: ['#ff0033', '#cc0000', '#ffffff', '#ffcccc', '#ff6688'], count: 4, speed: 2.2, size: 5, decay: 0.018, spread: 9 }
  },

  // ── Streak Exclusive (day 30 reward — NOT obtainable from crates) ──────────
  streak_inferno: {
    id: 'streak_inferno', name: 'Streak Inferno', rarity: 'legendary',
    color: '#ff6600', emoji: '🔥',
    description: '+35% coins/gems, +30% score, +2 lives, start shielded',
    streak_exclusive: true,
    boost: { coins_mult: 1.35, gems_mult: 1.35, score_mult: 1.30, extra_lives: 2, starting_shield: true },
    trail: { colors: ['#ff6600', '#ff2200', '#ffaa00', '#ffff44', '#ffffff'], count: 5, speed: 3.0, size: 5, decay: 0.015, spread: 10 }
  }
};

const SKIN_CRATE_DEFS = {
  stellar: {
    icon: '✨', name: 'STELLAR CRATE', costCoins: 200, costGems: 5,
    odds: [
      { cls: 'common',    label: '■ COMMON: 50%' },
      { cls: 'rare',      label: '■ RARE: 35%' },
      { cls: 'epic',      label: '■ EPIC: 12%' },
      { cls: 'legendary', label: '■ LEGENDARY: 3%' }
    ]
  },
  nova: {
    icon: '🌠', name: 'NOVA CRATE', costCoins: 1000, costGems: 20,
    odds: [
      { cls: 'common',    label: '■ COMMON: 15%' },
      { cls: 'rare',      label: '■ RARE: 40%' },
      { cls: 'epic',      label: '■ EPIC: 35%' },
      { cls: 'legendary', label: '■ LEGENDARY: 10%' }
    ]
  }
};

function getEquippedSkinBoosts(skinId) {
  if (!skinId || skinId === 'default' || !SKINS[skinId]) {
    return { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false };
  }
  return SKINS[skinId].boost;
}

function getEquippedSkinTrail(skinId) {
  if (!skinId || skinId === 'default' || !SKINS[skinId]) return null;
  return SKINS[skinId].trail || null;
}
