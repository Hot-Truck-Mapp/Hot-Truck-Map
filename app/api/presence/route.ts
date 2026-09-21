import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identifyReporter, UUID_RE } from "@/lib/reporter";
import {
  GONE_REPORTS_TO_CLOSE,
  PRESENCE_WINDOW_MIN,
  summarizePresence,
  type PresenceReport,
} from "@/lib/presence";

// One-tap "still here?" / "they're gone" from customers in front of the truck.
//
// This is the check on the product's core claim. `is_live` says an operator
// tapped a button; this says somebody is looking at the truck right now.
//
// Reports are accepted without an account on purpose — a confirmation tap that
// costs a sign-up is a tap nobody makes — with a per-reporter rate limit
// standing in for authentication. See lib/reporter.ts.

/** One report per reporter per truck per window. */
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
/** A fresh "here" vetoes an auto-offline: somebody is looking at the truck. */
const HERE_VETO_MINUTES = 30;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { truck_id, verdict } = body as Record<string, unknown>;

  if (typeof truck_id !== "string" || !UUID_RE.test(truck_id)) {
    return NextResponse.json({ error: "Invalid truck_id" }, { status: 400 });
  }
  if (verdict !== "here" && verdict !== "gone") {
    return NextResponse.json({ error: "verdict must be 'here' or 'gone'" }, { status: 400 });
  }

  const db = getAdminClient();
  const reporter = await identifyReporter(req);

  // Only a live truck has a presence to confirm or dispute.
  const { data: truck } = await db
    .from("trucks")
    .select("id, is_live")
    .eq("id", truck_id)
    .maybeSingle();
  if (!truck) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
  }
  if (!truck.is_live) {
    return NextResponse.json({ error: "This truck isn't live right now." }, { status: 409 });
  }

  // Rate limit off the reports table itself, so the limit is shared across
  // serverless instances rather than living in a process-local map.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recent } = await db
    .from("presence_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_key", reporter.key)
    .eq("truck_id", truck_id)
    .gte("created_at", since);

  if ((recent ?? 0) > 0) {
    return NextResponse.json(
      { error: "You already reported on this truck a moment ago. Try again in a few minutes." },
      { status: 429 }
    );
  }

  const { error: insertErr } = await db.from("presence_reports").insert({
    truck_id,
    user_id: reporter.userId,
    reporter_key: reporter.key,
    verdict,
  });

  if (insertErr) {
    console.error("[presence] insert failed:", insertErr.message);
    return NextResponse.json({ error: "Could not save your report. Please try again." }, { status: 500 });
  }

  // ── Re-read the window and decide whether the pin still stands ────────────
  const windowStart = new Date(Date.now() - PRESENCE_WINDOW_MIN * 60_000).toISOString();
  const { data: rows } = await db
    .from("presence_reports")
    .select("verdict, reporter_key, created_at")
    .eq("truck_id", truck_id)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(200);

  const reports = (rows ?? []) as (PresenceReport & { reporter_key: string })[];
  const summary = summarizePresence(reports);

  // Count people, not taps: the rate limit already caps one report per
  // reporter per 10 minutes, but over a 90-minute window one person could
  // otherwise file nine "gone"s and clear the map on their own.
  const goneReporters = new Set(
    reports.filter((r) => r.verdict === "gone").map((r) => r.reporter_key)
  ).size;
  const hereVetoStart = Date.now() - HERE_VETO_MINUTES * 60_000;
  const recentHere = reports.some(
    (r) => r.verdict === "here" && new Date(r.created_at).getTime() >= hereVetoStart
  );

  let closed = false;
  if (goneReporters >= GONE_REPORTS_TO_CLOSE && !recentHere) {
    const { error: offlineErr } = await db
      .from("trucks")
      .update({ is_live: false })
      .eq("id", truck_id);
    if (!offlineErr) {
      closed = true;
      await db
        .from("live_sessions")
        .update({ ended_at: new Date().toISOString(), ended_by: "disputed" })
        .eq("truck_id", truck_id)
        .is("ended_at", null);
    }
  }

  return NextResponse.json({ ...summary, closed }, { status: 201 });
}
