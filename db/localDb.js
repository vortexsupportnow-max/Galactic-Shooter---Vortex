'use strict';

// ===== LOCAL DATABASE (offline / localhost mode) =====
//
// A tiny stand-in for the Supabase client, so the whole game — accounts,
// crates, skins, season pass, leaderboards — runs on a laptop with no cloud
// database. Data lives in memory and is saved to a JSON file after each write.
//
// It implements only the slice of the supabase-js query builder this app uses:
//   from(t).select(cols).eq(c, v).in(c, list).limit(n)
//          .single() / .maybeSingle()
//          .insert(row|rows) / .update(patch) / .delete() / .upsert(row, {onConflict})
//   rpc(name, args) for the SQL functions defined in db/schema.sql
//
// Never use this in production: it is single-process and has no access control.

const fs = require('fs');
const path = require('path');

// Column defaults mirroring db/schema.sql
const DEFAULTS = {
  users: () => ({
    coins: 0, gems: 0, games_played: 0, max_score: 0, max_wave: 0,
    last_wheel_spin_at: null, free_mystery_crates: 0, free_void_crates: 0,
    equipped_skin: 'default', free_skin_crates: 0, streak_current: 0,
    streak_last_claim: null, role: 'player', recovery_hash: null,
    created_at: new Date().toISOString()
  }),
  user_abilities: () => ({ level: 1 }),
  scores: () => ({ enemies_killed: 0, created_at: new Date().toISOString() }),
  achievements: () => ({ unlocked_at: new Date().toISOString() }),
  user_skins: () => ({}),
  user_season_pass: () => ({
    season_id: 'italy_s2', pulsar: 0, claimed_tiers: [],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }),
  user_mission_progress: () => ({ progress: 0, completed: false, reward_claimed: false, updated_at: new Date().toISOString() }),
  boss_rush_scores: () => ({ bosses_defeated: 0, total_time_ms: 0, score: 0, created_at: new Date().toISOString() }),
  boss_rush_stats: () => ({
    total_bosses_killed: 0, total_runs: 0, no_ability_runs: 0, no_hit_phase2_count: 0,
    fastest_boss_streak: 0, boss_kill_counts: {}, updated_at: new Date().toISOString()
  })
};

// Unique constraints (column lists). Nicknames are unique case-insensitively.
const UNIQUE = {
  users: [['nickname']],
  user_abilities: [['user_id', 'ability_id']],
  achievements: [['user_id', 'achievement_id']],
  user_skins: [['user_id', 'skin_id']],
  user_season_pass: [['user_id', 'season_id']],
  user_mission_progress: [['user_id', 'mission_id']],
  boss_rush_stats: [['user_id']]
};

const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function keyOf(row, cols, table) {
  return cols.map(c => {
    const v = row[c];
    return table === 'users' && c === 'nickname' && typeof v === 'string' ? v.toLowerCase() : String(v);
  }).join('\u0000');
}

class LocalStore {
  constructor(file) {
    this.file = file;
    this.data = { tables: {}, seq: {} };
    if (file && fs.existsSync(file)) {
      try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
        console.warn(`[local-db] could not read ${file}, starting empty: ${e.message}`);
      }
    }
    this._saveTimer = null;
  }

  table(name) {
    if (!this.data.tables[name]) this.data.tables[name] = [];
    return this.data.tables[name];
  }

  nextId(name) {
    this.data.seq[name] = (this.data.seq[name] || 0) + 1;
    return this.data.seq[name];
  }

  save() {
    if (!this.file) return;
    // Coalesce bursts of writes into one disk write
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        fs.writeFileSync(this.file, JSON.stringify(this.data));
      } catch (e) {
        console.warn(`[local-db] save failed: ${e.message}`);
      }
    }, 50);
  }

  violatesUnique(table, row, ignore) {
    for (const cols of UNIQUE[table] || []) {
      const k = keyOf(row, cols, table);
      if (this.table(table).some(r => r !== ignore && keyOf(r, cols, table) === k)) return cols;
    }
    return null;
  }
}

