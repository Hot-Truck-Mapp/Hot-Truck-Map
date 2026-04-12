"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "operator">("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSignup() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
        emailRedirectTo: window.location.origin + "/auth/callback",
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-xl font-bold text-neutral-800 mb-2">
          Check your email!
        </h2>
        <p className="text-neutral-500 text-sm max-w-xs">
          We sent a confirmation link to {email}. Click it to activate your account.
        </p>
        <Link
          href="/login"
          className="mt-6 px-6 py-3 bg-brand-red text-white rounded-full font-semibold text-sm"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

      {/* Logo */}
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-bold text-neutral-800">Join HotTruckMap</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Find trucks or list yours
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* Role Selector */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-neutral-700 mb-3">
            I want to...
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRole("customer")}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                role === "customer"
                  ? "border-brand-red bg-red-50"
                  : "border-neutral-100 bg-neutral-50"
              }`}
            >
              <p className="text-xs font-semibold text-neutral-700">
                Find Trucks
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Customer
              </p>
            </button>
            <button
              onClick={() => setRole("operator")}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                role === "operator"
                  ? "border-brand-red bg-red-50"
                  : "border-neutral-100 bg-neutral-50"
              }`}
            >
              <p className="text-xs font-semibold text-neutral-700">
                List My Truck
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5">
                Operator
              </p>
            </button>
          </div>
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
            onKeyDown={(e) => e.key === "Enter" && handleSignup()}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 focus:outline-none"
          />
          <p className="text-xs text-neutral-400 mt-1">
            Minimum 6 characters
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        {/* Signup Button */}
        <button
          onClick={handleSignup}
          disabled={loading || !email || !password}
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

        {/* Login Link */}
        <p className="text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-red font-semibold">
            Sign In
          </Link>
        </p>

      </div>
    </div>
  );
}