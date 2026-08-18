// ===== UI MODULE =====

let _profileData = null;
let _selectedAbilityForSlot = null;
let _lbType = 'scores';
let _lbFilter = 'all';
let _collFilter = 'all';
let _skinFilter = 'all';
let _brAuraStatus = {};
let _wheelCountdownTimer = null;
let _wheelRotation = 0;
let _wheelSpinning = false;
let _brCountdownTimer = null;

const BR_UNLOCK_DATE = new Date('2026-06-01T00:00:00Z');

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const WHEEL_COOLDOWN_MS = 12 * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

const WHEEL_SEGMENTS = [
  { id: 'coins', label: '🪙<br>COINS' },
  { id: 'gems', label: 'GEMS' },
  { id: 'ability_common', label: 'COMMON<br>ABILITY', cssClass: 'common' },
  { id: 'ability_rare', label: 'RARE<br>ABILITY', cssClass: 'rare' },
  { id: 'ability_epic', label: 'EPIC<br>ABILITY', cssClass: 'epic' },
  { id: 'ability_legendary', label: 'LEGENDARY<br>ABILITY', cssClass: 'legendary' },
  { id: 'crate_mystery', label: '10 GEM<br>CRATE' },
  { id: 'crate_void', label: '150 GEM<br>CRATE' }
];

function showMainMenu() {
  showScreen('menu');
  const nick = getNickname();
  document.getElementById('menu-nickname').textContent = nick || '???';
  updateCurrency();
  refreshWheelStatus();
  updateStreakButton();
  refreshPatchNotesBadge();
  initStarField('menuStars');
  // Refresh season pass mini-panel
  if (window.fetchPassData) {
    window.fetchPassData().then(data => {
      if (data && window.updateMenuPassPanel) window.updateMenuPassPanel(data);
    }).catch(() => {});
  }
}

