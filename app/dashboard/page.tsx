"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const MapboxMap = dynamic(() => import("@/components/map/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-neutral-100 animate-pulse flex items-center justify-center">
      <div className="text-center">
        <p className="text-neutral-400 text-sm">Loading map...</p>
      </div>
    </div>
  ),
});

const CUISINES = [
  "All", "Tacos", "BBQ", "Burgers", "Asian",
  "Desserts", "Pizza", "Sandwiches", "Healthy", "Breakfast",
];

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openNow, setOpenNow] = useState(true);
  const [cuisine, setCuisine] = useState("All");
  const [trucks] = useState<any[]>([]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Top Bar */}
      <div className="bg-white z-10 shadow-sm">

        {/* Logo + Search */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">

          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="font-bold text-neutral-800 text-lg hidden sm:block">
              HotTruckMap
            </span>
          </div>

          {/* Search */}
          <div className="flex-1 relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Search trucks or cuisine..."
              className="w-full px-4 py-2.5 rounded-full bg-neutral-100 text-sm focus:outline-none focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 text-lg leading-none"
              >
                x
              </button>
            )}
          </div>

          {/* Sign In */}
          <Link
            href="/login"
            className="flex-shrink-0 px-3 py-2 rounded-full bg-brand-red text-white text-xs font-semibold"
          >
            Sign In
          </Link>
        </div>

        {/* Open Now + Cuisine Filters */}
        <div className="flex flex-col gap-2 px-3 pb-3">

          {/* Row 1 - Open Now */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOpenNow(!openNow)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                openNow
                  ? "bg-brand-red text-white"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              {openNow && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-200" />
                </span>
              )}
              Open Now
            </button>
            <span className="text-sm text-neutral-400">
              {trucks.length} truck{trucks.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Row 2 - Cuisine Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CUISINES.map((c) => (
              <button
                key={c}
                onClick={() => setCuisine(c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  cuisine === c
                    ? "bg-brand-red text-white"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapboxMap trucks={trucks} />

        {/* Empty State */}
        {trucks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-3xl shadow-xl p-6 max-w-xs text-center pointer-events-auto mx-4">
              <p className="font-bold text-neutral-800 mb-1">
                {search
                  ? "No trucks match your search"
                  : "No trucks open right now"}
              </p>
              <p className="text-sm text-neutral-400 mb-4">
                {search
                  ? "Try a different search or clear filters"
                  : "Check back at lunch or turn off Open Now"}
              </p>
              <div className="flex flex-col gap-2">
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="px-4 py-2.5 bg-brand-red text-white rounded-full text-sm font-semibold"
                  >
                    Clear Search
                  </button>
                )}
                {openNow && (
                  <button
                    onClick={() => setOpenNow(false)}
                    className="px-4 py-2.5 border-2 border-neutral-200 text-neutral-600 rounded-full text-sm font-semibold"
                  >
                    Show All Trucks
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live Count Pill */}
        {trucks.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
              </span>
              <p className="text-sm font-semibold text-neutral-800">
                {trucks.length} truck{trucks.length !== 1 ? "s" : ""} live near you
              </p>
            </div>
          </div>
        )}

        {/* List View */}
        <div className="absolute bottom-6 right-4">
          <Link
            href="/trucks"
            className="bg-white rounded-full shadow-lg px-4 py-2 text-sm font-semibold text-neutral-700 flex items-center gap-2"
          >
            <span>☰</span>
            <span>List</span>
          </Link>
        </div>

      </div>
    </div>
  );
}