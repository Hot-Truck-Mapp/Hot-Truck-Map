import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Who filed a presence or wait report.
 *
 * These are one-tap signals from someone standing on a sidewalk. Requiring an
 * account would collapse the volume that makes them useful, so anonymous
 * reports are accepted — but a reporter still needs a stable identity so one
 * device can't stuff the ballot. Signed-in users are keyed by user id;
 * everyone else by a salted hash of their IP, which is never stored raw.
 */
export type Reporter = {
  key: string;
  userId: string | null;
};

/**
 * Salt for the IP hash. This protects reporters' addresses from anyone reading
 * the table — it is not an auth boundary — so a missing env var degrades to a
 * constant rather than disabling reporting.
 */
function salt(): string {
  return process.env.REPORT_SALT ?? "hot-truck-map-reporter";
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  // Vercel appends downstream proxies; the first entry is the client.
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Resolve the caller, verifying a Bearer token when one is present. */
export async function identifyReporter(req: NextRequest): Promise<Reporter> {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      const anon = createClient(url, anonKey);
      const { data: { user } } = await anon.auth.getUser(token);
      // An invalid token is not an error here — it just means this report is
      // treated as anonymous rather than rejected.
      if (user) return { key: `user:${user.id}`, userId: user.id };
    }
  }

  const hash = createHash("sha256").update(`${salt()}:${clientIp(req)}`).digest("hex");
  return { key: `ip:${hash}`, userId: null };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
