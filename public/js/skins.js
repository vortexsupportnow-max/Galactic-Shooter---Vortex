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

  // ── Japan Season — Season 1 (pass-exclusive, archived) ──────────────────────
  rising_sun: {
    id: 'rising_sun', name: 'Rising Sun', rarity: 'epic',
    color: '#ff4400', emoji: '🌅',
    description: '+20% score, +10% gems',
    season_exclusive: true, season_tag: '🌸 JAPAN SEASON',
    boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.20, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#ff4400', '#ff0000', '#ffcc00', '#ffffff'], count: 3, speed: 2.0, size: 4, decay: 0.022, spread: 7 }
  },
  torii_gate: {
    id: 'torii_gate', name: 'Torii Gate', rarity: 'legendary',
    color: '#ff0033', emoji: '⛩️',
    description: '+25% coins/gems, start shielded, +1 life',
    season_exclusive: true, season_tag: '🌸 JAPAN SEASON',
    boost: { coins_mult: 1.25, gems_mult: 1.25, score_mult: 1.00, extra_lives: 1, starting_shield: true },
    trail: { colors: ['#ff0033', '#cc0000', '#ffffff', '#ffcccc', '#ff6688'], count: 4, speed: 2.2, size: 5, decay: 0.018, spread: 9 }
  },

  // ── Italia Season — Season 2 (pass-exclusive) ───────────────────────────────
  tricolore: {
    id: 'tricolore', name: 'Tricolore', rarity: 'epic',
    // Emoji fallback for plain-text spots; the skin grid draws the CSS flag instead,
    // because Windows renders the 🇮🇹 emoji as the letters "IT".
    color: '#009246', emoji: '🟩⬜🟥',
    description: '+20% score, +10% gems',
    season_exclusive: true, season_tag: '🟩⬜🟥 ITALIA SEASON',
    stripes: ['#009246', '#ffffff', '#ce2b37'],
    boost: { coins_mult: 1.00, gems_mult: 1.10, score_mult: 1.20, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#009246', '#ffffff', '#ce2b37'], count: 3, speed: 2.0, size: 4, decay: 0.022, spread: 7 }
  },
  colosseo: {
    id: 'colosseo', name: 'Colosseo', rarity: 'legendary',
    color: '#d4af37', emoji: '🏛️',
    description: '+25% coins/gems, start shielded, +1 life',
    season_exclusive: true, season_tag: '🟩⬜🟥 ITALIA SEASON',
    boost: { coins_mult: 1.25, gems_mult: 1.25, score_mult: 1.00, extra_lives: 1, starting_shield: true },
    trail: { colors: ['#d4af37', '#f5e6a8', '#b08d2f', '#e8d8a0', '#8a6d1f'], count: 4, speed: 2.2, size: 5, decay: 0.018, spread: 9 }
  },

  // ── Streak Exclusive (day 30 reward — NOT obtainable from crates) ──────────
  streak_inferno: {
    id: 'streak_inferno', name: 'Streak Inferno', rarity: 'legendary',
    color: '#ff6600', emoji: '🔥',
    description: '+35% coins/gems, +30% score, +2 lives, start shielded',
    streak_exclusive: true,
    boost: { coins_mult: 1.35, gems_mult: 1.35, score_mult: 1.30, extra_lives: 2, starting_shield: true },
    trail: { colors: ['#ff6600', '#ff2200', '#ffaa00', '#ffff44', '#ffffff'], count: 5, speed: 3.0, size: 5, decay: 0.015, spread: 10 }
  },

  // ── Boss Rush Exclusive Auras (unlockable via in-game objectives) ─────────────
  br_singularity: {
    id: 'br_singularity', name: 'SINGULARITY', rarity: 'legendary',
    color: '#111111', emoji: '🕳️',
    description: 'Aura nera con distorsione spaziale pulsante',
    boss_rush_exclusive: true,
    unlock_objective: 'Sconfiggi 5 boss consecutivi in meno di 2 minuti ciascuno',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.40, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#000000', '#330033', '#660066', '#220022', '#440044'], count: 6, speed: 1.0, size: 6, decay: 0.01, spread: 12 }
  },
  br_nova_crown: {
    id: 'br_nova_crown', name: 'NOVA CROWN', rarity: 'legendary',
    color: '#ffcc00', emoji: '👑',
    description: 'Aura dorata con esplosioni solari agli angoli',
    boss_rush_exclusive: true,
    unlock_objective: 'Completa una run intera senza mai usare un\'abilità',
    boost: { coins_mult: 1.40, gems_mult: 1.40, score_mult: 1.00, extra_lives: 0, starting_shield: false },
    trail: { colors: ['#ffcc00', '#ffee44', '#ffffff', '#ffaa00', '#ff8800'], count: 6, speed: 2.8, size: 5, decay: 0.012, spread: 11 }
  },
  br_void_wraith: {
    id: 'br_void_wraith', name: 'VOID WRAITH', rarity: 'legendary',
    color: '#4400aa', emoji: '🌑',
    description: 'Aura viola scuro con tentacoli d\'ombra animati',
    boss_rush_exclusive: true,
    unlock_objective: 'Subisci zero danni durante una fase 2 di qualsiasi boss',
    boost: { coins_mult: 1.00, gems_mult: 1.00, score_mult: 1.35, extra_lives: 1, starting_shield: false },
    trail: { colors: ['#4400aa', '#220066', '#6600cc', '#aa00ff', '#000000'], count: 6, speed: 2.2, size: 5, decay: 0.015, spread: 10 }
  },
  br_binary_star: {
    id: 'br_binary_star', name: 'BINARY STAR', rarity: 'legendary',
    color: '#aaeeff', emoji: '⭐',
    description: 'Doppia aura bianca e azzurra che orbita il giocatore',
    boss_rush_exclusive: true,
    unlock_objective: 'Sconfiggi lo stesso boss per 50 volte totali nel corso delle run',
    boost: { coins_mult: 1.20, gems_mult: 1.20, score_mult: 1.20, extra_lives: 0, starting_shield: true },
    trail: { colors: ['#ffffff', '#aaeeff', '#66ccff', '#ffffff', '#aaddff'], count: 6, speed: 2.5, size: 4, decay: 0.013, spread: 9 }
  },
  br_eternal_nemesis: {
    id: 'br_eternal_nemesis', name: 'ETERNAL NEMESIS', rarity: 'legendary',
    color: '#ff0000', emoji: '💀',
    description: 'Aura rossa con frammenti di boss abbattuti che orbitano',
    boss_rush_exclusive: true,
    unlock_objective: 'Sconfiggi almeno 100 boss totali in modalità Boss Rush',
    boost: { coins_mult: 1.30, gems_mult: 1.30, score_mult: 1.50, extra_lives: 2, starting_shield: true },
    trail: { colors: ['#ff0000', '#cc0000', '#ff4400', '#ff8800', '#660000'], count: 7, speed: 3.5, size: 6, decay: 0.010, spread: 13 }
  }
};

