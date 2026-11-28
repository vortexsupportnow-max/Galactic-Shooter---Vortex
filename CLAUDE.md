# Galactic Shooter – Vortex

Browser space shooter (HTML5 Canvas + WebGL, vanilla JS, no framework/bundler for the client) with a Node/Express API on Vercel and Supabase (Postgres). UI text is Italian; code and comments are English.

## Commands
- `npm test` — Jest, server routes + local DB (must stay green)
- `npm run local:rich` — play on http://localhost:3000 with a JSON-file DB (no Supabase); `local:reset` wipes it
- `npm run build:sandbox` — regenerate `public/sandbox.html` + `public/sandbox/*` (**re-run after changing `routes/`, `db/localDb.js`, `sandbox/` or any client file; the output is committed**). `-- --single dist/sandbox.html` makes one self-contained file
- `node --check public/js/<file>.js` — quick syntax check (no build step for the client)

## Layout
- `server.js`, `routes/{auth,game,leaderboard}.js`, `config.js`, `middleware/` — API. `routes/game.js` holds crates, wheel, skins, season pass, missions, Boss Rush, **anti-cheat** (`validateRunStats`: score/kill limits per wave, extra run stats only feed achievements)
- `db/database.js` (Supabase or local), `db/localDb.js` (supabase-js-compatible in-memory/JSON/localStorage store), `db/schema*.sql`
- `sandbox/` — the real routes bundled for the browser (esbuild shims), no login, everything unlocked
- `public/js/` — client, loaded in this order by `index.html`:
  `utils` (apiFetch, sounds, settings, particles) → `assets` (ability icons) → `visuals` (FX glow, SpaceBackground, ShipRenderer, SpriteForge, EnemySprites, `gameFont()`) → `postfx` (WebGL renderer factory `createSpaceRenderer`, game instance `PostFX`) → `backdrop` (menu WebGL background) → `abilities` → `skins` (+ `SKIN_VISUALS`) → `entities` (Bullet, Player, Enemy, Pickup, classic Boss, cosmic bosses, Explosion) → `bosses` (6 mega bosses) → `perks` (after-boss Upgrades) → `boosters` (power-up drops) → `hud` → `game` (GalacticGame) → `boss_rush` → `auth`, `ui`, `season_pass`, `main`

## How the game works (key decisions, don't undo without asking)
- Logical playfield 480×700; scene drawn at 2× (1.5× on touch devices). With WebGL the 2D scene goes to an offscreen canvas and `PostFX.present` composites shader background + bloom + shockwaves; `?nogl` or no WebGL → pure 2D fallback. "Effetti ridotti" (`gameSettings.lowfx`) disables heavy passes; adaptive quality turns it on below ~40 fps.
- Scoring: chain multiplier (×10 max), graze, medal chain, Overdrive ×2, perfect-wave and boss time bonus. Coins on save = waves/kills based (not raw score).
- Weapon levels 1–6 from P cores; 3 equipped abilities recharge (Q/E/R); extra owned abilities drop rarely into single-use bonus slot F; power-ups (`boosters.js`) act on pickup; after each boss pick 1 of 3 Upgrades (`perks.js`).
- Bosses: wave 5 = classic or 2 gentle mega bosses; from wave 10 a no-repeat bag of 11 (5 cosmic + 6 mega). Multi-part bosses implement `hitTest/damagePart/affectPlayer`. Boss HP `900*(wave/5)^1.25 * hpScale`, tuned to ~10–20 s fights.
- Touch: drag anywhere (relative), tap HUD slots / Overdrive bar. Gamepad supported.
- Every sprite is drawn flat at 4× then lit by `SpriteForge.forge` (bevel, metal, rim); light direction matches the planets.
- UI: Chakra Petch (text) + Orbitron (titles), SVG icon sprite in `index.html` (`<svg class="i"><use href="#i-..."/></svg>`), glass panels; canvas text uses `gameFont(px)`.

## Conventions
- Keep it dependency-free on the client; no new CDN scripts (server CSP is `script-src 'self'`).
- Server changes: add/adjust Jest tests; never loosen anti-cheat without reason.
- Test gameplay changes in the sandbox or `local:rich`; Playwright is handy for screenshots/simulations.
- Commit messages: imperative subject + short body. Work on a branch; PR #29 (`claude/galactic-shooter-resume-1kyy0t`) holds the current overhaul and is not merged yet.

## Status / next ideas
- Supabase free tier: kept awake by Vercel cron `/api/health` (vercel.json) + GitHub Action (needs repo variable `SITE_URL`).
- Open: real-phone playtest feedback (performance, drag sensitivity `1.2` in `_setupDrag`), audio overhaul (still simple oscillator beeps), cosmic bosses still flat-drawn (not forged), new season (theme TBD by the owner), Firebase migration was postponed (staying on Supabase).
