// ===== MEGA BOSSES (normal mode) =====
//
// Six bosses that each add a mechanic on top of their bullet patterns:
//   Regina dell'Alveare  summons drone swarms, acid spirals
//   Gemelli Siderali     two pods joined by a laser that sweeps down the screen
//                        with a gap to slip through
//   Leviatano            segmented serpent; the head is the weak point
//   Nucleo Specchio      rotating mirrors block (phase 2: reflect) your shots,
//                        twin rotating lasers
//   Stella Nera          gravity pulls you in; rings and an orbiting corona
//   Corazzata d'Assedio  four turrets to destroy before the core opens
//
// Interface used by game.js on top of the usual boss fields:
//   update(dt, bullets, timeSlow, player, world)
//   hitTest(bullet) → part | null,  damagePart(part, dmg, bullet) → dealt
//   affectPlayer(player, dt) → contact/beam damage (0 for none)
// world = { spawn(enemy), explode(x, y, size, color), enemies }

function _shoot(bullets, x, y, a, sp, dmg, opts) {
  const b = new Bullet(x, y, Math.cos(a) * sp, Math.sin(a) * sp, dmg, 'enemy', opts);
  bullets.push(b);
  return b;
}
function _ring(bullets, x, y, n, sp, dmg, off = 0, opts, gapEvery = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (gapEvery && i % gapEvery === 0) continue;
    out.push(_shoot(bullets, x, y, off + (i / n) * Math.PI * 2, sp, dmg, opts));
  }
  return out;
}
function _aim(x, y, p) { return p ? Math.atan2(p.y - y, p.x - x) : Math.PI / 2; }
function _segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Forged sprites, built once on first use
const BossArt = (function () {
  const cache = {};
  function make(key, w, h, draw, material) {
    if (cache[key]) return cache[key];
    const { c, ctx } = FX.makeCanvas(w, h, RES * 2);
    ctx.translate(w / 2, h / 2);
    draw(ctx);
    cache[key] = SpriteForge.forge(c, { bevel: Math.max(6, Math.min(w, h) * 0.16), ...(material || {}) });
    return cache[key];
  }
  function poly(ctx, pts, c1, c2, outline) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 1.4; ctx.strokeStyle = outline; ctx.stroke();
  }
  function seams(ctx, lines, a = 0.4) {
    ctx.save(); ctx.clip();
    ctx.strokeStyle = `rgba(0,0,0,${a})`; ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of lines) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
    ctx.stroke(); ctx.restore();
  }
  function light(ctx, x, y, r, col) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, FX.rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  return {
    hive: () => make('hive', 120, 100, ctx => {
      // thorax + head + abdomen of a chitin queen
      poly(ctx, [[0, -46], [16, -34], [22, -14], [40, -6], [34, 10], [18, 8], [14, 30], [0, 46], [-14, 30], [-18, 8], [-34, 10], [-40, -6], [-22, -14], [-16, -34]],
        '#9a6ad8', '#2a0f4a', '#12041f');
      seams(ctx, [[-22, -14, 22, -14], [-18, 8, 18, 8], [-14, 22, 14, 22], [-14, 30, 14, 30], [0, -46, 0, 46]]);
      ctx.fillStyle = 'rgba(120,255,90,0.55)';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(0, 14 + i * 9, 10 - i * 2, 3, 0, 0, Math.PI * 2); ctx.fill(); }
      light(ctx, -8, -30, 6, '#ff3366'); light(ctx, 8, -30, 6, '#ff3366');
    }),
    pod: () => make('pod', 56, 56, ctx => {
      poly(ctx, [[0, -26], [16, -12], [20, 8], [8, 24], [-8, 24], [-20, 8], [-16, -12]], '#8ae8ff', '#163a7a', '#06142e');
      seams(ctx, [[0, -26, 0, 24], [-20, 8, 20, 8], [-16, -12, 16, -12]]);
      light(ctx, 0, 0, 9, '#66f0ff');
    }),
    levHead: () => make('levHead', 54, 54, ctx => {
      poly(ctx, [[0, 24], [12, 14], [22, -2], [16, -18], [6, -24], [-6, -24], [-16, -18], [-22, -2], [-12, 14]], '#5ad8b0', '#0a3a32', '#021612');
      seams(ctx, [[0, -24, 0, 24], [-22, -2, 22, -2], [-16, -18, 16, -18]]);
      ctx.fillStyle = '#0a1a16'; ctx.fillRect(-10, 12, 20, 4);
      light(ctx, -9, 4, 5, '#ffdd33'); light(ctx, 9, 4, 5, '#ffdd33');
    }),
    levSeg: () => make('levSeg', 38, 38, ctx => {
      poly(ctx, [[0, -16], [14, -8], [16, 6], [8, 15], [-8, 15], [-16, 6], [-14, -8]], '#3fb894', '#0a3028', '#021612');
      seams(ctx, [[-16, 0, 16, 0], [0, -16, 0, 15]]);
      ctx.fillStyle = '#7dffcf';
      ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(4, -24); ctx.lineTo(-4, -24); ctx.closePath(); ctx.fill();
      light(ctx, 0, 4, 3.5, '#a0ffe0');
    }),
    mirrorCore: () => make('mirrorCore', 72, 72, ctx => {
      const n = 8;
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const r = i % 2 ? 22 : 33; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath();
      const g = ctx.createLinearGradient(-30, -30, 30, 30);
      g.addColorStop(0, '#f4f8ff'); g.addColorStop(0.5, '#8aa8d8'); g.addColorStop(1, '#1a2448');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#0a1028'; ctx.lineWidth = 1.4; ctx.stroke();
      seams(ctx, [[-33, 0, 33, 0], [0, -33, 0, 33], [-23, -23, 23, 23], [-23, 23, 23, -23]], 0.3);
      light(ctx, 0, 0, 13, '#ff4dd2');
    }, { metal: 0.85, shine: 40 }),
    hull: () => make('hull', 310, 110, ctx => {
      poly(ctx, [[-150, -10], [-120, -34], [-40, -42], [0, -50], [40, -42], [120, -34], [150, -10], [140, 18], [90, 34], [40, 44], [0, 52], [-40, 44], [-90, 34], [-140, 18]],
        '#c8ced8', '#3a4250', '#10141c');
      seams(ctx, [[-150, -10, 150, -10], [-140, 18, 140, 18], [-90, 34, 90, 34], [-40, -42, -40, 44], [40, -42, 40, 44], [-100, -36, -100, 30], [100, -36, 100, 30], [0, -50, 0, 52]], 0.45);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      for (let x = -130; x <= 130; x += 20) ctx.fillRect(x - 3, 24, 6, 2);
      ctx.fillStyle = '#ffcc55';
      for (const x of [-120, -60, 60, 120]) { ctx.fillRect(x - 2, -26, 4, 2); }
      light(ctx, -70, -18, 3, '#66ccff'); light(ctx, 70, -18, 3, '#66ccff');
    }, { metal: 0.7 }),
    turret: () => make('turret', 34, 34, ctx => {
      ctx.fillStyle = '#2a3040'; ctx.fillRect(-3, 0, 6, 16);
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 12); g.addColorStop(0, '#e8ecf2'); g.addColorStop(1, '#4a5262');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#10141c'; ctx.lineWidth = 1.2; ctx.stroke();
      light(ctx, 0, 0, 4.5, '#ff5533');
    }, { metal: 0.7 })
  };
})();

