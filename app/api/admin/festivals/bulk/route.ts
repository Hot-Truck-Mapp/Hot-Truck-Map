import { NextRequest, NextResponse } from "next/server";
import { isValidStateCode, stateNameForCode } from "@/lib/us-states";
import { getServiceClient, requireAdmin } from "@/lib/admin-server";

/**
 * Bulk insert for the admin Festivals tab's paste box. Events are researched as
 * a written list once a month, so this takes a whole batch at once instead of
 * one form submission per event.
 *
 * Rows already in the table — matched on state + name + city + start date — are
 * skipped rather than duplicated, so re-pasting a list that overlaps last
 * month's is safe.
 */

const MAX_ROWS = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type IncomingRow = {
  name?: unknown;
  city?: unknown;
  venue?: unknown;
  description?: unknown;
  start_date?: unknown;
  end_date?: unknown;
};

type CleanRow = {
  name: string;
  state_code: string;
  state_name: string;
  city: string;
  venue: string | null;
  description: string | null;
  start_date: string;
  end_date: string;
};

/** Re-validates one row server-side; the client's parse is never trusted. */
function cleanRow(row: IncomingRow, stateCode: string, stateName: string): CleanRow | string {
  const name = typeof row.name === "string" ? row.name.trim() : "";
  if (!name) return "name is required";
  if (name.length > 200) return "name must be 200 characters or fewer";

  const city = typeof row.city === "string" ? row.city.trim() : "";
  if (!city) return "city is required";
  if (city.length > 100) return "city must be 100 characters or fewer";

  const startDate = String(row.start_date ?? "");
  const endDate = String(row.end_date ?? "");
  if (!DATE_RE.test(startDate) || Number.isNaN(new Date(startDate).getTime())) return "invalid start date";
  if (!DATE_RE.test(endDate) || Number.isNaN(new Date(endDate).getTime())) return "invalid end date";
  if (endDate < startDate) return "end date must be on or after the start date";

  const venue = typeof row.venue === "string" && row.venue.trim() ? row.venue.trim().slice(0, 200) : null;
  const description =
    typeof row.description === "string" && row.description.trim() ? row.description.trim().slice(0, 2000) : null;

  return { name, state_code: stateCode, state_name: stateName, city, venue, description, start_date: startDate, end_date: endDate };
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();

    const stateCode = typeof body.state_code === "string" ? body.state_code.toUpperCase() : "";
    if (!isValidStateCode(stateCode)) return NextResponse.json({ error: "Invalid state_code" }, { status: 400 });
    const stateName = stateNameForCode(stateCode)!; // derived server-side, never trusted from the client

    const rows: IncomingRow[] = Array.isArray(body.festivals) ? body.festivals : [];
    if (rows.length === 0) return NextResponse.json({ error: "No events to import" }, { status: 400 });
    if (rows.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many events at once — ${MAX_ROWS} is the limit` }, { status: 400 });
    }

    const clean: CleanRow[] = [];
    const rejected: { name: string; error: string }[] = [];
    for (const row of rows) {
      const result = cleanRow(row, stateCode, stateName);
      if (typeof result === "string") {
        rejected.push({ name: typeof row.name === "string" ? row.name : "(unnamed)", error: result });
      } else {
        clean.push(result);
      }
    }
    if (clean.length === 0) {
      return NextResponse.json({ error: "No valid events to import", rejected }, { status: 400 });
    }

    const db = getServiceClient();

    // Skip anything already stored for this state, matched the same way the
    // SQL patches do: name + city + start date, case-insensitively.
    const { data: existing, error: readErr } = await db
      .from("festivals")
      .select("name, city, start_date")
      .eq("state_code", stateCode);
    if (readErr) return NextResponse.json({ error: "Failed to read existing festivals" }, { status: 500 });

    const key = (n: string, c: string, d: string) => `${n.toLowerCase()}|${c.toLowerCase()}|${d}`;
    const have = new Set((existing ?? []).map((f) => key(f.name, f.city, f.start_date)));

    const toInsert = clean.filter((r) => !have.has(key(r.name, r.city, r.start_date)));
    const skipped = clean.length - toInsert.length;

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0, skipped, rejected, festivals: [] });
    }

    const { data, error } = await db.from("festivals").insert(toInsert).select();
    if (error) return NextResponse.json({ error: "Failed to import events" }, { status: 500 });

    return NextResponse.json({ inserted: data?.length ?? 0, skipped, rejected, festivals: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
