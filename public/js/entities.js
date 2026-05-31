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
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ff3355';
      ctx.fillRect(this.x - 3, this.y - this.height/2 - 2, 6, this.height + 4);
      ctx.restore();
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
    // Horizontal-only movement (no vertical movement allowed)
    let dx = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;

    // Joystick (horizontal axis only)
    dx += this.joystickVX;

    const spd = this.effectiveSpeed;
    this.x = Math.max(this.width/2, Math.min(this.canvasW - this.width/2, this.x + dx * spd * dtF));

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

    // Skin color glow overlay
    if (this.skinColor) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = this.skinColor;
      ctx.fillRect(this.x - 20, this.y - 20, 40, 40);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = this.skinColor;
      const grad = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, 28);
      grad.addColorStop(0, this.skinColor);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(this.x, this.y, 28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

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

    // Shooting capability – only 'shooter' type fires bullets
    this.canShoot = false;
    this.fireRate = 99999;
    this.lastShot = 0;

    switch (type) {
      case 'basic':
        this.hp = this.maxHp = Math.floor(30 * waveMult);
        this.speed = 0.9 + wave * 0.04;
        this.damage = 15;
        this.score = 100;
        this.coinDrop = 2;
        this.width = 24; this.height = 24;
        this.sprite = GameAssets.enemyBasic;
        break;
      case 'medium':
        this.hp = this.maxHp = Math.floor(70 * waveMult);
        this.speed = 0.75 + wave * 0.035;
        this.damage = 25;
        this.score = 250;
        this.coinDrop = 5;
        this.width = 28; this.height = 28;
        this.sprite = GameAssets.enemyMedium;
        break;
      case 'heavy':
        this.hp = this.maxHp = Math.floor(150 * waveMult);
        this.speed = 0.55 + wave * 0.025;
        this.damage = 35;
        this.score = 500;
        this.coinDrop = 10;
        this.width = 32; this.height = 32;
        this.sprite = GameAssets.enemyHeavy;
        break;
      case 'shooter':
        this.hp = this.maxHp = Math.floor(50 * waveMult);
        this.speed = 1.4 + wave * 0.04;
        this.damage = 18;
        this.score = 200;
        this.coinDrop = 4;
        this.width = 28; this.height = 28;
        this.sprite = GameAssets.enemyMedium;
        this.canShoot = true;
        this.fireRate = Math.max(1000, 1800 - wave * 30);
        this.lastShot = Math.random() * this.fireRate;
        this.targetY = 90 + Math.random() * 120; // fixed firing position
        break;
    }

    this.gemDropChance = 0.05;
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
      case 'shooter':
        if (this.y < this.targetY) {
          this.y += spd * dtF;
        } else {
          // Hover in place with a slow side-to-side drift
          this.zigzagTimer += dt;
          this.x += Math.sin(this.zigzagTimer * 0.0008) * 0.6 * dtF;
          this.x = Math.max(30, Math.min(450, this.x));
        }
        break;
    }

    // Only shooter type fires bullets
    if (this.canShoot) {
      this.lastShot += dt;
      if (this.lastShot >= this.fireRate) {
        this.lastShot = 0;
        bullets.push(new Bullet(this.x, this.y + this.height / 2, 0, 5, this.damage, 'enemy'));
      }
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

    // Shooter type: red targeting reticle to distinguish from advancing enemies
    if (this.type === 'shooter') {
      ctx.save();
      ctx.strokeStyle = '#ff2244';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 + Math.sin(this.zigzagTimer * 0.004) * 0.3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(this.x - this.width, this.y);
      ctx.lineTo(this.x - this.width * 0.4, this.y);
      ctx.moveTo(this.x + this.width * 0.4, this.y);
      ctx.lineTo(this.x + this.width, this.y);
      ctx.moveTo(this.x, this.y - this.height);
      ctx.lineTo(this.x, this.y - this.height * 0.4);
      ctx.stroke();
      ctx.restore();
    }

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
    const spd = this.speed * speedMult * (this.isPhase2 ? 1.3 : 1);

    this.x += spd * this.moveDir * dtF;
    if (this.x > 430 || this.x < 50) this.moveDir *= -1;

    if (!this.enraged && this.isPhase2) {
      this.enraged = true;
      this.fireRate = 650;
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
    const count = this.isPhase2 ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI / (count - 1)) * i + Math.PI / 4;
      const spd = this.isPhase2 ? 3.5 : 3;
      bullets.push(new Bullet(this.x, this.y + 30, Math.cos(angle) * spd, Math.sin(angle) * spd, 20, 'enemy'));
    }
  }

  circlePattern(bullets) {
    const count = this.isPhase2 ? 10 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spd = 3;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle) * spd, Math.sin(angle) * spd, 15, 'enemy'));
    }
  }

  aimedPattern(bullets) {
    const count = this.isPhase2 ? 3 : 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25 + Math.PI / 2;
      bullets.push(new Bullet(this.x + (i - count/2) * 20, this.y + 30,
        Math.cos(angle) * 2, Math.sin(angle) * 2, 25, 'enemy'));
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

// ===== COSMIC BOSS BASE CLASS (Boss Rush) =====
class CosmicBoss {
  constructor(type) {
    this.type = type;
    this.x = 240; this.y = -100;
    this.width = 80; this.height = 80;
    this.maxHp = 3000;
    this.hp = this.maxHp;
    this.speed = 1.2;
    this.dead = false;
    this.stunned = false; this.frozen = false;
    this.phase = 1;
    this.patternTimer = 0;
    this.patternInterval = 3500;
    this.attackPattern = 0;
    this.moveDir = 1;
    this.arrived = false;
    this.targetY = 110;
    this.lastShot = 0;
    this.fireRate = 900;
    this.enraged = false;
    this.phaseLocked = false;
    this.phaseLockTimer = 0;
    this.coreBreached = false;
    this.coreBreachTimer = 0;
    this.coreDamageMult = 1;
    this.phaseJustChanged = false;
    this.phaseFlashTimer = 0;
    this._time = 0;
  }

  get isPhase2() {
    if (this.phaseLocked) return false;
    return this.hp / this.maxHp < 0.5;
  }

  takeDamage(amount) {
    const mult = this.coreBreached ? this.coreDamageMult : 1;
    const dmg = amount * mult;
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.dead = true;
  }

  update(dt, bullets) {
    this._time += dt;
    const dtF = dt / 16.667;
    if (!this.arrived) {
      this.y += 2.5 * dtF;
      if (this.y >= this.targetY) { this.y = this.targetY; this.arrived = true; }
      return;
    }

    if (this.stunned || this.frozen) return;

    // Phase lock timer
    if (this.phaseLocked) {
      this.phaseLockTimer -= dt;
      if (this.phaseLockTimer <= 0) { this.phaseLocked = false; this.phaseLockTimer = 0; }
    }

    // Core breach timer
    if (this.coreBreached) {
      this.coreBreachTimer -= dt;
      if (this.coreBreachTimer <= 0) { this.coreBreached = false; this.coreBreachTimer = 0; this.coreDamageMult = 1; }
    }

    // Phase transition detection
    if (!this.enraged && this.hp / this.maxHp < 0.5 && !this.phaseLocked) {
      this.enraged = true;
      this.phase = 2;
      this.phaseJustChanged = true;
      this.phaseFlashTimer = 1500;
      this.onPhase2Start();
    }

    if (this.phaseFlashTimer > 0) this.phaseFlashTimer -= dt;

    const spd = this.speed * (this.isPhase2 ? 1.3 : 1);
    this.x += spd * this.moveDir * dtF;
    if (this.x > 430 || this.x < 50) this.moveDir *= -1;

    this.patternTimer += dt;
    if (this.patternTimer >= this.patternInterval) {
      this.patternTimer = 0;
      this.attackPattern = (this.attackPattern + 1) % this._patternCount();
    }

    this.lastShot += dt;
    const fr = this.isPhase2 ? this.fireRate * 0.75 : this.fireRate;
    if (this.lastShot >= fr) {
      this.lastShot = 0;
      this.fireBullets(bullets);
    }
  }

  onPhase2Start() {}
  _patternCount() { return 3; }
  fireBullets(bullets) {}

  drawBase(ctx) {
    // Phase 2 aura
    if (this.isPhase2) {
      const pulse = 0.3 + Math.sin(Date.now() * 0.006) * 0.2;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = this._phase2Color || '#ff0044';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 52, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Core breach overlay
    if (this.coreBreached) {
      const t = Date.now() * 0.008;
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(t) * 0.3;
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ff4400';
      ctx.fill();
      ctx.restore();
    }

    // Phase lock indicator
    if (this.phaseLocked) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Phase transition flash
    if (this.phaseFlashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.8, this.phaseFlashTimer / 800);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 60, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawHealthBar(ctx) {
    const bw = 200; const bh = 12;
    const bx = 240 - bw/2; const by = 30;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, bh);
    const hpPct = this.hp / this.maxHp;
    const color = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffaa00' : '#ff2244';
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * hpPct, bh);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#ffffff';
    ctx.font = '7px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText(this._bossName() + (this.phase === 2 ? ' [PHASE 2]' : ''), 240, 27);
  }

  _bossName() { return 'COSMIC BOSS'; }
}

// ── 1. NEBULOX – Nebula Spiral Boss ─────────────────────────────────────────
class BossNebulox extends CosmicBoss {
  constructor() {
    super('nebulox');
    this.maxHp = 2800; this.hp = this.maxHp;
    this._phase2Color = '#9900ff';
    this.spiralAngle = 0;
    this.fireRate = 850;
  }
  _bossName() { return 'NEBULOX'; }
  _patternCount() { return 3; }
  onPhase2Start() { this.spiralAngle = 0; }

  fireBullets(bullets) {
    const p = this.attackPattern;
    if (p === 0) this._spiral(bullets);
    else if (p === 1) this._burst(bullets);
    else this._aimed(bullets);
  }

  _spiral(bullets) {
    const arms = this.isPhase2 ? 3 : 2;
    const spd = this.isPhase2 ? 3.0 : 2.5;
    for (let a = 0; a < arms; a++) {
      const angle = this.spiralAngle + (a * Math.PI * 2 / arms);
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, 18, 'enemy'));
    }
    this.spiralAngle += 0.25;
  }

  _burst(bullets) {
    const count = this.isPhase2 ? 13 : 10;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spd = this.isPhase2 ? 2.6 : 2.2;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, 15, 'enemy'));
    }
  }

  _aimed(bullets) {
    const count = this.isPhase2 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI/2 + (i - Math.floor(count/2)) * 0.22;
      const spd = this.isPhase2 ? 3.5 : 3;
      bullets.push(new Bullet(this.x + (i-2)*14, this.y+36, Math.cos(angle)*spd, Math.sin(angle)*spd, 20, 'enemy'));
    }
  }

  draw(ctx) {
    this.drawBase(ctx);
    // Body: swirling nebula
    const t = Date.now() * 0.002;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(t * 0.5);
    const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, 40);
    grad.addColorStop(0, '#cc44ff');
    grad.addColorStop(0.5, '#6600cc');
    grad.addColorStop(1, 'rgba(50,0,80,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#aa44ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Tentacles
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a+0.5)*28, Math.sin(a+0.5)*28, Math.cos(a)*44, Math.sin(a)*44);
      ctx.strokeStyle = `rgba(170,68,255,0.5)`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ── 2. VOID TYRANT – Void Teleporter Boss ────────────────────────────────────
