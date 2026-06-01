import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/lib/rateLimit";

// Order caps — keeps orders realistic for a pay-at-truck food truck.
// Prevents customers from placing large orders they don't show up to pay for.
const MAX_ORDER_TOTAL    = 150;   // dollars
const MAX_TOTAL_QUANTITY = 20;    // sum of all item quantities
const MAX_ITEM_QUANTITY  = 10;    // per individual line item

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
  const safeTruckName  = truckName.replace(/[\r\n]/g, " ");
  const safePickupName = pickupName.replace(/[\r\n]/g, " ");
  const body = [
    `🔔 New order at ${safeTruckName}!`,
    `Customer: ${safePickupName}`,
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
    // Auth check happens below — rate limit is applied after auth to key by user

    // ── Authentication required ─────────────────────────────────────────────
    // Orders require a signed-in account for no-show accountability.
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json(
        { error: "Sign in required to place an order." },
        { status: 401 }
      );
    }

    let verifiedCustomerId: string | null = null;
    try {
      const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: { user } } = await userClient.auth.getUser();
      if (user) verifiedCustomerId = user.id;
    } catch { /* token invalid */ }

    if (!verifiedCustomerId) {
      return NextResponse.json(
        { error: "Sign in required to place an order." },
        { status: 401 }
      );
    }

    // Rate limit: max 5 orders per customer per hour (DB-backed, shared across instances)
    if (await isRateLimited(`order:${verifiedCustomerId}`, 5, 60 * 60_000)) {
      return NextResponse.json(
        { error: "Too many orders. Please wait before placing another." },
        { status: 429 }
      );
    }


    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { truck_id, pickup_name, notes, items, total } = body;

    if (!truck_id || !pickup_name || !items?.length || total == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof truck_id !== "string" || !UUID_RE.test(truck_id)) {
      return NextResponse.json({ error: "Invalid truck_id" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length > 50) {
      return NextResponse.json({ error: "Order must contain between 1 and 50 items" }, { status: 400 });
    }
    if (typeof pickup_name !== "string" || pickup_name.trim().length === 0 || pickup_name.trim().length > 100) {
      return NextResponse.json({ error: "Pickup name must be between 1 and 100 characters" }, { status: 400 });
    }
    const trimmedName = pickup_name.trim();
    if (notes != null && (typeof notes !== "string" || notes.length > 500)) {
      return NextResponse.json({ error: "Notes must be 500 characters or fewer" }, { status: 400 });
    }
    const trimmedNotes = notes?.trim() || null;

    const supabase = getAdminClient();

    // ── No-show accountability check ───────────────────────────────────────
    // Block customers with 3+ no-shows in the last 90 days
    const NO_SHOW_LIMIT = 3;
    const NO_SHOW_WINDOW_DAYS = 90;
    const cutoffDate = new Date(Date.now() - NO_SHOW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { count: noShowCount } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", verifiedCustomerId)
      .eq("status", "no_show")
      .gte("created_at", cutoffDate);

    if (noShowCount != null && noShowCount >= NO_SHOW_LIMIT) {
      return NextResponse.json(
        {
          error: "Your account has been temporarily blocked from placing orders due to multiple missed pickups. Please visit a truck in person to order.",
          no_show_block: true,
        },
        { status: 403 }
      );
    }

    // Verify the truck is currently live before accepting orders
    const { data: truckCheck } = await supabase
      .from("trucks")
      .select("is_live")
      .eq("id", truck_id)
      .maybeSingle();
    if (!truckCheck?.is_live) {
      return NextResponse.json({ error: "This truck is not currently accepting orders" }, { status: 409 });
    }

    // Validate all items belong to this truck — deduplicate IDs first so
    // ordering the same item twice doesn't cause a false "Invalid menu items" rejection
    const itemIds = [...new Set(items.map((i: any) => i.menu_item_id))];
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

    // Validate item UUIDs and quantities
    for (const item of items) {
      if (typeof item.menu_item_id !== "string" || !UUID_RE.test(item.menu_item_id)) {
        return NextResponse.json({ error: "Invalid menu_item_id" }, { status: 400 });
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY) {
        return NextResponse.json(
          { error: `Maximum ${MAX_ITEM_QUANTITY} of any single item per order` },
          { status: 400 }
        );
      }
    }

    // Cap total items ordered across all line items
    const totalQuantity = items.reduce((sum: number, i: any) => sum + i.quantity, 0);
    if (totalQuantity > MAX_TOTAL_QUANTITY) {
      return NextResponse.json(
        { error: `Orders are limited to ${MAX_TOTAL_QUANTITY} items total` },
        { status: 400 }
      );
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

    // Cap order total — prevents large orders that customers may not show up to pay for
    if (serverTotal > MAX_ORDER_TOTAL) {
      return NextResponse.json(
        { error: `Orders are limited to $${MAX_ORDER_TOTAL} total. Please reduce your order.` },
        { status: 400 }
      );
    }

    // Insert the order (customer_id always set — auth is required)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        truck_id,
        customer_id: verifiedCustomerId,
        pickup_name: trimmedName,
        notes: trimmedNotes,
        items,
        total: serverTotal,
        status: "pending",
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
          await notifyOperatorBySMS(truck.phone, truck.name, trimmedName, smsItems, serverTotal);
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

    const userClient = createClient(
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

    // Validate truck_id format before hitting the DB
    const UUID_RE_GET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE_GET.test(truck_id)) {
      return NextResponse.json({ error: "Invalid truck_id" }, { status: 400 });
    }

    const { data, error } = await admin
      .from("orders")
      .select("id, truck_id, pickup_name, notes, items, total, status, created_at")
      .eq("truck_id", truck_id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
    return NextResponse.json({ orders: data });
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