// ── Shared base ─────────────────────────────────────────────────────────────
class BossBase {
  constructor(name, wave, w, h, targetY = 120) {
    this.name = name;
    this.wave = wave;
    this.x = 240; this.y = -140;
    this.targetY = targetY;
    this.width = w; this.height = h;
    this.maxHp = this.hp = 1000;   // game.js sets the real value
    this.dead = false;
    this.stunned = false; this.frozen = false;
    this.slowTimer = 0; this.slowMult = 1;
    this.knockTimer = 0; this.knockVy = 0;
    this.arrived = false;
    this.enraged = false;
    this.t = 0;
    this.flash = 0;
    this.phaseFlash = 0;
    // fire rate climbs with the wave, capped
    this.k = Math.min(1.7, 1 + Math.max(0, wave - 10) * 0.025);
  }

  _bossName() { return this.name; }
  get isPhase2() { return this.hp / this.maxHp < 0.5; }

  update(dt, bullets, timeSlow, player, world) {
    const dtF = dt / 16.667;
    this.t += dt;
    if (this._lastHp != null && this.hp < this._lastHp) this.flash = 1;
    this._lastHp = this.hp;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 90);
    if (this.phaseFlash > 0) this.phaseFlash -= dt;

    if (!this.arrived) {
      this.y += 2.2 * dtF;
      if (this.y >= this.targetY) { this.y = this.targetY; this.arrived = true; this.homeY = this.targetY; }
      this.entering(dt);
      return;
    }
    if (this.knockTimer > 0) {
      this.knockTimer -= dt;
      this.targetY = Math.max(40, this.targetY - this.knockVy * dtF * 0.3);
      if (this.knockTimer <= 0) this.knockVy = 0;
    } else if (this.targetY < this.homeY) {
      this.targetY = Math.min(this.homeY, this.targetY + 0.6 * dtF);
    }
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowMult = 1; }
    if (this.stunned || this.frozen) return;
    const sm = (timeSlow ? 0.5 : 1) * (this.slowTimer > 0 ? this.slowMult : 1);
    if (!this.enraged && this.isPhase2) {
      this.enraged = true;
      this.phaseFlash = 1400;
      this.onPhase2(world);
    }
    this.act(dt * sm, dtF * sm, bullets, player, world);
  }

  entering() {}
  onPhase2() {}
  act() {}
  affectPlayer() { return 0; }

  // Common finishing touches: phase-2 pulse and the white hit flash
  _phaseAura(ctx, color) {
    if (this.isPhase2) FX.glow(ctx, this.x, this.y, this.width * 0.75 + Math.sin(this.t * 0.008) * 6, color, 0.35);
    if (this.phaseFlash > 0) FX.glow(ctx, this.x, this.y, this.width * 1.2, '#ffffff', this.phaseFlash / 1400 * 0.6);
  }
  _sprite(ctx, sprite, x, y, rot = 0, scale = 1) {
    const w = sprite.logicalW * scale, h = sprite.logicalH * scale;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
    if (this.flash > 0) { ctx.globalAlpha = this.flash * 0.7; ctx.drawImage(FX.whiteOf(sprite), -w / 2, -h / 2, w, h); }
    ctx.restore();
  }
}

