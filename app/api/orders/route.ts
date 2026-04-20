import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// IP-based rate limiting — max 10 orders per IP per 60 seconds
// In-memory sliding window (resets on cold start, fine for serverless)
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

// Use service role key so anonymous customers can place orders
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Send SMS to the truck operator via Twilio (fire-and-forget — never blocks the order)
async function notifyOperatorBySMS(phone: string, truckName: string, pickupName: string, items: any[], total: number) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from || !phone) return;

  const itemLines = items.map((i: any) => `  ${i.quantity}× ${i.name}`).join("\n");
  const body = [
    `🔔 New order at ${truckName}!`,
    `Customer: ${pickupName}`,
    `Items:\n${itemLines}`,
    `Total: $${total.toFixed(2)}`,
    `Open your dashboard to update the status.`,
  ].join("\n");

  try {
    const encoded = new URLSearchParams({ To: phone, From: from, Body: body });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
      },
      body: encoded.toString(),
    });
  } catch (err) {
    console.error("Twilio SMS error:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many orders. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { truck_id, pickup_name, notes, items, total, customer_id } = body;

    if (!truck_id || !pickup_name || !items?.length || total == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Validate all items belong to this truck
    const itemIds = items.map((i: any) => i.menu_item_id);
    const { data: dbItems, error: itemErr } = await supabase
      .from("menu_items")
      .select("id, price, is_sold_out")
      .in("id", itemIds)
      .eq("truck_id", truck_id);

    if (itemErr || !dbItems || dbItems.length !== itemIds.length) {
      return NextResponse.json({ error: "Invalid menu items" }, { status: 400 });
    }

    // Check none are sold out
    const soldOut = dbItems.find((d) => d.is_sold_out);
    if (soldOut) {
      return NextResponse.json({ error: "One or more items are sold out" }, { status: 400 });
    }

    // Recalculate total server-side to prevent price tampering
    const serverTotal = items.reduce((sum: number, item: any) => {
      const db = dbItems.find((d) => d.id === item.menu_item_id);
      return sum + (db?.price ?? 0) * item.quantity;
    }, 0);

    // Insert the order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        truck_id,
        pickup_name,
        notes: notes ?? null,
        items,
        total: serverTotal,
        status: "pending",
        ...(customer_id ? { customer_id } : {}),
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("Order insert error:", orderErr);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

    // Notify operator by SMS (non-blocking — runs in background)
    supabase
      .from("trucks")
      .select("name, phone")
      .eq("id", truck_id)
      .single()
      .then(({ data: truck }) => {
        if (truck?.phone) {
          notifyOperatorBySMS(truck.phone, truck.name, pickup_name, items, serverTotal);
        }
      })
      .catch((err) => console.error("SMS notification truck fetch error:", err));

    return NextResponse.json({ orderId: order.id, total: serverTotal });
  } catch (err) {
    console.error("Orders API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const truck_id = searchParams.get("truck_id");
    if (!truck_id) {
      return NextResponse.json({ error: "truck_id required" }, { status: 400 });
    }

    // Verify the requester is authenticated and owns this truck
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const userClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Confirm user owns the truck (using admin client to bypass RLS for the ownership check)
    const admin = getAdminClient();
    const { data: truck, error: truckErr } = await admin
      .from("trucks")
      .select("id")
      .eq("id", truck_id)
      .eq("owner_id", user.id)
      .single();

    if (truckErr || !truck) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin
      .from("orders")
      .select("*")
      .eq("truck_id", truck_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
