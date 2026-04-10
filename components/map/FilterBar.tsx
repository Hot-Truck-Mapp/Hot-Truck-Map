"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type MapFilters = {
  openNow: boolean;
  cuisine: string | null;
  dietary: string[];
  maxDistance: number;
};

type FilterBarProps = {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  resultCount: number;
};

const CUISINES = [
  "All", "Tacos", "BBQ", "Burgers", "Asian", "Desserts",
  "Pizza", "Sandwiches", "Healthy", "Breakfast",
];

const DIETARY = ["Vegan", "Gluten-Free", "Halal", "Vegetarian"];

export default function FilterBar({ filters, onChange, resultCount }: FilterBarProps) {
  const [showMore, setShowMore] = useState(false);

  function update(patch: Partial<MapFilters>) {
    onChange({ ...filters, ...patch });
  }

  function toggleDietary(tag: string) {
    const next = filters.dietary.includes(tag)
      ? filters.dietary.filter((d) => d !== tag)
      : [...filters.dietary, tag];
    update({ dietary: next });
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-white border-b border-neutral-100 shadow-sm">

      {/* Row 1 — Open Now toggle + result count */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => update({ openNow: !filters.openNow })}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            filters.openNow
              ? "bg-brand-red text-white shadow-sm"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          )}
        >
          {filters.openNow && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400" />
            </span>
          )}
          🕐 Open Now
        </button>

        <button
          onClick={() => setShowMore(!showMore)}
          className="text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
        >
          {showMore ? "Fewer filters ↑" : "More filters ↓"}
        </button>

        <span className="text-sm text-neutral-400 ml-auto">
          {resultCount} truck{resultCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Row 2 — Cuisine pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CUISINES.map((c) => (
          <button
            key={c}
            onClick={() => update({ cuisine: c === "All" ? null : c })}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              (c === "All" && !filters.cuisine) || filters.cuisine === c
                ? "bg-brand-red text-white"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Row 3 — Dietary tags + distance */}
      {showMore && (
        <div className="flex flex-col gap-3 pt-1 border-t border-neutral-100">

          <div className="flex flex-wrap gap-2">
            {DIETARY.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleDietary(tag)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                  filters.dietary.includes(tag)
                    ? "bg-red-50 border-brand-red text-brand-red"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                )}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500 w-24 flex-shrink-0">
              Within {filters.maxDistance} mi
            </span>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.5}
              value={filters.maxDistance}
              onChange={(e) => update({ maxDistance: Number(e.target.value) })}
              className="flex-1 accent-brand-red"
            />
          </div>

        </div>
      )}
    </div>
  );
}