function uniqueError(table, cols) {
  return { code: '23505', message: `duplicate key value violates unique constraint "${table}_${cols.join('_')}_key"` };
}

class Query {
  constructor(store, table) {
    this.store = store;
    this.tableName = table;
    this.filters = [];
    this.op = 'select';
    this.columns = '*';
    this.returning = false;
    this.mode = 'many';
    this.max = null;
  }

  select(cols = '*') {
    if (this.op === 'select') this.columns = cols;
    else { this.returning = true; this.columns = cols; }
    return this;
  }
  eq(col, val) {
    // Loose only across types (e.g. a numeric id given as a string), like Postgres casts
    this.filters.push(r => r[col] === val ||
      (r[col] != null && val != null && typeof r[col] !== typeof val && String(r[col]) === String(val)));
    return this;
  }
  in(col, list) { const s = new Set(list); this.filters.push(r => s.has(r[col])); return this; }
  limit(n) { this.max = n; return this; }
  order() { return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
  update(patch) { this.op = 'update'; this.payload = patch; return this; }
  delete() { this.op = 'delete'; return this; }
  upsert(rows, opts = {}) { this.op = 'upsert'; this.payload = rows; this.conflict = (opts.onConflict || 'id').split(',').map(s => s.trim()); return this; }

  _project(row) {
    if (!this.columns || this.columns.trim() === '*') return clone(row);
    const out = {};
    for (const c of this.columns.split(',').map(s => s.trim()).filter(Boolean)) out[c] = clone(row[c]);
    return out;
  }

  _matches(row) { return this.filters.every(f => f(row)); }

  _finish(rows) {
    let data = rows.map(r => this._project(r));
    if (this.max != null) data = data.slice(0, this.max);
    if (this.mode === 'single') {
      if (data.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
      return { data: data[0], error: null };
    }
    if (this.mode === 'maybe') {
      if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } };
      return { data: data[0] || null, error: null };
    }
    return { data, error: null };
  }

  _run() {
    const st = this.store;
    const t = st.table(this.tableName);
    const defaults = DEFAULTS[this.tableName] || (() => ({}));

    switch (this.op) {
      case 'select':
        return this._finish(t.filter(r => this._matches(r)));

      case 'insert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const made = [];
        for (const raw of list) {
          const row = { ...defaults(), ...clone(raw) };
          if (this.tableName === 'users' && process.env.LOCAL_RICH === '1' && raw.coins === undefined) {
            row.coins = 1000000; row.gems = 100000;
          }
          const bad = st.violatesUnique(this.tableName, row, null);
          if (bad) return { data: null, error: uniqueError(this.tableName, bad) };
          row.id = st.nextId(this.tableName);
          made.push(row);
        }
        t.push(...made);
        st.save();
        return this.returning ? this._finish(made) : { data: null, error: null };
      }

      case 'update': {
        const hits = t.filter(r => this._matches(r));
        for (const r of hits) {
          const next = { ...r, ...clone(this.payload) };
          const bad = st.violatesUnique(this.tableName, next, r);
          if (bad) return { data: null, error: uniqueError(this.tableName, bad) };
        }
        for (const r of hits) Object.assign(r, clone(this.payload));
        if (hits.length) st.save();
        return this.returning ? this._finish(hits) : { data: null, error: null };
      }

      case 'delete': {
        const gone = t.filter(r => this._matches(r));
        if (gone.length) {
          st.data.tables[this.tableName] = t.filter(r => !gone.includes(r));
          // ON DELETE CASCADE for everything hanging off a user
          if (this.tableName === 'users') {
            const ids = new Set(gone.map(r => r.id));
            for (const name of Object.keys(st.data.tables)) {
              if (name === 'users') continue;
              st.data.tables[name] = st.data.tables[name].filter(r => !ids.has(r.user_id));
            }
          }
          st.save();
        }
        return this.returning ? this._finish(gone) : { data: null, error: null };
      }

      case 'upsert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const out = [];
        for (const raw of list) {
          const k = keyOf(raw, this.conflict, this.tableName);
          const existing = t.find(r => keyOf(r, this.conflict, this.tableName) === k);
          if (existing) { Object.assign(existing, clone(raw)); out.push(existing); }
          else {
            const row = { ...defaults(), ...clone(raw), id: st.nextId(this.tableName) };
            t.push(row); out.push(row);
          }
        }
        st.save();
        return this.returning ? this._finish(out) : { data: null, error: null };
      }
    }
    return { data: null, error: { message: `unsupported op ${this.op}` } };
  }

  // Thenable: `await query` runs it, like supabase-js
  then(resolve, reject) {
    try { resolve(this._run()); } catch (e) { reject ? reject(e) : resolve({ data: null, error: { message: e.message } }); }
  }
}

