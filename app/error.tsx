"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 mb-6">
          <span className="font-black text-brand-red text-2xl tracking-tight">HOT</span>
          <span className="font-black text-neutral-800 text-2xl tracking-tight">TRUCK</span>
          <span className="font-black text-brand-orange text-2xl tracking-tight">MAPS</span>
        </div>

        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        <h1 className="text-xl font-black text-neutral-800 mb-2">Something went wrong</h1>
        <p className="text-neutral-400 text-sm">
          Don't worry — the trucks are still out there.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="w-full py-3.5 bg-brand-red text-white rounded-2xl font-bold text-sm"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="w-full py-3.5 border-2 border-neutral-200 text-neutral-600 rounded-2xl font-bold text-sm text-center"
        >
          Back to Map
        </Link>
      </div>
    </div>
  );
}
