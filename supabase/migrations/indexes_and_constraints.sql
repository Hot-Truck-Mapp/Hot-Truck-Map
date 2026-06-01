-- Missing indexes and constraints identified in comprehensive audit

-- 1. follows.truck_id index — used by notification fan-out and analytics queries.
--    The PK is (user_id, truck_id) so truck_id-only queries do a full scan.
CREATE INDEX IF NOT EXISTS idx_follows_truck_id
  ON follows (truck_id);

-- 2. orders.status CHECK constraint — prevents arbitrary status values being
--    written directly via the Supabase client or a compromised token.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_status_check
      CHECK (status IN ('pending', 'preparing', 'ready', 'picked_up', 'no_show', 'cancelled'));
  END IF;
END $$;

-- 3. schedules unique constraint — prevents a truck from having two conflicting
--    schedule rows for the same day of the week.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedules_truck_day_unique'
  ) THEN
    ALTER TABLE schedules
      ADD CONSTRAINT schedules_truck_day_unique UNIQUE (truck_id, day_of_week);
  END IF;
END $$;

-- 4. rate_limit_log: explicit deny-all policy documents intent and prevents
--    future accidental exposure via a misconfigured client.
DROP POLICY IF EXISTS "rate_limit_log_deny_all" ON rate_limit_log;
CREATE POLICY "rate_limit_log_deny_all" ON rate_limit_log
  FOR ALL USING (false) WITH CHECK (false);

-- Confirm indexes
SELECT indexname, tablename FROM pg_indexes
WHERE tablename IN ('follows', 'orders', 'schedules', 'rate_limit_log')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
