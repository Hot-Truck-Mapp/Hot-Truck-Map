-- ============================================================
-- HOT TRUCK MAP — Production Patch 001
-- Run this in your Supabase SQL Editor (supabase.com → project
-- → SQL Editor → New query → paste & Run)
-- Safe to run multiple times (all statements are idempotent)
-- ============================================================


-- 1. Add is_active column to catering_packages
--    Allows operators to enable / disable packages without deleting them
ALTER TABLE catering_packages ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;


-- 2. Fix followers analytics — truck owners could not read their own follower
--    counts because the existing RLS policy only allowed a user to see rows
--    where THEY are the follower (auth.uid() = user_id), which blocked the
--    operator's dashboard analytics query that filters by truck_id.
--
--    This adds a second SELECT policy so truck owners can also read all follows
--    for their truck.

DROP POLICY IF EXISTS "follows_owner_read" ON follows;
CREATE POLICY "follows_owner_read" ON follows FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id LIMIT 1)
);
