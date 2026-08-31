-- ============================================================
-- HOT TRUCK MAP — Production Patch 012
-- Storage bucket policies, in version control for the first time.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- WHY THIS EXISTS
--
-- Until now the only storage policies tracked in SQL were the four
-- avatars policies from patch 008. Those pinned every write on the
-- `avatars` bucket to the path `customers/<auth.uid()>.<ext>`, because
-- that is what app/account/page.tsx uploads.
--
-- But app/dashboard/page.tsx uploads the OPERATOR'S truck photo to the
-- same bucket at `trucks/<truck-id>/<name>-<timestamp>.<ext>`, which
-- fails that check. The upload path shipped in 05187de; the policy in
-- 8fe42ed. The patch was written against the customer path only.
--
-- So one of two things has been true since patch 008 ran:
--
--   (a) Those four policies are the only ones on the bucket, and
--       operator truck-photo upload has been returning a 403.
--   (b) A broader legacy policy created through the Supabase dashboard
--       is still present, uploads work, and patch 008's tightening
--       never actually took effect — meaning any signed-in user can
--       still overwrite anyone else's avatar at its guessable path.
--
-- This patch handles both: it defines every path the app actually
-- writes, and section 4 finds and drops legacy catch-all policies.
--
-- The `menu-photos` and `truck-photos` buckets had no policies in the
-- repo at all. They are defined here too.
--
-- BEFORE RUNNING: confirm the three buckets exist (Storage → Buckets).
-- Section 0 creates them if they don't.


-- ── 0. Buckets ───────────────────────────────────────────────
-- All three are public-read: menu photos and truck photos appear on
-- pages served to signed-out visitors, so the public URL must resolve
-- without a token. Writes are what the policies below restrict.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',      'avatars',      true),
  ('menu-photos',  'menu-photos',  true),
  ('truck-photos', 'truck-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Cap uploads server-side. The clients already check 5 MB and the three
-- image mime types, but a client check is a courtesy, not a control.
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('avatars', 'menu-photos', 'truck-photos');


-- ── 1. avatars ───────────────────────────────────────────────
-- Two legitimate shapes, and nothing else:
--   customers/<auth.uid()>.<ext>              — app/account/page.tsx
--   trucks/<truck-id>/<anything>.<ext>        — app/dashboard/page.tsx
-- where the caller owns that truck.
DROP POLICY IF EXISTS "avatars_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'avatars'
);

-- Shared predicate, written out per-command because Postgres policies
-- can't call a local function without creating one.
--   folder[1] = 'customers' AND no folder[2] AND filename stem = uid
--   OR
--   folder[1] = 'trucks'    AND folder[2] = a truck this user owns
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND (
    (
      (storage.foldername(name))[1] = 'customers'
      AND (storage.foldername(name))[2] IS NULL
      AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
    )
    OR
    (
      (storage.foldername(name))[1] = 'trucks'
      AND (storage.foldername(name))[2] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars'
  AND (
    (
      (storage.foldername(name))[1] = 'customers'
      AND (storage.foldername(name))[2] IS NULL
      AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
    )
    OR
    (
      (storage.foldername(name))[1] = 'trucks'
      AND (storage.foldername(name))[2] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars'
  AND (
    (
      (storage.foldername(name))[1] = 'customers'
      AND (storage.foldername(name))[2] IS NULL
      AND split_part(storage.filename(name), '.', 1) = auth.uid()::text
    )
    OR
    (
      (storage.foldername(name))[1] = 'trucks'
      AND (storage.foldername(name))[2] IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.trucks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.owner_id = auth.uid()
      )
    )
  )
);


-- ── 2. menu-photos ───────────────────────────────────────────
-- app/dashboard/page.tsx writes menu/<truck-id>/<name>-<ts>.<ext>.
-- Only the truck's owner may write under its folder.
--
-- Note: the dashboard falls back to the literal folder "unknown" when
-- truckId is null. That path is deliberately NOT permitted here — a
-- photo uploaded before the truck row exists can never be attached to
-- an item anyway. The app fix makes that state unreachable.
DROP POLICY IF EXISTS "menu_photos_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "menu_photos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "menu_photos_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "menu_photos_owner_delete" ON storage.objects;

CREATE POLICY "menu_photos_public_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'menu-photos'
);

CREATE POLICY "menu_photos_owner_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'menu-photos'
  AND (storage.foldername(name))[1] = 'menu'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.trucks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.owner_id = auth.uid()
  )
);

CREATE POLICY "menu_photos_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'menu-photos'
  AND (storage.foldername(name))[1] = 'menu'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.trucks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.owner_id = auth.uid()
  )
);

