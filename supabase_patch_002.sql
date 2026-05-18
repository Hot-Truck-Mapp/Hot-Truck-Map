-- ============================================================
-- HOT TRUCK MAP — Production Patch 002
-- Run this in your Supabase SQL Editor (supabase.com → project
-- → SQL Editor → New query → paste & Run)
-- Safe to run multiple times (all statements are idempotent)
-- ============================================================


-- ── 1. push_subscriptions — enable RLS ──────────────────────
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_sub_own_read"   ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_own_insert" ON push_subscriptions;
DROP POLICY IF EXISTS "push_sub_own_delete" ON push_subscriptions;

-- Users can only see, add, or remove their own subscriptions
CREATE POLICY "push_sub_own_read"   ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_sub_own_insert" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_sub_own_delete" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);


-- ── 2. truck_photos — enable RLS ────────────────────────────
-- Assumes truck_photos has columns: id, truck_id, user_id (uploader), url, etc.
ALTER TABLE truck_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "truck_photos_public_read"  ON truck_photos;
DROP POLICY IF EXISTS "truck_photos_auth_insert"  ON truck_photos;
DROP POLICY IF EXISTS "truck_photos_own_delete"   ON truck_photos;
DROP POLICY IF EXISTS "truck_photos_owner_delete" ON truck_photos;

CREATE POLICY "truck_photos_public_read"  ON truck_photos FOR SELECT USING (true);
-- Auth users can submit community photos
CREATE POLICY "truck_photos_auth_insert"  ON truck_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can delete their own photos; truck owners can also delete photos for their trucks
CREATE POLICY "truck_photos_own_delete"   ON truck_photos FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "truck_photos_owner_delete" ON truck_photos FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id LIMIT 1)
);


-- ── 3. spotted_posts — enable RLS ───────────────────────────
-- Assumes spotted_posts has columns: id, truck_id, user_id, note, location, etc.
ALTER TABLE spotted_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spotted_public_read"  ON spotted_posts;
DROP POLICY IF EXISTS "spotted_auth_insert"  ON spotted_posts;
DROP POLICY IF EXISTS "spotted_own_delete"   ON spotted_posts;

CREATE POLICY "spotted_public_read"  ON spotted_posts FOR SELECT USING (true);
CREATE POLICY "spotted_auth_insert"  ON spotted_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "spotted_own_delete"   ON spotted_posts FOR DELETE USING (auth.uid() = user_id);


-- ── 4. contact_submissions — enable RLS ─────────────────────
-- Written exclusively via API route (no client reads needed)
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_no_public_read"   ON contact_submissions;
DROP POLICY IF EXISTS "contact_no_public_write"  ON contact_submissions;

-- No direct client-side reads — data is accessed only via service role (API route)
CREATE POLICY "contact_no_public_read"  ON contact_submissions FOR SELECT USING (false);
-- No direct client-side writes — inserts go through the /api/contact API route (service role)
CREATE POLICY "contact_no_public_write" ON contact_submissions FOR INSERT WITH CHECK (false);


-- ── 5. site_settings — enable RLS ───────────────────────────
-- Public read (drives the homepage featured truck banner); admin-only writes via API
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_settings_public_read"    ON site_settings;
DROP POLICY IF EXISTS "site_settings_no_user_insert" ON site_settings;
DROP POLICY IF EXISTS "site_settings_no_user_update" ON site_settings;

CREATE POLICY "site_settings_public_read"    ON site_settings FOR SELECT USING (true);
-- Writes handled exclusively by the /api/admin/save-settings route (service role key)
CREATE POLICY "site_settings_no_user_insert" ON site_settings FOR INSERT WITH CHECK (false);
CREATE POLICY "site_settings_no_user_update" ON site_settings FOR UPDATE USING (false);


-- ── 6. reviews — add DB-level CHECK constraints ──────────────
-- Prevents bypassing the client/API length limits via direct anon-key API calls
ALTER TABLE reviews
  ADD CONSTRAINT IF NOT EXISTS reviews_comment_length
    CHECK (comment IS NULL OR length(comment) <= 500);

ALTER TABLE reviews
  ADD CONSTRAINT IF NOT EXISTS reviews_rating_range
    CHECK (rating >= 1 AND rating <= 5);


-- ── 7. spotted_posts — add length constraints ────────────────
-- Guard against oversized strings submitted directly via anon key
ALTER TABLE spotted_posts
  ADD CONSTRAINT IF NOT EXISTS spotted_note_length
    CHECK (note IS NULL OR length(note) <= 300);


-- ── 8. push_subscriptions — add length constraints ───────────
ALTER TABLE push_subscriptions
  ADD CONSTRAINT IF NOT EXISTS push_sub_endpoint_length
    CHECK (length(endpoint) <= 2048);
