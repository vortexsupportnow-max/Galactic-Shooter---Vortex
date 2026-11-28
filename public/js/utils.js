// ===== API HELPERS =====
const API_BASE = '/api';

function getToken() { return localStorage.getItem('gs_token'); }
function setToken(t) { localStorage.setItem('gs_token', t); }
function clearToken()  { localStorage.removeItem('gs_token'); }
function getNickname() { return localStorage.getItem('gs_nickname'); }
function setNickname(n) { localStorage.setItem('gs_nickname', n); }

// ===== AUDIO SETTINGS =====
window.audioVolume = parseFloat(localStorage.getItem('gs_audio_volume') || '1.0');

// ── Game settings (per device) ──
const DEFAULT_GAME_SETTINGS = { shake: true, lowfx: false, hitbox: false };
window.gameSettings = (() => {
  try { return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(localStorage.getItem('gs_settings') || '{}') }; }
  catch { return { ...DEFAULT_GAME_SETTINGS }; }
})();
function saveGameSettings() {
  try { localStorage.setItem('gs_settings', JSON.stringify(window.gameSettings)); } catch { /* private mode */ }
}
window.audioMuted  = localStorage.getItem('gs_audio_muted') === 'true';

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(API_BASE + path, { ...options, headers });

    // Tokens last 7 days; when one expires mid-session every call would silently
    // fail. Drop the dead token and send the player back to the login screen.
    if (res.status === 401) {
      clearToken();
      if (typeof stopGame === 'function') stopGame();
      if (typeof showLoginScreen === 'function') showLoginScreen();
      return { success: false, error: 'Sessione scaduta, accedi di nuovo' };
    }

    return await res.json();
  } catch (e) {
    return { success: false, error: 'Network error' };
  }
}

// ===== HTML ESCAPING =====
// Anything that originates from a user (nicknames, above all) must go through this
// before being dropped into an innerHTML template, or a crafted nickname becomes
// stored XSS for every player who opens the leaderboard.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== RARITY COLORS =====
const RARITY_COLORS = {
  common: '#aaaaaa',
  rare: '#4488ff',
  epic: '#aa44ff',
  legendary: '#ffaa00'
};

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

// ===== FORMAT NUMBER =====
function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

// ===== PARTICLE SYSTEM =====
// Additive sparks. Time-based (callers may pass dt; without it a 60fps frame is
// assumed) and capped so a screen-clearing ability can't tank the frame rate.
const MAX_PARTICLES = 1400;

class ParticleSystem {
  constructor() { this.particles = []; }

  emit(x, y, count, color, options = {}) {
    const cap = window.gameSettings && window.gameSettings.lowfx ? 350 : MAX_PARTICLES;
    const room = cap - this.particles.length;
    if (room <= 0) return;
    count = Math.min(count, room);
    for (let i = 0; i < count; i++) {
      const angle = options.angle != null
        ? options.angle + (Math.random() - 0.5) * (options.spread || 0.6)
        : Math.random() * Math.PI * 2;
      const speed = (options.speed || 2) * (0.5 + Math.random());
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: options.decay || (0.02 + Math.random() * 0.02),
        color,
        size: options.size || (1.5 + Math.random() * 2.5),
        gravity: options.gravity || 0,
        drag: options.drag || 0.985
      });
    }
  }

  update(dt = 16.667) {
    const f = Math.min(3, dt / 16.667);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.vx *= Math.pow(p.drag, f);
      p.vy = p.vy * Math.pow(p.drag, f) + p.gravity * f;
      p.life -= p.decay * f;
      if (p.life <= 0) {
        // swap-remove: order doesn't matter for particles
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  draw(ctx) {
    if (!this.particles.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + p.life * 0.6);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }
}

// ===== SOUND SYSTEM =====
let audioCtx = null;
let soundtrackGain = null;
let soundtrackTimer = null;
let soundtrackStarted = false;
let soundtrackStep = 0;

const MIN_AUDIO_GAIN = 0.0001;
const SOUNDTRACK_VOLUME_MULTIPLIER = 0.16;

const SOUNDTRACK_PATTERN = [
  { lead: [659.25, 783.99, 880, 783.99], bass: [220, 220] },
  { lead: [698.46, 880, 987.77, 880], bass: [233.08, 233.08] },
  { lead: [783.99, 987.77, 1174.66, 987.77], bass: [261.63, 261.63] },
  { lead: [698.46, 880, 783.99, 659.25], bass: [196, 220] }
];

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, type, duration, volume = 0.3, detune = 0) {
  if (window.audioMuted) return;
  const effectiveVolume = volume * (window.audioVolume ?? 1);
  if (effectiveVolume <= 0) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);
    gain.gain.setValueAtTime(effectiveVolume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function getSoundtrackGain() {
  const ctx = getAudioCtx();
  if (!soundtrackGain) {
    soundtrackGain = ctx.createGain();
    soundtrackGain.gain.setValueAtTime(0, ctx.currentTime);
    soundtrackGain.connect(ctx.destination);
  }
  syncBackgroundMusic();
  return soundtrackGain;
}

function scheduleMusicVoice(freq, startAt, duration, volume, type, detune = 0) {
  const ctx = getAudioCtx();
  const bus = getSoundtrackGain();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  osc.detune.setValueAtTime(detune, startAt);

  gain.gain.setValueAtTime(MIN_AUDIO_GAIN, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.04);
  gain.gain.exponentialRampToValueAtTime(MIN_AUDIO_GAIN, startAt + duration);

  osc.connect(gain);
  gain.connect(bus);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.05);
}

