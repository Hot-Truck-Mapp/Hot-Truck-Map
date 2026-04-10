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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    window.location.href = "/";
  }

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/",
      },
    });
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="mb-10 text-center">
        <p className="text-5xl mb-3">🚚</p>
        <h1 className="text-2xl font-bold text-neutral-800">HotTruckMap</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Find the food truck. Skip the guesswork.
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* Google Login */}
        <button
          onClick={handleGoogle}
          className="w-full py-3.5 bg-white border border-neutral-200 rounded-2xl font-semibold text-neutral-700 flex items-center justify-center gap-3 shadow-sm"
        >
          <span className="text-xl">🔵</span>
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-neutral-200" />
          <span className="text-xs text-neutral-400">or</span>
          <div className="flex-1 h-px bg-neutral-200" />
        </div>

        {/* Email */}
        <div>
          <label className="text-sm font-medium text-neutral-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 focus:outline-none"
          />
        </div>

        {/* Password */}
        <div>
          <label className="text-sm font-medium text-neutral-600">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        {/* Sign Up Link */}
        <p className="text-center text-sm text-neutral-500">
          Don't have an account?{" "}
          <Link href="/signup" className="text-brand-red font-semibold">
            Sign Up
          </Link>
        </p>

      </div>
    </div>
  );
}