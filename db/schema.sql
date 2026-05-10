-- ============================================================
-- Galactic Shooter – Supabase (PostgreSQL) Schema
-- Run this once in the Supabase SQL Editor
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           BIGSERIAL PRIMARY KEY,
  nickname     TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  coins        INTEGER NOT NULL DEFAULT 0,
  gems         INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  max_score    INTEGER NOT NULL DEFAULT 0,
  max_wave     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_abilities (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ability_id TEXT NOT NULL,
  level      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, ability_id)
);

CREATE TABLE IF NOT EXISTS scores (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname      TEXT NOT NULL,
  score         INTEGER NOT NULL,
  wave          INTEGER NOT NULL,
  enemies_killed INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievements (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_nickname          ON users(nickname);
CREATE INDEX IF NOT EXISTS idx_scores_user_id          ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_score_desc       ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_wave_desc        ON scores(wave DESC);
CREATE INDEX IF NOT EXISTS idx_scores_created_at       ON scores(created_at);
CREATE INDEX IF NOT EXISTS idx_user_abilities_user_id  ON user_abilities(user_id);
CREATE INDEX IF NOT EXISTS idx_achievements_user_id    ON achievements(user_id);

-- ── Row-Level Security ────────────────────────────────────────
-- The Node.js backend is the only caller (server-side, trusted).
-- We enable RLS but create a single permissive policy so the
-- anon key used by the backend can read/write freely.

ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_abilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements   ENABLE ROW LEVEL SECURITY;

-- Drop policies first so this script is idempotent
DROP POLICY IF EXISTS "backend_all" ON users;
DROP POLICY IF EXISTS "backend_all" ON user_abilities;
DROP POLICY IF EXISTS "backend_all" ON scores;
DROP POLICY IF EXISTS "backend_all" ON achievements;

CREATE POLICY "backend_all" ON users          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "backend_all" ON user_abilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "backend_all" ON scores         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "backend_all" ON achievements   FOR ALL USING (true) WITH CHECK (true);

-- ── Helper Functions (called via supabase.rpc) ────────────────

-- Leaderboard: best score entry per user, ordered by score DESC
CREATE OR REPLACE FUNCTION get_score_leaderboard(filter_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(
  nickname       TEXT,
  score          INTEGER,
  wave           INTEGER,
  enemies_killed INTEGER,
  created_at     TIMESTAMPTZ,
  user_id        BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT nickname, score, wave, enemies_killed, created_at, user_id
  FROM (
    SELECT DISTINCT ON (s.user_id)
      s.nickname, s.score, s.wave, s.enemies_killed, s.created_at, s.user_id
    FROM scores s
    WHERE (filter_date IS NULL OR s.created_at >= filter_date)
    ORDER BY s.user_id, s.score DESC
  ) best
  ORDER BY score DESC
  LIMIT 100;
$$;

-- Leaderboard: best wave entry per user, ordered by wave DESC
CREATE OR REPLACE FUNCTION get_wave_leaderboard(filter_date TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE(
  nickname       TEXT,
  wave           INTEGER,
  score          INTEGER,
  enemies_killed INTEGER,
  created_at     TIMESTAMPTZ,
  user_id        BIGINT
) LANGUAGE sql STABLE AS $$
  SELECT nickname, wave, score, enemies_killed, created_at, user_id
  FROM (
    SELECT DISTINCT ON (s.user_id)
      s.nickname, s.wave, s.score, s.enemies_killed, s.created_at, s.user_id
    FROM scores s
    WHERE (filter_date IS NULL OR s.created_at >= filter_date)
    ORDER BY s.user_id, s.wave DESC
  ) best
  ORDER BY wave DESC
  LIMIT 100;
$$;

-- Upsert achievement (idempotent insert)
CREATE OR REPLACE FUNCTION unlock_achievement(p_user_id BIGINT, p_achievement_id TEXT)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;
$$;

-- ── Database Cleanup & Optimization ─────────────────────────────────────────
-- Trim scores: keep only the top `p_keep` scores (by score DESC) per user.
-- Called automatically after every game save from the Node.js backend
-- so that each user's row count in the scores table stays capped.
CREATE OR REPLACE FUNCTION trim_user_scores(p_user_id BIGINT, p_keep INTEGER DEFAULT 10)
RETURNS VOID LANGUAGE sql AS $$
  DELETE FROM scores
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id
      FROM scores
      WHERE user_id = p_user_id
      ORDER BY score DESC
      LIMIT p_keep
    );
$$;

-- Global cleanup: delete score rows older than `older_than_days` days while
-- always preserving each user's single all-time best score.
-- Run this periodically (e.g. weekly) via Supabase Cron or pg_cron.
-- Returns the number of rows deleted.
CREATE OR REPLACE FUNCTION cleanup_old_scores(older_than_days INTEGER DEFAULT 60)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM scores
  WHERE created_at < NOW() - (older_than_days || ' days')::INTERVAL
    AND id NOT IN (
      SELECT DISTINCT ON (user_id) id
      FROM scores
      ORDER BY user_id, score DESC
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
