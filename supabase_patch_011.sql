-- Patch 011: platform announcements
--
-- Backs the admin dashboard's Announce tab — the owner's push broadcast to
-- everyone on the platform, as opposed to an operator broadcasting to their
-- own followers (which already goes through /api/notify-followers).
--
-- This table is the send log, not a queue: a row is written after the fan-out
-- finishes, recording what went out, to whom, and how it landed. It's what
-- makes "did we already tell people about this?" answerable.
--
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS announcements (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title          text NOT NULL,
  body           text NOT NULL,
  url            text,
  audience       text NOT NULL,
  sent_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_email  text,
  -- Users the audience resolved to, after opt-outs were removed. Devices can
  -- exceed this (one person, phone + laptop), which is why sent_count is
  -- tracked separately rather than derived.
  recipients     integer NOT NULL DEFAULT 0,
  devices        integer NOT NULL DEFAULT 0,
  sent_count     integer NOT NULL DEFAULT 0,
  failed_count   integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT announcements_audience_valid
    CHECK (audience IN ('all', 'operators', 'customers')),
  CONSTRAINT announcements_title_length CHECK (length(title) BETWEEN 1 AND 80),
  CONSTRAINT announcements_body_length  CHECK (length(body)  BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_announcements_created_at
  ON announcements (created_at DESC);


-- ── announcements — enable RLS ───────────────────────────────────────
-- No client access at all. Reads and writes happen only in
-- /api/admin/announce using the service role key, behind an owner check —
-- same pattern as newsletter_subscribers and contact_submissions.
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_no_client_select" ON announcements;
DROP POLICY IF EXISTS "announcements_no_client_insert" ON announcements;
DROP POLICY IF EXISTS "announcements_no_client_update" ON announcements;
DROP POLICY IF EXISTS "announcements_no_client_delete" ON announcements;

CREATE POLICY "announcements_no_client_select" ON announcements FOR SELECT USING (false);
CREATE POLICY "announcements_no_client_insert" ON announcements FOR INSERT WITH CHECK (false);
CREATE POLICY "announcements_no_client_update" ON announcements FOR UPDATE USING (false);
CREATE POLICY "announcements_no_client_delete" ON announcements FOR DELETE USING (false);


-- ── Opt-out ──────────────────────────────────────────────────────────
-- There is no table for this on purpose. Announcement opt-out rides on the
-- notification preferences the account page already writes to
-- auth.users.user_metadata.notifications, as the `announcements` key:
--
--   { "newLocation": true, "orderReady": true, "announcements": false }
--
-- user_metadata is user-writable, which would be disqualifying for an access
-- control decision but is exactly right for a preference — the only thing a
-- user can do by editing it is stop their own notifications. A missing key
-- means opted in, matching how the other preferences default.
