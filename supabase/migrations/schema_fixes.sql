-- Patch: schema integrity fixes identified in audit pass 5

-- 1. reviews: add unique constraint so one user can't post multiple reviews
--    for the same truck (client-side duplicate check was non-atomic).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reviews_truck_user_unique'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_truck_user_unique UNIQUE (truck_id, user_id);
  END IF;
END $$;

-- 2. orders: add index on customer_id for order history queries and the
--    no-show count lookup that runs on every order placement.
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders (customer_id)
  WHERE customer_id IS NOT NULL;

-- 3. rate_limit_log: add a cleanup index and a periodic delete of old rows.
--    Rows older than 2 hours can never affect any rate limit window,
--    so they're safe to prune. Run this manually or via a pg_cron job.
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_cleanup
  ON rate_limit_log (created_at);

-- Manual cleanup (safe to run at any time):
-- DELETE FROM rate_limit_log WHERE created_at < now() - interval '2 hours';

-- 4. catering_messages SELECT: restrict to actual thread participants only.
--    Drop the overly-broad sender_id branch — every sender is either the truck
--    owner or the customer, both already covered by the two explicit branches.
DROP POLICY IF EXISTS "catering_msg_read" ON catering_messages;
CREATE POLICY "catering_msg_read" ON catering_messages FOR SELECT USING (
  auth.uid() = (
    SELECT t.owner_id FROM trucks t
    JOIN catering_requests cr ON cr.truck_id = t.id
    WHERE cr.id = request_id
    LIMIT 1
  )
  OR auth.uid() = (
    SELECT customer_id FROM catering_requests WHERE id = request_id
  )
);
