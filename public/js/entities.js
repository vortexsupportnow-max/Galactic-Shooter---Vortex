// ===== GAME ENTITIES =====

// ===== BULLET =====
// Player bolt core, cached per colour (a gradient per bullet per frame is slow)
const _boltCache = new Map();
function boltSprite(color) {
  let c = _boltCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 8; c.height = 32;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 32);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, color);
  g.addColorStop(1, FX.rgba(color, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, 8, 32);
  _boltCache.set(color, c);
  return c;
}
// style: 'bolt' (player), 'missile' (player homing), 'orb' / 'needle' / 'big' (enemy)
class Bullet {
  constructor(x, y, vx, vy, damage, owner, options = {}) {
    this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.damage = damage;
    this.owner = owner; // 'player' or 'enemy'
    // Boss Rush passes a colour string as the 7th argument — accept both forms.
    if (typeof options === 'string') options = { color: options };
    this.piercing = options.piercing || false;
    this.homing = options.homing || false;
    this.ricochet = options.ricochet || false;
    this.style = options.style || (owner === 'player' ? 'bolt' : 'orb');
    this.color = options.color || (owner === 'player' ? '#7ff3ff' : '#ff3355');
    this.bounces = 0;
    this.maxBounces = 3;
    this.width = owner === 'player' ? 4 : 6;
    this.height = owner === 'player' ? 12 : 6;
    this.radius = options.radius || (this.style === 'big' ? 6 : this.style === 'needle' ? 3 : 3.5);
    this.dead = false;
    this.grazed = false;
    this.hitSet = null; // piercing bullets damage each enemy once
    this.age = 0;
  }

  update(dt, enemies, boss) {
    const dtF = dt / 16.667;
    this.age += dt;
    if (this.homing && ((enemies && enemies.length > 0) || boss)) {
      let nearest = null, nearDist = Infinity;
      const list = enemies || [];
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e.y < -10) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        const d = dx * dx + dy * dy;
        if (d < nearDist) { nearDist = d; nearest = e; }
      }
      if (boss) {
        const dx = boss.x - this.x, dy = boss.y - this.y;
        if (dx * dx + dy * dy < nearDist) nearest = boss;
      }
      if (nearest) {
        const dx = nearest.x - this.x, dy = nearest.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const turn = (this.style === 'missile' ? 0.45 : 0.14) * dtF;
        this.vx += (dx / d) * turn;
        this.vy += (dy / d) * turn;
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const max = this.style === 'missile' ? 9 : 8;
        if (speed > max) { this.vx = this.vx / speed * max; this.vy = this.vy / speed * max; }
      }
    }

    this.x += this.vx * dtF;
    this.y += this.vy * dtF;

    if (this.ricochet && this.bounces < this.maxBounces) {
      if (this.x < 0 || this.x > 480) {
        this.vx = -this.vx; this.bounces++;
        this.x = Math.max(0, Math.min(480, this.x));
      }
    }

    if (this.x < -20 || this.x > 500 || this.y < -30 || this.y > 730) this.dead = true;
  }

  draw(ctx) {
    const s = this.style;
    if (this.owner === 'player') {
      if (s === 'missile') {
        FX.glow(ctx, this.x, this.y, 9, '#ff9a3a', 0.9);
        ctx.fillStyle = '#fff2d0';
        ctx.fillRect(this.x - 1.5, this.y - 3, 3, 6);
        return;
      }
      FX.glow(ctx, this.x, this.y, 10, this.color, 0.75);
      ctx.drawImage(boltSprite(this.color), this.x - 1.6, this.y - 8, 3.2, 16);
      return;
    }
    if (s === 'needle') {
      const a = Math.atan2(this.vy, this.vx);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(a);
      FX.glow(ctx, 0, 0, 12, this.color, 0.9);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-9, -1.2, 18, 2.4);
      ctx.restore();
      return;
    }
    const r = this.radius;
    FX.glow(ctx, this.x, this.y, r * 3.4, this.color, 0.85);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

// ===== ABILITY POWER-UP =====
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
    this.y += this.vy * (dt / 16.667);
    this.age += dt;
    if (this.y > 730) this.dead = true;
  }

  draw(ctx) {
    const bob = Math.sin(this.age * 0.003 + this.bobOffset) * 3;
    const x = this.x, y = this.y + bob;
    const col = RARITY_COLORS[getAbilityRarity(this.abilityId)] || '#00ffff';
    FX.glow(ctx, x, y, 22 + Math.sin(this.age * 0.006) * 3, col, 0.8);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.age * 0.0015);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * 13, py = Math.sin(a) * 13;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(4,8,24,0.85)';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    ctx.drawImage(GameAssets.drawAbilityIcon(this.abilityId, getAbilityRarity(this.abilityId)), x - 9, y - 9, 18, 18);
  }

  checkCollision(player) {
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    return Math.sqrt(dx * dx + dy * dy) < 30;
  }
}

// ===== SCORE / POWER PICKUPS =====
// 'core'  — weapon power. Collect enough and the main gun levels up.
// 'medal' — score. Each medal caught in a row is worth more; dropping one
//           breaks the medal chain.
class Pickup {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = -2 - Math.random() * 1.5; // little pop upward
    this.age = 0;
    this.dead = false;
    this.missed = false;
  }

  update(dt, player, magnetAll, range = 75) {
    const dtF = dt / 16.667;
    this.age += dt;
    const dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const pull = magnetAll ? 900 : range;
    if (d < pull && this.age > 250) {
      const sp = magnetAll ? 9 : 6;
      this.x += (dx / d) * sp * dtF;
      this.y += (dy / d) * sp * dtF;
    } else {
      this.vy = Math.min(1.7, this.vy + 0.08 * dtF);
      this.vx *= Math.pow(0.95, dtF);
      this.x += this.vx * dtF;
      this.y += this.vy * dtF;
    }
    if (this.y > 720) { this.dead = true; this.missed = true; }
  }

  collides(player) {
    const dx = player.x - this.x, dy = player.y - this.y;
    return dx * dx + dy * dy < 22 * 22;
  }

  draw(ctx) {
    const t = this.age;
    if (this.kind === 'core') {
      FX.glow(ctx, this.x, this.y, 14, '#ff7a1a', 0.85);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(t * 0.004);
      ctx.fillStyle = '#ffd08a';
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.2, -3, 2.4, 2.4);
      ctx.restore();
      ctx.font = '5px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('P', this.x, this.y + 13);
    } else {
      // Spinning gold medal (fake 3D via horizontal squash)
      const sq = Math.abs(Math.cos(t * 0.006));
      FX.glow(ctx, this.x, this.y, 13, '#ffd23a', 0.7);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(0.25 + sq * 0.75, 1);
      const g = ctx.createRadialGradient(-2, -2, 1, 0, 0, 7);
      g.addColorStop(0, '#fff6c8'); g.addColorStop(0.6, '#ffc21a'); g.addColorStop(1, '#a36a00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a4a00'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#a36a00';
      ctx.fillRect(-1, -4, 2, 8);
      ctx.restore();
    }
  }
}

