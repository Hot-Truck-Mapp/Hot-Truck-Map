"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

const SUBJECTS = [
  "General Question",
  "List My Truck",
  "Report an Issue",
  "Partnership / Press",
  "Other",
] as const;

type Subject = (typeof SUBJECTS)[number];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "How do I list my food truck?",
    a: "Sign up as an operator at /signup — it's completely free. Once your account is approved you'll be able to create your truck profile, add your menu, and go live.",
  },
  {
    q: "Is Hot Truck Map free to use?",
    a: "Yes — Hot Truck Map is free for both customers and operators. There are no subscription fees or commissions.",
  },
  {
    q: "How does Go Live work?",
    a: "Operators tap the Go Live button in their dashboard to share their real-time GPS location. Customers nearby can then see the truck on the map and place pre-orders.",
  },
  {
    q: "Can I order from any truck?",
    a: "You can only place orders from trucks that are currently live and accepting orders. If a truck is offline, you can still browse its menu and follow it to get notified when it goes live.",
  },
  {
    q: "How do I report an issue?",
    a: "Use the contact form on this page or email us directly at hottruckmap@gmail.com. We aim to respond within 24 hours.",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-neutral-50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-semibold text-neutral-900 text-sm">{q}</span>
        <span
          className="flex-shrink-0 w-5 h-5 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-500 transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          aria-hidden
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="px-5 pb-4 pt-1 bg-white text-neutral-600 text-sm leading-relaxed border-t border-neutral-100">
          {a}
        </div>
      )}
    </div>
  );
}

