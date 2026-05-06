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
  if (timestamps.length >= RATE_LIMIT_MAX) {
    // Update the filtered (pruned) list even on rejection to avoid unbounded growth
    rateLimitMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  // Evict entries that are now empty to prevent the map from growing unbounded
  // (long-running non-serverless deployments; no-op in serverless cold-start model)
  if (timestamps.length === 1) {
    // First hit from this IP — schedule cleanup after the window expires
    setTimeout(() => {
      const remaining = (rateLimitMap.get(ip) ?? []).filter((t) => t > Date.now() - RATE_LIMIT_WINDOW_MS);
      if (remaining.length === 0) rateLimitMap.delete(ip);
      else rateLimitMap.set(ip, remaining);
    }, RATE_LIMIT_WINDOW_MS);
  }
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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { truck_id, pickup_name, notes, items, total, customer_id } = body;

    if (!truck_id || !pickup_name || !items?.length || total == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length > 50) {
      return NextResponse.json({ error: "Order must contain between 1 and 50 items" }, { status: 400 });
    }
    if (typeof pickup_name !== "string" || pickup_name.trim().length === 0 || pickup_name.trim().length > 100) {
      return NextResponse.json({ error: "Pickup name must be between 1 and 100 characters" }, { status: 400 });
    }
    if (notes != null && (typeof notes !== "string" || notes.length > 500)) {
      return NextResponse.json({ error: "Notes must be 500 characters or fewer" }, { status: 400 });
    }

    const supabase = getAdminClient();

    // Verify the truck is currently live before accepting orders
    const { data: truckCheck } = await supabase
      .from("trucks")
      .select("is_live")
      .eq("id", truck_id)
      .maybeSingle();
    if (!truckCheck?.is_live) {
      return NextResponse.json({ error: "This truck is not currently accepting orders" }, { status: 409 });
    }

    // Validate all items belong to this truck
    const itemIds = items.map((i: any) => i.menu_item_id);
    const { data: dbItems, error: itemErr } = await supabase
      .from("menu_items")
      .select("id, name, price, is_sold_out")
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

    // Validate quantities — must be positive integers, max 99 each
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        return NextResponse.json({ error: "Invalid item quantity" }, { status: 400 });
      }
    }

    // Recalculate total server-side to prevent price tampering.
    // Use integer cent arithmetic to avoid floating-point rounding errors.
    const serverTotalCents = items.reduce((sum: number, item: any) => {
      const db = dbItems.find((d) => d.id === item.menu_item_id);
      return sum + Math.round((db?.price ?? 0) * 100) * item.quantity;
    }, 0);
    const serverTotal = serverTotalCents / 100;

    if (serverTotal <= 0) {
      return NextResponse.json({ error: "Order total must be greater than zero" }, { status: 400 });
    }

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
      .maybeSingle();

    if (orderErr || !order) {
      console.error("Order insert error:", orderErr);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

    // Notify operator by SMS (non-blocking — runs in background)
    // Build SMS item list using server-validated names (not user-supplied strings)
    const smsItems = items.map((i: any) => ({
      quantity: i.quantity,
      name: dbItems.find((d) => d.id === i.menu_item_id)?.name ?? "Item",
    }));
    (async () => {
      try {
        const { data: truck } = await supabase
          .from("trucks").select("name, phone").eq("id", truck_id).maybeSingle();
        if (truck?.phone) {
          await notifyOperatorBySMS(truck.phone, truck.name, pickup_name, smsItems, serverTotal);
        }
      } catch (err) {
        console.error("SMS notification error:", err);
      }
    })();

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
      .maybeSingle();

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
