import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail, operatorSignupEmail, ADMIN_INBOX } from "@/lib/email";
import { isRateLimited } from "@/lib/rateLimit";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Operator signup — server side.
//
// The previous client-side flow called supabase.auth.signUp() then immediately
// inserted into the `trucks` table from the browser. When email confirmation
// is enabled, signUp returns no session, so auth.uid() is NULL and the
// `trucks_owner_insert` RLS policy rejects the insert. The error was
// swallowed, leaving the operator with an auth account but no truck row.
// useRole then classified them as a customer and /dashboard bounced them
// to the homepage — they effectively became customers.
//
// Doing this server-side with the service role bypasses the RLS race and
// guarantees the truck row exists before the operator clicks the
// confirmation link. We also stash truck_name/cuisine in user_metadata
// as a fallback so the dashboard can self-heal if anything ever goes
// wrong with the truck insert.
// ---------------------------------------------------------------------------

function getAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    // Abuse guard — at most 10 operator signup attempts per IP per hour.
    if (await isRateLimited(`signup-op:ip:${ip}`, 10, 60 * 60_000)) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const {
      email,
      password,
      truckName,
      cuisine,
      emailRedirectTo,
    } = (body ?? {}) as Record<string, unknown>;

    // ── Validate ──────────────────────────────────────────────────────────
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 200) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (typeof truckName !== "string" || truckName.trim().length === 0 || truckName.trim().length > 100) {
      return NextResponse.json({ error: "Truck name must be 1–100 characters." }, { status: 400 });
    }
    const safeCuisine =
      typeof cuisine === "string" && cuisine.trim().length > 0 ? cuisine.trim().slice(0, 60) : null;
    const safeTruckName = truckName.trim();

    // Only accept redirect URLs that target our own deployment, so this
    // endpoint can't be used to bounce confirmation links elsewhere.
    let safeRedirect: string | undefined;
    if (typeof emailRedirectTo === "string") {
      try {
        const u = new URL(emailRedirectTo);
        const expected = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
        const reqOrigin = req.headers.get("origin");
        const reqOriginHost = reqOrigin ? new URL(reqOrigin).host : null;
        if (
          u.host === expected.host ||
          u.host === reqOriginHost ||
          u.host.endsWith(".hottruckmap.com") ||
          u.host === "hottruckmap.com" ||
          u.hostname === "localhost"
        ) {
          safeRedirect = u.toString();
        }
      } catch {
        // ignore malformed redirect; signUp will use the project default
      }
    }

    // ── Create the auth user ──────────────────────────────────────────────
    const anon = getAnon();
    const { data, error } = await anon.auth.signUp({
      email,
      password,
      options: {
        // truck_name/cuisine kept in user_metadata as a fallback for the
        // dashboard self-heal in case the truck insert below ever fails.
        data: {
          role: "operator",
          truck_name: safeTruckName,
          cuisine: safeCuisine,
        },
        emailRedirectTo: safeRedirect,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Supabase signals "email already registered" by returning a user with
    // no identities — surface the same generic message the client used to.
    if (!data.user || !data.user.identities || data.user.identities.length === 0) {
      return NextResponse.json(
        {
          error:
            "Sign-up unavailable. Please check your details or sign in if you already have an account.",
        },
        { status: 409 }
      );
    }

    const userId = data.user.id;

    // ── Insert the truck row with service role (bypasses RLS) ─────────────
    // If a row already exists for this owner (e.g. a retry), skip silently.
    const admin = getAdmin();
    const { data: existing } = await admin
      .from("trucks")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: truckErr } = await admin.from("trucks").insert({
        owner_id: userId,
        name: safeTruckName,
        cuisine: safeCuisine,
        is_live: false,
      });

      if (truckErr) {
        // Don't fail the signup — the auth user already exists and the email
        // has been sent. The dashboard self-heal will retry the insert on
        // first visit using the user_metadata fallback.
        console.error("[signup/operator] truck insert failed:", truckErr, { userId });
      }
    }

    // ── Notify admin inbox (best-effort) ──────────────────────────────────
    if (!(await isRateLimited(`signup-op:user:${userId}`, 1, 24 * 60 * 60_000))) {
      try {
        const { subject, html, text } = operatorSignupEmail({
          truckName: safeTruckName,
          cuisine: safeCuisine,
          email: data.user.email || email,
          userId,
        });
        await sendEmail({
          to: ADMIN_INBOX,
          subject,
          html,
          text,
          replyTo: data.user.email || email,
        });
      } catch (err) {
        console.error("[signup/operator] admin notify failed:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[signup/operator] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
