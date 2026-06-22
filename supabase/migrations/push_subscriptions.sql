CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('web', 'expo')),
  endpoint text NOT NULL,   -- web: push endpoint URL; expo: expo push token
  p256dh text,              -- web push only
  auth_key text,            -- web push only (named auth_key to avoid clashing with Supabase reserved names)
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Index for fast follower lookups in the notifications route
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);
