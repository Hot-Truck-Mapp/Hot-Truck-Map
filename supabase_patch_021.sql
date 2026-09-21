-- ============================================================
-- HOT TRUCK MAP — Production Patch 021
-- Trustworthy presence + wait times.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- WHY
--
-- The whole product rests on "this truck is here right now", and until now
-- nothing checked that claim. `trucks.is_live` was an operator toggle, the
-- only thing that ever cleared it was an hourly cron with a 12-hour staleness
-- window, and the age of a truck's last GPS ping was never shown anywhere a
-- customer decides whether to walk over. One wasted trip is all it takes to
-- lose a customer permanently.
--
-- This patch adds the data behind four changes:
--
--   1. presence_reports — one-tap "still here?" / "they're gone" from
--      customers standing in front of the truck. Crowd-verified presence.
--   2. wait_reports + trucks.wait_minutes — how long the line is, reported by
--      customers or set by the operator. Nobody else in food delivery has it.
--   3. live_sessions — a row per Go Live → Go Offline. The location table is
--      an upsert with one row per truck, so no history of "was this truck
--      actually out on Tuesday?" existed. Reliability can't be measured
--      without it, so the log starts now and the badge appears once a truck
--      has enough history to judge fairly.
--   4. trucks.timezone — schedules store wall-clock text ("4:00 PM") in the
--      truck's local time. The auto-offline cron runs in UTC, so comparing
--      them without a zone is wrong by the offset. Defaults to the zone
--      essentially all current trucks are in; per-truck overrides are honored.
--
-- Reporter identity: reports are written by the API routes with the service
-- role. Signed-in customers are keyed by user id; anonymous ones by a salted
-- hash of their IP, which is what `reporter_key` holds. One tap should not
-- require an account — requiring sign-in for a confirmation tap collapses the
-- volume that makes the signal useful — but one device must not be able to
-- stuff the ballot either.


-- ── 1. presence_reports ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS presence_reports (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id     uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- 'user:<uuid>' when signed in, 'ip:<sha256>' when not.
  reporter_key text NOT NULL,
  verdict      text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE presence_reports ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'presence_verdict_valid') THEN
    ALTER TABLE presence_reports
      ADD CONSTRAINT presence_verdict_valid CHECK (verdict IN ('here', 'gone'));
  END IF;
END $$;

-- Every read is "recent reports for this truck".
CREATE INDEX IF NOT EXISTS idx_presence_reports_truck_time
  ON presence_reports (truck_id, created_at DESC);
-- Backs the per-reporter rate limit.
CREATE INDEX IF NOT EXISTS idx_presence_reports_reporter
  ON presence_reports (reporter_key, truck_id, created_at DESC);

ALTER TABLE presence_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_public_read"   ON presence_reports;
DROP POLICY IF EXISTS "presence_no_client_write" ON presence_reports;

-- Counts are public — they're shown on the truck page and the map popup.
CREATE POLICY "presence_public_read"     ON presence_reports FOR SELECT USING (true);
-- Writes go through /api/presence only, so the rate limit can't be bypassed
-- by posting straight to PostgREST with the anon key.
CREATE POLICY "presence_no_client_write" ON presence_reports FOR INSERT WITH CHECK (false);