// ── 1. Regina dell'Alveare ──────────────────────────────────────────────────
class BossHiveQueen extends BossBase {
  constructor(wave) {
    super("REGINA DELL'ALVEARE", wave, 110, 90, 125);
    this.mode = 0; this.modeT = 0; this.fireT = 0; this.spiralA = 0; this.spawnT = 2500;
  }
  onPhase2(world) { this.spawnT = 0; }
  act(dt, dtF, bullets, player, world) {
    this.x = 240 + Math.sin(this.t * 0.0006) * 120;
    this.y = this.targetY + Math.sin(this.t * 0.0013) * 12;
    const p2 = this.isPhase2;
    this.modeT += dt;
    if (this.modeT > 3600) { this.modeT = 0; this.mode = (this.mode + 1) % 2; }
    this.fireT -= dt * this.k;
    if (this.mode === 0 && this.fireT <= 0) {           // acid spiral from the abdomen
      this.fireT = p2 ? 85 : 120;
      this.spiralA += 0.42;
      const opts = { color: '#7dff4a' };
      _shoot(bullets, this.x, this.y + 30, this.spiralA, 2.6, 16, opts);
      if (p2) _shoot(bullets, this.x, this.y + 30, this.spiralA + Math.PI, 2.6, 16, opts);
    } else if (this.mode === 1 && this.fireT <= 0) {    // aimed acid volleys
      this.fireT = p2 ? 520 : 760;
      const a = _aim(this.x, this.y + 30, player);
      for (const off of p2 ? [-0.3, -0.1, 0.1, 0.3] : [-0.2, 0, 0.2]) _shoot(bullets, this.x, this.y + 30, a + off, 3.4, 18, { color: '#b6ff4a', radius: 4.5, style: 'big' });
    }
    // Drone swarms, capped so the screen never floods
    this.spawnT -= dt;
    if (this.spawnT <= 0 && world && world.spawn) {
      this.spawnT = (p2 ? 5200 : 7200) / this.k;
      const alive = (world.enemies || []).filter(e => e.type === 'weaver').length;
      const n = Math.min(p2 ? 5 : 3, 9 - alive);
      for (let i = 0; i < n; i++) {
        world.spawn(new Enemy('weaver', this.x + (i - (n - 1) / 2) * 26, this.y + 40, this.wave, { hpMult: 0.5 }));
      }
    }
  }
  draw(ctx) {
    const flap = Math.sin(this.t * 0.03);
    this._phaseAura(ctx, '#7dff4a');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(this.x + side * 18, this.y - 10);
      ctx.rotate(side * (0.5 + flap * 0.25));
      const g = ctx.createLinearGradient(0, 0, side * 70, 0);
      g.addColorStop(0, 'rgba(170,140,255,0.35)'); g.addColorStop(1, 'rgba(120,255,200,0.05)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(side * 36, 0, 40, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    this._sprite(ctx, BossArt.hive(), this.x, this.y);
    FX.glow(ctx, this.x, this.y + 22, 20 + Math.sin(this.t * 0.01) * 4, '#7dff4a', 0.5);
  }
}

// ── 2. Gemelli Siderali ─────────────────────────────────────────────────────
class BossTwinSentinels extends BossBase {
  constructor(wave) {
    super('GEMELLI SIDERALI', wave, 400, 56, 110);
    this.sep = 170; this.fireT = 1200; this.side = 0;
    this.beam = { state: 'idle', t: 6000, y: 110, gapX: 240, dir: 1 };
    this.ringT = 2600;
  }
  get pods() { return [{ x: this.x - this.sep, y: this.beam.y }, { x: this.x + this.sep, y: this.beam.y }]; }
  onPhase2() { this.beam.t = Math.min(this.beam.t, 1500); }
  act(dt, dtF, bullets, player) {
    const p2 = this.isPhase2;
    this.x = 240 + Math.sin(this.t * 0.0005) * 20;
    this.sep = 175 + Math.sin(this.t * 0.0009) * 25;
    const B = this.beam;
    B.t -= dt;
    if (B.state === 'idle') {
      B.y += (this.targetY - B.y) * Math.min(1, 0.05 * dtF);
      if (B.t <= 0) { B.state = 'warn'; B.t = 1300; B.gapX = 90 + Math.random() * 300; }
    } else if (B.state === 'warn') {
      if (B.t <= 0) { B.state = 'sweep'; B.t = 2400; }
    } else if (B.state === 'sweep') {
      // pods dive down to the bottom and back, dragging the laser with them
      const k = 1 - B.t / 2400;
      B.y = this.targetY + Math.sin(k * Math.PI) * 470;
      B.gapX += Math.sin(this.t * 0.004) * 0.8 * dtF;
      if (B.t <= 0) { B.state = 'idle'; B.t = (p2 ? 5200 : 7800) / this.k; B.y = this.targetY; }
    }
    this.y = B.y;
    // pods take turns firing at the player; phase 2 adds rings
    this.fireT -= dt * this.k;
    if (this.fireT <= 0 && B.state !== 'sweep') {
      this.fireT = p2 ? 650 : 900;
      const pod = this.pods[this.side]; this.side ^= 1;
      const a = _aim(pod.x, pod.y, player);
      for (const off of [-0.12, 0, 0.12]) _shoot(bullets, pod.x, pod.y + 20, a + off, 3.8, 16, { color: '#66f0ff' });
    }
    if (p2) {
      this.ringT -= dt * this.k;
      if (this.ringT <= 0 && B.state !== 'sweep') {
        this.ringT = 2800;
        for (const pod of this.pods) _ring(bullets, pod.x, pod.y, 10, 2.2, 14, this.t * 0.001, { color: '#a0f4ff' });
      }
    }
  }
  hitTest(b) {
    for (const pod of this.pods) if (Math.abs(b.x - pod.x) < 26 && Math.abs(b.y - pod.y) < 26) return pod;
    // the energy tether between the pods can be shot too (half damage) while idle
    const [a, c] = this.pods;
    if (this.beam.state === 'idle' && b.x > a.x && b.x < c.x && Math.abs(b.y - this.beam.y) < 6) return 'tether';
    return null;
  }
  damagePart(part, dmg) { const d = part === 'tether' ? dmg * 0.5 : dmg; this.hp -= d; return d; }
  aimPoint(p) { const [a, c] = this.pods; return Math.abs(p.x - a.x) < Math.abs(p.x - c.x) ? a.x : c.x; }
  affectPlayer(p) {
    const B = this.beam;
    if (B.state !== 'sweep') return 0;
    const [a, b] = this.pods;
    if (p.x < a.x || p.x > b.x) return 0;
    if (Math.abs(p.y - B.y) > 7 || Math.abs(p.x - B.gapX) < 34) return 0;
    return 28;
  }
  draw(ctx) {
    const [a, b] = this.pods, B = this.beam;
    // tether / warning / laser with its gap
    ctx.save();
    if (B.state === 'warn') {
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 0.03) * 0.25;
      ctx.strokeStyle = '#ff4d6a'; ctx.setLineDash([8, 6]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(B.gapX - 34, a.y); ctx.moveTo(B.gapX + 34, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#4cf2a8'; ctx.strokeRect(B.gapX - 34, a.y - 10, 68, 20);
    } else if (B.state === 'sweep') {
      ctx.globalCompositeOperation = 'lighter';
      for (const [x1, x2] of [[a.x, B.gapX - 34], [B.gapX + 34, b.x]]) {
        const g = ctx.createLinearGradient(0, B.y - 8, 0, B.y + 8);
        g.addColorStop(0, 'rgba(255,60,120,0)'); g.addColorStop(0.5, 'rgba(255,120,200,0.95)'); g.addColorStop(1, 'rgba(255,60,120,0)');
        ctx.fillStyle = g; ctx.fillRect(x1, B.y - 8, x2 - x1, 16);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x1, B.y - 1.5, x2 - x1, 3);
      }
    } else {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + Math.sin(this.t * 0.01) * 0.15; ctx.strokeStyle = '#66f0ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();
    for (const pod of [a, b]) {
      FX.glow(ctx, pod.x, pod.y, 34, this.isPhase2 ? '#ff4dd2' : '#66f0ff', 0.45);
      this._sprite(ctx, BossArt.pod(), pod.x, pod.y, Math.sin(this.t * 0.002) * 0.2);
    }
  }
}

// ── 3. Leviatano ────────────────────────────────────────────────────────────
class BossLeviathan extends BossBase {
  constructor(wave) {
    super('LEVIATANO', wave, 48, 48, 150);
    this.N = 13;
    this.trail = [];
    this.fireT = 1500; this.headT = 2400; this.mineT = 3000;
  }
  _headPos() {
    const sp = this.isPhase2 ? 1.3 : 1;
    return {
      x: 240 + Math.sin(this.t * 0.0011 * sp) * 185,
      y: this.targetY + Math.sin(this.t * 0.0023 * sp) * (this.isPhase2 ? 120 : 75)
    };
  }
  entering() { this._pushTrail(); }
  _pushTrail() {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 260) this.trail.shift();
  }
  get segments() {
    const out = [];
    for (let i = 1; i <= this.N; i++) {
      const p = this.trail[Math.max(0, this.trail.length - 1 - i * 7)];
      if (p) out.push(p);
    }
    return out;
  }
  act(dt, dtF, bullets, player, world) {
    const h = this._headPos();
    this.x += (h.x - this.x) * Math.min(1, 0.08 * dtF);
    this.y += (h.y - this.y) * Math.min(1, 0.08 * dtF);
    this._pushTrail();
    const segs = this.segments;
    this.fireT -= dt * this.k;
    if (this.fireT <= 0) {
      this.fireT = this.isPhase2 ? 1100 : 1600;
      for (let i = 0; i < 3; i++) {
        const s = segs[Math.floor(Math.random() * segs.length)];
        if (s) _shoot(bullets, s.x, s.y, _aim(s.x, s.y, player), 2.8, 15, { color: '#7dffcf' });
      }
    }
    this.headT -= dt * this.k;
    if (this.headT <= 0) {
      this.headT = this.isPhase2 ? 1700 : 2400;
      const a = _aim(this.x, this.y, player);
      for (let i = -2; i <= 2; i++) _shoot(bullets, this.x, this.y + 16, a + i * 0.14, 3.6, 18, { color: '#ffdd33', style: 'big', radius: 5 });
    }
    if (this.isPhase2 && world && world.spawn) {
      this.mineT -= dt;
      if (this.mineT <= 0) {
        this.mineT = 2600 / this.k;
        const s = segs[segs.length - 1];
        if (s) world.spawn(new Enemy('mine', s.x, s.y, this.wave));
      }
    }
  }
  hitTest(b) {
    if (Math.hypot(b.x - this.x, b.y - this.y) < 24) return 'head';
    const segs = this.segments;
    for (let i = 0; i < segs.length; i++) if (Math.hypot(b.x - segs[i].x, b.y - segs[i].y) < 17) return i;
    return null;
  }
  damagePart(part, dmg) { const d = part === 'head' ? dmg * 1.5 : dmg * 0.5; this.hp -= d; return d; }
  affectPlayer(p) {
    for (const s of this.segments) if (Math.hypot(p.x - s.x, p.y - s.y) < 22) return 25;
    return Math.hypot(p.x - this.x, p.y - this.y) < 26 ? 30 : 0;
  }
  draw(ctx) {
    this._phaseAura(ctx, '#ffdd33');
    const segs = this.segments;
    const seg = BossArt.levSeg();
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i], prev = i ? segs[i - 1] : { x: this.x, y: this.y };
      const rot = Math.atan2(prev.y - s.y, prev.x - s.x) + Math.PI / 2;
      this._sprite(ctx, seg, s.x, s.y, rot, 1 - i * 0.025);
    }
    const prev = segs[0] || { x: this.x, y: this.y - 1 };
    this._sprite(ctx, BossArt.levHead(), this.x, this.y, Math.atan2(this.y - prev.y, this.x - prev.x) - Math.PI / 2);
    FX.glow(ctx, this.x, this.y, 20, '#ffdd33', 0.4);
  }
}

