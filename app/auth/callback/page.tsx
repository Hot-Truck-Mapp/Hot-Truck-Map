"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/safeRedirect";

// Spinner shown while the Suspense boundary is resolving (or during redirect)
function Spinner() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}

// useSearchParams() must be inside a Suspense boundary — Next.js requirement for static export
function AuthCallbackInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleRedirect() {
      const destination = safeRedirect(searchParams.get("redirect"), window.location.origin);
      try {
        const supabase = createClient();

        // Exchange the PKCE code for a session — required for OAuth and magic links.
        // Without this, getUser() returns null and every OAuth login silently fails.
        const code = searchParams.get("code");
        if (code) {
          const { data } = await supabase.auth.exchangeCodeForSession(code);

          // If this code exchange was for a password recovery flow, redirect to
          // the reset-password page instead of the homepage so the user can
          // set a new password.
          // recovery_sent_at is only set on password-recovery sessions — use its
          // presence as the signal rather than a client-side 15-min window that
          // fails for slow email delivery.
          if (data?.session?.user?.recovery_sent_at) {
            window.location.assign("/reset-password");
            return;
          }
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.assign("/"); return; }

        // No explicit destination? Send operators to their dashboard rather
        // than the public homepage.
        //
        // This matters most for the signup confirmation link, which lands here
        // with whatever redirect_to Supabase's allowlist let through — a query
        // string is not guaranteed to survive that. Deciding it here instead of
        // trusting ?redirect makes the operator's first click after "Activate
        // my account" land somewhere useful either way. It also fixes Google
        // sign-in, which dropped operators on the homepage.
        //
        // Truck ownership is the authority, exactly as in useRole — never
        // user_metadata.role, which the user can edit.
        let target = destination;
        if (target === "/") {
          const { data: truck } = await supabase
            .from("trucks")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle();
          if (truck) target = "/dashboard";
        }

        // Hard navigation so auth cookies are committed by the browser before
        // the next request. Client-side router.replace can race the cookie
        // write on iOS Safari and cause middleware to see the user as logged out.
        window.location.assign(target);
      } catch {
        window.location.assign("/");
      }
    }
    handleRedirect();
  }, [searchParams]);

  return <Spinner />;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
