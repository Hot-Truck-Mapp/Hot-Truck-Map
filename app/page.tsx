"use client";

import { useState, useEffect, useRef } from "react";
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
  "All",
  "American",
  "Asian Fusion",
  "BBQ",
  "Breakfast & Brunch",
  "Burgers",
  "Caribbean",
  "Chinese",
  "Desserts & Ice Cream",
  "Healthy & Bowls",
  "Indian",
  "Italian",
  "Japanese & Sushi",
  "Mediterranean",
  "Mexican & Tacos",
  "Pizza",
  "Sandwiches & Wraps",
  "Seafood",
  "Soul Food",
  "Thai",
  "Vegan & Plant-Based",
];

export default function HomePage() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openNow, setOpenNow] = useState(true);
  const [cuisine, setCuisine] = useState("All");
  const [panelOpen, setPanelOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !t.name?.toLowerCase().includes(q) &&
        !t.cuisine?.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  function openPanel() {
    setPanelOpen(true);
    // Small delay so the panel is visible before focusing the input
    setTimeout(() => searchRef.current?.focus(), 150);
  }

  if (!mounted) return null;

  return (
    <div className="h-screen w-screen overflow-hidden relative">

      {/* ── Full-screen map ── */}
      <MapboxMap trucks={filtered} />

      {/* ── Top navbar ── */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex items-center justify-between px-4 py-3 pointer-events-auto">

          {/* Logo */}
          <div className="flex items-center gap-2 bg-neutral-900/90 backdrop-blur-sm rounded-xl px-3 py-2">
            <div className="w-7 h-7 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <div className="flex items-center gap-0.5 leading-none">
              <span className="font-black text-brand-red text-sm tracking-tight">HOT</span>
              <span className="font-black text-white text-sm tracking-tight">TRUCK</span>
              <span className="font-black text-brand-orange text-sm tracking-tight ml-0.5">MAPS</span>
            </div>
          </div>

          {/* Right buttons */}
          <div className="flex items-center gap-2">
            <Link
              href="/catering"
              className="bg-neutral-900/90 backdrop-blur-sm text-neutral-300 text-xs font-semibold px-3 py-2 rounded-xl hover:text-white transition-colors"
            >
              Catering
            </Link>
            <Link
              href="/dashboard"
              className="bg-brand-red text-white text-xs font-bold px-3 py-2 rounded-xl"
            >
              For Operators
            </Link>
            <Link
              href="/account"
              className="w-9 h-9 bg-neutral-900/90 backdrop-blur-sm rounded-full flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Live count pill ── */}
      {!loading && trucks.filter((t) => t.is_live).length > 0 && !panelOpen && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-neutral-900/90 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
            </span>
            <p className="text-white text-xs font-bold">
              {trucks.filter((t) => t.is_live).length} truck{trucks.filter((t) => t.is_live).length !== 1 ? "s" : ""} open now
            </p>
          </div>
        </div>
      )}

      {/* ── Bottom drawer ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20">

        {/* Drawer panel — slides up when open */}
        <div
          className={`bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out ${
            panelOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight: "75vh", display: "flex", flexDirection: "column" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 bg-neutral-200 rounded-full" />
          </div>

          {/* Panel header */}
          <div className="px-4 pb-3 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-base font-black text-neutral-900 uppercase tracking-wide">
                Food Trucks
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                {loading ? "Loading..." : filtered.length + " truck" + (filtered.length !== 1 ? "s" : "") + " found"}
              </p>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Search bar */}
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trucks or cuisine..."
                suppressHydrationWarning
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-100 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-red/20 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Filters row */}
          <div className="px-4 pb-3 flex gap-2 flex-shrink-0">
            {/* Open Now toggle */}
            <button
              onClick={() => setOpenNow(!openNow)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 transition-colors ${
                openNow
                  ? "bg-brand-red text-white"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {openNow && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-200" />
                </span>
              )}
              Open Now
            </button>

            {/* Divider */}
            <div className="w-px bg-neutral-200 flex-shrink-0" />

            {/* Cuisine pills — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 flex-1" style={{ scrollbarWidth: "none" }}>
              {CUISINES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCuisine(c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
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

          {/* Truck list — scrollable */}
          <div className="overflow-y-auto flex-1 px-4 pb-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <p className="text-neutral-400 text-sm">Loading trucks...</p>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 3h15v13H1z"/>
                    <path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                </div>
                <p className="text-neutral-600 font-bold text-sm">No trucks found</p>
                <p className="text-neutral-400 text-xs mt-1">
                  {openNow ? "Try turning off Open Now" : "Try a different search"}
                </p>
                {openNow && (
                  <button
                    onClick={() => setOpenNow(false)}
                    className="mt-3 px-4 py-2 bg-brand-red text-white rounded-full text-xs font-bold"
                  >
                    Show All Trucks
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {filtered.map((truck) => (
                <Link
                  key={truck.id}
                  href={"/truck/" + truck.id}
                  className="flex gap-3 bg-neutral-50 rounded-2xl p-3 hover:bg-neutral-100 transition-colors"
                >
                  {/* Photo */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-200">
                    {truck.profile_photo ? (
                      <img
                        src={truck.profile_photo}
                        alt={truck.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
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
                      <p className="font-black text-neutral-900 text-sm uppercase tracking-wide truncate">
                        {truck.name}
                      </p>
                      {truck.is_live && (
                        <span className="text-[10px] font-black px-2 py-0.5 bg-brand-red text-white rounded flex-shrink-0">
                          OPEN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-brand-red font-semibold mt-0.5">
                      {truck.cuisine ?? "Food Truck"}
                    </p>
                    {truck.locations?.[0]?.address && (
                      <div className="flex items-center gap-1 mt-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <p className="text-xs text-neutral-400 truncate">
                          {truck.locations[0].address}
                        </p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Floating tab (visible when panel is closed) ── */}
        {!panelOpen && (
          <div className="flex justify-center pb-6">
            <button
              onClick={openPanel}
              className="flex items-center gap-2.5 bg-neutral-900/95 backdrop-blur-sm text-white pl-4 pr-5 py-3 rounded-full shadow-xl hover:bg-neutral-800 transition-colors"
            >
              <span className="relative flex h-2 w-2 flex-shrink-0">
                {trucks.filter((t) => t.is_live).length > 0 && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  trucks.filter((t) => t.is_live).length > 0 ? "bg-brand-red" : "bg-neutral-600"
                }`} />
              </span>
              <span className="font-black text-sm uppercase tracking-wide">
                Food Trucks & Cuisine
              </span>
              {!loading && (
                <span className="text-xs text-neutral-400 font-medium">
                  {filtered.length}
                </span>
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-neutral-400">
                <path d="M18 15l-6-6-6 6"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
