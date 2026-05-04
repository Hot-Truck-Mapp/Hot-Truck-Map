import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catering | Hot Truck Map",
  description: "Book a food truck for your next event. Browse catering packages from local food trucks.",
};

export default function CateringPage() {
  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center px-6 text-center pb-16">
      <div className="w-20 h-20 bg-brand-red rounded-2xl flex items-center justify-center mb-6">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M1 3h15v13H1z"/>
          <path d="M16 8h4l3 3v5h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      </div>

      <h1 className="text-4xl font-black text-white mb-3">
        Catering
        <span className="text-brand-red"> Coming Soon</span>
      </h1>
      <p className="text-neutral-400 max-w-sm mb-8 leading-relaxed">
        Book food trucks for your events directly through Hot Truck Map.
        Browse menus, get quotes, and confirm your booking — all in one place.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="px-6 py-3 bg-brand-red text-white rounded-full font-black text-sm hover:bg-red-600 transition-colors"
        >
          Browse Trucks
        </Link>
        <Link
          href="/signup?role=operator"
          className="px-6 py-3 border border-neutral-600 text-neutral-300 rounded-full font-bold text-sm hover:border-neutral-400 hover:text-white transition-colors"
        >
          List My Truck
        </Link>
      </div>
    </div>
  );
}
