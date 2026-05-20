"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [ready, setReady]         = useState(false);
  const [timedOut, setTimedOut]   = useState(false);
  const router = useRouter();
  const mountedRef = useRef(true);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let fired = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        fired = true;
        setReady(true);
      }
    });

    // PKCE flow: Supabase redirects here with ?code=... — exchange it to
    // establish the recovery session, which fires the PASSWORD_RECOVERY event.
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(() => {
          // Clean the code from the URL so a reload doesn't re-attempt exchange
          window.history.replaceState({}, "", url.pathname);
        })
        .catch(() => {
          // Code exchange failed — link expired or already used
          if (!fired && mountedRef.current) setTimedOut(true);
        });
    }

    const timeout = setTimeout(() => {
      if (!fired && mountedRef.current) setTimedOut(true);
    }, 45000); // 45s — enough for slow connections and email link redirects

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleUpdate() {
    if (loading) return; // in-flight guard
    if (!password || password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password.length > 72) {
      setError("Password must be 72 characters or fewer.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      if (!mountedRef.current) return;
      setDone(true);
      redirectTimerRef.current = setTimeout(() => { if (mountedRef.current) router.push("/login"); }, 2500);
    } catch {
      if (mountedRef.current) setError("Network error — please check your connection and try again.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 mb-2">
            <span className="font-black text-brand-red text-2xl tracking-tight">HOT</span>
            <span className="font-black text-neutral-800 text-2xl tracking-tight">TRUCK</span>
            <span className="font-black text-brand-orange text-2xl tracking-tight">MAP</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm p-6">
          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <h1 className="text-xl font-black text-neutral-900 mb-2">Password updated!</h1>
              <p className="text-sm text-neutral-500">Taking you back to sign in...</p>
            </div>
          ) : timedOut ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 mb-3">This reset link has expired or is invalid.</p>
              <a href="/forgot-password" className="text-brand-red font-semibold text-sm">Request a new link</a>
            </div>
          ) : !ready ? (
            <div className="text-center py-4">
              <div className="w-8 h-8 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-neutral-500">Verifying your reset link...</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-black text-neutral-900 mb-1">Set a new password</h1>
              <p className="text-sm text-neutral-500 mb-6">Choose something you&apos;ll remember.</p>

              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="new-password" className="text-sm font-medium text-neutral-600">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    maxLength={72}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="confirm-password" className="text-sm font-medium text-neutral-600">Confirm password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    placeholder="Repeat your password"
                    maxLength={72}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleUpdate}
                  disabled={loading || !password || !confirm}
                  className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
