-- ============================================================
-- HOT TRUCK MAP — Production Patch 022
-- Close the public write grant on spatial_ref_sys, and retire PostGIS.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- WHY
--
-- The Supabase linter reports "RLS Disabled in Public" for
-- public.spatial_ref_sys. On its own that finding is noise: the table is
-- PostGIS's list of EPSG coordinate systems, it holds none of our data, and
-- RLS cannot be enabled on it because the extension owns it, not us. Earlier
-- patches (004, 017) looked at exactly this and correctly decided to leave it.
--
-- What those notes missed is the grant. Probing the REST API with the public
-- anon key — the one shipped in every browser bundle:
--
--   SELECT                      → 200, 8500 rows
--   INSERT                      → reached the CHECK constraint (23514),
--                                 i.e. permission was granted
--   DELETE (no-match filter)    → 204
--   UPDATE (no-match filter)    → 204
--
-- Those 204s mean only the filter spared the rows. Anyone with the anon key
-- could DELETE every row in spatial_ref_sys, or insert rows into it forever.
-- Nothing we run reads that table, so today the blast radius is zero — but it
-- is an unauthenticated write endpoint on the public API, and it would matter
-- the moment anything did use PostGIS.
--
-- WHAT THIS DOES
--
--   1. Revokes write access on spatial_ref_sys from anon/authenticated.
--   2. Drops trucks.location — a `geography` column that is the sole reason
--      PostGIS is installed, and which holds no data.
--   3. Drops the PostGIS extension, which removes spatial_ref_sys and with it
--      the linter finding, permanently.
--
-- Stop after step 1 if you want to keep PostGIS for future geospatial work.
-- The linter warning stays in that case; it is expected on every project that
-- has PostGIS in `public`, and step 1 is what actually closes the hole.
--
-- ABOUT trucks.location
--
-- It is one of the orphan columns on `trucks` that shadow the real source of
-- truth — the same set as `schedule`, `is_open`, `opens_at`, `closes_at` and
-- `cuisine_type`, flagged in mobile/app/truck/[id].tsx. Live positions live in
-- the `locations` table as plain lat/lng float8, distances are computed with
-- the haversine in lib/discovery.ts, and no query in the website or either app
-- selects `trucks.location` — every truck query names its columns explicitly
-- and none of them names this one. At the time of writing: 5 trucks, 0 with a
-- non-null value. Step 2 refuses to run if that has changed.


-- ── 1. Close the public write grant ─────────────────────────
-- Wrapped so a permissions failure reports itself instead of rolling back the
-- whole script: the grant can only be revoked by its grantor or the owner, and
-- if that is not us, step 3 is the remaining route.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'spatial_ref_sys'
  ) THEN
    BEGIN
      REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;
      -- Read stays: it is public reference data, and revoking SELECT would
      -- break any client that legitimately looks up a projection later.
      GRANT SELECT ON TABLE public.spatial_ref_sys TO anon, authenticated;
      RAISE NOTICE 'spatial_ref_sys: write access revoked, read access kept';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE WARNING 'Could not change grants on spatial_ref_sys (not the owner or grantor). Use step 3, or disable PostGIS from Database → Extensions.';
    END;
  END IF;
END $$;


-- ── 2. Drop the empty orphan geography column ───────────────
-- Refuses rather than destroying anything if the column has gained data since
-- this patch was written.
DO $$
DECLARE
  filled bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trucks' AND column_name = 'location'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.trucks WHERE location IS NOT NULL' INTO filled;
    IF filled > 0 THEN
      RAISE EXCEPTION
        'trucks.location holds % row(s) with data — not dropping. Migrate them into locations(lat, lng) first.', filled;
    END IF;
    ALTER TABLE public.trucks DROP COLUMN location;
    RAISE NOTICE 'Dropped empty orphan column trucks.location';
  END IF;
END $$;


-- ── 3. Retire PostGIS ───────────────────────────────────────
-- Deliberately no CASCADE. If any geometry/geography column, index, view or
-- function still depends on the extension, this refuses and the whole script
-- rolls back — which is the safety check, not a failure to work around. Never
-- add CASCADE here: it would silently drop whatever it found.
--
-- If this raises "must be owner of extension postgis", the extension belongs
-- to supabase_admin. Disable it from the dashboard instead:
--   Database → Extensions → postgis → toggle off.
DROP EXTENSION IF EXISTS postgis;


-- ── 4. Verify ───────────────────────────────────────────────
-- Expect zero rows from both. The first confirms nothing geospatial is left;
-- the second confirms no table in an exposed schema is missing RLS.

SELECT n.nspname AS schema, c.relname AS table_name, a.attname AS column_name, t.typname AS type
FROM pg_attribute a
JOIN pg_class c     ON c.oid = a.attrelid
JOIN pg_type t      ON t.oid = a.atttypid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE t.typname IN ('geometry', 'geography')
  AND c.relkind IN ('r', 'p', 'v', 'm')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema');

SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY 1;
