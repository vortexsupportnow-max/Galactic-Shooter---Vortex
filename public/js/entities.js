// ===== GAME ENTITIES =====

// ===== BULLET =====
class Bullet {
  constructor(x, y, vx, vy, damage, owner, options = {}) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.damage = damage;
    this.owner = owner; // 'player' or 'enemy'
    this.piercing = options.piercing || false;
    this.homing = options.homing || false;
    this.ricochet = options.ricochet || false;
    this.bounces = 0;
    this.maxBounces = 3;
    this.width = owner === 'player' ? 4 : 4;
    this.height = owner === 'player' ? 12 : 10;
    this.dead = false;
    this.homingTarget = null;
  }

  update(dt, enemies, boss) {
    const dtF = dt / 16.667;
    if (this.homing && (enemies.length > 0 || boss)) {
      // Find nearest target
      let nearest = null, nearDist = Infinity;
      const targets = [...enemies, ...(boss ? [boss] : [])];
      for (const e of targets) {
        const dx = e.x - this.x, dy = e.y - this.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < nearDist) { nearDist = d; nearest = e; }
      }
      if (nearest) {
        const dx = nearest.x - this.x, dy = nearest.y - this.y;
        const d = Math.sqrt(dx*dx + dy*dy) || 1;
        const turnSpeed = 0.12;
        this.vx += (dx / d) * turnSpeed;
        this.vy += (dy / d) * turnSpeed;
        // Clamp speed
        const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if (speed > 8) { this.vx = this.vx/speed*8; this.vy = this.vy/speed*8; }
      }
    }

    this.x += this.vx * dtF;
    this.y += this.vy * dtF;

    if (this.ricochet) {
      if ((this.x < 0 || this.x > 480) && this.bounces < this.maxBounces) {
        this.vx = -this.vx; this.bounces++;
        this.x = Math.max(0, Math.min(480, this.x));
      }
    }

    if (this.x < -20 || this.x > 500 || this.y < -30 || this.y > 730) this.dead = true;
  }

  draw(ctx) {
    if (this.owner === 'player') {
      ctx.drawImage(GameAssets.playerBullet, this.x - this.width/2, this.y - this.height/2);
      // Glow
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(this.x - 3, this.y - this.height/2 - 2, 6, this.height + 4);
      ctx.restore();
    } else {
      ctx.drawImage(GameAssets.enemyBullet, this.x - this.width/2, this.y - this.height/2);
    }
  }
}

// ===== POWER-UP =====
class PowerUp {
  constructor(x, y, abilityId) {
    this.x = x; this.y = y;
    this.abilityId = abilityId;
    this.vy = 0.8;
    this.bobOffset = Math.random() * Math.PI * 2;
    this.age = 0;
    this.dead = false;
    this.width = 20; this.height = 20;
  }

  update(dt) {
    this.y += this.vy;
    this.age += dt;
    if (this.y > 730) this.dead = true;
  }

  draw(ctx) {
    const bob = Math.sin(this.age * 0.003 + this.bobOffset) * 3;
    const x = this.x - 10;
    const y = this.y - 10 + bob;

    ctx.save();
    // Glow
    ctx.globalAlpha = 0.4 + Math.sin(this.age * 0.005) * 0.2;
    ctx.fillStyle = RARITY_COLORS[getAbilityRarity(this.abilityId)] || '#00ffff';
    ctx.fillRect(x - 4, y - 4, 28, 28);
    ctx.globalAlpha = 1;
    ctx.drawImage(GameAssets.powerUp, x, y);
    ctx.restore();
  }

  checkCollision(player) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    return Math.sqrt(dx*dx + dy*dy) < 30;
  }
}

// ===== PLAYER =====
class Player {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.x = canvasW / 2;
    this.y = canvasH * 0.82;
    this.width = 40; this.height = 40;
    this.speed = 5;
    this.hp = 100; this.maxHp = 100;
    this.lives = 3;
    this.fireRate = 250; // ms between shots
    this.lastShot = 0;