CREATE POLICY "menu_photos_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'menu-photos'
  AND (storage.foldername(name))[1] = 'menu'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.trucks t
    WHERE t.id::text = (storage.foldername(name))[2]
      AND t.owner_id = auth.uid()
  )
);


-- ── 3. truck-photos ──────────────────────────────────────────
-- Community photo submissions from app/truck/[id]/page.tsx:336 and
-- mobile/app/truck/[id].tsx:288.
--
-- Careful with the path: both clients prefix it with the bucket's own
-- name, so the object key is
--
--   truck-photos/<truck-id>/<file>
--
-- inside the `truck-photos` bucket. foldername[1] is the literal string
-- "truck-photos" and foldername[2] is the truck id — not [1] as you'd
-- expect from the other two buckets.
--
-- Unlike avatars and menu-photos, ANY signed-in user may add a photo of
-- ANY truck: that's the community-photo feature. So INSERT only requires
-- a session and a truck that exists.
--
-- For DELETE, the uploader is identified by storage.objects.owner, which
-- Supabase sets automatically. Do NOT try to parse the uploader out of
-- the filename — web writes "<name>-<uid>-<ts>.<ext>" and mobile writes
-- "<uid>-<ts>.<ext>", and the uid is itself hyphenated, so no split_part
-- rule is correct for both. Both clients delete only in one case: the
-- upload succeeded but the truck_photos row insert failed, and they're
-- cleaning up their own orphan.
DROP POLICY IF EXISTS "truck_photos_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "truck_photos_auth_insert"   ON storage.objects;
DROP POLICY IF EXISTS "truck_photos_uploader_del"  ON storage.objects;

CREATE POLICY "truck_photos_public_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'truck-photos'
);

CREATE POLICY "truck_photos_auth_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'truck-photos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'truck-photos'
  AND (storage.foldername(name))[2] IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.trucks t
    WHERE t.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "truck_photos_uploader_del" ON storage.objects FOR DELETE USING (
  bucket_id = 'truck-photos'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trucks t
      WHERE t.id::text = (storage.foldername(name))[2]
        AND t.owner_id = auth.uid()
    )
  )
);


-- ── 4. Find and drop legacy catch-all policies ───────────────
-- If case (b) from the header is what you're in, there is a policy on
-- storage.objects created through the Supabase dashboard that grants
-- broad write access. It is what has been keeping operator uploads
-- working, and it also nullifies everything above — permissive policies
-- are OR'd together, so one open policy defeats every restriction.
--
-- This block is REPORT-ONLY. It does not drop anything.
--
-- It can't safely drop for you: policies on storage.objects are shared
-- across every bucket in the project, so a blind "drop everything I
-- didn't write" would take out policies for buckets this file knows
-- nothing about. Read the notices, then drop what you recognise.
--
-- Two categories are worth your attention:
--
--   LEGACY  — names a bucket this file manages. Almost certainly the
--             thing that has been keeping operator uploads working, and
--             the thing defeating patch 008. Drop it.
--
--   GLOBAL  — has no bucket_id test at all, so it applies to EVERY
--             bucket including ours. One of these makes all eleven
--             policies above decorative, because permissive policies
--             are OR'd. Drop it unless you know why it exists.
--
-- To drop one:  DROP POLICY "<name>" ON storage.objects;
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
  r     record;
  defn  text;
  found int := 0;
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
      found := found + 1;
      RAISE NOTICE
        'GLOBAL  % (%) — applies to EVERY bucket, overrides everything above',
        r.policyname, r.cmd;
    ELSIF defn ILIKE '%avatars%'
       OR defn ILIKE '%menu-photos%'
       OR defn ILIKE '%truck-photos%' THEN
      found := found + 1;
      RAISE NOTICE
        'LEGACY  % (%) — targets a bucket this patch now manages',
        r.policyname, r.cmd;
    END IF;
  END LOOP;

  IF found = 0 THEN
    RAISE NOTICE 'No conflicting policies found — the eleven above are authoritative.';
  ELSE
    RAISE NOTICE '% policy/policies need your review (see above).', found;
  END IF;
END $$;


-- ── Verification ─────────────────────────────────────────────
-- Should list exactly the 11 policies defined above.
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Then, in the app:
--   1. As an operator, upload a truck profile photo   → must succeed
--   2. As an operator, upload a menu item photo       → must succeed
--   3. As a customer, upload an account avatar        → must succeed
--   4. As user A, upload to customers/<user-B-uuid>.jpg → must be rejected
--   5. As user A, upload to trucks/<someone-elses-truck-id>/x.jpg
--                                                     → must be rejected