class BossVoidTyrant extends CosmicBoss {
  constructor() {
    super('void_tyrant');
    this.maxHp = 3200; this.hp = this.maxHp;
    this._phase2Color = '#000066';
    this.teleportTimer = 5000;
    this.fireRate = 800;
  }
  _bossName() { return 'VOID TYRANT'; }
  _patternCount() { return 3; }
  onPhase2Start() { this.teleportTimer = 2500; }

  update(dt, bullets) {
    super.update(dt, bullets);
    if (!this.arrived) return;
    this.teleportTimer -= dt;
    if (this.teleportTimer <= 0) {
      this.x = 60 + Math.random() * 360;
      this.teleportTimer = this.isPhase2 ? 2500 : 5000;
    }
  }

  fireBullets(bullets) {
    const p = this.attackPattern;
    if (p === 0) this._circle(bullets);
    else if (p === 1) this._wallShot(bullets);
    else this._voidBlast(bullets);
  }

  _circle(bullets) {
    const count = this.isPhase2 ? 12 : 10;
    for (let i = 0; i < count; i++) {
      const angle = (i/count)*Math.PI*2;
      const spd = 3;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, 18, 'enemy'));
    }
  }

  _wallShot(bullets) {
    const cols = this.isPhase2 ? 6 : 5;
    for (let i = 0; i < cols; i++) {
      const x = 30 + i * (420 / (cols-1));
      bullets.push(new Bullet(x, this.y+20, 0, this.isPhase2 ? 3.5 : 3, 20, 'enemy'));
    }
  }

  _voidBlast(bullets) {
    const count = this.isPhase2 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI/2 + (Math.random()-0.5)*0.8;
      const spd = 3.5 + Math.random();
      bullets.push(new Bullet(this.x, this.y+30, Math.cos(angle)*spd, Math.sin(angle)*spd, 25, 'enemy'));
    }
  }

  draw(ctx) {
    this.drawBase(ctx);
    const t = Date.now() * 0.003;
    ctx.save();
    ctx.translate(this.x, this.y);
    // Void core
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 38);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.4, '#0000aa');
    g.addColorStop(1, 'rgba(0,0,80,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI*2);
    ctx.fill();
    // Orbiting triangles
    for (let i = 0; i < 3; i++) {
      const a = t + (i/3)*Math.PI*2;
      const ox = Math.cos(a)*28; const oy = Math.sin(a)*28;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a);
      ctx.fillStyle = '#3333ff';
      ctx.beginPath();
      ctx.moveTo(0,-7); ctx.lineTo(6,5); ctx.lineTo(-6,5); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = '#4444ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0,0,36,0,Math.PI*2);
    ctx.stroke();
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ── 3. STAR CRUSHER – Asteroid/Rock Boss ─────────────────────────────────────
class BossStarCrusher extends CosmicBoss {
  constructor() {
    super('star_crusher');
    this.maxHp = 3500; this.hp = this.maxHp;
    this._phase2Color = '#ff8800';
    this.fireRate = 1000;
    this.spinAngle = 0;
  }
  _bossName() { return 'STAR CRUSHER'; }
  _patternCount() { return 3; }
  onPhase2Start() { this.speed = 2.5; }

  update(dt, bullets) {
    super.update(dt, bullets);
    this.spinAngle += dt * 0.002;
  }

  fireBullets(bullets) {
    const p = this.attackPattern;
    if (p === 0) this._rockShower(bullets);
    else if (p === 1) this._boulderBurst(bullets);
    else this._spinShot(bullets);
  }

  _rockShower(bullets) {
    const count = this.isPhase2 ? 6 : 5;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI/2 + (Math.random()-0.5)*1.2;
      const spd = 2 + Math.random() * 2;
      bullets.push(new Bullet(this.x + (Math.random()-0.5)*80, this.y+20, Math.cos(angle)*spd, Math.sin(angle)*spd, 22, 'enemy'));
    }
  }

  _boulderBurst(bullets) {
    const count = this.isPhase2 ? 8 : 6;
    for (let i = 0; i < count; i++) {
      const angle = (i/count)*Math.PI*2;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*2.5, Math.sin(angle)*2.5, 28, 'enemy'));
    }
  }

  _spinShot(bullets) {
    const arms = this.isPhase2 ? 5 : 4;
    for (let i = 0; i < arms; i++) {
      const angle = this.spinAngle + (i/arms)*Math.PI*2;
      const spd = this.isPhase2 ? 3.0 : 2.8;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, 20, 'enemy'));
    }
  }

  draw(ctx) {
    this.drawBase(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.spinAngle);
    // Rocky octagon shape
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2 - Math.PI/8;
      const r = 36 + (i%2)*6;
      i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fillStyle = '#885533';
    ctx.fill();
    ctx.strokeStyle = '#ffaa44';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Cracks
    ctx.strokeStyle = '#ffcc66';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const a = (i/4)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*24, Math.sin(a)*24);
      ctx.stroke();
    }
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ── 4. CHRONOS REX – Time/Clockwork Boss ─────────────────────────────────────
class BossChronosRex extends CosmicBoss {
  constructor() {
    super('chronos_rex');
    this.maxHp = 3000; this.hp = this.maxHp;
    this._phase2Color = '#ffff00';
    this.clockAngle = 0;
    this.fireRate = 700;
    this.reverseTimer = 0;
    this.reverseActive = false;
  }
  _bossName() { return 'CHRONOS REX'; }
  _patternCount() { return 3; }
  onPhase2Start() { this.reverseTimer = 3000; this.reverseActive = true; }

