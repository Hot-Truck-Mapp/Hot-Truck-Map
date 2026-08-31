-- ============================================================
-- HOT TRUCK MAP — Production Patch 013
-- Close the menu-photos bucket to anonymous writes.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- WHY THIS EXISTS
--
-- After patch 012 was applied, an unauthenticated upload was attempted
-- against all three buckets. Results:
--
--   avatars/customers/<uuid>.jpg          → 403, RLS violation   ✓
--   avatars/trucks/<uuid>/probe.jpg       → 403, RLS violation   ✓
--   truck-photos/truck-photos/<uuid>/…    → 403, RLS violation   ✓
--   menu-photos/menu/<uuid>/probe.jpg     → 200 OK               ✗
--
-- The menu_photos_owner_insert policy from patch 012 cannot be what
-- allowed it. With no session auth.uid() is NULL, so its
-- `t.owner_id = auth.uid()` test is never true and the EXISTS fails.
--
-- Postgres OR's permissive policies together, so exactly one thing
-- explains a 200: another policy on storage.objects still grants INSERT
-- on this bucket. Patch 012's final block reports such policies rather
-- than dropping them, because storage.objects policies are shared with
-- every bucket in the project — including ones this repo knows nothing
-- about. This file does the drop, but scoped only to policies that name
-- one of our three buckets.
--
-- Note the shape of the evidence: the other two buckets rejected the
-- write, so there is no project-wide "allow all" policy. Whatever is
-- open is specific to menu-photos.
--
-- Anonymous DELETE was correctly refused throughout — only INSERT leaked.


-- ── 1. What is actually on storage.objects right now ─────────
-- Read this before running section 2. Anything not in the eleven
-- canonical names is a candidate for removal.
SELECT
  policyname,
  cmd,
  roles,
  qual       AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd, policyname;


-- ── 2. Drop non-canonical policies naming our three buckets ──
-- Scoped deliberately: a policy is only dropped if its definition
-- mentions avatars, menu-photos or truck-photos AND it is not one of
-- the eleven patch 012 defines. Policies for other buckets, and any
-- policy with no bucket_id test at all, are reported and left alone —
-- the latter would need your judgement, and the probe results above
-- show there isn't one.
DO $$
DECLARE
  keep text[] := ARRAY[
    'avatars_public_read',       'avatars_owner_insert',
    'avatars_owner_update',      'avatars_owner_delete',
    'menu_photos_public_read',   'menu_photos_owner_insert',
    'menu_photos_owner_update',  'menu_photos_owner_delete',
    'truck_photos_public_read',  'truck_photos_auth_insert',
    'truck_photos_uploader_del'
  ];
  r        record;
  defn     text;
  dropped  int := 0;
  flagged  int := 0;
BEGIN
  FOR r IN
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND NOT (policyname = ANY(keep))
  LOOP
    defn := coalesce(r.qual, '') || ' ' || coalesce(r.with_check, '');

    IF defn NOT ILIKE '%bucket_id%' THEN
      flagged := flagged + 1;
      RAISE WARNING
        'GLOBAL policy % (%) applies to EVERY bucket and was NOT dropped — review it by hand.',
        r.policyname, r.cmd;

    ELSIF defn ILIKE '%avatars%'
       OR defn ILIKE '%menu-photos%'
       OR defn ILIKE '%truck-photos%' THEN
      RAISE NOTICE 'Dropping legacy policy: % (%)', r.policyname, r.cmd;
      EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
      dropped := dropped + 1;
    END IF;
  END LOOP;

  RAISE NOTICE 'Dropped % legacy policy/policies; % global policy/policies need review.',
    dropped, flagged;
END $$;


-- ── 3. Verification ──────────────────────────────────────────
-- Should return exactly the eleven canonical policies and nothing else.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Expected, in order:
--   avatars_owner_delete        DELETE
--   avatars_owner_insert        INSERT
--   avatars_owner_update        UPDATE
--   avatars_public_read         SELECT
--   menu_photos_owner_delete    DELETE
--   menu_photos_owner_insert    INSERT
--   menu_photos_owner_update    UPDATE
--   menu_photos_public_read     SELECT
--   truck_photos_auth_insert    INSERT
--   truck_photos_public_read    SELECT
--   truck_photos_uploader_del   DELETE


-- ── 4. Remove the probe object ───────────────────────────────
-- The anonymous upload that exposed this left a 1-byte file behind, and
-- it could not be deleted anonymously because DELETE was never open.
-- This runs as the SQL editor's privileged role, so it can.
DELETE FROM storage.objects
WHERE bucket_id = 'menu-photos'
  AND name = 'menu/00000000-0000-0000-0000-000000000000/probe.jpg';


-- ── 5. Re-test after running this ────────────────────────────
-- From any terminal — every one of these must now return a 403 RLS
-- violation rather than 200. <ANON_KEY> is the public anon key.
--
--   for P in \
--     "avatars/customers/00000000-0000-0000-0000-000000000000.jpg" \
--     "avatars/trucks/00000000-0000-0000-0000-000000000000/probe.jpg" \
--     "menu-photos/menu/00000000-0000-0000-0000-000000000000/probe.jpg" \
--     "truck-photos/truck-photos/00000000-0000-0000-0000-000000000000/probe.jpg"; do
--     printf 'x' | curl -s -o /dev/null -w "%{http_code} $P\n" -X POST \
--       "https://ikrhlifpznzdtgxleubz.supabase.co/storage/v1/object/$P" \
--       -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--       -H "Content-Type: image/jpeg" --data-binary @-
--   done
--
-- Then confirm the real paths still work: as a signed-in operator,
-- upload a truck profile photo and a menu item photo from the dashboard.