    // Ability flags
    this.shielded = false; this.shieldTimer = 0;
    this.speedBoost = false; this.speedBoostTimer = 0;
    this.tripleShot = false; this.tripleShotTimer = 0;
    this.spreadShot = false; this.spreadShotTimer = 0;
    this.rapidFire = false; this.rapidFireTimer = 0;
    this.homingShot = false; this.homingShotTimer = 0;
    this.laserActive = false; this.laserTimer = 0; this.laserDamage = 5;
    this.magneticField = false; this.magneticFieldTimer = 0;
    this.cloneActive = false; this.cloneTimer = 0; this.cloneX = 0; this.cloneY = 0;
    this.piercing = false; this.piercingTimer = 0;
    this.ricochet = false; this.ricochetTimer = 0;
    this.overcharge = false; this.overchargeTimer = 0; this.overchargeMultiplier = 2;
    this.droneActive = false; this.droneTimer = 0; this.droneAngle = 0; this.droneDamage = 15;
    this.vortexActive = false; this.vortexTimer = 0; this.vortexAngle = 0; this.vortexDamage = 20;
    this.gravityWell = false; this.gravityWellTimer = 0;
    this.phoenixReady = false; this.phoenixHeal = 50;

    // Touch/joystick input
    this.joystickVX = 0;
    this.joystickVY = 0;

