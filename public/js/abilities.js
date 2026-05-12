// ===== ABILITIES SYSTEM =====

function getAbilityRarity(abilityId) {
  const rarities = {
    common:    ['shield','speed_boost','triple_shot','frag_bomb','rapid_fire','heal','spread_shot','homing'],
    rare:      ['laser','magnetic_field','clone','time_slow','piercing','ricochet','overcharge','drone','bushido_blade'],
    epic:      ['black_hole','emp','rain_of_fire','chain_lightning','vortex','gravity_well','turret','freeze','sakura_storm'],
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

const ABILITIES = {
  // ===== COMMON =====
  shield: {
    id: 'shield', name: 'Shield', rarity: 'common', icon: 'shield',
    description: 'Temporary invincibility for 4s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.shielded = true;
      gs.player.shieldTimer = (4 + level) * 1000;
      Sounds.powerup();
    }
  },
  speed_boost: {
    id: 'speed_boost', name: 'Speed Boost', rarity: 'common', icon: 'speed_boost',
    description: 'Speed x1.5 for 5s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.speedBoost = true;
      gs.player.speedBoostTimer = (5 + level * 0.5) * 1000;
      Sounds.powerup();
    }
  },
  triple_shot: {
    id: 'triple_shot', name: 'Triple Shot', rarity: 'common', icon: 'triple_shot',
    description: 'Fires 3 bullets spread for 8s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.tripleShot = true;
      gs.player.tripleShotTimer = (8 + level) * 1000;
      Sounds.powerup();
    }
  },
  frag_bomb: {
    id: 'frag_bomb', name: 'Frag Bomb', rarity: 'common', icon: 'frag_bomb',
    description: 'Explodes dealing area damage',
    maxLevel: 10,
    apply(gs, level) {
      const damage = 50 + level * 10;
      const radius = 100 + level * 10;
      const px = gs.player.x, py = gs.player.y;
      for (const e of gs.enemies) {
        const dx = e.x - px, dy = e.y - py;
        if (Math.sqrt(dx*dx + dy*dy) < radius) {
          e.hp -= damage;
          gs.particles.emit(e.x, e.y, 10, '#ff8800', { speed: 4 });
        }
      }
      if (gs.boss) {
        const dx = gs.boss.x - px, dy = gs.boss.y - py;
        if (Math.sqrt(dx*dx + dy*dy) < radius) gs.boss.hp -= damage;
      }
      gs.particles.emit(px, py, 30, '#ff8800', { speed: 6, decay: 0.03 });
      Sounds.explosion(false);
    }
  },
  rapid_fire: {
    id: 'rapid_fire', name: 'Rapid Fire', rarity: 'common', icon: 'rapid_fire',
    description: 'Doubles fire rate for 6s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.rapidFire = true;
      gs.player.rapidFireTimer = (6 + level * 0.5) * 1000;
      Sounds.powerup();
    }
  },
  heal: {
    id: 'heal', name: 'Heal', rarity: 'common', icon: 'heal',
    description: 'Restores 25+5*level HP',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.hp = Math.min(gs.player.maxHp, gs.player.hp + 25 + level * 5);
      gs.particles.emit(gs.player.x, gs.player.y, 15, '#00ff88', { speed: 2, decay: 0.02 });
      Sounds.powerup();
    }
  },
  spread_shot: {
    id: 'spread_shot', name: 'Spread Shot', rarity: 'common', icon: 'spread_shot',
    description: '5-way spread for 10s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.spreadShot = true;
      gs.player.spreadShotTimer = (10 + level) * 1000;
      Sounds.powerup();
    }
  },
  homing: {
    id: 'homing', name: 'Homing', rarity: 'common', icon: 'homing',
    description: 'Bullets home in on enemies for 8s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.homingShot = true;
      gs.player.homingShotTimer = (8 + level) * 1000;
      Sounds.powerup();
    }
  },

  // ===== RARE =====
  laser: {
    id: 'laser', name: 'Laser', rarity: 'rare', icon: 'laser',
    description: 'Continuous laser beam for 3s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.laserActive = true;
      gs.player.laserTimer = (3 + level * 0.5) * 1000;
      gs.player.laserDamage = 5 + level * 2;
      Sounds.abilityUse();
    }
  },
  magnetic_field: {
    id: 'magnetic_field', name: 'Mag Field', rarity: 'rare', icon: 'magnetic_field',
    description: 'Repulses enemy bullets for 8s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.magneticField = true;
      gs.player.magneticFieldTimer = (8 + level) * 1000;
      Sounds.powerup();
    }
  },
  clone: {
    id: 'clone', name: 'Clone', rarity: 'rare', icon: 'clone',
    description: 'Spawns a clone ship that shoots for 5s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.cloneActive = true;
      gs.player.cloneTimer = (5 + level) * 1000;
      gs.player.cloneX = gs.player.x + (gs.player.x > 240 ? -60 : 60);
      gs.player.cloneY = gs.player.y;
      Sounds.powerup();
    }
  },
  time_slow: {
    id: 'time_slow', name: 'Time Slow', rarity: 'rare', icon: 'time_slow',
    description: 'Slows enemies to 50% for 5s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.timeSlow = true;
      gs.timeSlowTimer = (5 + level * 0.5) * 1000;
      Sounds.abilityUse();
    }
  },
  piercing: {
    id: 'piercing', name: 'Piercing', rarity: 'rare', icon: 'piercing',
    description: 'Bullets pierce through enemies for 10s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.piercing = true;
      gs.player.piercingTimer = (10 + level) * 1000;
      Sounds.powerup();
    }
  },
  ricochet: {
    id: 'ricochet', name: 'Ricochet', rarity: 'rare', icon: 'ricochet',
    description: 'Bullets bounce off walls for 8s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.ricochet = true;
      gs.player.ricochetTimer = (8 + level) * 1000;
      Sounds.powerup();
    }
  },
  overcharge: {
    id: 'overcharge', name: 'Overcharge', rarity: 'rare', icon: 'overcharge',
    description: '2x damage for 8s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.overcharge = true;
      gs.player.overchargeTimer = (8 + level) * 1000;
      Sounds.abilityUse();
    }
  },
  drone: {
    id: 'drone', name: 'Drone', rarity: 'rare', icon: 'drone',
    description: 'Orbiting drone shoots enemies for 12s (+2s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.droneActive = true;
      gs.player.droneTimer = (12 + level * 2) * 1000;
      gs.player.droneAngle = 0;
      gs.player.droneDamage = 15 + level * 5;
      Sounds.powerup();
    }
  },

  // ===== EPIC =====
  black_hole: {
    id: 'black_hole', name: 'Black Hole', rarity: 'epic', icon: 'black_hole',
    description: 'Sucks in and damages all enemies for 3s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.blackHole = { x: 240, y: 350, timer: (3 + level * 0.5) * 1000, damage: 2 + level };
      Sounds.abilityUse();
    }
  },
  emp: {
    id: 'emp', name: 'EMP', rarity: 'epic', icon: 'emp',
    description: 'Stuns all enemies + boss for 4s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.empActive = true;
      gs.empTimer = (4 + level * 0.5) * 1000;
      for (const e of gs.enemies) e.stunned = true;
      if (gs.boss) gs.boss.stunned = true;
      gs.particles.emit(240, 350, 50, '#88ffff', { speed: 8, decay: 0.015 });
      Sounds.abilityUse();
    }
  },
  rain_of_fire: {
    id: 'rain_of_fire', name: 'Rain of Fire', rarity: 'epic', icon: 'rain_of_fire',
    description: 'Missiles rain from top for 5s',
    maxLevel: 10,
    apply(gs, level) {
      gs.rainOfFire = { timer: (5 + level * 0.5) * 1000, interval: 200, lastSpawn: 0, damage: 30 + level * 10 };
      Sounds.abilityUse();
    }
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', rarity: 'epic', icon: 'chain_lightning',
    description: 'Lightning chains between enemies (instant)',
    maxLevel: 10,
    apply(gs, level) {
      const damage = 80 + level * 20;
      const chains = 5 + level;
      let targets = [...gs.enemies];
      if (gs.boss) targets.push(gs.boss);
      targets = targets.sort(() => Math.random() - 0.5).slice(0, chains);
      for (const t of targets) {
        t.hp -= damage;
        gs.particles.emit(t.x, t.y, 15, '#ffff44', { speed: 5 });
      }
      if (gs.boss && targets.includes(gs.boss)) {
        // already damaged
      }
      Sounds.explosion(false);
    }
  },
  vortex: {
    id: 'vortex', name: 'Vortex Blade', rarity: 'epic', icon: 'vortex',
    description: 'Spinning blade around player for 8s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.vortexActive = true;
      gs.player.vortexTimer = (8 + level) * 1000;
      gs.player.vortexAngle = 0;
      gs.player.vortexDamage = 20 + level * 5;
      Sounds.abilityUse();
    }
  },
  gravity_well: {
    id: 'gravity_well', name: 'Gravity Well', rarity: 'epic', icon: 'gravity_well',
    description: 'Pulls enemy bullets away for 8s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.gravityWell = true;
      gs.player.gravityWellTimer = (8 + level) * 1000;
      Sounds.powerup();
    }
  },
  turret: {
    id: 'turret', name: 'Turret', rarity: 'epic', icon: 'turret',
    description: 'Auto-targeting turret for 15s (+2s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.turret = {
        x: gs.player.x, y: gs.player.y - 30,
        timer: (15 + level * 2) * 1000,
        fireRate: 400,
        lastShot: 0,
        damage: 20 + level * 5
      };
      Sounds.powerup();
    }
  },
  freeze: {
    id: 'freeze', name: 'Freeze', rarity: 'epic', icon: 'freeze',
    description: 'Freezes all enemies for 3s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.freezeActive = true;
      gs.freezeTimer = (3 + level * 0.5) * 1000;
      for (const e of gs.enemies) e.frozen = true;
      if (gs.boss) gs.boss.frozen = true;
      gs.particles.emit(240, 350, 40, '#44aaff', { speed: 6, decay: 0.01 });
      Sounds.abilityUse();
    }
  },

  // ===== JAPAN SEASON (pass-exclusive) =====
  bushido_blade: {
    id: 'bushido_blade', name: 'Bushido Blade', rarity: 'rare', icon: 'bushido_blade',
    season_exclusive: true,
    description: 'Katana slash: deals 300+30*level dmg to all enemies in a vertical line',
    maxLevel: 10,
    apply(gs, level) {
      const damage = 300 + level * 30;
      const slashX = gs.player.x;
      const slashWidth = 30 + level * 3;
      for (const e of gs.enemies) {
        if (Math.abs(e.x - slashX) < slashWidth) {
          e.hp -= damage;
          gs.particles.emit(e.x, e.y, 12, '#ff4400', { speed: 5 });
        }
      }
      if (gs.boss && Math.abs(gs.boss.x - slashX) < slashWidth * 2) {
        gs.boss.hp -= damage;
        gs.particles.emit(gs.boss.x, gs.boss.y, 20, '#ff4400', { speed: 6 });
      }
      gs.particles.emit(slashX, 350, 40, '#ff6600', { speed: 7, decay: 0.02 });
      Sounds.explosion(false);
    }
  },
  sakura_storm: {
    id: 'sakura_storm', name: 'Sakura Storm', rarity: 'epic', icon: 'sakura_storm',
    season_exclusive: true,
    description: 'Sakura petals deal area damage for 5s (+0.5s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.sakuraStorm = {
        timer: (5 + level * 0.5) * 1000,
        interval: 250,
        lastSpawn: 0,
        damage: 25 + level * 8
      };
      gs.particles.emit(gs.player.x, gs.player.y, 30, '#ff88cc', { speed: 5, decay: 0.015 });
      Sounds.abilityUse();
    }
  },

  // ===== LEGENDARY =====
  god_mode: {
    id: 'god_mode', name: 'God Mode', rarity: 'legendary', icon: 'god_mode',
    description: '3s complete invincibility + 5x damage',
    maxLevel: 10,
    apply(gs, level) {
      gs.player.shielded = true;
      gs.player.shieldTimer = (3 + level * 0.3) * 1000;
      gs.player.overcharge = true;
      gs.player.overchargeMultiplier = 5;
      gs.player.overchargeTimer = (3 + level * 0.3) * 1000;
      gs.particles.emit(gs.player.x, gs.player.y, 50, '#ffff00', { speed: 6, decay: 0.01 });
      Sounds.levelup();
    }
  },
  nuke: {
    id: 'nuke', name: 'Nuke', rarity: 'legendary', icon: 'nuke',
    description: 'Destroys all enemies on screen instantly',
    maxLevel: 10,
    apply(gs, level) {
      const damage = 9999 + level * 1000;
      for (const e of [...gs.enemies]) {
        e.hp = 0;
        gs.particles.emit(e.x, e.y, 20, '#ff8800', { speed: 5 });
      }
      if (gs.boss) {
        gs.boss.hp -= damage;
        gs.particles.emit(gs.boss.x, gs.boss.y, 50, '#ff4400', { speed: 8 });
      }
      gs.particles.emit(240, 350, 100, '#ffffff', { speed: 10, decay: 0.008 });
      Sounds.explosion(true);
    }
  },
  time_warp: {
    id: 'time_warp', name: 'Time Warp', rarity: 'legendary', icon: 'time_warp',
    description: 'Rewinds enemies to top of screen',
    maxLevel: 10,
    apply(gs, level) {
      for (const e of gs.enemies) {
        e.y = -20;
        e.x = 40 + Math.random() * 400;
      }
      gs.particles.emit(240, 350, 60, '#aa44ff', { speed: 7, decay: 0.01 });
      Sounds.abilityUse();
    }
  },
  phoenix: {
    id: 'phoenix', name: 'Phoenix', rarity: 'legendary', icon: 'phoenix',
    description: 'Auto-revive once per game with full HP',
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
    description: 'Growing black hole destroys all enemies',
    maxLevel: 10,
    apply(gs, level) {
      gs.singularity = { x: 240, y: 200, radius: 10, maxRadius: 150 + level * 20, growRate: 1.5, damage: 999, timer: 5000 };
      Sounds.abilityUse();
    }
  },
  storm: {
    id: 'storm', name: 'Storm', rarity: 'legendary', icon: 'storm',
    description: 'Random lightning strikes for 10s (+1s/level)',
    maxLevel: 10,
    apply(gs, level) {
      gs.storm = { timer: (10 + level) * 1000, interval: 300, lastStrike: 0, damage: 60 + level * 15 };
      Sounds.abilityUse();
    }
  }
};
