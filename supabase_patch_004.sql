-- ============================================================
-- HOT TRUCK MAP — Production Patch 004
-- Run this in your Supabase SQL Editor (supabase.com → project
-- → SQL Editor → New query → paste & Run)
-- Safe to run multiple times (all statements are idempotent)
--
-- CRITICAL FIX: `reviews` table had Row-Level Security DISABLED.
-- The policies existed but weren't being enforced because RLS
-- itself was off at the table level. Anyone with the anon key
-- (which ships in the JS bundle) could read, edit, or delete
-- any review on the site.
--
-- Linter code: rls_disabled_in_public
-- ============================================================


-- ── 1. Re-enable RLS on `reviews` ─────────────────────────────
-- The policies in supabase_migration.sql already exist
-- (reviews_public_read, reviews_auth_insert, reviews_auth_delete);
-- they just weren't being enforced because RLS was off at the
-- table level. Enabling RLS activates them.
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY; -- enforce on table owner too

-- Belt-and-suspenders: re-assert the policies in case any drifted.
-- These match the originals in supabase_migration.sql.
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
DROP POLICY IF EXISTS "reviews_auth_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_auth_update" ON reviews; -- intentionally dropped, not recreated
DROP POLICY IF EXISTS "reviews_auth_delete" ON reviews;

CREATE POLICY "reviews_public_read"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "reviews_auth_insert"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- No UPDATE policy: the app never edits reviews, so we leave UPDATE blocked
-- entirely. Users who want to change a review can delete and re-create.

CREATE POLICY "reviews_auth_delete"
  ON reviews FOR DELETE
  USING (auth.uid() = user_id);


-- ── 2. Clean up junk rows created during the audit ────────────
-- (auditor inserted empty rows when probing which tables were
--  unprotected — these have all-null required fields and no
--  legitimate user_id, so they're safe to remove.)
DELETE FROM reviews
WHERE id = '488aa38e-48d9-4f11-915d-4a4a9864c317'
  AND user_id IS NULL
  AND truck_id IS NULL
  AND rating IS NULL;

DELETE FROM truck_views
WHERE id = 'd2b9f5a0-6beb-4280-8415-1f43b2406fc7'
  AND viewer_id IS NULL
  AND truck_id IS NULL;

-- Defensive sweep: any other reviews that slipped through with
-- null user_id and null truck_id (impossible to attribute, no
-- legitimate origin) are spam from the same hole.
DELETE FROM reviews
WHERE user_id IS NULL
  AND truck_id IS NULL
  AND rating IS NULL;


-- ── 3. Defensive: ensure RLS is on for every public table ─────
-- Idempotent — does nothing for tables where RLS is already on.
-- This catches any other table that may have slipped through.
--
-- Skips:
--   • Tables we don't own (PostGIS's `spatial_ref_sys`, etc. —
--     these belong to the `postgres` superuser via extensions
--     and ALTER would fail with 42501; they're system reference
--     data, not user data, and the Supabase linter ignores them
--     for the same reason).
DO $$
DECLARE
  r RECORD;
  current_role_name text := current_user;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_roles  o ON o.oid = c.relowner
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'           -- ordinary tables only
      AND c.relrowsecurity = false  -- not yet protected
      AND o.rolname = current_role_name  -- skip tables we don't own
      AND NOT EXISTS (              -- skip tables owned by an extension
        SELECT 1 FROM pg_depend d
        WHERE d.objid = c.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
    RAISE NOTICE 'Enabled RLS on public.%', r.tbl;
  END LOOP;
END $$;


-- ── 4. Verify ─────────────────────────────────────────────────
-- After running this patch, this query should return ZERO rows.
-- If any rows come back, those tables still need policies + RLS.
--
-- SELECT c.relname
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'r'
--   AND c.relrowsecurity = false;
