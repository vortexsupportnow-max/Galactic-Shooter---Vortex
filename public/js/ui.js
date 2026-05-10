// ===== UI MODULE =====

let _profileData = null;
let _selectedAbilityForSlot = null;
let _lbType = 'scores';
let _lbFilter = 'all';
let _collFilter = 'all';

function showMainMenu() {
  showScreen('menu');
  const nick = getNickname();
  document.getElementById('menu-nickname').textContent = nick || '???';
  updateCurrency();
  initStarField('menuStars');
}

async function updateCurrency() {
  const res = await apiFetch('/game/profile');
  if (res.success) {
    document.getElementById('menu-coins').textContent = formatNumber(res.data.coins || 0);
    document.getElementById('menu-gems').textContent = formatNumber(res.data.gems || 0);
    _profileData = res.data;
  }
}

function showProfile() {
  showScreen('profile');
  loadProfile();
}

async function loadProfile() {
  const content = document.getElementById('profile-content');
  content.innerHTML = '<div class="loading">LOADING...</div>';

  const res = await apiFetch('/game/profile');
  if (!res.success) { content.innerHTML = `<div class="loading">ERROR: ${res.error}</div>`; return; }
  const d = res.data;
  _profileData = d;

  const aCount = (d.abilities || []).length;
  const total = Object.keys(ABILITIES).length;

  content.innerHTML = `
    <div class="profile-card">
      <h3>PILOT INFO</h3>
      <div class="stat-row"><span>NICKNAME</span><span class="val">${d.nickname}</span></div>
      <div class="stat-row"><span>JOINED</span><span class="val">${new Date(d.created_at).toLocaleDateString()}</span></div>
    </div>
    <div class="profile-card">
      <h3>CURRENCY</h3>
      <div class="stat-row"><span>🪙 COINS</span><span class="val">${formatNumber(d.coins)}</span></div>
      <div class="stat-row"><span>💎 GEMS</span><span class="val">${formatNumber(d.gems)}</span></div>
    </div>
    <div class="profile-card">
      <h3>STATS</h3>
      <div class="stat-row"><span>GAMES PLAYED</span><span class="val">${d.games_played}</span></div>
      <div class="stat-row"><span>MAX SCORE</span><span class="val">${formatNumber(d.max_score)}</span></div>
      <div class="stat-row"><span>MAX WAVE</span><span class="val">${d.max_wave}</span></div>
      <div class="stat-row"><span>ABILITIES</span><span class="val">${aCount}/${total}</span></div>
    </div>
    <div class="profile-card">
      <h3>ACHIEVEMENTS</h3>
      ${renderAchievements(d.achievements || [])}
    </div>
  `;
}

function renderAchievements(unlocked) {
  const all = [
    { id: 'score_1k',   name: 'First Blood',   desc: 'Score 1,000' },
    { id: 'score_10k',  name: 'Gunslinger',     desc: 'Score 10,000' },
    { id: 'score_100k', name: 'Space Legend',   desc: 'Score 100,000' },
    { id: 'wave_5',     name: 'Survivor',       desc: 'Reach Wave 5' },
    { id: 'wave_10',    name: 'Veteran',        desc: 'Reach Wave 10' },
    { id: 'wave_25',    name: 'Elite Pilot',    desc: 'Reach Wave 25' },
    { id: 'wave_50',    name: 'Galactic Hero',  desc: 'Reach Wave 50' },
    { id: 'kills_100',  name: 'Centurion',      desc: 'Kill 100 enemies' },
    { id: 'kills_500',  name: 'Annihilator',    desc: 'Kill 500 enemies' }
  ];
  const unlockedIds = unlocked.map(a => a.achievement_id);
  return all.map(a => {
    const done = unlockedIds.includes(a.id);
    return `<div class="stat-row" style="color:${done?'#ffff00':'#555577'}">
      <span>${done?'★':'☆'} ${a.name}</span><span class="val" style="font-size:0.4rem">${a.desc}</span>
    </div>`;
  }).join('');
}

