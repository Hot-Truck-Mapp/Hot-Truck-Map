import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, requireAdmin } from "@/lib/admin-server";
import { purgeStaleSubscriptions, sendPushBatch, type PushSubscriptionRow } from "@/lib/push";
import { isRateLimited } from "@/lib/rateLimit";
import { safeRedirect } from "@/lib/safeRedirect";

/**
 * Platform-wide push announcements from the owner.
 *
 * Distinct from /api/notify-followers, which lets an operator message the
 * people following their own truck. This one reaches everyone (or every
 * operator, or every customer) and so is owner-only, rate limited, opt-out
 * aware, and logged to the `announcements` table after every send.
 *
 * GET  — send history, plus a dry-run audience size for the compose form
 * POST — resolve the audience, fan out, record the result
 */
export const dynamic = "force-dynamic";

const AUDIENCES = ["all", "operators", "customers"] as const;
type Audience = (typeof AUDIENCES)[number];

const TITLE_MAX = 80;
const BODY_MAX = 200;

// Announcements are irreversible once delivered, so the limit is deliberately
// tight — enough to correct a mistake, not enough to spam the user base.
const RATE_MAX = 3;
const RATE_WINDOW_MS = 60 * 60 * 1000;

type ResolvedAudience = {
  userIds: string[];
  optedOut: number;
};

/**
 * Turns an audience name into the set of user ids that should receive the
 * push, honouring the per-user opt-out stored in user_metadata.
 */
async function resolveAudience(
  db: ReturnType<typeof getServiceClient>,
  audience: Audience
): Promise<ResolvedAudience> {
  // Operator status comes from truck ownership in the database, never from
  // user-supplied metadata.
  const { data: ownedTrucks } = await db.from("trucks").select("owner_id");
  const operatorIds = new Set(
    (ownedTrucks ?? []).map((t: any) => t.owner_id).filter(Boolean) as string[]
  );

  const userIds: string[] = [];
  let optedOut = 0;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];

    for (const u of users) {
      const isOperator = operatorIds.has(u.id);
      if (audience === "operators" && !isOperator) continue;
      if (audience === "customers" && isOperator) continue;

      // Absence of the key means opted in, matching how the account page's
      // other notification defaults behave.
      const prefs = (u.user_metadata as any)?.notifications;
      if (prefs?.announcements === false) {
        optedOut++;
        continue;
      }
      userIds.push(u.id);
    }

    if (users.length < 1000) break;
  }

  return { userIds, optedOut };
}

/** Loads push subscriptions for a set of users, chunked to keep URLs sane. */
async function subscriptionsFor(
  db: ReturnType<typeof getServiceClient>,
  userIds: string[]
): Promise<PushSubscriptionRow[]> {
  const rows: PushSubscriptionRow[] = [];
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth_key, platform")
      .in("user_id", userIds.slice(i, i + 200));
    if (error) throw error;
    rows.push(...((data ?? []) as PushSubscriptionRow[]));
  }
  return rows;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getServiceClient();
  const audienceParam = req.nextUrl.searchParams.get("audience");

  try {
    // Dry run: how many people (and devices) would this actually reach?
    // The compose form calls this whenever the audience changes, so the owner
    // sees the blast radius before they can press send.
    let preview: Record<string, number> | null = null;
    if (audienceParam && AUDIENCES.includes(audienceParam as Audience)) {
      const { userIds, optedOut } = await resolveAudience(db, audienceParam as Audience);
      const subs = await subscriptionsFor(db, userIds);
      preview = {
        recipients: userIds.length,
        reachable: new Set(subs.map((s) => s.endpoint)).size,
        optedOut,
      };
    }

    // The history table may not exist until supabase_patch_011.sql has been
    // run — an empty list is a better answer here than a 500.
    let history: unknown[] = [];
    const { data, error } = await db
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) history = data ?? [];

    return NextResponse.json({ preview, history, patchApplied: !error });
  } catch (err) {
    console.error("[admin/announce] GET failed:", err);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.body === "string" ? body.body.trim() : "";
  const audience = String(body.audience ?? "");
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";

  if (!title || title.length > TITLE_MAX) {
    return NextResponse.json(
      { error: `Title is required and must be ${TITLE_MAX} characters or fewer` },
      { status: 400 }
    );
  }
  if (!message || message.length > BODY_MAX) {
    return NextResponse.json(
      { error: `Message is required and must be ${BODY_MAX} characters or fewer` },
      { status: 400 }
    );
  }
  if (!AUDIENCES.includes(audience as Audience)) {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }

  // Only same-origin paths: the notification opens this in the recipient's
  // browser or app, so an arbitrary URL here would be an open redirect with a
  // push megaphone attached. safeRedirect resolves against the real origin
  // rather than pattern-matching the string — see its comment for why a
  // startsWith("/") check is not enough (e.g. "/\evil.com").
  let url = "/";
  if (rawUrl) {
    if (rawUrl.length > 200) {
      return NextResponse.json({ error: "Link is too long" }, { status: 400 });
    }
    const safe = safeRedirect(rawUrl, req.nextUrl.origin);
    if (safe === "/" && rawUrl !== "/") {
      return NextResponse.json(
        { error: "Link must be a path on this site, e.g. /events" },
        { status: 400 }
      );
    }
    url = safe;
  }

  if (await isRateLimited(`announce:${admin.id}`, RATE_MAX, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: `Too many announcements — the limit is ${RATE_MAX} per hour.` },
      { status: 429 }
    );
  }

  const db = getServiceClient();

  try {
    const { userIds, optedOut } = await resolveAudience(db, audience as Audience);
    const subscriptions = await subscriptionsFor(db, userIds);

    if (subscriptions.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        recipients: userIds.length,
        devices: 0,
        optedOut,
        note: "Nobody in this audience has push notifications turned on yet.",
      });
    }

    const { sent, failed, staleEndpoints } = await sendPushBatch(subscriptions, {
      title,
      body: message,
      url,
    });

    purgeStaleSubscriptions(db, staleEndpoints);

    // Log the send. A failure to write history must not make a delivered
    // announcement look like it failed, so this is reported, not thrown.
    const { error: logError } = await db.from("announcements").insert({
      title,
      body: message,
      url: url === "/" ? null : url,
      audience,
      sent_by: admin.id,
      sent_by_email: admin.email ?? null,
      recipients: userIds.length,
      devices: subscriptions.length,
      sent_count: sent,
      failed_count: failed,
    });
    if (logError) console.error("[admin/announce] history insert failed:", logError.message);

    return NextResponse.json({
      sent,
      failed,
      recipients: userIds.length,
      devices: subscriptions.length,
      optedOut,
      logged: !logError,
    });
  } catch (err) {
    console.error("[admin/announce] POST failed:", err);
    return NextResponse.json({ error: "Failed to send announcement" }, { status: 500 });
  }
}
