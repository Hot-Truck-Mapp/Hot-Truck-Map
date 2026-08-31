import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared push fan-out used by every route that sends notifications:
 * /api/notifications (a followed truck went live) and /api/admin/announce
 * (a platform-wide announcement from the owner).
 *
 * Handles both delivery channels — web push via VAPID, and Expo push for the
 * mobile app — and reports back which endpoints are dead so the caller can
 * purge them.
 */

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string | null;
  auth_key: string | null;
  platform: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export type PushResult = {
  sent: number;
  failed: number;
  staleEndpoints: string[];
};

/**
 * Configure VAPID credentials. Called lazily inside handlers so env vars are
 * read at runtime, not at module-evaluation / build time.
 */
export function configureVapid(): boolean {
  const email = process.env.VAPID_EMAIL;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!email || !pub || !priv) return false;
  webpush.setVapidDetails(email, pub, priv);
  return true;
}

// Sending to every subscription at once is fine for one truck's followers but
// not for a platform-wide broadcast, where it would open thousands of sockets
// in a single tick. Chunking keeps the fan-out bounded either way.
const CHUNK_SIZE = 100;

/**
 * Delivers `payload` to every subscription. Never throws — individual failures
 * are counted, and endpoints that the push service reports as gone are
 * returned in `staleEndpoints` for the caller to purge.
 */
export async function sendPushBatch(
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload
): Promise<PushResult> {
  const serialized = JSON.stringify(payload);
  const vapidReady = configureVapid();

  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  const sendOne = async (sub: PushSubscriptionRow) => {
    try {
      if (sub.platform === "web") {
        if (!vapidReady) {
          failed++;
          return;
        }
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh ?? "", auth: sub.auth_key ?? "" },
          },
          serialized
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
            to: sub.endpoint, // Expo push token is stored in the endpoint column
            title: payload.title,
            body: payload.body,
            data: { url: payload.url },
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
      // web-push throws 404/410 once a subscription has expired
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  };

  for (let i = 0; i < subscriptions.length; i += CHUNK_SIZE) {
    await Promise.all(subscriptions.slice(i, i + CHUNK_SIZE).map(sendOne));
  }

  return { sent, failed, staleEndpoints };
}

/** Fire-and-forget removal of endpoints the push services have rejected. */
export function purgeStaleSubscriptions(db: SupabaseClient, endpoints: string[]): void {
  if (endpoints.length === 0) return;
  void (async () => {
    try {
      for (let i = 0; i < endpoints.length; i += 200) {
        await db.from("push_subscriptions").delete().in("endpoint", endpoints.slice(i, i + 200));
      }
    } catch {
      /* best effort — a stale row just costs one failed send next time */
    }
  })();
}
