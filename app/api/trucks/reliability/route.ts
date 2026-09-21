import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";
import { parseClock } from "@/lib/discovery";
import { RELIABILITY_MIN_STOPS } from "@/lib/presence";
import { DEFAULT_TZ, partsIn, zonedToUtc } from "@/lib/schedule-tz";

// ---------------------------------------------------------------------------
// Reliability — "does this truck actually show up?" — runs daily via cron.
//
// A posted schedule is a promise. Before `live_sessions` existed there was no
// way to tell whether trucks kept theirs: `locations` is an upsert with one
// row per truck, so yesterday's service left no trace at all. Now every Go
// Live writes a session, and this job scores the last 30 days against the
// posted hours: of the stops a truck said it would work, how many did it
// actually go live for?
//
// The score is written to the truck rather than computed on read, so a map
// with 200 pins doesn't run 200 aggregates. It stays hidden in the UI until a
// truck has RELIABILITY_MIN_STOPS scheduled stops behind it — a truck that
// joined last week has not earned a bad grade, and shouldn't be given one.
//
// Security: protected by CRON_SECRET header (set in Vercel env vars).
// ---------------------------------------------------------------------------

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WINDOW_DAYS = 30;
/** A session must overlap a posted stop by this much to count as showing up. */
const MIN_OVERLAP_MINUTES = 15;
const BATCH_LIMIT = 500;

type TruckRow = { id: string; timezone: string | null };
type ScheduleRow = { truck_id: string; day_of_week: number; open_time: string | null; close_time: string | null };
type SessionRow = { truck_id: string; started_at: string; ended_at: string | null };

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const expected = `Bearer ${cronSecret}`;
  const supplied = req.headers.get("authorization") ?? "";
  const maxLen = Math.max(expected.length, supplied.length);
  if (!timingSafeEqual(Buffer.from(expected.padEnd(maxLen)), Buffer.from(supplied.padEnd(maxLen)))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - (WINDOW_DAYS + 1) * 86_400_000);

  try {
    const { data: truckRows, error: truckErr } = await db
      .from("trucks")
      .select("id, timezone")
      .limit(BATCH_LIMIT);
    if (truckErr) {
      console.error("[reliability] truck fetch failed:", truckErr.message);
      return NextResponse.json({ error: "Failed to load trucks" }, { status: 500 });
    }
    const trucks = (truckRows ?? []) as TruckRow[];
    if (trucks.length === 0) return NextResponse.json({ scored: 0 });

    const ids = trucks.map((t) => t.id);

    const [{ data: schedRows }, { data: sessionRows }] = await Promise.all([
      db.from("schedules").select("truck_id, day_of_week, open_time, close_time").in("truck_id", ids),
      db
        .from("live_sessions")
        .select("truck_id, started_at, ended_at")
        .in("truck_id", ids)
        .gte("started_at", windowStart.toISOString())
        .limit(5000),
    ]);

    const schedByTruck = new Map<string, ScheduleRow[]>();
    for (const r of (schedRows ?? []) as ScheduleRow[]) {
      const list = schedByTruck.get(r.truck_id);
      if (list) list.push(r);
      else schedByTruck.set(r.truck_id, [r]);
    }

    const sessionsByTruck = new Map<string, { start: number; end: number }[]>();
    for (const r of (sessionRows ?? []) as SessionRow[]) {
      const start = new Date(r.started_at).getTime();
      if (!Number.isFinite(start)) continue;
      // An open session is still running, so it counts up to now.
      const end = r.ended_at ? new Date(r.ended_at).getTime() : now.getTime();
      if (!Number.isFinite(end) || end <= start) continue;
      const list = sessionsByTruck.get(r.truck_id);
      if (list) list.push({ start, end });
      else sessionsByTruck.set(r.truck_id, [{ start, end }]);
    }

    const updates: { id: string; score: number | null; stops: number }[] = [];

    for (const truck of trucks) {
      const stops = schedByTruck.get(truck.id) ?? [];
      if (stops.length === 0) {
        updates.push({ id: truck.id, score: null, stops: 0 });
        continue;
      }

      const tz = truck.timezone || DEFAULT_TZ;
      const sessions = sessionsByTruck.get(truck.id) ?? [];
      const today = partsIn(now, tz);
      // Anchor on local noon so stepping back a day can't land on a DST
      // transition and skip or repeat a calendar date.
      const anchor = Date.UTC(today.year, today.month - 1, today.day, 12);

      let scheduled = 0;
      let kept = 0;

      // Yesterday backwards: today's stops may not have happened yet, and
      // scoring a truck for a lunch it hasn't served is just noise.
      for (let back = 1; back <= WINDOW_DAYS; back++) {
        const dayParts = partsIn(new Date(anchor - back * 86_400_000), tz);
        for (const stop of stops) {
          if (stop.day_of_week !== dayParts.weekday) continue;
          const open = parseClock(stop.open_time);
          let close = parseClock(stop.close_time);
          if (open == null || close == null) continue;
          if (close <= open) close += 24 * 60;

          const openAt = zonedToUtc(dayParts.year, dayParts.month, dayParts.day, open, tz).getTime();
          const closeAt = zonedToUtc(dayParts.year, dayParts.month, dayParts.day, close, tz).getTime();
          // A stop still in progress isn't a missed stop yet.
          if (closeAt > now.getTime()) continue;

          scheduled++;
          let overlap = 0;
          for (const s of sessions) {
            overlap += Math.max(0, Math.min(closeAt, s.end) - Math.max(openAt, s.start));
            if (overlap >= MIN_OVERLAP_MINUTES * 60_000) break;
          }
          if (overlap >= MIN_OVERLAP_MINUTES * 60_000) kept++;
        }
      }

      updates.push({
        id: truck.id,
        score: scheduled > 0 ? kept / scheduled : null,
        stops: scheduled,
      });
    }

    // Chunked so a few hundred trucks don't open a few hundred sockets at once.
    const stamp = now.toISOString();
    for (let i = 0; i < updates.length; i += 20) {
      await Promise.all(
        updates.slice(i, i + 20).map((u) =>
          db
            .from("trucks")
            .update({
              reliability_score: u.score,
              reliability_stops: u.stops,
              reliability_updated_at: stamp,
            })
            .eq("id", u.id)
        )
      );
    }

    const shown = updates.filter((u) => u.stops >= RELIABILITY_MIN_STOPS).length;
    console.log(`[reliability] scored ${updates.length} truck(s); ${shown} have enough history to display`);

    return NextResponse.json({
      scored: updates.length,
      displayable: shown,
      windowDays: WINDOW_DAYS,
    });
  } catch (err) {
    console.error("[reliability] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
