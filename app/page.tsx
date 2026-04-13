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
  "All", "Tacos", "BBQ", "Burgers", "Asian Fusion",
  "Desserts", "Pizza", "Sandwiches", "Healthy", "Breakfast", "Seafood",
];

const DIETARY = ["Vegan", "Gluten-Free", "Halal", "Vegetarian"];

export default function HomePage() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openNow, setOpenNow] = useState(true);
  const [cuisine, setCuisine] = useState("All");
  const [dietary, setDietary] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [distance, setDistance] = useState(5);
  const [view, setView] = useState<"map" | "list">("map");
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

  const activeFilterCount = dietary.length + (cuisine !== "All" ? 1 : 0);

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-neutral-900">

      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1">
              <span className="font-black text-brand-red text-base tracking-tight">HOT</span>
              <span className="font-black text-white text-base tracking-tight">TRUCK</span>
            </div>
            <span className="font-black text-brand-orange text-base tracking-tight leading-none">MAPS</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden sm:block px-3 py-1.5 rounded-lg border border-brand-red text-brand-red font-bold text-xs hover:bg-brand-red hover:text-white transition-colors"
          >
            For Operators
          </Link>
          <Link
            href="/account"
            className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Search + Filter Bar */}
      <div className="bg-white flex-shrink-0 shadow-sm">

        {/* Search row */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
              width="15" height="15" viewBox="0 0 24 24" fill="none"
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
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-neutral-50 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}

            {/* Search dropdown */}
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
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 overflow-hidden flex-shrink-0">
                        {truck.profile_photo ? (
                          <img src={truck.profile_photo} alt={truck.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{truck.name}</p>
                        <p className="text-xs text-neutral-400">{truck.cuisine}</p>
                      </div>
                      {truck.is_live && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-brand-red rounded-md flex-shrink-0">LIVE</span>
                      )}
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Map / List toggle */}
          <div className="flex bg-neutral-100 rounded-xl p-0.5 flex-shrink-0">
            <button
              onClick={() => setView("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                view === "map"
                  ? "bg-white text-neutral-800 shadow-sm"
                  : "text-neutral-500"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
              </svg>
              Map
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                view === "list"
                  ? "bg-white text-neutral-800 shadow-sm"
                  : "text-neutral-500"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
              List
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setOpenNow(!openNow)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide transition-colors ${
              openNow ? "bg-brand-red text-white" : "border border-neutral-200 text-neutral-600 bg-white"
            }`}
          >
            {openNow && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
              </span>
            )}
            OPEN NOW
          </button>

          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold bg-white transition-colors ${
              showFilter ? "border-brand-red text-brand-red" : "border-neutral-200 text-neutral-600"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-brand-red text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Cuisine quick pills */}
          {CUISINES.filter((c) => c !== "All").map((c) => (
            <button
              key={c}
              onClick={() => setCuisine(cuisine === c ? "All" : c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-bold bg-white transition-colors ${
                cuisine === c
                  ? "bg-brand-red text-white border-brand-red"
                  : "border-neutral-200 text-neutral-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Expanded filters panel */}
        {showFilter && (
          <div className="border-t border-neutral-100 px-3 py-3 flex flex-col gap-3">
            <div>
              <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">Dietary</p>
              <div className="flex flex-wrap gap-2">
                {DIETARY.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleDietary(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      dietary.includes(d)
                        ? "bg-brand-red text-white border-brand-red"
                        : "bg-white border-neutral-200 text-neutral-600"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                Distance — Within {distance} mi
              </p>
              <input
                type="range" min={0.5} max={10} step={0.5}
                value={distance}
                onChange={(e) => setDistance(Number(e.target.value))}
                className="w-full accent-brand-red"
                suppressHydrationWarning
              />
            </div>
            {(dietary.length > 0 || cuisine !== "All" || distance !== 5) && (
              <button
                onClick={() => { setDietary([]); setCuisine("All"); setDistance(5); }}
                className="text-xs text-brand-red font-bold text-left"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count strip */}
      <div className="bg-white border-t border-neutral-100 px-4 py-1.5 flex-shrink-0">
        <p className="text-xs text-neutral-500">
          <span className="font-bold text-neutral-700">{filtered.length}</span>
          {" "}truck{filtered.length !== 1 ? "s" : ""} found
        </p>
      </div>

      {/* Content — Map or List */}
      <div className="flex-1 overflow-hidden relative">

        {/* MAP VIEW */}
        <div className={view === "map" ? "absolute inset-0" : "hidden"}>
          <MapboxMap trucks={filtered} />

          {/* Live count pill */}
          {filtered.some((t) => t.is_live) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
                </span>
                <p className="text-sm font-semibold text-neutral-800">
                  {filtered.filter((t) => t.is_live).length} truck{filtered.filter((t) => t.is_live).length !== 1 ? "s" : ""} live near you
                </p>
              </div>
            </div>
          )}
        </div>

        {/* LIST VIEW */}
        {view === "list" && (
          <div className="absolute inset-0 overflow-y-auto bg-neutral-100">
            {loading && (
              <div className="flex items-center justify-center py-24">
                <p className="text-neutral-400 text-sm">Loading trucks...</p>
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
                  {openNow ? "Turn off Open Now to see all trucks" : "Try a different search"}
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

            <div className="max-w-2xl mx-auto">
              {filtered.map((truck) => (
                <Link
                  key={truck.id}
                  href={"/truck/" + truck.id}
                  className="flex gap-4 p-4 bg-white border-b border-neutral-100 active:bg-neutral-50 transition-colors"
                >
                  {/* Photo */}
                  <div className="w-20 h-20 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                    {truck.profile_photo ? (
                      <img
                        src={truck.profile_photo}
                        alt={truck.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 3h15v13H1z"/>
                          <path d="M16 8h4l3 3v5h-7V8z"/>
                          <circle cx="5.5" cy="18.5" r="2.5"/>
                          <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h3 className="font-black text-neutral-900 text-sm uppercase tracking-wide leading-tight">
                        {truck.name}
                      </h3>
                      {truck.is_live && (
                        <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-brand-red text-white rounded tracking-wider">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                          </span>
                          OPEN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-red font-semibold mb-1">
                      {truck.cuisine ?? "Food Truck"}
                    </p>
                    {truck.description && (
                      <p className="text-xs text-neutral-500 line-clamp-2 mb-1.5">
                        {truck.description}
                      </p>
                    )}
                    {truck.locations?.[0]?.address && (
                      <div className="flex items-center gap-1">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span className="text-xs text-neutral-400 truncate">
                          {truck.locations[0].address}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              <div className="h-8" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
