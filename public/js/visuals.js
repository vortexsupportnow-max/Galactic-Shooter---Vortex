// ===== VISUALS =====
// Everything here is still drawn from code (no image files), but rendered at 2×
// the logical resolution so the 480×700 playfield stays crisp when scaled up.
//
//  - FX:            cached glow sprites, colour helpers, additive drawing
//  - SpaceBackground: scrolling nebulae, parallax planets and twinkling stars,
//                   themed per sector (every 10 waves)
//  - ShipRenderer:  one real hull per skin — shape, palette, engines and aura
//  - EnemySprites:  detailed enemy sprites + white hit-flash silhouettes
//  - FloatingText:  score / damage popups

const RES = 2; // backing-store pixels per logical pixel

// Canvas text in the interface's typefaces. Sizes in the code were tuned for
// the old pixel font, so they are scaled here: Orbitron for big titles,
// Chakra Petch (semibold) for everything else.
function gameFont(px) {
  px = +px;
  if (px >= 10) return `800 ${(px * 1.22).toFixed(1)}px Orbitron, "Chakra Petch", sans-serif`;
  return `600 ${(px * 1.6).toFixed(1)}px "Chakra Petch", "Segoe UI", sans-serif`;
}

// ── Colour helpers ───────────────────────────────────────────────────────────
const FX = (function () {
  function hexToRgb(hex) {
    let h = String(hex || '#ffffff').replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h.slice(0, 6), 16);
    if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // amt > 0 lightens toward white, amt < 0 darkens toward black (range -1..1)
  function shade(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    const t = amt < 0 ? 0 : 255;
    const p = Math.abs(amt);
    const mix = c => Math.round((t - c) * p + c);
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
  }

  function rgba(hex, a) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  function makeCanvas(w, h, scale = RES) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    c.logicalW = w; c.logicalH = h;
    return { c, ctx };
  }

  // Soft radial glow, cached per colour. Drawn additively it reads as light.
  const glowCache = new Map();
  function glowSprite(color) {
    let s = glowCache.get(color);
    if (s) return s;
    const size = 64;
    const { c, ctx } = makeCanvas(size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, rgba(color, 0.9));
    g.addColorStop(0.25, rgba(color, 0.45));
    g.addColorStop(0.6, rgba(color, 0.12));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    glowCache.set(color, c);
    s = c;
    return s;
  }

  function glow(ctx, x, y, radius, color, alpha = 1) {
    const prevOp = ctx.globalCompositeOperation;
    const prevA = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = prevA * alpha;
    ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = prevOp;
    ctx.globalAlpha = prevA;
  }

  // White silhouette of a sprite, for the one-frame "got hit" flash.
  const whiteCache = new WeakMap();
  function whiteOf(sprite) {
    let w = whiteCache.get(sprite);
    if (w) return w;
    w = document.createElement('canvas');
    w.width = sprite.width; w.height = sprite.height;
    const x = w.getContext('2d');
    x.drawImage(sprite, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w.width, w.height);
    whiteCache.set(sprite, w);
    return w;
  }

  return { hexToRgb, shade, rgba, makeCanvas, glowSprite, glow, whiteOf };
})();

// ── Sectors: a new look every 10 waves ───────────────────────────────────────
const SECTORS = [
  { name: 'NEBULOSA DI ORIONE', base: '#02030b', nebula: ['#1d2f8a', '#6a1c8a', '#0d5a7a'], star: '#cfe3ff', planet: ['#3a6ad8', '#0b1a4a'] },
  { name: 'CINTURA CREMISI',    base: '#0a0205', nebula: ['#8a1c26', '#a3471a', '#4a0d3a'], star: '#ffd9cf', planet: ['#d86a3a', '#4a120b'] },
  { name: 'ABISSO SMERALDO',    base: '#010806', nebula: ['#0d7a5a', '#1c5a8a', '#0d4a2a'], star: '#cfffe8', planet: ['#3ad8a0', '#0b4a32'] },
  { name: 'CORONA SOLARE',      base: '#0a0602', nebula: ['#a36a12', '#8a2c12', '#6a5a0d'], star: '#fff1cf', planet: ['#e8c048', '#5a3a0b'] },
  { name: 'VUOTO VIOLA',        base: '#05020b', nebula: ['#4a1c8a', '#8a1c6a', '#1c1c5a'], star: '#e8d9ff', planet: ['#a05ae8', '#22104a'] }
];

function sectorForWave(wave) {
  return Math.floor(Math.max(0, wave - 1) / 10) % SECTORS.length;
}

class SpaceBackground {
  constructor(W = 480, H = 700) {
    this.W = W; this.H = H;
    // With WebGL (postfx.js) the nebula, far stars and planets are drawn by
    // shaders; this class then only animates them and draws the near stars.
    this.gpu = !!SpaceBackground.gpu;
    this.travel = 0;           // unbounded scroll distance, for the shaders
    this.sectorIndex = -1;
    this.layer = null;       // current nebula tile
    this.prevLayer = null;   // previous one, cross-fading out
    this.fade = 1;
    this.scroll = 0;
    this.planets = [];
    this.planetTimer = 4000;
    this.warp = 0;           // 0..1, star streaking between waves
    this.stars = [];
    const layers = [
      { count: 70, speed: 0.25, size: [0.6, 1.1], alpha: 0.45 },
      { count: 60, speed: 0.8,  size: [0.8, 1.5], alpha: 0.7 },
      { count: 28, speed: 1.8,  size: [1.2, 2.2], alpha: 1.0 }
    ];
    for (const l of layers) {
      for (let i = 0; i < l.count; i++) {
        this.stars.push({
          x: Math.random() * this.W, y: Math.random() * this.H,
          speed: l.speed, size: l.size[0] + Math.random() * (l.size[1] - l.size[0]),
          alpha: l.alpha * (0.6 + Math.random() * 0.4),
          tw: Math.random() * Math.PI * 2, twSpeed: 0.001 + Math.random() * 0.003,
          tinted: Math.random() < 0.35
        });
      }
    }
    this.setSector(0, true);
  }

