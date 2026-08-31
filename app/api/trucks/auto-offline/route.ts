import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Auto-offline stale trucks — runs via Vercel Cron hourly.
//
// `trucks.is_live` was only ever cleared by an operator explicitly tapping
// "Go Offline". Close the browser tab, force-quit the app, or let the phone
// battery die, and the truck stayed lit on the map indefinitely — customers
// drive to an address where nobody is parked, which is the single fastest way
// to lose trust in a live-location product.
//
// A live truck re-broadcasts its position continuously: the web dashboard's
// GPS watcher fires on every 50m of movement, and the mobile app broadcasts
// on each Go Live. So `locations.broadcasted_at` is a reliable liveness
// heartbeat, and a truck whose last broadcast is old is not actually out
// there — it's a session that ended without anyone saying so.
//
// The window is deliberately generous. A truck parked at one spot for a lunch
// service legitimately doesn't move, and the watcher's 50m threshold means it
// won't re-broadcast either. STALE_HOURS has to comfortably exceed the longest
// plausible stationary service, or this cron knocks working trucks offline.
//
// Security: protected by CRON_SECRET header (set in Vercel env vars).
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

type LiveTruckRow = {
  id: string;
  name: string;
  // PostgREST types a 1:1 embed loosely; accept both shapes.
  locations: { broadcasted_at: string | null } | { broadcasted_at: string | null }[] | null;
};

const STALE_HOURS = 12;
const BATCH_LIMIT = 500;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  // Verify cron secret — Vercel sets this header on cron invocations.
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const expected = `Bearer ${cronSecret}`;
  const supplied = authHeader ?? "";
  // Pad both to the same length to prevent a length-leaking timing oracle.
  const maxLen = Math.max(expected.length, supplied.length);
  const a = Buffer.from(expected.padEnd(maxLen));
  const b = Buffer.from(supplied.padEnd(maxLen));
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  try {
    // Every truck currently flagged live, with its last known broadcast.
    // `locations` holds one row per truck (unique on truck_id), so this is a
    // 1:1 join, not a fan-out.
    const { data: liveTrucks, error: fetchErr } = await db
      .from("trucks")
      .select("id, name, locations(broadcasted_at)")
      .eq("is_live", true)
      .limit(BATCH_LIMIT);

    if (fetchErr) {
      console.error("[auto-offline] fetch failed:", fetchErr.message);
      return NextResponse.json({ error: "Failed to load live trucks" }, { status: 500 });
    }

    if (!liveTrucks?.length) {
      return NextResponse.json({ checked: 0, wentOffline: 0 });
    }

    const stale = (liveTrucks as LiveTruckRow[]).filter((t) => {
      // Supabase returns an embedded 1:1 relation as either an object or a
      // single-element array depending on how it infers the relationship.
      const loc = Array.isArray(t.locations) ? t.locations[0] : t.locations;
      const last = loc?.broadcasted_at;
      // A truck marked live that never broadcast at all is stale by
      // definition — it can't be on the map anywhere meaningful.
      if (!last) return true;
      return last < cutoff;
    });

    if (stale.length === 0) {
      return NextResponse.json({ checked: liveTrucks.length, wentOffline: 0 });
    }

    const staleIds = stale.map((t) => t.id);

    // ?dryRun=1 reports what would happen without writing anything. Taking a
    // truck offline is visible to its owner and its customers, so there needs
    // to be a way to check the window is tuned correctly before the cron runs
    // for real — and a way to re-check it later without waiting an hour.
    if (new URL(req.url).searchParams.get("dryRun") === "1") {
      return NextResponse.json({
        dryRun: true,
        staleHours: STALE_HOURS,
        checked: liveTrucks.length,
        wouldGoOffline: stale.map((t) => {
          const loc = Array.isArray(t.locations) ? t.locations[0] : t.locations;
          return { id: t.id, name: t.name, lastBroadcast: loc?.broadcasted_at ?? null };
        }),
      });
    }

    const { error: updateErr } = await db
      .from("trucks")
      .update({ is_live: false })
      .in("id", staleIds);

    if (updateErr) {
      console.error("[auto-offline] update failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update trucks" }, { status: 500 });
    }

    console.log(
      `[auto-offline] took ${staleIds.length} truck(s) offline after ${STALE_HOURS}h without a broadcast:`,
      stale.map((t) => t.name).join(", ")
    );

    return NextResponse.json({
      checked: liveTrucks.length,
      wentOffline: staleIds.length,
    });
  } catch (err) {
    console.error("[auto-offline] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
