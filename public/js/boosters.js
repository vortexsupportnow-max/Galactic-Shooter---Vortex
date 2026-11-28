// ===== POWER-UPS (boosters) =====
// Dropped by enemies more often than extra abilities. They act the moment they
// are picked up: either an instant effect or a short timed buff.
// (Extra abilities — owned but not equipped — are rarer and go to the bonus
// slot F instead; the after-boss "Upgrade" choice lives in perks.js.)

const BOOSTER_DURATION = 8000;

const BOOSTERS = {
  weapon:   { name: 'ARMA POTENZIATA', icon: '🔺', color: '#ffb366', weight: 14,
              apply(gs) { const p = gs.player; p.tripleShot = true; p.tripleShotTimer = Math.max(p.tripleShotTimer, BOOSTER_DURATION); } },
  homing:   { name: 'COLPI A RICERCA', icon: '🎯', color: '#66ffcc', weight: 12,
              apply(gs) { const p = gs.player; p.homingShot = true; p.homingShotTimer = Math.max(p.homingShotTimer, BOOSTER_DURATION); } },
  pierce:   { name: 'COLPI PERFORANTI', icon: '➶', color: '#aaccff', weight: 12,
              apply(gs) { const p = gs.player; p.piercing = true; p.piercingTimer = Math.max(p.piercingTimer, BOOSTER_DURATION); } },
  shield:   { name: 'SCUDO', icon: '🛡️', color: '#00e5ff', weight: 10,
              apply(gs) { const p = gs.player; p.shielded = true; p.shieldTimer = Math.max(p.shieldTimer, 4000); } },
  repair:   { name: 'RIPARAZIONE +25', icon: '➕', color: '#33ff88', weight: 12,
              apply(gs) { const p = gs.player; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  score2x:  { name: 'PUNTI ×2', icon: '✖️', color: '#ffdd33', weight: 10,
              apply(gs) { gs.scoreBoostTimer = Math.max(gs.scoreBoostTimer, BOOSTER_DURATION); } },
  magnet:   { name: 'CALAMITA', icon: '🧲', color: '#ff66aa', weight: 12,
              apply(gs) { gs.magnetTimer = Math.max(gs.magnetTimer, BOOSTER_DURATION); } },
  recharge: { name: 'ABILITÀ PRONTE', icon: '🔄', color: '#bb88ff', weight: 6,
              apply(gs) { for (const s of gs.abilitySlots) if (s) { s.cooldown = 0; s.readyFlash = 400; } } },
  overdrive:{ name: 'OVERDRIVE +30%', icon: '⚡', color: '#ffcc33', weight: 8,
              apply(gs) { if (gs.odTimer <= 0) gs.od = Math.min(100, gs.od + 30); } }
};

function rollBooster() {
  const ids = Object.keys(BOOSTERS);
  const total = ids.reduce((s, id) => s + BOOSTERS[id].weight, 0);
  let r = Math.random() * total;
  for (const id of ids) { r -= BOOSTERS[id].weight; if (r <= 0) return id; }
  return ids[0];
}

class Booster {
  constructor(x, y, id) {
    this.x = x; this.y = y;
    this.id = id;
    this.def = BOOSTERS[id];
    this.vy = 1.0;
    this.age = 0;
    this.dead = false;
  }

  update(dt) {
    this.y += this.vy * (dt / 16.667);
    this.age += dt;
    if (this.y > 730) this.dead = true;
  }

  collides(player) {
    const dx = this.x - player.x, dy = this.y - player.y;
    return dx * dx + dy * dy < 28 * 28;
  }

  draw(ctx) {
    const bob = Math.sin(this.age * 0.004) * 2.5;
    const x = this.x, y = this.y + bob;
    const col = this.def.color;
    FX.glow(ctx, x, y, 20, col, 0.6 + Math.sin(this.age * 0.008) * 0.15);
    ctx.save();
    ctx.fillStyle = 'rgba(6,10,28,0.9)';
    ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 3]);
    ctx.lineDashOffset = -this.age * 0.02;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.def.icon, x, y + 1);
    ctx.restore();
  }
}
