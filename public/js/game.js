// ===== GALACTIC GAME ENGINE =====
//
// Scoring (normal mode) — built so big scores come from skill, not from luck:
//  · CHAIN   every kill within 2.5s of the last extends the chain. Every 10
//            links add ×0.25 to the multiplier (max ×10). Grazes and boss hits
//            keep it alive; getting hit halves it; letting an enemy escape
//            costs a quarter of it.
//  · GRAZE   an enemy bullet that brushes past the ship's core without hitting
//            it scores, refreshes the chain and charges Overdrive.
//  · MEDALS  dropped by kills. Each one caught in a row is worth more
//            (100 → 10.000); missing one drops the medal level by 3.
//  · OVERDRIVE  fill the meter with kills and grazes, fire it (SPACE / OD):
//            6s of double score, faster piercing shots and magnet pickups.
//  · PERFECT wave without taking damage → bonus.

const CHAIN_WINDOW = 2500;
const MEDAL_VALUES = [100, 200, 300, 500, 800, 1200, 1600, 2000, 3000, 4000, 5000, 6500, 8000, 10000];
const OVERDRIVE_DURATION = 6000;
const SLOT_KEY_MAP = { q: 0, Q: 0, '1': 0, e: 1, E: 1, '2': 1, r: 2, R: 2, '3': 2, f: 3, F: 3, '4': 3 };
const EXTRA_ABILITY_DROP = 0.02;  // owned-but-not-equipped ability → bonus slot
const BOOSTER_DROP = 0.07;        // power-ups are the common drop

class GalacticGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    // Render above the logical 480×700 playfield so everything stays crisp when
    // scaled up: 2× on desktop, 1.5× on phones (about half the pixels to fill).
    const SR = this.sceneRes = (typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE) ? 1.5 : RES;
    this.canvas.width = 480 * SR;
    this.canvas.height = 700 * SR;
    // With WebGL the 2D scene goes to an offscreen canvas and postfx.js builds
    // the final frame (shader background, bloom, shockwaves). Otherwise the
    // 2D renderer draws straight to the visible canvas.
    this.useGL = typeof PostFX !== 'undefined' && PostFX.init(this.canvas);
    if (this.useGL) {
      this.sceneCanvas = document.createElement('canvas');
      this.sceneCanvas.width = 480 * SR;
      this.sceneCanvas.height = 700 * SR;
      this.ctx = this.sceneCanvas.getContext('2d');
    } else {
      this.ctx = this.canvas.getContext('2d');
    }
    SpaceBackground.gpu = this.useGL;
    this.ctx.scale(SR, SR);
    this._lastPresent = performance.now();
    this.hud = new HUD();
    this.animId = null;
    this.lastTime = 0;
    this.gs = null;

    this.background = new SpaceBackground();
    // Legacy starfield — Boss Rush still draws it
    this.stars = this._initStars();

    this.scanlines = this._makeScanlines();
    this.vignette = this._makeVignette();

    this._boundLoop = this._loop.bind(this);
    this._onSurrenderClick = this._onSurrenderClick.bind(this);
    this._setupInput();
    this.surrenderBtn = document.getElementById('btn-surrender');
    if (this.surrenderBtn) this.surrenderBtn.addEventListener('click', this._onSurrenderClick);

    this._resizeCanvas = this._resizeCanvas.bind(this);
    this._resizeCanvas();
    window.addEventListener('resize', this._resizeCanvas);

    // Auto-pause when the tab or window loses focus mid-run
    this._padHeld = new Set();
    this._padPrev = [];
    const autoPause = () => {
      const gs = this.gs;
      if (gs && !gs.gameOver && !gs.paused && !gs.perkChoice) this._pauseToggle();
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
    window.addEventListener('blur', autoPause);
  }

  // ── Adaptive quality ───────────────────────────────────────────────────────
  // If the game runs under ~40 fps for 3 seconds of play, switch to reduced
  // effects for the rest of the session (the saved setting is untouched).
  _adaptQuality(frameMs) {
    const gs = this.gs;
    if (!gs || gs.paused || gs.gameOver || document.hidden || frameMs <= 0 || frameMs > 250) return;
    const settings = window.gameSettings || {};
    if (settings.lowfx || this._autoLow) return;
    this._slowMs = Math.max(0, (this._slowMs || 0) + (frameMs > 25 ? frameMs : -frameMs * 0.5));
    if (this._slowMs > 3000) {
      this._autoLow = true;
      settings.lowfx = true;
      if (gs.floaters) gs.floaters.add(240, 560, 'GRAFICA ALLEGGERITA PER LA FLUIDITÀ', '#9aa3c8', 5, 2200);
    }
  }

  // ── Gamepad ────────────────────────────────────────────────────────────────
  // Standard mapping: stick / d-pad move, RB or RT precise, X Y B abilities,
  // A overdrive (or pick a perk), START pause. Movement is fed through the same
  // key map as the keyboard so both modes (normal, Boss Rush) understand it.
  _pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) {
      for (const k of this._padHeld) this.keys[k] = false;
      this._padHeld.clear();
      this._padPrev = [];
      return;
    }
    const dead = 0.35;
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    const pressed = pad.buttons.map(b => !!(b && b.pressed));
    const want = new Set();
    if (ax < -dead || pressed[14]) want.add('ArrowLeft');
    if (ax > dead || pressed[15]) want.add('ArrowRight');
    if (ay < -dead || pressed[12]) want.add('ArrowUp');
    if (ay > dead || pressed[13]) want.add('ArrowDown');
    if (pressed[5] || pressed[7]) want.add('Shift');
    for (const k of this._padHeld) if (!want.has(k)) this.keys[k] = false;
    for (const k of want) this.keys[k] = true;
    this._padHeld = want;

    const edge = i => pressed[i] && !this._padPrev[i];
    const gs = this.gs;
    this._padPrev = pressed;
    if (!gs) return;
    if (gs.gameOver) {
      if (pressed.some((p, i) => p && !this._padPrevGO?.[i])) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      this._padPrevGO = pressed;
      return;
    }
    this._padPrevGO = pressed;
    if (gs.perkChoice) {
      if (edge(14) || (ax < -0.6 && !this._padStickLatch)) this._perkKey('ArrowLeft');
      if (edge(15) || (ax > 0.6 && !this._padStickLatch)) this._perkKey('ArrowRight');
      this._padStickLatch = Math.abs(ax) > 0.6;
      if (edge(0)) this._perkKey('Enter');
      return;
    }
    if (edge(9)) this._pauseToggle();
    if (gs.paused) return;
    if (edge(2)) this._useAbility(0);
    if (edge(3)) this._useAbility(1);
    if (edge(1)) this._useAbility(2);
    if (edge(4)) this._useAbility(3);
    if (edge(0)) this._activateOverdrive();
  }

  _resizeCanvas() {
    const wrapper = this.canvas.parentElement;
    const availW = wrapper ? wrapper.clientWidth  || window.innerWidth  : window.innerWidth;
    const availH = wrapper ? wrapper.clientHeight || window.innerHeight : window.innerHeight;
    const scale  = Math.min(availW / 480, availH / 700);
    this.canvas.style.width  = `${Math.floor(480 * scale)}px`;
    this.canvas.style.height = `${Math.floor(700 * scale)}px`;
  }

  _makeScanlines() {
    const c = document.createElement('canvas');
    c.width = 480; c.height = 700;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = 0; y < 700; y += 3) x.fillRect(0, y, 480, 1);
    return c;
  }

  _makeVignette() {
    const c = document.createElement('canvas');
    c.width = 480; c.height = 700;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(240, 350, 230, 240, 350, 480);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,12,0.6)');
    x.fillStyle = g;
    x.fillRect(0, 0, 480, 700);
    return c;
  }

  // Kick a brief screen shake. A weaker shake never cuts a stronger one short.
  _shake(mag, dur) {
    const gs = this.gs;
    if (!gs) return;
    if (window.gameSettings && window.gameSettings.shake === false) return;
    if (mag * dur < gs.shakeMag * gs.shakeTime) return;
    gs.shakeMag = mag; gs.shakeTime = dur; gs.shakeDur = dur;
  }

  _initStars() {
    const layers = [
      { count: 50,  speed: 0.5, minSize: 1, maxSize: 1.5, alpha: 0.4 },
      { count: 100, speed: 1.5, minSize: 1, maxSize: 2,   alpha: 0.7 },
      { count: 30,  speed: 3,   minSize: 2, maxSize: 3,   alpha: 1.0 }
    ];
    const stars = [];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        stars.push({
          x: Math.random() * 480,
          y: Math.random() * 700,
          speed: layer.speed,
          size: layer.minSize + Math.random() * (layer.maxSize - layer.minSize),
          alpha: layer.alpha * (0.6 + Math.random() * 0.4)
        });
      }
    }
    return stars;
  }

  _setupInput() {
    this.keys = {};
    this.touchFire = false;

    document.addEventListener('keydown', e => {
      this.keys[e.key] = true;
      if (!this.gs) return;
      // Prevent page scroll on every keydown, auto-repeats included
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (e.repeat) return;
      if (this.gs.perkChoice) { this._perkKey(e.key); return; }
      if (SLOT_KEY_MAP[e.key] !== undefined) this._useAbility(SLOT_KEY_MAP[e.key]);
      if (e.key === ' ' || e.key === 'x' || e.key === 'X') this._activateOverdrive();
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') this._pauseToggle();
    });
    document.addEventListener('keyup', e => { this.keys[e.key] = false; });
    // Releasing keys while the window is unfocused would leave them "stuck"
    window.addEventListener('blur', () => { for (const k in this.keys) this.keys[k] = false; });

    document.querySelectorAll('.touch-ability-btn').forEach(btn => {
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        this._useAbility(parseInt(btn.dataset.slot));
      }, { passive: false });
    });
    const odBtn = document.getElementById('touch-od-btn');
    if (odBtn) {
      odBtn.addEventListener('touchstart', e => { e.preventDefault(); this._activateOverdrive(); }, { passive: false });
    }

    // Perk cards are picked by clicking / tapping them on the canvas
    const pick = e => {
      const gs = this.gs;
      if (!gs || !gs.perkChoice) return;
      const t = e.changedTouches ? e.changedTouches[0] : e;
      const r = this.canvas.getBoundingClientRect();
      const x = (t.clientX - r.left) / r.width * 480;
      const y = (t.clientY - r.top) / r.height * 700;
      const i = this._perkCardAt(x, y);
      if (i !== -1) { e.preventDefault(); this._choosePerk(i); }
    };
    this.canvas.addEventListener('click', pick);
    this.canvas.addEventListener('touchend', pick, { passive: false });

    this.touchActive = false;
    this._setupJoystick();
  }

  // ── Perk choice ────────────────────────────────────────────────────────────

  _perkCardRect(i) {
    const w = 134, h = 196, gap = 10;
    const x0 = (480 - (w * 3 + gap * 2)) / 2;
    return { x: x0 + i * (w + gap), y: 250, w, h };
  }

  _perkCardAt(x, y) {
    const n = this.gs.perkChoice.options.length;
    for (let i = 0; i < n; i++) {
      const r = this._perkCardRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  _perkKey(key) {
    const pc = this.gs.perkChoice;
    const n = pc.options.length;
    if (key === '1' || key === '2' || key === '3') { const i = +key - 1; if (i < n) this._choosePerk(i); return; }
    if (key === 'ArrowLeft' || key === 'a' || key === 'A') pc.hover = (pc.hover + n - 1) % n;
    if (key === 'ArrowRight' || key === 'd' || key === 'D') pc.hover = (pc.hover + 1) % n;
    if (key === 'Enter' || key === ' ') this._choosePerk(pc.hover);
  }

  _choosePerk(i) {
    const gs = this.gs;
    const pc = gs.perkChoice;
    if (!pc || performance.now() - pc.shownAt < 500) return; // no accidental picks
    const id = pc.options[i];
    const def = PERKS[id];
    if (!def) return;
    def.apply(gs);
    gs.perks[id] = (gs.perks[id] || 0) + 1;
    gs.perkChoice = null;
    gs.floaters.add(240, 360, def.name, def.color, 9, 1400);
    gs.particles.emit(gs.player.x, gs.player.y, 30, def.color, { speed: 5, decay: 0.025 });
    Sounds.levelup();
  }

  _renderPerkChoice(ctx, gs, now) {
    const pc = gs.perkChoice;
    ctx.save();
    ctx.globalAlpha = 0.78;
    ctx.fillStyle = '#02030d';
    ctx.fillRect(0, 0, 480, 700);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    this._glowText(ctx, 'SCEGLI UN UPGRADE', 240, 205, 11, '#ffdd33', 18);
    ctx.font = gameFont(5);
    ctx.fillStyle = '#9aa3c8';
    ctx.fillText('Dura per tutta la partita · 1 2 3 / frecce + INVIO / tocca', 240, 226);

    pc.options.forEach((id, i) => {
      const def = PERKS[id];
      const r = this._perkCardRect(i);
      const hot = pc.hover === i;
      const lift = hot ? -6 : 0;
      if (hot) FX.glow(ctx, r.x + r.w / 2, r.y + r.h / 2 + lift, 110, def.color, 0.35 + Math.sin(now * 0.008) * 0.1);
      ctx.fillStyle = 'rgba(8,12,32,0.95)';
      ctx.fillRect(r.x, r.y + lift, r.w, r.h);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = hot ? 2.5 : 1.2;
      ctx.strokeRect(r.x + 0.5, r.y + lift + 0.5, r.w - 1, r.h - 1);

      ctx.font = gameFont(5);
      ctx.fillStyle = '#6f7aa8';
      ctx.fillText(String(i + 1), r.x + 10, r.y + lift + 12);
      const stacks = gs.perks[id] || 0;
      if (def.max > 1) ctx.fillText(`${stacks}/${def.max}`, r.x + r.w - 16, r.y + lift + 12);

      ctx.font = '34px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(def.icon, r.x + r.w / 2, r.y + lift + 64);

      ctx.font = gameFont(6);
      ctx.fillStyle = def.color;
      this._wrapText(ctx, def.name, r.x + r.w / 2, r.y + lift + 96, r.w - 16, 10);
      ctx.font = gameFont(5);
      ctx.fillStyle = '#dfe6ff';
      this._wrapText(ctx, def.desc, r.x + r.w / 2, r.y + lift + 128, r.w - 16, 10);
    });
    ctx.restore();
  }

  _wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = String(text).split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, y); y += lineH; line = w;
      } else line = test;
    }
    if (line) ctx.fillText(line, cx, y);
  }

  // Touch: drag anywhere on the play area and the ship follows the finger's
  // movement 1:1 (relative, so the finger never covers the ship). Buttons keep
  // their own touches.
  _setupDrag() {
    const area = document.getElementById('screen-game');
    if (!area) return;
    let id = null, lx = 0, ly = 0, sx = 0, sy = 0, st = 0;
    const isControl = el => el && el.closest && el.closest('button, .touch-ability-btn, #btn-surrender');
    area.addEventListener('touchstart', e => {
      if (id !== null) return;
      for (const t of e.changedTouches) {
        if (isControl(t.target)) continue;
        id = t.identifier; lx = sx = t.clientX; ly = sy = t.clientY; st = performance.now();
        if (this.gs && !this.gs.gameOver && !this.gs.perkChoice) e.preventDefault();
        break;
      }
    }, { passive: false });
    area.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        const gs = this.gs;
        if (gs && gs.player && !gs.paused) {
          const k = 480 / (this.canvas.getBoundingClientRect().width || 480) * 1.2;
          gs.player.dragDX += (t.clientX - lx) * k;
          gs.player.dragDY += (t.clientY - ly) * k;
        }
        lx = t.clientX; ly = t.clientY;
        e.preventDefault();
      }
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        id = null;
        // A short tap (not a drag) on an ability slot or the Overdrive bar fires it
        if (Math.hypot(t.clientX - sx, t.clientY - sy) < 14 && performance.now() - st < 350) this._hudTap(t.clientX, t.clientY);
      }
    };
    area.addEventListener('touchend', end);
    area.addEventListener('touchcancel', end);
  }

  // Hit-test a tap against the HUD: Q/E/R slots, bonus slot F, Overdrive bar.
  // Rectangles mirror the layout in hud.js.
  _hudTap(clientX, clientY) {
    const gs = this.gs;
    if (!gs || gs.gameOver || gs.paused || gs.perkChoice) return;
    const r = this.canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width * 480;
    const y = (clientY - r.top) / r.height * 700;
    const pad = 6;
    const slotW = 56, gap = 8, bonusW = 40, slotY = 700 - 56 - 8;
    const x0 = (480 - (slotW * 3 + gap * 3 + bonusW)) / 2;
    for (let i = 0; i < 3; i++) {
      const sx = x0 + i * (slotW + gap);
      if (x >= sx - pad && x <= sx + slotW + pad && y >= slotY - pad && y <= slotY + slotW + pad) { this._useAbility(i); return; }
    }
    const bx = x0 + 3 * (slotW + gap);
    if (x >= bx - pad && x <= bx + bonusW + pad && y >= slotY + slotW - bonusW - pad && y <= slotY + slotW + pad) { this._useAbility(3); return; }
    if (x >= 130 && x <= 350 && y >= 596 && y <= 630) this._activateOverdrive();
  }

  _setupJoystick() {
    this._setupDrag();
    const zone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    if (!zone || !stick) return;

    let active = false, startX = 0, startY = 0;
    const maxR = 35;

    const onStart = e => {
      const rect = zone.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
      active = true;
      this.touchActive = true;
      e.preventDefault();
      onMove(e);
    };
    const onMove = e => {
      if (!active) return;
      const t = e.touches ? e.touches[0] : e;
      let dx = t.clientX - startX;
      let dy = t.clientY - startY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > maxR) { dx = dx / d * maxR; dy = dy / d * maxR; }
      stick.style.transform = `translate(${dx}px,${dy}px)`;
      if (this.gs) {
        this.gs.player.joystickVX = dx / maxR;
        this.gs.player.joystickVY = dy / maxR;
      }
      e.preventDefault();
    };
    const onEnd = () => {
      active = false;
      this.touchActive = false;
      stick.style.transform = '';
      if (this.gs) { this.gs.player.joystickVX = 0; this.gs.player.joystickVY = 0; }
    };

    zone.addEventListener('touchstart', onStart, { passive: false });
    zone.addEventListener('touchmove', onMove, { passive: false });
    zone.addEventListener('touchend', onEnd);
    zone.addEventListener('touchcancel', onEnd);
  }

  _makeSlot(ability) {
    if (!ability) return null;
    const level = ability.level || 1;
    return { ...ability, level, cooldown: 0, cooldownMax: getAbilityCooldown(ability.id, level) };
  }

  // `ownedAbilities` accepts either plain ids or the profile's {ability_id, level}
  // rows, so upgraded abilities are actually stronger in play.
  start(abilitySlots = [null, null, null], ownedAbilities = [], skinBoosts = null, skinColor = null, skinTrail = null, skinStripes = null, skinVisual = null, opts = {}) {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.surrenderBtn) {
      this.surrenderBtn.disabled = false;
      this.surrenderBtn.style.display = 'none';
    }

    const player = new Player(480, 700);
    const boosts = skinBoosts || {};
    if (boosts.extra_lives > 0) player.lives += boosts.extra_lives;
    if (boosts.starting_shield) {
      player.shielded    = true;
      player.shieldTimer = 5000;
    }
    player.skinColor = skinColor || null;
    player.skinStripes = skinStripes || null;
    player.visual = skinVisual || null;
    player.bulletColor = (skinVisual && skinVisual.engine) || '#7ff3ff';

    const abilityLevels = {};
    for (const a of ownedAbilities || []) {
      if (typeof a === 'string') abilityLevels[a] = 1;
      else if (a && a.ability_id) abilityLevels[a.ability_id] = a.level || 1;
    }

    this.background = new SpaceBackground();
    this.hud.shownScore = 0;

    this.gs = {
      wave: 1,
      score: 0,
      player,
      enemies: [],
      bullets: [],
      particles: new ParticleSystem(),
      explosions: [],
      powerUps: [],
      pickups: [],
      boosters: [],
      bonusSlot: null,          // extra ability picked up mid-run (key F), single use
      scoreBoostTimer: 0, magnetTimer: 0,
      floaters: new FloatingText(),
      lightnings: [],
      slashes: [],
      boss: null,
      abilitySlots: abilitySlots.map(a => this._makeSlot(a)),
      unlockedAbilityIds: Object.keys(abilityLevels),
      extraAbilityIds: Object.keys(abilityLevels).filter(id => !abilitySlots.some(a => a && a.id === id) && ABILITIES[id] && !ABILITIES[id].boss_rush_only),
      abilityLevels,
      skinBoosts: boosts,
      skinTrail: skinTrail || null,
      trailTimer: 0,
      shakeTime: 0, shakeMag: 0, shakeDur: 1,
      hitFlash: 0,
      screenFlash: 0,
      paused: false,
      gameOver: false,
      waveComplete: false,
      waveCountdown: 0,
      bossWave: false,
      bossRotation: [],
      waveLabel: null,
      sectorLabel: null,
      enemiesKilled: 0,
      coinsCollected: 0,
      gemsCollected: 0,
      waveTotal: 0,
      waveKills: 0,
      waveHit: false,
      waveTime: 0,
      perfectWaves: 0,
      lastWaveBonus: 0,
      spawnQueue: [],
      diveTimer: 2500,
      sway: 0,
      powerScale: 1,
      // chain / score
      chain: 0, chainTimer: 0, maxChain: 0, mult: 1,
      grazes: 0,
      medalLevel: 0, medalsCollected: 0,
      od: 0, odTimer: 0,
      // run perks (picked after each boss)
      perks: {}, perkChoice: null,
      chainWindow: CHAIN_WINDOW, magnetRange: 75, cooldownMult: 1, odGainMult: 1,
      medalMissPenalty: 3, grazeMult: 1, coreChance: 0.10, waveShield: false,
      // ability effects
      timeSlow: false, timeSlowTimer: 0,
      freezeActive: false, freezeTimer: 0, bossFreezeTimer: 0,
      empActive: false, empTimer: 0, bossStunTimer: 0,
      blackHole: null,
      rainOfFire: null,
      storm: null,
      singularity: null,
      turret: null,
      sakuraStorm: null,
      pestoField: null,
      pizza: null,
      abilitiesUsed: 0,
      waveAnnounce: 1800,
      keys: this.keys,
      time: 0,
      bestScore: opts.bestScore || 0,
      recordBroken: false
    };

    this._spawnWave(1);
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.gs = null;
    if (this.surrenderBtn) this.surrenderBtn.disabled = true;
  }

  _onSurrenderClick() {
    if (!this.gs || this.gs.gameOver) return;
    const confirmed = window.confirm('Vuoi arrenderti? Punteggio e progressi verranno salvati.');
    if (!confirmed) return;
    this.gs.paused = false;
    this.gs.gameOver = true;
    this.gs.surrendered = true;
    this._onGameOver();
  }

  _pauseToggle() {
    if (!this.gs || this.gs.gameOver) return;
    this.gs.paused = !this.gs.paused;
    if (this.surrenderBtn) this.surrenderBtn.style.display = this.gs.paused ? 'block' : 'none';
  }

  _loop(now) {
    this.animId = requestAnimationFrame(this._boundLoop);
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;

    if (!this.gs) return;
    this._pollGamepad();
    this._adaptQuality(now - (this._prevFrameAt || now));
    this._prevFrameAt = now;
    if (this.gs.perkChoice && !this.gs.gameOver) {
      this.background.update(dt);
      this.gs.particles.update(dt);
      this.gs.floaters.update(dt);
    } else if (!this.gs.paused && !this.gs.gameOver) this._update(dt, now);
    else if (this.gs.gameOver) {
      // keep the background and the last explosions alive behind the overlay
      this.background.update(dt);
      this.gs.particles.update(dt);
    }
    this._render(now);
  }

  // ── Scoring helpers ────────────────────────────────────────────────────────

  _scoreMult() {
    const gs = this.gs;
    return (gs.skinBoosts?.score_mult || 1) * (gs.odTimer > 0 ? 2 : 1) * (gs.scoreBoostTimer > 0 ? 2 : 1);
  }

  _recalcMult() {
    const gs = this.gs;
    gs.mult = Math.min(10, 1 + Math.floor(gs.chain / 10) * 0.25);
  }

  _extendChain(n = 1) {
    const gs = this.gs;
    const prevMult = gs.mult;
    gs.chain += n;
    gs.chainTimer = 0;
    gs.maxChain = Math.max(gs.maxChain, gs.chain);
    this._recalcMult();
    if (gs.mult > prevMult) {
      this.hud.triggerComboFlash();
      if (gs.mult % 1 === 0) {
        gs.floaters.add(gs.player.x, gs.player.y - 40, `×${gs.mult} CHAIN`, '#ffdd33', 8, 900);
        Sounds.powerup();
      }
    }
  }

  _cutChain(fraction) {
    const gs = this.gs;
    gs.chain = Math.floor(gs.chain * fraction);
    this._recalcMult();
  }

  _addOD(amount) {
    const gs = this.gs;
    if (gs.odTimer > 0) return;
    const was = gs.od;
    gs.od = Math.min(100, gs.od + amount * (gs.odGainMult || 1));
    if (was < 100 && gs.od >= 100) {
      gs.floaters.add(240, 600, 'OVERDRIVE PRONTO!', '#ffcc33', 8, 1400);
      Sounds.levelup();
    }
  }

  _activateOverdrive() {
    const gs = this.gs;
    if (!gs || this._brMode || gs.gameOver || gs.paused) return;
    if (gs.od < 100 || gs.odTimer > 0) return;
    gs.od = 0;
    gs.odTimer = OVERDRIVE_DURATION;
    gs.player.overdrive = true;
    gs.screenFlash = Math.max(gs.screenFlash, 0.5);
    gs.particles.emit(gs.player.x, gs.player.y, 50, '#ffcc33', { speed: 7, decay: 0.02 });
    gs.floaters.add(240, 330, 'OVERDRIVE!', '#ffcc33', 14, 1200);
    this._shake(5, 300);
    Sounds.levelup();
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  _update(dt, now) {
    const dtF = dt / 16.667;
    const gs = this.gs;
    const p = gs.player;
    gs.time += dt;

    this.background.warp += ((gs.waveComplete ? 1 : 0) - this.background.warp) * Math.min(1, dt / 400);
    this.background.update(dt);

    // Auto-fire always
    p.shoot(now, gs.bullets);
    p.update(this.keys, dt, now);

    // Ability cooldowns
    for (const slot of gs.abilitySlots) {
      if (slot && slot.cooldown > 0) {
        slot.cooldown = Math.max(0, slot.cooldown - dt);
        if (slot.cooldown === 0) slot.readyFlash = 400;
      }
      if (slot && slot.readyFlash > 0) slot.readyFlash -= dt;
    }

    if (gs.scoreBoostTimer > 0) gs.scoreBoostTimer = Math.max(0, gs.scoreBoostTimer - dt);
    if (gs.magnetTimer > 0) gs.magnetTimer = Math.max(0, gs.magnetTimer - dt);

    // Overdrive
    if (gs.odTimer > 0) {
      gs.odTimer -= dt;
      if (gs.odTimer <= 0) { gs.odTimer = 0; p.overdrive = false; }
    }

    this._updateAbilityEffects(dt, dtF, now);

    // Bullets (enemy bullets crawl during time slow)
    const enemyDt = gs.timeSlow ? dt * 0.5 : dt;
    const near = [];
    for (let i = gs.bullets.length - 1; i >= 0; i--) {
      const b = gs.bullets[i];
      b.update(b.owner === 'enemy' ? enemyDt : dt, gs.enemies, gs.boss);
      if (b.dead) { gs.bullets.splice(i, 1); continue; }
      if (b.owner === 'enemy') near.push(b);
    }

    this._playerBulletCollisions();
    if (this._enemyBulletCollisions(near)) return;
    this._contactCollisions();

    // Shake / flashes
    if (gs.shakeTime > 0) gs.shakeTime -= dt;
    if (gs.hitFlash > 0) gs.hitFlash = Math.max(0, gs.hitFlash - dt / 400);
    if (gs.screenFlash > 0) gs.screenFlash = Math.max(0, gs.screenFlash - dt / 350);

    // Chain timer — frozen while a wave is being cleared or announced
    if (gs.chain > 0 && !gs.waveComplete && gs.waveAnnounce <= 0) {
      gs.chainTimer += dt;
      if (gs.chainTimer > gs.chainWindow) {
        if (gs.chain >= 20) gs.floaters.add(240, 120, `CHAIN ${gs.chain} PERSA`, '#ff6688', 7, 1000);
        gs.chain = 0; gs.chainTimer = 0;
        this._recalcMult();
      }
    }

    if (gs.waveAnnounce > 0) gs.waveAnnounce -= dt;
    if (!gs.waveComplete) gs.waveTime += dt;

    // Personal best beaten mid-run
    if (!gs.recordBroken && gs.bestScore > 0 && gs.score > gs.bestScore) {
      gs.recordBroken = true;
      gs.floaters.add(240, 300, 'NUOVO RECORD!', '#ffff33', 13, 1800);
      gs.particles.emit(240, 300, 40, '#ffff66', { speed: 6, decay: 0.02 });
      Sounds.levelup();
    }

    // Spawn queue (reinforcements arrive through the wave, not all at once)
    for (let i = gs.spawnQueue.length - 1; i >= 0; i--) {
      const q = gs.spawnQueue[i];
      q.t -= dt;
      if (q.t <= 0) { gs.enemies.push(q.make()); gs.spawnQueue.splice(i, 1); }
    }

    // Formation sway + dives
    gs.sway = Math.sin(gs.time * 0.0011) * 34;
    this._scheduleDives(dt);

    // Enemies
    const spawned = [];
    const world = {
      sway: gs.sway,
      spawn: e => spawned.push(e),
      explode: (x, y, size, color) => { gs.explosions.push(new Explosion(x, y, size, color)); Sounds.explosion(false); },
      enemies: gs.enemies
    };
    for (let i = gs.enemies.length - 1; i >= 0; i--) {
      const e = gs.enemies[i];
      e.update(dt, gs.bullets, gs.timeSlow, p, world);
      if (e.dead) {
        gs.enemies.splice(i, 1);
        if (e.detonated) {
          gs.explosions.push(new Explosion(e.x, e.y, 0.8, '#ffaa22'));
          Sounds.explosion(false);
        } else if (!ENEMY_PASSING_TYPES.has(e.type) && e.y > 700) {
          this._onEnemyEscaped(e);
        }
      } else if (e.hp <= 0) {
        this._killEnemy(e, i);
      }
    }
    if (spawned.length) gs.enemies.push(...spawned);

    // Boss
    if (gs.boss) {
      if (gs.bossStunTimer > 0) { gs.bossStunTimer -= dt; if (gs.bossStunTimer <= 0) gs.boss.stunned = false; }
      if (gs.bossFreezeTimer > 0) { gs.bossFreezeTimer -= dt; if (gs.bossFreezeTimer <= 0) gs.boss.frozen = false; }
      gs.boss.update(dt, gs.bullets, gs.timeSlow, p, world);
      if (spawned.length) { gs.enemies.push(...spawned); spawned.length = 0; }
      if (gs.boss.affectPlayer) {
        // beams, gravity and body contact of the bosses in bosses.js
        const dmg = gs.boss.affectPlayer(p, dt);
        if (dmg > 0 && p.takeDamage(dmg)) {
          this._onPlayerHit(p.x, p.y);
          if (p.hp <= 0) { this._playerDeath(); return; }
        }
      }
      if (gs.boss.hp <= 0) this._killBoss();
      else if (gs.boss.dead) gs.boss = null;
    }

    this._updatePickups(dt);
    this._updateTrail(dt);

    gs.particles.update(dt);
    gs.floaters.update(dt);
    for (let i = gs.explosions.length - 1; i >= 0; i--) {
      gs.explosions[i].update(dt);
      if (gs.explosions[i].dead) gs.explosions.splice(i, 1);
    }
    for (const list of [gs.lightnings, gs.slashes]) {
      for (let i = list.length - 1; i >= 0; i--) { list[i].life -= dt; if (list[i].life <= 0) list.splice(i, 1); }
    }

    // Wave flow
    if (!gs.waveComplete && !gs.bossWave && gs.enemies.length === 0 && gs.spawnQueue.length === 0 && !gs.boss) {
      this._onWaveCleared();
    }
    if (gs.waveComplete) {
      gs.waveCountdown -= dt;
      if (gs.waveCountdown <= 0) {
        gs.waveComplete = false;
        gs.wave++;
        gs.coinsCollected += gs.wave * 10;
        const sector = sectorForWave(gs.wave);
        if (sector !== this.background.sectorIndex) {
          this.background.setSector(sector);
          gs.sectorLabel = `SETTORE ${sector + 1}: ${SECTORS[sector].name}`;
        } else {
          gs.sectorLabel = null;
        }
        if (gs.wave % 5 === 0) {
          gs.bossWave = true;
          this._spawnBoss();
        } else {
          this._spawnWave(gs.wave);
        }
      }
    }
  }

  _updateAbilityEffects(dt, dtF, now) {
    const gs = this.gs;
    const p = gs.player;

    if (gs.timeSlow)    { gs.timeSlowTimer -= dt; if (gs.timeSlowTimer <= 0) gs.timeSlow = false; }
    if (gs.freezeActive){ gs.freezeTimer -= dt; if (gs.freezeTimer <= 0) { gs.freezeActive = false; for (const e of gs.enemies) e.frozen = false; if (gs.boss) gs.boss.frozen = false; } }
    if (gs.empActive)   { gs.empTimer -= dt; if (gs.empTimer <= 0) { gs.empActive = false; for (const e of gs.enemies) e.stunned = false; if (gs.boss) gs.boss.stunned = false; } }

    if (gs.blackHole) {
      const bh = gs.blackHole;
      bh.timer -= dt;
      for (const e of gs.enemies) {
        const dx = bh.x - e.x, dy = bh.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < 220) {
          const pull = (1 - d / 220) * 3.2 + 0.4;
          e.x += (dx / d) * pull * dtF;
          e.y += (dy / d) * pull * dtF;
          e.hit(bh.damage * dtF, 'ability');
        }
      }
      if (gs.boss && Math.hypot(gs.boss.x - bh.x, gs.boss.y - bh.y) < 200) hurt(gs.boss, bh.damage * 0.3 * dtF);
      for (const b of gs.bullets) if (b.owner === 'enemy' && Math.hypot(b.x - bh.x, b.y - bh.y) < 50) b.dead = true;
      if (bh.timer <= 0) gs.blackHole = null;
    }

    if (gs.rainOfFire) {
      const r = gs.rainOfFire;
      r.timer -= dt; r.lastSpawn += dt;
      if (r.lastSpawn >= r.interval) {
        r.lastSpawn = 0;
        const pool = gs.enemies.filter(e => e.y > 0 && e.y < 600);
        const t = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
        const x = t ? t.x + (Math.random() - 0.5) * 20 : 20 + Math.random() * 440;
        gs.bullets.push(new Bullet(x, -10, 0, 9, r.damage, 'player', { style: 'missile' }));
      }
      if (r.timer <= 0) gs.rainOfFire = null;
    }

    if (gs.storm) {
      const st = gs.storm;
      st.timer -= dt; st.lastStrike += dt;
      if (st.lastStrike >= st.interval) {
        st.lastStrike = 0;
        const targets = gs.enemies.filter(e => e.y > 0 && e.y < 700);
        if (gs.boss) targets.push(gs.boss);
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          hurt(t, t === gs.boss ? st.damage * 0.5 : st.damage);
          gs.particles.emit(t.x, t.y, 14, '#ffff66', { speed: 5 });
          const pts = [{ x: t.x + (Math.random() - 0.5) * 60, y: 0 }];
          for (let k = 1; k < 6; k++) pts.push({ x: t.x + (Math.random() - 0.5) * 30 * (1 - k / 6), y: t.y * (k / 6) });
          pts.push({ x: t.x, y: t.y });
          gs.lightnings.push({ pts, life: 160, max: 160, color: '#fff6a8' });
        }
      }
      if (st.timer <= 0) gs.storm = null;
    }

    if (gs.sakuraStorm) {
      const s = gs.sakuraStorm;
      s.timer -= dt; s.lastSpawn += dt;
      if (s.lastSpawn >= s.interval) {
        s.lastSpawn = 0;
        const x = 30 + Math.random() * 420;
        gs.bullets.push(new Bullet(x, 0, (Math.random() - 0.5) * 1.5, 6, s.damage, 'player', { color: '#ff88cc', homing: true }));
        gs.particles.emit(x, 0, 3, '#ff88cc', { speed: 3, decay: 0.025 });
      }
      if (s.timer <= 0) gs.sakuraStorm = null;
    }

    if (gs.pestoField) {
      gs.pestoField.timer -= dt;
      const mult = gs.pestoField.slowMult;
      for (const e of gs.enemies) { e.slowMult = mult; e.slowTimer = 150; }
      if (gs.boss) { gs.boss.slowMult = mult; gs.boss.slowTimer = 150; }
      if (Math.random() < dt / 160) {
        const sp = gs.pestoField.splats[Math.floor(Math.random() * gs.pestoField.splats.length)];
        gs.particles.emit(sp.x, sp.y, 2, '#6dbb3c', { speed: 1, decay: 0.03, gravity: 0.04 });
      }
      if (gs.pestoField.timer <= 0) gs.pestoField = null;
    }

    if (gs.pizza) {
      const pz = gs.pizza;
      pz.timer -= dt;
      pz.y += pz.vy * dtF;
      pz.angle += 0.05 * dtF;
      for (const e of gs.enemies) {
        if (Math.hypot(e.x - pz.x, e.y - pz.y) < pz.radius + e.width / 2) {
          if (!pz.hit.has(e)) {
            pz.hit.add(e);
            e.hit(pz.damage, 'ability');
            gs.particles.emit(e.x, e.y, 10, '#f0b429', { speed: 4, decay: 0.03 });
          }
          e.knockVy = pz.knockback;
          e.knockTimer = 400;
        }
      }
      if (gs.boss && Math.hypot(gs.boss.x - pz.x, gs.boss.y - pz.y) < pz.radius + gs.boss.width / 2) {
        if (!pz.bossHit) {
          pz.bossHit = true;
          hurt(gs.boss, pz.damage);
          gs.particles.emit(gs.boss.x, gs.boss.y, 25, '#f0b429', { speed: 5, decay: 0.025 });
          Sounds.explosion(false);
        }
        gs.boss.knockVy = pz.knockback * 0.6;
        gs.boss.knockTimer = 400;
      }
      for (const b of gs.bullets) if (b.owner === 'enemy' && Math.hypot(b.x - pz.x, b.y - pz.y) < pz.radius) b.dead = true;
      gs.particles.emit(pz.x + (Math.random() - 0.5) * pz.radius, pz.y + pz.radius * 0.5, 1, '#e8532a', { speed: 1, decay: 0.05 });
      if (pz.timer <= 0 || pz.y < -pz.radius) gs.pizza = null;
    }

    if (gs.singularity) {
      const sg = gs.singularity;
      sg.timer -= dt;
      sg.radius = Math.min(sg.maxRadius, sg.radius + sg.growRate * dtF);
      for (const e of gs.enemies) {
        const dx = sg.x - e.x, dy = sg.y - e.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < sg.radius) e.hit(sg.damage * dtF, 'ability');
        const pull = d < sg.radius ? 0.6 : 1.8;
        e.x += (dx / d) * pull * dtF; e.y += (dy / d) * pull * dtF;
      }
      if (gs.boss && Math.hypot(gs.boss.x - sg.x, gs.boss.y - sg.y) < sg.radius + 30) hurt(gs.boss, sg.damage * 0.25 * dtF);
      for (const b of gs.bullets) if (b.owner === 'enemy' && Math.hypot(b.x - sg.x, b.y - sg.y) < sg.radius) b.dead = true;
      if (sg.timer <= 0) gs.singularity = null;
    }

    if (gs.turret) {
      const t = gs.turret;
      t.timer -= dt; t.lastShot += dt;
      const target = this._nearestTarget(t.x, t.y);
      if (target) t.angle = Math.atan2(target.y - t.y, target.x - t.x);
      if (t.lastShot >= t.fireRate && target) {
        t.lastShot = 0;
        gs.bullets.push(new Bullet(t.x, t.y, Math.cos(t.angle) * 9, Math.sin(t.angle) * 9, t.damage, 'player', { color: '#66ffaa' }));
      }
      if (t.timer <= 0) gs.turret = null;
    }

    // Laser: column above the ship
    if (p.laserActive) {
      for (const e of gs.enemies) {
        if (Math.abs(e.x - p.x) < 12 + e.width / 2 && e.y < p.y) {
          e.hit(p.laserDamage * dtF, 'ability');
          if (Math.random() < 0.3) gs.particles.emit(e.x, e.y + e.height / 2, 1, '#ff4477', { speed: 2, decay: 0.1 });
        }
      }
      if (gs.boss && Math.abs(gs.boss.x - p.x) < 34 && gs.boss.y < p.y) {
        hurt(gs.boss, p.laserDamage * dtF);
        gs.chainTimer = 0;
      }
    }

    // Drone
    if (p.droneActive) {
      p.droneLastShot += dt;
      if (p.droneLastShot >= 350) {
        const dx0 = p.x + Math.cos(p.droneAngle) * 50;
        const dy0 = p.y + Math.sin(p.droneAngle) * 50;
        const t = this._nearestTarget(dx0, dy0);
        if (t) {
          p.droneLastShot = 0;
          const a = Math.atan2(t.y - dy0, t.x - dx0);
          gs.bullets.push(new Bullet(dx0, dy0, Math.cos(a) * 9, Math.sin(a) * 9, p.droneDamage, 'player', { color: '#66ffaa' }));
        }
      }
    }

    // Vortex blades: cut enemies and bullets around the ship
    if (p.vortexActive) {
      for (const e of gs.enemies) {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 58 + e.width / 2) {
          e.hit(p.vortexDamage * dtF, 'ability');
          if (Math.random() < 0.3) gs.particles.emit(e.x, e.y, 2, '#00ffff', { speed: 3, decay: 0.06 });
        }
      }
      for (const b of gs.bullets) if (b.owner === 'enemy' && Math.hypot(b.x - p.x, b.y - p.y) < 60) {
        b.dead = true;
        gs.particles.emit(b.x, b.y, 2, '#aaffff', { speed: 2, decay: 0.08 });
      }
    }

    // Reflector: enemy bullets that get close are sent back as player bullets
    if (p.magneticField) {
      for (const b of gs.bullets) {
        if (b.owner !== 'enemy') continue;
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d < 70) {
          b.owner = 'player';
          b.style = 'bolt';
          b.color = '#44ffff';
          b.damage = p.effectiveDamage * 1.5;
          b.vx = (b.x - p.x) / (d || 1) * 3;
          b.vy = -9;
          b.width = 4; b.height = 12;
          gs.particles.emit(b.x, b.y, 3, '#44ffff', { speed: 2, decay: 0.08 });
        }
      }
    }

    // Gravity well: absorb nearby bullets, then release a shockwave
    if (p.gravityWell) {
      for (const b of gs.bullets) {
        if (b.owner === 'enemy' && !b.dead && Math.hypot(b.x - p.x, b.y - p.y) < 90) {
          b.dead = true;
          p.gravityCharge++;
          gs.particles.emit(b.x, b.y, 2, '#cc88ff', { speed: 1.5, decay: 0.08 });
        }
      }
      p.gravityWellTimer -= dt;
      if (p.gravityWellTimer <= 0) {
        p.gravityWell = false;
        const lvl = p.gravityLevel || 1;
        const dmg = abilityDmg(gs, (40 + lvl * 4) * (1 + p.gravityCharge * 0.25));
        const radius = 150 + Math.min(80, p.gravityCharge * 3);
        for (const e of gs.enemies) if (Math.hypot(e.x - p.x, e.y - p.y) < radius) e.hit(dmg, 'ability');
        if (gs.boss && Math.hypot(gs.boss.x - p.x, gs.boss.y - p.y) < radius + 30) hurt(gs.boss, dmg * 0.5);
        gs.explosions.push(new Explosion(p.x, p.y, radius / 45, '#cc66ff'));
        gs.particles.emit(p.x, p.y, 40, '#cc88ff', { speed: 7, decay: 0.025 });
        if (p.gravityCharge > 0) gs.floaters.add(p.x, p.y - 40, `ONDA ×${p.gravityCharge}`, '#cc88ff', 7);
        this._shake(5, 250);
        Sounds.explosion(false);
        p.gravityCharge = 0;
      }
    }
  }

  _nearestTarget(x, y) {
    const gs = this.gs;
    let best = null, bd = Infinity;
    for (const e of gs.enemies) {
      if (e.y < 0 || e.y > 700) continue;
      const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d < bd) { bd = d; best = e; }
    }
    if (gs.boss) {
      const d = (gs.boss.x - x) ** 2 + (gs.boss.y - y) ** 2;
      if (d < bd) best = gs.boss;
    }
    return best;
  }

  _playerBulletCollisions() {
    const gs = this.gs;
    for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
      const b = gs.bullets[bi];
      if (b.owner !== 'player' || b.dead) continue;

      for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
        const e = gs.enemies[ei];
        if (e.hp <= 0 || e.y < -e.height || e.y - e.height / 2 > 700) continue;
        if (!this._rectOverlap(b, e)) continue;
        if (b.piercing) {
          if (!b.hitSet) b.hitSet = new Set();
          if (b.hitSet.has(e)) continue;
          b.hitSet.add(e);
        }
        const dealt = e.hit(b.damage, 'bullet');
        if (dealt <= 0) {
          gs.particles.emit(b.x, b.y, 3, '#88ccff', { speed: 2, decay: 0.08 }); // shield spark
        } else {
          gs.particles.emit(b.x, b.y, 3, '#ffaa55', { speed: 2.5, decay: 0.07, angle: -Math.PI / 2, spread: 2 });
        }
        Sounds.hit();
        if (e.hp <= 0) this._killEnemy(e, ei);
        if (!b.piercing) { b.dead = true; break; }
      }

      if (!b.dead && gs.boss) {
        const boss = gs.boss;
        // Multi-part bosses decide what was hit (weak point, armour, mirror…)
        const part = boss.hitTest ? boss.hitTest(b) : (this._rectOverlap(b, boss) ? boss : null);
        if (part) {
          const dealt = boss.damagePart ? boss.damagePart(part, b.damage, b) : (boss.hp -= b.damage, b.damage);
          if (dealt > 0) {
            gs.chainTimer = Math.max(0, gs.chainTimer - 400);
            gs.particles.emit(b.x, b.y, 3, '#ff66cc', { speed: 3, decay: 0.07 });
            Sounds.hit();
          } else {
            gs.particles.emit(b.x, b.y, 3, '#bfe8ff', { speed: 2.5, decay: 0.09 }); // blocked
          }
          b.dead = true;
          if (boss.hp <= 0) this._killBoss();
        }
      }
    }
  }

  // Returns true if the run ended this frame
  _enemyBulletCollisions(enemyBullets) {
    const gs = this.gs;
    const p = gs.player;
    let close = false;
    for (const b of enemyBullets) {
      if (b.dead || b.owner !== 'enemy') continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < 70) close = true;
      if (d < p.hitRadius + b.radius) {
        b.dead = true;
        if (p.takeDamage(b.damage)) {
          this._onPlayerHit(b.x, b.y);
          if (p.hp <= 0) { this._playerDeath(); return true; }
        }
      } else if (!b.grazed && d < p.grazeRadius && !p.shielded && p.invulnTimer <= 0) {
        // (no grazing while invulnerable: it would be free points)
        b.grazed = true;
        this._onGraze(b);
      }
    }
    p.showHitbox = close || !!(window.gameSettings && window.gameSettings.hitbox);
    return false;
  }

  _contactCollisions() {
    const gs = this.gs;
    const p = gs.player;
    for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
      const e = gs.enemies[ei];
      if (e.hp <= 0) continue;
      const r = e.width / 2 + 8;
      if (Math.abs(e.x - p.x) > r || Math.abs(e.y - p.y) > r) continue;
      if (e.type === 'mine') { e.detonate(gs.bullets); continue; }
      if (p.takeDamage(e.damage)) {
        this._onPlayerHit(e.x, e.y);
        if (e.type === 'kamikaze') {
          e.hp = 0;
          gs.explosions.push(new Explosion(e.x, e.y, 1.3, '#ff5522'));
          gs.enemies.splice(ei, 1);
        } else {
          e.hit(40 * gs.powerScale, 'ability'); // ramming hurts them too
        }
        if (p.hp <= 0) { this._playerDeath(); return; }
      }
    }
  }

  _onPlayerHit(x, y) {
    const gs = this.gs;
    gs.particles.emit(gs.player.x, gs.player.y, 14, '#ff2244', { speed: 4 });
    Sounds.hit();
    this._shake(6, 220);
    gs.hitFlash = 1;
    gs.waveHit = true;
    if (typeof PostFX !== 'undefined') PostFX.kick(1);
    if (gs.chain > 0) {
      this._cutChain(0.5);
      gs.floaters.add(gs.player.x, gs.player.y - 34, 'CHAIN ½', '#ff6688', 7);
    }
  }

  _onGraze(b) {
    const gs = this.gs;
    gs.grazes++;
    gs.chainTimer = 0;
    const pts = Math.round(40 * gs.grazeMult * gs.mult * this._scoreMult());
    gs.score += pts;
    this._addOD(3);
    gs.particles.emit(b.x, b.y, 4, '#ffffff', { speed: 3, decay: 0.08 });
    if (gs.grazes % 10 === 0) gs.floaters.add(gs.player.x + 26, gs.player.y - 10, `GRAZE ${gs.grazes}`, '#bfefff', 5, 600);
  }

  _onEnemyEscaped(e) {
    const gs = this.gs;
    if (gs.chain > 0) {
      this._cutChain(0.75);
      gs.floaters.add(Math.max(40, Math.min(440, e.x)), 680, 'MISS', '#ff6688', 6, 700);
    }
  }

  _rectOverlap(a, b) {
    const aw = (a.width || 4) / 2, ah = (a.height || 10) / 2;
    const bw = (b.width || 20) / 2, bh = (b.height || 20) / 2;
    return Math.abs(a.x - b.x) < aw + bw && Math.abs(a.y - b.y) < ah + bh;
  }

  _killEnemy(enemy, index) {
    const gs = this.gs;
    const idx = gs.enemies[index] === enemy ? index : gs.enemies.indexOf(enemy);
    if (idx === -1) return;
    gs.enemies.splice(idx, 1);

    // Mines are hazards, not ships: a little score, no kill credit
    if (enemy.type === 'mine') {
      gs.score += Math.round(enemy.score * gs.mult * this._scoreMult());
      gs.explosions.push(new Explosion(enemy.x, enemy.y, 0.5, '#ffaa22'));
      gs.chainTimer = 0;
      return;
    }

    gs.enemiesKilled++;
    gs.waveKills++;
    this._extendChain(enemy.elite ? 3 : 1);

    const base = enemy.score * (1 + (gs.wave - 1) * 0.05);
    const pts = Math.round(base * gs.mult * this._scoreMult());
    gs.score += pts;
    gs.coinsCollected += enemy.coinDrop;
    this._addOD(enemy.elite ? 8 : 1.2);
    if (enemy.elite || pts >= 5000) {
      gs.floaters.add(enemy.x, enemy.y, formatNumber(pts), enemy.elite ? '#ffcc33' : '#ffffff', enemy.elite ? 8 : 6);
    }

    const big = enemy.type === 'heavy' || enemy.type === 'minelayer' || enemy.elite;
    gs.explosions.push(new Explosion(enemy.x, enemy.y, big ? 1.4 : 0.9, enemy.elite ? '#ffcc33' : '#ff8a2a'));
    gs.particles.emit(enemy.x, enemy.y, big ? 22 : 12, '#ffb366', { speed: big ? 5 : 4, decay: 0.03 });
    Sounds.explosion(false);
    if (big) this._shake(3, 120);

    // Splitter breaks into fragments
    if (enemy.splitInto && enemy.y < 720) {
      gs.particles.emit(enemy.x, enemy.y, 14, '#33cc55', { speed: 5, decay: 0.03 });
      for (let i = 0; i < enemy.splitInto; i++) {
        const fx = enemy.x + (i === 0 ? -12 : 12);
        gs.enemies.push(new Enemy('fragment', Math.max(20, Math.min(460, fx)), enemy.y, enemy.wave));
      }
    }

    // Drops
    if (Math.random() < enemy.gemDropChance) gs.gemsCollected++;
    if (enemy.elite || Math.random() < gs.coreChance) gs.pickups.push(new Pickup('core', enemy.x, enemy.y));
    if (enemy.elite || Math.random() < 0.18) gs.pickups.push(new Pickup('medal', enemy.x + 6, enemy.y));
    // Power-ups are common; extra abilities (owned, not equipped) are rare
    if (Math.random() < (enemy.elite ? 0.3 : BOOSTER_DROP)) {
      gs.boosters.push(new Booster(enemy.x, enemy.y, rollBooster()));
    } else if (gs.extraAbilityIds.length && Math.random() < (enemy.elite ? 0.1 : EXTRA_ABILITY_DROP)) {
      const abilityId = gs.extraAbilityIds[Math.floor(Math.random() * gs.extraAbilityIds.length)];
      gs.powerUps.push(new PowerUp(enemy.x, enemy.y, abilityId));
    }
  }

  _killBoss() {
    const gs = this.gs;
    if (!gs.boss) return;
    const boss = gs.boss;
    const secs = gs.waveTime / 1000;
    const timeBonus = Math.max(0, Math.round((45 - secs) * 200 * (gs.wave / 5)));
    const pts = Math.round((5000 * gs.wave + timeBonus) * (gs.skinBoosts?.score_mult || 1));
    gs.score += pts;
    gs.coinsCollected += 100;
    gs.gemsCollected++;
    gs.enemiesKilled++;
    this._extendChain(10);
    gs.floaters.add(boss.x, boss.y, `+${formatNumber(pts)}`, '#ff66dd', 12, 1600);
    if (timeBonus > 0) gs.floaters.add(boss.x, boss.y + 22, `TEMPO +${formatNumber(timeBonus)}`, '#ffffff', 6, 1600);

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        if (!this.gs) return;
        this.gs.explosions.push(new Explosion(boss.x + (Math.random() - 0.5) * 70, boss.y + (Math.random() - 0.5) * 50, 1.5, i % 2 ? '#ff66dd' : '#ffaa33'));
        Sounds.explosion(false);
      }, i * 120);
    }
    gs.explosions.push(new Explosion(boss.x, boss.y, 4, '#ff66dd'));
    gs.particles.emit(boss.x, boss.y, 120, '#ff88dd', { speed: 9, decay: 0.012 });
    gs.screenFlash = 0.8;
    Sounds.explosion(true);
    this._shake(14, 700);

    for (let i = 0; i < 6; i++) gs.pickups.push(new Pickup('medal', boss.x + (Math.random() - 0.5) * 60, boss.y));
    for (let i = 0; i < 4; i++) gs.pickups.push(new Pickup('core', boss.x + (Math.random() - 0.5) * 60, boss.y));
    for (let i = 0; i < 2; i++) gs.boosters.push(new Booster(200 + i * 80, 160, rollBooster()));
    if (gs.extraAbilityIds.length > 0) {
      const abilityId = gs.extraAbilityIds[Math.floor(Math.random() * gs.extraAbilityIds.length)];
      gs.powerUps.push(new PowerUp(240, 200, abilityId));
    }

    gs.boss = null;
    gs.bossWave = false;
    gs.spawnQueue = []; // escorts still queued would arrive during the break
    // Enemy bullets left over become harmless sparks
    for (const b of gs.bullets) if (b.owner === 'enemy') { b.dead = true; gs.particles.emit(b.x, b.y, 1, '#ffffff', { speed: 1 }); }
    this._onWaveCleared();
    const offer = rollPerkOffer(gs.perks);
    if (offer.length) gs.perkChoice = { options: offer, hover: 1, shownAt: performance.now() };
  }

  _onWaveCleared() {
    const gs = this.gs;
    gs.waveComplete = true;
    gs.waveCountdown = 2600;
    gs.lastWaveBonus = 0;
    if (!gs.waveHit && gs.waveKills > 0) {
      gs.perfectWaves++;
      gs.lastWaveBonus = Math.round(400 * gs.wave * (gs.skinBoosts?.score_mult || 1));
      gs.score += gs.lastWaveBonus;
    }
    // Everything still on the floor gets pulled in
    for (const pk of gs.pickups) pk.age = Math.max(pk.age, 300);
    gs.vacuum = true;
    Sounds.levelup();
  }

  _playerDeath() {
    const gs = this.gs;
    const p = gs.player;
    gs.particles.emit(p.x, p.y, 50, '#ff2244', { speed: 6, decay: 0.02 });
    gs.explosions.push(new Explosion(p.x, p.y, 2.2, '#ff3355'));
    Sounds.die();
    this._shake(11, 450);
    gs.hitFlash = 1;

    if (p.phoenixReady) {
      p.phoenixReady = false;
      p.hp = p.phoenixHeal;
      p.shielded = true;
      p.shieldTimer = 3000;
      gs.particles.emit(p.x, p.y, 40, '#ff8800', { speed: 5 });
      gs.floaters.add(p.x, p.y - 40, 'RINASCITA!', '#ff8800', 9, 1200);
      Sounds.levelup();
      return;
    }

    p.lives--;
    if (p.lives > 0) {
      p.hp = p.maxHp;
      p.shielded = true;
      p.shieldTimer = 3000;
      p.invulnTimer = 3000;
      p.loseWeaponLevel();
      gs.chain = 0; this._recalcMult();
      // Screen clear so a death doesn't chain into another
      for (const b of gs.bullets) if (b.owner === 'enemy') b.dead = true;
      gs.floaters.add(p.x, p.y - 40, 'ARMA -1', '#ff6688', 7, 1000);
    } else {
      gs.gameOver = true;
      this._onGameOver();
    }
  }

  _updatePickups(dt) {
    const gs = this.gs;
    const p = gs.player;
    const magnetAll = gs.odTimer > 0 || gs.vacuum || gs.magnetTimer > 0;
    for (let i = gs.pickups.length - 1; i >= 0; i--) {
      const pk = gs.pickups[i];
      pk.update(dt, p, magnetAll, gs.magnetRange);
      if (pk.dead) {
        gs.pickups.splice(i, 1);
        if (pk.missed && pk.kind === 'medal' && gs.medalLevel > 0) {
          gs.medalLevel = Math.max(0, gs.medalLevel - gs.medalMissPenalty);
        }
        continue;
      }
      if (!pk.collides(p)) continue;
      gs.pickups.splice(i, 1);
      if (pk.kind === 'medal') {
        const value = Math.round(MEDAL_VALUES[Math.min(gs.medalLevel, MEDAL_VALUES.length - 1)] * this._scoreMult());
        gs.score += value;
        gs.medalLevel++;
        gs.medalsCollected++;
        gs.floaters.add(pk.x, pk.y - 8, formatNumber(value), gs.medalLevel >= MEDAL_VALUES.length ? '#ffffff' : '#ffd23a', 6, 650);
        Sounds.coin ? Sounds.coin() : playTone(1320, 'square', 0.05, 0.08);
      } else {
        if (p.addCore()) {
          if (p.weaponLevel >= WEAPON_MAX_LEVEL) gs.reachedWeaponMax = true;
          gs.floaters.add(p.x, p.y - 44, p.weaponLevel >= WEAPON_MAX_LEVEL ? 'ARMA MAX!' : `ARMA LV ${p.weaponLevel}`, '#ffb366', 9, 1200);
          gs.particles.emit(p.x, p.y, 30, '#ffb366', { speed: 5, decay: 0.025 });
          Sounds.levelup();
        } else if (p.weaponLevel >= WEAPON_MAX_LEVEL) {
          const v = Math.round(1000 * this._scoreMult());
          gs.score += v;
          gs.floaters.add(pk.x, pk.y - 8, formatNumber(v), '#ffb366', 6, 650);
        }
        playTone(660, 'triangle', 0.08, 0.1);
      }
    }
    if (gs.vacuum && gs.pickups.length === 0) gs.vacuum = false;
    if (!gs.waveComplete) gs.vacuum = false;

    // Ability power-ups
    for (let i = gs.powerUps.length - 1; i >= 0; i--) {
      const pu = gs.powerUps[i];
      pu.update(dt);
      if (pu.dead) { gs.powerUps.splice(i, 1); continue; }
      if (!pu.checkCollision(p)) continue;
      gs.powerUps.splice(i, 1);
      const def = ABILITIES[pu.abilityId];
      if (!def) continue;
      const empty = gs.abilitySlots.indexOf(null);
      if (empty !== -1) {
        // Started a run with fewer than 3 equipped: it joins the loadout
        gs.abilitySlots[empty] = this._makeSlot({ ...def, level: gs.abilityLevels[pu.abilityId] || 1 });
        gs.floaters.add(p.x, p.y - 40, def.name.toUpperCase(), RARITY_COLORS[def.rarity] || '#fff', 6, 900);
      } else {
        // Extra ability: one use, in the bonus slot (replaces what was there)
        gs.bonusSlot = { ...def, level: gs.abilityLevels[pu.abilityId] || 1, flash: 600 };
        gs.floaters.add(p.x, p.y - 40, `BONUS: ${def.name.toUpperCase()} [F]`, RARITY_COLORS[def.rarity] || '#fff', 6, 1200);
      }
      Sounds.powerup();
    }

    // Power-ups: act on pickup
    for (let i = gs.boosters.length - 1; i >= 0; i--) {
      const b = gs.boosters[i];
      b.update(dt);
      if (b.dead) { gs.boosters.splice(i, 1); continue; }
      if (!b.collides(p)) continue;
      gs.boosters.splice(i, 1);
      b.def.apply(gs);
      gs.floaters.add(p.x, p.y - 40, b.def.name, b.def.color, 6, 1000);
      gs.particles.emit(b.x, b.y, 14, b.def.color, { speed: 3, decay: 0.04 });
      Sounds.powerup();
    }
    if (gs.bonusSlot && gs.bonusSlot.flash > 0) gs.bonusSlot.flash -= dt;
  }

  _updateTrail(dt) {
    const gs = this.gs;
    if (!gs.skinTrail) return;
    gs.trailTimer += dt;
    const interval = 50;
    if (gs.trailTimer < interval) return;
    gs.trailTimer -= interval;
    const t = gs.skinTrail;
    for (let i = 0; i < t.count; i++) {
      const color = t.colors[Math.floor(Math.random() * t.colors.length)];
      const offsetX = (Math.random() - 0.5) * t.spread;
      gs.particles.emit(gs.player.x + offsetX, gs.player.y + 22, 1, color, {
        speed: t.speed * (0.6 + Math.random() * 0.4),
        size: t.size * (0.7 + Math.random() * 0.6),
        decay: t.decay,
        gravity: 0.05,
        angle: Math.PI / 2, spread: 1.2
      });
    }
  }

  // ── Waves ──────────────────────────────────────────────────────────────────

  _scheduleDives(dt) {
    const gs = this.gs;
    gs.diveTimer -= dt;
    if (gs.diveTimer > 0) return;
    const holders = gs.enemies.filter(e => e.state === 'hold');
    const late = gs.waveTime > 40000; // a wave that drags on gets aggressive
    gs.diveTimer = late ? 450 : Math.max(650, 2400 - gs.wave * 55) * (0.7 + Math.random() * 0.6);
    if (!holders.length) return;
    const n = Math.min(holders.length, 1 + (gs.wave >= 8 ? 1 : 0) + (gs.wave >= 16 ? 1 : 0) + (late ? 1 : 0));
    for (let i = 0; i < n; i++) {
      const k = Math.floor(Math.random() * holders.length);
      holders.splice(k, 1)[0].startDive(gs.player);
    }
  }

  _waveSpecial(wave) {
    if (wave >= 7 && wave % 7 === 0) return 'swarm_rush';
    if (wave >= 8 && Math.random() < 0.3) {
      const pool = ['elite_squad', 'meteor_storm', 'ambush', 'sniper_nest'];
      if (wave >= 9) pool.push('minefield');
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return null;
  }

  _waveFormation(wave) {
    if (wave <= 2) return 'grid';
    const pool = ['grid', 'vee', 'arc', 'columns'];
    if (wave >= 6) pool.push('swarm');
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Formation layouts. For flying formations these are slot positions on
  // screen; for 'columns'/'swarm' they are spawn points above the top edge.
  _formationPositions(formation, count) {
    const pts = [];
    const minX = 50, span = 380;
    switch (formation) {
      case 'vee': {
        const half = (count - 1) / 2;
        for (let i = 0; i < count; i++) {
          const off = i - half;
          pts.push({ x: 240 + off * (span / Math.max(1, count - 1)), y: 90 + Math.abs(off) * 14 });
        }
        break;
      }
      case 'arc': {
        for (let i = 0; i < count; i++) {
          const t = count === 1 ? 0.5 : i / (count - 1);
          const a = Math.PI * (0.12 + 0.76 * t);
          const ring = i % 2;
          pts.push({ x: 240 - Math.cos(a) * (190 - ring * 50), y: 70 + Math.sin(a) * (110 - ring * 40) });
        }
        break;
      }
      case 'columns': {
        const cols = 4;
        for (let i = 0; i < count; i++) {
          const c = i % cols;
          const r = Math.floor(i / cols);
          pts.push({ x: minX + (span / (cols - 1)) * c, y: -40 - r * 52 - c * 20 });
        }
        break;
      }
      case 'swarm': {
        for (let i = 0; i < count; i++) pts.push({ x: minX + Math.random() * span, y: -40 - Math.random() * 300 });
        break;
      }
      case 'grid':
      default: {
        const perRow = 8;
        for (let i = 0; i < count; i++) {
          const row = Math.floor(i / perRow);
          const col = i % perRow;
          const inRow = Math.min(perRow, count - row * perRow);
          const rowSpan = span * ((inRow - 1) / (perRow - 1));
          const x = inRow > 1 ? 240 - rowSpan / 2 + col * (rowSpan / (inRow - 1)) : 240;
          pts.push({ x, y: 75 + row * 38 });
        }
        break;
      }
    }
    return pts;
  }

  _eliteChance(wave, special) {
    const base = Math.min(0.02 + wave * 0.004, 0.18);
    return special === 'elite_squad' ? Math.min(0.6, base * 4 + 0.1) : base;
  }

  _spawnWave(wave) {
    const gs = this.gs;
    const p = gs.player;
    gs.enemies = [];
    gs.spawnQueue = [];
    gs.waveAnnounce = 1800;
    gs.waveKills = 0;
    gs.waveHit = false;
    gs.waveTime = 0;
    gs.diveTimer = 3000;
    gs.powerScale = enemyWaveMult(wave);
    p.dmgScale = 1 + (wave - 1) * 0.05;
    if (gs.waveShield) { p.shielded = true; p.shieldTimer = Math.max(p.shieldTimer, 3000); }

    const special = this._waveSpecial(wave);
    const formation = special === 'swarm_rush' ? 'swarm' : this._waveFormation(wave);
    let count = Math.min(5 + wave * 2, 40);
    if (special === 'swarm_rush') count = Math.min(count + 6, 46);
    if (special === 'meteor_storm' || special === 'sniper_nest') count = Math.ceil(count * 0.6);
    const eliteP = this._eliteChance(wave, special);
    const isElite = () => Math.random() < eliteP;

    const LABELS = {
      swarm_rush: 'SCIAME IN ARRIVO', elite_squad: 'SQUADRA ÉLITE', meteor_storm: 'TEMPESTA DI METEORE',
      ambush: 'IMBOSCATA DAI LATI', sniper_nest: 'NIDO DI CECCHINI', minefield: 'CAMPO MINATO'
    };
    gs.waveLabel = LABELS[special] || null;

    const flying = formation === 'grid' || formation === 'vee' || formation === 'arc';
    const positions = this._formationPositions(formation, count);
    positions.forEach((pos, i) => {
      const type = special === 'swarm_rush'
        ? (Math.random() < 0.75 ? 'weaver' : 'basic')
        : this._pickGridEnemyType(wave, flying);
      const x = Math.max(24, Math.min(456, pos.x));
      if (flying) {
        // Enter from above in a sweeping stream, alternating sides
        const fromLeft = i % 2 === 0;
        const sx = fromLeft ? -30 - (i % 4) * 10 : 510 + (i % 4) * 10;
        gs.enemies.push(new Enemy(type, sx, -20 - (i % 5) * 18, wave, {
          slot: { x, y: pos.y }, entryDelay: i * 90, elite: isElite()
        }));
      } else {
        gs.enemies.push(new Enemy(type, x, pos.y, wave, { elite: isElite() }));
      }
    });

    // Reinforcements, staggered through the wave
    const q = (t, type, x, y, opts = {}) => gs.spawnQueue.push({
      t, make: () => new Enemy(type, x, y, wave, { elite: isElite(), ...opts })
    });
    const rx = () => 50 + Math.random() * 380;

    if (special !== 'swarm_rush') {
      const shooters = Math.min(1 + Math.floor((wave - 1) / 2), 5);
      for (let i = 0; i < shooters; i++) q(1500 + i * 2200, 'shooter', rx(), -40);
    }
    if (wave >= 4) {
      const n = Math.min(1 + Math.floor((wave - 4) / 3), 4);
      for (let i = 0; i < n; i++) q(4000 + i * 2600, 'kamikaze', rx(), -30);
    }
    if (wave >= 5) {
      const n = Math.min(1 + Math.floor((wave - 5) / 3), 3);
      for (let i = 0; i < n; i++) q(6000 + i * 3000, 'dasher', rx(), -40);
    }
    if (wave >= 7) {
      const n = Math.min(1 + Math.floor((wave - 7) / 4), 3);
      for (let i = 0; i < n; i++) q(3000 + i * 4000, 'shielder', rx(), -40);
    }
    if (wave >= 8 || special === 'sniper_nest') {
      const n = special === 'sniper_nest' ? 4 : Math.min(1 + Math.floor((wave - 8) / 6), 3);
      for (let i = 0; i < n; i++) q(2000 + i * 2500, 'sniper', 60 + (i * 110) % 360, -40);
    }
    if ((wave >= 9 && wave % 3 === 0) || special === 'minefield') {
      const n = special === 'minefield' ? 3 : (wave >= 20 ? 2 : 1);
      for (let i = 0; i < n; i++) {
        const left = i % 2 === 0;
        q(2500 + i * 3500, 'minelayer', left ? -30 : 510, 130 + Math.random() * 120);
      }
    }
    if (wave >= 11 || special === 'ambush') {
      const pairs = special === 'ambush' ? 4 : Math.min(1 + Math.floor((wave - 11) / 5), 3);
      for (let i = 0; i < pairs; i++) {
        const y = 160 + Math.random() * 220;
        q(special === 'ambush' ? 800 + i * 1400 : 7000 + i * 3000, 'flanker', -30, y);
        q(special === 'ambush' ? 800 + i * 1400 : 7000 + i * 3000, 'flanker', 510, y + 40);
      }
    }
    if (special === 'meteor_storm') {
      const n = 14 + Math.floor(wave / 2);
      for (let i = 0; i < n; i++) q(500 + i * 650, 'meteor', rx(), -40, { elite: false });
    }

    gs.waveTotal = gs.enemies.length + gs.spawnQueue.length;
    gs.bossWave = false;
  }

  // Weighted pick of the main body of a wave. Flying formations only use the
  // types that know how to hold a slot.
  _pickGridEnemyType(wave, flying) {
    const weights = [['basic', 100]];
    if (wave >= 2) weights.push(['weaver', flying ? 0 : 30]);
    if (wave >= 3) weights.push(['medium', 45]);
    if (wave >= 4) weights.push(['splitter', 25]);
    if (wave >= 6) weights.push(['heavy', flying ? 0 : 30]);
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [type, w] of weights) {
      r -= w;
      if (r <= 0) return type;
    }
    return 'basic';
  }

  // Boss HP follows the player's measured damage curve: ~15–20s per boss
  // with the weapon level a player typically has at that wave.
  _bossHp(wave) {
    return Math.round(900 * Math.pow(wave / 5, 1.25));
  }

  // Boss roster: 1 classic + 5 cosmic + 6 mega bosses. Wave 5 draws from the
  // gentler three; from wave 10 a shuffled bag deals every boss once before
  // any repeats (and never the same one twice in a row).
  _bossRoster() {
    const list = [];
    if (typeof createCosmicBoss === 'function') {
      for (let i = 0; i < 5; i++) list.push({ id: 'cosmic' + i, make: w => { const b = createCosmicBoss(i); b.scaleForWave(w); b.showHealthBar = false; return b; } });
    }
    if (typeof MEGA_BOSSES !== 'undefined') {
      MEGA_BOSSES.forEach((Cls, i) => list.push({ id: 'mega' + i, make: w => new Cls(w) }));
    }
    return list;
  }

  _pickBoss(wave) {
    const gs = this.gs;
    if (wave < 10) {
      const early = [{ id: 'classic', make: w => new Boss(w) }];
      if (typeof MEGA_BOSSES !== 'undefined') early.push({ id: 'mega0', make: w => new MEGA_BOSSES[0](w) }, { id: 'mega1', make: w => new MEGA_BOSSES[1](w) });
      const pick = early[Math.floor(Math.random() * early.length)];
      gs.lastBossId = pick.id;
      return pick.make(wave);
    }
    const roster = this._bossRoster();
    if (!roster.length) return new Boss(wave);
    if (!gs.bossBag || !gs.bossBag.length) {
      gs.bossBag = roster.map(r => r.id);
      for (let i = gs.bossBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gs.bossBag[i], gs.bossBag[j]] = [gs.bossBag[j], gs.bossBag[i]];
      }
      if (gs.bossBag[gs.bossBag.length - 1] === gs.lastBossId && gs.bossBag.length > 1) {
        gs.bossBag.unshift(gs.bossBag.pop());
      }
    }
    const id = gs.bossBag.pop();
    gs.lastBossId = id;
    return roster.find(r => r.id === id).make(wave);
  }

  _spawnBoss() {
    const gs = this.gs;
    gs.enemies = [];
    gs.spawnQueue = [];
    gs.waveAnnounce = 1800;
    gs.waveKills = 0;
    gs.waveHit = false;
    gs.waveTime = 0;
    gs.waveLabel = null;
    gs.powerScale = enemyWaveMult(gs.wave);
    gs.player.dmgScale = 1 + (gs.wave - 1) * 0.05;

    gs.boss = this._pickBoss(gs.wave);
    gs.boss.maxHp = gs.boss.hp = Math.round(this._bossHp(gs.wave) * (gs.boss.hpScale || 1));
    gs.waveTotal = 1;

    // From wave 15 the boss brings an escort of kamikazes
    if (gs.wave >= 15) {
      const n = Math.min(2 + Math.floor((gs.wave - 15) / 10), 5);
      for (let i = 0; i < n; i++) {
        gs.spawnQueue.push({ t: 6000 + i * 5000, make: () => new Enemy('kamikaze', 60 + Math.random() * 360, -30, gs.wave) });
      }
    }
  }

  _useAbility(slot) {
    const gs = this.gs;
    if (!gs || gs.gameOver || gs.paused || gs.perkChoice) return;
    if (slot === 3) {
      const bonus = gs.bonusSlot;
      if (!bonus || !ABILITIES[bonus.id]) return;
      ABILITIES[bonus.id].apply(gs, bonus.level || 1);
      gs.bonusSlot = null;
      gs.abilitiesUsed++;
      gs.floaters.add(gs.player.x, gs.player.y - 46, bonus.name.toUpperCase(), RARITY_COLORS[bonus.rarity] || '#ffffff', 6, 700);
      Sounds.abilityUse();
      return;
    }
    const ability = gs.abilitySlots[slot];
    if (!ability) return;
    if (ability.cooldown > 0) { playTone(180, 'square', 0.06, 0.06); return; }
    const def = ABILITIES[ability.id];
    if (!def) return;
    def.apply(gs, ability.level || 1);
    ability.cooldownMax = getAbilityCooldown(ability.id, ability.level || 1) * gs.cooldownMult;
    ability.cooldown = ability.cooldownMax;
    gs.abilitiesUsed++;
    gs.floaters.add(gs.player.x, gs.player.y - 46, def.name.toUpperCase(), RARITY_COLORS[def.rarity] || '#ffffff', 6, 700);
    Sounds.abilityUse();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  _drawPestoField(ctx, field) {
    const fade = Math.min(1, field.timer / 1000);
    ctx.save();
    for (const sp of field.splats) {
      ctx.globalAlpha = 0.32 * fade;
      ctx.fillStyle = '#3f8f26';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = sp.rot + (i / 4) * Math.PI * 2;
        ctx.globalAlpha = 0.22 * fade;
        ctx.fillStyle = '#6dbb3c';
        ctx.beginPath();
        ctx.arc(sp.x + Math.cos(a) * sp.r * 0.8, sp.y + Math.sin(a) * sp.r * 0.7, sp.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawPizza(ctx, pz) {
    ctx.save();
    ctx.translate(pz.x, pz.y);
    ctx.rotate(pz.angle);
    ctx.fillStyle = '#c98b3a';
    ctx.beginPath(); ctx.arc(0, 0, pz.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.arc(0, 0, pz.radius * 0.82, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8532a';
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(0, 0, pz.radius * 0.82, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const d = pz.radius * (i % 2 === 0 ? 0.5 : 0.28);
      ctx.fillStyle = '#c0221c';
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, pz.radius * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f8f26';
      ctx.beginPath(); ctx.arc(Math.cos(a + 0.4) * pz.radius * 0.68, Math.sin(a + 0.4) * pz.radius * 0.68, pz.radius * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    FX.glow(ctx, pz.x, pz.y, pz.radius * 1.4, '#ffaa33', 0.35);
  }

  _drawLightning(ctx, l) {
    const k = l.life / l.max;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[6, 0.25], [2.5, 0.9]]) {
      ctx.strokeStyle = l.color;
      ctx.globalAlpha = a * k;
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i < l.pts.length - 1; i++) {
        const p0 = l.pts[i], p1 = l.pts[i + 1];
        if (i === 0) ctx.moveTo(p0.x, p0.y);
        // jagged midpoints
        const mx = (p0.x + p1.x) / 2 + (Math.random() - 0.5) * 18;
        const my = (p0.y + p1.y) / 2 + (Math.random() - 0.5) * 18;
        ctx.lineTo(mx, my);
        ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _render(now) {
    const ctx = this.ctx;
    const gs = this.gs;
    ctx.clearRect(0, 0, 480, 700);

    this.background.draw(ctx);
    if (!gs) return;

    let shaking = false;
    if (gs.shakeTime > 0) {
      const k = gs.shakeMag * Math.max(0, gs.shakeTime / gs.shakeDur);
      ctx.save();
      ctx.translate((Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k);
      shaking = true;
    }

    if (gs.singularity) {
      const sg = gs.singularity;
      ctx.save();
      const g = ctx.createRadialGradient(sg.x, sg.y, 0, sg.x, sg.y, sg.radius * 1.3);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(10,0,20,0.95)');
      g.addColorStop(0.75, 'rgba(120,40,200,0.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sg.x, sg.y, sg.radius * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,140,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sg.x, sg.y, sg.radius * 0.75, now * 0.004, now * 0.004 + Math.PI * 1.5); ctx.stroke();
      ctx.restore();
    }

    if (gs.blackHole) {
      const bh = gs.blackHole;
      FX.glow(ctx, bh.x, bh.y, 90, '#8833ff', 0.6);
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(bh.x, bh.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(200,120,255,0.8)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = now * 0.006 + i * 2.1;
        ctx.beginPath(); ctx.arc(bh.x, bh.y, 34 + i * 10, a, a + 1.2); ctx.stroke();
      }
      ctx.restore();
    }

    if (gs.pestoField) this._drawPestoField(ctx, gs.pestoField);

    for (const pk of gs.pickups) pk.draw(ctx);
    for (const pu of gs.powerUps) pu.draw(ctx);
    for (const b of gs.boosters) b.draw(ctx);
    for (const e of gs.enemies) e.draw(ctx);
    if (gs.boss) gs.boss.draw(ctx);
    if (gs.pizza) this._drawPizza(ctx, gs.pizza);

    if (gs.turret) {
      const t = gs.turret;
      FX.glow(ctx, t.x, t.y, 22, '#00ff88', 0.5);
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = '#0a3a22';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#66ffaa'; ctx.lineWidth = 2; ctx.stroke();
      ctx.rotate(t.angle);
      ctx.fillStyle = '#c8ffe0';
      ctx.fillRect(0, -2.5, 15, 5);
      ctx.restore();
    }

    // Player bullets under enemy bullets: what can hurt you must always read
    for (const b of gs.bullets) if (b.owner === 'player') b.draw(ctx);
    for (const ex of gs.explosions) ex.draw(ctx);
    gs.particles.draw(ctx);
    for (const s of gs.slashes) {
      const k = s.life / s.max;
      FX.glow(ctx, s.x, 350, 40, '#ff5522', k * 0.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,120,60,${k * 0.5})`;
      ctx.fillRect(s.x - s.w * k, 0, s.w * 2 * k, gs.player.y);
      ctx.fillStyle = `rgba(255,255,255,${k})`;
      ctx.fillRect(s.x - 1.5, 0, 3, gs.player.y);
      ctx.restore();
    }
    for (const l of gs.lightnings) this._drawLightning(ctx, l);

    if (!gs.gameOver) gs.player.draw(ctx);
    for (const b of gs.bullets) if (b.owner === 'enemy') b.draw(ctx);
    gs.floaters.draw(ctx);

    if (shaking) ctx.restore();

    // Overdrive frame
    if (gs.odTimer > 0) {
      const a = 0.25 + Math.sin(now * 0.012) * 0.1;
      ctx.save();
      const g = ctx.createRadialGradient(240, 350, 220, 240, 350, 470);
      g.addColorStop(0, 'rgba(255,200,50,0)');
      g.addColorStop(1, `rgba(255,190,40,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 480, 700);
      ctx.restore();
    }

    if (gs.hitFlash > 0) {
      ctx.save();
      const fg = ctx.createRadialGradient(240, 350, 170, 240, 350, 470);
      fg.addColorStop(0, 'rgba(255,0,40,0)');
      fg.addColorStop(1, `rgba(255,0,40,${gs.hitFlash * 0.7})`);
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, 480, 700);
      ctx.restore();
    }
    if (gs.screenFlash > 0) {
      ctx.save();
      ctx.globalAlpha = gs.screenFlash * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 480, 700);
      ctx.restore();
    }

    if (!gs.gameOver) this.hud.draw(ctx, gs);

    if (gs.perkChoice && !gs.gameOver) this._renderPerkChoice(ctx, gs, now);
    else this._renderAnnouncements(ctx, gs, now);

    if (gs.paused) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#000022';
      ctx.fillRect(0, 0, 480, 700);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = gameFont(20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PAUSA', 240, 330);
      ctx.font = gameFont(7);
      ctx.fillStyle = '#aab4d8';
      const lines = ['FRECCE / WASD  muovi', 'SHIFT  precisione', 'Q E R  abilità · F bonus', 'SPAZIO  overdrive', 'ESC  riprendi'];
      lines.forEach((l, i) => ctx.fillText(l, 240, 370 + i * 18));
      ctx.restore();
    }

    if (gs.gameOver) this._renderGameOver(ctx, gs);

    if (this.useGL) { this._present(); return; }
    ctx.drawImage(this.vignette, 0, 0);
    if (!(window.gameSettings && window.gameSettings.lowfx)) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.drawImage(this.scanlines, 0, 0);
      ctx.restore();
    }
  }

  // Hand the finished 2D scene to the WebGL compositor
  _present() {
    if (!this.useGL) return;
    const now = performance.now();
    const dt = Math.min(50, now - this._lastPresent);
    this._lastPresent = now;
    PostFX.present(this.sceneCanvas, this.background, dt, now);
  }

  _glowText(ctx, text, x, y, size, color, blur = 16) {
    ctx.font = gameFont(size);
    ctx.fillStyle = color;
    ctx.shadowColor = color; ctx.shadowBlur = blur;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  _renderAnnouncements(ctx, gs, now) {
    if (gs.gameOver) return;
    ctx.save();
    ctx.textAlign = 'center';

    if (gs.waveAnnounce > 0 && !gs.waveComplete) {
      const t = gs.waveAnnounce;
      ctx.globalAlpha = Math.min(1, t / 500);
      const slide = Math.max(0, (t - 1500) / 300) * 40;
      this._glowText(ctx, `WAVE ${gs.wave}`, 240 - slide, 320, 22, '#ffffff', 30);
      let y = 352;
      if (gs.sectorLabel) {
        this._glowText(ctx, gs.sectorLabel, 240, y, 7, SECTORS[this.background.sectorIndex].star, 12);
        y += 22;
      }
      if (gs.bossWave || gs.wave % 5 === 0) {
        this._glowText(ctx, '⚠ BOSS IN ARRIVO', 240, y, 10, '#ff3388', 18);
      } else if (gs.waveLabel) {
        this._glowText(ctx, gs.waveLabel, 240, y, 9, '#00e0c0', 15);
      }
    }

    if (gs.waveComplete) {
      const pulse = 0.5 + Math.sin(now * 0.005) * 0.15;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#000022';
      ctx.fillRect(0, 262, 480, 170);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(40, 268); ctx.lineTo(440, 268); ctx.moveTo(40, 426); ctx.lineTo(440, 426); ctx.stroke();
      ctx.shadowBlur = 0;
      const scale = 1 + Math.sin(now * 0.008) * 0.05;
      this._glowText(ctx, gs.lastWaveBonus > 0 ? 'PERFETTO!' : 'WAVE CLEAR!', 240, 310, Math.round(18 * scale), gs.lastWaveBonus > 0 ? '#ffdd33' : '#00ffff', 25);
      ctx.font = gameFont(8);
      ctx.fillStyle = '#ffff66';
      ctx.fillText(`+${gs.wave * 10} MONETE`, 240, 342);
      let y = 362;
      if (gs.lastWaveBonus > 0) {
        ctx.fillStyle = '#ffdd33';
        ctx.fillText(`NESSUN DANNO +${formatNumber(gs.lastWaveBonus)}`, 240, y); y += 18;
      }
      if (gs.chain > 0) {
        ctx.fillStyle = '#ff9944';
        ctx.fillText(`CHAIN ${gs.chain}  ×${gs.mult.toFixed(2)}`, 240, y); y += 18;
      }
      ctx.font = gameFont(6);
      ctx.fillStyle = '#9aa3c8';
      ctx.fillText(`WAVE ${gs.wave + 1} TRA ${(gs.waveCountdown / 1000).toFixed(1)}s`, 240, 414);
    }
    ctx.restore();
  }

  _renderGameOver(ctx, gs) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, 480, 700);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    this._glowText(ctx, 'GAME OVER', 240, 200, 22, '#ff2244', 22);

    ctx.font = gameFont(12);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(formatNumber(gs.score), 240, 245);
    ctx.font = gameFont(5);
    ctx.fillStyle = '#6f7aa8';
    ctx.fillText('PUNTEGGIO', 240, 258);

    const rows = [
      ['WAVE', gs.wave],
      ['UCCISIONI', gs.enemiesKilled],
      ['CHAIN MAX', gs.maxChain],
      ['GRAZE', gs.grazes],
      ['MEDAGLIE', gs.medalsCollected],
      ['WAVE PERFETTE', gs.perfectWaves],
      ['UPGRADE', Object.values(gs.perks).reduce((a, b) => a + b, 0)]
    ];
    ctx.font = gameFont(7);
    rows.forEach(([k, v], i) => {
      const y = 290 + i * 18;
      ctx.textAlign = 'left'; ctx.fillStyle = '#9aa3c8'; ctx.fillText(k, 120, y);
      ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.fillText(String(v), 360, y);
    });
    ctx.textAlign = 'center';
    let y = 430;
    if (gs.coinsEarned !== undefined) {
      ctx.fillStyle = '#ffff00';
      ctx.fillText(`+${formatNumber(gs.coinsEarned)} MONETE`, 240, y); y += 18;
    }
    if (gs.gemsEarned !== undefined && gs.gemsEarned > 0) {
      ctx.fillStyle = '#00ffff';
      ctx.fillText(`+${gs.gemsEarned} GEMME`, 240, y); y += 18;
    }
    if (gs.newRecord) {
      this._glowText(ctx, 'NUOVO RECORD!', 240, y + 8, 11, '#ffff00', 12);
      y += 26;
    }
    if (gs.newAchievements && gs.newAchievements.length) {
      ctx.font = gameFont(6);
      ctx.fillStyle = '#ffcc33';
      gs.newAchievements.slice(0, 3).forEach((a, i) => ctx.fillText(`★ TROFEO: ${a.name.toUpperCase()}`, 240, y + 6 + i * 13));
      if (gs.newAchievements.length > 3) {
        ctx.fillStyle = '#9aa3c8';
        ctx.fillText(`+${gs.newAchievements.length - 3} ALTRI TROFEI (PROFILO)`, 240, y + 6 + 3 * 13);
      }
    }
    ctx.font = gameFont(7);
    ctx.fillStyle = '#00ffff';
    ctx.fillText('TOCCA / PREMI UN TASTO', 240, 560);
    ctx.restore();
  }

  async _onGameOver() {
    const gs = this.gs;
    if (this.surrenderBtn) {
      this.surrenderBtn.disabled = true;
      this.surrenderBtn.style.display = 'none';
    }
    gs.player.overdrive = false;

    const token = getToken();
    if (token) {
      const res = await apiFetch('/game/save-score', {
        method: 'POST',
        body: JSON.stringify({
          score: gs.score,
          wave: gs.wave,
          enemiesKilled: gs.enemiesKilled,
          gemsCollected: gs.gemsCollected,
          abilitiesUsed: gs.abilitiesUsed || 0,
          maxChain: gs.maxChain,
          perfectWaves: gs.perfectWaves,
          grazes: gs.grazes,
          medals: gs.medalsCollected,
          weaponMax: gs.reachedWeaponMax === true
        })
      });
      if (res.success) {
        if (res.data.newMaxScore >= gs.score && gs.score > 0) gs.newRecord = true;
        gs.coinsEarned = res.data.coinsEarned;
        gs.gemsEarned  = res.data.gemsEarned;
        gs.newAchievements = (res.data.newAchievements || [])
          .map(id => (typeof ACHIEVEMENT_DEFS !== 'undefined' && ACHIEVEMENT_DEFS.find(a => a.id === id)) || { name: id });
      }
    }

    const returnHandler = () => {
      document.removeEventListener('keydown', returnHandler);
      this.canvas.removeEventListener('click', returnHandler);
      this.canvas.removeEventListener('touchend', returnHandler);
      this.stop();
      if (window.showMainMenu) window.showMainMenu();
    };
    setTimeout(() => {
      document.addEventListener('keydown', returnHandler);
      this.canvas.addEventListener('click', returnHandler);
      this.canvas.addEventListener('touchend', returnHandler);
    }, 1500);
  }
}

// Global instance
let gameInstance = null;

function startGame(abilitySlots, ownedAbilities, skinBoosts, skinColor, skinTrail, skinStripes, skinVisual, opts) {
  if (!gameInstance) gameInstance = new GalacticGame();
  gameInstance.start(abilitySlots || [null, null, null], ownedAbilities || [], skinBoosts || null, skinColor || null, skinTrail || null, skinStripes || null, skinVisual || null, opts || {});
}

function stopGame() {
  if (gameInstance) gameInstance.stop();
}
