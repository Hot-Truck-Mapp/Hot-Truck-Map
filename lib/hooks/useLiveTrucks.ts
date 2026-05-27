"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const instanceId = useId();
  const [trucks, setTrucks] = useState<TruckWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function fetchTrucks() {
      try {
        const { data, error: queryError } = await supabase
          .from("trucks")
          .select(`
            *,
            location:locations(
              id, lat, lng, address, broadcasted_at
            )
          `)
          .eq("is_live", true)
          .order("created_at", { ascending: false })
          .limit(200);

        if (!mounted) return;
        if (queryError) {
          console.error("useLiveTrucks fetch error:", queryError.message);
          setError(true);
        } else if (data) {
          setError(false);
          setTrucks(
            data.map((t: any) => ({
              ...t,
              location: t.location?.[0] ?? null,
            }))
          );
        }
      } catch (err) {
        console.error("useLiveTrucks network error:", err);
        if (mounted) setError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchTrucks();

    const channel = supabase
      .channel(`live-trucks-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "locations" },
        (payload) => {
          if (!mounted) return;
          const loc = payload.new as any;
          if (!loc?.truck_id) { fetchTrucks(); return; }
          setTrucks((prev) => {
            const idx = prev.findIndex((t) => t.id === loc.truck_id);
            if (idx === -1) return prev;
            const truck = prev[idx];
            if (truck.is_live === false) return prev.filter((t) => t.id !== loc.truck_id);
            const next = [...prev];
            next[idx] = { ...truck, location: loc };
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "locations" },
        (payload) => {
          if (!mounted) return;
          const loc = payload.new as any;
          if (!loc?.truck_id) { fetchTrucks(); return; }
          setTrucks((prev) => {
            const idx = prev.findIndex((t) => t.id === loc.truck_id);
            if (idx === -1) return prev;
            const truck = prev[idx];
            if (truck.is_live === false) return prev.filter((t) => t.id !== loc.truck_id);
            const next = [...prev];
            next[idx] = { ...truck, location: loc };
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trucks" },
        (payload) => {
          if (!mounted) return;
          const updated = payload.new as any;
          if (!updated?.id) { fetchTrucks(); return; }
          setTrucks((prev) => {
            const idx = prev.findIndex((t) => t.id === updated.id);
            if (idx === -1) {
              // Truck just went live — trigger a full fetch to include its location join
              fetchTrucks();
              return prev;
            }
            const next = [...prev];
            next[idx] = { ...next[idx], ...updated };
            // If truck went offline, drop it from the live list
            if (updated.is_live === false) {
              return next.filter((t) => t.id !== updated.id);
            }
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // NOTE: filters.maxDistance is intentionally not applied here because the
  // hook has no access to the user's current coordinates.  Distance filtering
  // should be handled by the caller once it has a geolocation fix.
  const filtered = trucks.filter((truck) => {
    if (filters.openNow && truck.is_live !== true) {
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

  return { trucks: filtered, allTrucks: trucks, loading, error };
}