function scheduleNextSoundtrackBar() {
  if (!soundtrackStarted) return;

  const ctx = getAudioCtx();
  const bar = SOUNDTRACK_PATTERN[soundtrackStep % SOUNDTRACK_PATTERN.length];
  const startAt = ctx.currentTime + 0.08;

  bar.lead.forEach((freq, index) => {
    const noteAt = startAt + index * 0.42;
    scheduleMusicVoice(freq, noteAt, 0.34, 0.08, 'triangle');
    scheduleMusicVoice(freq / 2, noteAt, 0.26, 0.025, 'sine', -3);
  });

  bar.bass.forEach((freq, index) => {
    const noteAt = startAt + index * 0.84;
    scheduleMusicVoice(freq, noteAt, 0.68, 0.09, 'sawtooth');
    scheduleMusicVoice(freq * 1.5, noteAt, 0.32, 0.03, 'triangle');
  });

  soundtrackStep++;
  soundtrackTimer = setTimeout(scheduleNextSoundtrackBar, 1680);
}

function syncBackgroundMusic() {
  if (!soundtrackGain || !audioCtx) return;
  const ctx = getAudioCtx();
  const targetGain = window.audioMuted ? MIN_AUDIO_GAIN : Math.max(MIN_AUDIO_GAIN, (window.audioVolume ?? 1) * SOUNDTRACK_VOLUME_MULTIPLIER);
  soundtrackGain.gain.cancelScheduledValues(ctx.currentTime);
  soundtrackGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.12);
}

function startBackgroundMusic() {
  try {
    getAudioCtx();
    getSoundtrackGain();
    syncBackgroundMusic();
    if (soundtrackStarted) return;
    soundtrackStarted = true;
    scheduleNextSoundtrackBar();
  } catch (e) {}
}

function tryUnlockBackgroundMusic() {
  if (soundtrackStarted) return;
  startBackgroundMusic();
  if (soundtrackStarted) {
    document.removeEventListener('pointerdown', tryUnlockBackgroundMusic);
    document.removeEventListener('keydown', tryUnlockBackgroundMusic);
  }
}

window.startBackgroundMusic = startBackgroundMusic;
window.syncBackgroundMusic = syncBackgroundMusic;
document.addEventListener('pointerdown', tryUnlockBackgroundMusic, { passive: true });
document.addEventListener('keydown', tryUnlockBackgroundMusic);

const Sounds = {
  shoot() { playTone(880, 'square', 0.07, 0.15); },
  explosion(big = false) {
    if (window.audioMuted) return;
    const vol = window.audioVolume ?? 1;
    const ctx = getAudioCtx();
    try {
      const noise = ctx.createOscillator();
      const gain = ctx.createGain();
      noise.type = 'sawtooth';
      noise.frequency.setValueAtTime(big ? 80 : 200, ctx.currentTime);
      noise.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + (big ? 0.6 : 0.25));
      gain.gain.setValueAtTime(big ? 0.5 * vol : 0.3 * vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (big ? 0.6 : 0.25));
      noise.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
      noise.stop(ctx.currentTime + (big ? 0.6 : 0.25));
    } catch (e) {}
  },
  hit() { playTone(440, 'square', 0.08, 0.2); },
  powerup() {
    playTone(440, 'sine', 0.1, 0.25);
    setTimeout(() => playTone(550, 'sine', 0.1, 0.25), 80);
    setTimeout(() => playTone(660, 'sine', 0.15, 0.25), 160);
  },
  levelup() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.15, 0.3), i * 100));
  },
  abilityUse() { playTone(330, 'sawtooth', 0.12, 0.3); },
  die() { playTone(100, 'sawtooth', 0.6, 0.4); }
};

// Each sound plays at most once per window: with 5 gun streams and dozens of
// hits per second, unthrottled oscillators pile up and stutter the frame rate
// on phones, and the extra copies are inaudible anyway.
(function throttleSounds() {
  const gap = { shoot: 70, hit: 45, explosion: 40, coin: 30, powerup: 80 };
  const last = {};
  for (const name of Object.keys(Sounds)) {
    const fn = Sounds[name];
    const min = gap[name] || 0;
    if (!min) continue;
    Sounds[name] = function (...args) {
      const now = performance.now();
      if (now - (last[name] || 0) < min) return;
      last[name] = now;
      return fn.apply(this, args);
    };
  }
})();

// Phones and tablets (touch-first): lighter rendering defaults
const IS_TOUCH_DEVICE = (() => {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch (e) { return false; }
})();