    this.invulnTimer = 0; // brief invuln after taking damage
    this.flashTimer = 0;
  }

  get effectiveDamage() {
    let dmg = 20;
    if (this.overcharge) dmg *= (this.overchargeMultiplier || 2);
    return dmg;
  }

  get effectiveFireRate() {
    return this.rapidFire ? this.fireRate / 2 : this.fireRate;
  }

  get effectiveSpeed() {
    return this.speedBoost ? this.speed * 1.5 : this.speed;
  }

  takeDamage(amount) {
    if (this.shielded || this.invulnTimer > 0) return false;
    this.hp -= amount;
    this.invulnTimer = 800;
    this.flashTimer = 800;
    return true;
  }

  update(keys, dt, now) {
    const dtF = dt / 16.667;
    // Movement
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;

    // Joystick
    dx += this.joystickVX;
    dy += this.joystickVY;

    // Normalize diagonal
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

    const spd = this.effectiveSpeed;
    this.x = Math.max(this.width/2, Math.min(this.canvasW - this.width/2, this.x + dx * spd * dtF));
    this.y = Math.max(this.canvasH * 0.35, Math.min(this.canvasH - this.height/2, this.y + dy * spd * dtF));

    // Update ability timers
    if (this.shieldTimer > 0)       { this.shieldTimer       -= dt; if (this.shieldTimer <= 0) this.shielded = false; }
    if (this.speedBoostTimer > 0)   { this.speedBoostTimer   -= dt; if (this.speedBoostTimer <= 0) this.speedBoost = false; }
    if (this.tripleShotTimer > 0)   { this.tripleShotTimer   -= dt; if (this.tripleShotTimer <= 0) this.tripleShot = false; }
    if (this.spreadShotTimer > 0)   { this.spreadShotTimer   -= dt; if (this.spreadShotTimer <= 0) this.spreadShot = false; }
    if (this.rapidFireTimer > 0)    { this.rapidFireTimer    -= dt; if (this.rapidFireTimer <= 0) this.rapidFire = false; }
    if (this.homingShotTimer > 0)   { this.homingShotTimer   -= dt; if (this.homingShotTimer <= 0) this.homingShot = false; }
    if (this.laserTimer > 0)        { this.laserTimer        -= dt; if (this.laserTimer <= 0) this.laserActive = false; }
    if (this.magneticFieldTimer > 0){ this.magneticFieldTimer -= dt; if (this.magneticFieldTimer <= 0) this.magneticField = false; }
    if (this.cloneTimer > 0)        { this.cloneTimer        -= dt; if (this.cloneTimer <= 0) this.cloneActive = false; }
    if (this.piercingTimer > 0)     { this.piercingTimer     -= dt; if (this.piercingTimer <= 0) this.piercing = false; }
    if (this.ricochetTimer > 0)     { this.ricochetTimer     -= dt; if (this.ricochetTimer <= 0) this.ricochet = false; }
    if (this.overchargeTimer > 0)   { this.overchargeTimer   -= dt; if (this.overchargeTimer <= 0) { this.overcharge = false; this.overchargeMultiplier = 2; } }
    if (this.droneTimer > 0)        { this.droneTimer        -= dt; if (this.droneTimer <= 0) this.droneActive = false; }
    if (this.vortexTimer > 0)       { this.vortexTimer       -= dt; if (this.vortexTimer <= 0) this.vortexActive = false; }
    if (this.gravityWellTimer > 0)  { this.gravityWellTimer  -= dt; if (this.gravityWellTimer <= 0) this.gravityWell = false; }
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // Drone rotation
    if (this.droneActive) this.droneAngle += dt * 0.003;
    // Vortex rotation
    if (this.vortexActive) this.vortexAngle += dt * 0.005;

    // Clone follows player
    if (this.cloneActive) {
      const targetX = this.x + (this.x > this.canvasW/2 ? -70 : 70);
      this.cloneX += (targetX - this.cloneX) * 0.08;
      this.cloneY += (this.y - this.cloneY) * 0.08;
    }
  }

  shoot(now, bullets) {
    if (now - this.lastShot < this.effectiveFireRate) return;
    this.lastShot = now;

    const damage = this.effectiveDamage;
    const opts = {
      piercing: this.piercing,
      homing: this.homingShot,
      ricochet: this.ricochet
    };

    if (this.spreadShot) {
      for (let i = -2; i <= 2; i++) {
        const angle = i * 0.2;
        bullets.push(new Bullet(this.x + i*8, this.y - 20, Math.sin(angle)*4, -8, damage, 'player', opts));
      }
    } else if (this.tripleShot) {
      bullets.push(new Bullet(this.x, this.y - 20, 0, -9, damage, 'player', opts));
      bullets.push(new Bullet(this.x - 10, this.y - 15, -1.5, -8.5, damage, 'player', opts));
      bullets.push(new Bullet(this.x + 10, this.y - 15, 1.5, -8.5, damage, 'player', opts));
    } else {
      bullets.push(new Bullet(this.x, this.y - 22, 0, -9, damage, 'player', opts));
    }

    // Clone also shoots
    if (this.cloneActive) {
      bullets.push(new Bullet(this.cloneX, this.cloneY - 22, 0, -9, damage * 0.7, 'player', opts));
    }

    Sounds.shoot();
  }

  draw(ctx) {
    // Flash effect when hit
    if (this.flashTimer > 0 && Math.floor(this.flashTimer / 80) % 2 === 0) {
      ctx.save(); ctx.globalAlpha = 0.3; ctx.restore();
      return; // blink
    }

    // Shield visual
    if (this.shielded) {
      ctx.save();
      const r = 32;
      const grad = ctx.createRadialGradient(this.x, this.y, r * 0.3, this.x, this.y, r);
      grad.addColorStop(0, 'rgba(0,255,255,0)');
      grad.addColorStop(0.7, 'rgba(0,255,255,0.15)');
      grad.addColorStop(1, 'rgba(0,255,255,0.6)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }

    // Magnetic field visual
    if (this.magneticField) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.strokeStyle = '#44ffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, 60, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Gravity well visual
    if (this.gravityWell) {
      ctx.save();
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#aa44ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(this.x, this.y, 70, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }

    // Vortex blade
    if (this.vortexActive) {
      ctx.save();
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 4; i++) {
        const a = this.vortexAngle + (i / 4) * Math.PI * 2;
        const r = 40;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(a) * 10, this.y + Math.sin(a) * 10);
        ctx.lineTo(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Drone
    if (this.droneActive) {
      const dr = 55;
      const dx = this.x + Math.cos(this.droneAngle) * dr;
      const dy = this.y + Math.sin(this.droneAngle) * dr;
      ctx.save();
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(dx - 6, dy - 6, 12, 12);
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.restore();
    }

    // Laser beam
    if (this.laserActive) {
      ctx.save();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - 20);
      ctx.lineTo(this.x, 0);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Clone
    if (this.cloneActive) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(GameAssets.player, this.cloneX - 20, this.cloneY - 20);
      ctx.restore();
    }

    // Player ship
    ctx.drawImage(GameAssets.player, this.x - 20, this.y - 20);

    // Engine thrust exhaust
    ctx.save();
    const thrustLen = 8 + Math.random() * 10;
    const thrustAlpha = 0.5 + Math.random() * 0.4;
    const thrustGrad = ctx.createLinearGradient(this.x, this.y + 18, this.x, this.y + 18 + thrustLen);
    thrustGrad.addColorStop(0, `rgba(0,200,255,${thrustAlpha})`);
    thrustGrad.addColorStop(0.5, `rgba(255,100,0,${thrustAlpha * 0.7})`);
    thrustGrad.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = thrustGrad;
    ctx.beginPath();
    ctx.moveTo(this.x - 6, this.y + 18);
    ctx.lineTo(this.x + 6, this.y + 18);
    ctx.lineTo(this.x + 3, this.y + 18 + thrustLen);
    ctx.lineTo(this.x - 3, this.y + 18 + thrustLen);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Overcharge glow
    if (this.overcharge) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(this.x - 22, this.y - 22, 44, 44);
      ctx.restore();
    }
  }
}

// ===== ENEMY =====
class Enemy {
  constructor(type, x, y, wave) {
    this.type = type;
    this.x = x; this.y = y;
    this.wave = wave;
    this.dead = false;
    this.stunned = false; this.frozen = false;
    this.stunTimer = 0;

    const waveMult = 1 + (wave - 1) * 0.12;

    switch (type) {
      case 'basic':
        this.hp = this.maxHp = Math.floor(30 * waveMult);
        this.speed = 0.9 + wave * 0.04;
        this.fireRate = 2800;
        this.damage = 15;
        this.score = 100;
        this.coinDrop = 2;
        this.width = 24; this.height = 24;
        this.sprite = GameAssets.enemyBasic;
        break;
      case 'medium':
        this.hp = this.maxHp = Math.floor(70 * waveMult);
        this.speed = 0.75 + wave * 0.035;
        this.fireRate = 2200;
        this.damage = 25;
        this.score = 250;
        this.coinDrop = 5;
        this.width = 28; this.height = 28;
        this.sprite = GameAssets.enemyMedium;
        break;
      case 'heavy':
        this.hp = this.maxHp = Math.floor(150 * waveMult);
        this.speed = 0.55 + wave * 0.025;
        this.fireRate = 2000;
        this.damage = 35;
        this.score = 500;
        this.coinDrop = 10;
        this.width = 32; this.height = 32;
        this.sprite = GameAssets.enemyHeavy;
        break;
    }

    this.gemDropChance = 0.005;
    this.lastShot = Math.random() * this.fireRate;
    this.zigzagTimer = 0;
    this.zigzagDir = Math.random() > 0.5 ? 1 : -1;
    this.bounceDir = Math.random() > 0.5 ? 1 : -1;
  }

  update(dt, bullets, timeSlow, player) {
    const dtF = dt / 16.667;
    if (this.stunned || this.frozen) {
      if (this.stunTimer > 0) { this.stunTimer -= dt; if (this.stunTimer <= 0) { this.stunned = false; this.frozen = false; } }
      return;
    }

    const speedMult = timeSlow ? 0.5 : 1;
    const spd = this.speed * speedMult;

    switch (this.type) {
      case 'basic':
        this.y += spd * dtF;
        break;
      case 'medium':
        this.y += spd * dtF;
        this.zigzagTimer += dt;
        this.x += Math.sin(this.zigzagTimer * 0.002) * 1.5 * dtF;
        break;
      case 'heavy':
        this.y += spd * 0.7 * dtF;
        this.x += spd * this.bounceDir * dtF;
        if (this.x > 450 || this.x < 30) this.bounceDir *= -1;
        break;
    }

    this.lastShot += dt;
    if (this.lastShot >= this.fireRate) {
      this.lastShot = 0;
      // Aim at player when possible; bullet always travels at least slightly downward
      let vx = 0, vy = 5;
      if (player) {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        vx = (dx / d) * 5;
        vy = Math.max(1, (dy / d) * 5);
      }
      bullets.push(new Bullet(this.x, this.y + this.height / 2, vx, vy, this.damage, 'enemy'));
    }

    if (this.y > 750) this.dead = true;
  }

  draw(ctx) {
    if (this.frozen) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(this.x - this.width/2 - 2, this.y - this.height/2 - 2, this.width + 4, this.height + 4);
      ctx.restore();
    }

    ctx.drawImage(this.sprite, this.x - this.width/2, this.y - this.height/2);

    // HP bar
    if (this.hp < this.maxHp) {
      const barW = this.width;
      const barH = 3;
      const barX = this.x - barW/2;
      const barY = this.y - this.height/2 - 5;
      ctx.fillStyle = '#440000';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = '#ff2244';
      ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), barH);
    }
  }
}