  _buildNebula(sector) {
    // Tall tile (2× the screen) that scrolls and wraps seamlessly. Rendered at
    // half resolution: it is soft anyway, and it keeps the memory small.
    const w = this.W, h = this.H * 2;
    const c = document.createElement('canvas');
    c.width = w / 2; c.height = h / 2;
    const ctx = c.getContext('2d');
    ctx.scale(0.5, 0.5);
    ctx.fillStyle = sector.base;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const blob = (x, y, r, col, a) => {
      for (const oy of [-h, 0, h]) {
        const g = ctx.createRadialGradient(x, y + oy, 0, x, y + oy, r);
        g.addColorStop(0, FX.rgba(col, a));
        g.addColorStop(0.5, FX.rgba(col, a * 0.35));
        g.addColorStop(1, FX.rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y + oy - r, r * 2, r * 2);
      }
    };
    // Big soft clouds, then smaller brighter knots inside them
    for (let i = 0; i < 9; i++) {
      blob(Math.random() * w, Math.random() * h, 160 + Math.random() * 220,
        sector.nebula[i % sector.nebula.length], 0.16 + Math.random() * 0.12);
    }
    for (let i = 0; i < 22; i++) {
      blob(Math.random() * w, Math.random() * h, 30 + Math.random() * 80,
        sector.nebula[i % sector.nebula.length], 0.1 + Math.random() * 0.12);
    }
    // Star dust baked into the tile
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 500; i++) {
      ctx.globalAlpha = 0.15 + Math.random() * 0.35;
      ctx.fillStyle = Math.random() < 0.3 ? sector.star : '#ffffff';
      const s = Math.random() < 0.9 ? 1 : 2;
      ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    ctx.globalAlpha = 1;
    return c;
  }

  setSector(index, instant = false) {
    if (index === this.sectorIndex) return;
    this.prevSector = instant ? null : this.sector;
    this.prevSectorIndex = instant ? null : this.sectorIndex;
    this.sectorIndex = index;
    this.sector = SECTORS[index % SECTORS.length];
    if (!this.gpu) {
      this.prevLayer = instant ? null : this.layer;
      this.layer = this._buildNebula(this.sector);
    }
    this.fade = instant ? 1 : 0;
  }

  // GPU planets carry only parameters; the composite shader draws them lit,
  // rotating, with atmosphere and rings. Every few spawns it is a distant sun.
  _spawnGpuBody() {
    const s = this.sector;
    const rgb = hex => { const { r, g, b } = FX.hexToRgb(hex); return [r / 255, g / 255, b / 255]; };
    const sun = Math.random() < 0.22;
    const type = sun ? 3 : [0, 1, 1, 2][Math.floor(Math.random() * 4)];
    const r = sun ? 26 + Math.random() * 20 : 45 + Math.random() * 105;
    let A, B;
    if (sun) { A = rgb(s.star); B = [1, 1, 1]; }
    else if (type === 0) { A = rgb(s.planet[0]); B = rgb(s.planet[1]); }
    else if (type === 1) { A = rgb(s.planet[0]); B = rgb(s.nebula[1]); }
    else { A = [0.42, 0.56, 0.31]; B = rgb('#1d5fa8'); }
    this.planets.push({
      x: 40 + Math.random() * (this.W - 80), y: -r * 2.4, r,
      speed: sun ? 0.06 : 0.1 + Math.random() * 0.14,
      gpuType: type, gpuA: A, gpuB: B,
      seed: Math.random() * 10, spin: (0.01 + Math.random() * 0.03) * (Math.random() < 0.5 ? -1 : 1),
      ring: !sun && type !== 2 && Math.random() < 0.45, ringTilt: (Math.random() - 0.5) * 0.7,
      size: r * 4.8
    });
  }

