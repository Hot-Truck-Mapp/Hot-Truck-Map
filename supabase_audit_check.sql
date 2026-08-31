-- ============================================================
-- HOT TRUCK MAP — audit verification queries (read-only)
-- Run in Supabase → SQL Editor. Nothing here writes.
-- ============================================================

-- ── 1. Which storage buckets exist, and are they public? ─────
-- Expect: avatars, menu-photos, truck-photos.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
order by name;


-- ── 2. Every policy on storage.objects ───────────────────────
-- THIS IS THE IMPORTANT ONE.
--
-- supabase_patch_008.sql restricts writes to the avatars bucket to the
-- path "customers/<your-uid>.<ext>". But app/dashboard/page.tsx uploads
-- the operator's truck photo to "trucks/<truck-id>/<name>-<ts>.<ext>".
--
-- Read the output and decide which case you're in:
--
--   (a) The only INSERT policies on 'avatars' are the four from patch 008
--       → operator truck-photo upload is BROKEN (403 RLS violation).
--
--   (b) There is also a broader legacy policy (e.g. "authenticated users
--       can upload") → the upload works, but patch 008's security fix is
--       NOT in effect: any signed-in user can still overwrite anyone's
--       avatar. Also needs fixing.
--
-- And check whether 'menu-photos' / 'truck-photos' appear at all. If they
-- have no policies and RLS is on, those uploads fail too.
select
  policyname,
  cmd,
  permissive,
  roles,
  qual        as using_expr,
  with_check  as with_check_expr
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd, policyname;


-- ── 3. Have patches 010 and 011 been applied? ────────────────
-- Both are untracked in git, so they may never have been run.

-- 010: admin contact inbox "mark handled"
select
  case when exists (
    select 1 from information_schema.columns
    where table_name = 'contact_submissions' and column_name = 'handled_at'
  ) then 'patch 010 APPLIED' else 'patch 010 MISSING — admin contact inbox degraded' end
  as patch_010;

-- 011: admin Announce tab send log
select
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'announcements'
  ) then 'patch 011 APPLIED' else 'patch 011 MISSING — /api/admin/announce will error' end
  as patch_011;


-- ── 4. rate_limit_log exists? ────────────────────────────────
-- Every rate limit in the app (signup, orders, broadcasts) depends on it.
-- If this table is missing, isRateLimited() silently never limits.
select
  case when exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'rate_limit_log'
  ) then 'rate_limit_log OK' else 'rate_limit_log MISSING — all rate limits are no-ops' end
  as rate_limits;

-- Is anything cleaning it up? (schema_fixes.sql leaves the DELETE commented out)
select count(*) as rate_limit_rows,
       min(created_at) as oldest_row
from rate_limit_log;


-- ── 5. RLS on, and policy count, for every core table ────────
-- Any row with rls_enabled = false, or policies = 0 with RLS on, is a problem.
select
  c.relname                                          as table_name,
  c.relrowsecurity                                   as rls_enabled,
  c.relforcerowsecurity                              as rls_forced,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;


-- ── 6. Operators with no truck row ───────────────────────────
-- These are accounts that signed up as operators but whose truck insert
-- failed. They hit the dashboard self-heal on next login — but only if
-- user_metadata.truck_name survived. Any row here with truck_name null
-- is permanently stuck being treated as a customer.
select
  u.id,
  u.email,
  u.created_at,
  u.email_confirmed_at,
  u.raw_user_meta_data ->> 'truck_name' as meta_truck_name
from auth.users u
left join trucks t on t.owner_id = u.id
where u.raw_user_meta_data ->> 'role' = 'operator'
  and t.id is null
order by u.created_at desc;


-- ── 7. Trucks that are live but not actually ready ───────────
-- The web dashboard gates Go Live on description + phone + >=1 menu item.
-- The mobile app does not. Anything here went live from mobile with an
-- incomplete profile, so customers find it and can't order.
select
  t.id,
  t.name,
  t.is_live,
  (t.description is null or t.description = '') as missing_description,
  (t.phone is null or t.phone = '')             as missing_phone,
  (select count(*) from menu_items m where m.truck_id = t.id) as menu_items
from trucks t
where t.is_live = true
  and (
    t.description is null or t.description = ''
    or t.phone is null or t.phone = ''
    or not exists (select 1 from menu_items m where m.truck_id = t.id)
  )
order by t.name;


-- ── 8. Stale live trucks ─────────────────────────────────────
-- is_live is only cleared when the operator taps Go Offline. Anyone who
-- closed the tab is still showing as live on the map.
select
  t.id,
  t.name,
  l.address,
  l.broadcasted_at,
  now() - l.broadcasted_at as stale_for
from trucks t
left join locations l on l.truck_id = t.id
where t.is_live = true
  and (l.broadcasted_at is null or l.broadcasted_at < now() - interval '12 hours')
order by l.broadcasted_at nulls first;