// ===== PLAYER =====
// Weapon levels (power cores raise them, losing a life drops one):
//   1 single · 2 twin · 3 triple spread · 4 quad, faster · 5 penta + missiles · 6 MAX
const WEAPON_MAX_LEVEL = 6;
const CORES_PER_LEVEL = [0, 3, 5, 8, 12, 16]; // cores needed to go from level i+1 to i+2

class Player {
  constructor(canvasW, canvasH) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.x = canvasW / 2;
    this.y = canvasH * 0.82;
    this.width = 40; this.height = 40;
    this.hitRadius = 5;      // bullets only hurt inside this — the ship's core
    this.grazeRadius = 24;   // bullets passing inside this (but outside hitRadius) graze
    this.speed = 5.2;
    this.hp = 100; this.maxHp = 100;
    this.lives = 3;
    this.fireRate = 250; // ms between shots at weapon level 1
    this.lastShot = 0;
    this.lastMissile = 0;
    this.vx = 0; this.vy = 0; this.bank = 0;
    this.focus = false;

    this.weaponLevel = 1;
    this.cores = 0;
    this.dmgScale = 1;     // set by the game from the wave number
    this.overdrive = false;
    this.visual = null;    // skin ship visual
    this.bulletColor = '#7ff3ff';

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
    this.droneActive = false; this.droneTimer = 0; this.droneAngle = 0; this.droneDamage = 15; this.droneLastShot = 0;
    this.vortexActive = false; this.vortexTimer = 0; this.vortexAngle = 0; this.vortexDamage = 20;
    this.gravityWell = false; this.gravityWellTimer = 0; this.gravityCharge = 0;
    this.phoenixReady = false; this.phoenixHeal = 50;
    this.regenTimer = 0; this.regenRate = 0;

    // Touch/joystick input
    this.joystickVX = 0;
    this.joystickVY = 0;
    this.dragDX = 0; this.dragDY = 0;   // finger drag, applied 1:1 next update

