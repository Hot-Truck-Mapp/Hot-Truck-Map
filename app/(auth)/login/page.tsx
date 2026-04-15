"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const role = data.user?.user_metadata?.role;
    window.location.href = role === "operator" ? "/dashboard" : "/";
  }

  async function handleGoogle() {
    const supabase = createClient();
    // After Google OAuth, the auth callback checks role and routes accordingly
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback" },
    });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* Left panel — brand (tablet+) */}
      <div className="hidden md:flex md:w-[45%] lg:w-1/2 bg-neutral-900 flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-red opacity-5" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-brand-orange opacity-5" />
        </div>

        {/* Logo */}
        <div className="flex items-center gap-2 relative z-10">
          <div className="w-9 h-9 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1">
              <span className="font-black text-brand-red text-2xl tracking-tight">HOT</span>
              <span className="font-black text-white text-2xl tracking-tight">TRUCK</span>
            </div>
            <span className="font-black text-brand-orange text-2xl tracking-tight leading-none">MAPS</span>
          </div>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
            Find the food truck.<br />Skip the guesswork.
          </h2>
          <p className="text-neutral-400 text-base leading-relaxed">
            Real-time locations, menus, and reviews — all in one place.
          </p>

          <div className="flex flex-col gap-3 mt-8">
            {[
              "Live GPS tracking for every truck",
              "Follow your favorites",
              "Operators go live in one tap",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
                <p className="text-neutral-300 text-sm">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-neutral-600 text-xs relative z-10">
          New Jersey · New York · and growing
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 bg-neutral-50 flex flex-col justify-center p-6 md:p-10 lg:p-14">
        <div className="w-full max-w-sm mx-auto">

          {/* Mobile logo */}
          <div className="mb-10 text-center md:hidden">
            <div className="inline-flex items-center gap-1.5 mb-2">
              <span className="font-black text-brand-red text-2xl tracking-tight">HOT</span>
              <span className="font-black text-neutral-800 text-2xl tracking-tight">TRUCK</span>
              <span className="font-black text-brand-orange text-2xl tracking-tight">MAPS</span>
            </div>
            <p className="text-neutral-400 text-sm">Find the food truck. Skip the guesswork.</p>
          </div>

          {/* Tablet heading */}
          <div className="hidden md:block mb-8">
            <h1 className="text-2xl font-black text-neutral-900">Welcome back</h1>
            <p className="text-neutral-500 text-sm mt-1">Sign in to your account</p>
          </div>

          <div className="flex flex-col gap-4">

            {/* Google */}
            <button
              onClick={handleGoogle}
              className="w-full py-3.5 bg-white border border-neutral-200 rounded-2xl font-semibold text-neutral-700 flex items-center justify-center gap-3 shadow-sm hover:border-neutral-300 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400">or sign in with email</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-600">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40 transition-opacity"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-center text-sm text-neutral-500">
              Don't have an account?{" "}
              <Link href="/signup" className="text-brand-red font-semibold">Sign Up</Link>
            </p>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="text-xs text-neutral-400">own a food truck?</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>

            <Link
              href="/signup?role=operator"
              className="w-full py-3 border-2 border-neutral-200 text-neutral-600 rounded-2xl font-semibold text-sm text-center hover:border-brand-red hover:text-brand-red transition-colors"
            >
              List My Truck
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
