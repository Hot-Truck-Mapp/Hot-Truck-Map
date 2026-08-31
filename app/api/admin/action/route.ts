import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, requireAdmin } from "@/lib/admin-server";
import { isAdminEmail } from "@/lib/admin";

// Every write the admin dashboard performs, behind one owner-only endpoint.
// Each action names the table and row it touches; ids are UUID-validated
// before they reach the database.
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER_STATUSES = ["pending", "preparing", "ready", "picked_up", "no_show", "cancelled"];
const CATERING_STATUSES = ["pending", "accepted", "declined", "completed", "cancelled"];

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";
  const id = typeof body.id === "string" ? body.id : "";
  const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

  // Every action below is row-scoped, so an id is always required.
  if (!UUID_RE.test(id)) return bad("Invalid id");

  const db = getServiceClient();

  try {
    switch (action) {
      // ── Orders ────────────────────────────────────────────────────────
      case "order.status": {
        const status = String(body.status ?? "");
        if (!ORDER_STATUSES.includes(status)) return bad("Invalid order status");
        const { error } = await db
          .from("orders")
          .update({ status, status_updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ── Catering leads ────────────────────────────────────────────────
      case "catering.status": {
        const status = String(body.status ?? "");
        if (!CATERING_STATUSES.includes(status)) return bad("Invalid catering status");
        const { error } = await db.from("catering_requests").update({ status }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ── Trucks ────────────────────────────────────────────────────────
      // Forcing a truck offline is the fix for a stuck "live" pin — the
      // common support request when an operator closes without going offline.
      case "truck.live": {
        if (typeof body.value !== "boolean") return bad("value must be a boolean");
        const { error } = await db.from("trucks").update({ is_live: body.value }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // Hiding a truck keeps its history but pulls it from the public map.
      // Prefer this over deletion for spam or a truck that's out of business.
      case "truck.active": {
        if (typeof body.value !== "boolean") return bad("value must be a boolean");
        const { error } = await db.from("trucks").update({ is_active: body.value }).eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "truck.delete": {
        const { error } = await db.from("trucks").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ── Moderation ────────────────────────────────────────────────────
      case "review.delete": {
        const { error } = await db.from("reviews").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "spotted.delete": {
        const { error } = await db.from("spotted_posts").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "photo.delete": {
        const { error } = await db.from("truck_photos").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ── Contact inbox ─────────────────────────────────────────────────
      case "contact.handled": {
        if (typeof body.value !== "boolean") return bad("value must be a boolean");
        const { error } = await db
          .from("contact_submissions")
          .update({ handled_at: body.value ? new Date().toISOString() : null })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      case "contact.delete": {
        const { error } = await db.from("contact_submissions").delete().eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ── Newsletter ────────────────────────────────────────────────────
      case "newsletter.unsubscribe": {
        const { error } = await db
          .from("newsletter_subscribers")
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      // ── Accounts ──────────────────────────────────────────────────────
      case "user.delete": {
        if (id === admin.id) return bad("You can't delete your own admin account");
        // Belt and braces: refuse to delete any address on the admin list,
        // so a second admin can't be locked out by accident.
        const { data: target } = await db.auth.admin.getUserById(id);
        if (target?.user && isAdminEmail(target.user.email)) {
          return bad("That account is an admin and can't be deleted here");
        }
        const { error } = await db.auth.admin.deleteUser(id);
        if (error) throw error;
        return NextResponse.json({ ok: true });
      }

      default:
        return bad("Unknown action");
    }
  } catch (err) {
    console.error(`[admin/action] ${action} failed:`, err);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