// ===== BOSS =====
class Boss {
  constructor(wave) {
    this.wave = wave;
    this.x = 240; this.y = -80;
    this.width = 64; this.height = 64;
    this.maxHp = Math.floor(500 * (1 + (wave / 5 - 1) * 0.5));
    this.hp = this.maxHp;
    this.speed = 1.5;
    this.dead = false;
    this.stunned = false; this.frozen = false;
    this.phase = 1; // phase 2 when < 50% HP
    this.attackPattern = 0;
    this.patternTimer = 0;
    this.patternInterval = 4000;
    this.moveDir = 1;
    this.arrived = false; // has entered screen
    this.targetY = 100;
    this.lastShot = 0;
    this.fireRate = 800;
    this.bulletCount = 0;
    this.enraged = false;
  }

  get isPhase2() { return this.hp / this.maxHp < 0.5; }

  update(dt, bullets, timeSlow) {
    const dtF = dt / 16.667;
    if (!this.arrived) {
      this.y += 2 * dtF;
      if (this.y >= this.targetY) { this.y = this.targetY; this.arrived = true; }
      return;
    }

    if (this.stunned || this.frozen) return;

    const speedMult = timeSlow ? 0.5 : 1;
    const spd = this.speed * speedMult * (this.isPhase2 ? 1.5 : 1);

    this.x += spd * this.moveDir * dtF;
    if (this.x > 430 || this.x < 50) this.moveDir *= -1;

    if (!this.enraged && this.isPhase2) {
      this.enraged = true;
      this.fireRate = 500;
    }

    this.patternTimer += dt;
    this.lastShot += dt;

    if (this.lastShot >= this.fireRate) {
      this.lastShot = 0;
      this.fireBullets(bullets);
    }

    if (this.patternTimer >= this.patternInterval) {
      this.patternTimer = 0;
      this.attackPattern = (this.attackPattern + 1) % 3;
    }
  }