    this.invulnTimer = 0;
    this.flashTimer = 0;
  }

  get effectiveWeaponLevel() {
    return Math.min(WEAPON_MAX_LEVEL, this.weaponLevel + (this.tripleShot ? 2 : 0));
  }

  get effectiveDamage() {
    let dmg = 20 * (this.dmgScale || 1) * (this.perkDmg || 1);
    if (this.overcharge) dmg *= (this.overchargeMultiplier || 2);
    return dmg;
  }

  get effectiveFireRate() {
    const lvl = this.effectiveWeaponLevel;
    let rate = lvl >= 6 ? 175 : lvl >= 4 ? 210 : this.fireRate;
    if (this.rapidFire) rate /= 2;
    if (this.speedBoost) rate /= 1.3;
    if (this.overdrive) rate /= 1.5;
    return rate / (this.perkRate || 1);
  }

  get effectiveSpeed() {
    let s = this.speedBoost ? this.speed * 1.6 : this.speed;
    if (this.focus) s *= 0.5;
    return s;
  }

  // Cores needed for the next level (Infinity at max)
  get coresForNext() {
    return this.weaponLevel >= WEAPON_MAX_LEVEL ? Infinity : CORES_PER_LEVEL[this.weaponLevel];
  }

  // Returns true when the weapon levelled up
  addCore() {
    if (this.weaponLevel >= WEAPON_MAX_LEVEL) return false;
    this.cores++;
    if (this.cores >= this.coresForNext) {
      this.cores = 0;
      this.weaponLevel++;
      return true;
    }
    return false;
  }

  loseWeaponLevel() {
    this.weaponLevel = Math.max(1, this.weaponLevel - 1);
    this.cores = 0;
  }

  takeDamage(amount) {
    if (this.shielded || this.invulnTimer > 0) return false;
    this.hp -= amount;
    this.invulnTimer = 900;
    this.flashTimer = 900;
    return true;
  }

  update(keys, dt, now) {
    const dtF = dt / 16.667;
    let dx = 0, dy = 0;
    if (keys['ArrowLeft']  || keys['a'] || keys['A']) dx -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
    if (keys['ArrowUp']    || keys['w'] || keys['W']) dy -= 1;
    if (keys['ArrowDown']  || keys['s'] || keys['S']) dy += 1;
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    dx += this.joystickVX;
    dy += this.joystickVY;
    const mag = Math.sqrt(dx * dx + dy * dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    this.focus = !!keys['Shift'];

    const spd = this.effectiveSpeed;
    const drag = this.focus ? 0.5 : 1;
    const nx = Math.max(this.width / 2, Math.min(this.canvasW - this.width / 2, this.x + dx * spd * dtF + this.dragDX * drag));
    const ny = Math.max(70, Math.min(this.canvasH - 26, this.y + dy * spd * dtF + this.dragDY * drag));
    this.dragDX = 0; this.dragDY = 0;
    this.vx = (nx - this.x) / Math.max(0.001, dtF);
    this.vy = (ny - this.y) / Math.max(0.001, dtF);
    this.x = nx; this.y = ny;
    this.bank += ((this.vx / 6) - this.bank) * Math.min(1, 0.2 * dtF);

    // Ability timers
    const tick = (flag, timer, extra) => {
      if (this[timer] > 0) {
        this[timer] -= dt;
        if (this[timer] <= 0) { this[flag] = false; if (extra) extra(); }
      }
    };
    tick('shielded', 'shieldTimer');
    tick('speedBoost', 'speedBoostTimer');
    tick('tripleShot', 'tripleShotTimer');
    tick('spreadShot', 'spreadShotTimer');
    tick('rapidFire', 'rapidFireTimer');
    tick('homingShot', 'homingShotTimer');
    tick('laserActive', 'laserTimer');
    tick('magneticField', 'magneticFieldTimer');
    tick('cloneActive', 'cloneTimer');
    tick('piercing', 'piercingTimer');
    tick('ricochet', 'ricochetTimer');
    tick('overcharge', 'overchargeTimer', () => { this.overchargeMultiplier = 2; });
    tick('droneActive', 'droneTimer');
    tick('vortexActive', 'vortexTimer');
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.regenTimer > 0) {
      this.regenTimer -= dt;
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt / 1000);
    }

    if (this.droneActive) this.droneAngle += dt * 0.003;
    if (this.vortexActive) this.vortexAngle += dt * 0.006;

    if (this.cloneActive) {
      const targetX = this.x + (this.x > this.canvasW / 2 ? -60 : 60);
      this.cloneX += (targetX - this.cloneX) * 0.08 * dtF;
      this.cloneY += (this.y + 10 - this.cloneY) * 0.08 * dtF;
    }
  }

  _bolt(bullets, x, y, angle, dmg, opts) {
    const sp = 10.5;
    bullets.push(new Bullet(x, y, Math.sin(angle) * sp, -Math.cos(angle) * sp, dmg, 'player', opts));
  }

  shoot(now, bullets) {
    if (now - this.lastShot < this.effectiveFireRate) return;
    this.lastShot = now;

    const base = this.effectiveDamage;
    const opts = {
      piercing: this.piercing || this.overdrive,
      homing: this.homingShot,
      ricochet: this.ricochet,
      color: this.overdrive ? '#ffe14a' : this.bulletColor
    };
    const x = this.x, y = this.y - 20;
    const lvl = this.effectiveWeaponLevel;

    switch (lvl) {
      case 1:
        this._bolt(bullets, x, y, 0, base, opts);
        break;
      case 2:
        this._bolt(bullets, x - 5, y, 0, base * 0.85, opts);
        this._bolt(bullets, x + 5, y, 0, base * 0.85, opts);
        break;
      case 3:
        this._bolt(bullets, x, y - 2, 0, base * 0.8, opts);
        this._bolt(bullets, x - 6, y + 2, -0.16, base * 0.8, opts);
        this._bolt(bullets, x + 6, y + 2, 0.16, base * 0.8, opts);
        break;
      case 4:
        this._bolt(bullets, x - 4, y, 0, base * 0.75, opts);
        this._bolt(bullets, x + 4, y, 0, base * 0.75, opts);
        this._bolt(bullets, x - 9, y + 3, -0.2, base * 0.75, opts);
        this._bolt(bullets, x + 9, y + 3, 0.2, base * 0.75, opts);
        break;
      default: // 5 and 6
        this._bolt(bullets, x, y - 3, 0, base * 0.72, opts);
        this._bolt(bullets, x - 6, y, -0.03, base * 0.72, opts);
        this._bolt(bullets, x + 6, y, 0.03, base * 0.72, opts);
        this._bolt(bullets, x - 10, y + 3, -0.22, base * 0.72, opts);
        this._bolt(bullets, x + 10, y + 3, 0.22, base * 0.72, opts);
        break;
    }

    if (this.spreadShot) {
      for (const a of [-0.7, -0.45, 0.45, 0.7]) this._bolt(bullets, x, y + 4, a, base * 0.7, opts);
    }

    // Homing missiles from the wingtips at level 5+
    if (lvl >= 5) {
      const every = lvl >= 6 ? 600 : 900;
      if (now - this.lastMissile >= every) {
        this.lastMissile = now;
        const mOpts = { homing: true, style: 'missile', piercing: false };
        bullets.push(new Bullet(x - 14, y + 14, -3, -4, base * 1.3, 'player', mOpts));
        bullets.push(new Bullet(x + 14, y + 14, 3, -4, base * 1.3, 'player', mOpts));
      }
    }

    if (this.cloneActive) {
      this._bolt(bullets, this.cloneX - 4, this.cloneY - 20, 0, base * 0.6, opts);
      this._bolt(bullets, this.cloneX + 4, this.cloneY - 20, 0, base * 0.6, opts);
    }

    Sounds.shoot();
  }

  draw(ctx) {
    const now = performance.now();
    // Blink while invulnerable after a hit
    const blinking = this.flashTimer > 0 && Math.floor(this.flashTimer / 70) % 2 === 0;

    if (this.overdrive) FX.glow(ctx, this.x, this.y, 46 + Math.sin(now * 0.02) * 4, '#ffcc33', 0.55);

    if (this.shielded) {
      const r = 30 + Math.sin(now * 0.008) * 1.5;
      FX.glow(ctx, this.x, this.y, r + 6, '#00e5ff', 0.35);
      ctx.save();
      ctx.strokeStyle = 'rgba(140,250,255,0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (this.magneticField) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(now * 0.01) * 0.1;
      ctx.strokeStyle = '#44ffff';
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -now * 0.03;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, 70, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (this.gravityWell) {
      const k = Math.min(1, this.gravityCharge / 30);
      FX.glow(ctx, this.x, this.y, 70 + k * 20, '#aa44ff', 0.25 + k * 0.3);
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = '#cc88ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, 90, now * 0.002, now * 0.002 + Math.PI * 1.4); ctx.stroke();
      ctx.restore();
    }

    if (this.vortexActive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const a = this.vortexAngle + (i / 4) * Math.PI * 2;
        const ex = this.x + Math.cos(a) * 58, ey = this.y + Math.sin(a) * 58;
        ctx.strokeStyle = 'rgba(0,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(a) * 18, this.y + Math.sin(a) * 18);
        ctx.quadraticCurveTo(this.x + Math.cos(a + 0.5) * 40, this.y + Math.sin(a + 0.5) * 40, ex, ey);
        ctx.stroke();
        FX.glow(ctx, ex, ey, 10, '#00ffff', 0.8);
      }
      ctx.restore();
    }

    if (this.droneActive) {
      const dx = this.x + Math.cos(this.droneAngle) * 50;
      const dy = this.y + Math.sin(this.droneAngle) * 50;
      FX.glow(ctx, dx, dy, 12, '#00ff88', 0.7);
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(this.droneAngle * 2);
      ctx.fillStyle = '#c8ffe0';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#00aa55';
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    }

    if (this.laserActive) {
      const w = 7 + Math.sin(now * 0.05) * 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(this.x - w * 2, 0, this.x + w * 2, 0);
      g.addColorStop(0, 'rgba(255,0,60,0)');
      g.addColorStop(0.5, 'rgba(255,40,80,0.8)');
      g.addColorStop(1, 'rgba(255,0,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(this.x - w * 2, 0, w * 4, this.y - 18);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(this.x - 1.5, 0, 3, this.y - 18);
      ctx.restore();
      FX.glow(ctx, this.x, this.y - 22, 18, '#ff3366', 0.9);
    }

    if (this.cloneActive) {
      ShipRenderer.draw(ctx, this.cloneX, this.cloneY, this.visual, { alpha: 0.5, noAura: true, scale: 0.8 });
    }

    if (!blinking) {
      ShipRenderer.draw(ctx, this.x, this.y, this.visual, {
        time: now,
        bank: this.bank,
        thrust: this.vy < -0.5 ? 1.5 : this.vy > 0.5 ? 0.6 : 1
      });
    }

    if (this.overcharge) FX.glow(ctx, this.x, this.y, 30, '#ffff33', 0.5);

    // Hit-box dot: always shown while focusing, briefly when bullets are near
    if (this.focus || this.showHitbox) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ff2a6a';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.hitRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

// ===== ENEMY =====
// Base stats before wave scaling. `size` is the hit box; sprites are drawn at
// their own logical size around it.
const ENEMY_TYPES = {
  basic:     { hp: 30,  speed: 0.9,  spdW: 0.04,  damage: 15, score: 100, coin: 2,  size: 24 },
  medium:    { hp: 70,  speed: 0.75, spdW: 0.035, damage: 25, score: 250, coin: 5,  size: 28 },
  heavy:     { hp: 150, speed: 0.55, spdW: 0.025, damage: 35, score: 500, coin: 10, size: 32 },
  shooter:   { hp: 50,  speed: 1.4,  spdW: 0.04,  damage: 18, score: 200, coin: 4,  size: 28 },
  weaver:    { hp: 25,  speed: 1.1,  spdW: 0.04,  damage: 18, score: 180, coin: 3,  size: 22 },
  splitter:  { hp: 90,  speed: 0.6,  spdW: 0.025, damage: 22, score: 300, coin: 7,  size: 30 },
  fragment:  { hp: 15,  speed: 1.6,  spdW: 0.05,  damage: 12, score: 60,  coin: 1,  size: 16 },
  dasher:    { hp: 40,  speed: 1.2,  spdW: 0.05,  damage: 40, score: 260, coin: 5,  size: 26 },
  kamikaze:  { hp: 35,  speed: 1.6,  spdW: 0.03,  damage: 35, score: 220, coin: 4,  size: 22 },
  sniper:    { hp: 60,  speed: 1.3,  spdW: 0.02,  damage: 24, score: 350, coin: 6,  size: 26 },
  shielder:  { hp: 80,  speed: 0.55, spdW: 0.02,  damage: 25, score: 400, coin: 8,  size: 30 },
  minelayer: { hp: 110, speed: 1.2,  spdW: 0.015, damage: 30, score: 450, coin: 9,  size: 32 },
  flanker:   { hp: 45,  speed: 2.2,  spdW: 0.03,  damage: 20, score: 300, coin: 5,  size: 24 },
  mine:      { hp: 12,  speed: 0.5,  spdW: 0,     damage: 20, score: 50,  coin: 0,  size: 14 },
  meteor:    { hp: 60,  speed: 1.6,  spdW: 0.02,  damage: 30, score: 150, coin: 2,  size: 30 }
};

// Types that leave the screen as part of their pattern — escaping is not a miss.
const ENEMY_PASSING_TYPES = new Set(['kamikaze', 'minelayer', 'flanker', 'mine', 'meteor']);

// Enemy HP grows 10% per wave; the player's damage and power cores keep up.
function enemyWaveMult(wave) { return 1 + (wave - 1) * 0.10; }

class Enemy {
  constructor(type, x, y, wave, opts = {}) {
    const def = ENEMY_TYPES[type] || ENEMY_TYPES.basic;
    this.type = ENEMY_TYPES[type] ? type : 'basic';
    this.x = x; this.y = y;
    this.wave = wave;
    this.dead = false;
    this.stunned = false; this.frozen = false;
    this.stunTimer = 0;
    this.elite = !!opts.elite;

    const waveMult = enemyWaveMult(wave);
    const eliteMult = this.elite ? 3 : 1;
    this.hp = this.maxHp = Math.floor(def.hp * waveMult * eliteMult * (opts.hpMult || 1));
    this.speed = def.speed + wave * def.spdW;
    this.damage = def.damage;
    this.score = def.score * (this.elite ? 4 : 1);
    this.coinDrop = def.coin * (this.elite ? 3 : 1);
    this.width = this.height = def.size * (this.elite ? 1.2 : 1);
    this.drawScale = this.elite ? 1.2 : 1;
    this.sprite = this.type === 'meteor'
      ? EnemySprites.meteor[Math.floor(Math.random() * EnemySprites.meteor.length)]
      : EnemySprites[this.type];

    this.canShoot = false;
    this.fireRate = 99999;
    this.lastShot = 0;
    this.flash = 0;
    this.age = 0;
    this.gemDropChance = this.elite ? 0.5 : 0.05;
    this.zigzagTimer = 0;
    this.zigzagDir = Math.random() > 0.5 ? 1 : -1;
    this.bounceDir = Math.random() > 0.5 ? 1 : -1;
    this.slowTimer = 0; this.slowMult = 1;
    this.knockTimer = 0; this.knockVy = 0;
    this.rotation = 0;
    this.holdFireRate = 3000 + Math.random() * 5000;

    // Formation flight (set by the wave spawner)
    this.slot = opts.slot || null;
    this.state = this.slot ? 'enter' : 'free';
    this.entryDelay = opts.entryDelay || 0;

    switch (this.type) {
      case 'shooter':
        this.canShoot = true;
        this.fireRate = Math.max(900, 1800 - wave * 35);
        this.lastShot = Math.random() * this.fireRate;
        this.targetY = 90 + Math.random() * 120;
        break;
      case 'weaver':
        this.weaveOffset = Math.random() * Math.PI * 2;
        break;
      case 'splitter':
        this.splitInto = 2;
        break;
      case 'fragment':
        this.driftVx = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random());
        break;
      case 'dasher':
        this.charging = false;
        this.chargeTimer = 900 + Math.random() * 700;
        this.chargeVx = 0;
        break;
      case 'kamikaze':
        this.targetY = 80 + Math.random() * 110;
        this.kState = 'descend';
        this.kTimer = 0;
        this.kvx = 0; this.kvy = 0;
        break;
      case 'sniper':
        this.targetY = 55 + Math.random() * 70;
        this.sState = 'approach';
        this.sTimer = 600 + Math.random() * 900;
        this.aimX = 240; this.aimY = 600;
        break;
      case 'shielder':
        this.shieldMax = Math.floor(120 * waveMult * eliteMult);
        this.shieldHp = this.shieldMax;
        this.shieldRegenDelay = 0;
        break;
      case 'minelayer':
        this.dir = x < 240 ? 1 : -1;
        this.baseY = y;
        this.mineTimer = 900;
        break;
      case 'flanker':
        this.dir = x < 240 ? 1 : -1;
        this.baseY = y;
        this.fired = false;
        this.canShoot = false;
        break;
      case 'mine':
        this.fuse = 3800 + Math.random() * 1200;
        this.armed = false;
        break;
      case 'meteor':
        this.mvx = (Math.random() - 0.5) * 2;
        this.spin = (Math.random() - 0.5) * 0.004;
        break;
    }
  }

  // Central damage entry point. Returns the damage actually applied to HP.
  // Shielders block bullets on their shield first; frozen enemies shatter for +50%.
  hit(amount, source = 'bullet') {
    let dmg = amount * (this.frozen ? 1.5 : 1);
    if (this.type === 'shielder' && this.shieldHp > 0 && source === 'bullet') {
      const absorbed = Math.min(this.shieldHp, dmg);
      this.shieldHp -= absorbed;
      dmg -= absorbed;
      this.shieldRegenDelay = 3000;
      this.shieldFlash = 1;
    }
    if (dmg > 0) {
      this.hp -= dmg;
      this.flash = 1;
    }
    return dmg;
  }

  _applyKnockback(dt, dtF) {
    if (this.knockTimer <= 0) return;
    this.knockTimer -= dt;
    this.y -= this.knockVy * dtF;
    this.knockVy *= Math.pow(0.92, dtF);
    if (this.knockTimer <= 0) this.knockVy = 0;
  }

  // Formation-flying enemies swoop out of the grid toward the player.
  startDive(player) {
    if (this.state !== 'hold') return;
    this.state = 'dive';
    this.diveT = 0;
    this.diveDir = player && player.x < this.x ? -1 : 1;
    this.diveTargetX = player ? player.x : 240;
  }

  update(dt, bullets, timeSlow, player, world) {
    const dtF = dt / 16.667;
    this.age += dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 90);
    if (this.shieldFlash > 0) this.shieldFlash = Math.max(0, this.shieldFlash - dt / 150);

    this._applyKnockback(dt, dtF);

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowMult = 1;
    }

    if (this.type === 'shielder' && this.shieldHp < this.shieldMax) {
      if (this.shieldRegenDelay > 0) this.shieldRegenDelay -= dt;
      else this.shieldHp = Math.min(this.shieldMax, this.shieldHp + this.shieldMax * 0.35 * dt / 1000);
    }

    if (this.stunned || this.frozen) {
      if (this.stunTimer > 0) { this.stunTimer -= dt; if (this.stunTimer <= 0) { this.stunned = false; this.frozen = false; } }
      return;
    }

    const slow = this.slowTimer > 0 ? this.slowMult : 1;
    const speedMult = (timeSlow ? 0.5 : 1) * slow;
    const spd = this.speed * speedMult;
    const minX = this.width / 2;
    const maxX = 480 - this.width / 2;
    const sway = (world && world.sway) || 0;

    // ── Formation flight ──
    if (this.state !== 'free') {
      if (this.entryDelay > 0) { this.entryDelay -= dt; return; }
      if (this.state === 'enter') {
        const tx = this.slot.x + sway, ty = this.slot.y;
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = Math.max(2.2, Math.min(6, d * 0.06)) * speedMult;
        if (d < 3) { this.state = 'hold'; this.x = tx; this.y = ty; }
        else { this.x += (dx / d) * v * dtF; this.y += (dy / d) * v * dtF; }
      } else if (this.state === 'hold') {
        this.x = this.slot.x + sway;
        this.y = this.slot.y + Math.sin(this.age * 0.003 + this.slot.x * 0.05) * 3;
        // Medium crabs take potshots from the grid on later waves
        if (this.type === 'medium' && this.wave >= 3 && player) {
          this.lastShot += dt * speedMult;
          if (this.lastShot >= this.holdFireRate) {
            this.lastShot = 0;
            this.holdFireRate = 4200 + Math.random() * 4500;
            this._fireAimed(bullets, player, 3.4, this.damage * 0.8);
          }
        }
      } else if (this.state === 'dive') {
        this.diveT += dt;
        const vy = (2.4 + this.wave * 0.05) * speedMult;
        this.y += vy * dtF;
        // Curve toward where the player was, with a lazy S
        const dx = this.diveTargetX - this.x;
        this.x += (Math.sign(dx) * Math.min(Math.abs(dx), 2.2) + Math.sin(this.diveT * 0.006) * 1.6 * this.diveDir) * speedMult * dtF;
        if (player && this.diveT > 300 && this.diveT < 360 && this.wave >= 4) {
          this._fireAimed(bullets, player, 3.8, this.damage * 0.8);
        }
        if (this.y > 730) {
          // Loop back to the top and rejoin the formation
          this.y = -30;
          this.x = this.slot.x;
          this.state = 'enter';
        }
      }
      this.x = Math.max(minX, Math.min(maxX, this.x));
      return;
    }

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
        if (this.x > maxX) { this.x = maxX; this.bounceDir = -1; }
        else if (this.x < minX) { this.x = minX; this.bounceDir = 1; }
        break;
      case 'shooter':
        if (this.y < this.targetY) {
          this.y += spd * dtF;
        } else {
          this.zigzagTimer += dt;
          this.x += Math.sin(this.zigzagTimer * 0.0008) * 0.6 * dtF;
        }
        break;
      case 'weaver':
        this.y += spd * dtF;
        this.zigzagTimer += dt;
        this.x += Math.sin(this.zigzagTimer * 0.006 + this.weaveOffset) * 3.2 * dtF;
        break;
      case 'splitter':
        this.y += spd * dtF;
        this.zigzagTimer += dt;
        this.x += Math.sin(this.zigzagTimer * 0.0015) * 1.0 * dtF;
        break;
      case 'fragment':
        this.y += spd * dtF;
        this.x += this.driftVx * slow * dtF;
        if (this.x <= minX || this.x >= maxX) this.driftVx = -this.driftVx;
        break;
      case 'dasher':
        if (!this.charging) {
          this.y += spd * 0.5 * dtF;
          if (player) {
            const dx = player.x - this.x;
            this.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.2 * dtF);
          }
          this.chargeTimer -= dt;
          if (this.chargeTimer <= 0 || this.y > 250) {
            this.charging = true;
            if (player) {
              const vCharge = this.speed * 3.2;
              const frames = Math.max(1, (player.y - this.y) / vCharge);
              this.chargeVx = (player.x - this.x) / frames;
            } else {
              this.chargeVx = 0;
            }
          }
        } else {
          this.y += spd * 3.2 * dtF;
          this.x += this.chargeVx * slow * dtF;
        }
        break;
      case 'kamikaze':
        this._updateKamikaze(dt, dtF, spd, speedMult, player);
        break;
      case 'sniper':
        this._updateSniper(dt, dtF, spd, speedMult, player, bullets);
        break;
      case 'shielder':
        this.y += spd * dtF;
        if (player) {
          const dx = player.x - this.x;
          this.x += Math.sign(dx) * Math.min(Math.abs(dx), 0.5 * speedMult * dtF);
        }
        break;
      case 'minelayer':
        this.x += this.dir * spd * dtF;
        this.y = this.baseY + Math.sin(this.age * 0.002) * 18;
        this.mineTimer -= dt * speedMult;
        if (this.mineTimer <= 0 && this.x > 30 && this.x < 450 && world && world.spawn) {
          this.mineTimer = Math.max(800, 1500 - this.wave * 15);
          world.spawn(new Enemy('mine', this.x, this.y + 14, this.wave));
        }
        if ((this.dir > 0 && this.x > 520) || (this.dir < 0 && this.x < -40)) this.dead = true;
        return; // may leave the screen sideways — skip the clamp
      case 'flanker':
        this.x += this.dir * spd * dtF;
        this.y = this.baseY + Math.sin(this.age * 0.004) * 40;
        if (!this.fired && player && Math.abs(this.x - 240) < 120) {
          this.fired = true;
          this._fireAimed(bullets, player, 4.2, this.damage);
          if (this.wave >= 15) {
            this._fireAimed(bullets, player, 4.2, this.damage, -0.2);
            this._fireAimed(bullets, player, 4.2, this.damage, 0.2);
          }
        }
        if ((this.dir > 0 && this.x > 520) || (this.dir < 0 && this.x < -40)) this.dead = true;
        return;
      case 'mine': {
        this.y += spd * dtF;
        this.fuse -= dt;
        if (this.fuse < 1800) this.armed = true;
        const near = player && Math.hypot(player.x - this.x, player.y - this.y) < 60;
        if (this.fuse <= 0 || (this.armed && near)) {
          this.detonate(bullets);
          return;
        }
        break;
      }
      case 'meteor':
        this.y += spd * dtF;
        this.x += this.mvx * speedMult * dtF;
        this.rotation += this.spin * dt;
        if (this.x < -40 || this.x > 520) this.dead = true;
        if (this.y > 760) this.dead = true;
        return;
    }

    this.x = Math.max(minX, Math.min(maxX, this.x));

    if (this.canShoot) {
      this.lastShot += dt * slow;
      if (this.lastShot >= this.fireRate) {
        this.lastShot = 0;
        if (this.wave >= 12 && player) {
          for (const off of [-0.22, 0, 0.22]) this._fireAimed(bullets, player, 3.6, this.damage, off);
        } else if (this.wave >= 5 && player) {
          this._fireAimed(bullets, player, 3.8, this.damage);
        } else {
          bullets.push(new Bullet(this.x, this.y + this.height / 2, 0, 4.5, this.damage, 'enemy'));
        }
        if (this.elite && player) this._fireAimed(bullets, player, 2.8, this.damage, 0.45);
      }
    }

    if (this.y > 750) this.dead = true;
  }

  _fireAimed(bullets, player, speed, damage, angleOffset = 0, style = 'orb', color) {
    const a = Math.atan2(player.y - this.y, player.x - this.x) + angleOffset;
    bullets.push(new Bullet(this.x, this.y + this.height * 0.3, Math.cos(a) * speed, Math.sin(a) * speed, damage, 'enemy',
      { style, color }));
  }

  _updateKamikaze(dt, dtF, spd, speedMult, player) {
    if (this.kState === 'descend') {
      this.y += spd * 1.6 * dtF;
      if (this.y >= this.targetY) { this.kState = 'lock'; this.kTimer = 650; }
    } else if (this.kState === 'lock') {
      this.kTimer -= dt;
      this.rotation += dt * 0.02;
      if (this.kTimer <= 0) {
        this.kState = 'dive';
        const tx = player ? player.x : 240, ty = player ? player.y : 650;
        const a = Math.atan2(ty - this.y, tx - this.x);
        this.kvx = Math.cos(a) * 2; this.kvy = Math.sin(a) * 2;
      }
    } else {
      // Accelerate, with a little homing so it has to be dodged late
      const sp = Math.hypot(this.kvx, this.kvy);
      const nsp = Math.min(7 + this.wave * 0.03, sp + 0.18 * dtF);
      if (player && this.y < player.y - 40) {
        const a = Math.atan2(player.y - this.y, player.x - this.x);
        this.kvx += Math.cos(a) * 0.12 * dtF;
        this.kvy += Math.sin(a) * 0.12 * dtF;
      }
      const s2 = Math.hypot(this.kvx, this.kvy) || 1;
      this.kvx = this.kvx / s2 * nsp; this.kvy = this.kvy / s2 * nsp;
      this.x += this.kvx * speedMult * dtF;
      this.y += this.kvy * speedMult * dtF;
      this.rotation = Math.atan2(this.kvy, this.kvx) - Math.PI / 2;
      if (this.y > 760 || this.x < -40 || this.x > 520) this.dead = true;
    }
  }

  _updateSniper(dt, dtF, spd, speedMult, player, bullets) {
    if (this.y < this.targetY) { this.y += spd * dtF; return; }
    this.zigzagTimer += dt;
    this.x += Math.sin(this.zigzagTimer * 0.0007) * 0.5 * dtF;
    this.sTimer -= dt * speedMult;
    if (this.sState === 'approach' || this.sState === 'cool') {
      if (this.sTimer <= 0) { this.sState = 'aim'; this.sTimer = 1000; }
    } else if (this.sState === 'aim') {
      // Track the player, then lock for the last 280ms so it can be dodged
      if (player && this.sTimer > 280) { this.aimX = player.x; this.aimY = player.y; }
      if (this.sTimer <= 0) {
        const a = Math.atan2(this.aimY - this.y, this.aimX - this.x);
        const sp = 8.5;
        bullets.push(new Bullet(this.x, this.y + 8, Math.cos(a) * sp, Math.sin(a) * sp, this.damage, 'enemy',
          { style: 'needle', color: '#00e5ff' }));
        if (this.elite) {
          for (const off of [-0.12, 0.12]) {
            bullets.push(new Bullet(this.x, this.y + 8, Math.cos(a + off) * sp, Math.sin(a + off) * sp, this.damage, 'enemy',
              { style: 'needle', color: '#00e5ff' }));
          }
        }
        this.sState = 'cool';
        this.sTimer = Math.max(1300, 2400 - this.wave * 25);
      }
    }
  }

  // Mines burst into a ring of bullets. Not a kill — no score.
  detonate(bullets) {
    const n = this.wave >= 20 ? 10 : 8;
    const off = Math.random() * Math.PI;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      bullets.push(new Bullet(this.x, this.y, Math.cos(a) * 2.6, Math.sin(a) * 2.6, this.damage, 'enemy',
        { color: '#ffaa22' }));
    }
    this.detonated = true;
    this.dead = true;
  }

  draw(ctx) {
    const now = performance.now();
    const w = (this.sprite.logicalW || this.width) * this.drawScale;
    const h = (this.sprite.logicalH || this.height) * this.drawScale;

    if (this.elite) {
      FX.glow(ctx, this.x, this.y, w * 0.95 + Math.sin(now * 0.008) * 3, '#ffcc33', 0.55);
    }
    if (this.frozen) FX.glow(ctx, this.x, this.y, w * 0.9, '#66bbff', 0.7);
    if (this.slowTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#4caf2f';
      ctx.beginPath(); ctx.arc(this.x, this.y, this.width / 2 + 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Sniper aiming laser
    if (this.type === 'sniper' && this.sState === 'aim') {
      const locked = this.sTimer <= 280;
      ctx.save();
      ctx.globalAlpha = locked ? 0.85 : 0.25 + (1 - this.sTimer / 1000) * 0.3;
      ctx.strokeStyle = locked ? '#ffffff' : '#00e5ff';
      ctx.lineWidth = locked ? 1.6 : 1;
      ctx.setLineDash(locked ? [] : [4, 5]);
      const a = Math.atan2(this.aimY - this.y, this.aimX - this.x);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(a) * 900, this.y + Math.sin(a) * 900);
      ctx.stroke();
      ctx.restore();
    }

    // Dasher charge streak / warning
    if (this.type === 'dasher') {
      if (this.charging) {
        FX.glow(ctx, this.x, this.y - this.height * 0.6, 16, '#ff5a1f', 0.6);
      } else if (this.chargeTimer < 350) {
        ctx.save();
        ctx.globalAlpha = 0.4 + Math.sin(now * 0.02) * 0.3;
        ctx.strokeStyle = '#ff5a1f';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.width * 0.75, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
    if (this.type === 'kamikaze') {
      if (this.kState === 'lock') {
        const blink = Math.sin(now * 0.04) > 0;
        FX.glow(ctx, this.x, this.y, 22, blink ? '#ff2222' : '#ffaa00', 0.9);
      } else if (this.kState === 'dive') {
        FX.glow(ctx, this.x - this.kvx * 2, this.y - this.kvy * 2, 16, '#ff5522', 0.8);
      }
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.rotation) ctx.rotate(this.rotation);
    // Divers tilt toward where they are heading
    if (this.state === 'dive') ctx.rotate(Math.sin(this.diveT * 0.006) * 0.35 * this.diveDir);
    ctx.drawImage(this.sprite, -w / 2, -h / 2, w, h);
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.9;
      ctx.drawImage(FX.whiteOf(this.sprite), -w / 2, -h / 2, w, h);
    }
    ctx.restore();

    if (this.type === 'mine') {
      const rate = this.armed ? 0.03 : 0.008;
      if (Math.sin(now * rate) > 0) FX.glow(ctx, this.x, this.y, 10, this.armed ? '#ff2222' : '#ffaa00', 0.9);
      if (this.armed) {
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#ff4444';
        ctx.beginPath(); ctx.arc(this.x, this.y, 60, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    // Shield bubble on the side facing the player
    if (this.type === 'shielder' && this.shieldHp > 0) {
      const k = this.shieldHp / this.shieldMax;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(120,190,255,${0.35 + k * 0.5 + (this.shieldFlash || 0) * 0.3})`;
      ctx.lineWidth = 2 + k * 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.width * 0.8, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.restore();
      if (this.shieldFlash > 0) FX.glow(ctx, this.x, this.y + this.width * 0.6, 18, '#88ccff', this.shieldFlash);
    }

    // HP bar (only once damaged, never on tiny things)
    if (this.hp < this.maxHp && this.maxHp > 20 && this.type !== 'fragment') {
      const barW = this.width;
      const barX = this.x - barW / 2;
      const barY = this.y - this.height / 2 - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, 4);
      ctx.fillStyle = this.elite ? '#ffcc33' : '#ff3355';
      ctx.fillRect(barX, barY, barW * Math.max(0, this.hp / this.maxHp), 2);
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

    // Pesto slow field / pizza knockback (Italia Season abilities)
    this.slowTimer = 0; this.slowMult = 1;
    this.knockTimer = 0; this.knockVy = 0;
  }

  get isPhase2() { return this.hp / this.maxHp < 0.5; }

  update(dt, bullets, timeSlow) {
    const dtF = dt / 16.667;
    if (!this.arrived) {
      this.y += 2 * dtF;
      if (this.y >= this.targetY) { this.y = this.targetY; this.arrived = true; }
      return;
    }

    // Knockback pushes the boss up, then it slides back to its hover line
    if (this.knockTimer > 0) {
      this.knockTimer -= dt;
      this.y -= this.knockVy * dtF;
      this.knockVy *= Math.pow(0.9, dtF);
      if (this.knockTimer <= 0) this.knockVy = 0;
      this.y = Math.max(40, this.y);
    } else if (this.y < this.targetY) {
      this.y = Math.min(this.targetY, this.y + 0.8 * dtF);
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowMult = 1;
    }

    if (this.stunned || this.frozen) return;

    const speedMult = (timeSlow ? 0.5 : 1) * (this.slowTimer > 0 ? this.slowMult : 1);
    const spd = this.speed * speedMult * (this.isPhase2 ? 1.3 : 1);
    const minX = this.width / 2;
    const maxX = 480 - this.width / 2;

    this.x += spd * this.moveDir * dtF;
    if (this.x > maxX) { this.x = maxX; this.moveDir = -1; }
    else if (this.x < minX) { this.x = minX; this.moveDir = 1; }

    if (!this.enraged && this.isPhase2) {
      this.enraged = true;
      this.fireRate = 650;
    }

    this.patternTimer += dt;
    this.lastShot += dt * (this.slowTimer > 0 ? this.slowMult : 1);

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
    const now = performance.now();
    // Flash white for a moment whenever HP drops (damage comes from many places)
    if (this._lastHp != null && this.hp < this._lastHp) this._flash = 1;
    this._lastHp = this.hp;
    if (this._flash > 0) this._flash = Math.max(0, this._flash - 0.12);

    if (this.frozen) FX.glow(ctx, this.x, this.y, 60, '#66bbff', 0.7);
    if (this.isPhase2) FX.glow(ctx, this.x, this.y, 58 + Math.sin(now * 0.008) * 6, '#ff0044', 0.55);
    else FX.glow(ctx, this.x, this.y, 52, '#ff44cc', 0.3);

    if (this.slowTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#4caf2f';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Engines
    for (const ex of [-22, 22]) FX.glow(ctx, this.x + ex, this.y - 30, 12 + Math.random() * 3, '#ff66dd', 0.7);

    const sp = EnemySprites.boss;
    const d = sp.logicalW;
    ctx.drawImage(sp, this.x - d / 2, this.y - d / 2, d, d);
    if (this._flash > 0) {
      ctx.save();
      ctx.globalAlpha = this._flash * 0.8;
      ctx.drawImage(FX.whiteOf(sp), this.x - d / 2, this.y - d / 2, d, d);
      ctx.restore();
    }
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

    // Endless-mode compatibility. Boss Rush never touches these, but the wave
    // loop slows (time slow, pesto), knocks back (pizza) and draws its own HUD.
    this.slowTimer = 0; this.slowMult = 1;
    this.knockTimer = 0; this.knockVy = 0;
    this.fireRateScale = 1;
    this.showHealthBar = true;
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

  update(dt, bullets, timeSlow) {
    this._time += dt;
    const dtF = dt / 16.667;
    if (!this.arrived) {
      this.y += 2.5 * dtF;
      if (this.y >= this.targetY) { this.y = this.targetY; this.arrived = true; }
      return;
    }

    // Knockback shoves it up, then it slides back to its hover line
    if (this.knockTimer > 0) {
      this.knockTimer -= dt;
      this.y -= this.knockVy * dtF;
      this.knockVy *= Math.pow(0.9, dtF);
      if (this.knockTimer <= 0) this.knockVy = 0;
      this.y = Math.max(40, this.y);
    } else if (this.y < this.targetY) {
      this.y = Math.min(this.targetY, this.y + 0.8 * dtF);
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowMult = 1;
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

    const slowMult = (timeSlow ? 0.5 : 1) * (this.slowTimer > 0 ? this.slowMult : 1);
    const spd = this.speed * slowMult * (this.isPhase2 ? 1.3 : 1);
    const minX = this.width / 2;
    const maxX = 480 - this.width / 2;
    this.x += spd * this.moveDir * dtF;
    if (this.x > maxX) { this.x = maxX; this.moveDir = -1; }
    else if (this.x < minX) { this.x = minX; this.moveDir = 1; }

    this.patternTimer += dt;
    if (this.patternTimer >= this.patternInterval) {
      this.patternTimer = 0;
      this.attackPattern = (this.attackPattern + 1) % this._patternCount();
    }

    this.lastShot += dt * (this.slowTimer > 0 ? this.slowMult : 1);
    const fr = (this.isPhase2 ? this.fireRate * 0.75 : this.fireRate) * (this.fireRateScale || 1);
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

  // Retune for the endless mode: its own difficulty curve, and patterns that were
  // balanced against a Boss Rush loadout need a gentler cadence early on.
  scaleForWave(wave) {
    this.maxHp = Math.floor(500 * (1 + (wave / 5 - 1) * 0.5));
    this.hp = this.maxHp;
    this.fireRateScale = wave < 20 ? 1.35 : 1.15;
  }

  drawHealthBar(ctx) {
    if (!this.showHealthBar) return;
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
    this.maxHp = 3200; this.hp = this.maxHp;
    this._phase2Color = '#00ffff';
    this.shieldAngle = 0;
    this.shieldActive = true;
    this.shieldHp = 500;
    this.fireRate = 1100;
  }
  _bossName() { return 'ASTRAL SENTINEL'; }
  _patternCount() { return 3; }
  onPhase2Start() { this.shieldActive = false; this.fireRate = 800; }

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
      bullets.push(new Bullet(this.x + (i-2)*12, this.y+32, Math.cos(angle)*3.5, Math.sin(angle)*3.5, 18, 'enemy'));
    }
  }

  _pulseWave(bullets) {
    const count = this.isPhase2 ? 12 : 10;
    for (let i = 0; i < count; i++) {
      const angle = (i/count)*Math.PI*2 + this.shieldAngle;
      const spd = this.isPhase2 ? 2.6 : 2.2;
      bullets.push(new Bullet(this.x, this.y, Math.cos(angle)*spd, Math.sin(angle)*spd, 16, 'enemy'));
    }
  }

  _sentinelBarrage(bullets) {
    const cols = this.isPhase2 ? 5 : 4;
    for (let i = 0; i < cols; i++) {
      const x = 40 + i*(400/(cols-1));
      const spd = this.isPhase2 ? 3.2 : 2.8;
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
// Flash + fireball + expanding shockwave, all additive.
class Explosion {
  constructor(x, y, size = 1, color = '#ff8a2a') {
    this.x = x; this.y = y;
    this.size = size;
    this.color = color;
    this.age = 0;
    this.duration = 420 + size * 160;
    this.dead = false;
    // Big blasts bend the screen (WebGL renderer only)
    if (size >= 1.3 && typeof PostFX !== 'undefined' && PostFX.active) PostFX.shock(x, y, size);
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.duration) this.dead = true;
  }

  draw(ctx) {
    if (this.dead) return;
    const k = this.age / this.duration;          // 0 → 1
    const ease = 1 - Math.pow(1 - k, 3);
    const s = this.size;
    // Fireball
    FX.glow(ctx, this.x, this.y, (14 + 30 * ease) * s, this.color, (1 - k) * 1.1);
    // White-hot core, shrinking fast
    if (k < 0.35) FX.glow(ctx, this.x, this.y, (18 * s) * (1 - k / 0.35), '#ffffff', 1);
    // Shockwave ring
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, 1 - k) * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(0.5, 4 * s * (1 - k));
    ctx.beginPath();
    ctx.arc(this.x, this.y, (8 + 46 * ease) * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
