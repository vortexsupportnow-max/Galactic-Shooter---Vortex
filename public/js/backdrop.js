// ===== MENU BACKDROP =====
// The same GPU space scene as the game (nebulae, lit planets, distant suns),
// full-window behind every menu screen. It pauses while a run is on screen or
// the tab is hidden, cycles through the sectors slowly, and is skipped without
// WebGL or with "reduced effects" (the menus then keep their CSS starfield).

const MenuBackdrop = (function () {
  let canvas, renderer, bg, raf = null, last = 0, sectorTimer = 0, started = false;
  let starCanvas = null, starCtx = null, wasGame = false;
  const LOG_H = 700;

  // Logical size follows the window's real aspect ratio (no minimum width:
  // clamping it is what squeezed planets into ellipses on phones).
  function logicalWidth() {
    return Math.max(200, Math.round(LOG_H * window.innerWidth / Math.max(1, window.innerHeight)));
  }

  function activeGame() {
    try {
      if (typeof bossRushInstance !== 'undefined' && bossRushInstance && bossRushInstance.gs) return bossRushInstance;
      if (typeof gameInstance !== 'undefined' && gameInstance && gameInstance.gs) return gameInstance;
    } catch (e) { /* not loaded */ }
    return null;
  }

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    const cap = 2.2e6; // keep the full-screen pass affordable on big monitors
    if (w * h > cap) { const k = Math.sqrt(cap / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
    canvas.width = w; canvas.height = h;
    const lw = logicalWidth();
    if (bg) {
      bg.W = lw;
      for (const st of bg.stars) if (st.x > lw) st.x = Math.random() * lw;
    }
    renderer.resize(lw, LOG_H);
    // the same twinkling near-star layer the game draws, as a 1× scene
    if (!starCanvas) { starCanvas = document.createElement('canvas'); starCtx = starCanvas.getContext('2d'); }
    starCanvas.width = lw; starCanvas.height = LOG_H;
  }

  function seedScene() {
    // Open on a lit planet and a distant sun so the first frame already has depth
    bg.planets = [];
    bg._spawnGpuBody();
    const hero = bg.planets[0];
    // sized like the game's planets, relative to the narrower side
    hero.gpuType = 1; hero.r = Math.min(110, bg.W * 0.24); hero.x = bg.W * 0.8; hero.y = 500; hero.ring = true; hero.ringTilt = -0.35; hero.speed = 0.02;
    bg._spawnGpuBody();
    const sun = bg.planets[1];
    sun.gpuType = 3; sun.r = 30; sun.x = bg.W * 0.16; sun.y = 120; sun.speed = 0.01;
    sun.gpuA = [1, 0.86, 0.62];
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const gameOn = document.getElementById('screen-game')?.classList.contains('active');
    document.body.classList.toggle('in-game', !!gameOn);
    if (wasGame && !gameOn) seedScene();     // back to the menu: restore its planets
    wasGame = !!gameOn;
    const dt = Math.min(50, now - (last || now));
    last = now;
    if (document.hidden) return;
    if (gameOn) {
      // Around the playfield on wide screens: continue the game's own space
      // (same sector, same scroll), dimmed and blurred by CSS. Phones are
      // nearly all playfield, so they skip this to save battery.
      const g = activeGame();
      const touch = typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE;
      if (touch || !g || !g.background) return;
      const gb = g.background;
      if (gb.sectorIndex !== bg.sectorIndex) bg.setSector(gb.sectorIndex);
      bg.travel = gb.travel;
      bg.fade = gb.fade;
      bg.planets = [];
      bg.warp = gb.warp;
      for (const st of bg.stars) { st.y += st.speed * (dt / 16.667) * (1 + gb.warp * 9); if (st.y > LOG_H) { st.y = -5; st.x = Math.random() * bg.W; } }
    } else {
      sectorTimer += dt;
      if (sectorTimer > 45000) {
        sectorTimer = 0;
        bg.setSector((bg.sectorIndex + 1) % SECTORS.length);
      }
      bg.update(dt * 0.6);
    }
    starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
    bg._drawStars(starCtx);
    renderer.present(starCanvas, bg, dt, now);
  }

  function start() {
    if (started) return;
    started = true;
    try {
      if (window.gameSettings && window.gameSettings.lowfx) return;
      if (typeof createSpaceRenderer !== 'function') return;
      canvas = document.createElement('canvas');
      canvas.id = 'space-backdrop';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.prepend(canvas);
      renderer = createSpaceRenderer({ width: logicalWidth(), height: LOG_H });
      if (!renderer.init(canvas)) { canvas.remove(); return; }
      const prevGpu = SpaceBackground.gpu;
      SpaceBackground.gpu = true;
      bg = new SpaceBackground(logicalWidth(), LOG_H);
      SpaceBackground.gpu = prevGpu;
      bg.planetTimer = 20000;
      seedScene();
      sizeCanvas();
      window.addEventListener('resize', sizeCanvas);
      document.body.classList.add('has-backdrop');
      raf = requestAnimationFrame(frame);
    } catch (e) {
      console.warn('[backdrop] disabled:', e && e.message);
      if (canvas) canvas.remove();
      document.body.classList.remove('has-backdrop');
    }
  }

  return { start };
})();

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => MenuBackdrop.start());
else MenuBackdrop.start();
