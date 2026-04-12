import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /auth/callback
 *
 * Supabase redirects here after:
 *   - Email confirmation (sign-up)
 *   - Password reset
 *   - Google / OAuth sign-in
 *
 * The URL contains either a `code` (PKCE flow) or an error.
 * We exchange the code for a session, then redirect the user to the
 * right place based on their role.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Surface auth errors back to the login page
  if (error) {
    const params = new URLSearchParams({ error: errorDescription ?? error });
    return NextResponse.redirect(origin + "/login?" + params.toString());
  }

  if (!code) {
    return NextResponse.redirect(origin + "/");
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const params = new URLSearchParams({ error: exchangeError.message });
    return NextResponse.redirect(origin + "/login?" + params.toString());
  }

  // Redirect by role: operators go to their dashboard, customers to the map
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "operator") {
      // Check if they have already completed onboarding (truck row with a name)
      const { data: truck } = await supabase
        .from("trucks")
        .select("id, name")
        .eq("owner_id", user.id)
        .single();

      if (!truck?.name) {
        // First time — send to onboarding flow
        return NextResponse.redirect(origin + "/onboarding");
      }

      return NextResponse.redirect(origin + "/dashboard/go-live");
    }
  }

  return NextResponse.redirect(origin + "/");
}
