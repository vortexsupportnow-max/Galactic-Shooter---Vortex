-- ============================================================
-- Galactic Shooter – Developer Role System
-- Run this in the Supabase SQL Editor to enable role management.
-- ============================================================

-- ── Add role column to users ──────────────────────────────────
-- Possible values: 'player' (default), 'developer'
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'player';

-- Index for fast role lookups (e.g. listing all developers)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ── Promote / Demote helpers ──────────────────────────────────
-- Call via supabase.rpc('set_user_role', { p_user_id: ..., p_role: 'developer' })

CREATE OR REPLACE FUNCTION set_user_role(p_user_id BIGINT, p_role TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF p_role NOT IN ('player', 'developer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be "player" or "developer".', p_role;
  END IF;
  UPDATE users SET role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User with id % not found.', p_user_id;
  END IF;
END;
$$;

-- Convenience: promote by nickname (useful for quick manual promotion)
CREATE OR REPLACE FUNCTION promote_to_developer(p_nickname TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE users SET role = 'developer' WHERE nickname = p_nickname;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User "%" not found.', p_nickname;
  END IF;
END;
$$;

-- Convenience: demote back to player by nickname
CREATE OR REPLACE FUNCTION demote_to_player(p_nickname TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE users SET role = 'player' WHERE nickname = p_nickname;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User "%" not found.', p_nickname;
  END IF;
END;
$$;
