"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function VerificationBanner() {
  const [verified, setVerified] = useState(true);
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const checkVerification = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setVerified(!!user.email_confirmed_at);
    };
    checkVerification();
  }, []);

  const resendEmail = async () => {
    setSending(true);
    setError(false);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });
      if (resendError) throw resendError;
      setResent(true);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  if (verified) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 m-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-amber-800">Verify your email</p>
        <p className="text-xs text-amber-600 mt-0.5">
          {error
            ? "Couldn't send — check your connection and try again."
            : "Your truck won't appear on the map until you verify"}
        </p>
      </div>
      <button
        onClick={resendEmail}
        disabled={resent || sending}
        className="flex-shrink-0 px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-full disabled:opacity-40"
      >
        {sending ? "Sending..." : resent ? "Sent ✓" : "Resend"}
      </button>
    </div>
  );
}
