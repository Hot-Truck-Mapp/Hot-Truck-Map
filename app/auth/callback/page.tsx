"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
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
          await supabase.auth.exchangeCodeForSession(code);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/"); return; }

        // OAuth signups (Google) don't carry a role — assign "customer" by default
        if (!user.user_metadata?.role) {
          await supabase.auth.updateUser({ data: { role: "customer" } });
          // Re-read user so we have the refreshed metadata for the redirect decision
          const { data: { user: refreshed } } = await supabase.auth.getUser();
          router.replace(refreshed?.user_metadata?.role === "operator" ? "/dashboard" : "/");
          return;
        }

        router.replace(user.user_metadata.role === "operator" ? "/dashboard" : "/");
      } catch {
        router.replace("/");
      }
    }
    handleRedirect();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
