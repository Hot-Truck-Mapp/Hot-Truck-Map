-- Fix: enable RLS on the profiles table which was created without it.
-- The profiles table is not used directly by the app but must be secured.

-- Enable RLS so no public access
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
DROP POLICY IF EXISTS "profiles_own_read"   ON profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON profiles;

CREATE POLICY "profiles_own_read" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_own_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);
