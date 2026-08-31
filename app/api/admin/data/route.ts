import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, requireAdmin } from "@/lib/admin-server";

// Every read the admin dashboard needs, behind one owner-only endpoint.
//
// The dashboard previously queried Supabase straight from the browser with the
// anon key, which meant RLS hid most operational data from the owner: user
// counts came back 0, and the contact inbox / newsletter list / order book
// were unreadable by design. Those tables are deliberately locked to
// `USING (false)` for clients, so the only correct way to surface them is a
// service-role read behind a server-side admin check — which is this file.
//
// Never cache: every section is live operational data.
export const dynamic = "force-dynamic";

const MAX_ROWS = 500;

/** Maps user ids to email addresses in one auth call, for joining onto rows. */
async function emailMap(
  db: ReturnType<typeof getServiceClient>,
  ids: (string | null | undefined)[]
): Promise<Record<string, string>> {
  const wanted = new Set(ids.filter((id): id is string => Boolean(id)));
  if (wanted.size === 0) return {};
  const map: Record<string, string> = {};
  // listUsers is paginated; 1000/page is the service-role maximum.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) {
      if (wanted.has(u.id) && u.email) map[u.id] = u.email;
    }
    if (data.users.length < 1000) break;
  }
  return map;
}

async function countOf(
  db: ReturnType<typeof getServiceClient>,
  table: string,
  build?: (q: any) => any
): Promise<number> {
  let q: any = db.from(table).select("*", { count: "exact", head: true });
  if (build) q = build(q);
  const { count, error } = await q;
  // Surface the error rather than silently reporting 0 — a missing column or
  // table is a real problem the owner needs to see, not a legitimate zero.
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return count ?? 0;
}

/**
 * Runs `attempt`, falling back to `fallback` if it throws or the column it
 * filters on doesn't exist yet. Lets the dashboard render correctly on a
 * database where supabase_patch_010.sql hasn't been applied — the unhandled
 * contact count just reads as the total until then.
 */
