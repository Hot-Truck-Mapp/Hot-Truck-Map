"use client";

import { use, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function ConfirmationContent({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const rawName = searchParams.get("name") ?? "there";
  const name = (() => { try { return decodeURIComponent(rawName); } catch { return rawName; } })();

  // Read orderId from sessionStorage (written by the order page after successful submission)
  // Fall back gracefully if sessionStorage is unavailable or stale
  const [orderId, setOrderId] = useState<string>("");
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("confirmed-order");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate it belongs to this truck
        if (parsed.truckId === id && typeof parsed.orderId === "string") {
          setOrderId(parsed.orderId);
          // Clear after reading so the confirmation can't be replayed
          sessionStorage.removeItem("confirmed-order");
        }
      }
    } catch { /* sessionStorage unavailable — orderId stays empty */ }
  }, [id]);

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-6 pb-16">
      {/* Success icon */}
      <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1 className="text-3xl font-black text-neutral-900 text-center mb-2">Order Sent!</h1>
      <p className="text-neutral-500 text-center mb-1">
        Hey <span className="font-bold text-neutral-700">{name}</span>, your order is on its way to the truck.
      </p>
      {orderId && (
        <p className="text-xs text-neutral-400 mb-8">
          Order #{orderId.slice(0, 8).toUpperCase()}
        </p>
      )}
      {!orderId && (
        <p className="text-xs text-amber-600 mb-8 text-center">
          If you just placed an order, check the Orders page to track its status.
        </p>
      )}

      {/* What happens next */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-5 mb-6">
        <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-4">What happens next</p>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="text-base">🔔</span>
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-800">Truck receives your order</p>
              <p className="text-xs text-neutral-400">They&rsquo;ll start preparing it right away</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-base">👀</span>
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-800">Track your status</p>
              <p className="text-xs text-neutral-400">Check the Orders tab for live updates</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <span className="text-base">💰</span>
            </div>
            <div>
              <p className="text-sm font-bold text-neutral-800">Pay at the truck</p>
              <p className="text-xs text-neutral-400">Cash or credit card when you pick up</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        <Link
          href="/"
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base text-center tracking-wide"
          style={{ boxShadow: "0 6px 20px rgba(232,72,28,0.30)" }}
        >
          Back to Map
        </Link>
        <Link
          href={`/truck/${id}`}
          className="w-full py-4 bg-neutral-100 text-neutral-700 rounded-2xl font-bold text-base text-center"
        >
          Back to Truck
        </Link>
      </div>
    </div>
  );
}

export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50 flex items-center justify-center"><div className="w-8 h-8 rounded-full border-[3px] border-brand-red border-t-transparent animate-spin" /></div>}>
      <ConfirmationContent id={id} />
    </Suspense>
  );
}
