-- ============================================================
-- Hot Truck Map — Full Schema Migration
-- Run this in your Supabase SQL Editor (safe to re-run)
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ── TRUCKS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trucks (
  id                      uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  owner_id                uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  description             text,
  cuisine                 text,
  phone                   text,
  instagram               text,
  profile_photo           text,
  is_live                 boolean DEFAULT false,
  dietary_tags            text[] DEFAULT '{}',
  offers_catering         boolean DEFAULT false,
  catering_description    text,
  catering_starting_price numeric,
  catering_min_guests     integer,
  created_at              timestamptz DEFAULT now()
);

-- Add any columns that may be missing on an existing trucks table
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS is_live                 boolean DEFAULT false;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS dietary_tags            text[] DEFAULT '{}';
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS offers_catering         boolean DEFAULT false;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS catering_description    text;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS catering_starting_price numeric;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS catering_min_guests     integer;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS phone                   text;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS instagram               text;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS profile_photo           text;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS description             text;
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS cuisine                 text;


-- ── LOCATIONS ───────────────────────────────────────────────
-- One row per truck (upsert on truck_id conflict)
CREATE TABLE IF NOT EXISTS locations (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id        uuid UNIQUE REFERENCES trucks(id) ON DELETE CASCADE,
  lat             float8 NOT NULL,
  lng             float8 NOT NULL,
  address         text,
  broadcasted_at  timestamptz DEFAULT now()
);

ALTER TABLE locations ADD COLUMN IF NOT EXISTS address        text;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS broadcasted_at timestamptz DEFAULT now();

-- Unique constraint required for upsert onConflict: "truck_id"
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_truck_id_key'
  ) THEN
    ALTER TABLE locations ADD CONSTRAINT locations_truck_id_key UNIQUE (truck_id);
  END IF;
END $$;


-- ── MENU ITEMS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id    uuid REFERENCES trucks(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  price       numeric NOT NULL DEFAULT 0,
  category    text DEFAULT 'Other',
  allergens   text[] DEFAULT '{}',
  is_popular  boolean DEFAULT false,
  is_sold_out boolean DEFAULT false,
  photo       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category    text DEFAULT 'Other';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS allergens   text[] DEFAULT '{}';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_popular  boolean DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS photo       text;


-- ── SCHEDULES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id    uuid REFERENCES trucks(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,  -- 0=Sun, 1=Mon … 6=Sat
  location    text,
  open_time   text,
  close_time  text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS location   text;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS open_time  text;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS close_time text;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS notes      text;


-- ── FOLLOWS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  truck_id   uuid REFERENCES trucks(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, truck_id)
);


-- ── ORDERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id     uuid REFERENCES trucks(id) ON DELETE SET NULL,
  customer_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pickup_name  text NOT NULL,
  notes        text,
  items        jsonb NOT NULL DEFAULT '[]',
  total        numeric NOT NULL DEFAULT 0,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes       text;


-- ── CATERING REQUESTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS catering_requests (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id        uuid REFERENCES trucks(id) ON DELETE SET NULL,
  customer_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name   text NOT NULL,
  customer_email  text NOT NULL,
  customer_phone  text,
  event_date      date NOT NULL,
  event_time      text,
  event_location  text NOT NULL,
  guest_count     integer NOT NULL,
  budget          numeric,
  event_type      text,
  notes           text,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE catering_requests ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE catering_requests ADD COLUMN IF NOT EXISTS event_time     text;
ALTER TABLE catering_requests ADD COLUMN IF NOT EXISTS budget         numeric;
ALTER TABLE catering_requests ADD COLUMN IF NOT EXISTS event_type     text;
ALTER TABLE catering_requests ADD COLUMN IF NOT EXISTS notes          text;


-- ── CATERING PACKAGES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS catering_packages (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id        uuid REFERENCES trucks(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  price_per_person numeric NOT NULL DEFAULT 0,
  minimum_guests  integer NOT NULL DEFAULT 1,
  maximum_guests  integer NOT NULL DEFAULT 500,
  includes        text[] DEFAULT '{}',
  photo           text,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE catering_packages ADD COLUMN IF NOT EXISTS description     text;
ALTER TABLE catering_packages ADD COLUMN IF NOT EXISTS includes        text[] DEFAULT '{}';
ALTER TABLE catering_packages ADD COLUMN IF NOT EXISTS photo           text;


-- ── REVIEWS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id         uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  truck_id   uuid REFERENCES trucks(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating     integer CHECK (rating BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS comment text;


-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE trucks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;

-- Trucks: public read, owner write
CREATE POLICY IF NOT EXISTS "trucks_public_read"  ON trucks FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "trucks_owner_insert" ON trucks FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY IF NOT EXISTS "trucks_owner_update" ON trucks FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY IF NOT EXISTS "trucks_owner_delete" ON trucks FOR DELETE USING (auth.uid() = owner_id);

-- Locations: public read, truck owner write
CREATE POLICY IF NOT EXISTS "locations_public_read"  ON locations FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "locations_owner_write"  ON locations FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "locations_owner_update" ON locations FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "locations_owner_delete" ON locations FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- Menu items: public read, truck owner write
CREATE POLICY IF NOT EXISTS "menu_items_public_read"  ON menu_items FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "menu_items_owner_write"  ON menu_items FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "menu_items_owner_update" ON menu_items FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "menu_items_owner_delete" ON menu_items FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- Schedules: public read, truck owner write
CREATE POLICY IF NOT EXISTS "schedules_public_read"  ON schedules FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "schedules_owner_write"  ON schedules FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "schedules_owner_update" ON schedules FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "schedules_owner_delete" ON schedules FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- Follows: auth users read/write their own
CREATE POLICY IF NOT EXISTS "follows_read"   ON follows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "follows_insert" ON follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "follows_delete" ON follows FOR DELETE USING (auth.uid() = user_id);

-- Orders: service role handles inserts (via API route); owner + customer can read
CREATE POLICY IF NOT EXISTS "orders_owner_read"    ON orders FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
  OR auth.uid() = customer_id
);
CREATE POLICY IF NOT EXISTS "orders_owner_update"  ON orders FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- Catering requests: truck owner read/update, anyone insert
CREATE POLICY IF NOT EXISTS "catering_req_insert"       ON catering_requests FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "catering_req_owner_read"   ON catering_requests FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
  OR auth.uid() = customer_id
);
CREATE POLICY IF NOT EXISTS "catering_req_owner_update" ON catering_requests FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- Catering packages: public read, truck owner write
CREATE POLICY IF NOT EXISTS "catering_pkg_public_read"  ON catering_packages FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "catering_pkg_owner_insert" ON catering_packages FOR INSERT WITH CHECK (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "catering_pkg_owner_update" ON catering_packages FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);
CREATE POLICY IF NOT EXISTS "catering_pkg_owner_delete" ON catering_packages FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- Reviews: public read, auth users insert/delete own
CREATE POLICY IF NOT EXISTS "reviews_public_read"  ON reviews FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "reviews_auth_insert"  ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "reviews_auth_delete"  ON reviews FOR DELETE USING (auth.uid() = user_id);
