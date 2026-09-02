-- ============================================================
-- HOT TRUCK MAP — Production Patch 019
-- September 2026 New Jersey festivals & events content drop.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- WHAT / WHY
--
-- Adds 60 New Jersey festivals and events for September 2026 to the
-- `festivals` table, and enriches 5 rows that were already seeded for
-- the same events (venue/times/highlights were missing).
--
-- No code changes accompany this patch. Both read surfaces —
-- app/events/[state] on the web and mobile/app/events/[state].tsx in
-- the iOS/Android apps — select straight from `festivals` filtered by
-- state_code + end_date >= today, so new rows appear on the website and
-- in both apps the moment this runs. No deploy or app release needed.
--
-- Dates are 2026 (verified against weekday/holiday anchors in the
-- source list: Labor Day 2026 = Mon Sept 7; the Sept 4 Glassboro car
-- show is a Friday evening; all "Sept 12/19/26" entries are Saturdays).
--
-- `festivals` has no county column, so the source list's county
-- groupings are not stored — events are grouped by city on both
-- surfaces. Times and highlights go in `description`, which the web
-- card and the mobile event detail screen both render.
--
-- Inserts are guarded by NOT EXISTS on (state_code, name, city,
-- start_date) so re-running this file inserts nothing a second time.
--
-- NOT INCLUDED — three events in the source list had no date and a
-- date is required by the schema. See the commented block at the
-- bottom; fill in the dates and run that block, or add them through
-- the admin panel's Festivals tab.
-- ============================================================


-- ── 1. Enrich the 5 already-seeded September rows ────────────
-- Matched by id so a re-run is a no-op rewrite of the same values.

UPDATE festivals SET
  description = '11 AM–6 PM. Food trucks, live music, pony rides and a petting zoo.',
  updated_at  = now()
WHERE id = '2b4064b2-f908-424a-b93a-7343fb7221a1';  -- Bayville, Sept 5

UPDATE festivals SET
  name        = 'Grape Stomping Food Truck Festival at Laurita Winery',
  description = 'Food trucks, grape stomping and live music at the winery.',
  updated_at  = now()
WHERE id = '100cec58-e245-4608-8f9a-fd6b18305c6f';  -- New Egypt, Sept 12–13

UPDATE festivals SET
  name        = 'La Dolce Vita Italian Food Festival at Laurita Winery',
  description = 'Italian food, music and vendors in the winery setting.',
  updated_at  = now()
WHERE id = 'becd884f-4578-4b9b-8ae9-3c350bd2780e';  -- New Egypt, Sept 19–20

UPDATE festivals SET
  description = '11 AM–5 PM. Community day street fair with a food truck festival.',
  updated_at  = now()
WHERE id = '19c7b67f-096a-4f95-b748-744be3774c2c';  -- Elmwood Park, Sept 19

UPDATE festivals SET
  venue       = 'Billian-Legion Park',
  description = '11 AM–7 PM. Community day with food trucks and community activities.',
  updated_at  = now()
WHERE id = '96aecc40-0da6-429a-8f0a-543d52cd5645';  -- Bound Brook, Sept 19


-- ── 2. Insert the 60 new September 2026 NJ events ────────────

