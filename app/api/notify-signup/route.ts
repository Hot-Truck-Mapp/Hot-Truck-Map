import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, operatorSignupEmail, ADMIN_INBOX } from "@/lib/email";
import { isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _admin;
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    // Lightweight abuse guard — at most 10 admin notifications per IP per hour.
    if (await isRateLimited(`notify-signup:ip:${ip}`, 10, 60 * 60_000)) {
      return NextResponse.json({ skipped: true, reason: "rate-limited" });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { userId, truckName, cuisine } = (body ?? {}) as Record<string, unknown>;

    if (typeof userId !== "string" || userId.length < 8 || userId.length > 64) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const admin = getAdmin();

    // Verify the user actually exists and was created very recently.
    // This proves the request corresponds to a real signup we just processed.
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unknown user" }, { status: 404 });
    }
    const user = userRes.user;

    const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
    const ageMs = Date.now() - createdAt;
    if (!createdAt || ageMs > 10 * 60_000) {
      // Older than 10 min — not a fresh signup, ignore.
      return NextResponse.json({ skipped: true, reason: "stale" });
    }

    // Per-user dedupe so retries don't spam the inbox.
    if (await isRateLimited(`notify-signup:user:${user.id}`, 1, 24 * 60 * 60_000)) {
      return NextResponse.json({ skipped: true, reason: "duplicate" });
    }

    const safeTruckName =
      typeof truckName === "string" && truckName.trim().length > 0
        ? truckName.trim().slice(0, 100)
        : "(unnamed)";
    const safeCuisine =
      typeof cuisine === "string" && cuisine.trim().length > 0 ? cuisine.trim().slice(0, 60) : null;

    const { subject, html, text } = operatorSignupEmail({
      truckName: safeTruckName,
      cuisine: safeCuisine,
      email: user.email || "(no email)",
      userId: user.id,
    });

    await sendEmail({
      to: ADMIN_INBOX,
      subject,
      html,
      text,
      replyTo: user.email || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[notify-signup] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
