// ===== SANDBOX CLIENT =====
// Loaded right after utils.js on sandbox.html. Replaces apiFetch so every call
// goes to the real server code running in this page (SandboxServer), and seeds
// a pilot with everything unlocked. No login, no network, no database.
// Add ?reset to the URL to start over.
(function () {
  const NICK = 'PILOTA';
  const S = window.SandboxServer;

  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* blocked */ } }

  if (new URLSearchParams(location.search).has('reset')) {
    try {
      localStorage.removeItem(S.DB_KEY);
      Object.keys(localStorage).filter(k => k.endsWith('_' + NICK)).forEach(k => localStorage.removeItem(k));
    } catch { /* blocked */ }
    history.replaceState(null, '', location.pathname);
    location.reload();
    return;
  }

  safeSet('gs_token', 'sandbox');
  safeSet('gs_nickname', NICK);
  safeSet(`gs_tutorial_done_${NICK}`, '1');
  // A ready-to-play loadout (change it from ABILITÀ → EQUIPAGGIA)
  try {
    if (!localStorage.getItem(`gs_loadout_${NICK}`)) {
      localStorage.setItem(`gs_loadout_${NICK}`, JSON.stringify(['chain_lightning', 'gravity_well', 'nuke']));
    }
  } catch { /* blocked */ }

  const db = S.db;
  let userId = null;
  let seeding = null;

  // Everything unlocked: every ability at max level, every aura, Boss Rush
  // (developer role), and plenty of currency to try crates, wheel and pass.
  async function seed() {
    let { data: u } = await db.from('users').select('id').eq('nickname', NICK).maybeSingle();
    if (!u) {
      const r = await db.from('users').insert({
        nickname: NICK, password_hash: '-', coins: 10000000, gems: 1000000,
        role: 'developer', free_mystery_crates: 5, free_void_crates: 5, free_skin_crates: 5
      }).select('id').single();
      u = r.data;
    }
    userId = u.id;
    const { data: owned } = await db.from('user_abilities').select('ability_id').eq('user_id', userId);
    const have = new Set((owned || []).map(a => a.ability_id));
    for (const id of Object.keys(ABILITIES)) {
      if (ABILITIES[id].boss_rush_only || have.has(id)) continue;
      await db.from('user_abilities').insert({ user_id: userId, ability_id: id, level: 10 });
    }
    const { data: skins } = await db.from('user_skins').select('skin_id').eq('user_id', userId);
    const haveSkin = new Set((skins || []).map(s => s.skin_id));
    for (const id of Object.keys(SKINS)) {
      if (!haveSkin.has(id)) await db.from('user_skins').insert({ user_id: userId, skin_id: id });
    }
    await db.rpc('unlock_achievement', { p_user_id: userId, p_achievement_id: 'tutorial_done' });
  }

  function ensureSeed() { return seeding || (seeding = seed()); }

  async function sandboxFetch(path, options = {}) {
    await ensureSeed();
    const method = (options.method || 'GET').toUpperCase();
    let body = {};
    try { body = options.body ? JSON.parse(options.body) : {}; } catch { /* ignore */ }

    if (path.startsWith('/auth/')) {
      if (path === '/auth/me' || path === '/auth/login' || path === '/auth/register') {
        const { data } = await db.from('users')
          .select('id, nickname, coins, gems, games_played, max_score, max_wave, created_at')
          .eq('id', userId).single();
        if (path === '/auth/me') return { success: true, data };
        safeSet('gs_token', 'sandbox');
        return { success: true, data: { token: 'sandbox', nickname: NICK } };
      }
      if (path === '/auth/account' && method === 'DELETE') {
        try { localStorage.removeItem(S.DB_KEY); } catch { /* blocked */ }
        return { success: true, data: {} };
      }
      return { success: false, error: 'Non disponibile nella sandbox' };
    }
    return S.handle(method, path, body, { userId, nickname: NICK });
  }

  // Embedded viewers (e.g. a shared page) refuse confirm() and return false,
  // which would make "ARRENDITI" do nothing: in a frame, treat it as accepted.
  try { if (window.top !== window) window.confirm = () => true; } catch { window.confirm = () => true; }

  // eslint-disable-next-line no-global-assign
  apiFetch = sandboxFetch;
  window.apiFetch = sandboxFetch;
  window.SANDBOX = true;
})();
