import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/account"];
const ADMIN_EMAILS = ["hottruckmap@gmail.com"];

export async function middleware(request: NextRequest) {
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
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
    // Only keep the redirect param for same-origin paths to prevent open redirect.
    // Preserve the query string too (not just pathname) so a protected route
    // that depends on query params isn't stripped on the login round-trip.
    if (pathname.startsWith("/") && !pathname.startsWith("//")) {
      url.searchParams.set("redirect", pathname + request.nextUrl.search);
    }
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
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};
