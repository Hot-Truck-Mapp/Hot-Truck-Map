// Discovery helpers shared by the website and the mobile app (`@shared/discovery`).
// Keep this file dependency-free so Metro can bundle it alongside Next.

export type LatLng = { lat: number; lng: number };

/**
 * PostgREST embeds a one-to-one relation as a single object and a one-to-many
 * relation as an array. `locations` is unique on `truck_id`, so
 * `trucks.select("…, locations(…)")` comes back as an object — code that reads
 * `locations[0]` silently gets `undefined`. Accept either shape.
 */
export function firstOf<T>(embed: T | T[] | null | undefined): T | null {
  if (embed == null) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

/** Coerce a location-like row to finite, in-range coordinates, or null. */
export function toLatLng(loc: { lat?: unknown; lng?: unknown } | null | undefined): LatLng | null {
  if (!loc) return null;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Great-circle distance in miles. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatMiles(mi: number): string {
  if (mi < 0.1) return "Nearby";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

/**
 * Sort so live trucks come first, then nearest first. Trucks without a known
 * position keep their original relative order after those with one.
 */
export function sortByLiveThenDistance<T>(
  items: T[],
  isLive: (t: T) => boolean,
  distance: (t: T) => number | null,
): T[] {
  return items
    .map((t, i) => ({ t, i, live: isLive(t), d: distance(t) }))
    .sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      if (a.d != null && b.d != null) return a.d - b.d;
      if (a.d != null) return -1;
      if (b.d != null) return 1;
      return a.i - b.i;
    })
    .map((x) => x.t);
}

/**
 * Make user input safe for a PostgREST `ilike` filter: escape `%`, `_` and `\`
 * so they match literally, and drop `*`, which PostgREST treats as `%`.
 */
export function escapeIlike(q: string): string {
  return q.replace(/\*/g, "").replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Menu-item search rows → truck_id → first matching dish name. */
export function firstDishByTruck(rows: { truck_id: string | null; name: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.truck_id && !(r.truck_id in out)) out[r.truck_id] = r.name;
  }
  return out;
}

// ── Schedules ────────────────────────────────────────────────────────────────
// Operators pick times from a fixed list ("10:00 AM" … "2:00 AM"), stored as
// text in the truck's local time; `day_of_week` is 0 = Sunday.

/** "4:00 PM" → minutes after midnight, or null if unparseable. */
export function parseClock(s: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])\s*$/.exec(s ?? "");
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}

export type ScheduleStop = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  location: string | null;
  notes?: string | null;
};

export type StopStatus = "open" | "later";

/**
 * Today's stops that haven't ended yet, soonest first. A stop that closes
 * after midnight ("10:00 PM"–"1:00 AM") counts as running until it closes.
 */
export function stopsLeftToday<S extends ScheduleStop>(
  stops: S[],
  now: Date = new Date(),
): (S & { status: StopStatus; openMin: number })[] {
  const today = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out: (S & { status: StopStatus; openMin: number })[] = [];
  for (const s of stops) {
    if (s.day_of_week !== today) continue;
    const open = parseClock(s.open_time);
    let close = parseClock(s.close_time);
    if (open == null || close == null) continue;
    if (close <= open) close += 24 * 60;
    if (nowMin >= close) continue;
    out.push({ ...s, status: nowMin >= open ? "open" : "later", openMin: open });
  }
  return out.sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return a.openMin - b.openMin;
  });
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The truck's next scheduled stop: one still running or coming up today, else
 * the earliest stop on the soonest following day, with a label like "Today",
 * "Tomorrow" or "Tuesday". Null when nothing is scheduled.
 */
export function nextStop<S extends ScheduleStop>(
  stops: S[],
  now: Date = new Date(),
): { stop: S; when: string; status: StopStatus | "upcoming" } | null {
  const today = stopsLeftToday(stops, now)[0];
  if (today) return { stop: today, when: "Today", status: today.status };
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = (now.getDay() + ahead) % 7;
    const first = stops
      .filter((s) => s.day_of_week === day && parseClock(s.open_time) != null)
      .sort((a, b) => parseClock(a.open_time)! - parseClock(b.open_time)!)[0];
    if (first) return { stop: first, when: ahead === 1 ? "Tomorrow" : DAY_NAMES[day], status: "upcoming" };
  }
  return null;
}
