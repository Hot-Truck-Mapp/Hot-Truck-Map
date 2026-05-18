"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// useSearchParams() must be inside a <Suspense> boundary to satisfy the
// Next.js static-generation constraint.  The outer page component renders
// the spinner while the inner component mounts and reads the query string.
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
          if (data?.session?.user?.recovery_sent_at) {
            const recoverySent = new Date(data.session.user.recovery_sent_at).getTime();
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            if (recoverySent > fiveMinutesAgo) {
              router.replace("/reset-password");
              return;
            }
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

  return null;
}

const Spinner = () => (
  <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
      <p className="text-neutral-400 text-sm">Signing you in...</p>
    </div>
  </div>
);

export default function AuthCallback() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