WITH incoming (name, city, venue, description, start_date, end_date) AS (
  VALUES
    -- Bergen area
    ('Ridgefield PBA 330 Food Truck Festival'::text, 'Ridgefield'::text, 'Veterans Memorial Field, 554 Shaler Blvd'::text, '11 AM–7 PM. Food-truck focused festival hosted by Ridgefield PBA Local 330.'::text, DATE '2026-09-12', DATE '2026-09-12'),
    ('Riverdale Labor Day Street Fair & Food Truck Fest', 'Riverdale', 'Newark Pompton Turnpike', '10 AM–5 PM. 15+ food trucks, live entertainment, vendors and kids activities.', DATE '2026-09-07', DATE '2026-09-07'),
    ('Bergen County Fall Harvest Festival', 'Ridgefield Park', 'Overpeck County Park', 'Three days of carnival rides, food trucks, a craft fair, farmers market and petting zoo.', DATE '2026-09-18', DATE '2026-09-20'),
    ('Wallisch Homestead Fall Flea & Vintage Marketplace', 'West Milford', 'Wallisch Homestead', 'Vintage and flea market vendors with a food and vendor component.', DATE '2026-09-20', DATE '2026-09-20'),
    ('Saddle Brook Street Fair & Craft Show', 'Saddle Brook', NULL, 'Food vendors, live entertainment and arts & crafts.', DATE '2026-09-20', DATE '2026-09-20'),

    -- Essex
    ('Pet Palooza & Food Truck Festival', 'Livingston', 'Livingston Gazebo, 7 Civic Center Road', 'Noon–6 PM. Pet-focused festival with food trucks.', DATE '2026-09-19', DATE '2026-09-19'),
    ('Our Lady of the Lake Food Truck Festival', 'Verona', 'Our Lady of the Lake Church', '11:30 AM–4:30 PM. Parish food truck festival.', DATE '2026-09-26', DATE '2026-09-26'),

    -- Gloucester
    ('21st Annual Car Show & Food Truck Festival', 'Glassboro', 'Downtown Glassboro', '5–9 PM. 20+ food trucks, 250–300 show cars, live music and beer gardens.', DATE '2026-09-04', DATE '2026-09-04'),
    ('St. Anthony''s Italian Festival', 'Glassboro', 'Downtown Glassboro', '2–10 PM. Italian food, music and vendors.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Apple & Food Truck Festival', 'Sewell', 'Duffield''s Farm Market', '11 AM–5 PM. Food Truck Alley, apple picking, live music and family activities.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Pitman Fall Craft Show', 'Pitman', NULL, 'Food trucks alongside crafters, local businesses and nonprofits.', DATE '2026-09-19', DATE '2026-09-19'),

    -- Hudson
    ('All About Downtown Street Fair', 'Jersey City', 'Newark Avenue & Grove Street', '12–8 PM. 15th annual downtown street fair — food and drink, vendors and entertainment.', DATE '2026-09-19', DATE '2026-09-19'),
    ('Everything Flea & Collectibles Market', 'Kearny', 'Frank A. Vincent Marina', 'Flea and collectibles market with a food and vendor component.', DATE '2026-09-13', DATE '2026-09-13'),
    ('Fall Flea & Collectibles Show', 'North Bergen', NULL, 'Food, vendors and shopping.', DATE '2026-09-19', DATE '2026-09-19'),

    -- Hunterdon
    ('Frenchtown Riverfest', 'Frenchtown', NULL, 'Four days of food vendors, live entertainment, arts & crafts and family activities.', DATE '2026-09-03', DATE '2026-09-06'),
    ('Tewksbury Harvest Festival', 'Tewksbury', 'Christie Hoffman Farm Park', 'Noon–5 PM. Sweet and savory food trucks, live bands, beer garden and harvest activities.', DATE '2026-09-26', DATE '2026-09-26'),

    -- Mercer / New Egypt
    ('Trenton RiverFest', 'Trenton', 'Trenton Thunder Ballpark', 'Live music, craft beer, Delaware River activities, food vendors and the Pork Roll Eating Championship.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Street Eats & Brews Festival', 'New Egypt', 'Dancer Farm', 'Food trucks and craft brews at Dancer Farm.', DATE '2026-09-26', DATE '2026-09-27'),

    -- Middlesex / Somerset
    ('Raritan Borough Food Truck & Music Festival', 'Raritan', 'Washington School Park', '11 AM–7 PM. Food trucks and live music.', DATE '2026-09-26', DATE '2026-09-26'),
    ('Dunellen Fall Street Fair & Craft Show', 'Dunellen', NULL, 'Food vendors, arts & crafts, music and family activities.', DATE '2026-09-13', DATE '2026-09-13'),
    ('Dunellen Fall Open-Air Market', 'Dunellen', NULL, 'Community open-air market with vendors and food.', DATE '2026-09-20', DATE '2026-09-20'),
    ('Pork Roll vs. Taylor Ham Food & Music Festival', 'Hillsborough', 'Iron Peak Sports Complex', 'Noon–7 PM. Food battles, live music, beer garden, wrestling and a Kids Adventure Zone.', DATE '2026-09-12', DATE '2026-09-12'),

    -- Monmouth
    ('BBQ & Craft Beer Festival', 'Oceanport', 'Monmouth Park', 'Three days of BBQ, craft beer, live music and food vendors.', DATE '2026-09-05', DATE '2026-09-07'),
    ('Food Trucktemberfest', 'Oceanport', 'Monmouth Park', 'Food trucks and entertainment at Monmouth Park.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Wind & Sea Festival', 'Port Monmouth', NULL, 'Food, coastal activities, vendors and family activities.', DATE '2026-09-19', DATE '2026-09-19'),
    ('Festival of the Sea', 'Point Pleasant Beach', NULL, 'Nearly 250 craft vendors, food and live entertainment — a major shore event.', DATE '2026-09-19', DATE '2026-09-19'),
    ('Holmdel Harvest Home Festival', 'Holmdel', NULL, 'Local vendors, food, crafts, games and entertainment.', DATE '2026-09-27', DATE '2026-09-27'),
    ('Sea.Hear.Now Festival', 'Asbury Park', 'Asbury Park beachfront', 'Major music and surf festival with large crowds and food vendors.', DATE '2026-09-19', DATE '2026-09-20'),

    -- Morris
    ('Fall Chester Craft Show', 'Chester', NULL, '175+ makers, food and arts & crafts.', DATE '2026-09-12', DATE '2026-09-13'),
    ('NJ Feast of San Gennaro', 'Mine Hill', NULL, 'Italian food, music and the traditional procession.', DATE '2026-09-13', DATE '2026-09-13'),
    ('Vets Summer Fest', 'Budd Lake', 'Vasa Park', 'Food trucks, live bands, beer garden and a motorcycle event.', DATE '2026-09-13', DATE '2026-09-13'),
    ('Hanover Township PBA Food, Wine & Brew Festival', 'Whippany', 'Bee Meadow Park', 'Noon–6 PM. Food, wine and beer.', DATE '2026-09-26', DATE '2026-09-26'),
    ('Boonton Labor Day Parade & Carnival', 'Boonton', NULL, 'Food, rides, live music and fireworks over Labor Day weekend.', DATE '2026-09-03', DATE '2026-09-06'),

    -- Ocean
    ('Lacey Elks Labor Day Food Trucks & Live Music', 'Forked River', NULL, '10 AM–9 PM. Food trucks, live bands and family activities.', DATE '2026-09-07', DATE '2026-09-07'),
    ('Comfort Food Festival', 'Toms River', 'Downtown Toms River', 'Noon–6 PM. Comfort food and vendors downtown.', DATE '2026-09-19', DATE '2026-09-19'),

    -- Passaic
    ('Clifton Food Truck & Music Festival', 'Clifton', 'Clifton Municipal Complex', '11 AM–7 PM. Food trucks, live bands, beer and wine garden, car show and children''s zone.', DATE '2026-09-06', DATE '2026-09-06'),
    ('West Milford Food Truck & Family Fun Festival', 'West Milford', 'Wallisch Homestead', '11 AM–7 PM. Food trucks and family activities.', DATE '2026-09-12', DATE '2026-09-12'),

    -- Salem
    ('Pennsville Septemberfest', 'Pennsville', NULL, 'Food vendors, crafts, live music, rides and fireworks.', DATE '2026-09-12', DATE '2026-09-12'),

    -- Sussex / Warren
    ('Dream Asia Festival', 'Augusta', 'Sussex County Fairgrounds', 'Three-day Asian cultural celebration with food, music and vendors.', DATE '2026-09-05', DATE '2026-09-07'),
    ('Sussex County Day', 'Augusta', 'Sussex County Fairgrounds', 'Food trucks, classic cars, vendors, live music and kids activities.', DATE '2026-09-20', DATE '2026-09-20'),
    ('Sweet Corn & Garlic Festival', 'Hackettstown', 'Donaldson Farms', 'Noon–7 PM. Food, agriculture and family activities.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Hackettstown Oktoberfest', 'Hackettstown', NULL, 'Food trucks, craft beer, live entertainment and a kids zone.', DATE '2026-09-26', DATE '2026-09-27'),

    -- Union
    ('Fanny Wood Day Street Fair & Food Truck Fest', 'Fanwood', 'South Avenue & Martine Avenue', '10 AM–5 PM. Food trucks, street fair and vendors.', DATE '2026-09-27', DATE '2026-09-27'),
    ('Many Flavors of Linden Fall Festival', 'Linden', 'Linden City Hall', '1–9 PM. International and cultural food, vendors and entertainment.', DATE '2026-09-26', DATE '2026-09-26'),

    -- Atlantic
    ('Ventnor 1st Annual Food Truck Festival', 'Ventnor City', 'Ski Beach', 'Sept 4 and 5: 3–9 PM; Sept 6: 3–6 PM. Multiple food trucks and live music.', DATE '2026-09-04', DATE '2026-09-06'),
    ('Downbeach Seafood Festival', 'Ventnor City', 'Ski Beach', 'Seafood and food vendors, oyster events, craft beer and live entertainment.', DATE '2026-09-19', DATE '2026-09-20'),
    ('End of Summer Food Truck Festival', 'Galloway', 'Galloway Municipal Complex', '4–8 PM. Food trucks and entertainment.', DATE '2026-09-26', DATE '2026-09-26'),

    -- Cape May
    ('Wildwoods Food & Music Festival', 'Wildwood', 'Byrne Plaza', '11 AM–7 PM. Food, live music and vendors.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Wildwoods Airshow', 'Wildwood', 'Wildwood beachfront', 'Beachfront airshow with food vendors, entertainment and family activities.', DATE '2026-09-12', DATE '2026-09-13'),
    ('Margate Fall Funfest', 'Margate', NULL, 'Food trucks and vendors, arts & crafts, parades and live entertainment.', DATE '2026-09-26', DATE '2026-09-27'),
    ('Harvest Brew Fest', 'Cape May', NULL, 'Craft beer, food, crafts and entertainment.', DATE '2026-09-19', DATE '2026-09-19'),
    ('Crafts & Collectibles by the Sea', 'Cape May', NULL, 'Food, vendors and crafts by the shore.', DATE '2026-09-26', DATE '2026-09-26'),

    -- Camden
    ('Al Fresco Affair Food Truck Festival', 'Cherry Hill', 'Croft Farm', '5:30–8 PM. Food trucks, beer garden and live music.', DATE '2026-09-03', DATE '2026-09-03'),
    ('Voorhees Township Food Truck & Music Festival', 'Voorhees', 'Connolly Park', '11 AM–7 PM. Food trucks and live music.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Fall Pop-Up Marketplace', 'Cherry Hill', NULL, 'Food, vendors and shopping.', DATE '2026-09-18', DATE '2026-09-20'),

    -- Burlington
    ('Bacon, Bourbon & Brews Festival', 'Medford', 'Flying W Airport', '11 AM–8 PM. Food, brews and music.', DATE '2026-09-12', DATE '2026-09-12'),
    ('Holland Ridge Fall Flower Festival', 'Cream Ridge', 'Holland Ridge Farms', 'Runs through Oct 12. Food vendors and weekend activities at a large agricultural attraction.', DATE '2026-09-10', DATE '2026-10-12'),
    ('Gone to the Dogs Craft Fair Family Festival', 'Columbus', NULL, 'Food, vendors and family activities.', DATE '2026-09-12', DATE '2026-09-12'),

    -- Cumberland
    ('Vineland Food Truck Festival', 'Vineland', 'Landis Avenue', '11 AM–7 PM. Food trucks along Landis Avenue.', DATE '2026-09-13', DATE '2026-09-13'),
    ('Bridgeton Fall Festival', 'Bridgeton', NULL, 'Food trucks, farmers market, local vendors and an apple contest.', DATE '2026-09-26', DATE '2026-09-27')
)
INSERT INTO festivals (name, state_code, state_name, city, venue, description, start_date, end_date)
SELECT i.name, 'NJ', 'New Jersey', i.city, i.venue, i.description, i.start_date, i.end_date
FROM incoming i
WHERE NOT EXISTS (
  SELECT 1 FROM festivals f
  WHERE f.state_code = 'NJ'
    AND lower(f.name)  = lower(i.name)
    AND lower(f.city)  = lower(i.city)
    AND f.start_date   = i.start_date
);


