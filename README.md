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
   - **Anon public key**
   - **JWT Secret** (under *JWT Settings*)

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

Row-Level Security is enabled on every table with a permissive backend policy so the Node.js server can read/write freely.

---

## 3 – Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

`.env` fields:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
JWT_SECRET=your-jwt-secret-here
PORT=3000
```

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
│   └── database.js     # Supabase client initialisation
├── middleware/         # JWT auth middleware
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