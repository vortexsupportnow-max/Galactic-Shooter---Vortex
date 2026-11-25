// ===== POST FX (WebGL) =====
//
// When WebGL is available the game draws its 2D scene into an offscreen canvas
// with a transparent background, and this module composites the final frame on
// the visible canvas:
//
//   nebula pass   procedural nebula (domain-warped fBm, dust lanes, a galactic
//                 band) at quarter resolution, cross-faded between sectors
//   composite     shader starfield + lit planets / distant suns at full res,
//                 the 2D scene on top, bloom, shockwave distortion, chromatic
//                 aberration on hits, vignette, scanlines and film grain
//   bloom         bright-pass of the scene, separable blur at quarter res
//
// Without WebGL (or if anything here fails) the game keeps its 2D renderer.

const PostFX = (function () {
  let gl = null;
  let ready = false;
  let canvas = null;
  const W = 480, H = 700;              // logical playfield
  const NEB_W = 240, NEB_H = 350;      // nebula buffer
  const BLM_W = 240, BLM_H = 350;      // bloom buffers

  let progNeb, progBright, progBlur, progComp;
  let sceneTex, nebFbo, brightFbo, blurFbo;
  let quad;
  const waves = [];                    // shockwaves {x,y,t,dur,amp}
  let aberr = 0;
  let frame = 0;

  const COMMON = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(3.1, 1.7); a *= 0.5; }
  return v;
}
`;

  const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

  const NEB_FRAG = COMMON + `
