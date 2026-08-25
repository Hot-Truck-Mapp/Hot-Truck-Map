import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET (not POST) so this can be a plain link in an email — no JS required,
// clicking "Unsubscribe" in any mail client just works.
export async function GET(req: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hottruckmap.com";
  const token = req.nextUrl.searchParams.get("token") ?? "";

  if (!UUID_RE.test(token)) {
    return NextResponse.redirect(new URL("/newsletter/unsubscribed?ok=0", siteUrl));
  }

  try {
    const supabase = getAdminClient();
    // Idempotent — unsubscribing an already-unsubscribed or unknown token
    // just matches zero rows, which is still a success from the visitor's
    // point of view (they end up unsubscribed either way).
    await supabase
      .from("newsletter_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .is("unsubscribed_at", null);

    return NextResponse.redirect(new URL("/newsletter/unsubscribed?ok=1", siteUrl));
  } catch (err) {
    console.error("Newsletter unsubscribe API error:", err);
    return NextResponse.redirect(new URL("/newsletter/unsubscribed?ok=0", siteUrl));
  }
}
