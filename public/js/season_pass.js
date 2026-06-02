// ===== SEASON PASS MODULE =====

// Synced with backend PASS_TIERS (30 tiers, max 50,000 Pulsar)
const SEASON_PASS_TIERS = [
  { tier: 1,  pulsar: 1000,  reward: { label: '🪙 1,000 MONETE' } },
  { tier: 2,  pulsar: 2000,  reward: { label: '💎 20 GEMME' } },
  { tier: 3,  pulsar: 3500,  reward: { label: '🪙 2,500 MONETE' } },
  { tier: 4,  pulsar: 5000,  reward: { label: '💎 40 GEMME' } },
  { tier: 5,  pulsar: 6500,  reward: { label: '🪙 4,000 MONETE' } },
  { tier: 6,  pulsar: 8000,  reward: { label: '⚔️ BUSHIDO BLADE' } },
  { tier: 7,  pulsar: 9500,  reward: { label: '💎 60 GEMME' } },
  { tier: 8,  pulsar: 11000, reward: { label: '🪙 6,000 MONETE' } },
  { tier: 9,  pulsar: 13000, reward: { label: '🌅 AURA: RISING SUN' } },
  { tier: 10, pulsar: 15000, reward: { label: '💎 80 GEMME' } },
  { tier: 11, pulsar: 17000, reward: { label: '🪙 8,000 MONETE' } },
  { tier: 12, pulsar: 19000, reward: { label: '💎 100 GEMME' } },
  { tier: 13, pulsar: 21000, reward: { label: '🪙 10,000 MONETE' } },
  { tier: 14, pulsar: 23000, reward: { label: '🌸 SAKURA STORM' } },
  { tier: 15, pulsar: 25000, reward: { label: '💎 120 GEMME' } },
  { tier: 16, pulsar: 27000, reward: { label: '🪙 12,000 MONETE' } },
  { tier: 17, pulsar: 29000, reward: { label: '💎 150 GEMME' } },
  { tier: 18, pulsar: 31000, reward: { label: '🪙 15,000 MONETE' } },
  { tier: 19, pulsar: 33000, reward: { label: '💎 180 GEMME' } },
  { tier: 20, pulsar: 35000, reward: { label: '🪙 18,000 MONETE' } },
  { tier: 21, pulsar: 37000, reward: { label: '💎 200 GEMME' } },
  { tier: 22, pulsar: 39000, reward: { label: '🪙 22,000 MONETE' } },
  { tier: 23, pulsar: 41000, reward: { label: '💎 250 GEMME' } },
  { tier: 24, pulsar: 43000, reward: { label: '🪙 28,000 MONETE' } },
  { tier: 25, pulsar: 44500, reward: { label: '💎 300 GEMME' } },
  { tier: 26, pulsar: 46000, reward: { label: '🪙 35,000 MONETE' } },
  { tier: 27, pulsar: 47500, reward: { label: '💎 350 GEMME' } },
  { tier: 28, pulsar: 48500, reward: { label: '🪙 45,000 MONETE' } },
  { tier: 29, pulsar: 49500, reward: { label: '💎 400 GEMME' } },
  { tier: 30, pulsar: 50000, reward: { label: '⛩️ AURA: TORII GATE ★' } }
];

const PASS_MAX_PULSAR = 50000;

