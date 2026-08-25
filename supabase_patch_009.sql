-- Patch 009: newsletter_subscribers table
--
-- Powers the email signup form on /newsletter (app/api/newsletter-subscribe)
-- and the one-click unsubscribe link sent in newsletter emails
-- (app/api/newsletter-unsubscribe). No client-side table access at all —
-- every read/write goes through those two API routes using the service
-- role key, same pattern as `orders` and `festivals`.

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id                 uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email              text NOT NULL,
  unsubscribe_token  uuid NOT NULL DEFAULT uuid_generate_v4(),
  subscribed_at      timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at    timestamptz,
  CONSTRAINT newsletter_subscribers_email_format CHECK (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
);

-- Case-insensitive uniqueness — "Foo@Bar.com" and "foo@bar.com" are the same
-- subscriber. API route also lowercases before insert, this is the DB-level
-- backstop.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_email_lower
  ON newsletter_subscribers (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_token
  ON newsletter_subscribers (unsubscribe_token);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter_subscribers_no_client_select" ON newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_subscribers_no_client_insert" ON newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_subscribers_no_client_update" ON newsletter_subscribers;
DROP POLICY IF EXISTS "newsletter_subscribers_no_client_delete" ON newsletter_subscribers;

-- No client access whatsoever — emails are PII and the anon key must never
-- be able to read the subscriber list. All access is via the service role
-- key inside app/api/newsletter-subscribe and app/api/newsletter-unsubscribe.
CREATE POLICY "newsletter_subscribers_no_client_select" ON newsletter_subscribers FOR SELECT USING (false);
CREATE POLICY "newsletter_subscribers_no_client_insert" ON newsletter_subscribers FOR INSERT WITH CHECK (false);
CREATE POLICY "newsletter_subscribers_no_client_update" ON newsletter_subscribers FOR UPDATE USING (false);
CREATE POLICY "newsletter_subscribers_no_client_delete" ON newsletter_subscribers FOR DELETE USING (false);