-- ── 2. wait_reports ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wait_reports (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id     uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_key text NOT NULL,
  -- Buckets, not free text: 0 = no line, 10, 20, 30 = 30-or-more.
  minutes      integer NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE wait_reports ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wait_minutes_valid') THEN
    ALTER TABLE wait_reports
      ADD CONSTRAINT wait_minutes_valid CHECK (minutes IN (0, 10, 20, 30));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wait_reports_truck_time
  ON wait_reports (truck_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wait_reports_reporter
  ON wait_reports (reporter_key, truck_id, created_at DESC);

ALTER TABLE wait_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wait_public_read"     ON wait_reports;
DROP POLICY IF EXISTS "wait_no_client_write" ON wait_reports;

CREATE POLICY "wait_public_read"     ON wait_reports FOR SELECT USING (true);
CREATE POLICY "wait_no_client_write" ON wait_reports FOR INSERT WITH CHECK (false);


-- ── 3. Operator-set wait, on the truck itself ───────────────
-- The operator can see the line; their number beats the crowd's while it is
-- fresh. `wait_set_at` is what makes it expire instead of going stale on the
-- map after they stop updating it.
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS wait_minutes integer;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS wait_set_at  timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trucks_wait_minutes_valid') THEN
    ALTER TABLE trucks
      ADD CONSTRAINT trucks_wait_minutes_valid
      CHECK (wait_minutes IS NULL OR wait_minutes IN (0, 10, 20, 30));
  END IF;
END $$;


-- ── 4. live_sessions ────────────────────────────────────────
-- One row per Go Live. `ended_by` records who closed it, which is also how we
-- tell a truck that finished its service from one whose phone died:
--   'operator' — tapped Go Offline
--   'schedule' — cron closed it after its posted close time
--   'stale'    — cron closed it after the heartbeat window elapsed
--   'disputed' — enough customers reported an empty curb
CREATE TABLE IF NOT EXISTS live_sessions (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id   uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz,
  ended_by   text,
  created_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'live_sessions_ended_by_valid') THEN
    ALTER TABLE live_sessions
      ADD CONSTRAINT live_sessions_ended_by_valid
      CHECK (ended_by IS NULL OR ended_by IN ('operator', 'schedule', 'stale', 'disputed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_live_sessions_truck_start
  ON live_sessions (truck_id, started_at DESC);
-- Finding the session to close when a truck goes offline.
CREATE INDEX IF NOT EXISTS idx_live_sessions_open
  ON live_sessions (truck_id) WHERE ended_at IS NULL;

ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_sessions_public_read" ON live_sessions;
DROP POLICY IF EXISTS "live_sessions_owner_write" ON live_sessions;
DROP POLICY IF EXISTS "live_sessions_owner_update" ON live_sessions;

-- Public read: the reliability badge is computed from these and anyone can
-- verify it. Writes are restricted to the truck's own operator (the dashboard
-- opens and closes sessions client-side, same as it flips is_live).
CREATE POLICY "live_sessions_public_read"  ON live_sessions FOR SELECT USING (true);
CREATE POLICY "live_sessions_owner_write"  ON live_sessions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM trucks t WHERE t.id = truck_id AND t.owner_id = auth.uid()));
CREATE POLICY "live_sessions_owner_update" ON live_sessions FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM trucks t WHERE t.id = truck_id AND t.owner_id = auth.uid()))
  -- WITH CHECK as well as USING, or an operator could close their own session
  -- by reassigning it to somebody else's truck.
  WITH CHECK (EXISTS (SELECT 1 FROM trucks t WHERE t.id = truck_id AND t.owner_id = auth.uid()));


-- ── 5. Reliability, stored on the truck ─────────────────────
-- Recomputed nightly by /api/trucks/reliability from live_sessions vs
-- schedules. Stored rather than computed on read so the map and every truck
-- card can show it without a per-render aggregate query.
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS reliability_score      numeric;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS reliability_stops      integer;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS reliability_updated_at timestamptz;


-- ── 6. Truck-local time for schedules ───────────────────────
-- `schedules.open_time` / `close_time` are wall-clock text in the truck's own
-- time zone. The cron runs in UTC; without this column it would close an
-- 8:00 PM ET service five hours early. The default matches where the trucks
-- on the platform currently operate — an operator elsewhere gets an explicit
-- value rather than a silent wrong answer.
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';
UPDATE trucks SET timezone = 'America/New_York' WHERE timezone IS NULL;


-- ── 7. Backfill an open session for trucks already live ─────
-- Without this, a truck that is live right now never gets its session closed
-- by the cron, and its first reliability sample would be missing.
INSERT INTO live_sessions (truck_id, started_at)
SELECT t.id, COALESCE(l.broadcasted_at, now())
FROM trucks t
LEFT JOIN locations l ON l.truck_id = t.id
WHERE t.is_live = true
  AND NOT EXISTS (
    SELECT 1 FROM live_sessions s WHERE s.truck_id = t.id AND s.ended_at IS NULL
  );
