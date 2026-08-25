"use client";

import { useState, useRef, useEffect } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || success) return;

    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch("/api/newsletter-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ email: trimmed }),
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
        setError(msg);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data?.alreadySubscribed) setAlreadySubscribed(true);
      setSuccess(true);
    } catch {
      if (mountedRef.current) {
        setError("Network error — please check your connection and try again.");
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-neutral-300 px-6 py-8 text-center">
        <p className="text-2xl mb-2">{alreadySubscribed ? "📬" : "✅"}</p>
        <p className="font-black text-neutral-900 text-sm mb-1">
          {alreadySubscribed ? "You're already subscribed" : "You're subscribed!"}
        </p>
        <p className="text-xs text-neutral-500 max-w-xs mx-auto">
          {alreadySubscribed
            ? "We'll keep sending new issues to your inbox every two weeks."
            : "Check your inbox for a welcome email — new issues land in your inbox every two weeks."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white rounded-2xl border border-dashed border-neutral-300 px-6 py-8 text-center"
    >
      <p className="text-2xl mb-2">📬</p>
      <p className="font-black text-neutral-900 text-sm mb-1">Get it in your inbox</p>
      <p className="text-xs text-neutral-500 max-w-xs mx-auto mb-4">
        Subscribe and new issues land in your inbox every two weeks — no spam, unsubscribe any time.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 max-w-xs mx-auto">
        <label htmlFor="newsletter-email" className="sr-only">Email address</label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={submitting}
          className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors bg-white disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-brand-red text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex-shrink-0"
        >
          {submitting ? "Subscribing..." : "Subscribe"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-3" role="alert">{error}</p>
      )}
    </form>
  );
}