  update(dt, bullets) {
    super.update(dt, bullets);
    this.clockAngle += dt * 0.003;
    if (this.reverseActive) {
      this.reverseTimer -= dt;
      if (this.reverseTimer <= 0) { this.reverseActive = false; }
    }
  }

  fireBullets(bullets) {
    const p = this.attackPattern;
    if (p === 0) this._clockBurst(bullets);
    else if (p === 1) this._timeWall(bullets);
    else this._reverseSalvo(bullets);
  }

  _clockBurst(bullets) {
    const count = this.isPhase2 ? 10 : 8;
    for (let i = 0; i < count; i++) {
      const angle = this.clockAngle + (i/count)*Math.PI*2;
      const spd = this.isPhase2 ? 3.0 : 2.5;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, 18, 'enemy'));
    }
  }

  _timeWall(bullets) {
    const rows = this.isPhase2 ? 3 : 2;
    const cols = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 40 + c * 80;
        const spd = 2.5 + r * 0.5;
        bullets.push(new Bullet(x, this.y + r*25, 0, spd, 15, 'enemy'));
      }
    }
  }

  _reverseSalvo(bullets) {
    const count = this.isPhase2 ? 5 : 4;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI/2 + (i-(count/2))*0.25;
      const spd = this.isPhase2 ? 3.5 : 3;
      // Bullets travel upward (reversed — come from bottom edge)
      bullets.push(new Bullet(this.x + (i-(count/2))*20, 720, Math.cos(angle)*spd, Math.sin(angle)*spd - 6, 22, 'enemy'));
    }
  }

  draw(ctx) {
    this.drawBase(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    // Clock face
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI*2);
    ctx.fillStyle = '#221100';
    ctx.fill();
    ctx.strokeStyle = '#ffdd44';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Hour markers
    for (let i = 0; i < 12; i++) {
      const a = (i/12)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*28, Math.sin(a)*28);
      ctx.lineTo(Math.cos(a)*34, Math.sin(a)*34);
      ctx.strokeStyle = '#ffdd44';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Hands
    ctx.strokeStyle = '#ff4400';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(this.clockAngle)*26, Math.sin(this.clockAngle)*26);
    ctx.stroke();
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(this.clockAngle*12)*18, Math.sin(this.clockAngle*12)*18);
    ctx.stroke();
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// ── 5. ASTRAL SENTINEL – Guardian Boss ───────────────────────────────────────
class BossAstralSentinel extends CosmicBoss {
  constructor() {
    super('astral_sentinel');
    this.maxHp = 4000; this.hp = this.maxHp;
    this._phase2Color = '#00ffff';
    this.shieldAngle = 0;
    this.shieldActive = true;
    this.shieldHp = 500;
    this.fireRate = 950;
  }
  _bossName() { return 'ASTRAL SENTINEL'; }
  _patternCount() { return 3; }
  onPhase2Start() { this.shieldActive = false; this.fireRate = 600; }

