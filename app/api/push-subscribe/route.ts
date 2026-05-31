import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createClientFromToken } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isRateLimited } from "@/lib/rateLimit";

/**
 * Resolve the authenticated user from either:
 *  - a session cookie (web, same-origin)
 *  - an Authorization: Bearer <jwt> header (mobile)
 */
async function resolveUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (bearerToken) {
    // Mobile path: verify the JWT directly with anon key client
    const client = createClientFromToken(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error } = await client.auth.getUser(bearerToken);
    return { user: error ? null : user, client };
  }

  // Web path: cookie-based session
  const cookieStore = await cookies();
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* Server Component context */ }
        },
      },
    }
  );
  const { data: { user } } = await client.auth.getUser();
  return { user, client };
}

export async function POST(req: NextRequest) {
  try {
    const { user, client } = await resolveUser(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (await isRateLimited(`push-subscribe:${user.id}`, 10, 60 * 60_000)) {
      return NextResponse.json(
        { error: "Too many subscription requests — please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { platform, endpoint, p256dh, auth_key } = body;

    if (!platform || !endpoint) {
      return NextResponse.json(
        { error: "Missing required fields: platform, endpoint" },
        { status: 400 }
      );
    }

    if (!["web", "expo"].includes(platform)) {
      return NextResponse.json(
        { error: "platform must be 'web' or 'expo'" },
        { status: 400 }
      );
    }

    // Validate endpoint format to prevent SSRF via stored URLs
    if (typeof endpoint !== "string" || endpoint.length > 2048) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
    if (platform === "web") {
      try {
        const url = new URL(endpoint);
        if (url.protocol !== "https:") throw new Error("must be https");
      } catch {
        return NextResponse.json({ error: "Web endpoint must be a valid HTTPS URL" }, { status: 400 });
      }
    } else if (platform === "expo") {
      // Expo push tokens have the form ExponentPushToken[...] or ea2... (bare)
      if (!endpoint.startsWith("ExponentPushToken[") && !/^[A-Za-z0-9_-]{20,}$/.test(endpoint)) {
        return NextResponse.json({ error: "Invalid Expo push token format" }, { status: 400 });
      }
    }
    if (p256dh != null && (typeof p256dh !== "string" || p256dh.length > 512)) {
      return NextResponse.json({ error: "Invalid p256dh" }, { status: 400 });
    }
    if (auth_key != null && (typeof auth_key !== "string" || auth_key.length > 256)) {
      return NextResponse.json({ error: "Invalid auth_key" }, { status: 400 });
    }

    // Web subscriptions require p256dh and auth_key for VAPID encryption
    if (platform === "web" && (!p256dh || !auth_key)) {
      return NextResponse.json(
        { error: "Web subscriptions require p256dh and auth_key" },
        { status: 400 }
      );
    }

    const { error } = await client.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        platform,
        endpoint,
        p256dh: p256dh ?? null,
        auth_key: auth_key ?? null,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, client } = await resolveUser(req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing required field: endpoint" },
        { status: 400 }
      );
    }

    const { error } = await client
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