async function countOrFallback(
  attempt: () => Promise<number>,
  fallback: () => Promise<number>
): Promise<number> {
  try {
    return await attempt();
  } catch {
    return await fallback();
  }
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const section = req.nextUrl.searchParams.get("section") ?? "overview";
  const db = getServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    switch (section) {
      // ── Overview: the numbers the owner checks first ──────────────────
      case "overview": {
        const [
          totalTrucks, liveTrucks, newTrucksThisWeek,
          totalFollows, totalViews, viewsThisWeek,
          totalReviews, pendingCatering, newContacts,
        ] = await Promise.all([
          countOf(db, "trucks"),
          countOf(db, "trucks", (q) => q.eq("is_live", true)),
          countOf(db, "trucks", (q) => q.gte("created_at", weekAgo)),
          countOf(db, "follows"),
          countOf(db, "truck_views"),
          countOf(db, "truck_views", (q) => q.gte("created_at", weekAgo)),
          countOf(db, "reviews"),
          countOf(db, "catering_requests", (q) => q.eq("status", "pending")),
          countOrFallback(
            () => countOf(db, "contact_submissions", (q) => q.is("handled_at", null)),
            () => countOf(db, "contact_submissions")
          ),
        ]);

        // Orders drive revenue, so pull the rows rather than just a count.
        const { data: orderRows } = await db
          .from("orders")
          .select("total, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5000);
        const orders = orderRows ?? [];
        const isRevenue = (s: string) => s !== "cancelled" && s !== "no_show";
        const revenueAllTime = orders
          .filter((o: any) => isRevenue(o.status))
          .reduce((sum: number, o: any) => sum + Number(o.total ?? 0), 0);
        const revenueThisWeek = orders
          .filter((o: any) => isRevenue(o.status) && o.created_at >= weekAgo)
          .reduce((sum: number, o: any) => sum + Number(o.total ?? 0), 0);
        const openOrders = orders.filter((o: any) =>
          ["pending", "preparing", "ready"].includes(o.status)
        ).length;

        // auth.users is only reachable with the service role — this is the
        // number the old dashboard always showed as 0.
        const { data: usersPage } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const allUsers = usersPage?.users ?? [];
        const totalUsers = allUsers.length;
        const newUsersThisWeek = allUsers.filter((u) => u.created_at >= weekAgo).length;

        const newsletterActive = await countOf(db, "newsletter_subscribers", (q) =>
          q.is("unsubscribed_at", null)
        );

        return NextResponse.json({
          // The page uses a successful overview response as its proof of
          // access — the browser never evaluates the admin list itself.
          admin: { email: admin.email ?? null },
          stats: {
            totalTrucks, liveTrucks, newTrucksThisWeek,
            totalUsers, newUsersThisWeek,
            totalFollows, totalViews, viewsThisWeek,
            totalOrders: orders.length, openOrders,
            revenueAllTime, revenueThisWeek,
            totalReviews, pendingCatering, newContacts,
            newsletterActive,
          },
        });
      }

      // ── Trucks: the full roster with owner contact + engagement ───────
      case "trucks": {
        const { data: trucks } = await db
          .from("trucks")
          .select(
            "id, name, cuisine, cuisine_type, is_live, is_active, phone, instagram, " +
            "avg_rating, review_count, owner_id, created_at, address, offers_catering, " +
            "follows_agg:follows(count)"
          )
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS);

        const rows = trucks ?? [];
        const emails = await emailMap(db, rows.map((t: any) => t.owner_id));
        return NextResponse.json({
          trucks: rows.map((t: any) => ({
            ...t,
            followers: Number(t.follows_agg?.[0]?.count ?? 0),
            owner_email: t.owner_id ? emails[t.owner_id] ?? null : null,
          })),
        });
      }

      // ── Truck of the Week: current setting + the truck picker's options ─
      case "featured": {
        const [{ data: trucks }, { data: settings }] = await Promise.all([
          db.from("trucks").select("id, name, cuisine").order("name").limit(1000),
          db.from("site_settings").select("key, value").in("key", ["featured_truck_id", "featured_message"]),
        ]);
        const map: Record<string, string> = {};
        for (const row of settings ?? []) map[row.key as string] = (row.value as string) ?? "";
        return NextResponse.json({
          trucks: trucks ?? [],
          featured_truck_id: map["featured_truck_id"] ?? "",
          featured_message: map["featured_message"] ?? "",
        });
      }

      // ── Users: every account, with its role resolved from truck ownership ─
      case "users": {
        const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (error) throw error;
        const users = data?.users ?? [];

        const { data: ownedTrucks } = await db.from("trucks").select("owner_id, name");
        const ownerNames: Record<string, string> = {};
        for (const t of ownedTrucks ?? []) {
          if (t.owner_id) ownerNames[t.owner_id as string] = t.name as string;
        }

        return NextResponse.json({
          users: users
            .map((u) => ({
              id: u.id,
              email: u.email ?? null,
              created_at: u.created_at,
              last_sign_in_at: u.last_sign_in_at ?? null,
              email_confirmed_at: u.email_confirmed_at ?? null,
              truck_name: ownerNames[u.id] ?? null,
              role: ownerNames[u.id] ? "operator" : "customer",
            }))
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
        });
      }

      // ── Orders: the platform-wide order book ──────────────────────────
      case "orders": {
        const { data } = await db
          .from("orders")
          .select("id, truck_id, customer_id, pickup_name, items, total, status, notes, created_at, status_updated_at, trucks(name)")
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS);
        const rows = data ?? [];
        const emails = await emailMap(db, rows.map((o: any) => o.customer_id));
        return NextResponse.json({
          orders: rows.map((o: any) => ({
            ...o,
            truck_name: o.trucks?.name ?? null,
            customer_email: o.customer_id ? emails[o.customer_id] ?? null : null,
          })),
        });
      }

      // ── Catering: the inbound lead pipeline ───────────────────────────
      case "catering": {
        const { data } = await db
          .from("catering_requests")
          .select("*, trucks(name)")
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS);
        return NextResponse.json({
          requests: (data ?? []).map((r: any) => ({ ...r, truck_name: r.trucks?.name ?? null })),
        });
      }

      // ── Reviews: moderation queue ─────────────────────────────────────
      case "reviews": {
        const { data } = await db
          .from("reviews")
          .select("id, truck_id, user_id, rating, comment, body, created_at, trucks(name)")
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS);
        const rows = data ?? [];
        const emails = await emailMap(db, rows.map((r: any) => r.user_id));
        return NextResponse.json({
          reviews: rows.map((r: any) => ({
            ...r,
            text: r.comment ?? r.body ?? null,
            truck_name: r.trucks?.name ?? null,
            author_email: r.user_id ? emails[r.user_id] ?? null : null,
          })),
        });
      }

      // ── Contact inbox: previously write-only, unreadable by anyone ─────
      case "contact": {
        const { data } = await db
          .from("contact_submissions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(MAX_ROWS);
        return NextResponse.json({ submissions: data ?? [] });
      }

      // ── Newsletter list ───────────────────────────────────────────────
      case "newsletter": {
        const { data } = await db
          .from("newsletter_subscribers")
          .select("id, email, subscribed_at, unsubscribed_at")
          .order("subscribed_at", { ascending: false })
          .limit(5000);
        return NextResponse.json({ subscribers: data ?? [] });
      }

      // ── User-generated content awaiting moderation ────────────────────
      case "moderation": {
        const [{ data: spotted }, { data: photos }] = await Promise.all([
          db.from("spotted_posts")
            .select("id, truck_id, user_id, location, note, created_at, trucks(name)")
            .order("created_at", { ascending: false })
            .limit(200),
          db.from("truck_photos")
            .select("id, truck_id, user_id, photo_url, created_at, trucks(name)")
            .order("created_at", { ascending: false })
            .limit(200),
        ]);
        const spottedRows = spotted ?? [];
        const photoRows = photos ?? [];
        const emails = await emailMap(db, [
          ...spottedRows.map((s: any) => s.user_id),
          ...photoRows.map((p: any) => p.user_id),
        ]);
        return NextResponse.json({
          spotted: spottedRows.map((s: any) => ({
            ...s,
            truck_name: s.trucks?.name ?? null,
            author_email: s.user_id ? emails[s.user_id] ?? null : null,
          })),
          photos: photoRows.map((p: any) => ({
            ...p,
            truck_name: p.trucks?.name ?? null,
            author_email: p.user_id ? emails[p.user_id] ?? null : null,
          })),
        });
      }

      default:
        return NextResponse.json({ error: "Unknown section" }, { status: 400 });
    }
  } catch (err) {
    console.error(`[admin/data] section=${section} failed:`, err);
    return NextResponse.json({ error: "Failed to load admin data" }, { status: 500 });
  }
}
