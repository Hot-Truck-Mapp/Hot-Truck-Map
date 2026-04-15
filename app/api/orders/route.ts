import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key so anonymous customers can place orders
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { truck_id, pickup_name, notes, items, total } = body;

    if (!truck_id || !pickup_name || !items?.length || total == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate all items belong to this truck
    const supabase = getAdminClient();
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

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        truck_id,
        pickup_name,
        notes: notes ?? null,
        items,
        total: serverTotal,
        status: "pending",
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("Order insert error:", orderErr);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

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

    const supabase = getAdminClient();
    const { data, error } = await supabase
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
