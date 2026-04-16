"use client";

import { useSearchParams } from "next/navigation";
import { use, Suspense } from "react";
import Link from "next/link";

function ConfirmationContent({ id }: { id: string }) {
  const params = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const name = params.get("name") ?? "there";
  const shortId = orderId.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">

      {/* Top accent bar */}
      <div className="h-1.5 bg-brand-red w-full" />

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 max-w-sm mx-auto w-full">

        {/* Success icon */}
        <div
          className="w-20 h-20 bg-brand-red rounded-full flex items-center justify-center mb-5"
          style={{ boxShadow: "0 10px 36px rgba(232,72,28,0.30)" }}
        >
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>

        <h1 className="text-3xl font-black text-neutral-900 text-center mb-1">Order Sent!</h1>
        <p className="text-neutral-500 text-sm text-center mb-6">
          Hey <span className="font-semibold text-neutral-700">{name}</span> — the truck has received your order.
        </p>

        {/* Order ID card */}
        <div className="w-full bg-white rounded-2xl shadow-sm p-5 mb-4 text-center border border-neutral-100">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-2">Your Order ID</p>
          <p className="text-3xl font-black text-neutral-900 tracking-widest">#{shortId}</p>
          <p className="text-xs text-neutral-400 mt-2">Show this to the operator when your order is called</p>
        </div>

        {/* Payment due card */}
        <div className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 bg-amber-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <path d="M2 10h20"/>
              </svg>
            </div>
            <p className="text-sm font-black text-amber-800">Payment Due at Pickup</p>
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            No payment was taken online. Please bring{" "}
            <span className="font-bold">cash or credit card</span> to pay when
            you collect your order at the truck.
          </p>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-amber-200">
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <path d="M2 10h20"/>
              </svg>
              <span className="text-xs font-bold text-amber-800">Credit Card</span>
            </div>
            <div className="w-px h-4 bg-amber-200" />
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              <span className="text-xs font-bold text-amber-800">Cash</span>
            </div>
          </div>
        </div>

        {/* What's next */}
        <div className="w-full bg-white rounded-2xl shadow-sm p-5 mb-6 border border-neutral-100">
          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-4">What Happens Next</p>
          <div className="flex flex-col gap-4">
            {[
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M1 3h15v13H1z"/>
                    <path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                ),
                text: "The truck is preparing your order now",
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                ),
                text: "Head over to the truck's location",
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <path d="M2 10h20"/>
                  </svg>
                ),
                text: `Give your name "${name}" and pay with cash or card`,
              },
            ].map(({ icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0 mt-0.5">
                  {icon}
                </div>
                <p className="text-sm text-neutral-700 font-medium leading-snug pt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 w-full">
          <Link
            href={`/truck/${id}`}
            className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base text-center"
            style={{ boxShadow: "0 6px 20px rgba(232,72,28,0.28)" }}
          >
            Back to Truck
          </Link>
          <Link
            href="/"
            className="w-full py-4 bg-white text-neutral-600 rounded-2xl font-bold text-base text-center border border-neutral-200"
          >
            Find More Trucks
          </Link>
        </div>

      </div>
    </div>
  );
}

export default function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Loading...</p>
        </div>
      </div>
    }>
      <ConfirmationContent id={id} />
    </Suspense>
  );
}
