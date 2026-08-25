// Content for "On the Menu" — the biweekly Hot Truck Map updates newsletter,
// published at /updates.
//
// Add a new issue by appending an object to UPDATES (newest first). Each
// issue gets its own static page at /updates/[slug] via generateStaticParams
// in app/updates/[slug]/page.tsx — no other wiring needed beyond that.
// Keep `summary` short: it's used for the index card, the OG description,
// and (later) the email subject line if this feed is ever piped into an
// actual email send. `tldr` should be 3 short skimmable bullets — the
// newsletter equivalent of a subject-line preview.

export interface UpdateItem {
  emoji: string;
  tag: "NEW" | "IMPROVED" | "FIX";
  title: string;
  body: string;
}

export interface UpdateIssue {
  slug: string;
  issue: number;
  title: string;
  dateISO: string; // YYYY-MM-DD
  dateLabel: string; // "August 25, 2026"
  summary: string;
  tldr: string[];
  headline: {
    emoji: string;
    tag: string;
    title: string;
    body: string[];
    cta?: { label: string; href: string };
  };
  items: UpdateItem[];
}

export const NEWSLETTER_NAME = "On the Menu";
export const NEWSLETTER_TAGLINE = "What's new at Hot Truck Map, every two weeks.";
export const CADENCE_DAYS = 14;

export const UPDATES: UpdateIssue[] = [
  {
    slug: "festivals-and-events",
    issue: 1,
    title: "Festivals & events land on the map",
    dateISO: "2026-08-25",
    dateLabel: "August 25, 2026",
    summary:
      "A new Events section for browsing food truck festivals by state, plus fresh cuisine filters and a smoother signup.",
    tldr: [
      "🎪 Browse food truck festivals & events by state — new /events section",
      "🌍 African and Caribbean cuisines added to search filters",
      "🔧 Operator signup and account deletion bugs fixed",
    ],
    headline: {
      emoji: "🎪",
      tag: "NEW FEATURE",
      title: "Browse food truck festivals by state",
      body: [
        "Food trucks don't just park on street corners — a huge amount of the scene happens at festivals, markets, and multi-truck events. Now Hot Truck Map has a home for that: pick a state, see what's coming up in each city, and get the details (dates, venue, website) without leaving the map.",
        "If you've granted the app your location, you'll also see an \"Events near you\" banner right on the map when something's happening close by. We're maintaining listings by hand for now, refreshed monthly, so what you see is curated rather than scraped.",
      ],
      cta: { label: "Browse Events", href: "/events" },
    },
    items: [
      {
        emoji: "🌍",
        tag: "NEW",
        title: "African and Caribbean cuisines added",
        body: "Two more cuisine categories are now searchable across the map and truck filters, making it easier to find — and for operators to be found under — the right label.",
      },
      {
        emoji: "🔧",
        tag: "FIX",
        title: "Operator signups no longer get miscategorized",
        body: "A bug was letting some operator accounts get classified as customers right after signup, which could hide a brand-new truck from its own dashboard. That's fixed — operator accounts now stay operator accounts from the moment you sign up.",
      },
      {
        emoji: "🔧",
        tag: "FIX",
        title: "Account deletion works reliably",
        body: "Some accounts were getting stuck mid-deletion due to a database constraint issue. Deleting your account now works cleanly every time, no matter when it was created.",
      },
    ],
  },
];

export function getUpdateBySlug(slug: string): UpdateIssue | undefined {
  return UPDATES.find((u) => u.slug === slug);
}

export function getAdjacentUpdates(slug: string): {
  older: UpdateIssue | undefined;
  newer: UpdateIssue | undefined;
} {
  const idx = UPDATES.findIndex((u) => u.slug === slug);
  if (idx === -1) return { older: undefined, newer: undefined };
  return { older: UPDATES[idx + 1], newer: UPDATES[idx - 1] };
}

/** Rough reading time from headline + item body word counts. Always ≥1 min. */
export function readMinutes(issue: UpdateIssue): number {
  const words =
    issue.headline.body.join(" ").split(/\s+/).length +
    issue.items.reduce((sum, i) => sum + i.body.split(/\s+/).length, 0);
  return Math.max(1, Math.round(words / 200));
}

/** Label for when the next issue is expected, based on the latest issue's date. */
export function nextIssueLabel(): string {
  const latest = UPDATES[0];
  const next = new Date(latest.dateISO + "T00:00:00");
  next.setDate(next.getDate() + CADENCE_DAYS);
  return next.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}
