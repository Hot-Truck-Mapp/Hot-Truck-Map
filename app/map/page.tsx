"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import FilterBar, { type MapFilters } from "@/components/map/FilterBar";
import { DEFAULT_FILTERS, useLiveTrucks } from "@/lib/hooks/useLiveTrucks";

const MapboxMap = dynamic(() => import("@/components/map/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-neutral-100 animate-pulse flex items-center justify-center">
      <p className="text-neutral-400 text-sm">Loading map...</p>
    </div>
  ),
});

export default function MapPage() {
  const [filters, setFilters] = useState<MapFilters>(DEFAULT_FILTERS);
  const { trucks, loading } = useLiveTrucks(filters);

  return (
    <div className="flex flex-col h-screen">

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        resultCount={trucks.length}
      />

      {/* Map */}
      <div className="flex-1 relative">
        <MapboxMap trucks={trucks} />

        {/* Empty state */}
        {!loading && trucks.length === 0 && filters.openNow && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-2xl shadow-lg p-6 max-w-xs text-center pointer-events-auto">
              <p className="text-2xl mb-2">🚚</p>
              <p className="font-semibold text-neutral-800 mb-1">
                No trucks open right now
              </p>
              <p className="text-sm text-neutral-500 mb-4">
                Check back at lunch, or turn off "Open Now" to see all trucks.
              </p>
              <button
                onClick={() => setFilters({ ...filters, openNow: false })}
                className="px-4 py-2 bg-brand-red text-white rounded-full text-sm font-semibold"
              >
                Show all trucks
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}