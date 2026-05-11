// ===== PIXEL ART ASSETS =====
// All drawn programmatically on small canvases

const GameAssets = (function() {
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  // Player ship - cyan triangle with engine glow
  function drawPlayerShip(size = 32) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const s = size / 32;

    // Engine glow
    ctx.fillStyle = '#0044ff';
    ctx.fillRect(12*s, 26*s, 8*s, 4*s);

    // Body
    ctx.fillStyle = '#00ffff';
    // Main hull
    ctx.beginPath();
    ctx.moveTo(16*s, 2*s);
    ctx.lineTo(28*s, 28*s);
    ctx.lineTo(16*s, 22*s);
    ctx.lineTo(4*s, 28*s);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14*s, 10*s, 4*s, 6*s);

    // Wings highlight
    ctx.fillStyle = '#0088ff';
    ctx.fillRect(4*s, 22*s, 6*s, 4*s);
    ctx.fillRect(22*s, 22*s, 6*s, 4*s);

    return c;
  }

  // Basic enemy - red triangle (points down)
  function drawEnemyBasic(size = 24) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const s = size / 24;

    ctx.fillStyle = '#ff2244';
    ctx.beginPath();
    ctx.moveTo(12*s, 22*s);
    ctx.lineTo(22*s, 4*s);
    ctx.lineTo(2*s, 4*s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ff8888';
    ctx.fillRect(10*s, 8*s, 4*s, 4*s);

    ctx.fillStyle = '#880011';
    ctx.fillRect(6*s, 4*s, 4*s, 3*s);
    ctx.fillRect(14*s, 4*s, 4*s, 3*s);

    return c;
  }

  // Medium enemy - orange diamond
  function drawEnemyMedium(size = 28) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const s = size / 28;

    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(14*s, 2*s);
    ctx.lineTo(26*s, 14*s);
    ctx.lineTo(14*s, 26*s);
    ctx.lineTo(2*s, 14*s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffcc44';
    ctx.fillRect(11*s, 11*s, 6*s, 6*s);

    ctx.fillStyle = '#884400';
    ctx.fillRect(8*s, 8*s, 4*s, 4*s);
    ctx.fillRect(16*s, 16*s, 4*s, 4*s);

    return c;
  }

  // Heavy enemy - purple hexagon
  function drawEnemyHeavy(size = 32) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const s = size / 32;

    ctx.fillStyle = '#8800ff';
    const cx = 16*s, cy = 16*s, r = 14*s;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI / 3) - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
      else ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#dd44ff';
    ctx.fillRect(12*s, 12*s, 8*s, 8*s);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14*s, 14*s, 4*s, 4*s);

    return c;
  }

  // Boss ship - large magenta
  function drawBoss(size = 64) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const s = size / 64;

    // Main body
    ctx.fillStyle = '#ff00aa';
    ctx.fillRect(20*s, 10*s, 24*s, 40*s);

    // Wings
    ctx.fillStyle = '#cc0088';
    ctx.beginPath();
    ctx.moveTo(20*s, 20*s);
    ctx.lineTo(2*s, 40*s);
    ctx.lineTo(2*s, 50*s);
    ctx.lineTo(20*s, 45*s);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(44*s, 20*s);
    ctx.lineTo(62*s, 40*s);
    ctx.lineTo(62*s, 50*s);
    ctx.lineTo(44*s, 45*s);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = '#ffaaff';
    ctx.fillRect(26*s, 14*s, 12*s, 10*s);

    // Guns
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(22*s, 45*s, 6*s, 12*s);
    ctx.fillRect(36*s, 45*s, 6*s, 12*s);

    // Eye
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(28*s, 18*s, 8*s, 4*s);

    return c;
  }

  // Bullet sprites
  function drawPlayerBullet() {
    const c = makeCanvas(4, 12);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(1, 0, 2, 12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, 0, 2, 3);
    return c;
  }

  function drawEnemyBullet() {
    const c = makeCanvas(4, 10);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ff2233';
    ctx.fillRect(1, 0, 2, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, 0, 2, 2);
    ctx.fillStyle = '#ff99aa';
    ctx.fillRect(1, 7, 2, 3);
    return c;
  }

  // Explosion frames
  function drawExplosionFrames(size = 32) {
    const frames = [];
    const colors = [['#ffffff','#ffff00'], ['#ffff00','#ff8800'], ['#ff8800','#ff4400'], ['#ff4400','#ff2200'], ['#880000','#440000']];
    for (let f = 0; f < 5; f++) {
      const c = makeCanvas(size, size);
      const ctx = c.getContext('2d');
      const r = (f + 1) * (size / 10);
      const [c1, c2] = colors[f];
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, r);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size/2, size/2, r, 0, Math.PI*2);
      ctx.fill();

      // Sparks
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + f * 0.3;
        const d = r * (0.8 + Math.random() * 0.4);
        ctx.fillRect(size/2 + Math.cos(a)*d - 1, size/2 + Math.sin(a)*d - 1, 2, 2);
      }
      frames.push(c);
    }
    return frames;
  }

  // Power-up orb
  function drawPowerUp(size = 20) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const cx = size/2, cy = size/2, r = size/2 - 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#00ffff');
    grad.addColorStop(1, '#0000ff');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    return c;
  }

  // Ability icons - simple pixel art per ability
  function drawAbilityIcon(abilityId, rarity) {
    const c = makeCanvas(24, 24);
    const ctx = c.getContext('2d');
    const color = RARITY_COLORS[rarity] || '#aaaaaa';

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 24, 24);

    ctx.fillStyle = color;

    const icons = {
      shield:         () => { ctx.beginPath(); ctx.arc(12,11,8,Math.PI,0); ctx.lineTo(12,20); ctx.closePath(); ctx.fill(); },
      speed_boost:    () => { ctx.fillRect(4,10,6,4); ctx.fillRect(10,7,4,10); ctx.fillRect(14,10,6,4); },
      triple_shot:    () => { ctx.fillRect(11,4,2,16); ctx.fillRect(5,6,2,14); ctx.fillRect(17,6,2,14); },
      frag_bomb:      () => { ctx.beginPath(); ctx.arc(12,13,6,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.fillRect(11,4,2,5); },
      rapid_fire:     () => { for(let i=0;i<4;i++) ctx.fillRect(6,4+i*5,12,2); },
      heal:           () => { ctx.fillRect(10,5,4,14); ctx.fillRect(5,10,14,4); },
      spread_shot:    () => { [-8,-4,0,4,8].forEach(a=>{ ctx.save(); ctx.translate(12,20); ctx.rotate(a*Math.PI/180*10); ctx.fillRect(-1,-14,2,14); ctx.restore(); }); },
      homing:         () => { ctx.beginPath(); ctx.arc(12,12,8,0,Math.PI*2); ctx.lineWidth=2; ctx.strokeStyle=color; ctx.stroke(); ctx.fillRect(10,4,4,6); },
      laser:          () => { ctx.fillStyle='#ff0000'; for(let i=0;i<3;i++) ctx.fillRect(11-i,4,2+i*2,16); },
      magnetic_field: () => { ctx.beginPath(); ctx.arc(12,12,8,0,Math.PI*2); ctx.lineWidth=3; ctx.strokeStyle=color; ctx.stroke(); ctx.fillRect(10,10,4,4); },
      clone:          () => { ctx.globalAlpha=0.6; ctx.fillRect(3,8,6,12); ctx.globalAlpha=1; ctx.fillRect(15,6,6,14); },
      time_slow:      () => { ctx.beginPath(); ctx.arc(12,12,8,0,Math.PI*2); ctx.lineWidth=2; ctx.strokeStyle=color; ctx.stroke(); ctx.fillRect(11,5,2,8); ctx.fillRect(12,12,6,2); },
      piercing:       () => { ctx.save(); ctx.translate(12,12); ctx.rotate(Math.PI/4); ctx.fillRect(-2,-10,4,20); ctx.fillRect(-1,-11,2,4); ctx.restore(); },
      ricochet:       () => { ctx.fillRect(4,10,16,2); ctx.fillRect(4,4,2,8); ctx.fillRect(18,12,2,8); },
      overcharge:     () => { ctx.fillStyle='#ffff00'; ctx.beginPath(); ctx.moveTo(14,4); ctx.lineTo(8,13); ctx.lineTo(12,13); ctx.lineTo(10,20); ctx.lineTo(18,11); ctx.lineTo(14,11); ctx.closePath(); ctx.fill(); },
      drone:          () => { ctx.beginPath(); ctx.arc(12,12,9,0,Math.PI*2); ctx.lineWidth=2; ctx.strokeStyle=color; ctx.stroke(); ctx.fillRect(10,10,4,4); ctx.fillRect(5,10,4,4); ctx.fillRect(15,10,4,4); },
      black_hole:     () => { for(let r=8;r>1;r-=2) { ctx.globalAlpha=1-r/10; ctx.beginPath(); ctx.arc(12,12,r,0,Math.PI*2); ctx.fill(); } ctx.globalAlpha=1; },
      emp:            () => { [4,8,12,16,20].forEach(x=>{ ctx.fillRect(x,8,2,8); }); ctx.fillRect(4,6,16,2); },
      rain_of_fire:   () => { [6,10,14,18].forEach(x=>{ ctx.fillStyle=color; ctx.fillRect(x,4+Math.random()*4,3,12); }); },
      chain_lightning:() => { ctx.beginPath(); ctx.moveTo(6,4); ctx.lineTo(14,10); ctx.lineTo(8,14); ctx.lineTo(18,20); ctx.lineWidth=2; ctx.strokeStyle='#ffff44'; ctx.stroke(); },
      vortex:         () => { ctx.beginPath(); ctx.arc(12,12,8,0,Math.PI*1.8); ctx.lineWidth=3; ctx.strokeStyle=color; ctx.stroke(); ctx.fillRect(10,4,4,4); },
      gravity_well:   () => { [6,8,10,12].forEach(r=>{ ctx.globalAlpha=0.3+r/16; ctx.beginPath(); ctx.arc(12,12,r,0,Math.PI*2); ctx.lineWidth=1; ctx.strokeStyle=color; ctx.stroke(); }); ctx.globalAlpha=1; },
      turret:         () => { ctx.fillRect(8,8,8,8); ctx.fillRect(10,4,4,5); ctx.fillRect(4,8,4,8); ctx.fillRect(16,8,4,8); },
      freeze:         () => { ctx.fillStyle='#44aaff'; ctx.fillRect(11,4,2,16); ctx.fillRect(4,11,16,2); ctx.fillRect(6,6,3,3); ctx.fillRect(15,6,3,3); ctx.fillRect(6,15,3,3); ctx.fillRect(15,15,3,3); },
      god_mode:       () => { ctx.fillStyle='#ffff00'; ctx.beginPath(); ctx.moveTo(12,2); for(let i=0;i<5;i++){ const a=i*Math.PI*2/5-Math.PI/2; ctx.lineTo(12+9*Math.cos(a),12+9*Math.sin(a)); ctx.lineTo(12+4*Math.cos(a+Math.PI/5),12+4*Math.sin(a+Math.PI/5)); } ctx.closePath(); ctx.fill(); },
      nuke:           () => { ctx.beginPath(); ctx.arc(12,12,8,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(12,12,4,0,Math.PI*2); ctx.fill(); ctx.fillStyle=color; ctx.fillRect(11,3,2,4); },
      time_warp:      () => { ctx.beginPath(); ctx.arc(12,12,8,0,Math.PI*2); ctx.lineWidth=2; ctx.strokeStyle=color; ctx.stroke(); ctx.fillRect(8,10,4,2); ctx.fillRect(12,10,2,4); },
      phoenix:        () => { ctx.fillStyle='#ff8800'; ctx.beginPath(); ctx.moveTo(12,4); ctx.lineTo(20,18); ctx.lineTo(12,14); ctx.lineTo(4,18); ctx.closePath(); ctx.fill(); ctx.fillStyle='#ffff00'; ctx.fillRect(10,14,4,6); },
      singularity:    () => { ctx.fillStyle='#000'; ctx.fillRect(0,0,24,24); for(let r=10;r>0;r-=2){ ctx.globalAlpha=(10-r)/10; ctx.beginPath(); ctx.arc(12,12,r,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); } ctx.globalAlpha=1; },
      storm:          () => { ctx.fillStyle='#ffff44'; [5,9,15,19].forEach((x,i)=>{ ctx.fillRect(x,4+i%2*4,2,16-i%2*4); }); }
    };

    const draw = icons[abilityId];
    if (draw) draw();
    else {
      ctx.fillStyle = color;
      ctx.fillRect(4,4,16,16);
    }

    return c;
  }

  // Shield effect overlay (for player)
  function drawShieldEffect(size = 48) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size/2,size/2,size/3,size/2,size/2,size/2);
    grad.addColorStop(0, 'rgba(0,255,255,0)');
    grad.addColorStop(0.7, 'rgba(0,255,255,0.1)');
    grad.addColorStop(1, 'rgba(0,255,255,0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,size,size);
    return c;
  }

  const _player = drawPlayerShip(40);
  const _playerLg = drawPlayerShip(40);
  const _enemyBasic = drawEnemyBasic(24);
  const _enemyMedium = drawEnemyMedium(28);
  const _enemyHeavy = drawEnemyHeavy(32);
  const _boss = drawBoss(64);
  const _playerBullet = drawPlayerBullet();
  const _enemyBullet = drawEnemyBullet();
  const _explosion = drawExplosionFrames(32);
  const _powerUp = drawPowerUp(20);

  return {
    player: _player,
    enemyBasic: _enemyBasic,
    enemyMedium: _enemyMedium,
    enemyHeavy: _enemyHeavy,
    boss: _boss,
    playerBullet: _playerBullet,
    enemyBullet: _enemyBullet,
    explosionFrames: _explosion,
    powerUp: _powerUp,
    drawAbilityIcon,
    drawShieldEffect
  };
})();
