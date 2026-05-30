import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "crypto";

// ---------------------------------------------------------------------------
// Auto-cancel stale orders — runs via Vercel Cron every 5 minutes.
//
// Orders in "ready" status for 20+ minutes are auto-cancelled, and the
// customer receives a no-show strike. This prevents food waste and holds
// customers accountable for picking up their orders.
//
// Security: protected by CRON_SECRET header (set in Vercel env vars).
// ---------------------------------------------------------------------------

const READY_TIMEOUT_MINUTES = 20;

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  // Verify cron secret — Vercel sets this header on cron invocations
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const expected = `Bearer ${cronSecret}`;
  const supplied = authHeader ?? "";
  // Pad both to the same length to prevent length-leaking timing oracle
  const maxLen = Math.max(expected.length, supplied.length);
  const a = Buffer.from(expected.padEnd(maxLen));
  const b = Buffer.from(supplied.padEnd(maxLen));
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const cutoff = new Date(Date.now() - READY_TIMEOUT_MINUTES * 60 * 1000).toISOString();

  // Find orders stuck in "ready" past the pickup window.
  // Try status_updated_at first (set by DB trigger after migration runs),
  // fall back to created_at if the column doesn't exist yet.
  let staleOrders: any[] | null = null;
  let fetchErr: any = null;

  const result1 = await db
    .from("orders")
    .select("id, customer_id, truck_id")
    .eq("status", "ready")
    .lt("status_updated_at", cutoff)
    .limit(100);

  if (result1.error?.message?.includes("status_updated_at")) {
    // Column doesn't exist yet — fall back to created_at
    const result2 = await db
      .from("orders")
      .select("id, customer_id, truck_id")
      .eq("status", "ready")
      .lt("created_at", cutoff)
      .limit(100);
    staleOrders = result2.data;
    fetchErr = result2.error;
  } else {
    staleOrders = result1.data;
    fetchErr = result1.error;
  }

  if (fetchErr) {
    console.error("Auto-cancel fetch error:", fetchErr);
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!staleOrders || staleOrders.length === 0) {
    return NextResponse.json({ cancelled: 0 });
  }

  const orderIds = staleOrders.map((o) => o.id);

  // Mark as no_show — guard ensures we never overwrite a concurrently-updated
  // terminal status (e.g. picked_up set by the operator between SELECT and UPDATE).
  const { error: updateErr } = await db
    .from("orders")
    .update({ status: "no_show" })
    .in("id", orderIds)
    .eq("status", "ready");

  if (updateErr) {
    console.error("Auto-cancel update error:", updateErr);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Send push notifications to affected customers (fire-and-forget)
  const uniqueCustomers = [...new Set(staleOrders.filter((o) => o.customer_id).map((o) => o.customer_id))];
  if (uniqueCustomers.length > 0) {
    void (async () => {
      try {
        const { data: subscriptions } = await db
          .from("push_subscriptions")
          .select("endpoint, platform, user_id")
          .in("user_id", uniqueCustomers)
          .eq("platform", "expo")
          .limit(500);

        if (subscriptions && subscriptions.length > 0) {
          await Promise.all(
            subscriptions.map(async (sub) => {
              try {
                await fetch("https://exp.host/--/api/v2/push/send", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: sub.endpoint,
                    title: "Order auto-cancelled",
                    body: "Your order was not picked up within 20 minutes and has been marked as a no-show.",
                    data: { url: "/orders" },
                    sound: "default",
                  }),
                });
              } catch { /* individual failure — continue */ }
            })
          );
        }
      } catch { /* notification failure should not affect cron result */ }
    })();
  }

  console.log(`Auto-cancelled ${orderIds.length} stale orders`);
  return NextResponse.json({ cancelled: orderIds.length, orderIds });
}
