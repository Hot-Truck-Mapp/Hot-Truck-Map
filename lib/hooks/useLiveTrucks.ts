"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLive } from "@/lib/utils";
import type { Truck, Location } from "@/lib/types";
import type { MapFilters } from "@/components/map/FilterBar";

export type TruckWithLocation = Truck & {
  location: Location | null;
};

export const DEFAULT_FILTERS: MapFilters = {
  openNow: true,
  cuisine: null,
  dietary: [],
  maxDistance: 5,
};

export function useLiveTrucks(filters: MapFilters) {
  const [trucks, setTrucks] = useState<TruckWithLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchTrucks() {
      const { data, error } = await supabase
        .from("trucks")
        .select(`
          *,
          location:locations(
            id, lat, lng, address, broadcasted_at
          )
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTrucks(
          data.map((t: any) => ({
            ...t,
            location: t.location?.[0] ?? null,
          }))
        );
      }
      setLoading(false);
    }

    fetchTrucks();

    const channel = supabase
      .channel("locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations" },
        () => fetchTrucks()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = trucks.filter((truck) => {
    if (filters.openNow && !isLive(truck.location?.broadcasted_at ?? null)) {
      return false;
    }
    if (filters.cuisine && truck.cuisine !== filters.cuisine) {
      return false;
    }
    if (filters.dietary.length > 0) {
      const truckTags = (truck as any).dietary_tags ?? [];
      const hasAll = filters.dietary.every((tag) => truckTags.includes(tag));
      if (!hasAll) return false;
    }
    return true;
  });

  return { trucks: filtered, allTrucks: trucks, loading };
}