  fireBullets(bullets) {
    const patterns = [this.spreadPattern, this.circlePattern, this.aimedPattern];
    patterns[this.attackPattern].call(this, bullets);
  }

  spreadPattern(bullets) {
    const count = this.isPhase2 ? 7 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI / (count - 1)) * i + Math.PI / 4;
      const spd = this.isPhase2 ? 4 : 3;
      bullets.push(new Bullet(this.x, this.y + 30, Math.cos(angle) * spd, Math.sin(angle) * spd, 20, 'enemy'));
    }
  }

  circlePattern(bullets) {
    const count = this.isPhase2 ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spd = 3;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * spd, Math.sin(angle) * spd, 15, 'enemy'));
    }
  }

  aimedPattern(bullets) {
    // Homing missiles
    const count = this.isPhase2 ? 4 : 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25 + Math.PI / 2;
      bullets.push(new Bullet(this.x + (i - count/2) * 20, this.y + 30,
        Math.cos(angle) * 2, Math.sin(angle) * 2, 25, 'enemy', { homing: true }));
    }
  }

  draw(ctx) {
    if (this.frozen) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#44aaff';
      ctx.fillRect(this.x - 36, this.y - 36, 72, 72);
      ctx.restore();
    }

    if (this.isPhase2) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.005) * 0.2;
      ctx.fillStyle = '#ff0044';
      ctx.fillRect(this.x - 36, this.y - 36, 72, 72);
      ctx.restore();
    }

    ctx.drawImage(GameAssets.boss, this.x - 32, this.y - 32);
  }
}

// ===== EXPLOSION EFFECT =====
class Explosion {
  constructor(x, y, size = 1) {
    this.x = x; this.y = y;
    this.frame = 0;
    this.frameTimer = 0;
    this.frameInterval = 50;
    this.size = size;
    this.dead = false;
  }

  update(dt) {
    this.frameTimer += dt;
    if (this.frameTimer >= this.frameInterval) {
      this.frameTimer = 0;
      this.frame++;
      if (this.frame >= GameAssets.explosionFrames.length) this.dead = true;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const sprite = GameAssets.explosionFrames[this.frame];
    const s = 32 * this.size;
    ctx.drawImage(sprite, this.x - s/2, this.y - s/2, s, s);
  }
}
