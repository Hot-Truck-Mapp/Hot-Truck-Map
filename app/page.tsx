"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MapboxMap = dynamic(() => import("@/components/map/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-neutral-900 flex items-center justify-center">
      <p className="text-neutral-500 text-sm font-medium">Loading map...</p>
    </div>
  ),
});

const CUISINES = [
  "All", "Tacos", "BBQ", "Burgers", "Asian",
  "Desserts", "Pizza", "Sandwiches", "Healthy", "Breakfast",
];

const DIETARY = ["Vegan", "Gluten-Free", "Halal", "Vegetarian"];

export default function HomePage() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openNow, setOpenNow] = useState(true);
  const [nearby, setNearby] = useState(false);
  const [cuisine, setCuisine] = useState("All");
  const [dietary, setDietary] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [distance, setDistance] = useState(5);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadTrucks();
  }, []);

  async function loadTrucks() {
    const supabase = createClient();
    const { data } = await supabase
      .from("trucks")
      .select("*, locations(*)")
      .order("created_at", { ascending: false });
    setTrucks(data ?? []);
    setLoading(false);
  }

  const filtered = trucks.filter((t) => {
    if (openNow && !t.is_live) return false;
    if (cuisine !== "All" && t.cuisine !== cuisine) return false;
    if (
      search.trim() !== "" &&
      !t.name.toLowerCase().includes(search.toLowerCase()) &&
      !t.cuisine?.toLowerCase().includes(search.toLowerCase())
    ) return false;
    if (dietary.length > 0) {
      const tags = t.dietary_tags ?? [];
      if (!dietary.every((d) => tags.includes(d))) return false;
    }
    return true;
  });

  function toggleDietary(tag: string) {
    setDietary(
      dietary.includes(tag)
        ? dietary.filter((d) => d !== tag)
        : [...dietary, tag]
    );
  }

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-900">

      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex items-center justify-between flex-shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1">
              <span className="font-black text-brand-red text-lg tracking-tight">HOT</span>
              <span className="font-black text-white text-lg tracking-tight">TRUCK</span>
            </div>
            <span className="font-black text-brand-orange text-lg tracking-tight leading-none">MAPS</span>
          </div>
        </div>

        {/* Right Side Nav */}
        <div className="flex items-center gap-2">
          <Link
            href="/catering"
            className="flex-shrink-0 px-3 py-2 rounded-lg border border-neutral-700 text-neutral-300 text-xs font-semibold hover:border-neutral-500 hover:text-white transition-colors"
          >
            Catering
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border-2 border-brand-red text-brand-red font-bold text-xs hover:bg-brand-red hover:text-white transition-colors"
          >
            For Operators
          </Link>
          <Link
            href="/account"
            className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left - Map */}
        <div className="flex-1 relative">
          <MapboxMap trucks={filtered} />

          {/* Map Legend */}
          <div className="absolute top-4 left-4 bg-white rounded-xl shadow-lg p-4 z-10">
            <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-3">
              Map Legend
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-brand-red flex-shrink-0" />
                <span className="text-sm text-neutral-700 font-medium">Open Now</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neutral-400 flex-shrink-0" />
                <span className="text-sm text-neutral-500 font-medium">Closed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Truck List Panel */}
        <div className="w-96 bg-white flex flex-col overflow-hidden flex-shrink-0 border-l border-neutral-200">

          {/* Search + Filters */}
          <div className="p-4 border-b border-neutral-100">

            {/* Search Bar */}
            <div className="relative mb-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search trucks or cuisine..."
                suppressHydrationWarning
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors bg-neutral-50"
              />

              {/* Search Dropdown */}
              {searchFocused && search && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-neutral-100 overflow-hidden z-50">
                  {filtered.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-neutral-400">
                      No trucks found for "{search}"
                    </div>
                  ) : (
                    filtered.slice(0, 5).map((truck) => (
                      <Link
                        key={truck.id}
                        href={"/truck/" + truck.id}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 border-b border-neutral-50 last:border-0"
                      >
                        <div className="w-9 h-9 rounded-lg bg-neutral-100 overflow-hidden flex-shrink-0">
                          {truck.profile_photo ? (
                            <img
                              src={truck.profile_photo}
                              alt={truck.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                                <path d="M1 3h15v13H1z"/>
                                <path d="M16 8h4l3 3v5h-7V8z"/>
                                <circle cx="5.5" cy="18.5" r="2.5"/>
                                <circle cx="18.5" cy="18.5" r="2.5"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-800 truncate">
                            {truck.name}
                          </p>
                          <p className="text-xs text-neutral-400">{truck.cuisine}</p>
                        </div>
                        {truck.is_live && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-brand-red rounded-md">
                            LIVE
                          </span>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Filter Buttons Row 1 */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-600 hover:border-neutral-300 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>
                </svg>
                Filter
                {(dietary.length > 0 || cuisine !== "All") && (
                  <span className="bg-brand-red text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                    {dietary.length + (cuisine !== "All" ? 1 : 0)}
                  </span>
                )}
              </button>
              <button
                onClick={() => setOpenNow(!openNow)}
                className={`px-4 py-2 rounded-lg text-sm font-black tracking-wide transition-colors ${
                  openNow
                    ? "bg-brand-red text-white"
                    : "border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                OPEN NOW
              </button>
              <button
                onClick={() => setNearby(!nearby)}
                className={`px-4 py-2 rounded-lg text-sm font-black tracking-wide transition-colors ${
                  nearby
                    ? "bg-brand-red text-white"
                    : "border border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                NEARBY
              </button>
            </div>

            {/* Expanded Filters */}
            {showFilter && (
              <div className="flex flex-col gap-3 pt-3 border-t border-neutral-100">

                {/* Cuisine Pills */}
                <div>
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                    Cuisine
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {CUISINES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setCuisine(c)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          cuisine === c
                            ? "bg-brand-red text-white border-brand-red"
                            : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dietary */}
                <div>
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                    Dietary
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDietary(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          dietary.includes(d)
                            ? "bg-brand-red text-white border-brand-red"
                            : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Distance */}
                <div>
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                    Distance — Within {distance} mi
                  </p>
                  <input
                    type="range"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={distance}
                    onChange={(e) => setDistance(Number(e.target.value))}
                    className="w-full accent-brand-red"
                    suppressHydrationWarning
                  />
                </div>

                {/* Clear */}
                {(dietary.length > 0 || cuisine !== "All" || distance !== 5) && (
                  <button
                    onClick={() => {
                      setDietary([]);
                      setCuisine("All");
                      setDistance(5);
                    }}
                    className="text-xs text-brand-red font-bold text-left hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-sm text-neutral-600">
              Found{" "}
              <span className="font-bold text-neutral-900">{filtered.length}</span>
              {" "}food truck{filtered.length !== 1 ? "s" : ""} near you
            </p>
          </div>

          {/* Truck Cards */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <p className="text-neutral-400 text-sm">Loading trucks...</p>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center mb-3">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 3h15v13H1z"/>
                    <path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </div>
                <p className="font-bold text-neutral-800 mb-1">No trucks found</p>
                <p className="text-sm text-neutral-400 mb-4">
                  {openNow
                    ? "Turn off Open Now to see all trucks"
                    : "Try a different search"}
                </p>
                {openNow && (
                  <button
                    onClick={() => setOpenNow(false)}
                    className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold"
                  >
                    Show All Trucks
                  </button>
                )}
              </div>
            )}

            {filtered.map((truck) => (
              <Link
                key={truck.id}
                href={"/truck/" + truck.id}
                className="block border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
              >
                {/* Truck Photo */}
                <div className="relative h-44 bg-neutral-200 overflow-hidden">
                  {truck.profile_photo ? (
                    <img
                      src={truck.profile_photo}
                      alt={truck.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 3h15v13H1z"/>
                        <path d="M16 8h4l3 3v5h-7V8z"/>
                        <circle cx="5.5" cy="18.5" r="2.5"/>
                        <circle cx="18.5" cy="18.5" r="2.5"/>
                      </svg>
                    </div>
                  )}
                  {truck.is_live && (
                    <div className="absolute top-3 right-3 bg-brand-red text-white text-[10px] font-black px-2.5 py-1 rounded tracking-widest">
                      OPEN NOW
                    </div>
                  )}
                  {truck.offers_catering && (
                    <div className="absolute top-3 left-3 bg-neutral-900/80 text-white text-[10px] font-black px-2.5 py-1 rounded tracking-widest">
                      CATERING
                    </div>
                  )}
                </div>

                {/* Truck Info */}
                <div className="p-4">
                  <h3 className="font-black text-neutral-900 text-base uppercase tracking-wide mb-0.5">
                    {truck.name}
                  </h3>
                  <p className="text-sm text-neutral-500 mb-2">
                    {truck.cuisine ?? "Food Truck"}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-neutral-500">
                    {/* Rating */}
                    <div className="flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5A623" stroke="#F5A623" strokeWidth="1">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <span className="font-semibold text-neutral-700">
                        {truck.rating ?? "4.5"}
                      </span>
                    </div>

                    {/* Hours */}
                    {truck.open_time && (
                      <div className="flex items-center gap-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 6v6l4 2"/>
                        </svg>
                        <span>{truck.open_time} - {truck.close_time}</span>
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  {truck.locations?.[0]?.address && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span className="text-sm text-neutral-500 line-clamp-1">
                        {truck.locations[0].address}
                      </span>
                    </div>
                  )}

                  {/* Catering CTA */}
                  {truck.offers_catering && (
                    <Link
                      href={"/catering/book/" + truck.id}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 block w-full py-2 border border-brand-red text-brand-red rounded-lg text-xs font-black text-center uppercase tracking-wide hover:bg-brand-red hover:text-white transition-colors"
                    >
                      Book for Catering
                    </Link>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}