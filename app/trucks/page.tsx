"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const CUISINES = [
  "All", "Tacos", "BBQ", "Burgers", "Asian Fusion",
  "Desserts", "Pizza", "Sandwiches", "Healthy", "Breakfast", "Seafood",
];

const DIETARY = ["Vegan", "Gluten-Free", "Halal", "Vegetarian"];

export default function TrucksListPage() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openNow, setOpenNow] = useState(true);
  const [cuisine, setCuisine] = useState("All");
  const [dietary, setDietary] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadTrucks();
  }, []);

  async function loadTrucks() {
    const supabase = createClient();
    const { data } = await supabase
      .from("trucks")
      .select("*, locations(*), follows(count)")
      .order("is_live", { ascending: false });
    setTrucks(data ?? []);
    setLoading(false);
  }

  const filtered = trucks.filter((t) => {
    if (openNow && !t.is_live) return false;
    if (cuisine !== "All" && t.cuisine !== cuisine) return false;
    if (
      search.trim() !== "" &&
      !t.name?.toLowerCase().includes(search.toLowerCase()) &&
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

  const activeFilterCount = dietary.length + (cuisine !== "All" ? 1 : 0) + (openNow ? 1 : 0);

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
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
            <span className="font-black text-brand-orange text-sm leading-none">MAPS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-xs font-semibold hover:border-neutral-500 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            </svg>
            Map View
          </Link>
          <Link
            href="/account"
            className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Search + Filter Bar */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-3 sticky top-14 z-10">
        <div
          className="bg-white rounded-2xl"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)" }}
        >

          {/* Search input */}
          <div className="flex items-center gap-0 px-4 py-1">
            <svg
              className="text-neutral-400 flex-shrink-0"
              width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or cuisine..."
              className="flex-1 px-3 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none bg-transparent"
            />
            {search ? (
              <button
                onClick={() => setSearch("")}
                className="w-6 h-6 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center flex-shrink-0 transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
                  showFilters || activeFilterCount > 0
                    ? "bg-brand-red text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>
                </svg>
                {activeFilterCount > 0 ? activeFilterCount + " Active" : "Filter"}
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-neutral-100 mx-4" />

          {/* Quick pills */}
          <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setOpenNow(!openNow)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all ${
                openNow
                  ? "bg-brand-red text-white shadow-sm"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {openNow ? (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                </span>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
              )}
              Open Now
            </button>

            {CUISINES.filter((c) => c !== "All").slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => setCuisine(cuisine === c ? "All" : c)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  cuisine === c
                    ? "bg-neutral-900 text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="border-t border-neutral-100 px-4 py-3 flex flex-col gap-3">
              <div>
                <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Cuisine</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {CUISINES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCuisine(c)}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        cuisine === c
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Dietary</p>
                <div className="flex flex-wrap gap-2">
                  {DIETARY.map((d) => (
                    <button
                      key={d}
                      onClick={() => toggleDietary(d)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        dietary.includes(d)
                          ? "bg-brand-red text-white"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setDietary([]); setCuisine("All"); setOpenNow(false); }}
                  className="text-xs text-brand-red font-bold text-left hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results Header */}
      <div className="px-4 py-3 bg-white border-b border-neutral-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm text-neutral-600">
            <span className="font-bold text-neutral-900">{filtered.length}</span>
            {" "}food truck{filtered.length !== 1 ? "s" : ""} found
            {openNow && " · open now"}
            {cuisine !== "All" && " · " + cuisine}
          </p>
        </div>
      </div>

      {/* Truck List */}
      <div className="max-w-5xl mx-auto w-full px-0 md:px-4 md:py-4">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              <p className="text-neutral-400 text-sm">Loading trucks...</p>
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="w-14 h-14 bg-neutral-200 rounded-2xl flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <p className="font-bold text-neutral-800 mb-1">No trucks found</p>
            <p className="text-sm text-neutral-400 mb-4">
              {openNow ? "Turn off Open Now to see all trucks" : "Try a different search or clear filters"}
            </p>
            <button
              onClick={() => { setSearch(""); setCuisine("All"); setDietary([]); setOpenNow(false); }}
              className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold"
            >
              Clear Filters
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 md:gap-3">
        {filtered.map((truck) => {
          const followerCount = truck.follows?.[0]?.count ?? 0;
          const address = truck.locations?.[0]?.address ?? null;
          return (
            <Link
              key={truck.id}
              href={"/truck/" + truck.id}
              className="block bg-white border-b border-neutral-100 md:border md:rounded-2xl md:shadow-sm hover:bg-neutral-50 active:bg-neutral-100 transition-colors md:overflow-hidden"
            >
              <div className="flex gap-4 p-4">

                {/* Photo */}
                <div className="w-[88px] h-[88px] rounded-2xl bg-neutral-100 flex-shrink-0 overflow-hidden shadow-sm">
                  {truck.profile_photo ? (
                    <img
                      src={truck.profile_photo}
                      alt={truck.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-100">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 3h15v13H1z"/>
                        <path d="M16 8h4l3 3v5h-7V8z"/>
                        <circle cx="5.5" cy="18.5" r="2.5"/>
                        <circle cx="18.5" cy="18.5" r="2.5"/>
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5">

                  {/* Name row */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-black text-neutral-900 text-sm uppercase tracking-wide leading-tight">
                      {truck.name}
                    </h3>
                    {truck.is_live && (
                      <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-black px-2 py-1 bg-brand-red text-white rounded-lg tracking-wider">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                        </span>
                        OPEN
                      </span>
                    )}
                  </div>

                  {/* Cuisine */}
                  <p className="text-xs font-bold text-brand-red mb-1.5">
                    {truck.cuisine ?? "Food Truck"}
                  </p>

                  {/* Description */}
                  {truck.description && (
                    <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed mb-2">
                      {truck.description}
                    </p>
                  )}

                  {/* Footer row — location + followers */}
                  <div className="flex items-center justify-between gap-2">
                    {address ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span className="text-xs text-neutral-400 truncate">{address}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-neutral-300">No location set</span>
                    )}

                    {followerCount > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                        </svg>
                        <span className="text-xs text-neutral-400">{followerCount}</span>
                      </div>
                    )}
                  </div>

                  {/* Instagram + Phone — if operator filled them in */}
                  {(truck.instagram || truck.phone) && (
                    <div className="flex items-center gap-3 mt-1.5">
                      {truck.instagram && (
                        <span className="text-[11px] text-neutral-400">@{truck.instagram}</span>
                      )}
                      {truck.phone && (
                        <span className="text-[11px] text-neutral-400">{truck.phone}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        </div> {/* end grid */}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
