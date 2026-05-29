import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (replaces deprecated middleware.ts).
 *
 * Responsibilities:
 *  1. Refresh the Supabase auth session on every navigation so cookies
 *     stay fresh and server components / route handlers see the latest token.
 *  2. Redirect unauthenticated visitors away from protected route prefixes.
 *  3. Server-side admin gate via email allowlist (app_metadata alone is not
 *     verified at the proxy layer — the email check is a secondary backstop).
 */

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/account"];
const ADMIN_EMAILS = ["hottruckmap@gmail.com"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to the request so downstream handlers see them.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Re-create the response with the updated request, then write
          // Set-Cookie headers so the browser receives the refreshed tokens.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — validates the token against Supabase Auth.
  // If Auth is unreachable (outage, timeout), fall back to unauthenticated
  // so public pages still load instead of crashing the whole site.
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    // Auth blip — proceed as unauthenticated; protected routes redirect to login
  }

  const { pathname } = request.nextUrl;

  // ── Authentication gate ──────────────────────────────────────────────
  if (!user && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // ── Admin role gate (server-side backstop) ───────────────────────────
  if (pathname.startsWith("/admin") && user) {
    if (!ADMIN_EMAILS.includes((user.email ?? "").toLowerCase())) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on all routes except:
     *  - API routes (have their own auth checks)
     *  - Static / image-optimisation assets
     *  - Common metadata files
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};
