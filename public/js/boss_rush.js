// ===== BOSS RUSH GAME MODE =====

const BR_BOSS_SEQUENCE_LEN = 5;
const BR_PAUSE_BETWEEN_BOSSES = 5000; // ms
const BR_BOSS_TIME_BONUS_MAX = 60000; // 60s per boss — full bonus
const BR_ABILITY_IDS = ['void_pulse', 'phase_lock', 'core_breach'];
const BR_BOSS_BASE_SCORE = 8000;

class BossRushGame extends GalacticGame {
  constructor() {
    super();
    this._brMode = true;
  }

  startBossRush(skinBoosts = null, skinColor = null, skinTrail = null) {
    if (this.animId) cancelAnimationFrame(this.animId);

    const player = new Player(480, 700);
    player.lives = 1; // no respawns
    const boosts = skinBoosts || {};
    if (boosts.extra_lives > 0) player.lives += boosts.extra_lives;
    if (boosts.starting_shield) { player.shielded = true; player.shieldTimer = 5000; }
    player.skinColor = skinColor || null;

    // Build random boss order
    const order = _shuffleArray([0, 1, 2, 3, 4]);

    this.gs = {
      mode: 'boss_rush',
      score: 0,
      player,
      enemies: [],
      bullets: [],
      particles: new ParticleSystem(),
      explosions: [],
      powerUps: [],
      boss: null,
      bossIndex: 0,
      bossOrder: order,
      bossesDefeated: 0,
      bossKillCounts: {},
      bossStartTime: 0,
      bossElapsed: 0,
      fastBossStreak: 0,
      currentFastStreak: 0,
      abilitiesUsed: 0,
      abilitySlots: [null, null, null], // earned during run
      abilitiesEarned: [],
      skinBoosts: boosts,
      skinTrail: skinTrail || null,
      trailTimer: 0,
      paused: false,
      gameOver: false,
      phase2Entered: false,
      phase2HitThisPhase: false,
      noHitPhase2: false,
      phaseChangeWarning: 0,
      betweenBosses: false,
      betweenBossTimer: 0,
      voidPulseEffect: null,
      coreBreach: null,
      waveAnnounce: 0,
      bossAnnounce: 0,
      totalTimeMs: 0,
      bossAnnounceName: '',
      comboTimer: 0,
    };

    this._spawnNextBoss();
    this.lastTime = performance.now();
    this.animId = requestAnimationFrame(this._boundLoop);
  }

  _spawnNextBoss() {
    const gs = this.gs;
    if (gs.bossIndex >= BR_BOSS_SEQUENCE_LEN) {
      // All bosses defeated!
      gs.gameOver = true;
      gs.allBossesCleared = true;
      this._onBossRushGameOver();
      return;
    }
    const typeIdx = gs.bossOrder[gs.bossIndex];
    gs.boss = createCosmicBoss(typeIdx);
    gs.bossStartTime = Date.now();
    gs.phase2Entered = false;
    gs.phase2HitThisPhase = false;
    gs.bossAnnounce = 2500;
    gs.bossAnnounceName = gs.boss._bossName();
    gs.betweenBosses = false;
    gs.betweenBossTimer = 0;
  }

  // Override _loop to use boss rush update/render
  _loop(now) {
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;
    if (!this.gs) return;
    if (!this.gs.paused && !this.gs.gameOver) {
      this._brUpdate(dt);
    }
    this._brRender(now);
    this.animId = requestAnimationFrame(this._boundLoop);
  }

