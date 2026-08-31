-- ============================================================
-- HOT TRUCK MAP — Production Patch 016
-- follows and truck_views are readable by anyone with the anon key.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- HOW THIS WAS FOUND
--
-- A read-only probe with nothing but the public anon key — no session:
--
--   GET /rest/v1/follows?select=*      → 10 rows
--   GET /rest/v1/truck_views?select=*  → 2 rows
--
-- Both tables have policies from supabase_migration.sql that evaluate to
-- false for an anonymous caller:
--
--   follows_read       USING (auth.uid() = user_id)
--   follows_owner_read USING (auth.uid() = (SELECT owner_id FROM trucks …))
--   truck_views_owner_read USING (auth.uid() = (SELECT owner_id FROM trucks …))
--
-- auth.uid() is NULL without a session, so every one of those is false and
-- the correct result is zero rows. Rows came back. The policies are not
-- being enforced on these two tables — the same class of problem as patch
-- 004, where `reviews` had policies defined but RLS switched off at the
-- table level.
--
-- What is exposed:
--   follows      → user_id (a real auth.users UUID) + truck_id + created_at.
--                  Anyone can enumerate which customers follow which trucks.
--   truck_views  → viewer_id + truck_id + created_at. This is the operator's
--                  own analytics data, which only they should see.
--
-- Every other private table returned zero rows to the same probe, but that
-- is not proof they are filtered — an empty table looks identical from
-- outside. Section 3 checks the rest properly.


-- ── 1. Turn RLS back on for the two confirmed tables ─────────
-- FORCE as well as ENABLE, so the table owner is subject to it too. The
-- policies below already exist; they were simply not being applied.
ALTER TABLE follows     ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows     FORCE  ROW LEVEL SECURITY;
ALTER TABLE truck_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_views FORCE  ROW LEVEL SECURITY;

-- Re-assert them anyway, in case any drifted.
DROP POLICY IF EXISTS "follows_read"       ON follows;
DROP POLICY IF EXISTS "follows_owner_read" ON follows;
DROP POLICY IF EXISTS "follows_insert"     ON follows;
DROP POLICY IF EXISTS "follows_delete"     ON follows;

CREATE POLICY "follows_read" ON follows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "follows_owner_read" ON follows FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id LIMIT 1)
);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "truck_views_public_insert" ON truck_views;
DROP POLICY IF EXISTS "truck_views_owner_read"    ON truck_views;

CREATE POLICY "truck_views_public_insert" ON truck_views FOR INSERT WITH CHECK (
  viewer_id IS NULL OR viewer_id = auth.uid()
);
CREATE POLICY "truck_views_owner_read" ON truck_views FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id LIMIT 1)
);


-- ── 2. Keep the public follower count working ────────────────
-- app/truck/[id]/page.tsx renders "N followers" for every visitor, and it
-- gets that number with a head:true count over `follows`. Once section 1
-- takes effect that count is 0 for anyone signed out, and 1 for a signed-in
-- customer who follows the truck — the number would silently become wrong
-- rather than erroring, which is the worst kind of break.
--
-- A SECURITY DEFINER function returns the aggregate without exposing any
-- row. The caller gets an integer and nothing else: no user_id, no ability
-- to enumerate. search_path is pinned so the definer's rights can't be
-- redirected at a table of someone else's choosing.
CREATE OR REPLACE FUNCTION public.truck_follower_count(p_truck_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT count(*)::integer FROM follows WHERE truck_id = p_truck_id;
$$;

REVOKE ALL ON FUNCTION public.truck_follower_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.truck_follower_count(uuid) TO anon, authenticated;


-- ── 3. Check every other table, properly ─────────────────────
-- The outside probe can't tell "filtered" from "empty". This can.
-- rls_enabled must be true on every row. Anything false is the same bug.
SELECT
  c.relname             AS table_name,
  c.relrowsecurity      AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;


-- ── Verification ─────────────────────────────────────────────
-- 1. Expect follows and truck_views to show rls_enabled = true above.
-- 2. From a terminal, with the public anon key and no session — both must
--    now return zero rows:
--      curl -s "https://<project>.supabase.co/rest/v1/follows?select=*" \
--        -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>"
--      curl -s "https://<project>.supabase.co/rest/v1/truck_views?select=*" \
--        -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>"
-- 3. In the app: a truck page still shows its follower count while signed
--    out, following/unfollowing still works, and the dashboard's Analytics
--    tab still shows followers and views.