function showCollection() {
  showScreen('collection');
  _collFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-rarity="all"]').classList.add('active');
  loadCollection();
}

async function loadCollection() {
  const grid = document.getElementById('ability-grid');
  grid.innerHTML = '<div class="loading">LOADING...</div>';

  const res = await apiFetch('/game/profile');
  if (!res.success) { grid.innerHTML = '<div class="loading">ERROR</div>'; return; }
  _profileData = res.data;

  document.getElementById('coll-coins').textContent = formatNumber(res.data.coins || 0);

  renderAbilityGrid(res.data);
}

function renderAbilityGrid(profile) {
  const grid = document.getElementById('ability-grid');
  const ownedMap = {};
  for (const a of (profile.abilities || [])) ownedMap[a.ability_id] = a.level;

  const abilities = Object.values(ABILITIES).filter(a => {
    return _collFilter === 'all' || a.rarity === _collFilter;
  });

  grid.innerHTML = '';
  for (const ability of abilities) {
    const owned = ownedMap[ability.id];
    const card = document.createElement('div');
    card.className = `ability-card ${ability.rarity} ${owned ? '' : 'locked'}`;

    const icon = GameAssets.drawAbilityIcon(ability.id, ability.rarity);
    icon.className = 'ability-icon-canvas';
    icon.width = 24; icon.height = 24;
    icon.style.width = '32px'; icon.style.height = '32px';

    card.innerHTML = `
      <div class="ability-rarity-tag">${ability.rarity.toUpperCase()}</div>
    `;
    card.appendChild(icon);
    card.innerHTML += `
      <div class="ability-name">${ability.name}</div>
      ${owned ? `<div class="ability-level">LV ${owned}/10</div>` : '<div class="ability-level" style="color:#555">LOCKED</div>'}
    `;

    if (owned) {
      if (owned < 10) {
        const cost = getAbilityCost(ability.id, owned);
        const btn = document.createElement('button');
        btn.className = 'upgrade-btn';
        btn.textContent = `⬆ ${formatNumber(cost)}🪙`;
        btn.addEventListener('click', e => {
          e.stopPropagation();
          upgradeAbility(ability.id, btn, profile);
        });
        card.appendChild(btn);
      } else {
        const maxEl = document.createElement('div');
        maxEl.style.cssText = 'font-size:0.35rem;color:#ffaa00;padding:0.2rem';
        maxEl.textContent = 'MAX LEVEL';
        card.appendChild(maxEl);
      }
    }

    grid.appendChild(card);
  }
}

async function upgradeAbility(abilityId, btn, profile) {
  const owned = (profile.abilities || []).find(a => a.ability_id === abilityId);
  if (!owned) return;
  const cost = getAbilityCost(abilityId, owned.level);

  if (profile.coins < cost) {
    alert('NOT ENOUGH COINS!');
    return;
  }

  btn.textContent = '...';
  btn.disabled = true;

  const res = await apiFetch('/game/upgrade-ability', {
    method: 'POST',
    body: JSON.stringify({ abilityId })
  });

  if (res.success) {
    // Reload
    loadCollection();
  } else {
    alert(res.error || 'UPGRADE FAILED');
    btn.disabled = false;
  }
}

// Slot selection
let _slotSelectAbility = null;
let _slotSelectLevel = 1;

function openSlotSelect(ability, level) {
  _slotSelectAbility = ability;
  _slotSelectLevel = level;
  document.getElementById('slot-select-overlay').classList.remove('hidden');
}

