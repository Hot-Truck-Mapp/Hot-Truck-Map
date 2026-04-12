-- notification_preferences: per-user opt-in/out settings, persisted to DB
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  go_live_alerts  BOOLEAN NOT NULL DEFAULT true,
  moved_alerts    BOOLEAN NOT NULL DEFAULT true,
  weekly_digest   BOOLEAN NOT NULL DEFAULT false,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- push_subscriptions: OneSignal player IDs linked to users
-- last_lat/last_lng used for 5-mile proximity filter on go-live notifications
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  onesignal_player_id  TEXT NOT NULL,
  last_lat             DOUBLE PRECISION,
  last_lng             DOUBLE PRECISION,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, onesignal_player_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users manage own subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (used by notification API routes) can read all subscriptions
CREATE POLICY "Service role reads all subscriptions"
  ON push_subscriptions
  FOR SELECT
  TO service_role
  USING (true);
