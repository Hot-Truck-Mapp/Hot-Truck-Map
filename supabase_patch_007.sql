-- Patch 007: festivals table — city/state food-truck events, browsable by state
--
-- Powers the new "Events" feature (app/events, app/events/[state],
-- app/api/admin/festivals, the admin panel's Festivals tab, and the
-- location-granted "Events near you" banner on the map). Content is
-- entered/maintained monthly by the site owner via the admin panel;
-- every read path filters end_date >= today, so nothing needs to be
-- deleted — old rows simply stop appearing once they've passed.

CREATE TABLE IF NOT EXISTS festivals (
  id            uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name          text NOT NULL,
  state_code    text NOT NULL,              -- 2-letter, e.g. 'NJ', 'DC'
  state_name    text NOT NULL,              -- 'New Jersey' — denormalized for cheap display
  city          text NOT NULL,
  venue         text,
  description   text,
  start_date    date NOT NULL,
  end_date      date NOT NULL,
  website_url   text,
  image_url     text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT festivals_state_code_format CHECK (state_code ~ '^[A-Z]{2}$'),
  CONSTRAINT festivals_dates_valid CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_festivals_state_code ON festivals (state_code);
CREATE INDEX IF NOT EXISTS idx_festivals_end_date    ON festivals (end_date);
CREATE INDEX IF NOT EXISTS idx_festivals_state_end   ON festivals (state_code, end_date);


-- ── festivals — enable RLS ───────────────────────────
-- Public read (drives /events, /events/[state], and the map's "near you"
-- banner); writes only via the /api/admin/festivals route (service role key)
ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE festivals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "festivals_public_read"    ON festivals;
DROP POLICY IF EXISTS "festivals_no_user_insert" ON festivals;
DROP POLICY IF EXISTS "festivals_no_user_update" ON festivals;
DROP POLICY IF EXISTS "festivals_no_user_delete" ON festivals;

CREATE POLICY "festivals_public_read"    ON festivals FOR SELECT USING (true);
-- Writes handled exclusively by the /api/admin/festivals route (service role key)
CREATE POLICY "festivals_no_user_insert" ON festivals FOR INSERT WITH CHECK (false);
CREATE POLICY "festivals_no_user_update" ON festivals FOR UPDATE USING (false);
CREATE POLICY "festivals_no_user_delete" ON festivals FOR DELETE USING (false);