-- ── 3. Verify ────────────────────────────────────────────────
-- Expect 65 NJ rows dated in September 2026 after a first run
-- (60 inserted here + 5 enriched above), and the same 65 after a re-run.

SELECT count(*) AS nj_september_2026_events
FROM festivals
WHERE state_code = 'NJ'
  AND start_date <= DATE '2026-09-30'
  AND end_date   >= DATE '2026-09-01';


-- ── 4. HELD BACK — needs a date before it can be inserted ────
-- The source list gave these three only as "September". `start_date`
-- and `end_date` are NOT NULL, and a wrong date sends people to a
-- venue on the wrong day, so they are not inserted above. Fill in the
-- real dates and uncomment, or add them via the admin Festivals tab.
--
-- INSERT INTO festivals (name, state_code, state_name, city, venue, description, start_date, end_date) VALUES
--   ('Irvington Avenue Food Truck & Craft Beer Festival', 'NJ', 'New Jersey', 'South Orange', 'Irvington Avenue', 'Food trucks, craft beer and a street festival atmosphere.', DATE '2026-09-??', DATE '2026-09-??'),
--   ('Rockaway Food Truck Festival', 'NJ', 'New Jersey', 'Rockaway', NULL, 'Food trucks, music and family activities — often paired with Just Jersey Fest.', DATE '2026-09-??', DATE '2026-09-??'),
--   ('Wood Street Fair', 'NJ', 'New Jersey', 'Burlington', 'Wood Street', 'Large arts and crafts event with food vendors and shopping.', DATE '2026-09-??', DATE '2026-09-??');
