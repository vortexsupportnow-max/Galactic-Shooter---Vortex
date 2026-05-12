// ===== SEASON PASS MODULE =====

const SEASON_PASS_TIERS = [
  { tier: 1,  pulsar: 500,  reward: { type: 'coins',   amount: 1000,  label: '🪙 1,000 MONETE' } },
  { tier: 2,  pulsar: 1000, reward: { type: 'gems',    amount: 20,    label: '💎 20 GEMME' } },
  { tier: 3,  pulsar: 1500, reward: { type: 'coins',   amount: 2500,  label: '🪙 2,500 MONETE' } },
  { tier: 4,  pulsar: 2000, reward: { type: 'gems',    amount: 40,    label: '💎 40 GEMME' } },
  { tier: 5,  pulsar: 2500, reward: { type: 'ability', abilityId: 'bushido_blade', label: '⚔️ BUSHIDO BLADE' } },
  { tier: 6,  pulsar: 3000, reward: { type: 'coins',   amount: 5000,  label: '🪙 5,000 MONETE' } },
  { tier: 7,  pulsar: 3500, reward: { type: 'skin',    skinId: 'rising_sun',     label: '🌅 AURA: RISING SUN' } },
  { tier: 8,  pulsar: 4000, reward: { type: 'gems',    amount: 80,    label: '💎 80 GEMME' } },
  { tier: 9,  pulsar: 4500, reward: { type: 'ability', abilityId: 'sakura_storm', label: '🌸 SAKURA STORM' } },
  { tier: 10, pulsar: 5000, reward: { type: 'skin',    skinId: 'torii_gate',     label: '⛩️ AURA: TORII GATE ★' } }
];

const SEASON_MISSIONS_DEF = [
  { id: 'm1',  week: 1, title: 'Riscaldamento',       desc: 'Gioca 3 partite',              target: 3,    pulsar: 500 },
  { id: 'm2',  week: 1, title: 'Prima Battaglia',      desc: 'Uccidi 50 nemici',             target: 50,   pulsar: 500 },
  { id: 'm3',  week: 2, title: 'Sopravvissuto',        desc: "Raggiungi l'onda 5",           target: 5,    pulsar: 500 },
  { id: 'm4',  week: 2, title: 'Raccoglitore',         desc: 'Guadagna 1000 monete in una partita', target: 1000, pulsar: 500 },
  { id: 'm5',  week: 3, title: 'Cacciatore di Boss',   desc: "Raggiungi l'onda 10",          target: 10,   pulsar: 500 },
  { id: 'm6',  week: 3, title: 'Abilità Ninja',        desc: 'Usa 5 abilità in una partita', target: 5,    pulsar: 500 },
  { id: 'm7',  week: 4, title: 'Leggenda Galattica',   desc: "Raggiungi l'onda 15",          target: 15,   pulsar: 500 },
  { id: 'm8',  week: 4, title: 'Cacciatore di Gemme',  desc: 'Colleziona 30 gemme',          target: 30,   pulsar: 500 },
  { id: 'm9',  week: 5, title: 'Sterminatore',         desc: 'Uccidi 200 nemici in totale',  target: 200,  pulsar: 500 },
  { id: 'm10', week: 5, title: 'Veterano della Season',desc: 'Completa 10 partite',          target: 10,   pulsar: 500 }
];

let _passData = null;

// ── Shared helpers ──────────────────────────────────────────────────────────

async function fetchPassData() {
  const res = await apiFetch('/game/season-pass');
  if (res.success) {
    _passData = res.data;
    return res.data;
  }
  return null;
}

function getPulsarPercent(pulsar) {
  return Math.min(100, Math.round((pulsar / 5000) * 100));
}

// Update the mini Pulsar display in the main menu
function updateMenuPassPanel(passData) {
  const pulsarEl = document.getElementById('menu-pulsar');
  const fillEl   = document.getElementById('menu-pulsar-fill');
  if (!passData) return;
  const pulsar = passData.pulsar || 0;
  if (pulsarEl) pulsarEl.textContent = formatNumber(pulsar);
  if (fillEl)   fillEl.style.width = `${getPulsarPercent(pulsar)}%`;
}

// ── Season Pass Screen ───────────────────────────────────────────────────────

function showSeasonPass() {
  showScreen('pass');
  loadSeasonPass();
}

