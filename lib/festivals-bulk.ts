/**
 * Parser for the admin Festivals tab's bulk-paste box.
 *
 * Events are researched as a written list once a month, so the import format is
 * one event per line with `|` between fields — a delimiter that does not show up
 * in event names, venues, or prose descriptions the way a comma does:
 *
 *   Name | City | Date | Venue | Description
 *
 * Name, City and Date are required; Venue and Description are optional and may
 * be left empty or omitted entirely. Blank lines and `#` comments are skipped,
 * so a pasted list can keep its county headings as comments.
 *
 * Dates accept the shapes the source listings actually use — "Sept 12",
 * "September 12", "Sept 18-20", "Sep 10 - Oct 12", "9/12", "2026-09-12" — and
 * an omitted year resolves to the upcoming occurrence (see resolveYear).
 */

export type ParsedFestival = {
  name: string;
  city: string;
  venue: string | null;
  description: string | null;
  start_date: string;
  end_date: string;
};

export type ParseIssue = { line: number; text: string; error: string };

export type ParseResult = {
  rows: ParsedFestival[];
  issues: ParseIssue[];
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** True when the calendar actually has this day — rejects Feb 30, Sep 31, etc. */
function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

type DayRef = { month: number | null; day: number; year: number | null };

/** Parses one side of a range: "Sept 12", "Sep 12, 2026", "9/12", or a bare "14". */
function parseDayRef(raw: string): DayRef | null {
  const t = raw.trim().replace(/(\d)(st|nd|rd|th)\b/i, "$1").replace(/,/g, " ").trim();
  if (!t) return null;

  // "9/12" or "9/12/2026"
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : null;
    return { month: Number(slash[1]), day: Number(slash[2]), year };
  }

  // "Sept 12" / "September 12 2026" / "12 Sept"
  const words = t.split(/\s+/);
  let month: number | null = null;
  let day: number | null = null;
  let year: number | null = null;
  for (const w of words) {
    const key = w.toLowerCase().replace(/\./g, "");
    if (key in MONTHS) { month = MONTHS[key]; continue; }
    if (/^\d{4}$/.test(w)) { year = Number(w); continue; }
    if (/^\d{1,2}$/.test(w)) { if (day === null) day = Number(w); continue; }
    return null; // unrecognised token — refuse rather than guess
  }
  if (day === null) return null;
  return { month, day, year };
}

/**
 * Picks the year for a date given without one: the current year, unless that
 * would put the event well in the past, in which case it is next year's. The
 * 45-day grace keeps an event that started a couple of weeks ago from jumping
 * a year forward mid-run.
 */
function resolveYear(month: number, day: number, today: Date): number {
  const year = today.getFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  const cutoff = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - 45 * 86400000;
  return candidate < cutoff ? year + 1 : year;
}

/** Parses a date cell into an ISO start/end pair. */
export function parseDateRange(
  raw: string,
  today: Date = new Date()
): { start: string; end: string } | { error: string } {
  const text = raw.trim().replace(/[‒–—]/g, "-");
  if (!text) return { error: "date is missing" };

  // Plain ISO, single or range
  if (ISO_RE.test(text)) return { start: text, end: text };
  // Matched as a whole rather than split, since ISO dates contain dashes.
  const isoRange = text.match(/^(\d{4}-\d{2}-\d{2})\s*(?:to|through|\.\.|-)\s*(\d{4}-\d{2}-\d{2})$/i);
  if (isoRange) {
    if (isoRange[2] < isoRange[1]) return { error: "end date is before the start date" };
    return { start: isoRange[1], end: isoRange[2] };
  }

  const parts = text.split(/\s+(?:to|through)\s+|\s*-\s*/i).filter(Boolean);
  if (parts.length > 2) return { error: `could not read the date "${raw.trim()}"` };

  const first = parseDayRef(parts[0]);
  if (!first || first.month === null) return { error: `could not read the date "${raw.trim()}"` };

  const second = parts[1] ? parseDayRef(parts[1]) : null;
  if (parts[1] && !second) return { error: `could not read the end date in "${raw.trim()}"` };

  const startMonth = first.month;
  const startYear = first.year ?? resolveYear(startMonth, first.day, today);
  if (!isRealDate(startYear, startMonth, first.day)) {
    return { error: `"${parts[0].trim()}" is not a real date` };
  }
  const start = iso(startYear, startMonth, first.day);

  if (!second) return { start, end: start };

  // "Sept 18-20" leaves the second month implicit.
  const endMonth = second.month ?? startMonth;
  let endYear = second.year ?? startYear;
  if (!isRealDate(endYear, endMonth, second.day)) {
    return { error: `"${parts[1].trim()}" is not a real date` };
  }
  let end = iso(endYear, endMonth, second.day);
  // A range that crosses New Year, e.g. "Dec 30 - Jan 2".
  if (end < start && second.year === null) {
    endYear += 1;
    end = iso(endYear, endMonth, second.day);
  }
  if (end < start) return { error: "end date is before the start date" };
  return { start, end };
}

/** Parses the whole textarea. Every line either yields a row or an issue. */
export function parseFestivalLines(input: string, today: Date = new Date()): ParseResult {
  const rows: ParsedFestival[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set<string>();

  input.split(/\r?\n/).forEach((rawLine, i) => {
    const lineNo = i + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 3) {
      issues.push({ line: lineNo, text: line, error: "needs at least Name | City | Date" });
      return;
    }

    const [name, city, dateCell, venueCell, ...rest] = cells;
    if (!name) return issues.push({ line: lineNo, text: line, error: "name is empty" });
    if (name.length > 200) return issues.push({ line: lineNo, text: line, error: "name is over 200 characters" });
    if (!city) return issues.push({ line: lineNo, text: line, error: "city is empty" });
    if (city.length > 100) return issues.push({ line: lineNo, text: line, error: "city is over 100 characters" });

    const parsed = parseDateRange(dateCell, today);
    if ("error" in parsed) return issues.push({ line: lineNo, text: line, error: parsed.error });

    // Any extra `|` cells belong to the description — rejoining means a
    // description may itself contain a pipe without breaking the row.
    const description = rest.join(" | ").trim();

    const key = `${name.toLowerCase()}|${city.toLowerCase()}|${parsed.start}`;
    if (seen.has(key)) {
      issues.push({ line: lineNo, text: line, error: "duplicate of an earlier line in this paste" });
      return;
    }
    seen.add(key);

    rows.push({
      name,
      city,
      venue: venueCell ? venueCell.slice(0, 200) : null,
      description: description ? description.slice(0, 2000) : null,
      start_date: parsed.start,
      end_date: parsed.end,
    });
  });

  return { rows, issues };
}