async function updateCurrency() {
  const res = await apiFetch('/game/profile');
  if (res.success) {
    document.getElementById('menu-coins').textContent = formatNumber(res.data.coins || 0);
    document.getElementById('menu-gems').textContent = formatNumber(res.data.gems || 0);
    _profileData = res.data;
    refreshWheelStatus();
    updateStreakButton();
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
  if (!res.success) { content.innerHTML = `<div class="loading">ERROR: ${escapeHtml(res.error)}</div>`; return; }
  const d = res.data;
  _profileData = d;

  const aCount = (d.abilities || []).length;
  const total = Object.keys(ABILITIES).length;

  const equippedSkin = d.equipped_skin || 'default';
  const skinObj = SKINS[equippedSkin];
  const skinLabel = skinObj ? `${skinObj.emoji} ${skinObj.name}` : '🚀 DEFAULT';
  const skinsOwned = (d.skins || []).length;
  content.innerHTML = `
    <div class="profile-card">
      <h3>PILOT INFO</h3>
      <div class="stat-row"><span>NICKNAME</span><span class="val">${escapeHtml(d.nickname)}</span></div>
      <div class="stat-row"><span>JOINED</span><span class="val">${new Date(d.created_at).toLocaleDateString()}</span></div>
    </div>
    <div class="profile-card">
      <h3>CURRENCY</h3>
      <div class="stat-row"><span>🪙 COINS</span><span class="val">${formatNumber(d.coins)}</span></div>
      <div class="stat-row"><span>💎 GEMS</span><span class="val">${formatNumber(d.gems)}</span></div>
      <div class="stat-row"><span>🎡 WHEEL</span><span class="val">${getWheelStatusLabel(d.wheel_available)}</span></div>
    </div>
    <div class="profile-card">
      <h3>STATS</h3>
      <div class="stat-row"><span>GAMES PLAYED</span><span class="val">${d.games_played}</span></div>
      <div class="stat-row"><span>MAX SCORE</span><span class="val">${formatNumber(d.max_score)}</span></div>
      <div class="stat-row"><span>MAX WAVE</span><span class="val">${d.max_wave}</span></div>
      <div class="stat-row"><span>ABILITÀ</span><span class="val">${aCount}/${Object.values(ABILITIES).filter(a => !a.season_exclusive).length}</span></div>
      <div class="stat-row"><span>CASSE GRATIS</span><span class="val">${(d.free_mystery_crates || 0) + (d.free_void_crates || 0)}</span></div>
      <div class="stat-row"><span>AURE POSSEDUTE</span><span class="val">${skinsOwned}/${Object.values(SKINS).filter(s => !s.season_exclusive && !s.streak_exclusive).length}</span></div>
    </div>
    <div class="profile-card">
      <h3>🌟 AURA EQUIPAGGIATA</h3>
      <div class="stat-row"><span>AURA</span><span class="val" style="color:#ff66cc">${skinLabel}</span></div>
      ${skinObj ? `<div class="stat-row"><span>BOOST</span><span class="val" style="font-size:0.38rem;color:var(--yellow)">${skinObj.description}</span></div>` : ''}
      ${skinObj?.season_exclusive ? `<div class="stat-row"><span style="color:#ff4400">★ SEASON EXCLUSIVE</span><span class="val" style="color:#ff4400">${skinObj.season_tag || 'Season Pass'}</span></div>` : ''}
      ${skinObj?.streak_exclusive ? `<div class="stat-row"><span style="color:#ff6600">🔥 STREAK EXCLUSIVE</span><span class="val" style="color:#ff6600">30 Giorni</span></div>` : ''}
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
      ${ability.season_exclusive ? `<div class="ability-season-tag">${ability.season_tag || 'SEASON PASS'}</div>` : ''}
      ${owned ? `<div class="ability-level">LV ${owned}/10</div>` : ability.season_exclusive ? '<div class="ability-level" style="color:#ff4400">SOLO DAL PASS</div>' : '<div class="ability-level" style="color:#555">BLOCCATA</div>'}
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

    // Click anywhere on card opens ability info popup
    card.addEventListener('click', () => openAbilityInfo(ability, owned || null));

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
  _activeCrateTab('abilities');
  loadCrateShop();
}

async function loadCrateShop() {
  const res = await apiFetch('/game/profile');
  if (res.success) {
    document.getElementById('crates-coins').textContent = formatNumber(res.data.coins || 0);
    document.getElementById('crates-gems').textContent = formatNumber(res.data.gems || 0);
    _profileData = res.data;
    updateCrateDisplay(_selectedCrate);
    updateSkinCrateDisplay(_selectedSkinCrate);
    refreshWheelStatus();
  }
  document.getElementById('crate-result').classList.add('hidden');
  document.getElementById('skin-crate-result').classList.add('hidden');
}

const CRATE_DEFS = {
  mystery: {
    icon: '📦', name: 'MYSTERY CRATE', cost: 10,
    count: 1,
    odds: [
      { cls: 'common',    label: '■ COMMON: 50%' },
      { cls: 'rare',      label: '■ RARE: 30%' },
      { cls: 'epic',      label: '■ EPIC: 15%' },
      { cls: 'legendary', label: '■ LEGENDARY: 5%' }
    ]
  },
  galactic: {
    icon: '🌌', name: 'GALACTIC CRATE', cost: 50,
    count: 2,
    odds: [
      { cls: 'common',    label: '■ COMMON: 20%' },
      { cls: 'rare',      label: '■ RARE: 40%' },
      { cls: 'epic',      label: '■ EPIC: 30%' },
      { cls: 'legendary', label: '■ LEGENDARY: 10%' }
    ]
  },
  void: {
    icon: '🕳️', name: 'VOID CRATE', cost: 150,
    count: 3,
    odds: [
      { cls: 'rare',      label: '■ RARE: 10%' },
      { cls: 'epic',      label: '■ EPIC: 50%' },
      { cls: 'legendary', label: '■ LEGENDARY: 40%' }
    ]
  }
};

let _selectedCrate = 'mystery';
let _selectedSkinCrate = 'stellar';

function _activeCrateTab(tab) {
  document.querySelectorAll('.crate-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.crate-tab-content').forEach(c => c.classList.add('hidden'));
  const btn = document.querySelector(`.crate-tab[data-tab="${tab}"]`);
  const content = document.getElementById(`crate-tab-${tab}`);
  if (btn) btn.classList.add('active');
  if (content) content.classList.remove('hidden');
}

function initCrateHandlers() {
  document.getElementById('open-crate-btn').addEventListener('click', openCrate);

  document.querySelectorAll('.crate-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _activeCrateTab(tab.dataset.tab);
      if (tab.dataset.tab === 'abilities') updateCrateDisplay(_selectedCrate);
      if (tab.dataset.tab === 'skins') updateSkinCrateDisplay(_selectedSkinCrate);
    });
  });

  document.querySelectorAll('.crate-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.crate-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      _selectedCrate = card.dataset.crate;
      updateCrateDisplay(_selectedCrate);
    });
  });

  document.querySelectorAll('.skin-crate-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.skin-crate-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      _selectedSkinCrate = card.dataset.crate;
      updateSkinCrateDisplay(_selectedSkinCrate);
    });
  });

  document.getElementById('open-skin-crate-btn').addEventListener('click', openSkinCrate);
  updateCrateDisplay(_selectedCrate);
  updateSkinCrateDisplay(_selectedSkinCrate);

}


function updateCrateDisplay(type) {
  const def = CRATE_DEFS[type];
  const box = document.getElementById('crate-box');
  const freeCrates = type === 'mystery'
    ? Number(_profileData?.free_mystery_crates || 0)
    : type === 'void'
      ? Number(_profileData?.free_void_crates || 0)
      : 0;

  box.className = `crate-box type-${type}`;

  document.getElementById('selected-crate-icon').textContent = def.icon;
  document.getElementById('selected-crate-name').textContent = def.name;
  document.getElementById('selected-crate-cost').textContent = freeCrates > 0 ? `FREE x${freeCrates} · ${def.cost} 💎` : `${def.cost} 💎`;
  document.getElementById('open-crate-btn').textContent = freeCrates > 0 ? 'OPEN FREE CRATE' : 'OPEN CRATE';

  const info = document.getElementById('crate-info');
  const freeLine = freeCrates > 0 ? `<div class="rarity-chance legendary">★ FREE CRATES AVAILABLE: ${freeCrates}</div>` : '';
  const countLine = def.count > 1 ? `<div class="rarity-chance epic">★ GIVES ${def.count} ABILITIES PER OPEN</div>` : '';
  info.innerHTML = freeLine + countLine + def.odds.map(o => `<div class="rarity-chance ${o.cls}">${o.label}</div>`).join('');

  document.getElementById('crate-result').classList.add('hidden');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateCrateOpening(rarity) {
  const box = document.getElementById('crate-box');
  const flash = document.getElementById('crate-flash-overlay');

  // Store base class so we can restore it
  const baseClass = `crate-box type-${_selectedCrate}`;

  // Phase 1: gentle shake + increasing glow (1.2s suspense)
  box.className = `${baseClass} phase-shake1`;
  await sleep(600);
  box.className = `${baseClass} phase-shake1 phase-glow`;
  await sleep(700);

  // Phase 2: intense shake (1.0s)
  box.className = `${baseClass} phase-shake2 phase-glow`;
  await sleep(1000);

  // Phase 3: burst + screen flash
  box.className = `${baseClass} phase-burst`;
  flash.className = `crate-flash-overlay flash-${rarity}`;
  await sleep(500);

  // Hide crate, reset
  box.style.opacity = '0';
  await sleep(200);
  box.className = baseClass;
  box.style.opacity = '';
}

async function openCrate() {
  const btn = document.getElementById('open-crate-btn');
  btn.textContent = 'OPENING...';
  btn.disabled = true;

  // Fire API immediately so result is ready; animation runs after response arrives
  const resPromise = apiFetch('/game/open-crate', {
    method: 'POST',
    body: JSON.stringify({ crateType: _selectedCrate })
  });

  // Run suspense animation while request is in-flight (or wait for it to finish first)
  const res = await resPromise;

  if (!res.success) {
    btn.textContent = 'OPEN CRATE';
    btn.disabled = false;
    alert(res.error || 'Failed to open crate');
    return;
  }

  const { results, usedFreeCrate } = res.data;

  // Show each ability result one at a time
  for (const item of results) {
    const { abilityId, rarity, level, alreadyOwned, coinsCompensation } = item;

    // Run the suspense animation for this ability
    await animateCrateOpening(rarity);

    // Reveal result
    const ability = ABILITIES[abilityId];
    const resultEl = document.getElementById('crate-result');

    const icon = GameAssets.drawAbilityIcon(abilityId, rarity);
    icon.style.width = '40px'; icon.style.height = '40px';

    resultEl.innerHTML = `<div style="font-size:0.5rem;margin-bottom:0.5rem">${rarity.toUpperCase()}</div>`;
    resultEl.appendChild(icon);
    resultEl.innerHTML += `
      <div style="font-size:0.6rem;margin-top:0.5rem">${ability ? ability.name : abilityId}</div>
      <div style="font-size:0.45rem;margin-top:0.3rem;color:#aaa">
        ${alreadyOwned ? `UPGRADED TO LV ${level}` : 'NEW ABILITY!'}
        ${usedFreeCrate ? '<br>FREE CRATE USED' : ''}
        ${coinsCompensation ? `<br>COMPENSATION: ${formatNumber(coinsCompensation)} COINS` : ''}
      </div>
      <div class="crate-continue-hint">[ PREMI UN TASTO O CLICCA PER CONTINUARE ]</div>
    `;

    // Force browser reflow to restart CSS animation
    resultEl.className = 'crate-result hidden';
    void resultEl.offsetWidth;
    resultEl.className = `crate-result ${rarity}`;

    // Wait for the user to acknowledge the result before continuing
    await new Promise(resolve => {
      const dismiss = () => {
        document.removeEventListener('keydown', dismiss);
        resultEl.removeEventListener('click', dismiss);
        resolve();
      };
      document.addEventListener('keydown', dismiss);
      resultEl.addEventListener('click', dismiss);
    });
  }

  btn.textContent = 'OPEN CRATE';
  btn.disabled = false;

  // Update gem display (also hides the result)
  loadCrateShop();
}

function showLeaderboard() {
  showScreen('leaderboard');
  _lbType = 'scores';
  _lbFilter = 'all';
  document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.lb-tab[data-type="scores"]').classList.add('active');
  document.querySelectorAll('.lb-filter').forEach(f => f.classList.remove('active'));
  const firstFilter = document.querySelector('.lb-filter[data-filter="all"]');
  if (firstFilter) firstFilter.classList.add('active');
  _syncLbTableVisibility();
  loadLeaderboard();
}

function _syncLbTableVisibility() {
  const isBossRush = _lbType === 'boss_rush';
  document.getElementById('lb-table-normal').classList.toggle('hidden', isBossRush);
  document.getElementById('lb-table-boss-rush').classList.toggle('hidden', !isBossRush);
  const filtersEl = document.getElementById('lb-filters-normal');
  if (filtersEl) filtersEl.classList.toggle('hidden', isBossRush);
}

async function loadLeaderboard() {
  if (_lbType === 'boss_rush') {
    return loadBossRushLeaderboard();
  }

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
      <td>${escapeHtml(row.nickname)}</td>
      <td>${val}</td>
      <td>${waveVal}</td>
    </tr>`;
  }).join('');
}