const DIFFICULTY_LABELS = { easy: 'FACILE', medium: 'MEDIO', hard: 'DIFFICILE', epic: 'EPICA' };

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
  return Math.min(100, Math.round((pulsar / PASS_MAX_PULSAR) * 100));
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
        <div class="pass-pulsar-label">⚡ PULSAR: <strong>${formatNumber(pulsar)}</strong> / ${formatNumber(PASS_MAX_PULSAR)}</div>
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
    const isGrand    = tier.tier === 30;

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

  // Server returns missions already merged with progress data (use id not mission_id)
  const missions = data.missions || [];
  const currentWeek = data.current_week || 1;
  const claimableCount = missions.filter(m =>
    m.week <= currentWeek &&
    m.unlocked !== false &&
    m.completed &&
    !m.reward_claimed
  ).length;

  content.innerHTML = `
    <div class="missions-week-info">📅 Settimana ${currentWeek} / 7 · ⚡ ${formatNumber(data.pulsar || 0)} Pulsar totali</div>
    <div class="missions-actions">
      <button id="claimAllMissionsBtn" class="btn btn-season mission-claim-all-btn" ${claimableCount > 0 ? '' : 'disabled'}>
        RISCATTA TUTTE (${claimableCount})
      </button>
    </div>
  `;
  const claimAllMissionsBtn = document.getElementById('claimAllMissionsBtn');
  if (claimAllMissionsBtn && claimableCount > 0) {
    claimAllMissionsBtn.addEventListener('click', async () => {
      claimAllMissionsBtn.disabled = true;
      try { await claimAllMissionRewards(); } finally { claimAllMissionsBtn.disabled = false; }
    });
  }

  const listEl = document.createElement('div');
  listEl.className = 'missions-list';

  for (const m of missions) {
    const isUnlocked = m.unlocked !== false && m.week <= currentWeek;
    const progress   = m.progress || 0;
    const completed  = m.completed || false;
    const claimed    = m.reward_claimed || false;
    const pct        = Math.min(100, Math.round((progress / m.target) * 100));

    // Build reward string
    const rewardParts = [`⚡ +${m.pulsar}`];
    if (m.reward_coins) rewardParts.push(`🪙 +${formatNumber(m.reward_coins)}`);
    if (m.reward_gems)  rewardParts.push(`💎 +${m.reward_gems}`);

    const card = document.createElement('div');
    card.className = `mission-card ${completed ? 'completed' : ''} ${claimed ? 'claimed' : ''} ${!isUnlocked ? 'locked' : ''}`;

    card.innerHTML = `
      <div class="mission-header">
        <div class="mission-week">Sett. ${m.week}</div>
        <span class="mission-difficulty mission-difficulty--${m.difficulty || 'easy'}">${DIFFICULTY_LABELS[m.difficulty] || m.difficulty || ''}</span>
        <div class="mission-pulsar">${rewardParts.join('  ')}</div>
      </div>
      <div class="mission-title">${m.title}</div>
      <div class="mission-desc">${m.desc}</div>
      ${isUnlocked
        ? `<div class="mission-progress-wrap">
             <div class="mission-progress-bar">
               <div class="mission-progress-fill ${completed ? 'done' : ''}" style="width:${pct}%"></div>
             </div>
             <div class="mission-progress-label">${formatNumber(progress)} / ${formatNumber(m.target)}</div>
           </div>`
        : `<div class="mission-locked-msg">🔒 Si sblocca alla settimana ${m.week}</div>`
      }
      ${completed && !claimed
        ? `<button class="btn btn-season mission-claim-btn" data-id="${m.id}">RISCATTA ⚡</button>`
        : ''
      }
      ${claimed ? '<div class="mission-claimed-label">✓ RISCATTATO</div>' : ''}
    `;

    if (completed && !claimed) {
      const claimBtn = card.querySelector('.mission-claim-btn');
      claimBtn.addEventListener('click', async () => {
        claimBtn.disabled = true;
        try { await claimMissionReward(m.id); } finally { claimBtn.disabled = false; }
      });
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
    const { pulsarEarned, totalPulsar, coinsEarned, gemsEarned } = res.data;
    let msg = `⚡ +${pulsarEarned} Pulsar!`;
    if (coinsEarned > 0) msg += `\n🪙 +${formatNumber(coinsEarned)} Monete`;
    if (gemsEarned  > 0) msg += `\n💎 +${gemsEarned} Gemme`;
    msg += `\n\nTotale: ${formatNumber(totalPulsar)} Pulsar`;
    alert(msg);
    loadMissions();
    updateMenuPassPanel({ pulsar: totalPulsar });
    updateCurrency();
  } else {
    alert(res.error || 'Errore nel riscattare la missione');
  }
}

async function claimAllMissionRewards() {
  const res = await apiFetch('/game/claim-all-mission-rewards', {
    method: 'POST'
  });
  if (res.success) {
    const { claimedCount, pulsarEarned, totalPulsar, coinsEarned, gemsEarned } = res.data;
    let msg = `✅ Riscattate ${claimedCount} missioni!\n⚡ +${pulsarEarned} Pulsar`;
    if (coinsEarned > 0) msg += `\n🪙 +${formatNumber(coinsEarned)} Monete`;
    if (gemsEarned > 0) msg += `\n💎 +${gemsEarned} Gemme`;
    msg += `\n\nTotale: ${formatNumber(totalPulsar)} Pulsar`;
    alert(msg);
    loadMissions();
    updateMenuPassPanel({ pulsar: totalPulsar });
    updateCurrency();
  } else {
    alert(res.error || 'Nessuna missione riscattabile');
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
