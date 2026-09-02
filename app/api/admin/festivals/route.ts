import { NextRequest, NextResponse } from "next/server";
import { isValidStateCode, stateNameForCode } from "@/lib/us-states";
import { getServiceClient, requireAdmin } from "@/lib/admin-server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates the shared festival fields from a request body. Returns either
 * a cleaned record ready to insert/update, or a NextResponse error to return
 * directly to the caller. */
function validateFestivalBody(body: Record<string, unknown>):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: NextResponse } {
  const err = (message: string, status = 400) =>
    ({ ok: false as const, response: NextResponse.json({ error: message }, { status }) });

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) return err("name is required and must be 200 characters or fewer");

  const stateCode = typeof body.state_code === "string" ? body.state_code.toUpperCase() : "";
  if (!isValidStateCode(stateCode)) return err("Invalid state_code");
  const stateName = stateNameForCode(stateCode)!; // derived server-side, never trusted from client

  const city = typeof body.city === "string" ? body.city.trim() : "";
  if (!city || city.length > 100) return err("city is required and must be 100 characters or fewer");

  const county = typeof body.county === "string" && body.county.trim() ? body.county.trim().slice(0, 100) : null;
  const venue = typeof body.venue === "string" ? body.venue.trim().slice(0, 200) : null;
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) : null;

  const startDate = String(body.start_date ?? "");
  const endDate = String(body.end_date ?? "");
  if (!DATE_RE.test(startDate) || isNaN(new Date(startDate).getTime())) {
    return err("Invalid start_date format");
  }
  if (!DATE_RE.test(endDate) || isNaN(new Date(endDate).getTime())) {
    return err("Invalid end_date format");
  }
  if (endDate < startDate) return err("end_date must be on or after start_date");

  let websiteUrl: string | null = null;
  if (typeof body.website_url === "string" && body.website_url.trim()) {
    const trimmedUrl = body.website_url.trim().slice(0, 500);
    if (!/^https?:\/\//i.test(trimmedUrl)) return err("website_url must start with http:// or https://");
    websiteUrl = trimmedUrl;
  }

  let imageUrl: string | null = null;
  if (typeof body.image_url === "string" && body.image_url.trim()) {
    imageUrl = body.image_url.trim().slice(0, 500);
  }

  return {
    ok: true,
    value: {
      name,
      state_code: stateCode,
      state_name: stateName,
      county,
      city,
      venue,
      description,
      start_date: startDate,
      end_date: endDate,
      website_url: websiteUrl,
      image_url: imageUrl,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const db = getServiceClient();
    const upcomingOnly = req.nextUrl.searchParams.get("upcoming") === "true";

    let query = db.from("festivals").select("*").order("start_date");
    if (upcomingOnly) {
      const today = new Date().toISOString().split("T")[0];
      query = query.gte("end_date", today);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to load festivals" }, { status: 500 });

    return NextResponse.json({ festivals: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const validated = validateFestivalBody(body);
    if (!validated.ok) return validated.response;

    const db = getServiceClient();
    const { data, error } = await db.from("festivals").insert(validated.value).select().single();
    if (error) return NextResponse.json({ error: "Failed to create festival" }, { status: 500 });

    return NextResponse.json({ festival: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const validated = validateFestivalBody(body);
    if (!validated.ok) return validated.response;

    const db = getServiceClient();
    const { data, error } = await db
      .from("festivals")
      .update({ ...validated.value, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: "Failed to update festival" }, { status: 500 });

    return NextResponse.json({ festival: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAdmin();
    if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

    const db = getServiceClient();
    const { error } = await db.from("festivals").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "Failed to delete festival" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
