# Galactic Shooter – Vortex

A browser-based space shooter built with HTML5 Canvas + a Node.js/Express backend that stores scores, abilities and achievements in **Supabase (PostgreSQL)**.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Supabase project | free tier is fine |

---

## 1 – Create the Supabase project

1. Go to <https://supabase.com> and create a new project.
2. Once the project is ready, open **Settings → API** and copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **`service_role` key** — server-only, never ship it to a browser
   - (the **anon public key** works as a fallback, but see [Security](#security))

> Do **not** reuse Supabase's own *JWT Secret* for `JWT_SECRET`. This app signs its
> own tokens; give it a dedicated random secret you can rotate independently.

---

## 2 – Run the database schema

1. In the Supabase dashboard open **SQL Editor → New query**.
2. Paste the entire contents of `db/schema.sql` and click **Run**.

This creates the following tables and helpers:

| Object | Type | Description |
|--------|------|-------------|
| `users` | table | Player accounts (nickname, hashed password, coins, gems, stats) |
| `user_abilities` | table | Abilities owned by each player |
| `scores` | table | Per-game score records |
| `achievements` | table | Unlocked achievements per player |
| `get_score_leaderboard` | function | Best score per player, ordered by score |
| `get_wave_leaderboard` | function | Best wave per player, ordered by wave |
| `unlock_achievement` | function | Idempotent achievement unlock |

`db/schema.sql` enables Row-Level Security with a **permissive** policy so a server
running on the anon key keeps working. That policy also grants the public anon key
full read/write access to every table — see [Security](#security) for how to close it
with `db/schema_rls.sql`.

---

## 3 – Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

`.env` fields:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # preferred
SUPABASE_ANON_KEY=                                # fallback only
JWT_SECRET=a-random-string-of-at-least-32-chars
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=                                  # empty = same-origin only
```

Generate a strong `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

With `NODE_ENV=production` the server refuses to start if `JWT_SECRET` is missing or
is the development secret published in this repo — it never falls back to a value an
attacker could read. A shorter-than-32-character secret still boots, but logs a
warning on every start and shows up as `jwt.weak` on `/api/health`.

---

## 4 – Install dependencies and start the server

```bash
npm install
npm start
```

The server starts on `http://localhost:3000` (or the `PORT` you set).  
Open that URL in your browser to play the game.

---

## Project structure

```
├── db/
│   ├── schema.sql      # Supabase schema – run this once in the SQL Editor
│   ├── schema_rls.sql  # Database lockdown – run after switching to the service-role key
│   ├── schema_roles.sql# Developer role helpers
│   └── database.js     # Supabase client initialisation
├── lib/                # Shared helpers (sanitised error responses)
├── middleware/         # JWT auth, security headers, per-user request locks
├── public/             # Front-end (HTML5 Canvas game)
│   ├── index.html
│   ├── css/
│   └── js/
├── routes/             # Express API routes
├── server.js           # Entry point
├── config.js           # App-wide configuration
├── .env.example        # Environment variable template
└── package.json
```

---

## Security

### Secrets

- `.env` is git-ignored — never commit real keys, and keep them out of screenshots and logs.
- `JWT_SECRET` signs the login tokens. Required in production (≥ 32 chars); rotating it
  logs everyone out, which is exactly what you want after a suspected leak.
- Prefer `SUPABASE_SERVICE_ROLE_KEY` over `SUPABASE_ANON_KEY`. The service-role key
  is meant to stay on the server and never reaches the browser here; the anon key is
  a *public* key in Supabase's model.

### The three SQL files

They stack — none of them replaces another, and all three are idempotent:

| File | When | What it does |
|------|------|--------------|
| `db/schema.sql` | first | Tables, indexes, RPC functions. Also creates permissive RLS policies. |
| `db/schema_roles.sql` | optional | `role` column and the developer promote/demote helpers. |
| `db/schema_rls.sql` | **last** | Drops those permissive policies and locks everything to `service_role`. |

⚠ Re-running `schema.sql` on a locked-down project recreates the permissive
policies and re-opens the database. If you ever do, run `schema_rls.sql` again
right after.

### Locking the database (recommended)

With the permissive policies from `db/schema.sql`, anyone holding the project URL +
anon key can bypass this API and read password hashes or edit balances directly.
To close that:

1. Set `SUPABASE_SERVICE_ROLE_KEY` and redeploy.
2. Check the log line `Supabase database connected (service-role key)`.
3. Run `db/schema_rls.sql` in the SQL Editor.
4. Rotate the anon key.

### What the server already enforces

| Area | Measure |
|------|---------|
| Headers | CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS in production, no `X-Powered-By` |
| CORS | Same-origin by default; extra origins via `ALLOWED_ORIGINS` |
| Rate limits | 120 req/min per IP on the API, 30 per 15 min on `/auth`, `trust proxy` set so limits key on the real client IP |
| Payloads | JSON capped at 16 kB, malformed bodies rejected with a 400 |
| Accounts | Nickname charset restricted (no markup), password 8–72 chars, constant-work login, case-insensitive unique nicknames |
| Errors | Database messages are logged server-side only; clients get a generic message |
| Anti-cheat | Submitted runs are rejected when score/kills/gems/waves are outside what a real run can produce; Boss Rush kill counts are filtered to known bosses |
| Concurrency | Currency-spending endpoints are serialised per user to prevent double-spend races |

Client-side scoring remains the structural limit: the game simulates runs in the
browser, so the server can only reject implausible results, not verify honest ones.

---

## API overview

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create a new account |
| POST | `/auth/login` | Log in, receive JWT |
| GET | `/game/profile` | Get current player profile |
| POST | `/game/save-score` | Save a game result |
| POST | `/game/upgrade-ability` | Upgrade an owned ability |
| POST | `/game/open-crate` | Open a loot crate (costs gems) |
| GET | `/leaderboard/scores` | Top scores leaderboard |
| GET | `/leaderboard/waves` | Top waves leaderboard |
| GET | `/health` | Deployment diagnostics: env, DB reachability, which Supabase key, weak-secret flag |

---

## Supabase admin – database cleanup

### What you need to do once (update the schema)

The `db/schema.sql` file now includes two helper functions for storage management.  
Run the **full** `db/schema.sql` again in **Supabase → SQL Editor → New query** to create them (the script is fully idempotent – safe to run multiple times).

### How storage is kept under control

| Mechanism | When it runs | What it does |
|-----------|-------------|--------------|
| `trim_user_scores(user_id, 10)` | After **every** game save (automatic) | Keeps only the top 10 scores per player; deletes the rest immediately |
| `cleanup_old_scores(60)` | **Manually** or via a scheduled job | Deletes score rows older than 60 days, always preserving each player's all-time best |

### Run the global cleanup manually

Open **Supabase → SQL Editor** and run:

```sql
-- Delete scores older than 60 days (keeps each user's best score).
-- Returns the number of rows deleted.
SELECT cleanup_old_scores(60);

-- After a large deletion, reclaim disk space immediately:
VACUUM ANALYZE scores;
```

You can change `60` to any number of days that suits you (e.g. `30` for a stricter policy).

### Schedule automatic cleanup (recommended)

Supabase exposes **pg_cron** on paid plans.  
If your project is on a paid plan, run this once in the SQL Editor to schedule weekly cleanup:

```sql
-- Enable pg_cron (run once)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup_old_scores every Sunday at 03:00 UTC
SELECT cron.schedule(
  'weekly-score-cleanup',
  '0 3 * * 0',
  $$ SELECT cleanup_old_scores(60); $$
);
```

On the **free tier**, pg_cron is not available.  
Instead, use **Supabase Edge Functions** with a cron trigger, or simply run the manual SQL above once a week from the dashboard.

### Tips to keep storage low

- **Don't increase `p_keep`** in `trim_user_scores` beyond what you need. 10 scores per player is plenty for history; setting it lower (e.g. 5) saves even more space.
- If you add new tables that accumulate rows over time, remember to add a similar trim/cleanup function for them.
- Monitor storage in **Supabase → Project Settings → Usage**.