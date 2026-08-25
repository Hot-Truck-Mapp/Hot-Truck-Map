"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { US_STATES } from "@/lib/us-states";
import USAMapSelector from "@/components/map/USAMapSelector";

export default function EventsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const filtered = US_STATES.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q;
  });

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link href="/" className="flex items-center gap-2">
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
              <span className="font-black text-brand-red text-sm">HOT</span>
              <span className="font-black text-white text-sm">TRUCK</span>
            </div>
            <span className="font-black text-brand-orange text-sm leading-none">MAP</span>
          </div>
        </Link>
        <Link href="/" className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-xs font-semibold hover:border-neutral-500 hover:text-white transition-colors">
          Back to Map
        </Link>
      </nav>

      {/* Hero */}
      <div className="bg-neutral-900 px-4 py-8 text-center">
        <p className="text-3xl mb-2">🎪</p>
        <h1 className="text-2xl font-black text-white tracking-wide">Festivals & Events</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Pick a state to see this month&rsquo;s food truck festivals and events by city
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Interactive map */}
        <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-8">
          <USAMapSelector onSelect={(code) => router.push(`/events/${code.toLowerCase()}`)} />
          <p className="text-center text-xs text-neutral-400 mt-2">
            Click a state to see its festivals and events
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round" className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Or search states…"
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white shadow-sm text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
          />
        </div>

        {/* State grid — precise/accessible fallback for the map above */}
        {filtered.length === 0 ? (
          <p className="text-center text-neutral-400 text-sm py-16">No states match &ldquo;{query}&rdquo;</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((s) => (
              <Link
                key={s.code}
                href={`/events/${s.code.toLowerCase()}`}
                className="bg-white rounded-2xl shadow-sm px-4 py-4 text-center hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <p className="text-sm font-bold text-neutral-800">{s.name}</p>
                <p className="text-xs text-neutral-400 font-semibold mt-0.5">{s.code}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* SEO footer */}
      <div className="px-4 py-8 text-center">
        <p className="text-xs text-neutral-400">
          HotTruckMap — Food truck festivals and events across all 50 states, updated monthly.
        </p>
      </div>
    </div>
  );
}