// ── 4. Nucleo Specchio ──────────────────────────────────────────────────────
class BossMirrorCore extends BossBase {
  constructor(wave) {
    super('NUCLEO SPECCHIO', wave, 64, 64, 160);
    this.hpScale = 0.65;   // the mirrors already soak a share of the shots
    this.rot = 0;
    this.lasers = { state: 'idle', t: 4500, a: Math.PI / 2 };
    this.ringT = 2400;
    this.reflectBuffer = [];
  }
  get plates() {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const a = this.rot + i * Math.PI / 2;
      const cx = this.x + Math.cos(a) * 70, cy = this.y + Math.sin(a) * 70;
      const tx = -Math.sin(a) * 25, ty = Math.cos(a) * 25;
      out.push({ ax: cx - tx, ay: cy - ty, bx: cx + tx, by: cy + ty, cx, cy, a });
    }
    return out;
  }
  act(dt, dtF, bullets, player) {
    const p2 = this.isPhase2;
    this.x = 240 + Math.sin(this.t * 0.0004) * 70;
    this.y = this.targetY + Math.sin(this.t * 0.0007) * 20;
    this.rot += dt * (p2 ? 0.0014 : 0.0008);
    const L = this.lasers;
    L.t -= dt;
    if (L.state === 'idle' && L.t <= 0) { L.state = 'warn'; L.t = 1100; L.a = _aim(this.x, this.y, player) + 0.9; }
    else if (L.state === 'warn' && L.t <= 0) { L.state = 'fire'; L.t = 2600; }
    else if (L.state === 'fire') { L.a += dt * (p2 ? 0.0009 : 0.0006); if (L.t <= 0) { L.state = 'idle'; L.t = (p2 ? 3000 : 4200) / this.k; } }
    this.ringT -= dt * this.k;
    if (this.ringT <= 0) {
      this.ringT = p2 ? 1900 : 2600;
      _ring(bullets, this.x, this.y, 14, 2.4, 15, this.rot, { color: '#ff7ad8' }, 7);
    }
    // reflected player shots fly back (phase 2)
    for (const r of this.reflectBuffer) _shoot(bullets, r.x, r.y, r.a, 4.2, 14, { color: '#ffffff', style: 'needle' });
    this.reflectBuffer.length = 0;
  }
  hitTest(b) {
    for (const pl of this.plates) if (_segDist(b.x, b.y, pl.ax, pl.ay, pl.bx, pl.by) < 6) return pl;
    if (Math.hypot(b.x - this.x, b.y - this.y) < 30) return 'core';
    return null;
  }
  damagePart(part, dmg, bullet) {
    if (part === 'core') { this.hp -= dmg; return dmg; }
    if (this.isPhase2 && bullet && this.reflectBuffer.length < 6) {
      this.reflectBuffer.push({ x: bullet.x, y: bullet.y + 6, a: Math.PI / 2 + (Math.random() - 0.5) * 0.6 });
    }
    return 0;
  }
  _beams() {
    const L = this.lasers;
    return [L.a, L.a + Math.PI].map(a => ({ ax: this.x, ay: this.y, bx: this.x + Math.cos(a) * 900, by: this.y + Math.sin(a) * 900 }));
  }
  affectPlayer(p) {
    if (this.lasers.state !== 'fire') return 0;
    for (const b of this._beams()) if (_segDist(p.x, p.y, b.ax, b.ay, b.bx, b.by) < 7) return 24;
    return 0;
  }
  draw(ctx) {
    const L = this.lasers;
    if (L.state !== 'idle') {
      ctx.save();
      for (const b of this._beams()) {
        if (L.state === 'warn') {
          ctx.globalAlpha = 0.3 + Math.sin(this.t * 0.03) * 0.2;
          ctx.strokeStyle = '#ff4dd2'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.bx, b.by); ctx.stroke();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 1; ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(255,90,220,0.45)'; ctx.lineWidth = 14;
          ctx.beginPath(); ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.bx, b.by); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(b.ax, b.ay); ctx.lineTo(b.bx, b.by); ctx.stroke();
        }
      }
      ctx.restore();
    }
    this._phaseAura(ctx, '#ff4dd2');
    this._sprite(ctx, BossArt.mirrorCore(), this.x, this.y, this.rot * -0.5);
    // mirrors: bright reflective bars
    for (const pl of this.plates) {
      ctx.save();
      ctx.translate(pl.cx, pl.cy);
      ctx.rotate(pl.a + Math.PI / 2);
      const g = ctx.createLinearGradient(-25, -5, 25, 5);
      g.addColorStop(0, '#5a6a90'); g.addColorStop(0.45, '#ffffff'); g.addColorStop(0.55, '#c8d8ff'); g.addColorStop(1, '#3a4870');
      ctx.fillStyle = g;
      ctx.fillRect(-25, -4, 50, 8);
      ctx.strokeStyle = this.isPhase2 ? '#ff7ad8' : '#9ad8ff'; ctx.lineWidth = 1; ctx.strokeRect(-25, -4, 50, 8);
      ctx.restore();
      FX.glow(ctx, pl.cx, pl.cy, 16, this.isPhase2 ? '#ff7ad8' : '#9ad8ff', 0.35);
    }
  }
}