function initSlotSelectHandlers() {
  document.querySelectorAll('#slot-select-overlay .slot-buttons .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const slot = parseInt(btn.dataset.slot);
      if (_slotSelectAbility) {
        window._pendingSlots = window._pendingSlots || [null, null, null];
        window._pendingSlots[slot] = { ..._slotSelectAbility, level: _slotSelectLevel };
        btn.textContent = `SLOT ${['Q','W','E'][slot]} ✓`;
        setTimeout(() => {
          document.getElementById('slot-select-overlay').classList.add('hidden');
        }, 500);
      }
    });
  });
  document.getElementById('slot-cancel').addEventListener('click', () => {
    document.getElementById('slot-select-overlay').classList.add('hidden');
  });
}

function showCrateShop() {
  showScreen('crates');
  loadCrateShop();
}

async function loadCrateShop() {
  const res = await apiFetch('/game/profile');
  if (res.success) {
    document.getElementById('crates-gems').textContent = formatNumber(res.data.gems || 0);
  }
  document.getElementById('crate-result').classList.add('hidden');
}

function initCrateHandlers() {
  document.getElementById('open-crate-btn').addEventListener('click', openCrate);
}

async function openCrate() {
  const btn = document.getElementById('open-crate-btn');
  btn.textContent = '...';
  btn.disabled = true;

  const res = await apiFetch('/game/open-crate', { method: 'POST', body: '{}' });

  btn.textContent = 'OPEN CRATE';
  btn.disabled = false;

  if (!res.success) {
    alert(res.error || 'Failed to open crate');
    return;
  }

  const { abilityId, rarity, level, alreadyOwned } = res.data;
  const ability = ABILITIES[abilityId];
  const resultEl = document.getElementById('crate-result');
  resultEl.className = `crate-result ${rarity}`;
  resultEl.classList.remove('hidden');

  const icon = GameAssets.drawAbilityIcon(abilityId, rarity);
  icon.style.width = '40px'; icon.style.height = '40px';

  resultEl.innerHTML = `
    <div style="font-size:0.5rem;margin-bottom:0.5rem">${rarity.toUpperCase()}</div>
  `;
  resultEl.appendChild(icon);
  resultEl.innerHTML += `
    <div style="font-size:0.6rem;margin-top:0.5rem">${ability ? ability.name : abilityId}</div>
    <div style="font-size:0.45rem;margin-top:0.3rem;color:#aaa">
      ${alreadyOwned ? `UPGRADED TO LV ${level}` : 'NEW ABILITY!'}
    </div>
  `;

  // Animate crate
  const crateBox = document.getElementById('crate-box');
  crateBox.style.animation = 'none';
  crateBox.style.transform = 'scale(1.15)';
  setTimeout(() => { crateBox.style.transform = ''; crateBox.style.animation = ''; }, 400);

  // Update gem display
  loadCrateShop();
}

function showLeaderboard() {
  showScreen('leaderboard');
  _lbType = 'scores';
  _lbFilter = 'all';
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.lb-tab[data-type="scores"]').classList.add('active');
  document.querySelectorAll('.lb-filter').forEach(f => f.classList.remove('active'));
  document.querySelector('.lb-filter[data-filter="all"]').classList.add('active');
  loadLeaderboard();
}

async function loadLeaderboard() {
  const tbody = document.getElementById('lb-tbody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">LOADING...</td></tr>';

  const endpoint = _lbType === 'scores' ? '/leaderboard/scores' : '/leaderboard/waves';
  const res = await apiFetch(`${endpoint}?filter=${_lbFilter}`);

  if (!res.success) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">ERROR</td></tr>';
    return;
  }

  const currentNick = getNickname();
  document.getElementById('lb-value-header').textContent = _lbType === 'scores' ? 'SCORE' : 'WAVE';

  if (res.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">NO DATA</td></tr>';
    return;
  }

  tbody.innerHTML = res.data.map((row, i) => {
    const isCurrent = row.nickname === currentNick;
    const val = _lbType === 'scores' ? formatNumber(row.score) : row.wave;
    const waveVal = _lbType === 'scores' ? row.wave : formatNumber(row.score);
    return `<tr class="${isCurrent ? 'current-user' : ''}">
      <td>${i+1}</td>
      <td>${row.nickname}</td>
      <td>${val}</td>
      <td>${waveVal}</td>
    </tr>`;
  }).join('');
}