uniform vec2 uRes;
uniform float uScroll, uTime, uMix, uSeed, uPSeed;
uniform vec3 uBase, uC0, uC1, uC2, uPBase, uP0, uP1, uP2;
vec3 nebula(vec2 q, vec3 base, vec3 c0, vec3 c1, vec3 c2, float seed){
  vec2 w = q + vec2(seed * 7.13, seed * 3.71);
  vec2 warp = vec2(fbm(w * 1.1), fbm(w * 1.1 + vec2(5.2, 1.3)));
  float n = fbm(w * 1.3 + warp * 2.2 + vec2(0.0, uTime * 0.004));
  float m = fbm(w * 2.4 - warp * 1.4 + 8.0);
  float dust = fbm(w * 3.2 + warp * 1.8 + 20.0);
  vec3 col = base;
  col += c0 * pow(n, 2.6) * 1.9;
  col += c1 * pow(m, 3.5) * 1.7;
  col += c2 * pow(warp.x * n, 2.0) * 1.5;
  col += mix(c0, vec3(1.0), 0.6) * pow(smoothstep(0.62, 0.95, n * 1.05), 3.0) * 0.7;
  col *= 1.0 - smoothstep(0.48, 0.78, dust) * 0.75;
  float band = exp(-pow(q.x * 0.55 + q.y * 0.32 - 0.15 * sin(q.y * 0.7), 2.0) * 3.0);
  col += mix(c0, vec3(1.0, 0.95, 0.9), 0.7) * band * pow(fbm(q * 7.0 + 20.0), 2.0) * 0.4;
  return col;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (uv - 0.5) * vec2(${(W / H).toFixed(4)}, 1.0) * 2.6;
  q.y += uScroll;
  vec3 a = nebula(q, uBase, uC0, uC1, uC2, uSeed);
  if (uMix < 0.999) a = mix(nebula(q, uPBase, uP0, uP1, uP2, uPSeed), a, uMix);
  gl_FragColor = vec4(a, 1.0);
}
`;

  const BRIGHT_FRAG = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(uTex, vUv);
  float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c.rgb * smoothstep(0.5, 1.0, l), 1.0);
}
`;

  const BLUR_FRAG = `
precision mediump float;
uniform sampler2D uTex;
uniform vec2 uDir;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(uTex, vUv).rgb * 0.227;
  c += texture2D(uTex, vUv + uDir * 1.38).rgb * 0.316;
  c += texture2D(uTex, vUv - uDir * 1.38).rgb * 0.316;
  c += texture2D(uTex, vUv + uDir * 3.23).rgb * 0.070;
  c += texture2D(uTex, vUv - uDir * 3.23).rgb * 0.070;
  gl_FragColor = vec4(c, 1.0);
}
`;

  const COMP_FRAG = COMMON + `
uniform sampler2D uScene, uNeb, uBloom;
uniform vec2 uRes;
uniform float uTime, uAberr, uBloomK, uTravel, uFx;
uniform vec4 uWaves[8];
uniform vec4 uPl[3];   // x, y (logical px), radius, type (0 rock, 1 gas, 2 ocean, 3 sun; <0 none)
uniform vec3 uPlA[3];
uniform vec3 uPlB[3];
uniform vec4 uPlX[3];  // seed, ring tilt, has ring, spin
varying vec2 vUv;

const vec3 LIGHT = vec3(-0.55, 0.45, 0.7);

float stars(vec2 p, float cell, float thresh){
  vec2 g = p / cell;
  vec2 i = floor(g);
  float h = hash(i);
  if (h < thresh) return 0.0;
  vec2 c = vec2(hash(i + 1.7), hash(i + 9.3)) * 0.7 + 0.15;
  float d = length(fract(g) - c) * cell;
  float b = (h - thresh) / (1.0 - thresh);
  float tw = 0.65 + 0.35 * sin(uTime * (1.5 + h * 3.0) + h * 60.0);
  return exp(-d * d * 1.6) * b * tw;
}

vec4 body(vec2 px, vec4 P, vec3 A, vec3 B, vec4 X){
  vec2 d = (px - P.xy) / P.z;
  float r2 = dot(d, d);
  vec3 L = normalize(LIGHT);
  if (P.w > 2.5) {                     // distant sun: glow + diffraction spikes
    float r = sqrt(r2);
    float core = exp(-r2 * 60.0);
    float glow = exp(-r * 2.6) * 0.75;
    float spikes = exp(-abs(d.x) * 70.0) * exp(-abs(d.y) * 1.3) + exp(-abs(d.y) * 70.0) * exp(-abs(d.x) * 1.3);
    return vec4(A * glow + vec3(1.0) * (core * 1.6 + spikes * 0.55), 0.0);
  }
  if (r2 > 6.0) return vec4(0.0);
  vec3 c = vec3(0.0);
  float a = 0.0;

  // ring (tilted ellipse): back half first, front half after the planet
  float ringM = 0.0;
  vec3 ringC = vec3(0.0);
  bool front = false;
  if (X.z > 0.5) {
    float ct = cos(X.y), st = sin(X.y);
    vec2 e = vec2(ct * d.x - st * d.y, st * d.x + ct * d.y);
    front = e.y > 0.0;
    e.y /= 0.27;
    float rr = length(e);
    ringM = smoothstep(1.32, 1.42, rr) * (1.0 - smoothstep(2.05, 2.25, rr));
    // fine bands of dust and ice with a darker gap (Cassini-like)
    float bands = noise(vec2(rr * 34.0, X.x * 3.0)) * 0.7 + noise(vec2(rr * 90.0, X.x)) * 0.3;
    float gap = 1.0 - smoothstep(0.0, 0.05, abs(rr - 1.78)) ;
    ringM *= (0.25 + 0.6 * bands) * (1.0 - gap * 0.85);
    ringC = mix(A, vec3(0.9, 0.85, 0.78), 0.45) * (0.5 + 0.5 * bands);
    // planet's shadow falls on the far side of the ring
    if (!front && length(d) < 1.05) ringC *= 0.25;
    if (!front) { c = ringC * ringM * 0.75; a = ringM * 0.75; }
  }

  if (r2 < 1.0) {
    vec3 n = vec3(d.x, -d.y, sqrt(1.0 - r2));
    float lon = atan(n.x, n.z) + uTime * X.w;
    float lat = asin(clamp(n.y, -1.0, 1.0));
    vec2 sp = vec2(lon * 1.6, lat * 2.0) + X.x * 13.0;
    vec3 surf;
    float spec = 0.0;
    if (P.w < 0.5) {                   // rocky / volcanic
      float h = fbm(sp * 2.0);
      surf = mix(B, A, smoothstep(0.3, 0.72, h));
      surf *= 0.7 + 0.6 * fbm(sp * 7.0);
      surf += A * smoothstep(0.78, 0.9, fbm(sp * 4.0 + 5.0)) * 0.6;
    } else if (P.w < 1.5) {            // gas giant with a storm
      float t = lat * 6.0 + fbm(sp * vec2(0.8, 4.0) + fbm(sp * 3.0) * 0.6) * 2.4;
      surf = mix(A, B, 0.5 + 0.35 * sin(t * 3.0));
      surf = mix(surf, vec3(1.0, 0.95, 0.85), 0.12 + 0.12 * sin(t * 7.0));
      float sd = length((vec2(mod(lon, 6.2832) - 1.2, lat - 0.35)) * vec2(1.0, 2.2));
      surf = mix(surf, B * 1.35, smoothstep(0.38, 0.18, sd) * 0.75);
    } else {                           // ocean world with clouds
      float h = fbm(sp * 2.2 + vec2(fbm(sp * 4.0), fbm(sp * 4.0 + 3.0)) * 0.9);
      float land = smoothstep(0.47, 0.56, h);
      surf = mix(B * 0.55, A, land);
      spec = 1.0 - land;
      float cl = fbm(sp * 3.0 + vec2(uTime * 0.02, 0.0));
      surf = mix(surf, vec3(1.0), smoothstep(0.55, 0.78, cl) * 0.85);
    }
    float diff = dot(n, L);
    float lit = smoothstep(-0.18, 0.35, diff);
    vec3 col = surf * (0.03 + 1.15 * max(diff, 0.0)) * lit + surf * 0.015;
    col += vec3(1.0) * pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 40.0) * 0.6 * spec * lit;
    float rim = pow(1.0 - n.z, 2.6);
    col += mix(A, vec3(0.6, 0.8, 1.0), 0.5) * rim * 1.1 * smoothstep(-0.35, 0.45, diff);
    c = col * 0.85; a = 1.0;   // a touch dimmer than the action in front
  } else {
    // atmospheric halo, brighter on the lit side
    float r = sqrt(r2);
    vec2 dn = d / r;
    float side = dot(normalize(vec3(dn.x, -dn.y, 0.15)), L) * 0.5 + 0.5;
    c += mix(A, vec3(0.6, 0.8, 1.0), 0.5) * exp(-(r - 1.0) * 11.0) * 0.6 * side;
  }

  if (front && ringM > 0.0) {
    float m = ringM * 0.75;
    c = ringC * m + c * (1.0 - m);
    a = m + a * (1.0 - m);
  }
  return vec4(c, a);
}

void main(){
  vec2 uv = vUv;
  float asp = ${(W / H).toFixed(4)};

  // shockwaves: refract the whole frame around expanding rings
  if (uFx > 0.5) {
    for (int i = 0; i < 8; i++) {
      vec4 w = uWaves[i];
      if (w.w > 0.0) {
        vec2 dv = (uv - w.xy) * vec2(asp, 1.0);
        float dist = length(dv) + 1e-5;
        float f = exp(-pow((dist - w.z) * 22.0, 2.0)) * w.w;
        uv -= (dv / dist) * f / vec2(asp, 1.0);
      }
    }
  }

  vec2 px = vec2(uv.x * ${W}.0, (1.0 - uv.y) * ${H}.0);

  // background: nebula + two parallax star layers + planets / suns
  vec3 bg = texture2D(uNeb, uv).rgb;
  vec3 warm = vec3(1.0, 0.85, 0.7), cool = vec3(0.7, 0.82, 1.0);
  float s1 = stars(vec2(px.x, px.y - uTravel * 0.25), 3.0, 0.985);
  float s2 = stars(vec2(px.x + 50.0, px.y - uTravel * 0.6), 5.0, 0.992);
  bg += mix(cool, warm, hash(floor(px / 3.0))) * s1 * 0.9;
  bg += mix(cool, warm, hash(floor(px / 5.0) + 3.0)) * s2 * 1.3;
  for (int i = 0; i < 3; i++) {
    if (uPl[i].w >= 0.0) {
      vec4 b = body(px, uPl[i], uPlA[i], uPlB[i], uPlX[i]);
      bg = bg * (1.0 - b.a) + b.rgb;
    }
  }

  // game layer (premultiplied), with chromatic split on hits
  vec2 ca = (uv - 0.5) * uAberr * 0.014;
  vec4 s = texture2D(uScene, uv);
  vec3 sc = vec3(texture2D(uScene, uv + ca).r, s.g, texture2D(uScene, uv - ca).b);
  vec3 col = sc + bg * (1.0 - s.a);
  col += texture2D(uBloom, uv).rgb * uBloomK;

  vec2 vq = vUv - 0.5;
  col *= 1.0 - dot(vq, vq) * 0.85;
  col *= 0.965 + 0.035 * sin(vUv.y * ${H}.0 * 3.14159);
  col += (hash(vUv * uRes + fract(uTime * 7.0) * 100.0) - 0.5) * 0.03 * uFx;
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}
`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function program(fragSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      p.u[name] = gl.getUniformLocation(p, info.name);
    }
    return p;
  }

  function texture(w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }

  function fbo(w, h) {
    const tex = texture(w, h);
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete');
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { f, tex, w, h };
  }

  function init(displayCanvas) {
    if (ready) return canvas === displayCanvas;
    try {
      if (new URLSearchParams(location.search).has('nogl')) return false;
      const ctx = displayCanvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: false })
        || displayCanvas.getContext('experimental-webgl');
      if (!ctx) return false;
      gl = ctx;
      canvas = displayCanvas;
      progNeb = program(NEB_FRAG);
      progBright = program(BRIGHT_FRAG);
      progBlur = program(BLUR_FRAG);
      progComp = program(COMP_FRAG);
      sceneTex = texture(0, 0);
      nebFbo = fbo(NEB_W, NEB_H);
      brightFbo = fbo(BLM_W, BLM_H);
      blurFbo = fbo(BLM_W, BLM_H);
      quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      displayCanvas.addEventListener('webglcontextlost', e => { e.preventDefault(); ready = false; });
      ready = true;
      return true;
    } catch (e) {
      console.warn('[postfx] WebGL unavailable, using 2D renderer:', e && e.message);
      gl = null;
      return false;
    }
  }

  function hexRgb(hex) {
    const { r, g, b } = FX.hexToRgb(hex);
    return [r / 255, g / 255, b / 255];
  }

  const paletteCache = new Map();
  function palette(sector) {
    let p = paletteCache.get(sector);
    if (!p) {
      p = { base: hexRgb(sector.base), c: sector.nebula.map(hexRgb) };
      paletteCache.set(sector, p);
    }
    return p;
  }

  function draw(target, prog, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.f : null);
    gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    setup(prog.u);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function bindTex(unit, tex, loc) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  // Shockwave at logical (x, y). size ~ explosion size (1 = small kill).
  function shock(x, y, size = 1) {
    if (!ready) return;
    if (waves.length >= 8) waves.shift();
    waves.push({ x: x / W, y: 1 - y / H, t: 0, dur: 550 + size * 110, amp: Math.min(0.035, 0.007 * size) });
  }

  function kick(k = 1) { aberr = Math.max(aberr, k); }

  function present(sceneCanvas, bg, dt, now) {
    if (!ready) return false;
    const lowfx = !!(window.gameSettings && window.gameSettings.lowfx);
    const t = now / 1000;
    frame++;

    for (let i = waves.length - 1; i >= 0; i--) { waves[i].t += dt; if (waves[i].t >= waves[i].dur) waves.splice(i, 1); }
    aberr = Math.max(0, aberr - dt / 350);

    // 1. scene upload
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneCanvas);

    // 2. nebula (every other frame on reduced effects)
    if (!lowfx || frame % 3 === 0 || frame < 3) {
      const cur = palette(bg.sector);
      const prev = palette(bg.prevSector || bg.sector);
      draw(nebFbo, progNeb, u => {
        gl.uniform2f(u.uRes, NEB_W, NEB_H);
        gl.uniform1f(u.uScroll, bg.travel / H * 0.9);
        gl.uniform1f(u.uTime, t);
        gl.uniform1f(u.uMix, bg.fade);
        gl.uniform1f(u.uSeed, (bg.sectorIndex * 0.37) % 1);
        gl.uniform1f(u.uPSeed, ((bg.prevSectorIndex != null ? bg.prevSectorIndex : bg.sectorIndex) * 0.37) % 1);
        gl.uniform3fv(u.uBase, cur.base); gl.uniform3fv(u.uC0, cur.c[0]); gl.uniform3fv(u.uC1, cur.c[1]); gl.uniform3fv(u.uC2, cur.c[2]);
        gl.uniform3fv(u.uPBase, prev.base); gl.uniform3fv(u.uP0, prev.c[0]); gl.uniform3fv(u.uP1, prev.c[1]); gl.uniform3fv(u.uP2, prev.c[2]);
      });
    }

    // 3. bloom
    const bloomK = lowfx ? 0 : 0.85;
    if (bloomK > 0) {
      draw(brightFbo, progBright, u => bindTex(0, sceneTex, u.uTex));
      draw(blurFbo, progBlur, u => { bindTex(0, brightFbo.tex, u.uTex); gl.uniform2f(u.uDir, 1.6 / BLM_W, 0); });
      draw(brightFbo, progBlur, u => { bindTex(0, blurFbo.tex, u.uTex); gl.uniform2f(u.uDir, 0, 1.6 / BLM_H); });
    }

    // 4. composite
    const pl = new Float32Array(12).fill(0);
    const pa = new Float32Array(9), pb = new Float32Array(9), px = new Float32Array(12);
    for (let i = 0; i < 3; i++) pl[i * 4 + 3] = -1;
    const bodies = bg.planets.slice(0, 3);
    bodies.forEach((p, i) => {
      pl.set([p.x, p.y, p.r, p.gpuType], i * 4);
      pa.set(p.gpuA, i * 3);
      pb.set(p.gpuB, i * 3);
      px.set([p.seed, p.ringTilt, p.ring ? 1 : 0, p.spin], i * 4);
    });
    const wv = new Float32Array(32);
    waves.forEach((w, i) => {
      const k = w.t / w.dur;
      wv.set([w.x, w.y, 0.02 + k * 0.42, w.amp * (1 - k)], i * 4);
    });
    draw(null, progComp, u => {
      bindTex(0, sceneTex, u.uScene);
      bindTex(1, nebFbo.tex, u.uNeb);
      bindTex(2, brightFbo.tex, u.uBloom);
      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uAberr, lowfx ? 0 : aberr);
      gl.uniform1f(u.uBloomK, bloomK);
      gl.uniform1f(u.uTravel, bg.travel);
      gl.uniform1f(u.uFx, lowfx ? 0 : 1);
      gl.uniform4fv(u.uWaves, wv);
      gl.uniform4fv(u.uPl, pl);
      gl.uniform3fv(u.uPlA, pa);
      gl.uniform3fv(u.uPlB, pb);
      gl.uniform4fv(u.uPlX, px);
    });
    return true;
  }

  return { init, present, shock, kick, get active() { return ready; } };
})();
