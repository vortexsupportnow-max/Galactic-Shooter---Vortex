-- ============================================================
-- Galactic Shooter – Database lockdown (RLS hardening)
--
-- WHY THIS EXISTS
-- db/schema.sql enables RLS but then adds a "backend_all" policy that is
-- `USING (true) WITH CHECK (true)` for *every* role, including `anon`.
-- A Supabase anon key is a public key by design (it ships in client apps and is
-- visible in the project settings), so with those policies in place anyone who
-- has the project URL + anon key can bypass this API entirely and:
--   • read every row of `users`, password hashes included;
--   • set their own coins/gems to anything;
--   • call promote_to_developer() and grant themselves the developer role.
--
-- This script removes that access. RLS stays enabled with *no* policies, which
-- denies anon/authenticated everything, while the `service_role` key used by the
-- backend bypasses RLS as usual.
--
-- ORDER OF OPERATIONS (important — doing it the other way round takes the app down)
--   1. Set SUPABASE_SERVICE_ROLE_KEY in the server environment and redeploy.
--   2. Verify the server logs "Supabase database connected (service-role key)".
--   3. Run this script in the Supabase SQL Editor.
--   4. Optional but recommended: rotate the anon key afterwards.
--
-- THIS FILE DOES NOT REPLACE db/schema.sql — it is applied on top of it, and it
-- deliberately undoes that file's permissive policies. So this must always be the
-- LAST script you run: re-running schema.sql (or schema_roles.sql) afterwards can
-- restore public access, and this script has to be re-applied.
-- Safe to run as many times as you like.
-- ============================================================

-- ── 1. Drop the permissive policies ───────────────────────────
DROP POLICY IF EXISTS "backend_all" ON users;
DROP POLICY IF EXISTS "backend_all" ON user_abilities;
DROP POLICY IF EXISTS "backend_all" ON scores;
DROP POLICY IF EXISTS "backend_all" ON achievements;
DROP POLICY IF EXISTS "backend_all" ON user_skins;
DROP POLICY IF EXISTS "backend_all" ON user_season_pass;
DROP POLICY IF EXISTS "backend_all" ON user_mission_progress;
DROP POLICY IF EXISTS "backend_all" ON boss_rush_scores;
DROP POLICY IF EXISTS "backend_all" ON boss_rush_stats;

-- ── 2. Make sure RLS is on everywhere (no policy = deny for anon) ──
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_abilities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores                ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_season_pass      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mission_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_rush_scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE boss_rush_stats       ENABLE ROW LEVEL SECURITY;

-- Also force it for the table owner, so nothing sneaks past via ownership.
ALTER TABLE users                 FORCE ROW LEVEL SECURITY;
ALTER TABLE user_abilities        FORCE ROW LEVEL SECURITY;
ALTER TABLE scores                FORCE ROW LEVEL SECURITY;
ALTER TABLE achievements          FORCE ROW LEVEL SECURITY;
ALTER TABLE user_skins            FORCE ROW LEVEL SECURITY;
ALTER TABLE user_season_pass      FORCE ROW LEVEL SECURITY;
ALTER TABLE user_mission_progress FORCE ROW LEVEL SECURITY;
ALTER TABLE boss_rush_scores      FORCE ROW LEVEL SECURITY;
ALTER TABLE boss_rush_stats       FORCE ROW LEVEL SECURITY;

-- ── 3. Revoke direct table privileges (defence in depth) ──────
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ── 4. Revoke RPC access ──────────────────────────────────────
-- PostgREST exposes every function in `public`. Without this, anon can call
-- promote_to_developer('anyone') or wipe scores with cleanup_old_scores().
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;
-- PUBLIC included on purpose: Postgres grants EXECUTE to PUBLIC on every new
-- function, and anon inherits it — without this, the next function you create is
-- callable over the API again.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Role management must never be reachable over the API, not even by service_role.
REVOKE ALL ON FUNCTION set_user_role(BIGINT, TEXT)   FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION promote_to_developer(TEXT)    FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION demote_to_player(TEXT)        FROM PUBLIC, anon, authenticated, service_role;

-- The backend legitimately calls these three, so grant them back to service_role only.
GRANT EXECUTE ON FUNCTION get_score_leaderboard(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_wave_leaderboard(TIMESTAMPTZ)  TO service_role;
GRANT EXECUTE ON FUNCTION get_boss_rush_leaderboard()        TO service_role;
GRANT EXECUTE ON FUNCTION unlock_achievement(BIGINT, TEXT)   TO service_role;
GRANT EXECUTE ON FUNCTION trim_user_scores(BIGINT, INTEGER)  TO service_role;

-- ── 5. Verification ───────────────────────────────────────────
-- Every table below should report rowsecurity = true and 0 policies.
--
--   SELECT c.relname,
--          c.relrowsecurity  AS rls_enabled,
--          (SELECT count(*) FROM pg_policies p
--             WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policies
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r'
--   ORDER BY c.relname;
