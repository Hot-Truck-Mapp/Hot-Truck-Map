-- =============================================================================
-- No-Show Prevention System
-- Adds order accountability: no_show/cancelled statuses, status timestamps,
-- and supports auto-cancellation of stale "ready" orders.
-- =============================================================================

-- 1. Add status_updated_at column — tracks when order status last changed
--    Used by auto-cancel cron to find orders stuck in "ready" too long.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_updated_at timestamptz DEFAULT now();

-- Backfill existing rows: set status_updated_at = created_at for old orders
UPDATE orders SET status_updated_at = created_at WHERE status_updated_at IS NULL;

-- 2. Trigger: auto-set status_updated_at whenever status changes
CREATE OR REPLACE FUNCTION update_order_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_status_updated ON orders;
CREATE TRIGGER order_status_updated
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_status_timestamp();

-- 3. Index for auto-cancel cron: find "ready" orders efficiently
CREATE INDEX IF NOT EXISTS idx_orders_status_updated
  ON orders (status, status_updated_at)
  WHERE status IN ('pending', 'preparing', 'ready');

-- 4. Index for no-show count lookups by customer
CREATE INDEX IF NOT EXISTS idx_orders_customer_noshow
  ON orders (customer_id, status)
  WHERE status = 'no_show';
