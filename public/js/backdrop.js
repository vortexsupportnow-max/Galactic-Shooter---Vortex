// ===== MENU BACKDROP =====
// The same GPU space scene as the game (nebulae, lit planets, distant suns),
// full-window behind every menu screen. It pauses while a run is on screen or
// the tab is hidden, cycles through the sectors slowly, and is skipped without
// WebGL or with "reduced effects" (the menus then keep their CSS starfield).

const MenuBackdrop = (function () {
  let canvas, renderer, bg, raf = null, last = 0, sectorTimer = 0, started = false;
  const LOG_H = 700;

  function logicalWidth() {
    return Math.max(480, Math.round(LOG_H * window.innerWidth / Math.max(1, window.innerHeight)));
  }

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
    const cap = 2.2e6; // keep the full-screen pass affordable on big monitors
    if (w * h > cap) { const k = Math.sqrt(cap / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
    canvas.width = w; canvas.height = h;
    const lw = logicalWidth();
    if (bg) { bg.W = lw; }
    renderer.resize(lw, LOG_H);
  }

  function seedScene() {
    // Open on a lit planet and a distant sun so the first frame already has depth
    bg.planets = [];
    bg._spawnGpuBody();
    const hero = bg.planets[0];
    hero.gpuType = 1; hero.r = 150; hero.x = bg.W * 0.78; hero.y = 470; hero.ring = true; hero.ringTilt = -0.35; hero.speed = 0.02;
    bg._spawnGpuBody();
    const sun = bg.planets[1];
    sun.gpuType = 3; sun.r = 40; sun.x = bg.W * 0.18; sun.y = 120; sun.speed = 0.01;
    sun.gpuA = [1, 0.86, 0.62];
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const gameOn = document.getElementById('screen-game')?.classList.contains('active');
    if (gameOn || document.hidden) { last = now; return; }
    const dt = Math.min(50, now - (last || now));
    last = now;
    sectorTimer += dt;
    if (sectorTimer > 45000) {
      sectorTimer = 0;
      bg.setSector((bg.sectorIndex + 1) % SECTORS.length);
    }
    bg.update(dt * 0.6);
    renderer.present(null, bg, dt, now);
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