async function loadBossRushLeaderboard() {
  const tbody = document.getElementById('lb-tbody-boss-rush');
  tbody.innerHTML = '<tr><td colspan="4" class="loading">LOADING...</td></tr>';
  const res = await apiFetch('/leaderboard/boss-rush');
  if (!res.success) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">ERROR</td></tr>';
    return;
  }
  const currentNick = getNickname();
  if (!res.data || res.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading">NO DATA</td></tr>';
    return;
  }
  tbody.innerHTML = res.data.map((row, i) => {
    const isCurrent = row.nickname === currentNick;
    const totalSec = Math.floor((row.total_time_ms || 0) / 1000);
    const mm = Math.floor(totalSec / 60).toString().padStart(2,'0');
    const ss = (totalSec % 60).toString().padStart(2,'0');
    return `<tr class="${isCurrent ? 'current-user' : ''}">
      <td>${i+1}</td>
      <td>${escapeHtml(row.nickname)}</td>
      <td>${row.bosses_defeated} 💀</td>
      <td>${mm}:${ss}</td>
    </tr>`;
  }).join('');
}

function initLeaderboardHandlers() {
  document.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _lbType = tab.dataset.type;
      _syncLbTableVisibility();
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
  document.getElementById('btn-play').addEventListener('click', () => {
    openModeSelect();
  });
  document.getElementById('btn-collection').addEventListener('click', showCollection);
  document.getElementById('btn-crates').addEventListener('click', showCrateShop);
  document.getElementById('btn-wheel').addEventListener('click', openWheelOverlay);
  document.getElementById('btn-leaderboard').addEventListener('click', showLeaderboard);
  document.getElementById('btn-logout').addEventListener('click', () => {
    clearToken();
    setNickname('');
    showLoginScreen();
  });

  // Top-right icon buttons
  document.getElementById('btn-topbar-profile').addEventListener('click', showProfile);
  document.getElementById('btn-topbar-settings').addEventListener('click', openSettings);
  document.getElementById('btn-topbar-news').addEventListener('click', openPatchNotes);

  document.getElementById('profile-back').addEventListener('click', showMainMenu);
  document.getElementById('collection-back').addEventListener('click', showMainMenu);
  document.getElementById('crates-back').addEventListener('click', showMainMenu);
  document.getElementById('lb-back').addEventListener('click', showMainMenu);
}

// ===== PATCH NOTES =====
// Bump this when the notes in index.html change: it re-arms the "unread" dot.
const PATCH_NOTES_VERSION = 'v2_8';

function patchNotesSeenKey() {
  return `gs_patchnotes_seen_${PATCH_NOTES_VERSION}`;
}

function refreshPatchNotesBadge() {
  const btn = document.getElementById('btn-topbar-news');
  if (btn) btn.classList.toggle('has-news', !localStorage.getItem(patchNotesSeenKey()));
}

function openPatchNotes() {
  document.getElementById('patchnotes-overlay').classList.remove('hidden');
  localStorage.setItem(patchNotesSeenKey(), '1');
  refreshPatchNotesBadge();
}

function initPatchNotesHandlers() {
  document.getElementById('patchnotes-close').addEventListener('click', () => {
    document.getElementById('patchnotes-overlay').classList.add('hidden');
  });
  refreshPatchNotesBadge();
}

// ===== MODE SELECT =====

function openModeSelect() {
  document.getElementById('mode-select-overlay').classList.remove('hidden');
  _updateBossRushLock();
  _startBRCountdown();
}

function closeModeSelect() {
  document.getElementById('mode-select-overlay').classList.add('hidden');
  _stopBRCountdown();
}

function _isBossRushUnlocked() {
  const dateUnlocked = Date.now() >= BR_UNLOCK_DATE.getTime();
  const isDeveloper = _profileData && _profileData.role === 'developer';
  return dateUnlocked || isDeveloper;
}

