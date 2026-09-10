// ===== HUD =====
class HUD {
  constructor() {
    this.comboFlash = 0;
  }

  // Small cyan ship glyph used for the lives counter
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

  draw(ctx, gs) {
    const W = 480;
    const now = performance.now();
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // ===== HP BAR (top-left) =====
    const hpBarW = 140, hpBarH = 14;
    const hpX = 10, hpY = 10;
    const hpRatio = Math.max(0, gs.player.hp / gs.player.maxHp);
    const lowHp = hpRatio <= 0.3;

    // Outer frame — pulses red when HP is low
    const framePulse = lowHp ? 0.5 + Math.sin(now * 0.012) * 0.5 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(hpX - 2, hpY - 2, hpBarW + 4, hpBarH + 4);
    ctx.strokeStyle = lowHp ? `rgba(255,40,68,${framePulse})` : 'rgba(0,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpX - 2.5, hpY - 2.5, hpBarW + 5, hpBarH + 5);

    // Empty track
    ctx.fillStyle = '#1a0508';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);

    // Fill
    const hpGrad = ctx.createLinearGradient(hpX, 0, hpX + hpBarW, 0);
    hpGrad.addColorStop(0, '#ff2244');
    hpGrad.addColorStop(0.5, '#ff8800');
    hpGrad.addColorStop(1, '#00ff44');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hpX, hpY, hpBarW * hpRatio, hpBarH);
    // Bright top edge on the fill for a bit of gloss
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(hpX, hpY, hpBarW * hpRatio, 2);
    // Segment ticks
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    for (let t = 20; t < hpBarW; t += 20) ctx.fillRect(hpX + t, hpY, 1, hpBarH);

    ctx.fillStyle = '#ffffff';
    ctx.font = '6px "Press Start 2P"';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.ceil(gs.player.hp)}/${gs.player.maxHp}`, hpX + 3, hpY + hpBarH / 2 + 1);
    ctx.textBaseline = 'alphabetic';

    // Lives as little ships
    for (let i = 0; i < gs.player.lives; i++) {
      this._miniShip(ctx, hpX + i * 12, hpY + hpBarH + 5, '#00ffff');
    }

    // ===== WAVE (top-center) =====
    ctx.textAlign = 'center';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.fillText(`WAVE ${gs.wave}`, W / 2, 18);
    ctx.shadowBlur = 0;

    // Score with a small label
    ctx.font = '4px "Press Start 2P"';
    ctx.fillStyle = '#5f6fa8';
    ctx.fillText('SCORE', W / 2, 27);
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(formatNumber(gs.score), W / 2, 36);

    // Boss HP bar (replaces wave progress during boss)
    if (gs.boss) {
      const bossBarW = 280, bossBarH = 12;
      const bx = (W - bossBarW) / 2, by = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 2, by - 2, bossBarW + 4, bossBarH + 4);
      ctx.strokeStyle = 'rgba(255,0,136,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx - 2.5, by - 2.5, bossBarW + 5, bossBarH + 5);
      ctx.fillStyle = '#2a0011';
      ctx.fillRect(bx, by, bossBarW, bossBarH);
      const bossRatio = Math.max(0, gs.boss.hp / gs.boss.maxHp);
      const bossGrad = ctx.createLinearGradient(bx, 0, bx + bossBarW, 0);
      bossGrad.addColorStop(0, '#ff0088');
      bossGrad.addColorStop(1, '#ff44ff');
      ctx.fillStyle = bossGrad;
      ctx.fillRect(bx, by, bossBarW * bossRatio, bossBarH);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(bx, by, bossBarW * bossRatio, 2);
      // Notches
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let t = 0.25; t < 1; t += 0.25) ctx.fillRect(bx + bossBarW * t, by, 1, bossBarH);
      ctx.textAlign = 'center';
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      const bossName = typeof gs.boss._bossName === 'function' ? gs.boss._bossName() : 'BOSS';
      ctx.fillText(bossName, bx + bossBarW / 2, by + bossBarH / 2 + 1);
      ctx.textBaseline = 'alphabetic';
    } else {
      // Wave progress bar
      const total = gs.waveTotal || 1;
      const remaining = gs.enemies.length;
      const done = Math.max(0, total - remaining);
      const prog = done / total;
      const wbW = 150, wbH = 6;
      const wbX = (W - wbW) / 2, wbY = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(wbX - 1, wbY - 1, wbW + 2, wbH + 2);
      ctx.fillStyle = '#0a2230';
      ctx.fillRect(wbX, wbY, wbW, wbH);
      const wg = ctx.createLinearGradient(wbX, 0, wbX + wbW, 0);
      wg.addColorStop(0, '#00ccff');
      wg.addColorStop(1, '#00ffcc');
      ctx.fillStyle = wg;
      ctx.fillRect(wbX, wbY, wbW * prog, wbH);
      ctx.textAlign = 'center';
      ctx.font = '5px "Press Start 2P"';
      ctx.fillStyle = '#8899bb';
      ctx.fillText(`${remaining} LEFT`, W / 2, wbY + wbH + 8);
    }

    // ===== COMBO (top-right) =====
    if (gs.combo > 1) {
      const comboFlash = this.comboFlash > 0;
      this.comboFlash -= 16;

      // Colour ramps up with the combo tier
      let comboColor = '#ffdd00';
      if (gs.combo >= 12) comboColor = '#ff3355';
      else if (gs.combo >= 8) comboColor = '#ff8800';
      else if (gs.combo >= 4) comboColor = '#ffdd00';

      ctx.textAlign = 'right';
      const scale = 1 + Math.min(gs.combo, 16) * 0.03;
      ctx.font = `${Math.round(9 * scale)}px "Press Start 2P"`;
      ctx.fillStyle = comboFlash ? '#ffffff' : comboColor;
      ctx.shadowColor = comboColor;
      ctx.shadowBlur = comboFlash ? 16 : 6;
      ctx.fillText(`×${gs.combo} COMBO`, W - 10, 18);
      ctx.shadowBlur = 0;

      // Depleting timer bar showing the 3s combo window
      const cbW = 90, cbH = 3;
      const cbX = W - 10 - cbW, cbY = 24;
      const left = Math.max(0, 1 - (gs.comboTimer || 0) / 3000);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(cbX, cbY, cbW, cbH);
      ctx.fillStyle = comboColor;
      ctx.fillRect(cbX + cbW * (1 - left), cbY, cbW * left, cbH);
    }

    // ===== ABILITY SLOTS (bottom-center) =====
    const slotW = 70, slotH = 70;
    const slotY = 700 - slotH - 8;
    const totalSlotW = slotW * 3 + 8 * 2;
    let slotX = (W - totalSlotW) / 2;
    const labels = ['Q', 'W', 'E'];

    for (let i = 0; i < 3; i++) {
      const ability = gs.abilitySlots[i];

      if (ability) {
        const borderColor = RARITY_COLORS[ability.rarity] || '#aaaaaa';

        // "Ready" glow behind the slot, gently pulsing to invite a press
        const pulse = 0.5 + Math.sin(now * 0.006 + i) * 0.5;
        ctx.save();
        ctx.globalAlpha = 0.25 + pulse * 0.35;
        ctx.shadowColor = borderColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = borderColor;
        ctx.fillRect(slotX + 2, slotY + 2, slotW - 4, slotH - 4);
        ctx.restore();

        ctx.fillStyle = 'rgba(2,4,14,0.88)';
        ctx.fillRect(slotX, slotY, slotW, slotH);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(slotX + 0.5, slotY + 0.5, slotW - 1, slotH - 1);

        // Icon
        const icon = GameAssets.drawAbilityIcon(ability.id, ability.rarity);
        ctx.drawImage(icon, slotX + (slotW - 24) / 2, slotY + 10, 24, 24);

        // Name
        ctx.textAlign = 'center';
        ctx.font = '5px "Press Start 2P"';
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillStyle = '#ffffff';
        const name = ability.name.length > 8 ? ability.name.slice(0, 8) : ability.name;
        ctx.strokeText(name, slotX + slotW / 2, slotY + slotH - 18);
        ctx.fillText(name, slotX + slotW / 2, slotY + slotH - 18);

        // Level
        ctx.fillStyle = '#ffff00';
        ctx.font = '5px "Press Start 2P"';
        ctx.fillText(`Lv${ability.level || 1}`, slotX + slotW / 2, slotY + slotH - 8);
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(slotX, slotY, slotW, slotH);
        // Dashed empty frame
        ctx.save();
        ctx.strokeStyle = '#2b2b46';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(slotX + 0.5, slotY + 0.5, slotW - 1, slotH - 1);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.font = '5px "Press Start 2P"';
        ctx.fillStyle = '#3a3a5c';
        ctx.fillText('EMPTY', slotX + slotW / 2, slotY + slotH / 2 + 2);
      }

      // Key label in a small corner tab
      ctx.fillStyle = ability ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(slotX, slotY, 14, 12);
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = ability ? '#ffffff' : '#6a6a8c';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], slotX + 3, slotY + 7);
      ctx.textBaseline = 'alphabetic';

      slotX += slotW + 8;
    }

    // Active ability effects — chips with a coloured status dot
    let effectsY = 52;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '5px "Press Start 2P"';
    const effects = [];
    if (gs.player.shielded)      effects.push({ name: 'SHIELD',    color: '#00ffff', t: gs.player.shieldTimer });
    if (gs.player.overcharge)    effects.push({ name: 'OVERCHARGE',color: '#ffff00', t: gs.player.overchargeTimer });
    if (gs.player.tripleShot)    effects.push({ name: 'TRIPLE',    color: '#00ff88', t: gs.player.tripleShotTimer });
    if (gs.player.spreadShot)    effects.push({ name: 'SPREAD',    color: '#88ffff', t: gs.player.spreadShotTimer });
    if (gs.player.rapidFire)     effects.push({ name: 'RAPID',     color: '#ff8800', t: gs.player.rapidFireTimer });
    if (gs.player.laserActive)   effects.push({ name: 'LASER',     color: '#ff0000', t: gs.player.laserTimer });
    if (gs.timeSlow)             effects.push({ name: 'TIMESLOW',  color: '#aa44ff', t: gs.timeSlowTimer });
    if (gs.freezeActive)         effects.push({ name: 'FREEZE',    color: '#44aaff', t: gs.freezeTimer });

    for (const eff of effects.slice(0, 4)) {
      const label = `${eff.name} ${(eff.t / 1000).toFixed(1)}s`;
      const chipW = 14 + label.length * 5;
      // Blink the dot in the last second
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

    ctx.restore();
  }

  triggerComboFlash() { this.comboFlash = 300; }
}
