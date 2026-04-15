"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Landing page after Google OAuth.
 * Reads the user's role from metadata and routes:
 *   operator → /dashboard
 *   everyone else → /
 */
export default function AuthCallback() {
  useEffect(() => {
    async function redirect() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.role === "operator") {
        window.location.replace("/dashboard");
      } else {
        window.location.replace("/");
      }
    }
    redirect();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Signing you in...</p>
      </div>
    </div>
  );
}
