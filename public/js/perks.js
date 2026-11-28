// ===== RUN PERKS =====
// After every boss the player picks 1 of 3 upgrades that last for the rest of
// the run. Perks stack up to `max`; the offer never contains a maxed perk.
// They change how a run plays rather than just adding numbers, so two runs
// rarely end up built the same way.

const PERKS = {
  hull:         { name: 'SCAFO RINFORZATO', icon: '🛡️', color: '#00ff88', max: 4,
                  desc: '+25 HP massimi e cura completa',
                  apply(gs) { gs.player.maxHp += 25; gs.player.hp = gs.player.maxHp; } },
  damage:       { name: 'CANNONI POTENZIATI', icon: '💥', color: '#ff6644', max: 5,
                  desc: '+12% danni dell\'arma',
                  apply(gs) { gs.player.perkDmg = (gs.player.perkDmg || 1) + 0.12; } },
  firerate:     { name: 'RAFFREDDAMENTO', icon: '⚡', color: '#ffdd33', max: 4,
                  desc: '+8% cadenza di fuoco',
                  apply(gs) { gs.player.perkRate = (gs.player.perkRate || 1) + 0.08; } },
  magnet:       { name: 'MAGNETE', icon: '🧲', color: '#66ccff', max: 3,
                  desc: 'Raggio di raccolta +60%',
                  apply(gs) { gs.magnetRange += 45; } },
  cooldown:     { name: 'CONDENSATORI', icon: '⏱️', color: '#aa88ff', max: 3,
                  desc: 'Ricarica abilità -10%',
                  apply(gs) { gs.cooldownMult *= 0.9; for (const s of gs.abilitySlots) if (s) s.cooldown *= 0.9; } },
  od_gain:      { name: 'REATTORE OD', icon: '🔥', color: '#ffaa22', max: 3,
                  desc: 'Overdrive si carica il 25% più in fretta',
                  apply(gs) { gs.odGainMult += 0.25; } },
  chain_window: { name: 'CATENA LUNGA', icon: '⛓️', color: '#ff9944', max: 3,
                  desc: 'La catena dura 0.5s in più',
                  apply(gs) { gs.chainWindow += 500; } },
  medal_keep:   { name: 'TESORIERE', icon: '🏅', color: '#ffd23a', max: 1,
                  desc: 'Perdere una medaglia costa 1 livello invece di 3',
                  apply(gs) { gs.medalMissPenalty = 1; } },
  extra_life:   { name: 'NAVE DI SCORTA', icon: '🚀', color: '#00ffff', max: 2,
                  desc: '+1 vita',
                  apply(gs) { gs.player.lives++; } },
  graze:        { name: 'PILOTA AUDACE', icon: '✨', color: '#ffffff', max: 2,
                  desc: 'Area di graze +25% e punti graze ×2',
                  apply(gs) { gs.player.grazeRadius *= 1.25; gs.grazeMult *= 2; } },
  core_drop:    { name: 'RECUPERO NUCLEI', icon: '🔶', color: '#ff9a3a', max: 2,
                  desc: 'Nuclei P +50% più frequenti, +1 livello arma subito',
                  apply(gs) {
                    gs.coreChance *= 1.5;
                    if (gs.player.weaponLevel < WEAPON_MAX_LEVEL) { gs.player.weaponLevel++; gs.player.cores = 0; }
                    if (gs.player.weaponLevel >= WEAPON_MAX_LEVEL) gs.reachedWeaponMax = true;
                  } },
  shield_regen: { name: 'SCUDO REATTIVO', icon: '🔰', color: '#44ddff', max: 1,
                  desc: 'All\'inizio di ogni ondata ottieni 3s di scudo',
                  apply(gs) { gs.waveShield = true; } }
};

function rollPerkOffer(taken, count = 3) {
  const pool = Object.keys(PERKS).filter(id => (taken[id] || 0) < PERKS[id].max);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
