// ===== HUD =====
const HUD_SLOT_KEYS = ['Q', 'E', 'R'];

class HUD {
  constructor() {
    this.comboFlash = 0;
    this.shownScore = 0; // rolls toward the real score for a counter effect
  }

  _miniShip(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x + 4, y + 6);
    ctx.lineTo(x, y + 8);
    ctx.closePath();
    ctx.fill();
  }

  _panel(ctx, x, y, w, h, border = 'rgba(0,255,255,0.35)') {
    ctx.fillStyle = 'rgba(2,6,20,0.55)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  draw(ctx, gs) {
    const W = 480;
    const now = performance.now();
    const p = gs.player;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // ===== HP (top-left) =====
    const hpBarW = 130, hpBarH = 10;
    const hpX = 10, hpY = 10;
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    const lowHp = hpRatio <= 0.3;
    const framePulse = lowHp ? 0.5 + Math.sin(now * 0.012) * 0.5 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(hpX - 2, hpY - 2, hpBarW + 4, hpBarH + 4);
    ctx.strokeStyle = lowHp ? `rgba(255,40,68,${framePulse})` : 'rgba(0,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpX - 2.5, hpY - 2.5, hpBarW + 5, hpBarH + 5);
    ctx.fillStyle = '#1a0508';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
    const hpGrad = ctx.createLinearGradient(hpX, 0, hpX + hpBarW, 0);
    hpGrad.addColorStop(0, '#ff2244');
    hpGrad.addColorStop(0.5, '#ff8800');
    hpGrad.addColorStop(1, '#00ff66');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hpX, hpY, hpBarW * hpRatio, hpBarH);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(hpX, hpY, hpBarW * hpRatio, 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '5px "Press Start 2P"';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.ceil(Math.max(0, p.hp))}`, hpX + 3, hpY + hpBarH / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    for (let i = 0; i < p.lives; i++) this._miniShip(ctx, hpX + i * 12, hpY + hpBarH + 5, '#00ffff');
    if (p.phoenixReady) {
      FX.glow(ctx, hpX + p.lives * 12 + 5, hpY + hpBarH + 9, 7, '#ff8800', 0.9);
    }

    // Weapon level: 6 pips + core progress to the next level
    const wy = hpY + hpBarH + 20;
    ctx.font = '5px "Press Start 2P"';
    ctx.fillStyle = '#ffb366';
    ctx.fillText('ARMA', hpX, wy + 5);
    const lvl = p.effectiveWeaponLevel;
    for (let i = 0; i < WEAPON_MAX_LEVEL; i++) {
      const px = hpX + 26 + i * 9;
      const on = i < lvl;
      const boosted = i >= p.weaponLevel && on;
      ctx.fillStyle = on ? (boosted ? '#ffee66' : '#ff9a3a') : 'rgba(255,154,58,0.15)';
      ctx.fillRect(px, wy, 7, 6);
    }
    if (p.weaponLevel < WEAPON_MAX_LEVEL) {
      const need = p.coresForNext;
      ctx.fillStyle = 'rgba(255,154,58,0.18)';
      ctx.fillRect(hpX + 26, wy + 8, 6 * 9 - 2, 2);
      ctx.fillStyle = '#ffd08a';
      ctx.fillRect(hpX + 26, wy + 8, (6 * 9 - 2) * (p.cores / need), 2);
    } else {
      ctx.fillStyle = '#ffee66';
      ctx.fillText('MAX', hpX + 26 + 6 * 9 + 2, wy + 5);
    }

    // ===== WAVE + SCORE (top-center) =====
    this.shownScore += (gs.score - this.shownScore) * 0.25;
    if (Math.abs(gs.score - this.shownScore) < 1) this.shownScore = gs.score;
    ctx.textAlign = 'center';
    ctx.font = '6px "Press Start 2P"';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText(`WAVE ${gs.wave}`, W / 2, 13);
    ctx.font = '11px "Press Start 2P"';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = gs.odTimer > 0 ? '#ffcc33' : '#00ffff';
    ctx.shadowBlur = 0;
    ctx.fillText(Math.round(this.shownScore).toLocaleString('it-IT'), W / 2, 29);
    ctx.shadowBlur = 0;

    if (gs.boss) {
      const bossBarW = 260, bossBarH = 9;
      const bx = (W - bossBarW) / 2, by = 38;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 2, by - 2, bossBarW + 4, bossBarH + 4);
      ctx.strokeStyle = 'rgba(255,0,136,0.6)';
      ctx.strokeRect(bx - 2.5, by - 2.5, bossBarW + 5, bossBarH + 5);
      ctx.fillStyle = '#2a0011';
      ctx.fillRect(bx, by, bossBarW, bossBarH);
      const bossRatio = Math.max(0, gs.boss.hp / gs.boss.maxHp);
      const bossGrad = ctx.createLinearGradient(bx, 0, bx + bossBarW, 0);
      bossGrad.addColorStop(0, '#ff0088');
      bossGrad.addColorStop(1, '#ff44ff');
      ctx.fillStyle = bossGrad;
      ctx.fillRect(bx, by, bossBarW * bossRatio, bossBarH);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let t = 0.25; t < 1; t += 0.25) ctx.fillRect(bx + bossBarW * t, by, 1, bossBarH);
      ctx.font = '5px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      const bossName = typeof gs.boss._bossName === 'function' ? gs.boss._bossName() : 'MOTHERSHIP';
      ctx.fillText(bossName, W / 2, by + bossBarH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    } else {
      const total = gs.waveTotal || 1;
      const remaining = gs.enemies.length + (gs.spawnQueue ? gs.spawnQueue.length : 0);
      const prog = Math.max(0, total - remaining) / total;
      const wbW = 130, wbH = 4;
      const wbX = (W - wbW) / 2, wbY = 36;
      ctx.fillStyle = '#0a2230';
      ctx.fillRect(wbX, wbY, wbW, wbH);
      const wg = ctx.createLinearGradient(wbX, 0, wbX + wbW, 0);
      wg.addColorStop(0, '#00ccff');
      wg.addColorStop(1, '#00ffcc');
      ctx.fillStyle = wg;
      ctx.fillRect(wbX, wbY, wbW * prog, wbH);
    }

    // ===== MULTIPLIER / CHAIN (top-right) =====
    const rx = W - 10;
    const flash = this.comboFlash > 0;
    this.comboFlash -= 16;
    let mColor = '#8fa0c8';
    if (gs.mult >= 7) mColor = '#ff3355';
    else if (gs.mult >= 4) mColor = '#ff8800';
    else if (gs.mult >= 2) mColor = '#ffdd00';
    else if (gs.mult > 1) mColor = '#ccff66';
    ctx.textAlign = 'right';
    ctx.font = `${flash ? 13 : 12}px "Press Start 2P"`;
    ctx.fillStyle = flash ? '#ffffff' : mColor;
    ctx.shadowColor = mColor;
    ctx.shadowBlur = 0;
    if (gs.mult > 1) FX.glow(ctx, rx - 30, 18, 26, mColor, 0.35);
    ctx.fillText(`×${gs.mult.toFixed(2)}`, rx, 22);
    ctx.shadowBlur = 0;
    ctx.font = '5px "Press Start 2P"';
    ctx.fillStyle = '#c8d0ee';
    ctx.fillText(`CHAIN ${gs.chain}`, rx, 32);
    if (gs.chain > 0) {
      const cbW = 70, cbX = rx - cbW, cbY = 36;
      const left = Math.max(0, 1 - (gs.chainTimer || 0) / (gs.chainWindow || CHAIN_WINDOW));
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(cbX, cbY, cbW, 3);
      ctx.fillStyle = left < 0.3 && Math.sin(now * 0.03) > 0 ? '#ffffff' : mColor;
      ctx.fillRect(cbX + cbW * (1 - left), cbY, cbW * left, 3);
    }
    // Medal value
    const medalVal = MEDAL_VALUES[Math.min(gs.medalLevel, MEDAL_VALUES.length - 1)];
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(rx - 52, 47, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(formatNumber(medalVal), rx, 50);

    // ===== OVERDRIVE (above the ability slots) =====
    const odW = 196, odH = 6, odX = (W - odW) / 2, odY = 616;
    const odFull = gs.od >= 100 && gs.odTimer <= 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(odX - 2, odY - 2, odW + 4, odH + 4);
    ctx.fillStyle = '#2a2208';
    ctx.fillRect(odX, odY, odW, odH);
    const odRatio = gs.odTimer > 0 ? gs.odTimer / OVERDRIVE_DURATION : gs.od / 100;
    const og = ctx.createLinearGradient(odX, 0, odX + odW, 0);
    og.addColorStop(0, '#ff8800');
    og.addColorStop(1, '#ffee44');
    ctx.fillStyle = og;
    ctx.fillRect(odX, odY, odW * odRatio, odH);
    if (odFull || gs.odTimer > 0) FX.glow(ctx, odX + odW * odRatio, odY + 3, 14, '#ffcc33', 0.7 + Math.sin(now * 0.02) * 0.3);
    ctx.textAlign = 'center';
    ctx.font = '5px "Press Start 2P"';
    ctx.fillStyle = odFull ? (Math.sin(now * 0.015) > 0 ? '#ffffff' : '#ffcc33') : gs.odTimer > 0 ? '#ffee66' : '#9a8a5a';
    ctx.fillText(gs.odTimer > 0 ? 'OVERDRIVE ×2' : odFull ? (typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE ? 'OVERDRIVE PRONTO · TOCCA QUI' : 'OVERDRIVE PRONTO · SPAZIO') : 'OVERDRIVE', W / 2, odY - 4);

    // ===== ABILITY SLOTS (bottom-center) =====
    const slotW = 56, slotH = 56, gap = 8;
    const bonusW = 40;
    const slotY = 700 - slotH - 8;
    const totalSlotW = slotW * 3 + gap * 3 + bonusW;
    let slotX = (W - totalSlotW) / 2;

    for (let i = 0; i < 3; i++) {
      const ability = gs.abilitySlots[i];
      if (ability) {
        const borderColor = RARITY_COLORS[ability.rarity] || '#aaaaaa';
        const ready = !(ability.cooldown > 0);

        if (ready) {
          const pulse = 0.5 + Math.sin(now * 0.006 + i) * 0.5;
          FX.glow(ctx, slotX + slotW / 2, slotY + slotH / 2, 34, borderColor, 0.25 + pulse * 0.2 + (ability.readyFlash > 0 ? 0.6 : 0));
        }
        ctx.fillStyle = 'rgba(2,4,14,0.88)';
        ctx.fillRect(slotX, slotY, slotW, slotH);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = ready ? 1 : 0.5;
        ctx.strokeRect(slotX + 0.5, slotY + 0.5, slotW - 1, slotH - 1);

        const icon = GameAssets.drawAbilityIcon(ability.id, ability.rarity);
        ctx.drawImage(icon, slotX + (slotW - 22) / 2, slotY + 8, 22, 22);
        ctx.globalAlpha = 1;

        // Cooldown: dark sweep + seconds
        if (!ready) {
          const k = ability.cooldown / (ability.cooldownMax || 1);
          ctx.save();
          ctx.beginPath();
          ctx.rect(slotX, slotY, slotW, slotH);
          ctx.clip();
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.beginPath();
          ctx.moveTo(slotX + slotW / 2, slotY + slotH / 2);
          ctx.arc(slotX + slotW / 2, slotY + slotH / 2, slotW, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          ctx.textAlign = 'center';
          ctx.font = '9px "Press Start 2P"';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(Math.ceil(ability.cooldown / 1000), slotX + slotW / 2, slotY + 25);
        }

        ctx.textAlign = 'center';
        ctx.font = '4px "Press Start 2P"';
        ctx.fillStyle = '#ffffff';
        const name = ability.name.length > 10 ? ability.name.slice(0, 10) : ability.name;
        ctx.fillText(name.toUpperCase(), slotX + slotW / 2, slotY + slotH - 14);
        ctx.fillStyle = '#ffff00';
        ctx.fillText(`LV${ability.level || 1}`, slotX + slotW / 2, slotY + slotH - 6);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(slotX, slotY, slotW, slotH);
        ctx.save();
        ctx.strokeStyle = '#2b2b46';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(slotX + 0.5, slotY + 0.5, slotW - 1, slotH - 1);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.font = '5px "Press Start 2P"';
        ctx.fillStyle = '#3a3a5c';
        ctx.fillText('VUOTO', slotX + slotW / 2, slotY + slotH / 2 + 2);
      }

      ctx.fillStyle = ability ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(slotX, slotY, 12, 11);
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = ability ? '#ffffff' : '#6a6a8c';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(HUD_SLOT_KEYS[i], slotX + 3, slotY + 6.5);
      ctx.textBaseline = 'alphabetic';

      slotX += slotW + gap;
    }

    // Bonus slot (F): an extra ability picked up mid-run, single use
    {
      const b = gs.bonusSlot;
      const bx = slotX, by = slotY + slotH - bonusW;
      if (b) {
        const col = RARITY_COLORS[b.rarity] || '#ffd23a';
        FX.glow(ctx, bx + bonusW / 2, by + bonusW / 2, 26 + (b.flash > 0 ? 8 : 0), col, 0.35 + Math.sin(now * 0.008) * 0.15);
        ctx.fillStyle = 'rgba(2,4,14,0.9)';
        ctx.fillRect(bx, by, bonusW, bonusW);
        ctx.strokeStyle = '#ffd23a';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 0.5, by + 0.5, bonusW - 1, bonusW - 1);
        ctx.drawImage(GameAssets.drawAbilityIcon(b.id, b.rarity), bx + 9, by + 7, 22, 22);
        ctx.textAlign = 'center';
        ctx.font = '4px "Press Start 2P"';
        ctx.fillStyle = '#ffd23a';
        ctx.fillText('×1', bx + bonusW / 2, by + bonusW - 4);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(bx, by, bonusW, bonusW);
        ctx.save();
        ctx.strokeStyle = 'rgba(255,210,58,0.35)';
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(bx + 0.5, by + 0.5, bonusW - 1, bonusW - 1);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.font = '4px "Press Start 2P"';
        ctx.fillStyle = 'rgba(255,210,58,0.5)';
        ctx.fillText('BONUS', bx + bonusW / 2, by + bonusW / 2 + 2);
      }
      ctx.fillStyle = b ? 'rgba(255,210,58,0.3)' : 'rgba(255,210,58,0.1)';
      ctx.fillRect(bx, by, 11, 10);
      ctx.font = '5px "Press Start 2P"';
      ctx.fillStyle = b ? '#ffffff' : '#8a7a4a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('F', bx + 3, by + 5.5);
      ctx.textBaseline = 'alphabetic';
    }

    // ===== Active effects (left, under the weapon) =====
    let effectsY = 72;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '5px "Press Start 2P"';
    const effects = [];
    if (p.shielded)       effects.push({ name: 'SCUDO',     color: '#00ffff', t: p.shieldTimer });
    if (p.overcharge)     effects.push({ name: 'OVERCHARGE',color: '#ffff00', t: p.overchargeTimer });
    if (p.tripleShot)     effects.push({ name: 'ARMA+',     color: '#ffee66', t: p.tripleShotTimer });
    if (p.spreadShot)     effects.push({ name: 'SPREAD',    color: '#88ffff', t: p.spreadShotTimer });
    if (p.rapidFire)      effects.push({ name: 'RAPID',     color: '#ff8800', t: p.rapidFireTimer });
    if (p.laserActive)    effects.push({ name: 'LASER',     color: '#ff3366', t: p.laserTimer });
    if (p.homingShot)     effects.push({ name: 'RICERCA',   color: '#66ffcc', t: p.homingShotTimer });
    if (p.piercing && !p.overdrive) effects.push({ name: 'PERFORANTI', color: '#aaccff', t: p.piercingTimer });
    if (gs.scoreBoostTimer > 0) effects.push({ name: 'PUNTI ×2', color: '#ffdd33', t: gs.scoreBoostTimer });
    if (gs.magnetTimer > 0)     effects.push({ name: 'CALAMITA', color: '#ff66aa', t: gs.magnetTimer });
    if (p.magneticField)  effects.push({ name: 'REFLECT',   color: '#44ffff', t: p.magneticFieldTimer });
    if (p.gravityWell)    effects.push({ name: `GRAVITY ${p.gravityCharge}`, color: '#cc88ff', t: p.gravityWellTimer });
    if (gs.timeSlow)      effects.push({ name: 'SLOW',      color: '#aa44ff', t: gs.timeSlowTimer });
    if (gs.freezeActive)  effects.push({ name: 'FREEZE',    color: '#44aaff', t: gs.freezeTimer });

    for (const eff of effects.slice(0, 5)) {
      const label = `${eff.name} ${(Math.max(0, eff.t) / 1000).toFixed(1)}s`;
      const chipW = 14 + label.length * 5;
      const ending = eff.t < 1000 && Math.sin(now * 0.02) < 0;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(8, effectsY - 5, chipW, 10);
      ctx.fillStyle = ending ? 'rgba(255,255,255,0.9)' : eff.color;
      ctx.beginPath();
      ctx.arc(14, effectsY, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dfe6ff';
      ctx.fillText(label, 20, effectsY + 0.5);
      effectsY += 12;
    }
    ctx.textBaseline = 'alphabetic';

    // Perks taken this run (small icons under the medal value)
    const perkIds = Object.keys(gs.perks || {});
    if (perkIds.length) {
      ctx.textAlign = 'right';
      ctx.font = '9px sans-serif';
      let px = W - 10;
      for (const id of perkIds) {
        const def = PERKS[id];
        if (!def) continue;
        ctx.fillText(def.icon, px, 66);
        if (gs.perks[id] > 1) {
          ctx.font = '4px "Press Start 2P"';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(String(gs.perks[id]), px + 2, 70);
          ctx.font = '9px sans-serif';
        }
        px -= 14;
      }
    }
    ctx.restore();
  }

  triggerComboFlash() { this.comboFlash = 300; }
}
