// Presence, freshness and wait-time helpers shared by the website and the
// mobile app (`@shared/presence`). Keep this file dependency-free so Metro can
// bundle it alongside Next.
//
// The product promise is "this truck is here right now". Everything in here
// exists to make that claim checkable: how old the truck's last GPS ping is,
// what other customers reported in the last hour and a half, how long the line
// is, and how often the truck actually shows up when it says it will.

// ── Location freshness ───────────────────────────────────────────────────────
//
// `is_live` is an operator toggle, so on its own it only means "somebody tapped
// Go Live at some point". `locations.broadcasted_at` is the real signal: the
// dashboard re-broadcasts on every 50m of movement AND on a fixed heartbeat
// while live, so a recent ping means a phone is genuinely out there.

/** A ping this new is treated as the truck confirming its own position. */
export const FRESH_MINUTES = 20;
/** Past this, we stop implying the address is current. */
export const RECENT_MINUTES = 90;

export type FreshnessLevel = "fresh" | "recent" | "stale" | "unknown";

export type Freshness = {
  level: FreshnessLevel;
  /** Minutes since the last ping, or null when the truck has never pinged. */
  minutes: number | null;
  /** Chip-sized label, e.g. "Confirmed 4m ago". */
  label: string;
  /** Extra warning where there is room. Empty string when nothing is wrong. */
  caveat: string;
};

/** Whole minutes between `ts` and `now`; null for a missing/unparseable value. */
export function minutesSince(ts: string | null | undefined, now: Date = new Date()): number | null {
  if (!ts) return null;
  const then = new Date(ts).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 60_000));
}

