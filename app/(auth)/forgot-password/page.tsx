"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleReset() {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 mb-2">
            <span className="font-black text-brand-red text-2xl tracking-tight">HOT</span>
            <span className="font-black text-neutral-800 text-2xl tracking-tight">TRUCK</span>
            <span className="font-black text-brand-orange text-2xl tracking-tight">MAPS</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6">
          {sent ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <h1 className="text-xl font-black text-neutral-900 mb-2">Check your email</h1>
              <p className="text-sm text-neutral-500 leading-relaxed mb-6">
                We sent a password reset link to <span className="font-semibold text-neutral-700">{email}</span>.
                Check your inbox (and spam folder) and click the link to set a new password.
              </p>
              <Link href="/login" className="text-sm text-brand-red font-semibold hover:underline">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-black text-neutral-900 mb-1">Forgot your password?</h1>
              <p className="text-sm text-neutral-500 mb-6">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-600">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleReset()}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleReset}
                  disabled={loading || !email.trim()}
                  className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>

                <p className="text-center text-sm text-neutral-400">
                  Remember it?{" "}
                  <Link href="/login" className="text-brand-red font-semibold">Sign in</Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
