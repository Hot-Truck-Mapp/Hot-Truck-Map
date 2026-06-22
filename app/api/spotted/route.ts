import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rate limit window: 1 spotted post per truck per user per 10 minutes.
// Enforced via a DB count on spotted_posts — shared across serverless instances.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: NextRequest) {
  // ── Authentication ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the token via Supabase
  const anonClient = getAnonClient();
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);

  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse and validate body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { truck_id, location, note } = body as Record<string, unknown>;

  if (!truck_id || typeof truck_id !== "string") {
    return NextResponse.json({ error: "truck_id is required" }, { status: 400 });
  }

  // Reject malformed IDs before they hit the DB
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(truck_id)) {
    return NextResponse.json({ error: "Invalid truck_id" }, { status: 400 });
  }

  if (!location || typeof location !== "string") {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  const trimmedLocation = location.trim();
  if (trimmedLocation.length === 0 || trimmedLocation.length > 100) {
    return NextResponse.json(
      { error: "location must be between 1 and 100 characters" },
      { status: 400 }
    );
  }

  let trimmedNote: string | null = null;
  if (note !== undefined && note !== null) {
    if (typeof note !== "string") {
      return NextResponse.json({ error: "note must be a string" }, { status: 400 });
    }
    const noteVal = note.trim();
    if (noteVal.length > 200) {
      return NextResponse.json(
        { error: "note must be 200 characters or fewer" },
        { status: 400 }
      );
    }
    trimmedNote = noteVal || null;
  }

  // ── Verify truck exists + rate limit ──────────────────────────────────────
  const adminClient = getAdminClient();

  // Rate limit: query spotted_posts directly — shared across serverless instances.
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count: recentCount } = await adminClient
    .from("spotted_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("truck_id", truck_id)
    .gte("created_at", windowStart);

  if ((recentCount ?? 0) > 0) {
    return NextResponse.json(
      { error: "You can only post one sighting per truck every 10 minutes. Please wait before posting again." },
      { status: 429 }
    );
  }
  const { data: truckExists } = await adminClient
    .from("trucks")
    .select("id")
    .eq("id", truck_id)
    .maybeSingle();
  if (!truckExists) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
  }

  // ── Insert into DB ─────────────────────────────────────────────────────────
  const { data, error } = await adminClient
    .from("spotted_posts")
    .insert({
      truck_id,
      user_id: user.id,
      location: trimmedLocation,
      note: trimmedNote,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[spotted] DB insert error:", error.message);
    return NextResponse.json({ error: "Could not save sighting. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id }, { status: 201 });
}
