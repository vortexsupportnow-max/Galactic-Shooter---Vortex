// ===== ABILITIES SYSTEM =====
//
// Abilities are no longer single-use: an equipped ability recharges on a
// cooldown (rarity sets the base, every level shaves 3% off). Picking up a
// power-up of an equipped ability recharges it instantly.
//
// Balance rules:
//  - No more "kill everything on screen" buttons. Damage abilities deal big but
//    finite damage, scaled by gs.powerScale so they track enemy HP every wave.
//  - Utility abilities each do one distinct thing (reflect vs absorb, etc.).
//  - Durations are tuned to roughly 25–35% of the cooldown.

function getAbilityRarity(abilityId) {
  const rarities = {
    common:    ['shield','speed_boost','triple_shot','frag_bomb','rapid_fire','heal','spread_shot','homing'],
    rare:      ['laser','magnetic_field','clone','time_slow','piercing','ricochet','overcharge','drone','bushido_blade','pesto_genovese'],
    epic:      ['black_hole','emp','rain_of_fire','chain_lightning','vortex','gravity_well','turret','freeze','sakura_storm','pizza_gigante'],
    legendary: ['god_mode','nuke','time_warp','phoenix','singularity','storm']
  };
  for (const [rarity, ids] of Object.entries(rarities)) {
    if (ids.includes(abilityId)) return rarity;
  }
  return 'common';
}

function getAbilityCost(abilityId, currentLevel) {
  const multipliers = { common: 1, rare: 2, epic: 4, legendary: 8 };
  const rarity = getAbilityRarity(abilityId);
  return (currentLevel + 1) * 500 * (multipliers[rarity] || 1);
}

const ABILITY_BASE_COOLDOWN = { common: 14000, rare: 20000, epic: 28000, legendary: 45000 };

function getAbilityCooldown(abilityId, level = 1) {
  const def = ABILITIES[abilityId];
  const base = (def && def.cooldown) || ABILITY_BASE_COOLDOWN[getAbilityRarity(abilityId)] || 15000;
  return Math.round(base * (1 - 0.03 * (Math.max(1, level) - 1)));
}

// Damage scaled to the current wave (enemy HP grows 10%/wave)
function abilityDmg(gs, base) { return base * (gs.powerScale || 1); }

// Route ability damage through Enemy.hit when available (frozen bonus, flash)
function hurt(target, dmg) {
  if (!target) return;
  if (typeof target.hit === 'function') target.hit(dmg, 'ability');
  else target.hp -= dmg;
}

function clearEnemyBullets(gs, pointsEach = 0) {
  let n = 0;
  for (const b of gs.bullets) {
    if (b.owner === 'enemy' && !b.dead) {
      b.dead = true; n++;
      if (n % 2 === 0) gs.particles.emit(b.x, b.y, 2, '#ffffff', { speed: 1.5, decay: 0.06 });
    }
  }
  if (pointsEach && n) gs.score += n * pointsEach;
  return n;
}

function aliveEnemies(gs) {
  return gs.enemies.filter(e => e.hp > 0 && e.y > -20 && e.y < 720);
}

