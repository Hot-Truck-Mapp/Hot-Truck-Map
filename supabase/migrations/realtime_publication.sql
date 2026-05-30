-- Ensure trucks and locations are in the Realtime publication so all
-- connected clients (web + mobile) receive live updates.
-- Safe to re-run: the DO block skips tables already in the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trucks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trucks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
  END IF;
END $$;

-- Confirm result
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('trucks', 'locations')
ORDER BY tablename;
