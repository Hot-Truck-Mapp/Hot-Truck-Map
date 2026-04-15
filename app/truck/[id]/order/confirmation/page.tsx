"use client";

import { useSearchParams } from "next/navigation";
import { use, Suspense } from "react";
import Link from "next/link";

function ConfirmationContent({ id }: { id: string }) {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const name = params.get("name") ?? "Customer";
  const shortId = orderId.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center px-6 text-center">

      {/* Success animation */}
      <div className="w-24 h-24 bg-brand-red rounded-full flex items-center justify-center mb-6 shadow-xl"
        style={{ boxShadow: "0 12px 40px rgba(232,72,28,0.35)" }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </div>

      <h1 className="text-3xl font-black text-neutral-900 mb-2">Order Received!</h1>
      <p className="text-neutral-500 text-base mb-8">
        Hey {name}, your order has been sent to the truck.
      </p>

      {/* Order ID card */}
      <div className="bg-white rounded-2xl shadow-sm w-full max-w-xs p-5 mb-8">
        <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Order ID</p>
        <p className="text-2xl font-black text-neutral-900 tracking-widest">#{shortId}</p>
        <p className="text-xs text-neutral-400 mt-2">Show this to the operator when your order is ready</p>
      </div>

      {/* What's next */}
      <div className="bg-white rounded-2xl shadow-sm w-full max-w-xs p-5 mb-8 text-left">
        <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">What's Next</p>
        <div className="flex flex-col gap-3">
          {[
            { step: "1", text: "The truck is preparing your order" },
            { step: "2", text: "Head to the truck's location" },
            { step: "3", text: "Show your Order ID and pay at the truck" },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-black">{step}</span>
              </div>
              <p className="text-sm text-neutral-700 font-medium">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href={`/truck/${id}`}
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base text-center"
          style={{ boxShadow: "0 6px 20px rgba(232,72,28,0.35)" }}
        >
          Back to Truck
        </Link>
        <Link
          href="/trucks"
          className="w-full py-4 bg-white text-neutral-600 rounded-2xl font-bold text-base text-center border border-neutral-200"
        >
          Browse More Trucks
        </Link>
      </div>

    </div>
  );
}

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Loading...</p>
      </div>
    }>
      <ConfirmationContent id={id} />
    </Suspense>
  );
}
