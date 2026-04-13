"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const CUISINE_TYPES = [
  "Tacos", "BBQ", "Burgers", "Asian Fusion", "Desserts",
  "Pizza", "Sandwiches", "Healthy", "Breakfast", "Seafood",
  "Mediterranean", "Vegan", "Halal", "Other",
];

type Step = "form" | "truck-info" | "done";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"customer" | "operator">("customer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Truck info step
  const [truckName, setTruckName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [savingTruck, setSavingTruck] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  async function handleSignup() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (role === "operator" && data.user) {
      setUserId(data.user.id);
      setLoading(false);
      setStep("truck-info");
    } else {
      setLoading(false);
      setStep("done");
    }
  }

  async function handleTruckInfo() {
    if (!truckName || !userId) return;
    setSavingTruck(true);

    const supabase = createClient();
    await supabase.from("trucks").insert({
      owner_id: userId,
      name: truckName,
      cuisine: cuisine || null,
      is_live: false,
    });

    setSavingTruck(false);
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-neutral-800">HotTruckMap</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Find the food truck. Skip the guesswork.
          </p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center flex flex-col items-center gap-3">
            <h2 className="text-xl font-bold text-neutral-800">
              Check your email!
            </h2>
            <p className="text-neutral-500 text-sm">
              We sent a confirmation link to{" "}
              <span className="font-medium text-neutral-700">{email}</span>.
              Click it to activate your account.
            </p>
          </div>

          <Link
            href="/login"
            className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base text-center"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (step === "truck-info") {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

        <div className="mb-10 text-center">
          <h1 className="text-2xl font-bold text-neutral-800">Your Truck</h1>
          <p className="text-neutral-400 text-sm mt-1">
            Tell us about your food truck
          </p>
        </div>

        <div className="w-full max-w-sm flex flex-col gap-4">

          <div>
            <label className="text-sm font-medium text-neutral-600">Truck Name *</label>
            <input
              value={truckName}
              onChange={(e) => setTruckName(e.target.value)}
              placeholder="e.g. The Taco Truck"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 focus:outline-none focus:border-brand-red"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-600">Cuisine Type</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CUISINE_TYPES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCuisine(c)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    cuisine === c
                      ? "bg-brand-red text-white border-brand-red"
                      : "bg-white border-neutral-200 text-neutral-600"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleTruckInfo}
            disabled={savingTruck || !truckName}
            className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40 mt-2"
          >
            {savingTruck ? "Saving..." : "Continue"}
          </button>

          <button
            onClick={() => setStep("done")}
            className="text-sm text-neutral-400 text-center"
          >
            Skip for now
          </button>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

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
              <p className="text-xs font-semibold text-neutral-700">Find Trucks</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Customer</p>
            </button>
            <button
              onClick={() => setRole("operator")}
              className={`p-3 rounded-xl border-2 text-center transition-all ${
                role === "operator"
                  ? "border-brand-red bg-red-50"
                  : "border-neutral-100 bg-neutral-50"
              }`}
            >
              <p className="text-xs font-semibold text-neutral-700">List My Truck</p>
              <p className="text-[10px] text-neutral-400 mt-0.5">Operator</p>
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
          <p className="text-xs text-neutral-400 mt-1">Minimum 6 characters</p>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={handleSignup}
          disabled={loading || !email || !password}
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>

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
