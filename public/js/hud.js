// ===== HUD =====
class HUD {
  constructor() {
    this.comboFlash = 0;
  }

  draw(ctx, gs) {
    const W = 480;
    ctx.save();

    // ===== HP BAR (top-left) =====
    const hpBarW = 140, hpBarH = 14;
    const hpX = 10, hpY = 10;
    const hpRatio = Math.max(0, gs.player.hp / gs.player.maxHp);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(hpX - 1, hpY - 1, hpBarW + 2, hpBarH + 2);

    ctx.fillStyle = '#220000';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);

    // HP gradient
    const hpGrad = ctx.createLinearGradient(hpX, 0, hpX + hpBarW * hpRatio, 0);
    hpGrad.addColorStop(0, '#ff2244');
    hpGrad.addColorStop(0.5, '#ff8800');
    hpGrad.addColorStop(1, '#00ff44');
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hpX, hpY, hpBarW * hpRatio, hpBarH);

    ctx.fillStyle = '#ffffff';
    ctx.font = '6px "Press Start 2P"';
    ctx.textBaseline = 'middle';
    ctx.fillText(`HP ${Math.ceil(gs.player.hp)}/${gs.player.maxHp}`, hpX + 2, hpY + hpBarH / 2);

    // Lives
    for (let i = 0; i < gs.player.lives; i++) {
      ctx.fillStyle = '#ff2244';
      ctx.fillRect(hpX + i * 12, hpY + hpBarH + 4, 8, 8);
    }

    // ===== WAVE (top-center) =====
    ctx.textAlign = 'center';
    ctx.font = '10px "Press Start 2P"';
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.fillText(`WAVE ${gs.wave}`, W / 2, 18);
    ctx.shadowBlur = 0;

    // Score
    ctx.font = '8px "Press Start 2P"';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(formatNumber(gs.score), W / 2, 34);

    // Boss HP bar (replaces wave progress during boss)
    if (gs.boss) {
      const bossBarW = 280, bossBarH = 12;
      const bx = (W - bossBarW) / 2, by = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 1, by - 1, bossBarW + 2, bossBarH + 2);
      ctx.fillStyle = '#330011';
      ctx.fillRect(bx, by, bossBarW, bossBarH);
      const bossRatio = Math.max(0, gs.boss.hp / gs.boss.maxHp);
      const bossGrad = ctx.createLinearGradient(bx, 0, bx + bossBarW, 0);
      bossGrad.addColorStop(0, '#ff0088');
      bossGrad.addColorStop(1, '#ff00ff');
      ctx.fillStyle = bossGrad;
      ctx.fillRect(bx, by, bossBarW * bossRatio, bossBarH);
      ctx.font = '6px "Press Start 2P"';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('BOSS', bx + bossBarW / 2, by + bossBarH / 2 + 1);
    } else {
      // Wave progress bar
      const total = gs.waveTotal || 1;
      const remaining = gs.enemies.length;
      const done = Math.max(0, total - remaining);
      const prog = done / total;
      const wbW = 140, wbH = 6;
      const wbX = (W - wbW) / 2, wbY = 44;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(wbX, wbY, wbW, wbH);
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(wbX, wbY, wbW * prog, wbH);
      ctx.font = '5px "Press Start 2P"';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText(`${remaining} LEFT`, W / 2, wbY + wbH + 7);
    }

    // ===== COMBO (top-right) =====
    if (gs.combo > 1) {
      const comboFlash = this.comboFlash > 0;
      this.comboFlash -= 16;
      ctx.textAlign = 'right';
      ctx.font = '9px "Press Start 2P"';
      ctx.fillStyle = comboFlash ? '#ffffff' : '#ffff00';
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = comboFlash ? 16 : 6;
      ctx.fillText(`×${gs.combo} COMBO`, W - 10, 18);
      ctx.shadowBlur = 0;
    }

    // ===== ABILITY SLOTS (bottom-center) =====
    const slotW = 70, slotH = 70;
    const slotY = 700 - slotH - 8;
    const totalSlotW = slotW * 3 + 8 * 2;
    let slotX = (W - totalSlotW) / 2;
    const labels = ['Q', 'W', 'E'];

    for (let i = 0; i < 3; i++) {
      const ability = gs.abilitySlots[i];
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(slotX, slotY, slotW, slotH);

      if (ability) {
        const borderColor = RARITY_COLORS[ability.rarity] || '#aaaaaa';
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(slotX, slotY, slotW, slotH);

        // Icon
        const icon = GameAssets.drawAbilityIcon(ability.id, ability.rarity);
        ctx.drawImage(icon, slotX + (slotW - 24) / 2, slotY + 8, 24, 24);

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
        ctx.strokeStyle = '#333355';
        ctx.lineWidth = 1;
        ctx.strokeRect(slotX, slotY, slotW, slotH);
        ctx.textAlign = 'center';
        ctx.font = '5px "Press Start 2P"';
        ctx.fillStyle = '#444466';
        ctx.fillText('EMPTY', slotX + slotW / 2, slotY + slotH / 2);
      }

      // Key label
      ctx.font = '7px "Press Start 2P"';
      ctx.fillStyle = '#888888';
      ctx.textAlign = 'left';
      ctx.fillText(labels[i], slotX + 3, slotY + 10);

      slotX += slotW + 8;
    }

    // Active ability effects indicator
    let effectsY = 55;
    ctx.textAlign = 'left';
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
      ctx.fillStyle = eff.color;
      ctx.fillText(`${eff.name} ${(eff.t / 1000).toFixed(1)}s`, 10, effectsY);
      effectsY += 12;
    }

    ctx.restore();
  }

  triggerComboFlash() { this.comboFlash = 300; }
}