/** "4m", "3h", "2d" — compact enough for a chip. */
export function shortAge(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function freshnessOf(broadcastedAt: string | null | undefined, now: Date = new Date()): Freshness {
  const minutes = minutesSince(broadcastedAt, now);
  if (minutes == null) {
    return { level: "unknown", minutes: null, label: "Position unconfirmed", caveat: "No GPS ping from this truck" };
  }
  if (minutes < 1) return { level: "fresh", minutes, label: "Confirmed just now", caveat: "" };
  if (minutes <= FRESH_MINUTES) return { level: "fresh", minutes, label: `Confirmed ${shortAge(minutes)} ago`, caveat: "" };
  if (minutes <= RECENT_MINUTES) {
    return { level: "recent", minutes, label: `Last ping ${shortAge(minutes)} ago`, caveat: "Address may be a little behind" };
  }
  return { level: "stale", minutes, label: `Last ping ${shortAge(minutes)} ago`, caveat: "May have moved — check before you go" };
}

// ── Customer presence reports ────────────────────────────────────────────────
//
// One tap from a customer standing in front of the truck ("still here") or in
// front of an empty curb ("gone"). This is the part no delivery app can copy.
//
// "Here" counts immediately — a false positive just means one extra person
// agreed with the map. "Gone" is held to a higher bar, because a single
// malicious or mistaken tap must never be able to take a working truck off the
// map during its lunch rush.

export const PRESENCE_WINDOW_MIN = 90;
export const GONE_REPORTS_REQUIRED = 2;
/**
 * Distinct SIGNED-IN reporters needed before "they're gone" actually pulls the
 * truck off the map, rather than only flagging it as disputed.
 *
 * Anonymous reports are counted for the disputed banner but never toward
 * closing, and the count is deliberately not the main defence. A reporter key
 * is a salted hash of an IP, and an IP is not an identity: a phone in airplane
 * mode picks up a fresh CGNAT address in seconds, so "three distinct
 * reporters" is about two minutes of work for one person with a grudge. Three
 * accounts is a real bar; three IPs is not. Shared NAT cuts the other way too
 * — an office park full of genuine customers can collapse to a single key,
 * which is exactly the venue where trucks work.
 *
 * Showing a warning is cheap and reversible. Taking a working truck's pin down
 * during its lunch rush is neither, so the destructive path gets the stricter
 * identity, a shorter window, and the heartbeat veto in /api/presence.
 */
export const GONE_REPORTS_TO_CLOSE = 3;

/**
 * How recent those reports must be to close a truck. Shorter than the display
 * window: "gone" an hour ago and quiet since is not evidence a truck is absent
 * now — it may well have come back.
 */
export const GONE_CLOSE_WINDOW_MIN = 30;

export type PresenceVerdict = "here" | "gone";
export type PresenceReport = { verdict: PresenceVerdict; created_at: string };

export type PresenceSummary = {
  here: number;
  gone: number;
  /** "confirmed" — customers back the map; "disputed" — enough say it's gone. */
  state: "confirmed" | "disputed" | "quiet";
  label: string;
};

export function summarizePresence(
  reports: PresenceReport[],
  now: Date = new Date(),
): PresenceSummary {
  let here = 0;
  let gone = 0;
  for (const r of reports) {
    const age = minutesSince(r.created_at, now);
    if (age == null || age > PRESENCE_WINDOW_MIN) continue;
    if (r.verdict === "here") here++;
    else if (r.verdict === "gone") gone++;
  }
  if (gone >= GONE_REPORTS_REQUIRED && gone > here) {
    return { here, gone, state: "disputed", label: `${gone} people say it's gone` };
  }
  if (here > 0) {
    return { here, gone, state: "confirmed", label: here === 1 ? "1 person confirmed it's here" : `${here} people confirmed it's here` };
  }
  return { here, gone, state: "quiet", label: "No customer confirmations yet" };
}

// ── Wait time ────────────────────────────────────────────────────────────────
//
// The single biggest unknown in street food, and nothing else reports it.
// Customers pick a bucket; the operator can override from the dashboard.
// Both decay, because a 40-minute-old line report is worse than none.

export const WAIT_BUCKETS = [0, 10, 20, 30] as const;
export type WaitBucket = (typeof WAIT_BUCKETS)[number];

/** How long an operator-set wait stays authoritative. */
export const OPERATOR_WAIT_TTL_MIN = 45;
/** Customer reports older than this are ignored entirely. */
export const CUSTOMER_WAIT_WINDOW_MIN = 30;

export function waitLabel(minutes: number): string {
  if (minutes <= 0) return "No line";
  if (minutes >= 30) return "30+ min wait";
  return `~${minutes} min wait`;
}

/** Short form for a map pin or a list card. */
export function waitChip(minutes: number): string {
  if (minutes <= 0) return "No line";
  if (minutes >= 30) return "30+ min";
  return `~${minutes} min`;
}

export type WaitReport = { minutes: number; created_at: string };

export type WaitEstimate = {
  minutes: number;
  label: string;
  chip: string;
  source: "operator" | "customers";
  /** How many customer reports back this (0 when the operator set it). */
  reports: number;
  ageMinutes: number;
};

/**
 * The operator's own number wins while it is fresh — they can see the line.
 * Otherwise fall back to the median of recent customer reports, which resists
 * a single joker picking "30+" more gracefully than an average would.
 */
export function waitEstimate(
  input: {
    operatorMinutes?: number | null;
    operatorSetAt?: string | null;
    reports?: WaitReport[] | null;
  },
  now: Date = new Date(),
): WaitEstimate | null {
  const opAge = minutesSince(input.operatorSetAt, now);
  if (input.operatorMinutes != null && opAge != null && opAge <= OPERATOR_WAIT_TTL_MIN) {
    const minutes = clampBucket(input.operatorMinutes);
    return { minutes, label: waitLabel(minutes), chip: waitChip(minutes), source: "operator", reports: 0, ageMinutes: opAge };
  }

  const fresh: { minutes: number; age: number }[] = [];
  for (const r of input.reports ?? []) {
    const age = minutesSince(r.created_at, now);
    if (age == null || age > CUSTOMER_WAIT_WINDOW_MIN) continue;
    fresh.push({ minutes: clampBucket(r.minutes), age });
  }
  if (fresh.length === 0) return null;

  const sorted = fresh.map((f) => f.minutes).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // Even counts round to the more cautious of the two middle values: telling
  // someone the line is longer than it is costs less than the reverse.
  const minutes = sorted.length % 2 === 1 ? sorted[mid] : Math.max(sorted[mid - 1], sorted[mid]);
  const ageMinutes = Math.min(...fresh.map((f) => f.age));
  return { minutes, label: waitLabel(minutes), chip: waitChip(minutes), source: "customers", reports: fresh.length, ageMinutes };
}

/** Snap any number to the nearest reportable bucket. */
export function clampBucket(minutes: number): WaitBucket {
  let best: WaitBucket = WAIT_BUCKETS[0];
  let bestDelta = Infinity;
  for (const b of WAIT_BUCKETS) {
    const d = Math.abs(b - minutes);
    if (d < bestDelta) { best = b; bestDelta = d; }
  }
  return best;
}

// ── Reliability ──────────────────────────────────────────────────────────────
//
// "Showed up when the schedule said they would", measured over the last 30 days
// from `live_sessions` against `schedules`. Deliberately silent until there is
// enough history to be fair to a truck that just joined.

export const RELIABILITY_MIN_STOPS = 5;

export type ReliabilityBadge = {
  pct: number;
  label: string;
  tone: "good" | "ok" | "poor";
};

export function reliabilityBadge(
  score: number | null | undefined,
  stops: number | null | undefined,
): ReliabilityBadge | null {
  if (score == null || stops == null || stops < RELIABILITY_MIN_STOPS) return null;
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  const tone: ReliabilityBadge["tone"] = pct >= 85 ? "good" : pct >= 60 ? "ok" : "poor";
  return { pct, label: `Shows up ${pct}% of the time`, tone };
}