const SKIN_CRATE_DEFS = {
  stellar: {
    icon: '✨', svg: 'crate-stellar', name: 'STELLAR CRATE', costCoins: 200, costGems: 5,
    odds: [
      { cls: 'common',    label: '■ COMMON: 50%' },
      { cls: 'rare',      label: '■ RARE: 35%' },
      { cls: 'epic',      label: '■ EPIC: 12%' },
      { cls: 'legendary', label: '■ LEGENDARY: 3%' }
    ]
  },
  nova: {
    icon: '🌠', svg: 'crate-nova', name: 'NOVA CRATE', costCoins: 1000, costGems: 20,
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

// Flag-style skins paint vertical stripes around the ship instead of a flat tint
function getEquippedSkinStripes(skinId) {
  if (!skinId || skinId === 'default' || !SKINS[skinId]) return null;
  return SKINS[skinId].stripes || null;
}

// ── Ship visuals ──────────────────────────────────────────────────────────────
// Each aura now changes the actual ship: hull shape, palette, engine colour and
// an animated aura. Used in-game (ShipRenderer) and for the skin-card previews.
// Rarity shows: commons recolour the base hulls, legendaries get unique hulls
// and the most elaborate auras.
const SKIN_VISUALS = {
  aurora:            { hull: 'arrow',       primary: '#36e8ff', secondary: '#1660d8', accent: '#e0fbff', cockpit: '#c8f8ff', engine: '#36c8ff', aura: 'glow' },
  solar_flare:       { hull: 'arrow',       primary: '#ffe14a', secondary: '#d87a12', accent: '#fff6c8', cockpit: '#fff1a8', engine: '#ffb020', aura: 'glow' },
  ice_storm:         { hull: 'dart',        primary: '#d8f0ff', secondary: '#5a9ad8', accent: '#ffffff', cockpit: '#a8e0ff', engine: '#a8e8ff', aura: 'sparkle', auraColor: '#ffffff', auraColor2: '#a8ddff' },
  toxic_drift:       { hull: 'dart',        primary: '#5aff9a', secondary: '#128a3a', accent: '#d8ffe8', cockpit: '#c8ffd8', engine: '#44ff66', aura: 'glow' },

  phantom:           { hull: 'phantom',     primary: '#b86aff', secondary: '#4a128a', accent: '#f0d8ff', cockpit: '#e0c0ff', engine: '#c044ff', aura: 'ring' },
  crimson_nova:      { hull: 'interceptor', primary: '#ff4a5a', secondary: '#8a0a1a', accent: '#ffd8d8', cockpit: '#ffc0c8', engine: '#ff5533', aura: 'ring', auraColor2: '#ffaa44' },
  nebula:            { hull: 'manta',       primary: '#ff7ae0', secondary: '#5a2ab8', accent: '#ffe0f8', cockpit: '#f8d0ff', engine: '#ff66dd', aura: 'sparkle', auraColor: '#ff99ee', auraColor2: '#aa88ff' },
  thunder:           { hull: 'interceptor', primary: '#fff36a', secondary: '#3a4ad8', accent: '#ffffff', cockpit: '#e8f0ff', engine: '#88ccff', aura: 'sparkle', auraColor: '#ffee00', auraColor2: '#88ccff' },

  void_wraith:       { hull: 'phantom',     primary: '#7a2aff', secondary: '#1a0640', accent: '#d0a8ff', cockpit: '#b088ff', engine: '#aa44ff', aura: 'void', auraColor: '#cc44ff' },
  celestial:         { hull: 'dragon',      primary: '#ff6a1a', secondary: '#8a1a00', accent: '#ffe08a', cockpit: '#ffe8a8', engine: '#ffaa00', aura: 'flame', auraColor: '#ff6600', auraColor2: '#ffcc00' },
  quantum_rift:      { hull: 'manta',       primary: '#22ffd0', secondary: '#0a4a8a', accent: '#d8fff8', cockpit: '#b8fff0', engine: '#00ffee', aura: 'orbit', auraColor: '#00ffcc', auraColor2: '#0088ff', orbitCount: 4 },
  galactic_overlord: { hull: 'crown',       primary: '#ffc23a', secondary: '#8a4a00', accent: '#ffffff', cockpit: '#fff0b8', engine: '#ffaa22', aura: 'orbit', auraColor: '#ffcc33', auraColor2: '#ffffff', orbitCount: 5 },

  rising_sun:        { hull: 'interceptor', primary: '#ffffff', secondary: '#d8d8e0', accent: '#ff2a1a', cockpit: '#ffb0a8', engine: '#ff4422', aura: 'ring', auraColor: '#ff2200', auraColor2: '#ffcc00' },
  torii_gate:        { hull: 'fortress',    primary: '#ff2a3a', secondary: '#5a0008', accent: '#ffffff', cockpit: '#ffd0d0', engine: '#ff6688', aura: 'sparkle', auraColor: '#ff88aa', auraColor2: '#ffffff' },
  tricolore:         { hull: 'arrow',       primary: '#f4f4f4', secondary: '#9aa0a8', accent: '#ffffff', cockpit: '#d8ffe0', engine: '#ffffff', aura: 'ring', auraColor: '#009246', auraColor2: '#ce2b37', stripes: ['#009246', '#ffffff', '#ce2b37'] },
  colosseo:          { hull: 'fortress',    primary: '#e8c860', secondary: '#7a5a1a', accent: '#fff6d8', cockpit: '#fff0c0', engine: '#ffd070', aura: 'orbit', auraColor: '#d4af37', auraColor2: '#f5e6a8', orbitCount: 4 },

  streak_inferno:    { hull: 'dragon',      primary: '#ff5a00', secondary: '#6a0a00', accent: '#ffff66', cockpit: '#ffe066', engine: '#ff8800', aura: 'flame', auraColor: '#ff3300', auraColor2: '#ffdd00' },

  br_singularity:    { hull: 'phantom',     primary: '#3a3a44', secondary: '#0a0a10', accent: '#cc66ff', cockpit: '#a066ff', engine: '#aa33ff', aura: 'void', auraColor: '#aa33ff' },
  br_nova_crown:     { hull: 'crown',       primary: '#ffe04a', secondary: '#a36a00', accent: '#ffffff', cockpit: '#fff8c8', engine: '#ffee66', aura: 'flame', auraColor: '#ffcc00', auraColor2: '#ffffff' },
  br_void_wraith:    { hull: 'manta',       primary: '#5a22c8', secondary: '#12002a', accent: '#c088ff', cockpit: '#9a66ff', engine: '#7a22ff', aura: 'void', auraColor: '#7a22ff' },
  br_binary_star:    { hull: 'dart',        primary: '#f0faff', secondary: '#5aaad8', accent: '#ffffff', cockpit: '#c8eeff', engine: '#aaeeff', aura: 'binary', auraColor: '#ffffff', auraColor2: '#66ccff' },
  br_eternal_nemesis:{ hull: 'dragon',      primary: '#ff1a1a', secondary: '#3a0000', accent: '#ffaa66', cockpit: '#ff8866', engine: '#ff2200', aura: 'orbit', auraColor: '#ff2200', auraColor2: '#ff8800', orbitCount: 6 }
};

function getSkinVisual(skinId) {
  if (!skinId || skinId === 'default') return null;
  return SKIN_VISUALS[skinId] || null;
}
