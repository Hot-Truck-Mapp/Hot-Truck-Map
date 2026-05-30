-- Shared rate-limit log: replaces per-process in-memory Maps that were
-- silently bypassed in Vercel's multi-instance serverless deployment.
-- All API routes that need rate limiting read/write this table.

CREATE TABLE IF NOT EXISTS rate_limit_log (
  key        TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_time
  ON rate_limit_log (key, created_at DESC);

-- RLS: only the service role can read/write this table
ALTER TABLE rate_limit_log ENABLE ROW LEVEL SECURITY;
