-- ============================================================
-- HOT TRUCK MAP — Production Patch 020
-- Add `county` to festivals, so /events/[state] can group events by
-- county and then by town.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- WHY
--
-- Event lists are researched county by county ("BERGEN COUNTY: Ridgefield,
-- Riverdale, Elmwood Park…"), and that is how people look for them — but
-- the table only had `city`, so the county grouping was thrown away on the
-- way in and /events/[state] could only show a flat list of towns.
--
-- The column is nullable on purpose. County is genuinely unknown for some
-- events, and both the web page and the mobile screen fall back to a
-- town-only grouping for rows where it is NULL rather than inventing one.

ALTER TABLE festivals ADD COLUMN IF NOT EXISTS county text;

-- Grouping always filters by state first, so county only needs to be
-- selective within a state.
CREATE INDEX IF NOT EXISTS idx_festivals_state_county ON festivals (state_code, county);


-- ── Backfill the rows seeded before this column existed ──────
-- By city, so re-running stays correct and later rows for the same towns
-- are covered too. Only towns whose county is unambiguous are listed;
-- anything not matched here stays NULL and renders under the town alone.

UPDATE festivals SET county = c.county
FROM (VALUES
    ('NJ', 'East Rutherford', 'Bergen'),
    ('NJ', 'Mahwah',          'Bergen'),
    ('NJ', 'Elmwood Park',    'Bergen'),
    ('NJ', 'Ringwood',        'Passaic'),
    ('NJ', 'Sewell',          'Gloucester'),
    ('NJ', 'Branchburg',      'Somerset'),
    ('NJ', 'Bound Brook',     'Somerset'),
    ('NJ', 'Keyport',         'Monmouth'),
    ('NJ', 'Bayville',        'Ocean'),
    ('NJ', 'New Egypt',       'Ocean'),
    ('NY', 'Schenectady',     'Schenectady')
) AS c(state_code, city, county)
WHERE festivals.state_code = c.state_code
  AND lower(festivals.city) = lower(c.city)
  AND festivals.county IS DISTINCT FROM c.county;


-- ── Verify ───────────────────────────────────────────────────
SELECT county, count(*) AS events
FROM festivals
WHERE state_code = 'NJ'
GROUP BY county
ORDER BY county NULLS LAST;
