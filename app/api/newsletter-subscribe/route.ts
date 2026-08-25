import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isRateLimited } from "@/lib/rateLimit";
import { sendEmail, newsletterWelcomeEmail } from "@/lib/email";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// `email` is already lowercased by the caller, and case-insensitive
// uniqueness is enforced at the DB level via a unique index on
// lower(email) — so this is a literal exact match, not a pattern lookup.
// (Using .ilike() here previously let '%'/'_' in the (validly-formatted)
// address act as SQL LIKE wildcards and match a different subscriber.)
function findSubscriber(supabase: ReturnType<typeof getAdminClient>, email: string) {
  return supabase
    .from("newsletter_subscribers")
    .select("id, unsubscribed_at, unsubscribe_token")
    .eq("email", email)
    .maybeSingle();
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    // Generous but real limit — this is a public, unauthenticated form.
    if (await isRateLimited(`newsletter-subscribe:ip:${ip}`, 5, 60 * 60_000)) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait an hour and try again." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { email: rawEmail } = body as Record<string, unknown>;
    if (
      typeof rawEmail !== "string" ||
      rawEmail.trim().length === 0 ||
      rawEmail.trim().length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail.trim())
    ) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    const email = rawEmail.trim().toLowerCase();

    const supabase = getAdminClient();

    const { data: existing, error: lookupError } = await findSubscriber(supabase, email);

    if (lookupError) {
      console.error("newsletter_subscribers lookup error:", lookupError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    let unsubscribeToken: string;

    if (existing && !existing.unsubscribed_at) {
      // Already an active subscriber — treat as success, no duplicate email.
      return NextResponse.json({ success: true, alreadySubscribed: true });
    } else if (existing) {
      // Previously unsubscribed — resubscribe instead of erroring on the
      // unique(email) index.
      const { error: updateError } = await supabase
        .from("newsletter_subscribers")
        .update({ unsubscribed_at: null, subscribed_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (updateError) {
        console.error("newsletter_subscribers resubscribe error:", updateError);
        return NextResponse.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 }
        );
      }
      unsubscribeToken = existing.unsubscribe_token as string;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("newsletter_subscribers")
        .insert({ email })
        .select("unsubscribe_token")
        .single();

      if (insertError?.code === "23505") {
        // Lost a race with a concurrent signup for the same email (e.g. a
        // double-click or two tabs) — the other request's insert already
        // won. Look the row up and continue exactly as if we'd found it on
        // the first lookup above, instead of surfacing a raw 500.
        const { data: raced, error: racedError } = await findSubscriber(supabase, email);
        if (racedError || !raced) {
          console.error("newsletter_subscribers post-race lookup error:", racedError);
          return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 500 }
          );
        }
        if (!raced.unsubscribed_at) {
          return NextResponse.json({ success: true, alreadySubscribed: true });
        }
        const { error: updateError } = await supabase
          .from("newsletter_subscribers")
          .update({ unsubscribed_at: null, subscribed_at: new Date().toISOString() })
          .eq("id", raced.id);
        if (updateError) {
          console.error("newsletter_subscribers post-race resubscribe error:", updateError);
          return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 500 }
          );
        }
        unsubscribeToken = raced.unsubscribe_token as string;
      } else if (insertError || !inserted) {
        console.error("newsletter_subscribers insert error:", insertError);
        return NextResponse.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 }
        );
      } else {
        unsubscribeToken = inserted.unsubscribe_token as string;
      }
    }

    // Best-effort welcome email — a delivery failure shouldn't fail the
    // signup itself, since the subscriber row is already saved.
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hottruckmap.com";
      const unsubscribeUrl = `${siteUrl}/api/newsletter-unsubscribe?token=${unsubscribeToken}`;
      const { subject, html, text } = newsletterWelcomeEmail({ email, unsubscribeUrl });
      await sendEmail({ to: email, subject, html, text });
    } catch (emailErr) {
      console.error("newsletter welcome email failed:", emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Newsletter subscribe API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