// ── 5. Stella Nera ──────────────────────────────────────────────────────────
class BossBlackStar extends BossBase {
  constructor(wave) {
    super('STELLA NERA', wave, 70, 70, 170);
    this.hpScale = 0.8;
    this.ringT = 1500; this.coronaT = 4000; this.flareT = 2500;
    this.corona = null;
  }
  act(dt, dtF, bullets, player) {
    const p2 = this.isPhase2;
    this.x = 240 + Math.sin(this.t * 0.0005) * 120;
    this.y = this.targetY + Math.sin(this.t * 0.001) * 40;
    this.ringT -= dt * this.k;
    if (this.ringT <= 0) {
      this.ringT = p2 ? 1500 : 2100;
      _ring(bullets, this.x, this.y, p2 ? 20 : 16, 2.0, 14, Math.random() * 6, { color: '#c78cff' }, 5);
    }
    // corona: bullets held in orbit, then released along their tangent
    this.coronaT -= dt * this.k;
    if (!this.corona && this.coronaT <= 0) {
      const list = [];
      const n = p2 ? 16 : 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        list.push(_shoot(bullets, this.x + Math.cos(a) * 46, this.y + Math.sin(a) * 46, a + Math.PI / 2, 2.4, 16, { color: '#ffb347', style: 'big', radius: 5 }));
      }
      this.corona = { list, t: 1500 };
    }
    if (this.corona) {
      this.corona.t -= dt;
      for (const b of this.corona.list) {
        if (b.dead) continue;
        const dx = this.x - b.x, dy = this.y - b.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        const tx = -dy / d, ty = dx / d;                         // keep circling
        b.vx = tx * sp; b.vy = ty * sp;
        b.x += (dx / d) * (d - 46) * 0.2;                        // stay on the ring
        b.y += (dy / d) * (d - 46) * 0.2;
      }
      if (this.corona.t <= 0) {
        for (const b of this.corona.list) { b.vx *= 1.15; b.vy *= 1.15; }
        this.corona = null;
        this.coronaT = p2 ? 3800 : 5200;
      }
    }
    this.flareT -= dt * this.k;
    if (this.flareT <= 0) {
      this.flareT = p2 ? 1600 : 2300;
      const a = _aim(this.x, this.y, player);
      for (const off of [-0.08, 0, 0.08]) _shoot(bullets, this.x, this.y, a + off, 4.4, 18, { color: '#ffffff', style: 'needle' });
    }
  }
  // Gravity: pulls the ship toward the star; touching it burns
  affectPlayer(p, dt) {
    const dx = this.x - p.x, dy = this.y - p.y, d = Math.hypot(dx, dy) || 1;
    const pull = (this.isPhase2 ? 0.8 : 0.5) * (dt / 16.667) * Math.min(1, 240 / d);
    p.dragDX += (dx / d) * pull;
    p.dragDY += (dy / d) * pull;
    return d < 42 ? 30 : 0;
  }
  draw(ctx) {
    const t = this.t;
    FX.glow(ctx, this.x, this.y, 120 + Math.sin(t * 0.003) * 8, '#6a2aff', 0.35);
    FX.glow(ctx, this.x, this.y, 70, this.isPhase2 ? '#ff5522' : '#ffb347', 0.6);
    // accretion streaks
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const a = t * 0.0015 + i * 1.05;
      ctx.strokeStyle = i % 2 ? 'rgba(255,180,80,0.55)' : 'rgba(200,140,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(this.x, this.y, 52, 18, a, 0.3, 2.2); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, 34);
    g.addColorStop(0, '#000000'); g.addColorStop(0.85, '#05000a'); g.addColorStop(1, 'rgba(255,200,120,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(this.x, this.y, 34, 0, Math.PI * 2); ctx.fill();
    if (this.flash > 0) { ctx.globalAlpha = this.flash * 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); }
    ctx.restore();
  }
}

