import { createBrowserClient } from "@supabase/ssr"

// Literal property access is required — Turbopack only inlines NEXT_PUBLIC_
// vars when referenced as static expressions, not via process.env[name].
function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name} — add it to .env.local or your hosting provider's environment variables.`);
  return value;
}

const supabaseUrl = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = requireEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}