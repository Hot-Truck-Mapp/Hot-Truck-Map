-- Patch 008: close catering_messages IDOR + pin down the avatars storage policy
--
-- Found during a full security audit (2026-08-25).

-- ── 1. catering_messages: INSERT policy only checked "are you inserting as
-- yourself", never "are you actually a participant in this catering
-- conversation". Any authenticated user could call the Supabase client
-- directly with their own JWT + an arbitrary request_id and inject a message
-- into someone else's truck-owner <-> customer thread. Bring INSERT in line
-- with the existing catering_msg_read policy, which already scopes correctly
-- to the truck owner or the customer on that request.
DROP POLICY IF EXISTS "catering_msg_insert" ON catering_messages;
CREATE POLICY "catering_msg_insert" ON catering_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND (
    auth.uid() = (
      SELECT owner_id FROM trucks t
      JOIN catering_requests cr ON cr.truck_id = t.id
      WHERE cr.id = request_id
      LIMIT 1
    )
    OR auth.uid() = (
      SELECT customer_id FROM catering_requests WHERE id = request_id
    )
  )
);

-- ── 2. avatars storage bucket: pin down path-scoped write access.
-- app/account/page.tsx uploads to `customers/${user.id}.jpg` using only the
-- anon key + session. Without a policy scoping writes to the caller's own
-- uid, any authenticated user could overwrite another user's avatar at its
-- guessable path. Verify the "avatars" bucket exists in Storage before
-- running this (created via the dashboard, not tracked in SQL migrations).
DROP POLICY IF EXISTS "avatars_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_insert"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete"  ON storage.objects;

CREATE POLICY "avatars_public_read" ON storage.objects FOR SELECT USING (
  bucket_id = 'avatars'
);
-- Object path must be "customers/<uid>.<ext>" — the folder segment after
-- "customers" must equal the caller's own auth.uid().
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'customers'
  AND (storage.foldername(name))[2] IS NULL
  AND split_part((storage.filename(name)), '.', 1) = auth.uid()::text
);
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'customers'
  AND (storage.foldername(name))[2] IS NULL
  AND split_part((storage.filename(name)), '.', 1) = auth.uid()::text
);
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'customers'
  AND (storage.foldername(name))[2] IS NULL
  AND split_part((storage.filename(name)), '.', 1) = auth.uid()::text
);


-- ── Verification ──────────────────────────────────────────────────────────
-- 1. As user A, try inserting a catering_messages row against a
--    request_id you are NOT the owner/customer on — must be rejected.
-- 2. As user A, try uploading to storage path
--    "customers/<user-B-uuid>.jpg" in the avatars bucket — must be rejected.
-- 3. Confirm existing avatar uploads by their own owner still succeed.
