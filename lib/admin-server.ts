import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

/**
 * Service-role Supabase client. Bypasses RLS entirely — only ever construct
 * this inside a handler that has already passed requireAdmin().
 */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing service role config");
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verifies the caller is signed in as an admin. Returns the user, or null —
 * callers turn null into a 403. Uses getUser() (not getSession()) so the JWT
 * is validated against Supabase Auth rather than trusted from the cookie.
 */
export async function requireAdmin(): Promise<User | null> {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user || !isAdminEmail(user.email)) return null;
    return user;
  } catch {
    return null;
  }
}