const ABILITIES = {
  // ===== COMMON =====
  shield: {
    id: 'shield', name: 'Shield', rarity: 'common', icon: 'shield',
    description: 'Invulnerabilità per 3s (+0.25s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.shielded = true;
      gs.player.shieldTimer = Math.max(gs.player.shieldTimer, (3 + level * 0.25) * 1000);
      Sounds.powerup();
    }
  },
  speed_boost: {
    id: 'speed_boost', name: 'Afterburner', rarity: 'common', icon: 'speed_boost',
    description: 'Velocità ×1.6 e fuoco +30% per 4s (+0.3s/liv), con 0.6s di schivata invulnerabile',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.speedBoost = true;
      gs.player.speedBoostTimer = (4 + level * 0.3) * 1000;
      gs.player.invulnTimer = Math.max(gs.player.invulnTimer, 600);
      gs.particles.emit(gs.player.x, gs.player.y + 20, 20, '#66ccff', { speed: 4, angle: Math.PI / 2, spread: 1 });
      Sounds.powerup();
    }
  },
  triple_shot: {
    id: 'triple_shot', name: 'Power Surge', rarity: 'common', icon: 'triple_shot',
    description: '+2 livelli all\'arma per 5s (+0.4s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.tripleShot = true;
      gs.player.tripleShotTimer = (5 + level * 0.4) * 1000;
      Sounds.powerup();
    }
  },
  frag_bomb: {
    id: 'frag_bomb', name: 'Frag Bomb', rarity: 'common', icon: 'frag_bomb',
    description: 'Esplosione attorno alla nave: 70 danni (+14/liv), raggio 110 (+8/liv)',
    maxLevel: 10,
    apply(gs, level) {
      const damage = abilityDmg(gs, 70 + level * 14);
      const radius = 110 + level * 8;
      const px = gs.player.x, py = gs.player.y;
      for (const e of gs.enemies) {
        if (Math.hypot(e.x - px, e.y - py) < radius) {
          hurt(e, damage);
          gs.particles.emit(e.x, e.y, 8, '#ff8800', { speed: 4 });
        }
      }
      if (gs.boss && Math.hypot(gs.boss.x - px, gs.boss.y - py) < radius + 30) hurt(gs.boss, damage);
      for (const b of gs.bullets) if (b.owner === 'enemy' && Math.hypot(b.x - px, b.y - py) < radius * 0.6) b.dead = true;
      if (gs.explosions) gs.explosions.push(new Explosion(px, py, radius / 40, '#ff8800'));
      gs.particles.emit(px, py, 40, '#ffaa33', { speed: 7, decay: 0.03 });
      Sounds.explosion(false);
    }
  },
  rapid_fire: {
    id: 'rapid_fire', name: 'Rapid Fire', rarity: 'common', icon: 'rapid_fire',
    description: 'Cadenza di fuoco doppia per 4s (+0.4s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.rapidFire = true;
      gs.player.rapidFireTimer = (4 + level * 0.4) * 1000;
      Sounds.powerup();
    }
  },
  heal: {
    id: 'heal', name: 'Repair', rarity: 'common', icon: 'heal',
    description: 'Cura 30 HP (+6/liv), poi +4 HP/s per 5s e 1.5s di scudo',
    maxLevel: 10,
    apply(gs, level) {
      const p = gs.player;
      p.hp = Math.min(p.maxHp, p.hp + 30 + level * 6);
      p.regenTimer = 5000; p.regenRate = 4;
      p.shielded = true; p.shieldTimer = Math.max(p.shieldTimer, 1500);
      gs.particles.emit(p.x, p.y, 25, '#00ff88', { speed: 2.5, decay: 0.02 });
      Sounds.powerup();
    }
  },
  spread_shot: {
    id: 'spread_shot', name: 'Spread Shot', rarity: 'common', icon: 'spread_shot',
    description: 'Aggiunge 4 colpi a ventaglio larghi per 4s (+0.4s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.spreadShot = true;
      gs.player.spreadShotTimer = (4 + level * 0.4) * 1000;
      Sounds.powerup();
    }
  },
  homing: {
    id: 'homing', name: 'Homing', rarity: 'common', icon: 'homing',
    description: 'I colpi inseguono i nemici per 5s (+0.5s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.homingShot = true;
      gs.player.homingShotTimer = (5 + level * 0.5) * 1000;
      Sounds.powerup();
    }
  },

  // ===== RARE =====
  laser: {
    id: 'laser', name: 'Laser', rarity: 'rare', icon: 'laser',
    description: 'Raggio continuo per 3s (+0.3s/liv) che trapassa tutto davanti alla nave',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.laserActive = true;
      gs.player.laserTimer = (3 + level * 0.3) * 1000;
      // damage per 16ms tick: ~150 dps at L1, ~340 at L10, before wave scaling
      gs.player.laserDamage = abilityDmg(gs, 2.4 + level * 0.32);
      Sounds.abilityUse();
    }
  },
  magnetic_field: {
    id: 'magnetic_field', name: 'Reflector', rarity: 'rare', icon: 'magnetic_field',
    description: 'Per 5s (+0.5s/liv) i proiettili nemici vicini vengono rimandati indietro contro i nemici',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.magneticField = true;
      gs.player.magneticFieldTimer = (5 + level * 0.5) * 1000;
      Sounds.powerup();
    }
  },
  clone: {
    id: 'clone', name: 'Clone', rarity: 'rare', icon: 'clone',
    description: 'Una nave gemella spara con te per 6s (+0.5s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      const p = gs.player;
      p.cloneActive = true;
      p.cloneTimer = (6 + level * 0.5) * 1000;
      p.cloneX = p.x + (p.x > 240 ? -60 : 60);
      p.cloneY = p.y;
      Sounds.powerup();
    }
  },
  time_slow: {
    id: 'time_slow', name: 'Time Slow', rarity: 'rare', icon: 'time_slow',
    description: 'Nemici e proiettili nemici al 50% per 4s (+0.4s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.timeSlow = true;
      gs.timeSlowTimer = (4 + level * 0.4) * 1000;
      Sounds.abilityUse();
    }
  },
  piercing: {
    id: 'piercing', name: 'Piercing', rarity: 'rare', icon: 'piercing',
    description: 'I colpi trapassano i nemici per 6s (+0.5s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.piercing = true;
      gs.player.piercingTimer = (6 + level * 0.5) * 1000;
      Sounds.powerup();
    }
  },
  ricochet: {
    id: 'ricochet', name: 'Ricochet', rarity: 'rare', icon: 'ricochet',
    description: 'I colpi rimbalzano sui bordi per 6s (+0.5s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.ricochet = true;
      gs.player.ricochetTimer = (6 + level * 0.5) * 1000;
      Sounds.powerup();
    }
  },
  overcharge: {
    id: 'overcharge', name: 'Overcharge', rarity: 'rare', icon: 'overcharge',
    description: 'Danni ×2 per 4s (+0.4s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.overcharge = true;
      gs.player.overchargeMultiplier = Math.max(gs.player.overchargeMultiplier || 2, 2);
      gs.player.overchargeTimer = (4 + level * 0.4) * 1000;
      Sounds.abilityUse();
    }
  },
  drone: {
    id: 'drone', name: 'Drone', rarity: 'rare', icon: 'drone',
    description: 'Drone orbitante che mira al nemico più vicino per 10s (+1s/liv), 14 danni (+3/liv)',
    maxLevel: 10,
    apply(gs, level) {
      const p = gs.player;
      p.droneActive = true;
      p.droneTimer = (10 + level) * 1000;
      p.droneAngle = 0;
      p.droneDamage = abilityDmg(gs, 14 + level * 3);
      Sounds.powerup();
    }
  },

  // ===== EPIC =====
  black_hole: {
    id: 'black_hole', name: 'Black Hole', rarity: 'epic', icon: 'black_hole',
    description: 'Buco nero che risucchia e logora i nemici per 3s (+0.3s/liv); al boss il 30%',
    maxLevel: 10,
    apply(gs, level) {
      // Opens over the densest part of the screen rather than a fixed point
      const list = aliveEnemies(gs);
      let x = 240, y = 260;
      if (list.length) {
        x = list.reduce((s, e) => s + e.x, 0) / list.length;
        y = Math.min(450, list.reduce((s, e) => s + e.y, 0) / list.length);
      }
      gs.blackHole = { x, y, timer: (3 + level * 0.3) * 1000, damage: abilityDmg(gs, 1.3 + level * 0.25) };
      Sounds.abilityUse();
    }
  },
  emp: {
    id: 'emp', name: 'EMP', rarity: 'epic', icon: 'emp',
    description: 'Cancella i proiettili nemici e stordisce tutti per 2.5s (+0.25s/liv); il boss per metà tempo',
    maxLevel: 10,
    apply(gs, level) {
      const dur = (2.5 + level * 0.25) * 1000;
      gs.empActive = true;
      gs.empTimer = dur;
      for (const e of gs.enemies) e.stunned = true;
      if (gs.boss) { gs.boss.stunned = true; gs.bossStunTimer = dur / 2; }
      clearEnemyBullets(gs, 10);
      gs.particles.emit(240, 350, 60, '#88ffff', { speed: 9, decay: 0.015 });
      gs.screenFlash = Math.max(gs.screenFlash || 0, 0.35);
      Sounds.abilityUse();
    }
  },
  rain_of_fire: {
    id: 'rain_of_fire', name: 'Rain of Fire', rarity: 'epic', icon: 'rain_of_fire',
    description: 'Pioggia di missili sui nemici per 4s (+0.4s/liv), 30 danni (+6/liv) ciascuno',
    maxLevel: 10,
    apply(gs, level) {
      gs.rainOfFire = { timer: (4 + level * 0.4) * 1000, interval: 120, lastSpawn: 0, damage: abilityDmg(gs, 30 + level * 6) };
      Sounds.abilityUse();
    }
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', rarity: 'epic', icon: 'chain_lightning',
    description: 'Fulmine che salta tra 5 nemici (+1 ogni 2 liv): 90 danni (+18/liv), istantaneo',
    maxLevel: 10,
    apply(gs, level) {
      const damage = abilityDmg(gs, 90 + level * 18);
      const jumps = 5 + Math.floor(level / 2);
      const pool = aliveEnemies(gs);
      if (gs.boss) pool.push(gs.boss);
      const pts = [{ x: gs.player.x, y: gs.player.y - 20 }];
      let cur = pts[0];
      for (let i = 0; i < jumps && pool.length; i++) {
        // Always jump to the nearest remaining target
        let bi = 0, bd = Infinity;
        for (let j = 0; j < pool.length; j++) {
          const d = Math.hypot(pool[j].x - cur.x, pool[j].y - cur.y);
          if (d < bd) { bd = d; bi = j; }
        }
        const t = pool.splice(bi, 1)[0];
        hurt(t, damage);
        gs.particles.emit(t.x, t.y, 12, '#ffff66', { speed: 5 });
        cur = { x: t.x, y: t.y };
        pts.push(cur);
      }
      if (!gs.lightnings) gs.lightnings = [];
      gs.lightnings.push({ pts, life: 350, max: 350, color: '#ccf4ff' });
      Sounds.explosion(false);
    }
  },
  vortex: {
    id: 'vortex', name: 'Vortex Blade', rarity: 'epic', icon: 'vortex',
    description: 'Lame rotanti attorno alla nave per 6s (+0.5s/liv): tagliano nemici e proiettili',
    maxLevel: 10,
    apply(gs, level) {
      const p = gs.player;
      p.vortexActive = true;
      p.vortexTimer = (6 + level * 0.5) * 1000;
      p.vortexAngle = 0;
      p.vortexDamage = abilityDmg(gs, 1.6 + level * 0.3);
      Sounds.abilityUse();
    }
  },
  gravity_well: {
    id: 'gravity_well', name: 'Gravity Well', rarity: 'epic', icon: 'gravity_well',
    description: 'Per 5s (+0.5s/liv) assorbe i proiettili vicini; alla fine rilascia un\'onda d\'urto più forte per ogni colpo assorbito',
    maxLevel: 10,
    apply(gs, level) {
      const p = gs.player;
      p.gravityWell = true;
      p.gravityWellTimer = (5 + level * 0.5) * 1000;
      p.gravityCharge = 0;
      p.gravityLevel = level;
      Sounds.powerup();
    }
  },
  turret: {
    id: 'turret', name: 'Turret', rarity: 'epic', icon: 'turret',
    description: 'Torretta che colpisce il nemico più vicino per 10s (+1s/liv), 16 danni (+3/liv)',
    maxLevel: 10,
    apply(gs, level) {
      gs.turret = {
        x: gs.player.x, y: Math.max(120, gs.player.y - 60),
        timer: (10 + level) * 1000,
        fireRate: 280,
        lastShot: 0,
        damage: abilityDmg(gs, 16 + level * 3),
        angle: -Math.PI / 2
      };
      Sounds.powerup();
    }
  },
  freeze: {
    id: 'freeze', name: 'Freeze', rarity: 'epic', icon: 'freeze',
    description: 'Congela tutti per 2.5s (+0.25s/liv): i nemici congelati subiscono +50% danni',
    maxLevel: 10,
    apply(gs, level) {
      const dur = (2.5 + level * 0.25) * 1000;
      gs.freezeActive = true;
      gs.freezeTimer = dur;
      for (const e of gs.enemies) e.frozen = true;
      if (gs.boss) { gs.boss.frozen = true; gs.bossFreezeTimer = dur * 0.4; }
      for (const b of gs.bullets) if (b.owner === 'enemy') { b.vx *= 0.3; b.vy *= 0.3; }
      gs.particles.emit(240, 350, 50, '#88ccff', { speed: 7, decay: 0.012 });
      Sounds.abilityUse();
    }
  },

  // ===== JAPAN SEASON — Season 1 (pass-exclusive, archived) =====
  bushido_blade: {
    id: 'bushido_blade', name: 'Bushido Blade', rarity: 'rare', icon: 'bushido_blade',
    season_exclusive: true, season_tag: '🌸 JAPAN SEASON',
    description: 'Fendente di katana: 140 danni (+20/liv) a tutto ciò che è nella colonna della nave',
    maxLevel: 10,
    apply(gs, level) {
      const damage = abilityDmg(gs, 140 + level * 20);
      const slashX = gs.player.x;
      const slashWidth = 34 + level * 3;
      for (const e of gs.enemies) {
        if (Math.abs(e.x - slashX) < slashWidth && e.y < gs.player.y) {
          hurt(e, damage);
          gs.particles.emit(e.x, e.y, 12, '#ff4400', { speed: 5 });
        }
      }
      for (const b of gs.bullets) if (b.owner === 'enemy' && Math.abs(b.x - slashX) < slashWidth) b.dead = true;
      if (gs.boss && Math.abs(gs.boss.x - slashX) < slashWidth + 30) {
        hurt(gs.boss, damage);
        gs.particles.emit(gs.boss.x, gs.boss.y, 20, '#ff4400', { speed: 6 });
      }
      if (!gs.slashes) gs.slashes = [];
      gs.slashes.push({ x: slashX, w: slashWidth, life: 300, max: 300 });
      Sounds.explosion(false);
    }
  },
  sakura_storm: {
    id: 'sakura_storm', name: 'Sakura Storm', rarity: 'epic', icon: 'sakura_storm',
    season_exclusive: true, season_tag: '🌸 JAPAN SEASON',
    description: 'Petali che cadono sui nemici per 4s (+0.4s/liv), 22 danni (+5/liv) ciascuno',
    maxLevel: 10,
    apply(gs, level) {
      gs.sakuraStorm = {
        timer: (4 + level * 0.4) * 1000,
        interval: 150,
        lastSpawn: 0,
        damage: abilityDmg(gs, 22 + level * 5)
      };
      gs.particles.emit(gs.player.x, gs.player.y, 30, '#ff88cc', { speed: 5, decay: 0.015 });
      Sounds.abilityUse();
    }
  },

  // ===== ITALIA SEASON — Season 2 (pass-exclusive) =====
  pesto_genovese: {
    id: 'pesto_genovese', name: 'Pesto Genovese', rarity: 'rare', icon: 'pesto_genovese',
    season_exclusive: true, season_tag: '🟩⬜🟥 ITALIA SEASON',
    description: 'Splash di pesto: nemici impantanati al 40% (-2%/livello) per 5s (+0.4s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      const splats = [];
      for (let i = 0; i < 9; i++) {
        splats.push({
          x: 30 + Math.random() * 420,
          y: 60 + Math.random() * 520,
          r: 22 + Math.random() * 30,
          rot: Math.random() * Math.PI * 2
        });
      }
      gs.pestoField = {
        timer: (5 + level * 0.4) * 1000,
        maxTimer: (5 + level * 0.4) * 1000,
        slowMult: Math.max(0.2, 0.4 - level * 0.02),
        splats
      };
      gs.particles.emit(gs.player.x, gs.player.y - 20, 30, '#4caf2f', { speed: 6, decay: 0.02 });
      Sounds.abilityUse();
    }
  },
  pizza_gigante: {
    id: 'pizza_gigante', name: 'Pizza Gigante', rarity: 'epic', icon: 'pizza_gigante',
    season_exclusive: true, season_tag: '🟩⬜🟥 ITALIA SEASON',
    description: 'Lancia una pizza gigante: 220+30/livello danni e sbalza indietro i nemici',
    maxLevel: 10,
    apply(gs, level) {
      gs.pizza = {
        x: gs.player.x,
        y: gs.player.y - 40,
        vy: -3.2,
        radius: 55 + level * 3,
        damage: abilityDmg(gs, 220 + level * 30),
        knockback: 5 + level * 0.5,
        angle: 0,
        hit: new Set(),
        bossHit: false,
        timer: 5000
      };
      gs.particles.emit(gs.player.x, gs.player.y - 30, 20, '#f0b429', { speed: 4, decay: 0.03 });
      Sounds.abilityUse();
    }
  },

  // ===== LEGENDARY =====
  god_mode: {
    id: 'god_mode', name: 'God Mode', rarity: 'legendary', icon: 'god_mode',
    description: 'Invulnerabile e danni ×3 per 3s (+0.3s/livello)',
    maxLevel: 10,
    apply(gs, level) {
      const dur = (3 + level * 0.3) * 1000;
      gs.player.shielded = true;
      gs.player.shieldTimer = Math.max(gs.player.shieldTimer, dur);
      gs.player.overcharge = true;
      gs.player.overchargeMultiplier = 3;
      gs.player.overchargeTimer = dur;
      gs.particles.emit(gs.player.x, gs.player.y, 50, '#ffff00', { speed: 6, decay: 0.01 });
      Sounds.levelup();
    }
  },
  nuke: {
    id: 'nuke', name: 'Nuke', rarity: 'legendary', icon: 'nuke',
    description: 'Cancella i proiettili e infligge 400 danni (+60/liv) a tutti i nemici; al boss il 6% (+0.5%/liv) degli HP',
    maxLevel: 10,
    apply(gs, level) {
      const damage = abilityDmg(gs, 400 + level * 60);
      for (const e of gs.enemies) {
        if (e.y < -20) continue;
        hurt(e, damage);
        gs.particles.emit(e.x, e.y, 10, '#ff8800', { speed: 5 });
      }
      if (gs.boss) {
        hurt(gs.boss, gs.boss.maxHp * (0.06 + level * 0.005));
        gs.particles.emit(gs.boss.x, gs.boss.y, 40, '#ff4400', { speed: 8 });
      }
      clearEnemyBullets(gs, 10);
      gs.screenFlash = 1;
      if (gs.explosions) gs.explosions.push(new Explosion(240, 350, 6, '#ffcc66'));
      gs.particles.emit(240, 350, 120, '#ffffff', { speed: 11, decay: 0.01 });
      Sounds.explosion(true);
    }
  },
  time_warp: {
    id: 'time_warp', name: 'Time Warp', rarity: 'legendary', icon: 'time_warp',
    description: 'Riavvolge i nemici in cima, cancella i proiettili e li rallenta al 50% per 4s (+0.3s/liv)',
    maxLevel: 10,
    apply(gs, level) {
      const dur = (4 + level * 0.3) * 1000;
      for (const e of gs.enemies) {
        if (e.slot) { e.state = 'enter'; e.y = Math.min(e.y, -20); }
        else e.y = Math.min(e.y, 30 + Math.random() * 60);
        e.slowMult = 0.5; e.slowTimer = dur;
      }
      if (gs.boss) { gs.boss.slowMult = 0.5; gs.boss.slowTimer = dur; }
      clearEnemyBullets(gs, 10);
      gs.particles.emit(240, 350, 70, '#aa44ff', { speed: 8, decay: 0.01 });
      gs.screenFlash = Math.max(gs.screenFlash || 0, 0.4);
      Sounds.abilityUse();
    }
  },
  phoenix: {
    id: 'phoenix', name: 'Phoenix', rarity: 'legendary', icon: 'phoenix',
    description: 'Arma una rinascita: alla prossima morte torni con 50 HP (+5/liv). Ricarica 60s',
    cooldown: 60000,
    maxLevel: 10,
    apply(gs, level) {
      gs.player.phoenixReady = true;
      gs.player.phoenixHeal = 50 + level * 5;
      gs.particles.emit(gs.player.x, gs.player.y, 30, '#ff8800', { speed: 3, decay: 0.015 });
      Sounds.powerup();
    }
  },
  singularity: {
    id: 'singularity', name: 'Singularity', rarity: 'legendary', icon: 'singularity',
    description: 'Singolarità che cresce e attira tutto per 4s, logorando chi è dentro; al boss il 25%',
    maxLevel: 10,
    apply(gs, level) {
      gs.singularity = {
        x: 240, y: 220, radius: 10, maxRadius: 110 + level * 8, growRate: 1.2,
        damage: abilityDmg(gs, 5 + level), timer: 4000
      };
      Sounds.abilityUse();
    }
  },
  storm: {
    id: 'storm', name: 'Storm', rarity: 'legendary', icon: 'storm',
    description: 'Fulmini casuali per 6s (+0.5s/liv), 70 danni (+14/liv) ciascuno',
    maxLevel: 10,
    apply(gs, level) {
      gs.storm = { timer: (6 + level * 0.5) * 1000, interval: 220, lastStrike: 0, damage: abilityDmg(gs, 70 + level * 14) };
      Sounds.abilityUse();
    }
  },

  // ── Boss Rush Exclusive Abilities ────────────────────────────────────────────
  void_pulse: {
    id: 'void_pulse', name: 'VOID PULSE', rarity: 'legendary', icon: 'void_pulse',
    description: 'Deals 15% of boss max HP as void damage. Boss Rush only.',
    boss_rush_only: true,
    maxLevel: 1,
    apply(gs, level) {
      if (!gs.boss) return;
      const dmg = Math.floor(gs.boss.maxHp * 0.15);
      const prevHp = gs.boss.hp;
      gs.boss.hp = Math.max(1, gs.boss.hp - dmg);
      if (typeof gs.registerBossDamage === 'function') {
        gs.registerBossDamage(prevHp - gs.boss.hp);
      }
      gs.particles.emit(gs.boss.x, gs.boss.y, 60, '#9900ff', { speed: 7, decay: 0.025 });
      // Void pulse shockwave effect
      gs.voidPulseEffect = { x: gs.boss.x, y: gs.boss.y, radius: 0, maxRadius: 180, timer: 600 };
      Sounds.abilityUse();
    }
  },
  phase_lock: {
    id: 'phase_lock', name: 'PHASE LOCK', rarity: 'legendary', icon: 'phase_lock',
    description: 'Freezes boss in current phase for 4s, blocking phase 2 transition. Boss Rush only.',
    boss_rush_only: true,
    maxLevel: 1,
    apply(gs, level) {
      if (!gs.boss) return;
      gs.boss.phaseLocked = true;
      gs.boss.phaseLockTimer = 4000;
      gs.particles.emit(gs.boss.x, gs.boss.y, 40, '#00ffff', { speed: 5, decay: 0.03 });
      Sounds.abilityUse();
    }
  },
  core_breach: {
    id: 'core_breach', name: 'CORE BREACH', rarity: 'legendary', icon: 'core_breach',
    description: 'Exposes boss core for 6s — all damage to boss multiplied ×3. Boss Rush only.',
    boss_rush_only: true,
    maxLevel: 1,
    apply(gs, level) {
      if (!gs.boss) return;
      gs.boss.coreBreached = true;
      gs.boss.coreBreachTimer = 6000;
      gs.boss.coreDamageMult = 3;
      gs.particles.emit(gs.boss.x, gs.boss.y, 50, '#ff4400', { speed: 6, decay: 0.02 });
      gs.coreBreach = { x: gs.boss.x, y: gs.boss.y, timer: 6000 };
      Sounds.abilityUse();
    }
  }
};
