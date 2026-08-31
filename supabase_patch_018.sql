-- ============================================================
-- HOT TRUCK MAP — Production Patch 018
-- Reset every policy on the app's tables to the canonical set.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- Run section 1 first and on its own.
-- ============================================================
--
-- WHY
--
-- Blocks 3 and 4 of patch 017 found 30+ duplicate policies across 12
-- tables — the same rules re-created under different names across
-- repeated migration runs and dashboard edits. Permissive policies OR
-- together, so the loosest one always wins. Two of them are live holes:
--
--   catering_messages  "Participants read messages"   SELECT USING (true)
--       Despite the name, this scopes to nobody. Every private catering
--       conversation between an operator and a customer is readable by
--       anyone holding the anon key — which ships in the web bundle and
--       in mobile/eas.json. The table is empty today, so nothing has
--       leaked yet; it leaks the moment the feature is used.
--
--   catering_messages  "Anyone can send messages"     INSERT
--       Patch 008 tightened catering_msg_insert specifically to stop any
--       authenticated user injecting messages into someone else's
--       thread. This duplicate sits beside it and grants what 008 took
--       away, so that IDOR has been open the whole time.
--
--   trucks             "trucks_select_public"         SELECT USING (true)
--       This is what defeated patch 014. Hiding a truck from the admin
--       dashboard set is_active = false, trucks_public_read correctly
--       excluded it, and this policy let it through anyway.
--
-- The rest are harmless byte-for-byte duplicates, but they are why the
-- real ones were so hard to find. This resets all of it.
--
-- Every policy below is the definition already in this repo:
-- supabase_migration.sql, plus patch 003 (catering insert), patch 008
-- (catering messages IDOR), patch 002 (push/photos), patch 014
-- (trucks is_active + self-review) and fix_rls_profiles.sql.


-- ── 1. SECURITY-CRITICAL: catering_messages and trucks ───────
-- Run this section on its own, first.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('catering_messages', 'trucks')
  LOOP
    RAISE NOTICE 'dropping %.%', r.tablename, r.policyname;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- catering_messages — read and write scoped to the two participants.
CREATE POLICY "catering_msg_read" ON catering_messages FOR SELECT USING (
  auth.uid() = sender_id
  OR auth.uid() = (
    SELECT t.owner_id FROM trucks t
    JOIN catering_requests cr ON cr.truck_id = t.id
    WHERE cr.id = request_id LIMIT 1
  )
  OR auth.uid() = (SELECT customer_id FROM catering_requests WHERE id = request_id)
);
CREATE POLICY "catering_msg_insert" ON catering_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND (
    auth.uid() = (
      SELECT t.owner_id FROM trucks t
      JOIN catering_requests cr ON cr.truck_id = t.id
      WHERE cr.id = request_id LIMIT 1
    )
    OR auth.uid() = (SELECT customer_id FROM catering_requests WHERE id = request_id)
  )
);

-- trucks — public read honours is_active; owner keeps full control.
CREATE POLICY "trucks_public_read" ON trucks FOR SELECT USING (
  is_active IS NOT FALSE OR owner_id = auth.uid()
);
CREATE POLICY "trucks_owner_insert" ON trucks FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "trucks_owner_update" ON trucks FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "trucks_owner_delete" ON trucks FOR DELETE USING (auth.uid() = owner_id);

-- Expect catering_messages = 2, trucks = 4.
SELECT tablename, count(*) AS policies FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('catering_messages', 'trucks')
GROUP BY tablename;


-- ── 2. Consolidate the remaining duplicates ──────────────────
-- Run this section on its own, after section 1 is verified.
-- No behaviour change intended here — these are all duplicates of the
-- same rule. The point is that the next person can read this table's
-- policy list and know what it does.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('locations','menu_items','schedules','catering_packages',
                        'catering_requests','orders','profiles',
                        'push_subscriptions','truck_photos')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- locations / menu_items / schedules — public read, truck owner writes.
CREATE POLICY "locations_public_read" ON locations FOR SELECT USING (true);
CREATE POLICY "locations_owner_write"  ON locations FOR INSERT WITH CHECK (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "locations_owner_update" ON locations FOR UPDATE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "locations_owner_delete" ON locations FOR DELETE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));

CREATE POLICY "menu_items_public_read" ON menu_items FOR SELECT USING (true);
CREATE POLICY "menu_items_owner_write"  ON menu_items FOR INSERT WITH CHECK (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "menu_items_owner_update" ON menu_items FOR UPDATE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "menu_items_owner_delete" ON menu_items FOR DELETE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));

CREATE POLICY "schedules_public_read" ON schedules FOR SELECT USING (true);
CREATE POLICY "schedules_owner_write"  ON schedules FOR INSERT WITH CHECK (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "schedules_owner_update" ON schedules FOR UPDATE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "schedules_owner_delete" ON schedules FOR DELETE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));

-- catering_packages — public read, truck owner writes.
CREATE POLICY "catering_pkg_public_read" ON catering_packages FOR SELECT USING (true);
CREATE POLICY "catering_pkg_owner_insert" ON catering_packages FOR INSERT WITH CHECK (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "catering_pkg_owner_update" ON catering_packages FOR UPDATE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));
CREATE POLICY "catering_pkg_owner_delete" ON catering_packages FOR DELETE USING (auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id));

-- catering_requests — anonymous enquiries allowed, but no spoofed
-- customer_id (patch 003). Read/update limited to the two participants.
CREATE POLICY "catering_req_insert" ON catering_requests FOR INSERT WITH CHECK (
  customer_id IS NULL OR customer_id = auth.uid()
);
CREATE POLICY "catering_req_owner_read" ON catering_requests FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
  OR auth.uid() = customer_id
);
CREATE POLICY "catering_req_owner_update" ON catering_requests FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- orders — no client INSERT policy on purpose: /api/orders writes them
-- with the service role after recalculating the total server-side.
CREATE POLICY "orders_owner_read" ON orders FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
  OR auth.uid() = customer_id
);
CREATE POLICY "orders_owner_update" ON orders FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id)
);

-- profiles — own row only.
CREATE POLICY "profiles_own_read"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- push_subscriptions — own rows only.
CREATE POLICY "push_sub_own_read"   ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_sub_own_insert" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_sub_own_delete" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- truck_photos — public read, any signed-in user contributes, uploader
-- or truck owner deletes.
CREATE POLICY "truck_photos_public_read" ON truck_photos FOR SELECT USING (true);
CREATE POLICY "truck_photos_auth_insert" ON truck_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "truck_photos_own_delete"   ON truck_photos FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "truck_photos_owner_delete" ON truck_photos FOR DELETE USING (
  auth.uid() = (SELECT owner_id FROM trucks WHERE id = truck_id LIMIT 1)
);


-- ── 3. Verification — run separately ─────────────────────────
-- No table should have more policies than it has distinct rules.
SELECT tablename, count(*) AS policies,
       string_agg(policyname, ', ' ORDER BY policyname) AS names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Then, in the app: the map and truck pages load, an operator can still
-- edit their menu and schedule and go live, a customer can still order
-- and follow, and the admin Hide control now actually hides.
