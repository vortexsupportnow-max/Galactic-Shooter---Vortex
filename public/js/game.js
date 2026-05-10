// ===== GALACTIC GAME ENGINE =====

class GalacticGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.hud = new HUD();
    this.animId = null;
    this.lastTime = 0;
    this.gs = null;

    // Starfield layers
    this.stars = this._initStars();

    this._boundLoop = this._loop.bind(this);
    this._setupInput();
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
    this.mouseX = 240; this.mouseY = 350;
    this.touchFire = false;

    document.addEventListener('keydown', e => {
      this.keys[e.key] = true;
      if (!this.gs) return;
      if (e.key === 'q' || e.key === 'Q') this._useAbility(0);
      if (e.key === 'w' || e.key === 'W') this._useAbility(1);
      if (e.key === 'e' || e.key === 'E') this._useAbility(2);
      if (e.key === 'Escape') this._pauseToggle();
      e.preventDefault && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key) && e.preventDefault();
    });
    document.addEventListener('keyup', e => { this.keys[e.key] = false; });

    // Touch ability buttons
    document.querySelectorAll('.touch-ability-btn').forEach(btn => {
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        this._useAbility(parseInt(btn.dataset.slot));
      });
    });

    // Fire button
    const fireBtn = document.getElementById('fire-btn');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', e => { e.preventDefault(); this.touchFire = true; });
      fireBtn.addEventListener('touchend', e => { e.preventDefault(); this.touchFire = false; });
    }

    // Joystick
    this._setupJoystick();
  }

  _setupJoystick() {
    const zone = document.getElementById('joystick-zone');
    const stick = document.getElementById('joystick-stick');
    if (!zone || !stick) return;

    let active = false, startX = 0, startY = 0;
    const maxR = 35;

    const onStart = e => {
      const t = e.touches ? e.touches[0] : e;
      const rect = zone.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
      active = true;
      e.preventDefault();
    };
    const onMove = e => {
      if (!active) return;
      const t = e.touches ? e.touches[0] : e;
      let dx = t.clientX - startX;
      let dy = t.clientY - startY;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > maxR) { dx = dx/d*maxR; dy = dy/d*maxR; }
      stick.style.transform = `translate(${dx}px,${dy}px)`;
      if (this.gs) {
        this.gs.player.joystickVX = dx / maxR;
        this.gs.player.joystickVY = dy / maxR;
      }
      e.preventDefault();
    };
    const onEnd = e => {
      active = false;
      stick.style.transform = '';
      if (this.gs) { this.gs.player.joystickVX = 0; this.gs.player.joystickVY = 0; }
    };

    zone.addEventListener('touchstart', onStart, { passive: false });
    zone.addEventListener('touchmove', onMove, { passive: false });
    zone.addEventListener('touchend', onEnd);
  }

  start(abilitySlots = [null, null, null]) {
    if (this.animId) cancelAnimationFrame(this.animId);

    const player = new Player(480, 700);
    this.gs = {
      wave: 1,
      score: 0,
      combo: 1,
      comboTimer: 0,
      player,
      enemies: [],
      bullets: [],
      particles: new ParticleSystem(),
      explosions: [],
      powerUps: [],
      boss: null,
      abilitySlots: abilitySlots.map(a => a ? { ...a } : null),
      paused: false,
      gameOver: false,
      waveComplete: false,
      waveCountdown: 0,
      bossWave: false,
      enemiesKilled: 0,
      coinsCollected: 0,
      waveTotal: 0,
      timeSlow: false, timeSlowTimer: 0,
      freezeActive: false, freezeTimer: 0,
      empActive: false, empTimer: 0,
      blackHole: null,
      rainOfFire: null,
      storm: null,
      singularity: null,
      turret: null,
      keys: this.keys
    };

    this._spawnWave(1);
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.animId = null;
    this.gs = null;
  }

  _pauseToggle() {
    if (!this.gs || this.gs.gameOver) return;
    this.gs.paused = !this.gs.paused;
  }

  _loop(now) {
    this.animId = requestAnimationFrame(this._boundLoop);
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;

    if (!this.gs) return;
    if (!this.gs.paused && !this.gs.gameOver) this._update(dt, now);
    this._render(now);
  }

  _update(dt, now) {
    const gs = this.gs;

    // Auto-fire with touch
    if (this.touchFire || this.keys[' '] || this.keys['z'] || this.keys['Z']) {
      gs.player.shoot(now, gs.bullets);
    }
    // Auto-fire if any direction key held
    if (this.keys['ArrowLeft'] || this.keys['ArrowRight'] || this.keys['ArrowUp'] || this.keys['ArrowDown'] ||
        this.keys['a'] || this.keys['d'] || this.keys['w'] || this.keys['s'] ||
        this.keys['A'] || this.keys['D'] || this.keys['W'] || this.keys['S']) {
      gs.player.shoot(now, gs.bullets);
    }
    // Also shoot on its own timer
    gs.player.shoot(now, gs.bullets);

    // Update player
    gs.player.update(this.keys, dt, now);

    // Update global ability effects
    if (gs.timeSlow)    { gs.timeSlowTimer    -= dt; if (gs.timeSlowTimer <= 0) gs.timeSlow = false; }
    if (gs.freezeActive){ gs.freezeTimer      -= dt; if (gs.freezeTimer <= 0) { gs.freezeActive = false; for (const e of gs.enemies) e.frozen = false; if (gs.boss) gs.boss.frozen = false; } }
    if (gs.empActive)   { gs.empTimer         -= dt; if (gs.empTimer <= 0) { gs.empActive = false; for (const e of gs.enemies) e.stunned = false; if (gs.boss) gs.boss.stunned = false; } }

    // Black hole
    if (gs.blackHole) {
      gs.blackHole.timer -= dt;
      for (const e of gs.enemies) {
        const dx = gs.blackHole.x - e.x, dy = gs.blackHole.y - e.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        e.x += (dx / d) * 2;
        e.y += (dy / d) * 2;
        e.hp -= gs.blackHole.damage * (dt / 16);
      }
      if (gs.blackHole.timer <= 0) gs.blackHole = null;
    }

    // Rain of fire
    if (gs.rainOfFire) {
      gs.rainOfFire.timer -= dt;
      gs.rainOfFire.lastSpawn += dt;
      if (gs.rainOfFire.lastSpawn >= gs.rainOfFire.interval) {
        gs.rainOfFire.lastSpawn = 0;
        const x = 20 + Math.random() * 440;
        gs.bullets.push(new Bullet(x, 0, 0, 6, gs.rainOfFire.damage, 'player'));
      }
      if (gs.rainOfFire.timer <= 0) gs.rainOfFire = null;
    }

    // Storm
    if (gs.storm) {
      gs.storm.timer -= dt;
      gs.storm.lastStrike += dt;
      if (gs.storm.lastStrike >= gs.storm.interval) {
        gs.storm.lastStrike = 0;
        const targets = [...gs.enemies, ...(gs.boss ? [gs.boss] : [])];
        if (targets.length > 0) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          t.hp -= gs.storm.damage;
          gs.particles.emit(t.x, t.y, 15, '#ffff44', { speed: 5 });
        }
      }
      if (gs.storm.timer <= 0) gs.storm = null;
    }

    // Singularity
    if (gs.singularity) {
      gs.singularity.timer -= dt;
      gs.singularity.radius = Math.min(gs.singularity.maxRadius, gs.singularity.radius + gs.singularity.growRate);
      for (let i = gs.enemies.length - 1; i >= 0; i--) {
        const e = gs.enemies[i];
        const dx = gs.singularity.x - e.x, dy = gs.singularity.y - e.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < gs.singularity.radius) { e.hp = 0; }
        else { e.x += (dx/d) * 1.5; e.y += (dy/d) * 1.5; }
      }
      if (gs.singularity.timer <= 0) gs.singularity = null;
    }

    // Turret
    if (gs.turret) {
      gs.turret.timer -= dt;
      gs.turret.lastShot += dt;
      if (gs.turret.lastShot >= gs.turret.fireRate) {
        gs.turret.lastShot = 0;
        const targets = [...gs.enemies, ...(gs.boss ? [gs.boss] : [])];
        if (targets.length > 0) {
          const t = targets[0];
          const dx = t.x - gs.turret.x, dy = t.y - gs.turret.y;
          const d = Math.sqrt(dx*dx + dy*dy) || 1;
          gs.bullets.push(new Bullet(gs.turret.x, gs.turret.y, dx/d*7, dy/d*7, gs.turret.damage, 'player'));
        }
      }
      if (gs.turret.timer <= 0) gs.turret = null;
    }

    // Laser damage
    if (gs.player.laserActive) {
      for (const e of gs.enemies) {
        if (Math.abs(e.x - gs.player.x) < 16) {
          e.hp -= gs.player.laserDamage * (dt / 16);
          gs.particles.emit(e.x, e.y, 1, '#ff0000', { speed: 2, decay: 0.1 });
        }
      }
      if (gs.boss && Math.abs(gs.boss.x - gs.player.x) < 24) {
        gs.boss.hp -= gs.player.laserDamage * (dt / 16);
      }
    }

    // Drone shooting
    if (gs.player.droneActive) {
      const droneX = gs.player.x + Math.cos(gs.player.droneAngle) * 55;
      const droneY = gs.player.y + Math.sin(gs.player.droneAngle) * 55;
      const targets = [...gs.enemies, ...(gs.boss ? [gs.boss] : [])];
      if (targets.length > 0 && now % 500 < 17) {
        const t = targets[0];
        const dx = t.x - droneX, dy = t.y - droneY;
        const d = Math.sqrt(dx*dx+dy*dy)||1;
        gs.bullets.push(new Bullet(droneX, droneY, dx/d*7, dy/d*7, gs.player.droneDamage, 'player'));
      }
    }

    // Vortex damage
    if (gs.player.vortexActive) {
      for (const e of gs.enemies) {
        const dx = e.x - gs.player.x, dy = e.y - gs.player.y;
        const d = Math.sqrt(dx*dx+dy*dy);
        if (d < 50) {
          e.hp -= gs.player.vortexDamage * (dt / 16);
          gs.particles.emit(e.x, e.y, 2, '#00ffff', { speed: 3, decay: 0.06 });
        }
      }
    }

    // Update bullets
    for (let i = gs.bullets.length - 1; i >= 0; i--) {
      const b = gs.bullets[i];
      b.update(dt, gs.enemies, gs.boss);

      // Magnetic field - deflect enemy bullets
      if (b.owner === 'enemy' && gs.player.magneticField) {
        const dx = b.x - gs.player.x, dy = b.y - gs.player.y;
        const d = Math.sqrt(dx*dx+dy*dy);
        if (d < 70) {
          b.vx += (dx/d) * 0.5;
          b.vy += (dy/d) * 0.5;
        }
      }

      // Gravity well - pull enemy bullets away from player
      if (b.owner === 'enemy' && gs.player.gravityWell) {
        const dx = b.x - gs.player.x, dy = b.y - gs.player.y;
        const d = Math.sqrt(dx*dx+dy*dy)||1;
        if (d < 80) { b.vx += (dx/d) * 1.5; b.vy += (dy/d) * 1.5; }
      }

      if (b.dead) { gs.bullets.splice(i, 1); continue; }
    }

    // Collision: player bullets vs enemies
    for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
      const b = gs.bullets[bi];
      if (b.owner !== 'player') continue;

      let hit = false;
      for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
        const e = gs.enemies[ei];
        if (this._rectOverlap(b, e)) {
          e.hp -= b.damage;
          gs.particles.emit(e.x, e.y, 5, '#ff8800', { speed: 3, decay: 0.05 });
          Sounds.hit();
          if (!b.piercing) { b.dead = true; hit = true; }
          if (e.hp <= 0) {
            this._killEnemy(e, ei);
          }
          if (!b.piercing) break;
        }
      }

      // vs boss
      if (!b.dead && gs.boss && this._rectOverlap(b, gs.boss)) {
        gs.boss.hp -= b.damage;
        gs.particles.emit(gs.boss.x, gs.boss.y, 8, '#ff00aa', { speed: 4 });
        Sounds.hit();
        if (!b.piercing) b.dead = true;
        if (gs.boss.hp <= 0) this._killBoss();
      }
    }

    // Collision: enemy bullets vs player
    for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
      const b = gs.bullets[bi];
      if (b.owner !== 'enemy') continue;
      if (this._rectOverlap(b, gs.player)) {
        const hit = gs.player.takeDamage(b.damage);
        if (hit) {
          gs.particles.emit(gs.player.x, gs.player.y, 12, '#ff2244', { speed: 4 });
          Sounds.hit();
          // Combo reset on damage
          gs.combo = 1;
          gs.comboTimer = 0;
        }
        b.dead = true;
        if (gs.player.hp <= 0) { this._playerDeath(); return; }
      }
    }

    // Player vs enemies (overlap)
    for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
      const e = gs.enemies[ei];
      const dx = e.x - gs.player.x, dy = e.y - gs.player.y;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) {
        const hit = gs.player.takeDamage(e.damage * (dt / 500));
        if (hit) { gs.combo = 1; }
      }
    }

    // Combo timer
    if (gs.combo > 1) {
      gs.comboTimer += dt;
      if (gs.comboTimer > 3000) { gs.combo = 1; gs.comboTimer = 0; }
    }

    // Update enemies
    for (let i = gs.enemies.length - 1; i >= 0; i--) {
      gs.enemies[i].update(dt, gs.bullets, gs.timeSlow);
      if (gs.enemies[i].dead) gs.enemies.splice(i, 1);
    }

    // Update boss
    if (gs.boss) {
      gs.boss.update(dt, gs.bullets, gs.timeSlow);
      if (gs.boss.dead) gs.boss = null;
    }

    // Update power-ups
    for (let i = gs.powerUps.length - 1; i >= 0; i--) {
      const pu = gs.powerUps[i];
      pu.update(dt);
      if (pu.dead) { gs.powerUps.splice(i, 1); continue; }
      if (pu.checkCollision(gs.player)) {
        // Try to assign to empty slot
        let assigned = false;
        for (let s = 0; s < 3; s++) {
          if (!gs.abilitySlots[s]) {
            const ability = ABILITIES[pu.abilityId];
            if (ability) {
              gs.abilitySlots[s] = { ...ability, level: 1 };
              assigned = true;
            }
            break;
          }
        }
        gs.powerUps.splice(i, 1);
        if (assigned) Sounds.powerup();
      }
    }

    // Update particles
    gs.particles.update();

    // Update explosions
    for (let i = gs.explosions.length - 1; i >= 0; i--) {
      gs.explosions[i].update(dt);
      if (gs.explosions[i].dead) gs.explosions.splice(i, 1);
    }

    // Check wave complete
    if (!gs.waveComplete && !gs.bossWave && gs.enemies.length === 0 && !gs.boss) {
      this._checkWaveComplete();
    }

    // Handle wave countdown
    if (gs.waveComplete) {
      gs.waveCountdown -= dt;
      if (gs.waveCountdown <= 0) {
        gs.waveComplete = false;
        gs.wave++;
        // Award wave coins
        gs.coinsCollected += gs.wave * 10;
        if (gs.wave % 5 === 0) {
          gs.bossWave = true;
          this._spawnBoss();
        } else {
          this._spawnWave(gs.wave);
        }
      }
    }

    // Remove dead bullets
    for (let i = gs.bullets.length - 1; i >= 0; i--) {
      if (gs.bullets[i].dead) gs.bullets.splice(i, 1);
    }

    // Update stars
    for (const s of this.stars) {
      s.y += s.speed;
      if (s.y > 700) { s.y = -5; s.x = Math.random() * 480; }
    }
  }

  _rectOverlap(a, b) {
    const aw = (a.width || 4) / 2, ah = (a.height || 10) / 2;
    const bw = (b.width || 20) / 2, bh = (b.height || 20) / 2;
    return Math.abs(a.x - b.x) < aw + bw && Math.abs(a.y - b.y) < ah + bh;
  }

  _killEnemy(enemy, index) {
    const gs = this.gs;
    gs.enemies.splice(index, 1);
    gs.enemiesKilled++;

    // Score with combo
    const pts = enemy.score * gs.combo;
    gs.score += pts;
    gs.coinsCollected += enemy.coinDrop;

    // Combo increase
    const prevCombo = gs.combo;
    gs.combo = Math.min(16, gs.combo + 1);
    gs.comboTimer = 0;
    if (gs.combo > prevCombo) this.hud.triggerComboFlash();

    gs.explosions.push(new Explosion(enemy.x, enemy.y, 1 + (enemy.type === 'heavy' ? 0.5 : 0)));
    gs.particles.emit(enemy.x, enemy.y, 12, '#ff8800', { speed: 4, decay: 0.03 });
    Sounds.explosion(false);

    // Gem drop
    if (Math.random() < enemy.gemDropChance) gs.coinsCollected += 1; // simplified: give 1 gem

    // Power-up drop (5% chance)
    if (Math.random() < 0.05) {
      const abilityIds = Object.keys(ABILITIES);
      const abilityId = abilityIds[Math.floor(Math.random() * abilityIds.length)];
      gs.powerUps.push(new PowerUp(enemy.x, enemy.y, abilityId));
    }
  }

  _killBoss() {
    const gs = this.gs;
    const pts = 5000 * gs.wave;
    gs.score += pts;
    gs.coinsCollected += 100;
    gs.explosions.push(new Explosion(gs.boss.x, gs.boss.y, 3));
    gs.particles.emit(gs.boss.x, gs.boss.y, 80, '#ff00aa', { speed: 8, decay: 0.015 });
    Sounds.explosion(true);
    gs.boss = null;
    gs.bossWave = false;
    gs.enemiesKilled++;

    // Drop gems (5)
    for (let i = 0; i < 5; i++) {
      const abilityIds = Object.keys(ABILITIES);
      const abilityId = abilityIds[Math.floor(Math.random() * abilityIds.length)];
      gs.powerUps.push(new PowerUp(240 + (Math.random()-0.5)*100, 150 + i*20, abilityId));
    }

    gs.waveComplete = true;
    gs.waveCountdown = 3000;
    Sounds.levelup();
  }

  _playerDeath() {
    const gs = this.gs;
    gs.particles.emit(gs.player.x, gs.player.y, 40, '#ff2244', { speed: 6, decay: 0.02 });
    gs.explosions.push(new Explosion(gs.player.x, gs.player.y, 2));
    Sounds.die();

    // Phoenix ability
    if (gs.player.phoenixReady) {
      gs.player.phoenixReady = false;
      gs.player.hp = gs.player.phoenixHeal;
      gs.player.shielded = true;
      gs.player.shieldTimer = 3000;
      gs.particles.emit(gs.player.x, gs.player.y, 30, '#ff8800', { speed: 5 });
      Sounds.levelup();
      return;
    }

    gs.player.lives--;
    if (gs.player.lives > 0) {
      gs.player.hp = gs.player.maxHp;
      gs.player.shielded = true;
      gs.player.shieldTimer = 3000;
      gs.player.invulnTimer = 3000;
    } else {
      gs.gameOver = true;
      this._onGameOver();
    }
  }

  _checkWaveComplete() {
    const gs = this.gs;
    gs.waveComplete = true;
    gs.waveCountdown = 3000;
    Sounds.levelup();
  }

  _spawnWave(wave) {
    const gs = this.gs;
    const config = this._waveConfig(wave);
    gs.enemies = [];

    const rows = Math.ceil(config.count / 8);
    let spawned = 0;
    for (let row = 0; row < rows && spawned < config.count; row++) {
      const perRow = Math.min(8, config.count - spawned);
      for (let col = 0; col < perRow; col++) {
        let type = 'basic';
        if (wave >= 3 && Math.random() < 0.25) type = 'medium';
        if (wave >= 6 && Math.random() < 0.15) type = 'heavy';
        const x = 40 + col * (400 / (perRow - 1 || 1));
        const y = -40 - row * 60;
        gs.enemies.push(new Enemy(type, x, y, wave));
        spawned++;
      }
    }
    gs.waveTotal = spawned;
    gs.bossWave = false;
  }

  _spawnBoss() {
    const gs = this.gs;
    gs.boss = new Boss(gs.wave);
    gs.enemies = [];
  }

  _waveConfig(wave) {
    return {
      count: Math.min(5 + wave * 2, 40),
      enemySpeed: 1 + wave * 0.1,
      enemyHP: 30 + wave * 10,
      spawnInterval: Math.max(200, 800 - wave * 20)
    };
  }

  _useAbility(slot) {
    const gs = this.gs;
    if (!gs || gs.gameOver || gs.paused) return;
    const ability = gs.abilitySlots[slot];
    if (!ability) return;
    const def = ABILITIES[ability.id];
    if (!def) return;
    def.apply(gs, ability.level || 1);
    gs.abilitySlots[slot] = null; // consume
    Sounds.abilityUse();
  }

  _render(now) {
    const ctx = this.ctx;
    const gs = this.gs;
    ctx.clearRect(0, 0, 480, 700);

    // Background
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, 480, 700);

    // Starfield
    for (const s of this.stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    if (!gs) return;

    // Singularity visual
    if (gs.singularity) {
      ctx.save();
      const sg = ctx.createRadialGradient(gs.singularity.x, gs.singularity.y, 0, gs.singularity.x, gs.singularity.y, gs.singularity.radius);
      sg.addColorStop(0, 'rgba(0,0,0,1)');
      sg.addColorStop(0.7, 'rgba(80,0,120,0.6)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(gs.singularity.x, gs.singularity.y, gs.singularity.radius, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Black hole visual
    if (gs.blackHole) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(gs.blackHole.x, gs.blackHole.y, 30, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#aa00ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(gs.blackHole.x, gs.blackHole.y, 40, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Draw power-ups
    for (const pu of gs.powerUps) pu.draw(ctx);

    // Draw enemies
    for (const e of gs.enemies) e.draw(ctx);

    // Draw boss
    if (gs.boss) gs.boss.draw(ctx);

    // Draw turret
    if (gs.turret) {
      ctx.save();
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(gs.turret.x - 10, gs.turret.y - 10, 20, 20);
      ctx.strokeStyle = '#00ff44';
      ctx.lineWidth = 2;
      ctx.strokeRect(gs.turret.x - 10, gs.turret.y - 10, 20, 20);
      ctx.restore();
    }

    // Draw bullets
    for (const b of gs.bullets) b.draw(ctx);

    // Draw explosions
    for (const ex of gs.explosions) ex.draw(ctx);

    // Draw particles
    gs.particles.draw(ctx);

    // Draw player (unless game over)
    if (!gs.gameOver) gs.player.draw(ctx);

    // HUD
    if (!gs.gameOver) this.hud.draw(ctx, gs);

    // Wave complete overlay
    if (gs.waveComplete && !gs.gameOver) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#000022';
      ctx.fillRect(0, 280, 480, 140);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = '16px "Press Start 2P"';
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 20;
      ctx.fillText('WAVE CLEAR!', 240, 340);
      ctx.shadowBlur = 0;
      ctx.font = '10px "Press Start 2P"';
      ctx.fillStyle = '#ffff00';
      ctx.fillText(`+${gs.wave * 10} COINS`, 240, 365);
      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(`WAVE ${gs.wave + 1} IN ${(gs.waveCountdown / 1000).toFixed(1)}s`, 240, 390);
      ctx.restore();
    }

    // Pause overlay
    if (gs.paused) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#000022';
      ctx.fillRect(0, 0, 480, 700);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      ctx.font = '20px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('PAUSED', 240, 350);
      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('ESC to resume', 240, 380);
      ctx.restore();
    }

    // Game over overlay
    if (gs.gameOver) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#000011';
      ctx.fillRect(0, 0, 480, 700);
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      ctx.font = '20px "Press Start 2P"';
      ctx.fillStyle = '#ff2244';
      ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 20;
      ctx.fillText('GAME OVER', 240, 240);
      ctx.shadowBlur = 0;

      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`SCORE: ${formatNumber(gs.score)}`, 240, 290);
      ctx.fillText(`WAVE: ${gs.wave}`, 240, 315);
      ctx.fillText(`KILLS: ${gs.enemiesKilled}`, 240, 340);

      if (gs.newRecord) {
        ctx.font = '10px "Press Start 2P"';
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 12;
        ctx.fillText('NEW RECORD!', 240, 375);
        ctx.shadowBlur = 0;
      }

      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = '#00ffff';
      ctx.fillText('TAP/PRESS TO RETURN', 240, 420);
      ctx.restore();
    }
  }

  async _onGameOver() {
    const gs = this.gs;

    // Save score
    const token = getToken();
    if (token) {
      const res = await apiFetch('/game/save-score', {
        method: 'POST',
        body: JSON.stringify({ score: gs.score, wave: gs.wave, enemiesKilled: gs.enemiesKilled })
      });
      if (res.success && res.data.newMaxScore > 0) gs.newRecord = true;
    }

    // Listen for any input to return to menu
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

function startGame(abilitySlots) {
  if (!gameInstance) gameInstance = new GalacticGame();
  gameInstance.start(abilitySlots || [null, null, null]);
}

function stopGame() {
  if (gameInstance) gameInstance.stop();
}