  _brUpdate(dt) {
    const gs = this.gs;
    gs.totalTimeMs += dt;

    // Between-boss pause
    if (gs.betweenBosses) {
      gs.betweenBossTimer -= dt;
      if (gs.betweenBossTimer <= 0) {
        gs.bossIndex++;
        this._spawnNextBoss();
      }
      // Still update particles/explosions
      gs.particles.update(dt);
      gs.explosions.forEach(e => e.update(dt));
      gs.explosions = gs.explosions.filter(e => !e.dead);
      return;
    }

    // Wave announce countdown
    if (gs.bossAnnounce > 0) { gs.bossAnnounce -= dt; }

    // Update player
    const p = gs.player;
    const spd = (p.speedBoost ? 5.5 : 3.5) * dt/16.667;
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) p.x -= spd;
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) p.x += spd;
    if (p.joystickVX) p.x += p.joystickVX * spd;
    p.x = Math.max(18, Math.min(462, p.x));

    // Update timers
    if (p.shieldTimer > 0) { p.shieldTimer -= dt; if (p.shieldTimer <= 0) p.shielded = false; }
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (p.speedBoostTimer > 0) { p.speedBoostTimer -= dt; if (p.speedBoostTimer <= 0) p.speedBoost = false; }
    if (p.tripleShotTimer > 0) { p.tripleShotTimer -= dt; if (p.tripleShotTimer <= 0) p.tripleShot = false; }
    if (p.rapidFireTimer > 0) { p.rapidFireTimer -= dt; if (p.rapidFireTimer <= 0) p.rapidFire = false; }
    if (p.spreadShotTimer > 0) { p.spreadShotTimer -= dt; if (p.spreadShotTimer <= 0) p.spreadShot = false; }

    // Auto-fire
    p.shootTimer = (p.shootTimer || 0) + dt;
    const fireInterval = p.rapidFire ? 80 : 220;
    if (p.shootTimer >= fireInterval) {
      p.shootTimer = 0;
      this._brShoot();
    }

    // Update trail
    gs.trailTimer += dt;
    if (gs.skinTrail && gs.trailTimer >= 60) {
      gs.trailTimer = 0;
      const t = gs.skinTrail;
      for (let i = 0; i < t.count; i++) {
        const col = t.colors[Math.floor(Math.random() * t.colors.length)];
        gs.particles.emit(p.x + (Math.random()-0.5)*t.spread, p.y + 12, 1, col,
          { speed: t.speed * (0.5 + Math.random()), decay: t.decay, size: t.size });
      }
    }

    // Update boss
    if (gs.boss && gs.boss.arrived) {
      // Detect phase 2 entry
      if (!gs.phase2Entered && gs.boss.isPhase2) {
        gs.phase2Entered = true;
        gs.phase2HitThisPhase = false;
        gs.phaseChangeWarning = 2000;
      }
      if (gs.phaseChangeWarning > 0) gs.phaseChangeWarning -= dt;
      gs.boss.update(dt, gs.bullets);
    } else if (gs.boss) {
      gs.boss.update(dt, gs.bullets);
    }

    // Update bullets
    for (const b of gs.bullets) b.update(dt);
    gs.bullets = gs.bullets.filter(b => !b.dead && b.y > -30 && b.y < 730 && b.x > -30 && b.x < 510);

    // Player shoots boss
    if (gs.boss) {
      for (const b of gs.bullets) {
        if (b.type !== 'player') continue;
        if (b.dead) continue;
        if (Math.abs(b.x - gs.boss.x) < 44 && Math.abs(b.y - gs.boss.y) < 44) {
          b.dead = true;
          gs.boss.takeDamage(b.damage);
          gs.particles.emit(b.x, b.y, 4, '#ff8844', { speed: 3, decay: 0.06 });
          if (gs.boss.hp <= 0 && !gs.boss.dead) gs.boss.dead = true;
        }
      }
    }

    // Void pulse effect
    if (gs.voidPulseEffect) {
      gs.voidPulseEffect.timer -= dt;
      gs.voidPulseEffect.radius += dt * 0.35;
      if (gs.voidPulseEffect.timer <= 0) gs.voidPulseEffect = null;
    }

    // Core breach effect update
    if (gs.coreBreach) {
      gs.coreBreach.timer -= dt;
      if (gs.coreBreach.timer <= 0) gs.coreBreach = null;
    }

    // Enemy bullets hit player
    if (p.invulnTimer <= 0 && !p.shielded) {
      for (const b of gs.bullets) {
        if (b.type !== 'enemy') continue;
        if (b.dead) continue;
        if (Math.abs(b.x - p.x) < 14 && Math.abs(b.y - p.y) < 14) {
          b.dead = true;
          p.hp -= b.damage;
          if (gs.phase2Entered && !gs.phase2HitThisPhase) {
            gs.phase2HitThisPhase = true;
          }
          gs.particles.emit(p.x, p.y, 8, '#ff2244', { speed: 4, decay: 0.04 });
          if (p.hp <= 0) {
            p.hp = 0;
            gs.gameOver = true;
            this._onBossRushGameOver();
            return;
          }
        }
      }
    }

    // Boss killed
    if (gs.boss && gs.boss.dead) {
      this._onBossKilled();
    }

    // Power-up collection
    for (const pu of gs.powerUps) {
      if (pu.dead) continue;
      pu.update(dt);
      if (Math.abs(pu.x - p.x) < 28 && Math.abs(pu.y - p.y) < 28) {
        pu.dead = true;
        gs.particles.emit(pu.x, pu.y, 10, '#00ffff', { speed: 3, decay: 0.05 });
      }
    }
    gs.powerUps = gs.powerUps.filter(pu => !pu.dead);

    gs.particles.update(dt);
    gs.explosions.forEach(e => e.update(dt));
    gs.explosions = gs.explosions.filter(e => !e.dead);
  }

  _brShoot() {
    const gs = this.gs;
    const p = gs.player;
    const bullets = gs.bullets;
    const color = p.skinColor || '#00ffff';
    const dmg = 12;
    if (p.tripleShot) {
      bullets.push(new Bullet(p.x-14, p.y-18, -0.6, -8, dmg, 'player', color));
      bullets.push(new Bullet(p.x, p.y-24, 0, -9, dmg, 'player', color));
      bullets.push(new Bullet(p.x+14, p.y-18, 0.6, -8, dmg, 'player', color));
    } else if (p.spreadShot) {
      for (let i = -2; i <= 2; i++) {
        bullets.push(new Bullet(p.x + i*8, p.y-20, i*0.8, -8, dmg, 'player', color));
      }
    } else {
      bullets.push(new Bullet(p.x, p.y-24, 0, -9, dmg, 'player', color));
    }
    Sounds.shoot && Sounds.shoot();
  }

  _onBossKilled() {
    const gs = this.gs;
    const boss = gs.boss;
    gs.bossesDefeated++;
    const bossId = COSMIC_BOSS_IDS[gs.bossOrder[gs.bossIndex]];
    gs.bossKillCounts[bossId] = (gs.bossKillCounts[bossId] || 0) + 1;

    // Time bonus
    const elapsed = Date.now() - gs.bossStartTime;
    const timeBonus = Math.max(0, Math.floor(BR_BOSS_TIME_BONUS_MAX - elapsed));
    gs.score += BR_BOSS_BASE_SCORE + timeBonus;

    // Track fast kill streak (under 2 min = 120000 ms)
    if (elapsed < 120000) {
      gs.currentFastStreak = (gs.currentFastStreak || 0) + 1;
      gs.fastBossStreak = Math.max(gs.fastBossStreak || 0, gs.currentFastStreak);
    } else {
      gs.currentFastStreak = 0;
    }

    // Check if phase 2 was entered and we took no hits
    if (gs.phase2Entered && !gs.phase2HitThisPhase) {
      gs.noHitPhase2 = true;
    }

    gs.explosions.push(new Explosion(boss.x, boss.y, 3));
    gs.particles.emit(boss.x, boss.y, 80, '#ff00aa', { speed: 8, decay: 0.015 });
    Sounds.explosion && Sounds.explosion(true);
    Sounds.levelup && Sounds.levelup();
    gs.boss = null;

    // Grant boss rush ability (first 3 bosses each give one unique ability)
    const abilityIdx = gs.bossesDefeated - 1;
    if (abilityIdx < BR_ABILITY_IDS.length) {
      const abilityId = BR_ABILITY_IDS[abilityIdx];
      // Find first empty slot
      for (let s = 0; s < 3; s++) {
        if (!gs.abilitySlots[s]) {
          gs.abilitySlots[s] = { id: abilityId, level: 1 };
          gs.abilitiesEarned.push(abilityId);
          break;
        }
      }
    }

    // Start 5-second pause before next boss
    gs.betweenBosses = true;
    gs.betweenBossTimer = BR_PAUSE_BETWEEN_BOSSES;
  }

  _useAbility(slot) {
    const gs = this.gs;
    if (!gs || gs.gameOver || gs.paused) return;
    const ability = gs.abilitySlots[slot];
    if (!ability) return;
    const def = ABILITIES[ability.id];
    if (!def) return;
    // Boss rush abilities only work against boss
    if (def.boss_rush_only && !gs.boss) return;
    def.apply(gs, ability.level || 1);
    gs.abilitySlots[slot] = null;
    gs.abilitiesUsed++;
    Sounds.abilityUse && Sounds.abilityUse();
  }

  _brRender(now) {
    const ctx = this.ctx;
    const gs = this.gs;
    ctx.clearRect(0, 0, 480, 700);

    // Stars
    this._renderStars(ctx, 16.667);

    if (!gs) return;

    // Between-boss overlay
    if (gs.betweenBosses) {
      this._renderBetweenBoss(ctx, gs);
      this._renderPlayer(ctx, gs);
      gs.particles.draw(ctx);
      gs.explosions.forEach(e => e.draw(ctx));
      return;
    }

    // Boss
    if (gs.boss) gs.boss.draw(ctx);

    // Power-ups
    for (const pu of gs.powerUps) pu.draw(ctx);

    // Bullets
    for (const b of gs.bullets) b.draw(ctx);

    // Void pulse effect
    if (gs.voidPulseEffect) {
      const vp = gs.voidPulseEffect;
      ctx.save();
      ctx.globalAlpha = Math.max(0, vp.timer / 600) * 0.6;
      ctx.strokeStyle = '#9900ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(vp.x, vp.y, vp.radius, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    // Phase 2 change warning
    if (gs.phaseChangeWarning > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, gs.phaseChangeWarning / 600);
      ctx.fillStyle = '#ff0000';
      ctx.font = '12px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ PHASE 2 ⚠', 240, 180);
      ctx.restore();
    }

    // Player
    this._renderPlayer(ctx, gs);

    // Particles + explosions
    gs.particles.draw(ctx);
    gs.explosions.forEach(e => e.draw(ctx));

    // Boss announce
    if (gs.bossAnnounce > 0) {
      ctx.save();
      const alpha = Math.min(1, gs.bossAnnounce / 1000);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ff4400';
      ctx.font = '11px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ BOSS INCOMING ⚠', 240, 300);
      ctx.font = '9px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(gs.bossAnnounceName, 240, 325);
      ctx.restore();
    }

    // HUD
    this._renderBossRushHUD(ctx, gs);

    // Game over
    if (gs.gameOver) {
      this._renderBossRushGameOver(ctx, gs);
    }
  }

  _renderBetweenBoss(ctx, gs) {
    const secs = Math.ceil(gs.betweenBossTimer / 1000);
    const nextIdx = gs.bossIndex + 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 480, 700);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#00ff88';
    ctx.font = '10px "Press Start 2P"';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS DEFEATED!', 240, 260);
    ctx.fillStyle = '#ffff00';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText(`BOSSES: ${gs.bossesDefeated} / ${BR_BOSS_SEQUENCE_LEN}`, 240, 290);
    ctx.fillStyle = '#00ffff';
    ctx.font = '8px "Press Start 2P"';
    if (nextIdx < BR_BOSS_SEQUENCE_LEN) {
      ctx.fillText(`NEXT BOSS IN ${secs}s`, 240, 320);
      const nextName = (new (COSMIC_BOSSES[gs.bossOrder[nextIdx]])())._bossName();
      ctx.fillStyle = '#ff8800';
      ctx.fillText(nextName, 240, 345);
    } else {
      ctx.fillText(`FINAL BOSS INCOMING IN ${secs}s`, 240, 320);
    }
    if (gs.abilitiesEarned.length > 0) {
      const lastAbility = gs.abilitiesEarned[gs.abilitiesEarned.length - 1];
      const def = ABILITIES[lastAbility];
      if (def) {
        ctx.fillStyle = '#ff88ff';
        ctx.font = '7px "Press Start 2P"';
        ctx.fillText(`✦ ABILITY EARNED: ${def.name}`, 240, 375);
      }
    }
    ctx.restore();
  }

  _renderPlayer(ctx, gs) {
    const p = gs.player;
    if (p.shielded) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(Date.now()*0.008)*0.15;
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
    // Draw player ship
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.skinColor) {
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 14);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, p.skinColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#00ccff';
    }
    ctx.beginPath();
    ctx.moveTo(0, -16); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  _renderStars(ctx, dt) {
    for (const star of this.stars) {
      star.y += star.speed * (dt/16.667);
      if (star.y > 700) { star.y = 0; star.x = Math.random()*480; }
      ctx.globalAlpha = star.alpha;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  _renderBossRushHUD(ctx, gs) {
    ctx.save();
    ctx.font = '7px "Press Start 2P"';

    // Score
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE: ${formatNumber(gs.score)}`, 8, 18);

    // HP bar
    const hpPct = Math.max(0, gs.player.hp / gs.player.maxHp);
    ctx.fillStyle = '#333';
    ctx.fillRect(8, 24, 100, 8);
    ctx.fillStyle = hpPct > 0.5 ? '#00ff88' : hpPct > 0.25 ? '#ffaa00' : '#ff2244';
    ctx.fillRect(8, 24, 100*hpPct, 8);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(8, 24, 100, 8);
    ctx.fillStyle = '#aaa';
    ctx.fillText(`HP`, 114, 31);

    // Boss counter
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff8800';
    ctx.fillText(`BOSS ${gs.bossesDefeated + (gs.boss ? 1 : 0)} / ${BR_BOSS_SEQUENCE_LEN}`, 472, 18);

    // Ability slots
    const slotNames = ['Q', 'W', 'E'];
    const slotColors = { void_pulse: '#9900ff', phase_lock: '#00ffff', core_breach: '#ff4400' };
    for (let s = 0; s < 3; s++) {
      const ab = gs.abilitySlots[s];
      const sx = 8 + s * 44;
      const sy = 670;
      ctx.fillStyle = ab ? (slotColors[ab.id] || '#666') : '#222';
      ctx.fillRect(sx, sy, 36, 22);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx, sy, 36, 22);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '6px "Press Start 2P"';
      ctx.fillText(slotNames[s], sx+18, sy+9);
      if (ab) {
        const def = ABILITIES[ab.id];
        ctx.fillText(def ? def.name.slice(0,4) : '??', sx+18, sy+19);
      }
    }
    ctx.textAlign = 'left';
    ctx.restore();
  }

  _renderBossRushGameOver(ctx, gs) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, 480, 700);
    ctx.textAlign = 'center';

    if (gs.allBossesCleared) {
      ctx.fillStyle = '#ffff00';
      ctx.font = '14px "Press Start 2P"';
      ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 16;
      ctx.fillText('ALL CLEAR!', 240, 230);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#ff2244';
      ctx.font = '14px "Press Start 2P"';
      ctx.shadowColor = '#ff2244'; ctx.shadowBlur = 12;
      ctx.fillText('GAME OVER', 240, 230);
      ctx.shadowBlur = 0;
    }

    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`BOSSES DEFEATED: ${gs.bossesDefeated}`, 240, 268);
    ctx.fillStyle = '#ffff00';
    ctx.fillText(`SCORE: ${formatNumber(gs.score)}`, 240, 290);

    const totalSec = Math.floor(gs.totalTimeMs / 1000);
    const mm = Math.floor(totalSec / 60).toString().padStart(2,'0');
    const ss = (totalSec % 60).toString().padStart(2,'0');
    ctx.fillStyle = '#00ffff';
    ctx.fillText(`TIME: ${mm}:${ss}`, 240, 312);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '7px "Press Start 2P"';
    ctx.fillText('TAP/PRESS TO RETURN', 240, 348);
    ctx.restore();
  }

  async _onBossRushGameOver() {
    const gs = this.gs;

    // Determine no-abilities-used run
    const noAbilitiesUsed = gs.abilitiesUsed === 0;

    const token = getToken();
    if (token) {
      try {
        await apiFetch('/game/save-boss-rush-score', {
          method: 'POST',
          body: JSON.stringify({
            bossesDefeated: gs.bossesDefeated,
            totalTimeMs: Math.floor(gs.totalTimeMs),
            score: gs.score,
            bossKillCounts: gs.bossKillCounts,
            noAbilitiesUsed,
            noHitPhase2: gs.noHitPhase2 || false,
            fastBossStreak: gs.fastBossStreak || 0
          })
        });
      } catch (e) {
        console.warn('Failed to save boss rush score', e);
      }
    }

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

// Helper: shuffle array in place
function _shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Global instance
let bossRushInstance = null;

function startBossRush(skinBoosts, skinColor, skinTrail) {
  if (!bossRushInstance) bossRushInstance = new BossRushGame();
  bossRushInstance.startBossRush(skinBoosts || null, skinColor || null, skinTrail || null);
}

function stopBossRush() {
  if (bossRushInstance) bossRushInstance.stop();
}
