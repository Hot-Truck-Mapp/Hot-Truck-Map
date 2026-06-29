-- ============================================================
-- HOT TRUCK MAP — Production Patch 005
-- Run this in your Supabase SQL Editor (supabase.com → project
-- → SQL Editor → New query → paste & Run)
-- Safe to run multiple times (idempotent).
--
-- FIX: Account deletion was blocked because the `profiles` table
-- (created out-of-band by the Supabase user-management quickstart)
-- has a foreign key on `auth.users(id)` without ON DELETE CASCADE.
-- Postgres refuses to delete the auth.users row while a profiles
-- row references it, which surfaces to the app as a 500 from
-- /api/account/delete and to Supabase Studio as a "Delete user"
-- failure.
--
-- This patch rewrites the constraint to cascade, so deleting an
-- auth user automatically removes the associated profile row.
-- It also reports any *other* FK on auth.users that would still
-- block deletion, so we can spot future regressions.
-- ============================================================


-- ── 1. Fix profiles → auth.users FK to cascade ────────────────
-- Only runs if the profiles table actually exists. The constraint
-- name follows the Supabase quickstart default (`profiles_id_fkey`)
-- but we look it up dynamically in case it was renamed.
DO $$
DECLARE
  fk_name text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'profiles'
  ) THEN
    SELECT conname INTO fk_name
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND confrelid = 'auth.users'::regclass
      AND contype = 'f'
    LIMIT 1;

    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', fk_name);
      RAISE NOTICE 'Dropped existing FK %.', fk_name;
    END IF;

    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Re-added profiles_id_fkey with ON DELETE CASCADE.';
  ELSE
    RAISE NOTICE 'profiles table not present — skipping.';
  END IF;
END $$;


-- ── 2. Report any remaining blockers on auth.users ────────────
-- confdeltype: 'a' = NO ACTION, 'r' = RESTRICT (both block delete),
--              'c' = CASCADE,   'n' = SET NULL (both safe).
-- If this DO block raises a NOTICE for any constraint, that table
-- will also block auth-user deletion and needs a similar patch.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname,
           conrelid::regclass::text AS tbl,
           confdeltype
    FROM   pg_constraint
    WHERE  confrelid = 'auth.users'::regclass
      AND  contype  = 'f'
      AND  confdeltype IN ('a', 'r')
  LOOP
    RAISE WARNING
      'FK % on % still blocks auth.users deletion (confdeltype=%). '
      'Recreate it with ON DELETE CASCADE or SET NULL.',
      r.conname, r.tbl, r.confdeltype;
  END LOOP;
END $$;


-- ── 3. Verify ─────────────────────────────────────────────────
-- After running this patch, this query should return ZERO rows.
-- Each remaining row is a table whose FK to auth.users will still
-- block account deletion.
--
-- SELECT conname, conrelid::regclass AS table, confdeltype
-- FROM   pg_constraint
-- WHERE  confrelid = 'auth.users'::regclass
--   AND  contype = 'f'
--   AND  confdeltype IN ('a', 'r');