function _updateBossRushLock() {
  const lockEl  = document.getElementById('boss-rush-lock');
  const btnEl   = document.getElementById('mode-btn-boss-rush');
  const cardEl  = document.getElementById('mode-card-boss-rush');
  if (_isBossRushUnlocked()) {
    if (lockEl) lockEl.classList.add('hidden');
    if (btnEl)  btnEl.classList.remove('hidden');
    if (cardEl) cardEl.classList.remove('mode-card--locked');
  } else {
    if (lockEl) lockEl.classList.remove('hidden');
    if (btnEl)  btnEl.classList.add('hidden');
    if (cardEl) cardEl.classList.add('mode-card--locked');
  }
}

function _startBRCountdown() {
  _stopBRCountdown();
  function tick() {
    const el = document.getElementById('br-countdown');
    if (!el) return;
    const diff = BR_UNLOCK_DATE.getTime() - Date.now();
    if (diff <= 0) {
      el.textContent = 'UNLOCKED!';
      _updateBossRushLock();
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = d > 0
      ? `${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`
      : `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  tick();
  _brCountdownTimer = setInterval(tick, 1000);
}

function _stopBRCountdown() {
  if (_brCountdownTimer) { clearInterval(_brCountdownTimer); _brCountdownTimer = null; }
}

function initModeSelectHandlers() {
  document.getElementById('mode-select-close').addEventListener('click', closeModeSelect);

  document.getElementById('mode-btn-normal').addEventListener('click', async () => {
    closeModeSelect();
    const res = await apiFetch('/game/profile');
    const ownedAbilityIds = res.success ? (res.data.abilities || []).map(a => a.ability_id) : [];
    const equippedSkin    = res.success ? (res.data.equipped_skin || 'default') : 'default';
    const skinBoosts      = getEquippedSkinBoosts(equippedSkin);
    const skinColor       = SKINS[equippedSkin]?.color || null;
    const skinTrail       = getEquippedSkinTrail(equippedSkin);
    const skinStripes     = getEquippedSkinStripes(equippedSkin);
    showScreen('game');
    startGame([null, null, null], ownedAbilityIds, skinBoosts, skinColor, skinTrail, skinStripes);
  });

  document.getElementById('mode-btn-boss-rush').addEventListener('click', async () => {
    if (!_isBossRushUnlocked()) return;
    closeModeSelect();
    const res = await apiFetch('/game/profile');
    const equippedSkin = res.success ? (res.data.equipped_skin || 'default') : 'default';
    const skinBoosts   = getEquippedSkinBoosts(equippedSkin);
    const skinColor    = SKINS[equippedSkin]?.color || null;
    const skinTrail    = getEquippedSkinTrail(equippedSkin);
    const skinStripes  = getEquippedSkinStripes(equippedSkin);
    showScreen('game');
    startBossRush(skinBoosts, skinColor, skinTrail, skinStripes);
  });
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
    if (window.syncBackgroundMusic) window.syncBackgroundMusic();
  });

  document.getElementById('settings-mute-btn').addEventListener('click', () => {
    window.audioMuted = !window.audioMuted;
    localStorage.setItem('gs_audio_muted', window.audioMuted);
    _updateMuteBtn();
    if (window.syncBackgroundMusic) window.syncBackgroundMusic();
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

// ===== TUTORIAL =====

const TUTORIAL_SLIDES = [
  {
    emoji: '🚀',
    title: 'WELCOME, PILOT!',
    body: 'Welcome to Galactic Shooter — Vortex Edition!\nYou are the last defender of the galaxy.\nSurvive endless waves of alien enemies\nand become a legend!'
  },
  {
    emoji: '🕹️',
    title: 'CONTROLS',
    body: 'MOVE: joystick (bottom-left) or arrow keys\nSHOOT: automatic — just move!\nFIRE BUTTON: hold for rapid fire\nQ / W / E: activate equipped abilities\nOn desktop, use WASD or arrows to move.'
  },
  {
    emoji: '👾',
    title: 'ENEMIES & WAVES',
    body: 'Enemies spawn every few seconds.\nEach wave is stronger than the last.\nEvery 10 waves a BOSS appears!\nKill enemies to earn score and currency.\nSurvive as many waves as you can!'
  },
  {
    emoji: '⚡',
    title: 'ABILITIES & CRATES',
    body: 'Open CRATES with 💎 Gems to unlock abilities.\nAssign abilities to slots Q / W / E\nfrom your COLLECTION.\nUse abilities in battle for massive power!\nUpgrade abilities with 🪙 Coins.'
  },
  {
    emoji: '💰',
    title: 'CURRENCY',
    body: '🪙 COINS: earned from score — upgrade abilities.\n💎 GEMS: dropped by enemies & bosses.\n   Earn more by reaching higher waves!\n   Use gems to open crates and unlock\n   powerful new abilities.'
  },
  {
    emoji: '🎁',
    title: 'STARTER GIFT!',
    body: "You're ready to fight!\nAs a welcome gift, here's your starter pack:",
    reward: '🪙 1,000 COINS\n💎 10 GEMS'
  }
];

let _tutorialSlide = 0;

function initTutorialHandlers() {
  document.getElementById('tutorial-next').addEventListener('click', () => {
    if (_tutorialSlide < TUTORIAL_SLIDES.length - 1) {
      _tutorialSlide++;
      renderTutorialSlide();
    } else {
      completeTutorial();
    }
  });

  document.getElementById('tutorial-prev').addEventListener('click', () => {
    if (_tutorialSlide > 0) {
      _tutorialSlide--;
      renderTutorialSlide();
    }
  });

  document.getElementById('tutorial-skip').addEventListener('click', completeTutorial);
}

function renderTutorialSlide() {
  const slide = TUTORIAL_SLIDES[_tutorialSlide];
  const area = document.getElementById('tutorial-slide-area');
  const isLast = _tutorialSlide === TUTORIAL_SLIDES.length - 1;

  area.innerHTML = `
    <div class="tutorial-slide-emoji">${slide.emoji}</div>
    <div class="tutorial-slide-title">${slide.title}</div>
    <div class="tutorial-slide-body">${slide.body.replace(/\n/g, '<br>')}</div>
    ${slide.reward ? `<div class="tutorial-slide-reward">${slide.reward.replace(/\n/g, '<br>')}</div>` : ''}
  `;

  // Update dots
  const dotsEl = document.getElementById('tutorial-dots');
  dotsEl.innerHTML = TUTORIAL_SLIDES.map((_, i) =>
    `<div class="tutorial-dot ${i === _tutorialSlide ? 'active' : ''}"></div>`
  ).join('');

  // Update buttons
  document.getElementById('tutorial-prev').style.visibility = _tutorialSlide === 0 ? 'hidden' : '';
  const nextBtn = document.getElementById('tutorial-next');
  nextBtn.textContent = isLast ? 'CLAIM REWARD ★' : 'NEXT ▶';
  nextBtn.className = isLast ? 'btn btn-yellow tutorial-nav-btn' : 'btn btn-cyan tutorial-nav-btn';
}

async function completeTutorial() {
  document.getElementById('tutorial-overlay').classList.add('hidden');

  const key = `gs_tutorial_done_${getNickname()}`;
  localStorage.setItem(key, '1');

  const res = await apiFetch('/game/claim-tutorial-reward', { method: 'POST', body: '{}' });
  if (res.success) {
    if (_profileData) {
      _profileData.achievements = _profileData.achievements || [];
      if (!_profileData.achievements.some(a => a.achievement_id === 'tutorial_done')) {
        _profileData.achievements.push({ achievement_id: 'tutorial_done', unlocked_at: new Date().toISOString() });
      }
    }
    updateCurrency();
    alert('🎉 WELCOME GIFT RECEIVED!\n🪙 +1,000 COINS\n💎 +10 GEMS\n\nGood luck, pilot!');
  }

  if (window.maybeShowSeasonIntro) await window.maybeShowSeasonIntro();
}

// Returns true when the tutorial was shown.
async function maybeShowTutorial() {
  const key = `gs_tutorial_done_${getNickname()}`;
  if (localStorage.getItem(key)) return false;

  let profile = _profileData;
  if (!profile || !Array.isArray(profile.achievements)) {
    const res = await apiFetch('/game/profile');
    if (res.success) {
      profile = res.data;
      _profileData = res.data;
    }
  }

  const alreadyCompleted = (profile?.achievements || []).some(a => a.achievement_id === 'tutorial_done');
  if (alreadyCompleted) {
    localStorage.setItem(key, '1');
    return false;
  }

  _tutorialSlide = 0;
  renderTutorialSlide();
  document.getElementById('tutorial-overlay').classList.remove('hidden');
  return true;
}

// Everything that greets a player right after they reach the menu. The two
// overlays must not stack: a brand-new pilot does the tutorial first and meets
// the season straight after claiming the welcome gift.
async function runWelcomeFlow() {
  const tutorialShown = await maybeShowTutorial();
  if (tutorialShown) return;
  if (window.maybeShowSeasonIntro) await window.maybeShowSeasonIntro();
}

function getWheelAvailability(profile = _profileData) {
  const availability = profile?.wheel_available;
  if (availability && typeof availability.canSpin === 'boolean') {
    const nextSpinAt = availability.nextSpinAt ? new Date(availability.nextSpinAt) : null;
    const remainingMs = nextSpinAt ? Math.max(0, nextSpinAt.getTime() - Date.now()) : 0;
    return { canSpin: remainingMs <= 0 || availability.canSpin, nextSpinAt: availability.nextSpinAt, remainingMs };
  }

  if (!profile?.last_wheel_spin_at) return { canSpin: true, nextSpinAt: null, remainingMs: 0 };

  const nextSpinAt = new Date(new Date(profile.last_wheel_spin_at).getTime() + WHEEL_COOLDOWN_MS);
  const remainingMs = Math.max(0, nextSpinAt.getTime() - Date.now());
  return { canSpin: remainingMs <= 0, nextSpinAt: nextSpinAt.toISOString(), remainingMs };
}

function formatWheelCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / MS_PER_SECOND));
  const hours = Math.floor(totalSeconds / (SECONDS_PER_MINUTE * MINUTES_PER_HOUR));
  const minutes = Math.floor((totalSeconds % (SECONDS_PER_MINUTE * MINUTES_PER_HOUR)) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (hours > 0) return `${hours}H ${String(minutes).padStart(2, '0')}M`;
  return `${minutes}M ${String(seconds).padStart(2, '0')}S`;
}

function getWheelStatusLabel(availability) {
  if (!availability || availability.canSpin) return 'READY';
  return formatWheelCountdown(availability.remainingMs || 0);
}

function refreshWheelStatus() {
  const availability = getWheelAvailability();
  const buttonStatus = document.getElementById('wheel-button-status');
  const status = document.getElementById('wheel-status');
  const spinBtn = document.getElementById('wheel-spin-btn');

  if (buttonStatus) {
    buttonStatus.textContent = availability.canSpin ? 'READY NOW' : `IN ${formatWheelCountdown(availability.remainingMs)}`;
  }

  if (status) {
    status.innerHTML = availability.canSpin
      ? 'Spin available now.<br>8 rewards with common and rare drops.'
      : `Next spin available in<br>${formatWheelCountdown(availability.remainingMs)}`;
  }

  if (spinBtn && !_wheelSpinning) {
    spinBtn.disabled = !availability.canSpin;
    spinBtn.textContent = availability.canSpin ? 'SPIN NOW' : `WAIT ${formatWheelCountdown(availability.remainingMs)}`;
  }
}

function renderWheelSegments() {
  const wheel = document.getElementById('fortune-wheel');
  if (!wheel || wheel.dataset.ready === '1') return;

  wheel.innerHTML = '';
  WHEEL_SEGMENTS.forEach((segment, index) => {
    const label = document.createElement('div');
    label.className = `wheel-segment-label ${segment.cssClass || ''}`.trim();
    label.innerHTML = segment.label;
    const angle = index * 45 + 22.5;
    label.style.transform = `rotate(${angle}deg) translateY(-106px) rotate(${-angle}deg)`;
    wheel.appendChild(label);
  });

  wheel.dataset.ready = '1';
}

async function refreshWheelProfile() {
  const res = await apiFetch('/game/profile');
  if (res.success) {
    _profileData = res.data;
    document.getElementById('menu-coins').textContent = formatNumber(res.data.coins || 0);
    document.getElementById('menu-gems').textContent = formatNumber(res.data.gems || 0);
    refreshWheelStatus();
  }
  return res;
}

function openWheelOverlay() {
  renderWheelSegments();
  document.getElementById('wheel-result').classList.add('hidden');
  document.getElementById('wheel-overlay').classList.remove('hidden');
  refreshWheelProfile();
}

function closeWheelOverlay() {
  if (_wheelSpinning) return;
  document.getElementById('wheel-overlay').classList.add('hidden');
}

function renderWheelRewardResult(reward) {
  const resultEl = document.getElementById('wheel-result');
  let meta = '';

  if (reward.kind === 'ability') {
    meta = reward.maxedOut
      ? `Converted to ${formatNumber(reward.coinsCompensation || 0)} coins`
      : reward.alreadyOwned
        ? `Ability upgraded to LV ${reward.level}`
        : `Unlocked ${reward.abilityId?.replace(/_/g, ' ').toUpperCase()}!`;
  } else if (reward.kind === 'crate') {
    meta = `Free ${reward.crateType.toUpperCase()} crate added to your inventory`;
  } else if (reward.amount) {
    meta = `Added ${formatNumber(reward.amount)} to your account`;
  }

  resultEl.innerHTML = `
    <div class="wheel-result-title">${reward.title}</div>
    <div class="wheel-result-body">${reward.description}</div>
    <div class="wheel-result-meta">${meta}</div>
  `;
  resultEl.classList.remove('hidden');
}

async function spinWheel() {
  if (_wheelSpinning) return;

  const spinBtn = document.getElementById('wheel-spin-btn');
  const wheel = document.getElementById('fortune-wheel');
  const resultEl = document.getElementById('wheel-result');
  resultEl.classList.add('hidden');

  _wheelSpinning = true;
  spinBtn.disabled = true;
  spinBtn.textContent = 'SPINNING...';

  const res = await apiFetch('/game/spin-wheel', { method: 'POST', body: '{}' });
  if (!res.success) {
    _wheelSpinning = false;
    await refreshWheelProfile();
    alert(res.error || 'Wheel spin failed');
    return;
  }

  const segmentIndex = Math.max(0, WHEEL_SEGMENTS.findIndex(segment => segment.id === res.data.segmentId));
  const centerAngle = segmentIndex * 45 + 22.5;
  const extraRotation = 360 * 6 + (360 - centerAngle);
  _wheelRotation += extraRotation;
  wheel.style.transform = `rotate(${_wheelRotation}deg)`;

  await sleep(4600);
  renderWheelRewardResult(res.data.reward);
  if (window.Sounds?.levelup) Sounds.levelup();

  _wheelSpinning = false;
  await refreshWheelProfile();
  if (document.getElementById('screen-crates').classList.contains('active')) {
    updateCrateDisplay(_selectedCrate);
    updateSkinCrateDisplay(_selectedSkinCrate);
  }
}

function initWheelHandlers() {
  renderWheelSegments();
  refreshWheelStatus();

  if (!_wheelCountdownTimer) {
    _wheelCountdownTimer = setInterval(refreshWheelStatus, 1000);
  }

  document.getElementById('wheel-spin-btn').addEventListener('click', spinWheel);
  document.getElementById('wheel-close').addEventListener('click', closeWheelOverlay);
  document.getElementById('wheel-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('wheel-overlay')) closeWheelOverlay();
  });
}

// ===== ABILITY INFO POPUP =====

function openAbilityInfo(ability, ownedLevel) {
  const box = document.getElementById('ability-info-box');
  if (box) {
    box.className = `ability-info-box ${ability.rarity}`;
  }

  document.getElementById('ability-info-rarity').textContent = ability.rarity.toUpperCase();
  document.getElementById('ability-info-rarity').className = `ability-info-rarity ${ability.rarity}`;
  document.getElementById('ability-info-name').textContent = ability.name;
  document.getElementById('ability-info-desc').textContent = ability.description;

  const levelEl = document.getElementById('ability-info-level');
  if (ability.season_exclusive && !ownedLevel) {
    levelEl.textContent = `${ability.season_tag || 'SEASON PASS'} — Esclusiva, riscatta dal PASS`;
    levelEl.style.color = '#ff4400';
  } else {
    levelEl.textContent = ownedLevel ? `LEVEL ${ownedLevel} / 10` : '🔒 BLOCCATA — APRI CASSE PER SBLOCCARE';
    levelEl.style.color = ownedLevel ? 'var(--yellow)' : '#555577';
  }

  const iconWrap = document.getElementById('ability-info-icon-wrap');
  iconWrap.innerHTML = '';
  const icon = GameAssets.drawAbilityIcon(ability.id, ability.rarity);
  icon.style.width = '56px'; icon.style.height = '56px';
  iconWrap.appendChild(icon);

  document.getElementById('ability-info-overlay').classList.remove('hidden');
}

function initAbilityInfoHandlers() {
  document.getElementById('ability-info-close').addEventListener('click', () => {
    document.getElementById('ability-info-overlay').classList.add('hidden');
  });
  document.getElementById('ability-info-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('ability-info-overlay')) {
      document.getElementById('ability-info-overlay').classList.add('hidden');
    }
  });
}

// ===== SKINS =====

function showSkins() {
  showScreen('skins');
  loadSkins();
}

function _activeSkinTab(tab) {
  document.querySelectorAll('.skin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.skin-tab-content').forEach(c => c.classList.add('hidden'));
  const btn = document.querySelector(`.skin-tab[data-tab="${tab}"]`);
  const content = document.getElementById(`skin-tab-${tab}`);
  if (btn) btn.classList.add('active');
  if (content) content.classList.remove('hidden');
}

async function loadSkins() {
  const res = await apiFetch('/game/profile');
  if (res.success) {
    _profileData = res.data;
    document.getElementById('skins-coins').textContent = formatNumber(res.data.coins || 0);
    document.getElementById('skins-gems').textContent  = formatNumber(res.data.gems  || 0);
  }
  renderSkinGrid();
}

function renderSkinGrid() {
  const grid = document.getElementById('skin-grid');
  if (!grid) return;
  const owned     = new Set(_profileData?.skins || []);
  const equipped  = _profileData?.equipped_skin || 'default';

  let all = Object.values(SKINS);

  // Apply Boss Rush filter
  if (_skinFilter === 'boss_rush') {
    all = all.filter(s => s.boss_rush_exclusive);
  }

  grid.innerHTML = '';

  // Default skin card (only show in 'all' filter)
  if (_skinFilter === 'all') {
    const defCard = document.createElement('div');
    defCard.className = `skin-card common ${equipped === 'default' ? 'equipped' : ''}`;
    defCard.innerHTML = `
      <div class="skin-rarity-tag">DEFAULT</div>
      <div class="skin-emoji">🚀</div>
      <div class="skin-name">DEFAULT</div>
      <div class="skin-desc" style="color:#555">No boost</div>
      ${equipped === 'default'
        ? '<div class="skin-equipped-label">✓ EQUIPAGGIATA</div>'
        : '<button class="skin-equip-btn" data-skin="default">EQUIP</button>'}
    `;
    if (equipped !== 'default') {
      defCard.querySelector('.skin-equip-btn').addEventListener('click', e => {
        e.stopPropagation(); equipSkin('default');
      });
    }
    grid.appendChild(defCard);
  }

  for (const skin of all) {
    const isOwned    = owned.has(skin.id);
    const isEquipped = equipped === skin.id;
    const card = document.createElement('div');
    card.className = `skin-card ${skin.rarity} ${isOwned ? '' : 'locked'} ${isEquipped ? 'equipped' : ''}`;

    const boostLines = [];
    if (skin.boost.coins_mult > 1)      boostLines.push(`🪙 ×${skin.boost.coins_mult.toFixed(2)}`);
    if (skin.boost.gems_mult  > 1)      boostLines.push(`💎 ×${skin.boost.gems_mult.toFixed(2)}`);
    if (skin.boost.score_mult > 1)      boostLines.push(`⭐ ×${skin.boost.score_mult.toFixed(2)}`);
    if (skin.boost.extra_lives > 0)     boostLines.push(`❤️ +${skin.boost.extra_lives} ${skin.boost.extra_lives === 1 ? 'life' : 'lives'}`);
    if (skin.boost.starting_shield)     boostLines.push(`🛡️ Start shielded`);

    let lockLabel = '<div class="skin-locked-label">🔒 BLOCCATA</div>';
    if (skin.boss_rush_exclusive) {
      const obj = skin.unlock_objective || 'Obiettivo Boss Rush';
      lockLabel = `<div class="skin-locked-label br-lock-label-card" title="${obj}">🔒 <span class="br-lock-obj">${obj}</span></div>`;
    } else if (skin.season_exclusive) {
      lockLabel = '<div class="skin-locked-label">★ SOLO DAL PASS</div>';
    } else if (skin.streak_exclusive) {
      lockLabel = '<div class="skin-locked-label">🔥 STREAK 30 GIORNI</div>';
    }

    // Flag skins get the CSS tricolore: the 🇮🇹 emoji has no glyph on Windows.
    const skinIcon = skin.stripes ? '<span class="it-flag"></span>' : skin.emoji;

    card.innerHTML = `
      <div class="skin-rarity-tag">${skin.rarity.toUpperCase()}</div>
      <div class="skin-emoji">${skinIcon}</div>
      <div class="skin-name">${skin.name}</div>
      <div class="skin-desc">${skin.description}</div>
      <div class="skin-boosts">${boostLines.join(' · ')}</div>
      ${skin.season_exclusive ? `<div class="skin-season-tag">${skin.season_tag || 'SEASON PASS'}</div>` : ''}
      ${skin.streak_exclusive ? '<div class="skin-season-tag" style="color:#ff6600;border-color:#ff6600">🔥 STREAK EXCLUSIVE</div>' : ''}
      ${skin.boss_rush_exclusive ? '<div class="skin-season-tag skin-br-tag">⚡ BOSS RUSH</div>' : ''}
      ${isOwned
        ? isEquipped
          ? '<div class="skin-equipped-label">✓ EQUIPAGGIATA</div>'
          : `<button class="skin-equip-btn" data-skin="${skin.id}">EQUIP</button>`
        : lockLabel}
    `;

    if (isOwned && !isEquipped) {
      card.querySelector('.skin-equip-btn').addEventListener('click', e => {
        e.stopPropagation(); equipSkin(skin.id);
      });
    }
    grid.appendChild(card);
  }
}

function initSkinFilterHandlers() {
  document.querySelectorAll('.skin-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.skin-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _skinFilter = btn.dataset.filter;
      renderSkinGrid();
    });
  });
}

async function equipSkin(skinId) {
  const res = await apiFetch('/game/equip-skin', {
    method: 'POST',
    body: JSON.stringify({ skinId })
  });
  if (res.success) {
    if (_profileData) _profileData.equipped_skin = res.data.equipped_skin;
    renderSkinGrid();
    updateCurrency();
  } else {
    alert(res.error || 'Failed to equip skin');
  }
}

function updateSkinCrateDisplay(type) {
  const def = SKIN_CRATE_DEFS[type];
  if (!def) return;

  const box = document.getElementById('skin-crate-box');
  if (box) box.className = `skin-crate-box type-${type}`;

  const iconEl  = document.getElementById('skin-crate-box-icon');
  const labelEl = document.getElementById('skin-crate-box-label');
  const costEl  = document.getElementById('skin-crate-box-cost');

  if (iconEl)  iconEl.textContent  = def.icon;
  if (labelEl) labelEl.textContent = def.name;

  const freeCrates = Number(_profileData?.free_skin_crates || 0);
  if (costEl) {
    costEl.textContent = freeCrates > 0
      ? `FREE x${freeCrates} · ${def.costCoins}🪙 + ${def.costGems}💎`
      : `${def.costCoins}🪙 + ${def.costGems}💎`;
  }

  const openBtn = document.getElementById('open-skin-crate-btn');
  if (openBtn) openBtn.textContent = freeCrates > 0 ? 'APRI AURA GRATUITA' : 'APRI CASSA AURA';

  const info = document.getElementById('skin-crate-info');
  if (info) {
    const freeLine = freeCrates > 0 ? `<div class="rarity-chance legendary">★ FREE SKIN CRATES: ${freeCrates}</div>` : '';
    info.innerHTML = freeLine + def.odds.map(o => `<div class="rarity-chance ${o.cls}">${o.label}</div>`).join('');
  }

  const resultEl = document.getElementById('skin-crate-result');
  if (resultEl) resultEl.classList.add('hidden');
}

async function openSkinCrate() {
  const btn = document.getElementById('open-skin-crate-btn');
  btn.textContent = 'OPENING...';
  btn.disabled = true;

  const res = await apiFetch('/game/open-skin-crate', {
    method: 'POST',
    body: JSON.stringify({ crateType: _selectedSkinCrate })
  });

  if (!res.success) {
    btn.textContent = 'APRI CASSA AURA';
    btn.disabled = false;
    alert(res.error || 'Failed to open aura crate');
    return;
  }

  const { skinId, rarity, skinName, alreadyOwned, coinsCompensation, usedFreeCrate } = res.data;

  // Flash animation
  const flash = document.getElementById('skin-crate-flash');
  if (flash) {
    flash.className = `crate-flash-overlay flash-${rarity}`;
    await sleep(600);
    flash.className = 'crate-flash-overlay hidden';
  }

  const skin = SKINS[skinId];
  const resultEl = document.getElementById('skin-crate-result');

  resultEl.innerHTML = `
    <div class="skin-result-rarity ${rarity}">${rarity.toUpperCase()}</div>
    <div class="skin-result-emoji">${skin?.emoji || '🎨'}</div>
    <div class="skin-result-name">${skinName}</div>
    <div class="skin-result-desc">${skin?.description || ''}</div>
    <div style="font-size:0.4rem;margin-top:0.4rem;color:#aaa">
      ${alreadyOwned ? `Already owned — +${formatNumber(coinsCompensation)} coins compensation` : '🎉 NUOVA AURA SBLOCCATA!'}
      ${usedFreeCrate ? '<br>FREE CRATE USED' : ''}
    </div>
    <div class="crate-continue-hint">[ TAP TO CONTINUE ]</div>
  `;

  resultEl.className = 'skin-crate-result hidden';
  void resultEl.offsetWidth;
  resultEl.className = `skin-crate-result ${rarity}`;

  await new Promise(resolve => {
    const dismiss = () => {
      document.removeEventListener('keydown', dismiss);
      resultEl.removeEventListener('click', dismiss);
      resolve();
    };
    document.addEventListener('keydown', dismiss);
    resultEl.addEventListener('click', dismiss);
  });

  btn.textContent = 'APRI CASSA AURA';
  btn.disabled = false;
  loadCrateShop();
}

function initSkinHandlers() {
  document.getElementById('skins-back').addEventListener('click', showMainMenu);
  document.getElementById('btn-skins').addEventListener('click', showSkins);
}

// ===== DAILY STREAK SYSTEM =====

let _streakData = null;

function initStreakHandlers() {
  document.getElementById('btn-streak').addEventListener('click', openStreakOverlay);
  document.getElementById('streak-close').addEventListener('click', closeStreakOverlay);
  document.getElementById('streak-claim-btn').addEventListener('click', claimStreak);
}

function openStreakOverlay() {
  const overlay = document.getElementById('streak-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('streak-result').classList.add('hidden');
  refreshStreakUI();
}

function closeStreakOverlay() {
  document.getElementById('streak-overlay').classList.add('hidden');
}

function refreshStreakUI() {
  if (!_profileData || !_profileData.streak) return;
  const streak = _profileData.streak;
  _streakData = streak;

  const current = streak.current || 0;
  const dayInCycle = current === 0 ? 0 : (((current - 1) % 30) + 1);
  document.getElementById('streak-day-num').textContent = current;
  document.getElementById('streak-progress-bar').style.width = `${(dayInCycle / 30) * 100}%`;
  document.getElementById('streak-progress-label').textContent = `${dayInCycle} / 30`;

  // Build rewards grid (show milestone days)
  const grid = document.getElementById('streak-rewards-grid');
  const milestones = [1, 4, 7, 10, 14, 15, 20, 21, 24, 25, 27, 28, 30];
  grid.innerHTML = streak.allRewards
    .filter(r => milestones.includes(r.day))
    .map(r => {
      const claimed = current >= r.day;
      const isNext = r.day === streak.rewardDay;
      let icon = '🪙';
      if (r.type === 'gems') icon = '💎';
      else if (r.type === 'ability') icon = '⚡';
      else if (r.type === 'skin') icon = '🔥';
      let label = '';
      if (r.type === 'coins') label = `${r.amount}`;
      else if (r.type === 'gems') label = `${r.amount}`;
      else if (r.type === 'ability') label = r.rarity.toUpperCase();
      else if (r.type === 'skin') label = 'AURA';
      return `<div class="streak-reward-cell ${claimed ? 'claimed' : ''} ${isNext ? 'next' : ''}">
        <div class="streak-reward-day">G${r.day}</div>
        <div class="streak-reward-icon">${icon}</div>
        <div class="streak-reward-label">${label}</div>
      </div>`;
    }).join('');

  // Next reward preview
  const nextRewardEl = document.getElementById('streak-next-reward');
  const nr = streak.nextReward;
  let nrText = '';
  if (nr.type === 'coins') nrText = `Prossimo: 🪙 +${nr.amount} coins`;
  else if (nr.type === 'gems') nrText = `Prossimo: 💎 +${nr.amount} gems`;
  else if (nr.type === 'ability') nrText = `Prossimo: ⚡ Abilità ${nr.rarity.toUpperCase()}`;
  else if (nr.type === 'skin') nrText = `Prossimo: 🔥 AURA LEGGENDARIA ESCLUSIVA`;
  nextRewardEl.textContent = nrText;

  // Claim button state
  const claimBtn = document.getElementById('streak-claim-btn');
  if (streak.canClaim) {
    claimBtn.textContent = 'RISCUOTI';
    claimBtn.disabled = false;
    claimBtn.classList.remove('btn-ghost');
    claimBtn.classList.add('btn-yellow');
  } else {
    claimBtn.textContent = '✓ GIÀ RISCOSSO OGGI';
    claimBtn.disabled = true;
    claimBtn.classList.remove('btn-yellow');
    claimBtn.classList.add('btn-ghost');
  }
}

async function claimStreak() {
  const btn = document.getElementById('streak-claim-btn');
  btn.textContent = '...';
  btn.disabled = true;

  const res = await apiFetch('/game/claim-streak', { method: 'POST' });

  if (!res.success) {
    btn.textContent = res.error || 'ERRORE';
    btn.disabled = true;
    return;
  }

  // Show result
  const resultEl = document.getElementById('streak-result');
  resultEl.classList.remove('hidden');
  resultEl.innerHTML = `
    <div class="streak-result-content">
      <div class="streak-result-day">GIORNO ${res.data.streakDay} 🔥</div>
      <div class="streak-result-reward">${res.data.description}</div>
    </div>
  `;

  btn.textContent = '✓ GIÀ RISCOSSO OGGI';
  btn.disabled = true;
  btn.classList.remove('btn-yellow');
  btn.classList.add('btn-ghost');

  // Refresh profile data
  updateCurrency();
}

function updateStreakButton() {
  const statusEl = document.getElementById('streak-button-status');
  if (!statusEl) return;
  if (_profileData && _profileData.streak && _profileData.streak.canClaim) {
    statusEl.textContent = '● DISPONIBILE';
    statusEl.style.color = '#00ff88';
  } else {
    statusEl.textContent = '';
  }
}
