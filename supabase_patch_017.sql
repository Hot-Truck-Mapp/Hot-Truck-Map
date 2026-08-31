-- ============================================================
-- HOT TRUCK MAP — Production Patch 017
-- Duplicate policies have accumulated. Some of them are wide open.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- Run each numbered section on its own: the SQL editor only shows the
-- result of the LAST statement in a run.
-- ============================================================
--
-- WHAT'S ACTUALLY WRONG
--
-- Patch 016 enabled and forced RLS on follows and truck_views. Both still
-- return rows to an anonymous caller afterwards:
--
--   GET /rest/v1/follows?select=*      → 10 rows
--   GET /rest/v1/truck_views?select=*  →  2 rows
--
-- So RLS was never the problem — it was already on. The problem is the
-- policy counts:
--
--   table              policies   this repo defines
--   follows                   8   4
--   truck_views               9   2
--   catering_requests        13   3
--   menu_items               12   4
--   locations                11   4
--   schedules                11   4
--   catering_packages        10   4
--   catering_messages         9   2
--   trucks                    8   4
--
-- Postgres OR's permissive policies together, so one open policy defeats
-- every careful one beside it. Duplicates under different names have piled
-- up across repeated migration runs and dashboard edits, and at least one
-- of them on each leaking table grants broad read access.
--
-- This is the same shape as the menu-photos bucket in patch 013, one layer
-- down: the policy I wrote was correct and simply outvoted.
--
-- It also explains the is_active puzzle from patch 015 — trucks with
-- is_active = false stayed publicly visible because trucks has 8 policies
-- where 4 are expected.


-- ── 1. Fix the two confirmed leaks ───────────────────────────
-- Safe to do decisively here because the correct, complete policy set for
-- these two tables is known and small. Drop everything on them, then
-- recreate exactly what belongs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('follows', 'truck_views')
  LOOP
    RAISE NOTICE 'dropping %.%', r.tablename, r.policyname;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- follows: a follower sees their own rows; a truck owner sees their truck's.
CREATE POLICY "follows_read" ON follows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "follows_owner_read" ON follows FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id LIMIT 1)
);
CREATE POLICY "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "follows_delete" ON follows FOR DELETE USING (auth.uid() = user_id);

-- truck_views: anyone may record a view; only the truck's owner reads them.
CREATE POLICY "truck_views_public_insert" ON truck_views FOR INSERT WITH CHECK (
  viewer_id IS NULL OR viewer_id = auth.uid()
);
CREATE POLICY "truck_views_owner_read" ON truck_views FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id LIMIT 1)
);

-- Expect 4 and 2.
SELECT tablename, count(*) AS policies
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('follows', 'truck_views')
GROUP BY tablename;


-- ── 2. Triage the rest — READ ONLY, run separately ───────────
-- Every remaining permissive SELECT policy that does NOT reference
-- auth.uid(). On a table holding private rows, that is a policy granting
-- broad read access, and it is what to look at next.
--
-- Some hits here are correct and should stay: trucks, menu_items,
-- schedules, locations, catering_packages, reviews, truck_photos,
-- spotted_posts and festivals are all meant to be publicly readable.
-- Anything else in this list is a finding.
--
-- Send me this output.
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  coalesce(qual, '(none)') AS using_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
  AND cmd IN ('SELECT', 'ALL')
  AND coalesce(qual, '') NOT ILIKE '%auth.uid()%'
ORDER BY tablename, policyname;


-- ── 3. Duplicate policy names — READ ONLY, run separately ────
-- Policies doing the same job under different names on one table. This is
-- how the counts got so far above what the repo defines.
SELECT
  tablename,
  cmd,
  count(*) AS policy_count,
  string_agg(policyname, ', ' ORDER BY policyname) AS names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename, cmd
HAVING count(*) > 1
ORDER BY count(*) DESC, tablename;


-- ── 4. Notes on two things in the RLS listing ────────────────
--
-- spatial_ref_sys (rls_enabled = false) is PostGIS's reference table of
-- coordinate systems. It is owned by the extension, contains no data of
-- yours, and cannot have RLS enabled without superuser. Supabase's linter
-- flags it on every project that has PostGIS. Leave it.
--
-- Follows, Items, Locations, Menus, Orders, Reviews, Trucks, Users — the
-- capitalised set — have RLS on and zero policies, which means nothing can
-- read or write them except the service role. All return zero rows. They
-- are an abandoned duplicate schema, inert but confusing: PostgREST is
-- case-sensitive, so "Trucks" and "trucks" are different endpoints, and
-- someone will eventually query the wrong one. Worth dropping once you have
-- confirmed they hold nothing you want:
--
--   SELECT 'Follows' t, count(*) FROM "Follows"
--   UNION ALL SELECT 'Items',     count(*) FROM "Items"
--   UNION ALL SELECT 'Locations', count(*) FROM "Locations"
--   UNION ALL SELECT 'Menus',     count(*) FROM "Menus"
--   UNION ALL SELECT 'Orders',    count(*) FROM "Orders"
--   UNION ALL SELECT 'Reviews',   count(*) FROM "Reviews"
--   UNION ALL SELECT 'Trucks',    count(*) FROM "Trucks"
--   UNION ALL SELECT 'Users',     count(*) FROM "Users";
--
-- Then, only if every count is 0:
--   DROP TABLE "Follows", "Items", "Locations", "Menus",
--              "Orders", "Reviews", "Trucks", "Users";
