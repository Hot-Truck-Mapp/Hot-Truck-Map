"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    async function handleRedirect() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/"); return; }

        // OAuth signups (Google) don't set a role — assign "customer" by default
        if (!user.user_metadata?.role) {
          await supabase.auth.updateUser({ data: { role: "customer" } });
        }

        if (user.user_metadata?.role === "operator") {
          router.replace("/dashboard");
        } else {
          router.replace("/");
        }
      } catch {
        router.replace("/");
      }
    }
    handleRedirect();
  }, [router]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
