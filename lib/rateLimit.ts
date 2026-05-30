import { createClient } from "@supabase/supabase-js";

// Shared service-role client — instantiated once per cold start
let _db: ReturnType<typeof createClient> | null = null;
function getDb() {
  if (!_db) {
    _db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _db;
}

/**
 * Returns true if the key has exceeded `max` calls in the last `windowMs` ms.
 * Uses the rate_limit_log table so the check is shared across all serverless
 * instances — unlike process-local Maps which reset on every cold start.
 */
export async function isRateLimited(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const db = getDb();
  const windowStart = new Date(Date.now() - windowMs).toISOString();

  const { count } = await db
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= max) return true;

  // Record this call (fire-and-forget — don't block the response on this)
  void (db as any).from("rate_limit_log").insert({ key }).then(() => {});
  return false;
}