// ── 6. Corazzata d'Assedio ──────────────────────────────────────────────────
class BossSiegeDreadnought extends BossBase {
  constructor(wave) {
    super("CORAZZATA D'ASSEDIO", wave, 300, 100, 95);
    this.hpScale = 0.75;   // two turrets must fall first
    this.turrets = [[-112, 20], [-52, 34], [52, 34], [112, 20]].map(([ox, oy], i) => ({ ox, oy, hp: 1, max: 1, alive: true, fireT: 1200 + i * 450, aim: Math.PI / 2 }));
    this.wallT = 4200;
    this.initialised = false;
  }
  get turretsDown() { return this.turrets.filter(t => !t.alive).length; }
  aimPoint(p) {
    if (this.coreOpen) return this.x;
    let best = null;
    for (const t of this.turrets) if (t.alive && (!best || Math.abs(this.x + t.ox - p.x) < Math.abs(this.x + best.ox - p.x))) best = t;
    return best ? this.x + best.ox : this.x;
  }
  get coreOpen() { return this.turretsDown >= 2; }
  act(dt, dtF, bullets, player, world) {
    if (!this.initialised) {
      this.initialised = true;
      for (const t of this.turrets) t.hp = t.max = this.maxHp * 0.07;
    }
    this.world = world;
    const p2 = this.isPhase2;
    this.x = 240 + Math.sin(this.t * 0.00045) * 30;
    this.y = this.targetY + Math.sin(this.t * 0.0011) * 6;
    for (const t of this.turrets) {
      if (!t.alive) continue;
      const tx = this.x + t.ox, ty = this.y + t.oy;
      t.aim = _aim(tx, ty, player);
      t.fireT -= dt * this.k;
      if (t.fireT <= 0) {
        t.fireT = (p2 ? 1900 : 2700) + Math.random() * 600;
        for (let i = 0; i < 3; i++) _shoot(bullets, tx + Math.cos(t.aim) * 14, ty + Math.sin(t.aim) * 14, t.aim + (i - 1) * 0.07, 3.8 + i * 0.25, 16, { color: '#ffaa44' });
      }
    }
    // broadside: a wall of shells with one gap
    this.wallT -= dt * this.k;
    if (this.wallT <= 0) {
      this.wallT = p2 ? 4200 : 5800;
      const gap = Math.floor(Math.random() * 10) + 1;
      for (let i = 0; i < 12; i++) {
        if (Math.abs(i - gap) <= 1) continue;
        _shoot(bullets, 20 + i * 40, this.y + 40, Math.PI / 2, 2.4, 18, { color: '#ff7744', style: 'big', radius: 5 });
      }
    }
    if (p2 && this.coreOpen && Math.floor(this.t / 900) !== this._lastBurst) {
      this._lastBurst = Math.floor(this.t / 900);
      _shoot(bullets, this.x, this.y + 30, _aim(this.x, this.y + 30, player), 4.6, 20, { color: '#ffffff', style: 'needle' });
    }
  }
  hitTest(b) {
    for (const t of this.turrets) {
      if (t.alive && Math.hypot(b.x - (this.x + t.ox), b.y - (this.y + t.oy)) < 15) return t;
    }
    // the core is reachable through a vertical channel under it (the hull
    // used to swallow the shots before they got there)
    if (Math.abs(b.x - this.x) < 22 && b.y > this.y - 20 && b.y < this.y + 52) return 'core';
    if (Math.abs(b.x - this.x) < 145 && Math.abs(b.y - this.y) < 40) return 'hull';
    return null;
  }
  damagePart(part, dmg) {
    if (part === 'core') {
      if (!this.coreOpen) return 0;
      this.hp -= dmg; return dmg;
    }
    if (part === 'hull') return 0;
    part.hp -= dmg;
    if (part.hp <= 0 && part.alive) {
      part.alive = false;
      if (this.world && this.world.explode) this.world.explode(this.x + part.ox, this.y + part.oy, 1.8, '#ffaa44');
    }
    return dmg;
  }
  draw(ctx) {
    this._phaseAura(ctx, '#ff7744');
    // engine wash
    for (const ox of [-90, -30, 30, 90]) FX.glow(ctx, this.x + ox, this.y - 46, 16 + Math.random() * 4, '#66ccff', 0.6);
    this._sprite(ctx, BossArt.hull(), this.x, this.y);
    for (const t of this.turrets) {
      const tx = this.x + t.ox, ty = this.y + t.oy;
      if (!t.alive) {
        FX.glow(ctx, tx, ty, 12 + Math.random() * 4, '#ff5522', 0.7);
        ctx.fillStyle = '#120a06'; ctx.beginPath(); ctx.arc(tx, ty, 9, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      this._sprite(ctx, BossArt.turret(), tx, ty, t.aim - Math.PI / 2);
      const k = t.hp / t.max;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(tx - 12, ty - 20, 24, 3);
      ctx.fillStyle = '#ffaa44'; ctx.fillRect(tx - 12, ty - 20, 24 * k, 3);
    }
    // core: shielded until two turrets fall
    const cy = this.y + 8;
    FX.glow(ctx, this.x, cy, 26, this.coreOpen ? '#ff3355' : '#66ccff', 0.8);
    if (!this.coreOpen) {
      ctx.save();
      ctx.strokeStyle = `rgba(120,200,255,${0.5 + Math.sin(this.t * 0.01) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, cy, 26, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
}

const MEGA_BOSSES = [BossHiveQueen, BossTwinSentinels, BossLeviathan, BossMirrorCore, BossBlackStar, BossSiegeDreadnought];
