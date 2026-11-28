'use strict';
// ===== SANDBOX SERVER (runs in the browser) =====
// The real route handlers from routes/game.js and routes/leaderboard.js, bundled
// for the browser and wired to an in-browser database. Crates, wheel, season
// pass, missions, Boss Rush and leaderboards behave exactly like the live game.

const gameRouter = require('../routes/game');
const leaderboardRouter = require('../routes/leaderboard');
const { getDB, SANDBOX_DB_KEY } = require('./shims/database');

const MOUNTS = [['/game', gameRouter], ['/leaderboard', leaderboardRouter]];

function makeRes(resolve) {
  const listeners = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    status(code) { res.statusCode = code; return res; },
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return res; },
    json(body) {
      if (res.headersSent) return res;
      res.headersSent = true;
      resolve(body);
      // userLock releases its per-user lock on 'finish'
      for (const fn of listeners.finish || []) fn();
      return res;
    }
  };
  return res;
}

function handle(method, url, body, user) {
  const [pathname, qs] = String(url).split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const mount = MOUNTS.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'));
  if (!mount) return Promise.resolve({ success: false, error: 'Not available in the sandbox' });
  const [prefix, router] = mount;
  const sub = pathname.slice(prefix.length) || '/';
  const chain = [];
  for (const r of router.routes) {
    if (r.method === '*' || (r.method === method && r.path === sub)) chain.push(...r.handlers);
  }
  if (!router.routes.some(r => r.method === method && r.path === sub)) {
    return Promise.resolve({ success: false, error: 'Not found' });
  }
  return new Promise(resolve => {
    const req = { method, path: sub, url: sub, query, body: body || {}, user, headers: {} };
    const res = makeRes(resolve);
    let i = 0;
    const next = err => {
      if (err) return resolve({ success: false, error: 'Something went wrong. Please try again.' });
      const fn = chain[i++];
      if (!fn) return resolve({ success: false, error: 'Not found' });
      try {
        const out = fn(req, res, next);
        if (out && typeof out.catch === 'function') out.catch(e => { console.error(e); resolve({ success: false, error: String(e && e.message) }); });
      } catch (e) {
        console.error(e);
        resolve({ success: false, error: String(e && e.message) });
      }
    };
    next();
  });
}

module.exports = { handle, db: getDB(), DB_KEY: SANDBOX_DB_KEY };
