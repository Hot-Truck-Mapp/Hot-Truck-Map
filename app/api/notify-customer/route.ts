import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { isRateLimited } from "@/lib/rateLimit";

// ---------------------------------------------------------------------------
// Notify a customer when their order status changes.
// Called by the operator dashboard after updating an order.
// Sends push notifications via Expo (mobile) and web-push (browser).
// ---------------------------------------------------------------------------

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  preparing: {
    title: "Your order is being prepared!",
    body: "The kitchen has started making your food.",
  },
  ready: {
    title: "Your order is ready for pickup!",
    body: "Head to the truck now. Pick up within 20 minutes.",
  },
  no_show: {
    title: "Order marked as no-show",
    body: "You didn't pick up your order. Repeated no-shows may result in ordering restrictions.",
  },
  picked_up: {
    title: "Order complete!",
    body: "Thanks for picking up your order. Enjoy your meal!",
  },
};

export async function POST(req: NextRequest) {
  try {
    // Auth: verify the caller is a logged-in truck operator
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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (await isRateLimited(`notify-customer:${user.id}`, 30, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let body: { customer_id: string; order_id: string; status: string; truck_name?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { customer_id, order_id, status, truck_name } = body;
    if (!customer_id || !order_id || !status) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const message = STATUS_MESSAGES[status];
    if (!message) {
      return NextResponse.json({ sent: 0 }); // no notification for this status
    }

    const db = getServiceClient();

    // Verify the operator owns the truck associated with this order,
    // and fetch the real customer_id from the order record so the
    // caller cannot redirect notifications to an arbitrary user.
    const { data: order } = await db
      .from("orders")
      .select("truck_id, customer_id")
      .eq("id", order_id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const { data: truck } = await db
      .from("trucks")
      .select("id")
      .eq("id", order.truck_id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!truck) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Use the customer_id from the order record, not the caller-supplied value.
    const verified_customer_id = order.customer_id;
    if (!verified_customer_id) {
      return NextResponse.json({ sent: 0 });
    }

    // Get customer's push subscriptions
    const { data: subscriptions } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key, platform")
      .eq("user_id", verified_customer_id)
      .limit(10);

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    const title = truck_name
      ? `${truck_name}: ${message.title}`
      : message.title;

    let sent = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          if (sub.platform === "expo") {
            const res = await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({
                to: sub.endpoint,
                title,
                body: message.body,
                data: { url: "/orders", order_id, status },
                sound: "default",
              }),
            });

            if (res.ok) {
              const json = await res.json();
              if (json?.data?.status === "error") {
                if (
                  json.data.details?.error === "DeviceNotRegistered" ||
                  json.data.details?.error === "InvalidCredentials"
                ) {
                  staleEndpoints.push(sub.endpoint);
                }
              } else {
                sent++;
              }
            }
          } else if (sub.platform === "web") {
            // Web push via VAPID
            try {
              const email = process.env.VAPID_EMAIL;
              const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
              const priv = process.env.VAPID_PRIVATE_KEY;
              if (email && pub && priv) {
                webpush.setVapidDetails(email, pub, priv);
                await webpush.sendNotification(
                  {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth_key },
                  },
                  JSON.stringify({ title, body: message.body, url: "/" })
                );
                sent++;
              }
            } catch (err: any) {
              if (err?.statusCode === 404 || err?.statusCode === 410) {
                staleEndpoints.push(sub.endpoint);
              }
            }
          }
        } catch {
          // Individual notification failure — continue with others
        }
      })
    );

    // Clean up stale subscriptions (fire-and-forget)
    if (staleEndpoints.length > 0) {
      void db.from("push_subscriptions").delete().in("endpoint", staleEndpoints).then(() => {});
    }

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("notify-customer error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