async function loadSeasonPass() {
  const content = document.getElementById('pass-content');
  content.innerHTML = '<div class="loading">LOADING...</div>';

  const data = await fetchPassData();
  if (!data) { content.innerHTML = '<div class="loading">ERRORE CARICAMENTO PASS</div>'; return; }

  const pulsar = data.pulsar || 0;
  const claimed = data.claimed_tiers || [];

  document.getElementById('pass-pulsar-header').textContent = formatNumber(pulsar);
  updateMenuPassPanel(data);

  const daysLeft = Math.max(0, Math.ceil((new Date(data.season_end) - Date.now()) / 86400000));

  content.innerHTML = `
    <div class="pass-header-card">
      <div class="pass-season-name">🌸 ${data.season_name}</div>
      <div class="pass-season-info">Stagione 1 · ${daysLeft} giorni rimanenti</div>
      <div class="pass-pulsar-section">
        <div class="pass-pulsar-label">⚡ PULSAR: <strong>${formatNumber(pulsar)}</strong> / 5,000</div>
        <div class="pass-bar-outer">
          <div class="pass-bar-fill" style="width:${getPulsarPercent(pulsar)}%"></div>
        </div>
      </div>
      <div class="pass-how">Completa le MISSIONI per guadagnare Pulsar e sbloccare ricompense!</div>
    </div>
  `;

  // Tier rewards list
  const tiersEl = document.createElement('div');
  tiersEl.className = 'pass-tiers';

  for (const tier of SEASON_PASS_TIERS) {
    const tierKey    = `tier_${tier.tier}`;
    const isUnlocked = pulsar >= tier.pulsar;
    const isClaimed  = claimed.includes(tierKey);
    const isGrand    = tier.tier === 10;

    const card = document.createElement('div');
    card.className = `pass-tier-card ${isUnlocked ? 'unlocked' : ''} ${isClaimed ? 'claimed' : ''} ${isGrand ? 'grand' : ''}`;

    card.innerHTML = `
      <div class="pass-tier-num">TIER ${tier.tier}</div>
      <div class="pass-tier-pulsar">⚡ ${formatNumber(tier.pulsar)}</div>
      <div class="pass-tier-reward">${tier.reward.label}</div>
      ${isClaimed
        ? '<div class="pass-tier-claimed">✓ RISCATTATO</div>'
        : isUnlocked
          ? `<button class="btn btn-season pass-claim-btn" data-tier="${tier.tier}">RISCATTA</button>`
          : `<div class="pass-tier-locked">🔒 ${formatNumber(tier.pulsar - pulsar)} Pulsar</div>`
      }
    `;

    if (isUnlocked && !isClaimed) {
      card.querySelector('.pass-claim-btn').addEventListener('click', () => claimPassTier(tier.tier));
    }

    tiersEl.appendChild(card);
  }

  content.appendChild(tiersEl);
}

async function claimPassTier(tier) {
  const res = await apiFetch('/game/claim-pass-tier', {
    method: 'POST',
    body: JSON.stringify({ tier })
  });
  if (res.success) {
    const desc = res.data.rewardDesc || '';
    alert(`✅ Ricompensa riscattata!\n${desc}`);
    loadSeasonPass();
    updateCurrency();
  } else {
    alert(res.error || 'Errore nel riscattare la ricompensa');
  }
}

// ── Missions Screen ──────────────────────────────────────────────────────────

function showMissions() {
  showScreen('missions');
  loadMissions();
}

async function loadMissions() {
  const content = document.getElementById('missions-content');
  content.innerHTML = '<div class="loading">LOADING...</div>';

  const data = await fetchPassData();
  if (!data) { content.innerHTML = '<div class="loading">ERRORE</div>'; return; }

  document.getElementById('missions-pulsar-header').textContent = formatNumber(data.pulsar || 0);
  updateMenuPassPanel(data);

  const missionProgress = data.missions || [];
  const currentWeek = data.current_week || 1;

  content.innerHTML = `
    <div class="missions-week-info">📅 Settimana ${currentWeek} · ⚡ ${formatNumber(data.pulsar || 0)} Pulsar totali</div>
  `;

  const listEl = document.createElement('div');
  listEl.className = 'missions-list';

  for (const mDef of SEASON_MISSIONS_DEF) {
    const prog = missionProgress.find(p => p.mission_id === mDef.id) || {};
    const isUnlocked = mDef.week <= currentWeek;
    const progress   = prog.progress || 0;
    const completed  = prog.completed || false;
    const claimed    = prog.reward_claimed || false;

    const pct = Math.min(100, Math.round((progress / mDef.target) * 100));

    const card = document.createElement('div');
    card.className = `mission-card ${completed ? 'completed' : ''} ${claimed ? 'claimed' : ''} ${!isUnlocked ? 'locked' : ''}`;

    card.innerHTML = `
      <div class="mission-header">
        <div class="mission-week">Sett. ${mDef.week}</div>
        <div class="mission-pulsar">⚡ +${mDef.pulsar}</div>
      </div>
      <div class="mission-title">${mDef.title}</div>
      <div class="mission-desc">${mDef.desc}</div>
      ${isUnlocked
        ? `<div class="mission-progress-wrap">
             <div class="mission-progress-bar">
               <div class="mission-progress-fill ${completed ? 'done' : ''}" style="width:${pct}%"></div>
             </div>
             <div class="mission-progress-label">${progress} / ${mDef.target}</div>
           </div>`
        : `<div class="mission-locked-msg">🔒 Si sblocca alla settimana ${mDef.week}</div>`
      }
      ${completed && !claimed
        ? `<button class="btn btn-season mission-claim-btn" data-id="${mDef.id}">RISCATTA ⚡</button>`
        : ''
      }
      ${claimed ? '<div class="mission-claimed-label">✓ RISCATTATO</div>' : ''}
    `;

    if (completed && !claimed) {
      card.querySelector('.mission-claim-btn').addEventListener('click', () => claimMissionReward(mDef.id));
    }

    listEl.appendChild(card);
  }

  content.appendChild(listEl);
}

async function claimMissionReward(missionId) {
  const res = await apiFetch('/game/claim-mission-reward', {
    method: 'POST',
    body: JSON.stringify({ missionId })
  });
  if (res.success) {
    const { pulsarEarned, totalPulsar } = res.data;
    alert(`⚡ +${pulsarEarned} Pulsar!\nTotale: ${formatNumber(totalPulsar)} Pulsar`);
    loadMissions();
    updateMenuPassPanel({ pulsar: totalPulsar });
  } else {
    alert(res.error || 'Errore nel riscattare la missione');
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

function initPassHandlers() {
  document.getElementById('btn-pass').addEventListener('click', showSeasonPass);
  document.getElementById('btn-missions').addEventListener('click', showMissions);
  document.getElementById('pass-back').addEventListener('click', showMainMenu);
  document.getElementById('missions-back').addEventListener('click', showMainMenu);
}

window.initPassHandlers  = initPassHandlers;
window.updateMenuPassPanel = updateMenuPassPanel;
window.fetchPassData     = fetchPassData;