  update(dt, bullets) {
    super.update(dt, bullets);
    this.shieldAngle += dt * 0.002;
  }

  fireBullets(bullets) {
    const p = this.attackPattern;
    if (p === 0) this._guardianBeam(bullets);
    else if (p === 1) this._pulseWave(bullets);
    else this._sentinelBarrage(bullets);
  }

  _guardianBeam(bullets) {
    const count = this.isPhase2 ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI/2 + (i - Math.floor(count/2))*0.3;
      bullets.push(new Bullet(this.x + (i-2)*12, this.y+32, Math.cos(angle)*3.5, Math.sin(angle)*3.5, 22, 'enemy'));
    }
  }

  _pulseWave(bullets) {
    const count = this.isPhase2 ? 14 : 12;
    for (let i = 0; i < count; i++) {
      const angle = (i/count)*Math.PI*2 + this.shieldAngle;
      const spd = this.isPhase2 ? 3.0 : 2.5;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, 16, 'enemy'));
    }
  }

  _sentinelBarrage(bullets) {
    const cols = this.isPhase2 ? 5 : 4;
    for (let i = 0; i < cols; i++) {
      const x = 40 + i*(400/(cols-1));
      const spd = this.isPhase2 ? 3.5 : 3;
      bullets.push(new Bullet(x, this.y+20, (Math.random()-0.5)*1.5, spd, 20, 'enemy'));
    }
  }

  draw(ctx) {
    this.drawBase(ctx);
    ctx.save();
    ctx.translate(this.x, this.y);
    // Core
    const g = ctx.createRadialGradient(0,0,6,0,0,36);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, '#88ffff');
    g.addColorStop(1, 'rgba(0,180,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0,0,36,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Orbiting shield segments
    if (this.shieldActive) {
      for (let i = 0; i < 4; i++) {
        const a = this.shieldAngle + (i/4)*Math.PI*2;
        const sx = Math.cos(a)*50; const sy = Math.sin(a)*50;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(a + Math.PI/2);
        ctx.fillStyle = '#004488';
        ctx.fillRect(-10, -4, 20, 8);
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-10,-4,20,8);
        ctx.restore();
      }
    }
    // Star shape
    ctx.save();
    ctx.rotate(this.shieldAngle*0.3);
    ctx.strokeStyle = '#aaffff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i/8)*Math.PI*2;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*34, Math.sin(a)*34);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    this.drawHealthBar(ctx);
  }
}

// Boss type registry for Boss Rush
const COSMIC_BOSSES = [BossNebulox, BossVoidTyrant, BossStarCrusher, BossChronosRex, BossAstralSentinel];
const COSMIC_BOSS_IDS = ['nebulox', 'void_tyrant', 'star_crusher', 'chronos_rex', 'astral_sentinel'];

function createCosmicBoss(typeIndex) {
  const BossClass = COSMIC_BOSSES[typeIndex % COSMIC_BOSSES.length];
  return new BossClass();
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
