import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identifyReporter, UUID_RE } from "@/lib/reporter";
import {
  CUSTOMER_WAIT_WINDOW_MIN,
  WAIT_BUCKETS,
  waitEstimate,
  type WaitReport,
} from "@/lib/presence";

// How long the line is — reported by whoever is standing in it.
//
// It's the biggest unknown in street food and no delivery app has it, because
// none of them have anyone at the window. Buckets, not free text, so the
// numbers can be aggregated and so reporting costs one tap.

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

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

  const { truck_id, minutes } = body as Record<string, unknown>;

  if (typeof truck_id !== "string" || !UUID_RE.test(truck_id)) {
    return NextResponse.json({ error: "Invalid truck_id" }, { status: 400 });
  }
  if (typeof minutes !== "number" || !WAIT_BUCKETS.includes(minutes as never)) {
    return NextResponse.json(
      { error: `minutes must be one of ${WAIT_BUCKETS.join(", ")}` },
      { status: 400 }
    );
  }

  const db = getAdminClient();
  const reporter = await identifyReporter(req);

  const { data: truck } = await db
    .from("trucks")
    .select("id, is_live, wait_minutes, wait_set_at")
    .eq("id", truck_id)
    .maybeSingle();
  if (!truck) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
  }
  if (!truck.is_live) {
    return NextResponse.json({ error: "This truck isn't serving right now." }, { status: 409 });
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recent } = await db
    .from("wait_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_key", reporter.key)
    .eq("truck_id", truck_id)
    .gte("created_at", since);

  if ((recent ?? 0) > 0) {
    return NextResponse.json(
      { error: "You already reported the wait here a moment ago." },
      { status: 429 }
    );
  }

  const { error: insertErr } = await db.from("wait_reports").insert({
    truck_id,
    user_id: reporter.userId,
    reporter_key: reporter.key,
    minutes,
  });

  if (insertErr) {
    console.error("[wait] insert failed:", insertErr.message);
    return NextResponse.json({ error: "Could not save your report. Please try again." }, { status: 500 });
  }

  // Hand back the recomputed estimate so the caller can show the crowd's
  // answer rather than just the number this one person picked.
  const windowStart = new Date(Date.now() - CUSTOMER_WAIT_WINDOW_MIN * 60_000).toISOString();
  const { data: rows } = await db
    .from("wait_reports")
    .select("minutes, created_at")
    .eq("truck_id", truck_id)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false })
    .limit(200);

  const estimate = waitEstimate({
    operatorMinutes: truck.wait_minutes as number | null,
    operatorSetAt: truck.wait_set_at as string | null,
    reports: (rows ?? []) as WaitReport[],
  });

  return NextResponse.json({ estimate }, { status: 201 });
}
