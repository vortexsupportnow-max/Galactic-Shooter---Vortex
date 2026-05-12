// ===== SKIN SYSTEM =====

const SKINS = {
  // ── Common ──────────────────────────────────────────────────────────────────
  aurora: {
    id: 'aurora', name: 'Aurora Drift', rarity: 'common',
    color: '#00ffff', emoji: '🔵',
    description: '+10% coins earned',
    boost: { coins_mult: 1.10, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false }
  },
  solar_flare: {
    id: 'solar_flare', name: 'Solar Flare', rarity: 'common',
    color: '#ffff00', emoji: '🌟',
    description: '+5% score',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.05, extra_lives: 0, starting_shield: false }
  },
  ice_storm: {
    id: 'ice_storm', name: 'Ice Storm', rarity: 'common',
    color: '#aaddff', emoji: '❄️',
    description: '+5% gems earned',
    boost: { coins_mult: 1.00, gems_mult: 1.05, score_mult: 1.00, extra_lives: 0, starting_shield: false }
  },
  toxic_drift: {
    id: 'toxic_drift', name: 'Toxic Drift', rarity: 'common',
    color: '#00ff88', emoji: '☣️',
    description: '+5% coins earned',
    boost: { coins_mult: 1.05, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false }
  },

  // ── Rare ────────────────────────────────────────────────────────────────────
  phantom: {
    id: 'phantom', name: 'Phantom Eclipse', rarity: 'rare',
    color: '#aa00ff', emoji: '🔮',
    description: '+15% coins earned',
    boost: { coins_mult: 1.15, gems_mult: 1.00, score_mult: 1.00, extra_lives: 0, starting_shield: false }
  },
  crimson_nova: {
    id: 'crimson_nova', name: 'Crimson Nova', rarity: 'rare',
    color: '#ff2244', emoji: '🌋',
    description: '+10% score',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.10, extra_lives: 0, starting_shield: false }
  },
  nebula: {
    id: 'nebula', name: 'Nebula Ghost', rarity: 'rare',
    color: '#dd44ff', emoji: '👻',
    description: '+10% gems earned',
    boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.00, extra_lives: 0, starting_shield: false }
  },
  thunder: {
    id: 'thunder', name: 'Thunder Strike', rarity: 'rare',
    color: '#ffee00', emoji: '⚡',
    description: '+1 extra life',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.00, extra_lives: 1, starting_shield: false }
  },

  // ── Epic ────────────────────────────────────────────────────────────────────
  void_wraith: {
    id: 'void_wraith', name: 'Void Wraith', rarity: 'epic',
    color: '#8800ff', emoji: '💀',
    description: '+25% coins, +10% gems',
    boost: { coins_mult: 1.25, gems_mult: 1.10, score_mult: 1.00, extra_lives: 0, starting_shield: false }
  },
  celestial: {
    id: 'celestial', name: 'Celestial Dragon', rarity: 'epic',
    color: '#ff4400', emoji: '🐉',
    description: '+20% score, +1 extra life',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.20, extra_lives: 1, starting_shield: false }
  },
  quantum_rift: {
    id: 'quantum_rift', name: 'Quantum Rift', rarity: 'epic',
    color: '#00ffcc', emoji: '🌀',
    description: '+15% coins/gems, start shielded',
    boost: { coins_mult: 1.15, gems_mult: 1.15, score_mult: 1.00, extra_lives: 0, starting_shield: true }
  },

  // ── Legendary ───────────────────────────────────────────────────────────────
  galactic_overlord: {
    id: 'galactic_overlord', name: 'Galactic Overlord', rarity: 'legendary',
    color: '#ffaa00', emoji: '👑',
    description: '+30% coins/gems, +25% score, +2 lives',
    boost: { coins_mult: 1.30, gems_mult: 1.30, score_mult: 1.25, extra_lives: 2, starting_shield: false }
  },

  // ── Japan Season (pass-exclusive) ───────────────────────────────────────────
  rising_sun: {
    id: 'rising_sun', name: 'Rising Sun', rarity: 'epic',
    color: '#ff4400', emoji: '🌅',
    description: '+20% score, +10% gems',
    season_exclusive: true,
    boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.20, extra_lives: 0, starting_shield: false }
  },
  torii_gate: {
    id: 'torii_gate', name: 'Torii Gate', rarity: 'legendary',
    color: '#ff0033', emoji: '⛩️',
    description: '+25% coins/gems, start shielded, +1 life',
    season_exclusive: true,
    boost: { coins_mult: 1.25, gems_mult: 1.25, score_mult: 1.00, extra_lives: 1, starting_shield: true }
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
