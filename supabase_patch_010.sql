-- Patch 010: admin operations support
--
-- Adds the one column the admin dashboard's contact inbox needs, plus
-- indexes for the platform-wide list views it introduces (orders, catering,
-- reviews, contact). Everything here is idempotent — safe to re-run.


-- ── contact_submissions: mark a message as dealt with ────────────────
-- The contact form has always written here, but nothing could read it back
-- (RLS is USING (false) for clients). The admin dashboard now reads it via
-- the service role, so the owner needs a way to clear handled messages
-- without deleting them.
ALTER TABLE contact_submissions
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;

-- Partial index: the inbox's default view is "unhandled, newest first"
CREATE INDEX IF NOT EXISTS idx_contact_submissions_unhandled
  ON contact_submissions (created_at DESC)
  WHERE handled_at IS NULL;


-- ── Indexes for the admin dashboard's cross-truck list views ─────────
-- These tables were only ever queried per-truck before; the admin views
-- sort the whole table by recency and filter by status.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders (status);

CREATE INDEX IF NOT EXISTS idx_catering_requests_created_at
  ON catering_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_catering_requests_status
  ON catering_requests (status);

CREATE INDEX IF NOT EXISTS idx_reviews_created_at
  ON reviews (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spotted_posts_created_at
  ON spotted_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_truck_photos_created_at
  ON truck_photos (created_at DESC);
