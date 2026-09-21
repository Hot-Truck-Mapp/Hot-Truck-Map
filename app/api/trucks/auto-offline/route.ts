import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { lastCloseMinuteToday, localNow } from "@/lib/schedule-tz";

// ---------------------------------------------------------------------------
// Auto-offline stale trucks — runs via Vercel Cron every 15 minutes.
//
// `trucks.is_live` was only ever cleared by an operator explicitly tapping
// "Go Offline". Close the browser tab, force-quit the app, or let the phone
// battery die, and the truck stayed lit on the map indefinitely — customers
// drive to an address where nobody is parked, which is the single fastest way
// to lose trust in a live-location product.
//
// Two rules take a truck down, and the schedule is the precise one:
//
//   'schedule' — the truck posted hours for today and they ended more than
//                SCHEDULE_GRACE_MINUTES ago. This is exact: a lunch truck that
//                closes at 2pm is off the map by 3pm whether or not anyone
//                remembered to tap the button.
//
//   'stale'    — no GPS ping for STALE_HOURS. The safety net for trucks with
//                no posted schedule, and for one that goes live on a day it
//                doesn't normally serve.
//
// The staleness window stays generous. A truck parked at one spot for a lunch
// service legitimately doesn't move, and the dashboard's GPS watcher only
// re-broadcasts on 50m of movement; the live-session heartbeat added alongside
// this keeps `broadcasted_at` current for anyone on a current build, but an
// older app release still only pings when it moves. STALE_HOURS has to
// comfortably exceed the longest plausible stationary service for those.
//
// Security: protected by CRON_SECRET header (set in Vercel env vars).
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";

type LiveTruckRow = {
  id: string;
  name: string;
  timezone: string | null;
  // PostgREST types a 1:1 embed loosely; accept both shapes.
  locations: { broadcasted_at: string | null } | { broadcasted_at: string | null }[] | null;
};

type ScheduleRow = {
  truck_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
};

const STALE_HOURS = 8;
/** How long after a posted close time a truck may stay lit. */
const SCHEDULE_GRACE_MINUTES = 60;
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
  const now = new Date();
  const cutoff = new Date(now.getTime() - STALE_HOURS * 60 * 60 * 1000).toISOString();

  try {
    // Every truck currently flagged live, with its last known broadcast.
    // `locations` holds one row per truck (unique on truck_id), so this is a
    // 1:1 join, not a fan-out.
    const { data: liveTrucks, error: fetchErr } = await db
      .from("trucks")
      .select("id, name, timezone, locations(broadcasted_at)")
      .eq("is_live", true)
      .limit(BATCH_LIMIT);

    if (fetchErr) {
      console.error("[auto-offline] fetch failed:", fetchErr.message);
      return NextResponse.json({ error: "Failed to load live trucks" }, { status: 500 });
    }

    if (!liveTrucks?.length) {
      return NextResponse.json({ checked: 0, wentOffline: 0 });
    }

    const trucks = liveTrucks as LiveTruckRow[];

    // Today's and yesterday's posted hours for exactly these trucks. Both days
    // are fetched for every truck rather than per-truck-weekday, because each
    // truck resolves "today" in its own zone.
    const { data: scheduleRows } = await db
      .from("schedules")
      .select("truck_id, day_of_week, open_time, close_time")
      .in("truck_id", trucks.map((t) => t.id));

    const byTruck = new Map<string, ScheduleRow[]>();
    for (const row of (scheduleRows ?? []) as ScheduleRow[]) {
      const list = byTruck.get(row.truck_id);
      if (list) list.push(row);
      else byTruck.set(row.truck_id, [row]);
    }

    type Doomed = { id: string; name: string; reason: "schedule" | "stale"; detail: string };
    const doomed: Doomed[] = [];

    for (const t of trucks) {
      // Supabase returns an embedded 1:1 relation as either an object or a
      // single-element array depending on how it infers the relationship.
      const loc = Array.isArray(t.locations) ? t.locations[0] : t.locations;
      const last = loc?.broadcasted_at;

      // A truck marked live that never broadcast at all is stale by
      // definition — it can't be on the map anywhere meaningful.
      if (!last || last < cutoff) {
        doomed.push({
          id: t.id,
          name: t.name,
          reason: "stale",
          detail: last ? `last ping ${last}` : "never broadcast",
        });
        continue;
      }

      const { day, minutes } = localNow(t.timezone, now);
      const lastClose = lastCloseMinuteToday(byTruck.get(t.id) ?? [], day);
      if (lastClose != null && minutes > lastClose + SCHEDULE_GRACE_MINUTES) {
        doomed.push({
          id: t.id,
          name: t.name,
          reason: "schedule",
          detail: `closed at ${lastClose} min local, now ${minutes}`,
        });
      }
    }

    // ?dryRun=1 reports what would happen without writing anything. Taking a
    // truck offline is visible to its owner and its customers, so there needs
    // to be a way to check the windows are tuned correctly before the cron
    // runs for real — and a way to re-check them later.
    if (new URL(req.url).searchParams.get("dryRun") === "1") {
      return NextResponse.json({
        dryRun: true,
        staleHours: STALE_HOURS,
        scheduleGraceMinutes: SCHEDULE_GRACE_MINUTES,
        checked: trucks.length,
        wouldGoOffline: doomed,
      });
    }

    if (doomed.length === 0) {
      return NextResponse.json({ checked: trucks.length, wentOffline: 0 });
    }

    const doomedIds = doomed.map((t) => t.id);

    const { error: updateErr } = await db
      .from("trucks")
      .update({ is_live: false })
      .in("id", doomedIds);

    if (updateErr) {
      console.error("[auto-offline] update failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update trucks" }, { status: 500 });
    }

    // Close the live session too, so reliability sees a finished service
    // rather than a session that never ends. Grouped by reason because
    // "closed after their posted hours" and "phone went dark" are different
    // facts about the truck.
    for (const reason of ["schedule", "stale"] as const) {
      const ids = doomed.filter((t) => t.reason === reason).map((t) => t.id);
      if (ids.length === 0) continue;
      const { error: sessionErr } = await db
        .from("live_sessions")
        .update({ ended_at: now.toISOString(), ended_by: reason })
        .in("truck_id", ids)
        .is("ended_at", null);
      if (sessionErr) {
        // The truck is already offline, which is the part customers see.
        console.error("[auto-offline] session close failed:", sessionErr.message);
      }
    }

    console.log(
      `[auto-offline] took ${doomedIds.length} truck(s) offline:`,
      doomed.map((t) => `${t.name} (${t.reason})`).join(", ")
    );

    return NextResponse.json({
      checked: trucks.length,
      wentOffline: doomedIds.length,
      byReason: {
        schedule: doomed.filter((t) => t.reason === "schedule").length,
        stale: doomed.filter((t) => t.reason === "stale").length,
      },
    });
  } catch (err) {
    console.error("[auto-offline] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
