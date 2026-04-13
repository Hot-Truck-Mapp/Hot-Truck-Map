"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MapboxMap = dynamic(() => import("@/components/map/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
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
  const [showList, setShowList] = useState(false);
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
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-900">

      {/* Full-screen map */}
      <div className="absolute inset-0">
        <MapboxMap trucks={filtered} />
      </div>

      {/* Top bar — floats over the map */}
      <div className="absolute top-0 left-0 right-0 z-20">

        {/* Navbar */}
        <div className="bg-neutral-900/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
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
                <span className="font-black text-brand-red text-sm tracking-tight">HOT</span>
                <span className="font-black text-white text-sm tracking-tight">TRUCK</span>
              </div>
              <span className="font-black text-brand-orange text-sm tracking-tight leading-none">MAPS</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/signup?role=operator"
              className="hidden sm:block px-3 py-1.5 rounded-lg border border-brand-red text-brand-red font-bold text-xs hover:bg-brand-red hover:text-white transition-colors"
            >
              List My Truck
            </Link>
            <Link
              href="/account"
              className="w-8 h-8 rounded-full border border-neutral-600 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* Search card — floats over the map */}
        <div className="px-3 md:px-4 pt-2 pb-1">
          <div
            className="bg-white rounded-2xl overflow-visible"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)" }}
          >

            {/* Search input row */}
            <div className="flex items-center gap-0 px-4 py-1">
              {/* Search icon */}
              <svg
                className="text-neutral-400 flex-shrink-0"
                width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>

              {/* Input */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search by name or cuisine..."
                suppressHydrationWarning
                className="flex-1 px-3 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none bg-transparent"
              />

              {/* Clear button */}
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
                /* Filter button */
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
                    showFilter || activeFilterCount > 0
                      ? "bg-brand-red text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>
                  </svg>
                  {activeFilterCount > 0 ? activeFilterCount + " Filter" + (activeFilterCount > 1 ? "s" : "") : "Filter"}
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100 mx-4" />

            {/* Quick filter pills */}
            <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
              {/* Open Now pill */}
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

              {/* Cuisine pills */}
              {CUISINES.filter((c) => c !== "All").map((c) => (
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

            {/* Expanded dietary filters */}
            {showFilter && (
              <div className="border-t border-neutral-100 px-4 py-3 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Dietary</p>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDietary(d)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          dietary.includes(d)
                            ? "bg-brand-red text-white shadow-sm"
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
                    onClick={() => { setDietary([]); setCuisine("All"); }}
                    className="text-xs text-brand-red font-bold text-left hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Search dropdown results */}
            {searchFocused && search && (
              <div className="border-t border-neutral-100 overflow-hidden rounded-b-2xl">
                {filtered.length === 0 ? (
                  <div className="px-4 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>
                    <p className="text-sm text-neutral-400">No trucks found for "<span className="text-neutral-600 font-medium">{search}</span>"</p>
                  </div>
                ) : (
                  filtered.slice(0, 5).map((truck, i) => (
                    <Link
                      key={truck.id}
                      href={"/truck/" + truck.id}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors ${
                        i < Math.min(filtered.length, 5) - 1 ? "border-b border-neutral-50" : ""
                      }`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 overflow-hidden flex-shrink-0">
                        {truck.profile_photo ? (
                          <img src={truck.profile_photo} alt={truck.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round">
                              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-800 truncate">{truck.name}</p>
                        <p className="text-xs text-neutral-400">{truck.cuisine ?? "Food Truck"}</p>
                      </div>
                      {truck.is_live && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
                          </span>
                          <span className="text-[10px] font-bold text-brand-red">OPEN</span>
                        </div>
                      )}
                    </Link>
                  ))
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Live count pill — floats over map */}
      {!showList && filtered.some((t) => t.is_live) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
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

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white border-t border-neutral-200 flex">
        <button
          onClick={() => setShowList(false)}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            !showList ? "text-brand-red" : "text-neutral-400"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={!showList ? 2.5 : 2} strokeLinecap="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          </svg>
          <span className="text-[10px] font-bold tracking-wide">MAP</span>
        </button>

        <button
          onClick={() => setShowList(true)}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            showList ? "text-brand-red" : "text-neutral-400"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={showList ? 2.5 : 2} strokeLinecap="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
          <span className="text-[10px] font-bold tracking-wide">TRUCKS</span>
          {filtered.length > 0 && (
            <span className={`text-[9px] font-bold ${showList ? "text-brand-red" : "text-neutral-400"}`}>
              {filtered.length}
            </span>
          )}
        </button>
      </div>

      {/* Truck List — bottom sheet (mobile) / side panel (tablet+) */}
      {showList && (
        <div className="absolute inset-0 bottom-16 z-20">
          {/* Tap backdrop to close (mobile only) */}
          <div
            className="absolute inset-0 md:hidden"
            onClick={() => setShowList(false)}
          />

          {/* Mobile: bottom sheet */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden flex flex-col" style={{ maxHeight: "75vh" }}>

            {/* Sheet handle + header */}
            <div className="flex-shrink-0 pt-3 pb-2 px-4 border-b border-neutral-100">
              <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-neutral-800">
                  {filtered.length} food truck{filtered.length !== 1 ? "s" : ""}
                  {openNow ? " open now" : ""}
                  {cuisine !== "All" ? ` · ${cuisine}` : ""}
                </p>
                <button
                  onClick={() => setShowList(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <p className="text-neutral-400 text-sm">Loading trucks...</p>
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 3h15v13H1z"/>
                      <path d="M16 8h4l3 3v5h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <p className="font-semibold text-neutral-700 mb-1">No trucks found</p>
                  <p className="text-sm text-neutral-400">
                    {openNow ? "Turn off Open Now to see all trucks" : "Try clearing your filters"}
                  </p>
                  {openNow && (
                    <button
                      onClick={() => setOpenNow(false)}
                      className="mt-3 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold"
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
                  className="flex gap-3 px-4 py-3 border-b border-neutral-100 active:bg-neutral-50 transition-colors"
                >
                  {/* Photo */}
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                    {truck.profile_photo ? (
                      <img src={truck.profile_photo} alt={truck.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
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
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-neutral-900 text-sm uppercase tracking-wide leading-tight">
                        {truck.name}
                      </p>
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
                    <p className="text-xs text-brand-red font-semibold mt-0.5">
                      {truck.cuisine ?? "Food Truck"}
                    </p>
                    {truck.locations?.[0]?.address && (
                      <div className="flex items-center gap-1 mt-1">
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

              <div className="h-6" />
            </div>
          </div>

          {/* Tablet/Desktop: side panel */}
          <div className="hidden md:flex absolute top-0 left-0 bottom-0 w-80 lg:w-96 bg-white shadow-2xl flex-col z-10">
            {/* Panel header */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-800">
                {filtered.length} truck{filtered.length !== 1 ? "s" : ""}
                {openNow ? " open now" : ""}
                {cuisine !== "All" ? ` · ${cuisine}` : ""}
              </p>
              <button
                onClick={() => setShowList(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <p className="text-neutral-400 text-sm">Loading trucks...</p>
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mb-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 3h15v13H1z"/>
                      <path d="M16 8h4l3 3v5h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <p className="font-semibold text-neutral-700 mb-1">No trucks found</p>
                  <p className="text-sm text-neutral-400">
                    {openNow ? "Turn off Open Now to see all trucks" : "Try clearing your filters"}
                  </p>
                  {openNow && (
                    <button
                      onClick={() => setOpenNow(false)}
                      className="mt-3 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold"
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
                  className="flex gap-3 px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                    {truck.profile_photo ? (
                      <img src={truck.profile_photo} alt={truck.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 3h15v13H1z"/>
                          <path d="M16 8h4l3 3v5h-7V8z"/>
                          <circle cx="5.5" cy="18.5" r="2.5"/>
                          <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-neutral-900 text-sm uppercase tracking-wide leading-tight">{truck.name}</p>
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
                    <p className="text-xs text-brand-red font-semibold mt-0.5">{truck.cuisine ?? "Food Truck"}</p>
                    {truck.locations?.[0]?.address && (
                      <p className="text-xs text-neutral-400 mt-0.5 truncate">{truck.locations[0].address}</p>
                    )}
                  </div>
                </Link>
              ))}
              <div className="h-4" />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
