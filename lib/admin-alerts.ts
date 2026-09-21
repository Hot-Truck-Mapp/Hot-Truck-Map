import { ADMIN_EMAILS } from "@/lib/admin";
import { getServiceClient } from "@/lib/admin-server";
import { ADMIN_INBOX, operatorSignupEmail, sendEmail } from "@/lib/email";
import { purgeStaleSubscriptions, sendPushBatch, type PushSubscriptionRow } from "@/lib/push";
import { isRateLimited } from "@/lib/rateLimit";

/**
 * Tell the owner a new food truck operator just signed up: an email to the
 * admin inbox, plus a push notification to every device where an admin
 * account has notifications on (the app, or the website with push enabled).
 *
 * Best-effort and never throws — a failed alert must never fail the signup.
 * Deduped per user, so a retried signup doesn't alert twice.
 */
export async function alertNewOperator(opts: {
  userId: string;
  email: string;
  truckName: string;
  cuisine: string | null;
}): Promise<void> {
  const { userId, email, truckName, cuisine } = opts;
  if (await isRateLimited(`new-operator-alert:${userId}`, 1, 24 * 60 * 60_000)) return;

  const [emailResult, pushResult] = await Promise.allSettled([
    (async () => {
      const { subject, html, text } = operatorSignupEmail({ truckName, cuisine, email, userId });
      await sendEmail({ to: ADMIN_INBOX, subject, html, text, replyTo: email });
    })(),
    pushToAdmins({
      title: "🚚 New truck signed up",
      body: `${truckName}${cuisine ? ` · ${cuisine}` : ""} — ${email}`,
      url: "/admin",
    }),
  ]);
  if (emailResult.status === "rejected") console.error("[admin-alerts] email failed:", emailResult.reason);
  if (pushResult.status === "rejected") console.error("[admin-alerts] push failed:", pushResult.reason);
}

async function pushToAdmins(payload: { title: string; body: string; url: string }): Promise<void> {
  const db = getServiceClient();
  const adminIds = await adminUserIds(db);
  if (adminIds.length === 0) return;

  const { data } = await db
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth_key, platform")
    .in("user_id", adminIds);
  const subs = (data ?? []) as PushSubscriptionRow[];
  if (subs.length === 0) return;

  const { staleEndpoints } = await sendPushBatch(subs, payload);
  purgeStaleSubscriptions(db, staleEndpoints);
}

/** Auth ids of the ADMIN_EMAILS accounts. auth.users is only listable page by page. */
async function adminUserIds(db: ReturnType<typeof getServiceClient>): Promise<string[]> {
  const wanted = new Set(ADMIN_EMAILS);
  const ids: string[] = [];
  for (let page = 1; page <= 10 && ids.length < wanted.size; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (u.email && wanted.has(u.email.toLowerCase())) ids.push(u.id);
    }
    if (data.users.length < 1000) break;
  }
  return ids;
}