function initLeaderboardHandlers() {
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _lbType = tab.dataset.type;
      loadLeaderboard();
    });
  });

  document.querySelectorAll('.lb-filter').forEach(filter => {
    filter.addEventListener('click', () => {
      document.querySelectorAll('.lb-filter').forEach(f => f.classList.remove('active'));
      filter.classList.add('active');
      _lbFilter = filter.dataset.filter;
      loadLeaderboard();
    });
  });
}

function initCollectionHandlers() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _collFilter = btn.dataset.rarity;
      if (_profileData) renderAbilityGrid(_profileData);
    });
  });
}

function initMenuHandlers() {
  document.getElementById('btn-play').addEventListener('click', async () => {
    showScreen('game');
    // Load the user's unlocked abilities so in-game powerups only use those
    const res = await apiFetch('/game/profile');
    const ownedAbilityIds = res.success ? (res.data.abilities || []).map(a => a.ability_id) : [];
    startGame([null, null, null], ownedAbilityIds);
  });
  document.getElementById('btn-collection').addEventListener('click', showCollection);
  document.getElementById('btn-crates').addEventListener('click', showCrateShop);
  document.getElementById('btn-leaderboard').addEventListener('click', showLeaderboard);
  document.getElementById('btn-profile').addEventListener('click', showProfile);
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearToken();
    setNickname('');
    showLoginScreen();
  });

  document.getElementById('profile-back').addEventListener('click', showMainMenu);
  document.getElementById('collection-back').addEventListener('click', showMainMenu);
  document.getElementById('crates-back').addEventListener('click', showMainMenu);
  document.getElementById('lb-back').addEventListener('click', showMainMenu);
}

// ===== SETTINGS =====
function openSettings() {
  document.getElementById('settings-overlay').classList.remove('hidden');
  const vol = Math.round((window.audioVolume ?? 1) * 100);
  document.getElementById('settings-volume').value = vol;
  const valEl = document.getElementById('settings-volume-val');
  if (valEl) valEl.textContent = `${vol}%`;
  _updateMuteBtn();
}

function _updateMuteBtn() {
  const btn = document.getElementById('settings-mute-btn');
  if (btn) btn.textContent = window.audioMuted ? '🔇 UNMUTE' : '🔊 MUTE';
}

function initSettingsHandlers() {
  document.getElementById('settings-close').addEventListener('click', () => {
    document.getElementById('settings-overlay').classList.add('hidden');
  });

  document.getElementById('settings-volume').addEventListener('input', e => {
    window.audioVolume = parseInt(e.target.value) / 100;
    localStorage.setItem('gs_audio_volume', window.audioVolume);
    const valEl = document.getElementById('settings-volume-val');
    if (valEl) valEl.textContent = `${e.target.value}%`;
    if (window.audioVolume > 0 && window.audioMuted) {
      window.audioMuted = false;
      localStorage.setItem('gs_audio_muted', 'false');
      _updateMuteBtn();
    }
  });

  document.getElementById('settings-mute-btn').addEventListener('click', () => {
    window.audioMuted = !window.audioMuted;
    localStorage.setItem('gs_audio_muted', window.audioMuted);
    _updateMuteBtn();
  });
}

// Animated starfield for menu screens
function initStarField(containerId) {
  const container = document.getElementById(containerId);
  if (!container || container.children.length > 0) return;

  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.className = 'star-particle';
    const size = 1 + Math.random() * 2.5;
    star.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${-Math.random() * 100}%;
      width: ${size}px;
      height: ${size}px;
      animation-duration: ${3 + Math.random() * 8}s;
      animation-delay: ${-Math.random() * 10}s;
      opacity: ${0.3 + Math.random() * 0.7};
    `;
    container.appendChild(star);
  }
}

window.showMainMenu = showMainMenu;
