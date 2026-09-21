import { parseClock } from "@/lib/discovery";

/**
 * Wall-clock arithmetic in a truck's own time zone.
 *
 * `schedules.open_time` / `close_time` are text in the truck's local time
 * ("2:00 PM"). The crons that read them run in UTC, so comparing the two
 * directly would close an East Coast evening service five hours early. Every
 * schedule-vs-now comparison goes through here.
 *
 * Server-side only: this leans on `Intl.DateTimeFormat` with a `timeZone`,
 * which the app's Hermes runtime does not reliably support. Customer-facing
 * schedule logic lives in lib/discovery.ts and uses the device's own clock,
 * which is the right zone for someone standing next to the truck anyway.
 */

/** Where essentially every truck on the platform currently operates. */
export const DEFAULT_TZ = "America/New_York";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday, matching `schedules.day_of_week`. */
  weekday: number;
};

/**
 * Break an instant into its calendar fields in `tz`. An unknown or malformed
 * zone falls back to the default rather than throwing — one bad row must not
 * stop a sweep over every truck.
 */
export function partsIn(date: Date, tz: string | null | undefined): ZonedParts {
  const read = (zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(date);

  let parts;
  try {
    parts = read(tz || DEFAULT_TZ);
  } catch {
    parts = read(DEFAULT_TZ);
  }

  const num = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const weekday = DAY_ABBR.indexOf(parts.find((p) => p.type === "weekday")?.value ?? "");
  return {
    year: num("year"),
    month: num("month"),
    day: num("day"),
    hour: num("hour"),
    minute: num("minute"),
    second: num("second"),
    weekday: weekday === -1 ? date.getUTCDay() : weekday,
  };
}

/** Offset of `tz` from UTC in milliseconds, at the given instant. */
export function tzOffsetMs(date: Date, tz: string | null | undefined): number {
  const p = partsIn(date, tz);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - date.getTime();
}

/**
 * The UTC instant of a wall-clock time in `tz`.
 *
 * The offset depends on the instant, which is what we're solving for, so this
 * guesses using the offset at the naive timestamp and then corrects once. That
 * second pass is what handles the two DST changeovers a year, where the first
 * guess lands on the wrong side of the transition.
 */
export function zonedToUtc(
  year: number, month: number, day: number, minutes: number, tz: string | null | undefined,
): Date {
  const naive = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const guess = tzOffsetMs(new Date(naive), tz);
  const corrected = tzOffsetMs(new Date(naive - guess), tz);
  return new Date(naive - corrected);
}

/** The truck's local weekday and minute-of-day right now. */
export function localNow(tz: string | null | undefined, now: Date): { day: number; minutes: number } {
  const p = partsIn(now, tz);
  return { day: p.weekday, minutes: p.hour * 60 + p.minute };
}

export type ScheduleWindow = {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
};

/**
 * The last minute-of-today this truck is scheduled to still be serving, or
 * null when nothing it posted reaches into today.
 *
 * Yesterday's stops count: a 10pm–1am Friday service is still running at
 * 12:30am on Saturday, and closing it because "today has no stops" would take
 * a working truck off the map mid-service. A value above 1440 means the
 * service runs past midnight into tomorrow, so today is never "past close".
 */
export function lastCloseMinuteToday(stops: ScheduleWindow[], day: number): number | null {
  const yesterday = (day + 6) % 7;
  let latest: number | null = null;

  for (const s of stops) {
    const open = parseClock(s.open_time);
    let close = parseClock(s.close_time);
    if (open == null || close == null) continue;
    const overnight = close <= open;
    if (overnight) close += 24 * 60;

    let closeToday: number;
    if (s.day_of_week === day) {
      closeToday = close;
    } else if (s.day_of_week === yesterday && overnight) {
      // Yesterday's overnight close lands in the small hours of today.
      closeToday = close - 24 * 60;
    } else {
      continue;
    }

    if (latest == null || closeToday > latest) latest = closeToday;
  }

  return latest;
}
