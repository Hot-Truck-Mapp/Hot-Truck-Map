"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const CUISINE_TYPES = [
  "Tacos", "BBQ", "Burgers", "Asian Fusion", "Desserts",
  "Pizza", "Sandwiches", "Healthy", "Breakfast", "Seafood",
  "Mediterranean", "Vegan", "Halal", "Other",
];

type Step = "choose" | "operator" | "customer" | "done-operator" | "done-customer";

export default function SignupPage() {
  const [step, setStep] = useState<Step>("choose");

  // Operator fields
  const [truckName, setTruckName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [opEmail, setOpEmail] = useState("");
  const [opPassword, setOpPassword] = useState("");
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  // Customer fields
  const [cuEmail, setCuEmail] = useState("");
  const [cuPassword, setCuPassword] = useState("");
  const [cuLoading, setCuLoading] = useState(false);
  const [cuError, setCuError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("role") === "operator") setStep("operator");
  }, []);

  async function handleOperatorSignup() {
    if (!truckName.trim() || !opEmail || !opPassword) return;
    setOpLoading(true);
    setOpError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: opEmail,
      password: opPassword,
      options: {
        data: { role: "operator" },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });

    if (error) {
      setOpError(error.message);
      setOpLoading(false);
      return;
    }

    if (data.user) {
      const { error: truckError } = await supabase.from("trucks").insert({
        owner_id: data.user.id,
        name: truckName.trim(),
        cuisine: cuisine || null,
        is_live: false,
      });
      if (truckError) {
        // Truck creation can fail if email confirmation is required first.
        // The dashboard will prompt them to fill in their profile on first login.
        console.warn("Truck pre-create failed (will retry on first login):", truckError.message);
      }
    }

    setOpLoading(false);
    setStep("done-operator");
  }

  async function handleCustomerSignup() {
    if (!cuEmail || !cuPassword) return;
    setCuLoading(true);
    setCuError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: cuEmail,
      password: cuPassword,
      options: {
        data: { role: "customer" },
        emailRedirectTo: window.location.origin + "/",
      },
    });

    if (error) {
      setCuError(error.message);
      setCuLoading(false);
      return;
    }

    setCuLoading(false);
    setStep("done-customer");
  }

  // ── CHOOSE ───────────────────────────────────────────────────────────────
  if (step === "choose") {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <Logo size="lg" />
          <p className="text-neutral-500 text-sm mt-2">Join the community</p>
        </div>

        <div className="w-full max-w-sm md:max-w-2xl flex flex-col md:flex-row gap-3">
          <button
            onClick={() => setStep("operator")}
            className="flex-1 bg-neutral-900 rounded-2xl p-5 text-left hover:bg-neutral-800 transition-colors group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-brand-red uppercase tracking-widest">
                For Food Truck Owners
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-x-0.5 transition-transform">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
            <p className="text-white font-bold text-lg leading-tight mb-1">List my truck</p>
            <p className="text-neutral-400 text-sm">Get on the map, go live in 1 tap, get discovered</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {["Free", "No commission", "Go live instantly"].map((tag) => (
                <span key={tag} className="text-[10px] font-bold px-2 py-0.5 bg-neutral-800 text-neutral-300 rounded-full border border-neutral-700">
                  {tag}
                </span>
              ))}
            </div>
          </button>

          <button
            onClick={() => setStep("customer")}
            className="flex-1 bg-white border border-neutral-200 rounded-2xl p-5 text-left hover:border-neutral-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-neutral-400 uppercase tracking-widest">
                For Customers
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
            <p className="text-neutral-800 font-bold text-lg leading-tight mb-1">Find food trucks near me</p>
            <p className="text-neutral-400 text-sm">Follow your favorites, get notified when they go live</p>
          </button>
        </div>

        <p className="text-center text-sm text-neutral-500 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-red font-semibold">Sign In</Link>
        </p>
      </div>
    );
  }

  // ── OPERATOR ─────────────────────────────────────────────────────────────
  if (step === "operator") {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">

        {/* Left panel — brand (tablet+) */}
        <div className="hidden md:flex md:w-[45%] lg:w-1/2 bg-neutral-900 flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-red opacity-5" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-brand-orange opacity-5" />
          </div>

          <Logo size="lg" dark />

          <div className="relative z-10">
            <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
              Get your truck<br />
              on the map.
            </h2>
            <p className="text-neutral-400 text-base mb-8 leading-relaxed">
              Real-time location sharing. Customers find you instantly. No monthly fees.
            </p>

            <div className="flex flex-col gap-4">
              {[
                { title: "100% free, forever", desc: "No subscription, no commission on orders" },
                { title: "Go live in one tap", desc: "Share your GPS location instantly from the app" },
                { title: "Real-time map visibility", desc: "Appear on the map the moment you press Go Live" },
              ].map(({ title, desc }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-neutral-500 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-neutral-600 text-xs relative z-10">
            Trusted by food trucks across New Jersey & New York
          </p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 bg-neutral-50 flex flex-col overflow-y-auto">
          <div className="flex-1 flex flex-col max-w-lg w-full mx-auto px-6 py-8 md:py-10 md:px-10">

            {/* Mobile: back button */}
            <button
              onClick={() => setStep("choose")}
              className="flex items-center gap-1.5 text-neutral-400 text-sm mb-6 hover:text-neutral-600 transition-colors md:hidden"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Back
            </button>

            {/* Tablet: back link */}
            <Link
              href="/signup"
              className="hidden md:flex items-center gap-1.5 text-neutral-400 text-sm mb-6 hover:text-neutral-600 transition-colors w-fit"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Back
            </Link>

            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-black text-neutral-900 leading-tight">
                Get your truck on the map
              </h1>
              <p className="text-neutral-500 text-sm mt-1">Under 2 minutes. Free forever.</p>
            </div>

            {/* Mobile only: value props */}
            <div className="flex gap-2 mb-6 flex-wrap md:hidden">
              {[
                { label: "100% free" },
                { label: "Go live in 1 tap" },
                { label: "Real-time map" },
              ].map(({ label }) => (
                <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-red flex-shrink-0" />
                  <span className="text-xs font-semibold text-neutral-700">{label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-5">

              {/* Truck info */}
              <div>
                <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Your Truck</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-sm font-semibold text-neutral-700">
                      Truck Name <span className="text-brand-red">*</span>
                    </label>
                    <input
                      value={truckName}
                      onChange={(e) => setTruckName(e.target.value)}
                      placeholder="e.g. The Taco Truck"
                      autoFocus
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-neutral-700">Cuisine Type</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {CUISINE_TYPES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCuisine(cuisine === c ? "" : c)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            cuisine === c
                              ? "bg-brand-red text-white border-brand-red"
                              : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account */}
              <div>
                <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Your Account</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-sm font-semibold text-neutral-700">
                      Email <span className="text-brand-red">*</span>
                    </label>
                    <input
                      type="email"
                      value={opEmail}
                      onChange={(e) => setOpEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-neutral-700">
                      Password <span className="text-brand-red">*</span>
                    </label>
                    <input
                      type="password"
                      value={opPassword}
                      onChange={(e) => setOpPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      onKeyDown={(e) => e.key === "Enter" && handleOperatorSignup()}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                    />
                  </div>
                </div>
              </div>

              {opError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-600">{opError}</p>
                </div>
              )}

              <button
                onClick={handleOperatorSignup}
                disabled={opLoading || !truckName.trim() || !opEmail || !opPassword}
                className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base disabled:opacity-40 transition-opacity"
              >
                {opLoading ? "Setting up your truck..." : "List My Truck — It's Free"}
              </button>

              <p className="text-center text-sm text-neutral-500">
                Already have an account?{" "}
                <Link href="/login" className="text-brand-red font-semibold">Sign In</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── CUSTOMER ─────────────────────────────────────────────────────────────
  if (step === "customer") {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">

        {/* Left panel — brand (tablet+) */}
        <div className="hidden md:flex md:w-[45%] lg:w-1/2 bg-neutral-900 flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-red opacity-5" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-brand-orange opacity-5" />
          </div>
          <Logo size="lg" dark />
          <div className="relative z-10">
            <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-4">
              Find the food truck.<br />Skip the guesswork.
            </h2>
            <p className="text-neutral-400 text-base leading-relaxed">
              Real-time locations for every food truck near you. Follow your favorites and get notified the moment they go live.
            </p>
          </div>
          <p className="text-neutral-600 text-xs relative z-10">Free to use · No credit card needed</p>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 bg-neutral-50 flex flex-col justify-center">
          <div className="max-w-lg w-full mx-auto px-6 py-10 md:px-10">
            <button
              onClick={() => setStep("choose")}
              className="flex items-center gap-1.5 text-neutral-400 text-sm mb-6 hover:text-neutral-600 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M19 12H5M12 5l-7 7 7 7"/>
              </svg>
              Back
            </button>

            <div className="mb-6">
              <h1 className="text-2xl md:text-3xl font-bold text-neutral-900">Create account</h1>
              <p className="text-neutral-400 text-sm mt-1">Find food trucks near you</p>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-neutral-600">Email</label>
                <input
                  type="email"
                  value={cuEmail}
                  onChange={(e) => setCuEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-neutral-600">Password</label>
                <input
                  type="password"
                  value={cuPassword}
                  onChange={(e) => setCuPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  onKeyDown={(e) => e.key === "Enter" && handleCustomerSignup()}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base mt-1.5 focus:outline-none focus:border-brand-red transition-colors bg-white"
                />
              </div>

              {cuError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-sm text-red-600">{cuError}</p>
                </div>
              )}

              <button
                onClick={handleCustomerSignup}
                disabled={cuLoading || !cuEmail || !cuPassword}
                className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40"
              >
                {cuLoading ? "Creating account..." : "Create Account"}
              </button>

              <p className="text-center text-sm text-neutral-500">
                Already have an account?{" "}
                <Link href="/login" className="text-brand-red font-semibold">Sign In</Link>
              </p>

              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs text-neutral-400">own a food truck?</span>
                <div className="flex-1 h-px bg-neutral-200" />
              </div>

              <button
                onClick={() => setStep("operator")}
                className="w-full py-3 border-2 border-neutral-200 text-neutral-600 rounded-2xl font-semibold text-sm hover:border-brand-red hover:text-brand-red transition-colors"
              >
                List My Truck Instead
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE — Operator ───────────────────────────────────────────────────────
  if (step === "done-operator") {
    return (
      <div className="min-h-screen flex flex-col md:flex-row">
        {/* Left panel */}
        <div className="hidden md:flex md:w-[45%] lg:w-1/2 bg-neutral-900 flex-col justify-between p-10 lg:p-14 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-red opacity-5" />
          </div>
          <Logo size="lg" dark />
          <div className="relative z-10">
            <div className="w-16 h-16 bg-brand-red rounded-2xl flex items-center justify-center mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <h2 className="text-3xl font-black text-white leading-tight mb-3">
              Almost there!
            </h2>
            <p className="text-neutral-400 text-base leading-relaxed">
              Just confirm your email and you'll be on the map within minutes.
            </p>
          </div>
          <p className="text-neutral-600 text-xs relative z-10">HotTruckMap · Free forever</p>
        </div>

        {/* Right panel */}
        <div className="flex-1 bg-neutral-50 flex flex-col justify-center p-6 md:p-10">
          <div className="max-w-md w-full mx-auto flex flex-col gap-4">
            <div className="text-center mb-2 md:text-left">
              <div className="w-14 h-14 bg-brand-red rounded-2xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 3h15v13H1z"/>
                  <path d="M16 8h4l3 3v5h-7V8z"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-black text-neutral-900">{truckName} is ready!</h1>
              <p className="text-neutral-500 text-sm mt-1">One last step to get on the map.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {[
                { num: "1", title: "Confirm your email", desc: `We sent a link to ${opEmail} — click it to activate your account.`, active: true },
                { num: "2", title: "Sign in to your dashboard", desc: "Complete your profile, add menu items, and set your schedule.", active: false },
                { num: "3", title: "Tap Go Live", desc: "One tap and your truck appears on the map instantly.", active: false },
              ].map((item, i) => (
                <div key={item.num} className={`flex gap-4 px-5 py-4 ${i < 2 ? "border-b border-neutral-100" : ""}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5 ${item.active ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-400"}`}>
                    {item.num}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${item.active ? "text-neutral-900" : "text-neutral-500"}`}>{item.title}</p>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/login" className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base text-center">
              Go to Sign In
            </Link>
            <p className="text-center text-xs text-neutral-400">Can't find the email? Check your spam folder.</p>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE — Customer ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center flex flex-col items-center gap-3">
          <h2 className="text-xl font-bold text-neutral-800">Check your email</h2>
          <p className="text-neutral-500 text-sm">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-neutral-700">{cuEmail}</span>.
            Click it to activate your account.
          </p>
          <p className="text-xs text-neutral-400">Check your spam folder if you don't see it.</p>
        </div>
        <Link href="/login" className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base text-center">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}

// ── Shared Logo component ────────────────────────────────────────────────────
function Logo({ size = "md", dark = false }: { size?: "md" | "lg"; dark?: boolean }) {
  const textSize = size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className="flex items-center gap-2">
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
          <span className={`font-black text-brand-red ${textSize} tracking-tight`}>HOT</span>
          <span className={`font-black ${dark ? "text-white" : "text-neutral-800"} ${textSize} tracking-tight`}>TRUCK</span>
        </div>
        <span className={`font-black text-brand-orange ${textSize} tracking-tight leading-none`}>MAPS</span>
      </div>
    </div>
  );
}
