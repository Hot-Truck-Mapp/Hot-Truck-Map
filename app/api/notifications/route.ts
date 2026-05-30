import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { isRateLimited } from "@/lib/rateLimit";

// Configure VAPID credentials lazily inside the handler so env vars are
// always read at runtime, not at module-evaluation / build time.
function configureVapid() {
  const email = process.env.VAPID_EMAIL;
  const pub   = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv  = process.env.VAPID_PRIVATE_KEY;
  if (!email || !pub || !priv) return false;
  webpush.setVapidDetails(email, pub, priv);
  return true;
}

// Service-role client (bypasses RLS so we can read all followers/subscriptions)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase service-role config");
  return createSupabaseClient(url, serviceKey);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  try {
    // Pad to equal length so timing doesn't leak key length
    const maxLen = Math.max(a.length, b.length);
    const aBytes = Buffer.from(a.padEnd(maxLen), "utf8");
    const bBytes = Buffer.from(b.padEnd(maxLen), "utf8");
    return require("crypto").timingSafeEqual(aBytes, bBytes) && a.length === b.length;
  } catch {
    return false;
  }
}


export async function POST(req: NextRequest) {
  // Auth: internal shared secret (constant-time comparison to prevent timing attacks)
  const internalKey = req.headers.get("x-internal-key");
  const expected = process.env.INTERNAL_NOTIFY_KEY;
  // If the env var is not configured, fail closed with 503 so operators know to set it.
  if (!internalKey || !expected) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  if (!timingSafeEqualStr(internalKey, expected)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let truck_id: string;
  let truck_name: string | undefined;
  let custom_message: string | undefined;
  try {
    const body = await req.json();
    truck_id = body.truck_id;
    truck_name = body.truck_name;
    custom_message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : undefined;
    if (!truck_id) throw new Error("Missing truck_id");
    if (truck_name && truck_name.length > 100) throw new Error("truck_name must be 100 characters or fewer");
    if (custom_message && custom_message.length > 200) throw new Error("Message must be 200 characters or fewer");
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Invalid body" }, { status: 400 });
  }

  const db = getServiceClient();

  // Verify the truck actually exists before fanning out notifications.
  // This is defence-in-depth: /api/notify-followers already checks ownership,
  // but this route is also callable by anyone who knows INTERNAL_NOTIFY_KEY.
  const { data: truckExists } = await db
    .from("trucks")
    .select("id")
    .eq("id", truck_id)
    .maybeSingle();
  if (!truckExists) {
    return NextResponse.json({ error: "Truck not found" }, { status: 404 });
  }

  // Rate limit: 5 fan-outs per truck per 60 seconds, shared across instances
  if (await isRateLimited(`notifications:${truck_id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many notifications" }, { status: 429 });
  }

  // 1. Get all followers of this truck
  const { data: follows, error: followsError } = await db
    .from("follows")
    .select("user_id")
    .eq("truck_id", truck_id)
    .limit(5000);

  if (followsError) {
    return NextResponse.json({ error: followsError.message }, { status: 500 });
  }

  if (!follows || follows.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0 });
  }

  const userIds = follows.map((f: any) => f.user_id);

  // 2. Get all push subscriptions for those users (only columns needed for sending)
  const { data: subscriptions, error: subsError } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, platform")
    .in("user_id", userIds)
    .limit(5000);

  if (subsError) {
    return NextResponse.json({ error: subsError.message }, { status: 500 });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0 });
  }

  const title = truck_name ? `${truck_name} is now live!` : "A truck you follow is now live!";
  const body = custom_message ?? "Tap to see where they are on the map.";
  const url = "/";

  const payload = JSON.stringify({ title, body, url });

  // Configure VAPID once before the parallel send loop (not per-notification)
  const vapidReady = configureVapid();

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub: any) => {
      try {
        if (sub.platform === "web") {
          if (!vapidReady) {
            failed++;
            return;
          }
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth_key,
              },
            },
            payload
          );
          sent++;
        } else if (sub.platform === "expo") {
          const res = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
            },
            body: JSON.stringify({
              to: sub.endpoint, // expo push token stored in endpoint column
              title,
              body,
              data: { url },
              sound: "default",
            }),
          });

          if (!res.ok) {
            failed++;
            return;
          }

          const json = await res.json();
          const ticketData = json?.data;
          if (ticketData?.status === "error") {
            failed++;
            // Mark as stale if the token is no longer valid
            if (
              ticketData.details?.error === "DeviceNotRegistered" ||
              ticketData.details?.error === "InvalidCredentials"
            ) {
              staleEndpoints.push(sub.endpoint);
            }
          } else {
            sent++;
          }
        }
      } catch (err: any) {
        failed++;
        // web-push throws for 404/410 when subscription is expired
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  // 3. Clean up stale subscriptions (fire-and-forget)
  if (staleEndpoints.length > 0) {
    void (async () => {
      try {
        await db.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
      } catch { /* ignore */ }
    })();
  }

  return NextResponse.json({ sent, failed });
}
