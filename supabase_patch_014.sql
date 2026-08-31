-- ============================================================
-- HOT TRUCK MAP — Production Patch 014
-- Make "Hide truck" actually hide, and stop operators reviewing
-- their own trucks.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- Found in the second audit pass.


-- ── 1. trucks.is_active: document it and make it NULL-free ───
--
-- The admin dashboard's Hide control writes this column
-- (app/api/admin/action/route.ts, case "truck.active"), and its own
-- comment says hiding "pulls it from the public map".
--
-- It does not. Nothing in the web app, the mobile app, the sitemap or
-- either useLiveTrucks hook filters on is_active. A hidden truck stays
-- on the map, in the truck list, in the leaderboard, in search results
-- and on its own detail page. The moderation control silently no-ops —
-- which is worse than not having it, because the owner believes the
-- spam truck is gone.
--
-- The column also exists in no migration in this repo. It was added
-- out-of-band, which is why nothing was written against it.
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS is_active boolean;

-- Existing rows are NULL, which has to mean "visible" — nobody has ever
-- hidden anything. Backfill and default so the column is unambiguous.
UPDATE trucks SET is_active = true WHERE is_active IS NULL;
ALTER TABLE trucks ALTER COLUMN is_active SET DEFAULT true;


-- ── 2. Enforce visibility in RLS, not in 18 call sites ───────
--
-- Filtering in application code would mean editing every truck query on
-- both clients plus the sitemap, and any new query would silently
-- reintroduce the bug. Visibility is an authorization rule, so it
-- belongs in the policy — one change, and every current and future
-- reader inherits it.
--
-- Note the NULL handling: `is_active IS NOT FALSE` is TRUE for both
-- true and NULL, so this is safe even if the backfill above is skipped
-- or a future insert omits the column.
--
-- The owner_id branch keeps the operator's own dashboard working: a
-- hidden truck is still visible to the person who owns it, so they
-- aren't bounced to the homepage by the dashboard's "no truck" check.
--
-- Admin routes use the service role, which bypasses RLS entirely, so
-- the admin dashboard keeps seeing hidden trucks either way.
DROP POLICY IF EXISTS "trucks_public_read" ON trucks;
CREATE POLICY "trucks_public_read" ON trucks FOR SELECT USING (
  is_active IS NOT FALSE
  OR owner_id = auth.uid()
);


-- ── 3. Operators can review their own trucks ─────────────────
--
-- reviews_auth_insert only checks `auth.uid() = user_id` — that the
-- reviewer is inserting as themselves. Nothing stops that person being
-- the truck's owner.
--
-- avg_rating is shown on the map, the truck card, the detail page and
-- the leaderboard, so a self-review is direct rating manipulation. The
-- unique constraint from schema_fixes.sql caps it at one per truck,
-- which limits the damage but doesn't make it legitimate.
-- IS DISTINCT FROM, not <>. If the subselect returns NULL — a truck with no
-- owner_id, or a truck_id that matches nothing — then `auth.uid() <> NULL` is
-- NULL, the whole WITH CHECK evaluates to NULL, and the insert is rejected.
-- That would make an ownerless truck silently un-reviewable by everyone.
-- Every truck has an owner today, so this is about not leaving a trap.
DROP POLICY IF EXISTS "reviews_auth_insert" ON reviews;
CREATE POLICY "reviews_auth_insert" ON reviews FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = user_id
  AND auth.uid() IS DISTINCT FROM (SELECT owner_id FROM trucks WHERE id = truck_id)
);


-- ── Verification ─────────────────────────────────────────────
-- 1. Nothing should be hidden yet — expect 0.
SELECT count(*) AS hidden_trucks FROM trucks WHERE is_active IS FALSE;

-- 2. Confirm the policies are in place.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('trucks_public_read', 'reviews_auth_insert');

-- 3. In the app, after running this:
--    • The map and truck list should look exactly as before (nothing is
--      hidden yet, so nothing should disappear). If trucks vanish, stop
--      and re-run: SELECT count(*) FROM trucks WHERE is_active IS FALSE;
--    • Admin → Trucks → Hide a test truck, then load the map signed out.
--      It should be gone. Unhide to restore.
--    • As an operator, your own truck stays visible in your dashboard
--      even while hidden.
