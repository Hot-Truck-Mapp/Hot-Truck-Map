-- ============================================================
-- HOT TRUCK MAP — Production Patch 015
-- URGENT: every truck is currently flagged is_active = false.
--
-- Run in Supabase → SQL Editor. Idempotent — safe to re-run.
-- ============================================================
--
-- WHAT WENT WRONG
--
-- Patch 014 assumed trucks.is_active was either absent or NULL, so its
-- backfill was:
--
--   UPDATE trucks SET is_active = true WHERE is_active IS NULL;
--
-- The column already existed and every row was already `false`, not NULL.
-- The backfill matched nothing. Verified after 014 was applied:
--
--   is_active = true : 0
--   is_active = false: 5
--   is_active IS NULL: 0
--
-- So patch 014's new policy —
--   USING (is_active IS NOT FALSE OR owner_id = auth.uid())
-- — now evaluates to false for every truck for every anonymous visitor.
--
-- The site has not gone dark: all 5 trucks are still readable with the
-- anon key. That means the new policy is not the only thing governing
-- reads on this table. Section 2 finds out what else is, WITHOUT
-- changing anything.
--
-- Either way, section 1 needs running: `false` here is not a moderation
-- decision anyone made. The admin Hide control has never worked (that is
-- what patch 014 set out to fix), so no truck has ever been deliberately
-- hidden. The value is left over from however the column was originally
-- added.


-- ── 1. Un-hide everything ────────────────────────────────────
-- Nothing was ever intentionally hidden, so every truck should be
-- visible. Run this before anything else: if the masking in section 2
-- is removed while these are still false, the whole site goes dark.
UPDATE trucks SET is_active = true WHERE is_active IS DISTINCT FROM true;

-- Confirm: expect all_true = 5 (or your current truck count), others 0.
SELECT
  count(*) FILTER (WHERE is_active IS TRUE)  AS all_true,
  count(*) FILTER (WHERE is_active IS FALSE) AS still_hidden,
  count(*) FILTER (WHERE is_active IS NULL)  AS still_null
FROM trucks;


-- ── 2. Why are hidden trucks still readable? — DIAGNOSTIC ────
-- Read-only. Nothing below changes anything.
--
-- Two candidate explanations, and these queries tell them apart. Send me
-- the output of both and I'll follow up.
--
-- (a) RLS is not actually enabled/forced on these tables. This is the
--     same class of problem as patch 004, where `reviews` had policies
--     defined but RLS switched off at the table level, so none of them
--     were enforced and anyone with the anon key could read or write
--     anything. If that is the case here it is the most serious issue
--     in this whole audit and everything else waits.
--
-- (b) RLS is on, but another permissive SELECT policy on trucks grants
--     broad read access. Permissive policies OR together, so one open
--     policy defeats the new one — exactly what happened with the
--     menu-photos bucket in patch 013.

-- (a) Is RLS actually on and forced, per table?
--     rls_enabled must be true for every row here.
SELECT
  c.relname                AS table_name,
  c.relrowsecurity         AS rls_enabled,
  c.relforcerowsecurity    AS rls_forced,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- (b) Every SELECT policy on trucks. Expect exactly one:
--     trucks_public_read. Anything else is masking it.
SELECT policyname, cmd, permissive, roles, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'trucks'
ORDER BY cmd, policyname;

-- (c) What the anon and authenticated roles are granted directly.
--     Table-level GRANTs sit underneath RLS: a role with no privilege
--     cannot act at all, but a role WITH privilege is still subject to
--     RLS — unless RLS is off, per (a).
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'trucks'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;


-- ── 3. Do not run this yet ───────────────────────────────────
-- If section 2(a) shows rls_enabled = false for any table, this is the
-- fix — but read the output first and confirm with me before running
-- it. Enabling RLS on a table whose policies are wrong takes that
-- table's data offline for the app.
--
-- DO $$
-- DECLARE r record;
-- BEGIN
--   FOR r IN
--     SELECT c.relname AS tbl
--     FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--     WHERE n.nspname = 'public' AND c.relkind = 'r'
--       AND c.relrowsecurity = false
--   LOOP
--     RAISE NOTICE 'Enabling RLS on %', r.tbl;
--     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);
--   END LOOP;
-- END $$;
