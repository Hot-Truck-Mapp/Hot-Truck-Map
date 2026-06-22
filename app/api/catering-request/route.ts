import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isRateLimited } from "@/lib/rateLimit";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing service role config");
  return createSupabaseClient(url, key);
}

export async function POST(req: NextRequest) {
  // Resolve authenticated user first (if JWT present) to use user.id for rate limiting
  // and to enforce that the submitted email matches their account.
  let rateLimitKey: string;
  let resolvedUserId: string | null = null;
  let resolvedUserEmail: string | null = null;
  try {
    const supabaseCheck = await createServerClient();
    const { data: { user } } = await supabaseCheck.auth.getUser();
    resolvedUserId = user?.id ?? null;
    resolvedUserEmail = user?.email ?? null;
  } catch { /* anonymous request — fall through */ }

  if (resolvedUserId) {
    rateLimitKey = `user:${resolvedUserId}`;
  } else {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    rateLimitKey = `ip:${ip}`;
  }

  if (await isRateLimited(`catering:${rateLimitKey}`, 3, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Too many requests — please wait before submitting again." },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    truck_id, customer_name, customer_email, customer_phone,
    event_date, event_time, event_location, guest_count,
    budget, event_type, notes, selected_package_id,
  } = body;

  // Validate required fields
  if (!truck_id || !customer_name || !customer_email || !event_date || !event_location || !guest_count) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof truck_id !== "string" || !UUID_RE.test(truck_id)) {
    return NextResponse.json({ error: "Invalid truck_id" }, { status: 400 });
  }
  if (selected_package_id != null && (typeof selected_package_id !== "string" || !UUID_RE.test(selected_package_id))) {
    return NextResponse.json({ error: "Invalid selected_package_id" }, { status: 400 });
  }

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customer_email).trim())) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  // Validate date format (must be ISO YYYY-MM-DD) and reject past dates
  const dateStr = String(event_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || isNaN(new Date(dateStr).getTime())) {
    return NextResponse.json({ error: "Invalid event date format" }, { status: 400 });
  }
  const today = new Date().toISOString().split("T")[0];
  if (dateStr < today) {
    return NextResponse.json({ error: "Event date must be in the future" }, { status: 400 });
  }

  const parsedGuests = parseInt(String(guest_count), 10);
  if (!Number.isFinite(parsedGuests) || parsedGuests < 1 || parsedGuests > 100000) {
    return NextResponse.json({ error: "Invalid guest count" }, { status: 400 });
  }

  const parsedBudget = budget ? parseFloat(String(budget)) : null;
  if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget < 0 || parsedBudget > 10_000_000)) {
    return NextResponse.json({ error: "Invalid budget" }, { status: 400 });
  }

  // Truncate free-text fields to prevent abuse
  const safeName    = String(customer_name).trim().slice(0, 200);
  const safeEmail   = String(customer_email).trim().slice(0, 200);
  const safePhone   = customer_phone ? String(customer_phone).trim().slice(0, 50) : null;
  const safeAddress = String(event_location).trim().slice(0, 500);
  const safeNotes   = notes ? String(notes).trim().slice(0, 1000) : null;
  const safeType    = event_type ? String(event_type).trim().slice(0, 100) : null;
  const safeTime    = event_time ? String(event_time).trim().slice(0, 20) : null;

  // Verify the truck exists and offers catering
  const db = getServiceClient();
  const { data: truck, error: truckErr } = await db
    .from("trucks")
    .select("id")
    .eq("id", truck_id)
    .eq("offers_catering", true)
    .maybeSingle();

  if (truckErr || !truck) {
    return NextResponse.json({ error: "Truck not found or not accepting catering" }, { status: 404 });
  }

  // If a package was selected, verify it belongs to this truck to prevent IDOR
  if (selected_package_id) {
    const { data: pkg } = await db
      .from("catering_packages")
      .select("id")
      .eq("id", selected_package_id)
      .eq("truck_id", truck_id)
      .maybeSingle();
    if (!pkg) {
      return NextResponse.json({ error: "Invalid package selection" }, { status: 400 });
    }
  }

  // Use the user ID already resolved during rate-limit check
  const customerId: string | null = resolvedUserId;

  // If authenticated, enforce that customer_email matches their account email
  // to prevent using the catering form to send messages to arbitrary addresses.
  const finalEmail = resolvedUserEmail ?? safeEmail;

  const { error } = await db.from("catering_requests").insert({
    truck_id,
    customer_id: customerId,
    customer_name: safeName,
    customer_email: finalEmail,
    customer_phone: safePhone,
    event_date: dateStr,
    event_time: safeTime,
    event_location: safeAddress,
    guest_count: parsedGuests,
    budget: parsedBudget,
    event_type: safeType,
    notes: safeNotes,
    selected_package_id: selected_package_id ?? null,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
