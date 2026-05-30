-- Patch 003: Fix RLS policies for catering_requests and truck_views,
--            and fix reviews user deletion behaviour.

-- 1. catering_requests INSERT: prevent spoofed customer_id.
--    Allows anonymous inquiries (customer_id IS NULL) or authenticated users
--    who set customer_id to their own uid. Blocks impersonation.
DROP POLICY IF EXISTS "catering_req_insert" ON catering_requests;
CREATE POLICY "catering_req_insert" ON catering_requests
  FOR INSERT WITH CHECK (
    customer_id IS NULL OR customer_id = auth.uid()
  );

-- 2. truck_views INSERT: prevent fake view inflation with fabricated viewer_id.
--    Allows anonymous views (viewer_id IS NULL) or authenticated users whose
--    viewer_id matches their own uid.
DROP POLICY IF EXISTS "truck_views_public_insert" ON truck_views;
CREATE POLICY "truck_views_public_insert" ON truck_views
  FOR INSERT WITH CHECK (
    viewer_id IS NULL OR viewer_id = auth.uid()
  );

-- 3. reviews: cascade-delete reviews when the author's auth account is removed.
--    Previously ON DELETE SET NULL left orphaned reviews that could never be
--    deleted (auth.uid() = NULL is always false in the delete policy).
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