  _spawnPlanet() {
    const s = this.sector;
    const r = 30 + Math.random() * 90;
    const p = {
      x: 40 + Math.random() * 400, y: -r * 1.6,
      r, speed: 0.12 + Math.random() * 0.15,
      ring: Math.random() < 0.4, ringTilt: (Math.random() - 0.5) * 0.6
    };
    // Pre-render the planet once
    const size = r * 2 + (p.ring ? r * 1.6 : 8);
    const { c, ctx } = FX.makeCanvas(size, size);
    const cx = size / 2, cy = size / 2;
    const g = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, FX.shade(s.planet[0], 0.35));
    g.addColorStop(0.55, s.planet[0]);
    g.addColorStop(1, s.planet[1]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // Surface bands
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = 0.08 + Math.random() * 0.1;
      ctx.fillStyle = Math.random() < 0.5 ? '#000000' : '#ffffff';
      ctx.fillRect(cx - r, cy - r + Math.random() * r * 2, r * 2, 2 + Math.random() * r * 0.18);
    }
    // Night side
    ctx.globalAlpha = 0.55;
    const ns = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ns.addColorStop(0.45, 'rgba(0,0,0,0)');
    ns.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = ns;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    // Atmosphere rim
    ctx.strokeStyle = FX.rgba(s.planet[0], 0.5);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, Math.PI * 2); ctx.stroke();
    if (p.ring) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(p.ringTilt);
      ctx.scale(1, 0.28);
      ctx.strokeStyle = FX.shade(s.planet[0], 0.4);
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = r * 0.18;
      ctx.beginPath(); ctx.arc(0, 0, r * 1.55, Math.PI * 0.05, Math.PI * 0.95, true); ctx.stroke();
      ctx.restore();
    }
    p.sprite = c;
    p.size = size;
    this.planets.push(p);
  }

  update(dt) {
    const dtF = dt / 16.667;
    const warpMul = 1 + this.warp * 9;
    this.scroll = (this.scroll + 0.18 * dtF * (1 + this.warp * 3)) % (this.H * 2);
    this.travel += 0.18 * dtF * (1 + this.warp * 6);
    if (this.fade < 1) this.fade = Math.min(1, this.fade + dt / 1800);

    for (const s of this.stars) {
      s.y += s.speed * dtF * warpMul;
      s.tw += s.twSpeed * dt;
      if (s.y > this.H + 10) { s.y = -10; s.x = Math.random() * this.W; }
    }

    this.planetTimer -= dt;
    if (this.planetTimer <= 0 && this.planets.length < (this.gpu ? 3 : 2)) {
      if (this.gpu) this._spawnGpuBody(); else this._spawnPlanet();
      this.planetTimer = (this.gpu ? 14000 : 20000) + Math.random() * 20000;
    }
    for (let i = this.planets.length - 1; i >= 0; i--) {
      const p = this.planets[i];
      p.y += p.speed * dtF * (1 + this.warp * 2);
      if (p.y - p.size / 2 > this.H) this.planets.splice(i, 1);
    }
  }

  _drawLayer(ctx, layer, alpha) {
    if (!layer || alpha <= 0) return;
    const h = this.H * 2;
    const y = this.scroll - h;
    ctx.globalAlpha = alpha;
    ctx.drawImage(layer, 0, y, this.W, h);
    ctx.drawImage(layer, 0, y + h, this.W, h);
    ctx.globalAlpha = 1;
  }

  draw(ctx) {
    if (this.gpu) { this._drawStars(ctx); return; }
    ctx.fillStyle = this.sector.base;
    ctx.fillRect(0, 0, this.W, this.H);
    if (this.prevLayer && this.fade < 1) this._drawLayer(ctx, this.prevLayer, 1);
    this._drawLayer(ctx, this.layer, this.prevLayer ? this.fade : 1);

    for (const p of this.planets) {
      ctx.globalAlpha = 0.7;
      ctx.drawImage(p.sprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }

    this._drawStars(ctx);
  }

  _drawStars(ctx) {
    // Stars: twinkle, and streak into lines while warping between waves
    const streak = this.warp > 0.05;
    for (const s of this.stars) {
      const a = s.alpha * (0.7 + Math.sin(s.tw) * 0.3);
      ctx.globalAlpha = a;
      ctx.fillStyle = s.tinted ? this.sector.star : '#ffffff';
      if (streak) {
        const len = s.speed * this.warp * 22;
        ctx.fillRect(s.x, s.y - len, Math.max(0.8, s.size * 0.6), len + s.size);
      } else {
        ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ── Sprite forge: flat drawing → lit, bevelled "model" ───────────────────────
// Each sprite is drawn flat (colours, panels, lights) at 4× and then shaded as
// a solid object: a height field from the distance to the silhouette edge (a
// rounded bevel) plus the drawing's own luminance (panel seams become grooves),
// normals from that height, then diffuse + metallic specular + a cool fresnel
// rim. Bright pixels (cockpits, eyes, lights) are kept as self-lit. The light
// comes from the same direction that lights the planets in postfx.js.
const SpriteForge = (function () {
  const norm = v => { const n = Math.hypot(v[0], v[1], v[2]); return v.map(x => x / n); };
  const L = norm([-0.55, -0.45, 0.72]);           // screen space, y down
  const HV = norm([L[0], L[1], L[2] + 1]);         // Blinn half vector (viewer on +z)

  function forge(src, o = {}) {
    const w = src.width, h = src.height, N = w * h;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.logicalW = src.logicalW; out.logicalH = src.logicalH;
    const ctx = out.getContext('2d');
    ctx.drawImage(src, 0, 0);
    let img;
    try { img = ctx.getImageData(0, 0, w, h); } catch (e) { return src; }
    const d = img.data;
    const A = new Float32Array(N), lum = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      A[i] = d[i * 4 + 3] / 255;
      lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    }

    // Chamfer distance from the edge, inside the silhouette
    const D = new Float32Array(N);
    for (let i = 0; i < N; i++) D[i] = A[i] > 0.5 ? 1e6 : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : D[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!D[i]) continue;
      D[i] = Math.min(D[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!D[i]) continue;
      D[i] = Math.min(D[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
    }

    const bevel = o.bevel || Math.max(3, w * 0.075);
    const emboss = o.emboss != null ? o.emboss : 0.35;
    const Hf = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (A[i] <= 0.02) continue;
      const t = Math.min(D[i] / bevel, 1);
      Hf[i] = Math.sqrt(1 - (1 - t) * (1 - t)) + (lum[i] - 0.5) * emboss;
    }

    const k = bevel * (o.relief || 0.9);
    const ambient = o.ambient != null ? o.ambient : 0.36;
    const specK = o.spec != null ? o.spec : 0.85;
    const shine = o.shine || 26;
    const metal = o.metal != null ? o.metal : 0.55;
    const rim = o.rim || [0.45, 0.72, 1.0];
    const rimK = o.rimK != null ? o.rimK : 0.5;
    const hAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : Hf[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (A[i] <= 0.02) continue;
      const hx = (hAt(x + 1, y) - hAt(x - 1, y)) * 0.5 * k;
      const hy = (hAt(x, y + 1) - hAt(x, y - 1)) * 0.5 * k;
      let nx = -hx, ny = -hy, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const spec = Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), shine) * specK;
      const fres = (1 - nz) * (1 - nz) * rimK;
      const e = Math.min(1, Math.max(0, (lum[i] - 0.8) / 0.14)) * (o.emissive === false ? 0 : 1);
      const j = i * 4;
      for (let c = 0; c < 3; c++) {
        const alb = d[j + c] / 255;
        let v = alb * (ambient + diff * 0.95) + spec * (metal * alb + (1 - metal)) + fres * rim[c];
        v = v * (1 - e) + Math.min(1, alb * 1.08) * e;
        d[j + c] = Math.max(0, Math.min(255, v * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }

  return { forge };
})();

// ── Ships ────────────────────────────────────────────────────────────────────
// A "visual" describes a ship: hull shape, palette, engine colour and aura.
const DEFAULT_SHIP_VISUAL = {
  hull: 'arrow', primary: '#2fd6ff', secondary: '#1b4fd8', accent: '#ffffff',
  cockpit: '#bff6ff', engine: '#38b6ff', aura: null
};

const ShipRenderer = (function () {
  const cache = new Map();
  const SIZE = 44; // logical sprite box (ship is ~40 wide)

  // Each hull: draw(ctx, pal) around (0,0), nose pointing up; engines = exhaust ports.
  const HULLS = {
    arrow: {
      engines: [[0, 17]],
      draw(ctx, p) {
        hullPath(ctx, [[0, -19], [6, -6], [17, 13], [6, 10], [0, 15], [-6, 10], [-17, 13], [-6, -6]], p);
        wingPanels(ctx, p, [[[-15, 12], [-7, 0], [-6, 9]], [[15, 12], [7, 0], [6, 9]]]);
        cockpit(ctx, p, 0, -5, 3.2, 6);
      }
    },
    dart: {
      engines: [[-3, 18], [3, 18]],
      draw(ctx, p) {
        hullPath(ctx, [[0, -21], [3, -8], [4, 6], [13, 16], [4, 14], [0, 17], [-4, 14], [-13, 16], [-4, 6], [-3, -8]], p);
        wingPanels(ctx, p, [[[-12, 15], [-4, 8], [-4, 13]], [[12, 15], [4, 8], [4, 13]]]);
        ctx.fillStyle = p.accent; ctx.globalAlpha = 0.6;
        ctx.fillRect(-0.6, -16, 1.2, 26); ctx.globalAlpha = 1;
        cockpit(ctx, p, 0, -7, 2.4, 6);
      }
    },
    interceptor: {
      engines: [[-8, 16], [8, 16]],
      draw(ctx, p) {
        hullPath(ctx, [[0, -18], [5, -8], [18, -12], [12, 4], [10, 15], [4, 11], [0, 13], [-4, 11], [-10, 15], [-12, 4], [-18, -12], [-5, -8]], p);
        wingPanels(ctx, p, [[[-17, -10], [-6, -5], [-11, 3]], [[17, -10], [6, -5], [11, 3]]]);
        cockpit(ctx, p, 0, -4, 3, 6);
      }
    },
    manta: {
      engines: [[-5, 13], [5, 13]],
      draw(ctx, p) {
        ctx.beginPath();
        ctx.moveTo(0, -17);
        ctx.quadraticCurveTo(9, -8, 20, 8);
        ctx.quadraticCurveTo(12, 9, 7, 14);
        ctx.lineTo(0, 11);
        ctx.lineTo(-7, 14);
        ctx.quadraticCurveTo(-12, 9, -20, 8);
        ctx.quadraticCurveTo(-9, -8, 0, -17);
        ctx.closePath();
        fillHull(ctx, p);
        wingPanels(ctx, p, [[[-18, 7], [-8, -2], [-8, 9]], [[18, 7], [8, -2], [8, 9]]]);
        cockpit(ctx, p, 0, -4, 3.6, 5);
      }
    },
    fortress: {
      engines: [[-11, 17], [0, 17], [11, 17]],
      draw(ctx, p) {
        hullPath(ctx, [[0, -17], [6, -10], [7, -2], [16, 0], [17, 15], [8, 13], [0, 15], [-8, 13], [-17, 15], [-16, 0], [-7, -2], [-6, -10]], p);
        // Side pods
        ctx.fillStyle = p.secondary;
        ctx.fillRect(-18, 2, 5, 12); ctx.fillRect(13, 2, 5, 12);
        ctx.fillStyle = p.accent; ctx.globalAlpha = 0.7;
        ctx.fillRect(-17, 4, 3, 2); ctx.fillRect(14, 4, 3, 2); ctx.globalAlpha = 1;
        cockpit(ctx, p, 0, -6, 3.4, 5);
      }
    },
    crown: {
      engines: [[-6, 16], [6, 16]],
      draw(ctx, p) {
        hullPath(ctx, [[0, -20], [4, -9], [9, -15], [9, -4], [18, -9], [16, 8], [7, 15], [0, 12], [-7, 15], [-16, 8], [-18, -9], [-9, -4], [-9, -15], [-4, -9]], p);
        wingPanels(ctx, p, [[[-15, 6], [-9, -2], [-7, 10]], [[15, 6], [9, -2], [7, 10]]]);
        // Jewel
        ctx.fillStyle = p.accent;
        ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(3, 2); ctx.lineTo(0, 6); ctx.lineTo(-3, 2); ctx.closePath(); ctx.fill();
        cockpit(ctx, p, 0, -9, 2.4, 4);
      }
    },
    phantom: {
      engines: [[0, 15]],
      draw(ctx, p) {
        hullPath(ctx, [[0, -19], [5, -9], [19, 6], [14, 9], [7, 6], [4, 14], [0, 11], [-4, 14], [-7, 6], [-14, 9], [-19, 6], [-5, -9]], p);
        // Faceted panels
        ctx.strokeStyle = FX.rgba('#000000', 0.45); ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(0, -19); ctx.lineTo(0, 11);
        ctx.moveTo(-5, -9); ctx.lineTo(-7, 6);
        ctx.moveTo(5, -9); ctx.lineTo(7, 6);
        ctx.stroke();
        cockpit(ctx, p, 0, -6, 2.6, 5);
      }
    },
    dragon: {
      engines: [[0, 16]],
      draw(ctx, p) {
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(4, -10);
        ctx.quadraticCurveTo(14, -12, 20, -3);
        ctx.lineTo(15, -1); ctx.lineTo(18, 5); ctx.lineTo(12, 5); ctx.lineTo(13, 11);
        ctx.lineTo(5, 9); ctx.lineTo(0, 16); ctx.lineTo(-5, 9);
        ctx.lineTo(-13, 11); ctx.lineTo(-12, 5); ctx.lineTo(-18, 5); ctx.lineTo(-15, -1); ctx.lineTo(-20, -3);
        ctx.quadraticCurveTo(-14, -12, -4, -10);
        ctx.closePath();
        fillHull(ctx, p);
        wingPanels(ctx, p, [[[-17, -2], [-5, -6], [-10, 6]], [[17, -2], [5, -6], [10, 6]]]);
        cockpit(ctx, p, 0, -8, 2.6, 5);
      }
    }
  };

  function hullPath(ctx, pts, p) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    fillHull(ctx, p);
  }

  function fillHull(ctx, p) {
    const g = ctx.createLinearGradient(-18, -18, 18, 18);
    g.addColorStop(0, FX.shade(p.primary, 0.45));
    g.addColorStop(0.45, p.primary);
    g.addColorStop(1, FX.shade(p.secondary, -0.35));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = FX.shade(p.secondary, -0.6);
    ctx.stroke();
    // Spine highlight + panel seams, vents and running lights (they turn into
    // grooves and self-lit points once the sprite is forged)
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-1.5, -22, 3, 40);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (const y of [-11, -1, 8]) { ctx.moveTo(-20, y); ctx.lineTo(20, y + 3); }
    ctx.moveTo(-3.2, -20); ctx.lineTo(-3.2, 18);
    ctx.moveTo(3.2, -20); ctx.lineTo(3.2, 18);
    ctx.moveTo(-6, 2); ctx.lineTo(-17, 13);
    ctx.moveTo(6, 2); ctx.lineTo(17, 13);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (const x of [-9, 7]) for (let k = 0; k < 3; k++) ctx.fillRect(x, 4 + k * 1.6, 2.2, 0.7);
    ctx.restore();
  }

  function wingPanels(ctx, p, tris) {
    ctx.fillStyle = FX.rgba(p.secondary, 0.85);
    for (const t of tris) {
      ctx.beginPath();
      ctx.moveTo(t[0][0], t[0][1]); ctx.lineTo(t[1][0], t[1][1]); ctx.lineTo(t[2][0], t[2][1]);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = FX.rgba(p.accent, 0.8);
    for (const t of tris) ctx.fillRect(t[0][0] - 0.8, t[0][1] - 1.5, 1.6, 1.6);
  }

  function cockpit(ctx, p, x, y, rx, ry) {
    const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, p.cockpit);
    g.addColorStop(1, FX.shade(p.cockpit, -0.6));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
  }

  function stripesOverlay(ctx, stripes, hullDraw, pal) {
    // Paint the flag across the hull only (clip to the hull silhouette)
    const { c: mask, ctx: m } = FX.makeCanvas(SIZE, SIZE);
    m.translate(SIZE / 2, SIZE / 2);
    hullDraw(m, pal);
    m.globalCompositeOperation = 'source-atop';
    m.globalAlpha = 0.55;
    const bw = 40 / stripes.length;
    stripes.forEach((col, i) => { m.fillStyle = col; m.fillRect(-20 + i * bw, -22, bw + 0.3, 44); });
    ctx.drawImage(mask, -SIZE / 2, -SIZE / 2, SIZE, SIZE);
  }

  function keyOf(v) {
    return [v.hull, v.primary, v.secondary, v.accent, v.cockpit, (v.stripes || []).join('')].join('|');
  }

  function sprite(visual) {
    const v = { ...DEFAULT_SHIP_VISUAL, ...(visual || {}) };
    const k = keyOf(v);
    let s = cache.get(k);
    if (s) return s;
    const hull = HULLS[v.hull] || HULLS.arrow;
    const { c, ctx } = FX.makeCanvas(SIZE, SIZE, RES * 2);
    ctx.translate(SIZE / 2, SIZE / 2);
    hull.draw(ctx, v);
    if (v.stripes && v.stripes.length) stripesOverlay(ctx, v.stripes, hull.draw, v);
    const forged = SpriteForge.forge(c, { bevel: 7, metal: 0.6, shine: 30 });
    cache.set(k, forged);
    return forged;
  }

  function engines(visual) {
    const v = visual || DEFAULT_SHIP_VISUAL;
    return (HULLS[v.hull] || HULLS.arrow).engines;
  }

  // Engine flames: additive, flickering, longer when moving up.
  function drawEngines(ctx, x, y, visual, thrust = 1, scale = 1) {
    const v = { ...DEFAULT_SHIP_VISUAL, ...(visual || {}) };
    for (const [ex, ey] of engines(v)) {
      const px = x + ex * scale, py = y + ey * scale;
      const len = (7 + Math.random() * 6) * thrust * scale;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(px, py, px, py + len);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.25, FX.rgba(v.engine, 0.85));
      g.addColorStop(1, FX.rgba(v.engine, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(px - 2.6 * scale, py);
      ctx.lineTo(px + 2.6 * scale, py);
      ctx.lineTo(px, py + len);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      FX.glow(ctx, px, py + 2, 8 * scale, v.engine, 0.6);
    }
  }

  // Animated aura around the ship. `t` is a time in ms.
  function drawAura(ctx, x, y, visual, t) {
    const v = visual || {};
    const type = v.aura;
    if (!type) return;
    const col = v.auraColor || v.primary || '#00ffff';
    const col2 = v.auraColor2 || v.secondary || col;
    ctx.save();
    switch (type) {
      case 'glow': {
        FX.glow(ctx, x, y, 34 + Math.sin(t * 0.004) * 3, col, 0.45);
        break;
      }
      case 'ring': {
        FX.glow(ctx, x, y, 30, col, 0.25);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 2; i++) {
          const ph = ((t * 0.0009) + i * 0.5) % 1;
          ctx.globalAlpha = (1 - ph) * 0.7;
          ctx.strokeStyle = i ? col2 : col;
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, y, 16 + ph * 22, 0, Math.PI * 2); ctx.stroke();
        }
        break;
      }
      case 'orbit': {
        // Shards orbiting the ship
        FX.glow(ctx, x, y, 30, col, 0.3);
        const n = v.orbitCount || 3;
        for (let i = 0; i < n; i++) {
          const a = t * 0.003 + (i / n) * Math.PI * 2;
          const ox = x + Math.cos(a) * 27, oy = y + Math.sin(a) * 27 * 0.7;
          ctx.save();
          ctx.translate(ox, oy);
          ctx.rotate(a * 2);
          ctx.fillStyle = i % 2 ? col2 : col;
          ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(2.5, 0); ctx.lineTo(0, 4); ctx.lineTo(-2.5, 0); ctx.closePath(); ctx.fill();
          ctx.restore();
          FX.glow(ctx, ox, oy, 7, col, 0.7);
        }
        break;
      }
      case 'flame': {
        FX.glow(ctx, x, y + 4, 34, col, 0.35);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + t * 0.002;
          const flick = 0.6 + Math.sin(t * 0.02 + i * 1.7) * 0.4;
          const r = 20 + flick * 6;
          FX.glow(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, 8 + flick * 4, i % 2 ? col : col2, 0.55);
        }
        break;
      }
      case 'void': {
        // Dark swirling disc with a bright rim
        ctx.globalAlpha = 0.55;
        const g = ctx.createRadialGradient(x, y, 6, x, y, 34);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.6, 'rgba(0,0,0,0.6)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = FX.rgba(col, 0.8);
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) {
          const a0 = t * 0.0025 + i * (Math.PI * 2 / 3);
          ctx.beginPath(); ctx.arc(x, y, 26, a0, a0 + 1.1); ctx.stroke();
        }
        break;
      }
      case 'sparkle': {
        FX.glow(ctx, x, y, 30, col, 0.3);
        for (let i = 0; i < 6; i++) {
          const seed = i * 97.13;
          const ph = ((t * 0.0012) + i / 6) % 1;
          const a = seed + Math.floor(t * 0.0012 + i / 6) * 2.4;
          const r = 14 + ph * 18;
          const sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r;
          const s = (1 - Math.abs(ph - 0.5) * 2) * 3.5;
          ctx.fillStyle = i % 2 ? col : col2;
          ctx.globalAlpha = 0.9;
          ctx.fillRect(sx - s / 2, sy - 0.5, s, 1);
          ctx.fillRect(sx - 0.5, sy - s / 2, 1, s);
          FX.glow(ctx, sx, sy, 5, col, 0.5);
        }
        break;
      }
      case 'binary': {
        // Two tiny suns circling each other around the ship
        for (let i = 0; i < 2; i++) {
          const a = t * 0.004 + i * Math.PI;
          const ox = x + Math.cos(a) * 24, oy = y + Math.sin(a) * 12 + 2;
          FX.glow(ctx, ox, oy, 12, i ? col2 : col, 0.9);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(ox, oy, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
    }
    ctx.restore();
  }

  // Full ship: aura → engines → hull (with optional bank tilt and hit flash)
  function draw(ctx, x, y, visual, opts = {}) {
    const t = opts.time != null ? opts.time : performance.now();
    const scale = opts.scale || 1;
    if (!opts.noAura) drawAura(ctx, x, y, visual, t);
    drawEngines(ctx, x, y, visual, opts.thrust != null ? opts.thrust : 1, scale);
    const s = sprite(visual);
    ctx.save();
    ctx.translate(x, y);
    if (opts.bank) ctx.scale(1 - Math.min(0.28, Math.abs(opts.bank) * 0.28), 1);
    if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    const d = SIZE * scale;
    ctx.drawImage(s, -d / 2, -d / 2, d, d);
    if (opts.flash) {
      ctx.globalAlpha = Math.min(1, opts.flash);
      ctx.drawImage(FX.whiteOf(s), -d / 2, -d / 2, d, d);
    }
    ctx.restore();
  }

  // Static preview for menus (skin cards). Returns a data URL.
  function previewURL(visual, size = 96) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    const k = size / 60;
    ctx.scale(k, k);
    draw(ctx, 30, 28, visual, { time: 1200, thrust: 1.1 });
    return c.toDataURL();
  }

  return { sprite, draw, drawAura, drawEngines, previewURL, SIZE, HULLS: Object.keys(HULLS) };
})();

// ── Enemy sprites ────────────────────────────────────────────────────────────
const EnemySprites = (function () {
  function mk(size, fn, material) {
    const { c, ctx } = FX.makeCanvas(size, size, RES * 2);
    ctx.translate(size / 2, size / 2);
    fn(ctx, size / 2);
    return SpriteForge.forge(c, { bevel: Math.max(5, size * 0.22), ...(material || {}) });
  }

  function body(ctx, pts, c1, c2, outline) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -14, 0, 14);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = outline;
    ctx.stroke();
    // armour seams (grooves once forged)
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(0, 16);
    ctx.moveTo(-16, -3); ctx.lineTo(16, -3);
    ctx.moveTo(-12, 6); ctx.lineTo(-4, 12); ctx.moveTo(12, 6); ctx.lineTo(4, 12);
    ctx.stroke();
    ctx.restore();
  }

  function eye(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, color);
    g.addColorStop(1, FX.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const S = {};

  // Basic: red dart diving down
  S.basic = mk(26, (ctx) => {
    body(ctx, [[0, 11], [5, 2], [11, -8], [4, -5], [0, -9], [-4, -5], [-11, -8], [-5, 2]], '#ff6a7a', '#a3001c', '#3a0008');
    eye(ctx, 0, -1, 4, '#ffcc00');
  });

  // Medium: purple crab with pincers
  S.medium = mk(30, (ctx) => {
    body(ctx, [[0, 12], [7, 6], [13, 9], [12, -2], [7, -10], [0, -7], [-7, -10], [-12, -2], [-13, 9], [-7, 6]], '#d48aff', '#5a12a3', '#22003a');
    ctx.fillStyle = '#2a0050';
    ctx.fillRect(-9, -2, 4, 3); ctx.fillRect(5, -2, 4, 3);
    eye(ctx, -6, -0.5, 2.6, '#ff44ff');
    eye(ctx, 6, -0.5, 2.6, '#ff44ff');
  });

  // Heavy: orange armoured hexagon
  S.heavy = mk(34, (ctx) => {
    body(ctx, [[0, 15], [12, 8], [14, -6], [6, -14], [-6, -14], [-14, -6], [-12, 8]], '#ffb066', '#a34400', '#3a1400');
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(12, -2); ctx.moveTo(-9, 6); ctx.lineTo(9, 6); ctx.stroke();
    ctx.fillStyle = '#5a2000'; ctx.fillRect(-4, -11, 8, 5);
    eye(ctx, 0, 2, 5, '#ffee44');
  });

  // Shooter: teal turret ship with a barrel
  S.shooter = mk(30, (ctx) => {
    ctx.fillStyle = '#103a3a'; ctx.fillRect(-2, 6, 4, 8);
    body(ctx, [[0, 9], [9, 6], [13, -3], [7, -11], [-7, -11], [-13, -3], [-9, 6]], '#6affe0', '#0a7a6a', '#00302a');
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-10, -3, 20, 2);
    eye(ctx, 0, -3, 4, '#ff3355');
  });

  // Weaver: thin green moth
  S.weaver = mk(24, (ctx) => {
    body(ctx, [[0, 10], [3, 0], [11, -6], [6, 2], [0, -9], [-6, 2], [-11, -6], [-3, 0]], '#9bff6a', '#1f8a12', '#0a3000');
    eye(ctx, 0, 1, 3, '#ffffff');
  });

  // Splitter: lime cell with a visible seam
  S.splitter = mk(32, (ctx) => {
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-4, -4, 2, 0, 0, 13);
    g.addColorStop(0, '#d9ff9a'); g.addColorStop(0.6, '#33cc55'); g.addColorStop(1, '#0a5a1a');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#063010'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(0,40,10,0.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(2, -4); ctx.lineTo(-2, 4); ctx.lineTo(0, 13); ctx.stroke();
    eye(ctx, -5, 0, 3, '#ffff66'); eye(ctx, 5, 0, 3, '#ffff66');
  });

  S.fragment = mk(18, (ctx) => {
    body(ctx, [[0, 7], [7, 0], [3, -7], [-3, -7], [-7, 0]], '#c8ff7a', '#2f9a1a', '#0a3000');
    eye(ctx, 0, 0, 2.2, '#ffff66');
  });

  // Dasher: sharp orange spearhead
  S.dasher = mk(28, (ctx) => {
    body(ctx, [[0, 13], [4, 3], [12, -3], [5, -5], [3, -12], [0, -8], [-3, -12], [-5, -5], [-12, -3], [-4, 3]], '#ffa070', '#c22a00', '#400c00');
    eye(ctx, 0, 1, 3.5, '#ffffff');
  });

  // Kamikaze: spiked red mine-ship with a hot core
  S.kamikaze = mk(26, (ctx) => {
    ctx.fillStyle = '#5a0010';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a + 0.25) * 7, Math.sin(a + 0.25) * 7);
      ctx.lineTo(Math.cos(a - 0.25) * 7, Math.sin(a - 0.25) * 7);
      ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 8);
    g.addColorStop(0, '#ffdd88'); g.addColorStop(0.5, '#ff3322'); g.addColorStop(1, '#6a0010');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#2a0006'; ctx.lineWidth = 1; ctx.stroke();
  });

  // Sniper: long blue body with a scope lens
  S.sniper = mk(30, (ctx) => {
    ctx.fillStyle = '#0a1a40'; ctx.fillRect(-1.5, 4, 3, 11);
    body(ctx, [[0, 6], [5, 2], [14, -2], [5, -6], [0, -12], [-5, -6], [-14, -2], [-5, 2]], '#8ab8ff', '#1a3aa3', '#000a30');
    eye(ctx, 0, -1, 4, '#00e5ff');
  });

  // Shielder: silver/blue tank (the shield arc is drawn live)
  S.shielder = mk(32, (ctx) => {
    body(ctx, [[0, 12], [10, 9], [14, 0], [10, -11], [-10, -11], [-14, 0], [-10, 9]], '#e0ecff', '#4a5a8a', '#141a30');
    ctx.fillStyle = 'rgba(20,30,70,0.6)'; ctx.fillRect(-10, -4, 20, 4);
    eye(ctx, 0, 4, 3.5, '#66aaff');
  });

  // Minelayer: wide yellow/black hauler
  S.minelayer = mk(36, (ctx) => {
    body(ctx, [[0, 9], [14, 6], [17, -2], [12, -9], [-12, -9], [-17, -2], [-14, 6]], '#ffe066', '#a37a00', '#302200');
    ctx.fillStyle = '#1a1400';
    for (let i = -12; i <= 8; i += 8) ctx.fillRect(i, -6, 4, 9);
    eye(ctx, 0, 5, 3, '#ff6600');
  });

  // Flanker: side-entering fighter (pink)
  S.flanker = mk(28, (ctx) => {
    body(ctx, [[0, 11], [7, 4], [13, 7], [11, -4], [4, -11], [-4, -11], [-11, -4], [-13, 7], [-7, 4]], '#ff8ad8', '#a3126a', '#3a0026');
    eye(ctx, 0, -2, 3.6, '#ffffff');
  });

  // Mine: dark sphere with blinking lights (blink drawn live)
  S.mine = mk(16, (ctx) => {
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 6);
    g.addColorStop(0, '#888'); g.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#333';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.fillRect(Math.cos(a) * 7 - 1, Math.sin(a) * 7 - 1, 2, 2);
    }
  });

  // Meteor variants
  S.meteor = [0, 1, 2].map(seed => mk(40, (ctx) => {
    const n = 11;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 15 + Math.sin(seed * 7 + i * 2.3) * 3.5;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 18);
    g.addColorStop(0, '#a89a8a'); g.addColorStop(0.6, '#5a4c40'); g.addColorStop(1, '#2a2018');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(Math.sin(seed + i * 3) * 8, Math.cos(seed * 2 + i * 2) * 8, 2 + (i % 2) * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, { metal: 0, spec: 0.12, shine: 8, emissive: false, rimK: 0.25, emboss: 0.7 }));

  // Classic boss: a big magenta mothership
  S.boss = mk(84, (ctx) => {
    body(ctx, [[0, 30], [14, 22], [36, 26], [40, 6], [26, -10], [18, -30], [0, -22], [-18, -30], [-26, -10], [-40, 6], [-36, 26], [-14, 22]],
      '#ff7ad8', '#7a0060', '#2a0020');
    ctx.fillStyle = 'rgba(40,0,40,0.55)';
    ctx.fillRect(-30, 4, 60, 6);
    ctx.fillRect(-20, 14, 40, 4);
    ctx.fillStyle = '#ffd6f4';
    for (const x of [-30, -18, 18, 30]) ctx.fillRect(x - 2, 6, 4, 2);
    eye(ctx, 0, -4, 11, '#ff2266');
    eye(ctx, -22, 16, 4, '#ff88ff'); eye(ctx, 22, 16, 4, '#ff88ff');
  });

  return S;
})();

// ── Floating text (score popups, labels) ─────────────────────────────────────
class FloatingText {
  constructor() { this.items = []; }

  add(x, y, text, color = '#ffffff', size = 7, life = 800) {
    if (this.items.length > 60) this.items.shift();
    this.items.push({ x, y, text, color, size, life, max: life });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      f.y -= dt * 0.03;
      if (f.life <= 0) this.items.splice(i, 1);
    }
  }

  draw(ctx) {
    if (!this.items.length) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.items) {
      const k = f.life / f.max;
      const pop = k > 0.85 ? 1 + (k - 0.85) * 2.5 : 1;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = gameFont(Math.round(f.size * pop));
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}