export default function ContactPage() {
  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<Subject | "">("");
  const [message, setMessage] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Name is required.";
    if (!email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    if (!subject) errs.subject = "Please select a subject.";
    if (!message.trim()) {
      errs.message = "Message is required.";
    } else if (message.trim().length > 1000) {
      errs.message = "Message must be 1000 characters or fewer.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || success) return;
    if (!validate()) return;

    setSubmitting(true);
    setApiError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            subject,
            message: message.trim(),
          }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!mountedRef.current) return;

      if (!res.ok) {
        let msg = "Something went wrong. Please try again.";
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          // ignore parse errors
        }
        setApiError(msg);
        return;
      }

      setSuccess(true);
    } catch {
      if (mountedRef.current) {
        setApiError("Network error — please check your connection and try again.");
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  const charCount = message.length;
  const charOver = charCount > 1000;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1">
              <span className="font-black text-brand-red text-sm tracking-tight">HOT</span>
              <span className="font-black text-white text-sm tracking-tight">TRUCK</span>
            </div>
            <span className="font-black text-brand-orange text-sm tracking-tight leading-none">MAP</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/trucks" className="text-neutral-400 hover:text-white text-sm font-semibold transition-colors">
            Find Trucks
          </Link>
          <Link
            href="/account"
            aria-label="Account"
            className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-neutral-900 px-6 py-14 text-center">
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-3">Get in Touch</h1>
        <p className="text-neutral-400 text-base max-w-xl mx-auto leading-relaxed">
          Have a question, feedback, or want to list your truck?{" "}
          <span className="text-neutral-300">We&apos;d love to hear from you.</span>
        </p>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-5 py-10">

        {/* Form + Info row */}
        <div className="flex flex-col lg:flex-row gap-6 mb-10">

          {/* Contact form */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sm:p-8">
            <h2 className="text-lg font-black text-neutral-900 mb-6">Send us a message</h2>

            {success ? (
              <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="font-black text-neutral-900 text-lg">Message sent!</p>
                  <p className="text-neutral-500 text-sm mt-1">
                    Thanks! We&apos;ll get back to you within 24 hours.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setName("");
                    setEmail("");
                    setSubject("");
                    setMessage("");
                    setFieldErrors({});
                    setApiError(null);
                  }}
                  className="text-sm text-brand-red font-semibold hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Name <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((fe) => ({ ...fe, name: "" }));
                    }}
                    placeholder="Your name"
                    autoComplete="name"
                    maxLength={200}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-neutral-50 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red transition-colors ${fieldErrors.name ? "border-red-400" : "border-neutral-200"}`}
                  />
                  {fieldErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Email <span className="text-brand-red">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((fe) => ({ ...fe, email: "" }));
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={320}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-neutral-50 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red transition-colors ${fieldErrors.email ? "border-red-400" : "border-neutral-200"}`}
                  />
                  {fieldErrors.email && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Subject <span className="text-brand-red">*</span>
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value as Subject);
                      if (fieldErrors.subject) setFieldErrors((fe) => ({ ...fe, subject: "" }));
                    }}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-neutral-50 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red transition-colors appearance-none cursor-pointer ${fieldErrors.subject ? "border-red-400" : "border-neutral-200"} ${!subject ? "text-neutral-400" : ""}`}
                  >
                    <option value="" disabled>Select a subject…</option>
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {fieldErrors.subject && (
                    <p className="text-red-500 text-xs mt-1">{fieldErrors.subject}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Message <span className="text-brand-red">*</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      if (fieldErrors.message) setFieldErrors((fe) => ({ ...fe, message: "" }));
                    }}
                    placeholder="Tell us what's on your mind…"
                    rows={5}
                    maxLength={1000}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-neutral-50 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red transition-colors resize-y min-h-[120px] ${fieldErrors.message ? "border-red-400" : "border-neutral-200"}`}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {fieldErrors.message ? (
                      <p className="text-red-500 text-xs">{fieldErrors.message}</p>
                    ) : (
                      <span />
                    )}
                    <span className={`text-xs tabular-nums ${charOver ? "text-red-500 font-semibold" : "text-neutral-400"}`}>
                      {charCount} / 1000
                    </span>
                  </div>
                </div>

                {/* API error */}
                {apiError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                    {apiError}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-6 rounded-xl font-black text-white text-sm bg-brand-red hover:bg-brand-red-dark active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                      Sending…
                    </>
                  ) : (
                    "Send Message"
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Contact info cards */}
          <div className="lg:w-72 flex flex-col gap-4">
            {/* Email */}
            <a
              href="mailto:hottruckmap@gmail.com"
              className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 flex items-start gap-4 hover:border-brand-red/40 hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-red/20 transition-colors">
                <span className="text-xl" role="img" aria-label="Email">📧</span>
              </div>
              <div>
                <p className="font-black text-neutral-900 text-sm mb-0.5">Email</p>
                <p className="text-brand-red text-sm font-semibold break-all">hottruckmap@gmail.com</p>
              </div>
            </a>

            {/* Location */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl" role="img" aria-label="Location">📍</span>
              </div>
              <div>
                <p className="font-black text-neutral-900 text-sm mb-0.5">Location</p>
                <p className="text-neutral-600 text-sm">New Jersey &amp; New York</p>
              </div>
            </div>

            {/* Response time */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xl" role="img" aria-label="Response time">🕐</span>
              </div>
              <div>
                <p className="font-black text-neutral-900 text-sm mb-0.5">Response Time</p>
                <p className="text-neutral-600 text-sm">Within 24 hours</p>
              </div>
            </div>

            {/* CTA card */}
            <div className="bg-neutral-900 rounded-2xl p-5 flex flex-col gap-2">
              <p className="font-black text-white text-sm">Want to list your truck?</p>
              <p className="text-neutral-400 text-xs leading-relaxed">
                It&apos;s free to join. Sign up as an operator and reach hungry customers near you.
              </p>
              <Link
                href="/signup"
                className="mt-1 inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-brand-red text-white font-black text-xs hover:bg-brand-red-dark transition-colors"
              >
                Get Started Free
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>

        {/* FAQ section */}
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 sm:p-8">
          <h2 className="text-lg font-black text-neutral-900 mb-2">Frequently Asked Questions</h2>
          <p className="text-neutral-500 text-sm mb-6">Quick answers to common questions.</p>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