function bestPerUser(rows, better) {
  const best = new Map();
  for (const r of rows) {
    const cur = best.get(r.user_id);
    if (!cur || better(r, cur)) best.set(r.user_id, r);
  }
  return [...best.values()];
}

function createLocalClient(file) {
  const store = new LocalStore(file);

  const rpcs = {
    get_score_leaderboard({ filter_date } = {}) {
      const since = filter_date ? Date.parse(filter_date) : null;
      const rows = store.table('scores').filter(s => since == null || Date.parse(s.created_at) >= since);
      return bestPerUser(rows, (a, b) => a.score > b.score)
        .sort((a, b) => b.score - a.score).slice(0, 100)
        .map(({ nickname, score, wave, enemies_killed, created_at, user_id }) => ({ nickname, score, wave, enemies_killed, created_at, user_id }));
    },
    get_wave_leaderboard({ filter_date } = {}) {
      const since = filter_date ? Date.parse(filter_date) : null;
      const rows = store.table('scores').filter(s => since == null || Date.parse(s.created_at) >= since);
      return bestPerUser(rows, (a, b) => a.wave > b.wave)
        .sort((a, b) => b.wave - a.wave).slice(0, 100)
        .map(({ nickname, wave, score, enemies_killed, created_at, user_id }) => ({ nickname, wave, score, enemies_killed, created_at, user_id }));
    },
    get_boss_rush_leaderboard() {
      const better = (a, b) => a.bosses_defeated > b.bosses_defeated ||
        (a.bosses_defeated === b.bosses_defeated && a.total_time_ms < b.total_time_ms);
      return bestPerUser(store.table('boss_rush_scores'), better)
        .sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0)).slice(0, 100)
        .map(({ nickname, bosses_defeated, total_time_ms, score, created_at, user_id }) => ({ nickname, bosses_defeated, total_time_ms, score, created_at, user_id }));
    },
    trim_user_scores({ p_user_id, p_keep = 10 } = {}) {
      const mine = store.table('scores').filter(s => s.user_id === p_user_id).sort((a, b) => b.score - a.score);
      const drop = new Set(mine.slice(p_keep));
      if (drop.size) { store.data.tables.scores = store.table('scores').filter(s => !drop.has(s)); store.save(); }
      return null;
    },
    unlock_achievement({ p_user_id, p_achievement_id } = {}) {
      const t = store.table('achievements');
      if (!t.some(a => a.user_id === p_user_id && a.achievement_id === p_achievement_id)) {
        t.push({ id: store.nextId('achievements'), user_id: p_user_id, achievement_id: p_achievement_id, unlocked_at: new Date().toISOString() });
        store.save();
      }
      return null;
    },
    cleanup_old_scores() { return 0; }
  };

  return {
    from: table => new Query(store, table),
    rpc: async (name, args) => {
      const fn = rpcs[name];
      if (!fn) return { data: null, error: { message: `function ${name} does not exist` } };
      try { return { data: fn(args || {}), error: null }; } catch (e) { return { data: null, error: { message: e.message } }; }
    },
    _store: store
  };
}

module.exports = { createLocalClient };
