"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleRedirect() {
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
            router.replace("/reset-password");
            return;
          }
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/"); return; }

        // Redirect to "/" — the dashboard's own auth guard handles
        // operator routing based on DB truck ownership (not user-editable metadata).
        router.replace("/");
      } catch {
        router.replace("/");
      }
    }
    handleRedirect();
  }, [router, searchParams]);

  return <Spinner />;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
