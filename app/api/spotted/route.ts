import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Per-user rate limiting: max 1 spotted post per truck per 10 minutes
// In-memory map keyed by "userId:truckId" → last post timestamp
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const lastPostMap = new Map<string, number>();

function isRateLimited(userId: string, truckId: string): boolean {
  const key = `${userId}:${truckId}`;
  const lastPost = lastPostMap.get(key);
  const now = Date.now();
  if (lastPost && now - lastPost < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  lastPostMap.set(key, now);
  // Evict old entries to prevent unbounded growth
  setTimeout(() => {
    const stored = lastPostMap.get(key);
    if (stored && Date.now() - stored >= RATE_LIMIT_WINDOW_MS) {
      lastPostMap.delete(key);
    }
  }, RATE_LIMIT_WINDOW_MS);
  return false;
}

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

  // ── Rate limiting ──────────────────────────────────────────────────────────
  if (isRateLimited(user.id, truck_id)) {
    return NextResponse.json(
      { error: "You can only post one sighting per truck every 10 minutes. Please wait before posting again." },
      { status: 429 }
    );
  }

  // ── Verify truck exists ────────────────────────────────────────────────────
  const adminClient = getAdminClient();
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
