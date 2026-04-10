"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
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

  const filtered = trucks.filter((t) =>
    search.trim() === "" ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.cuisine.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/" className="text-neutral-400 text-xl">←</Link>
          <h1 className="text-lg font-bold text-neutral-800">All Trucks</h1>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trucks or cuisine..."
          className="w-full px-4 py-2.5 rounded-full bg-neutral-100 text-sm focus:outline-none"
        />
      </div>

      {/* List */}
      <div className="p-4 flex flex-col gap-3">
        {loading && (
          <div className="text-center py-12">
            <p className="text-neutral-400">Loading trucks...</p>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🚚</p>
            <p className="text-neutral-500 font-medium">No trucks found</p>
          </div>
        )}

        {filtered.map((truck) => (
          <Link
            key={truck.id}
            href={"/truck/" + truck.id}
            className="bg-white rounded-2xl shadow-sm p-4 flex gap-3"
          >
            <div className="w-16 h-16 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
              {truck.profile_photo ? (
                <img
                  src={truck.profile_photo}
                  alt={truck.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">
                  🚚
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-neutral-800 truncate">
                  {truck.name}
                </p>
                {truck.is_live && (
                  <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 bg-red-50 text-brand-red rounded-full">
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-red font-medium mt-0.5">
                {truck.cuisine}
              </p>
              <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                {truck.description}
              </p>
              {truck.locations?.[0] && (
                <p className="text-xs text-neutral-400 mt-1">
                  📍 {truck.locations[0].address}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}