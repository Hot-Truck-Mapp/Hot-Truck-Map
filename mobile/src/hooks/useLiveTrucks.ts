import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Truck, Location } from '@shared/types';

export type TruckWithLocation = Truck & { location?: Location };

const LIVE_WINDOW_MS = 30 * 60 * 1000;

export function useLiveTrucks() {
  const [trucks, setTrucks] = useState<TruckWithLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchTrucks = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from('trucks')
        .select('id, name, cuisine, profile_photo, is_live, avg_rating, review_count, locations!inner(id, lat, lng, address, broadcasted_at)')
        .eq('is_live', true)
        .gte('locations.broadcasted_at', cutoff);

      if (error) throw error; // surface DB errors so catch handles them uniformly

      if (data && mountedRef.current) {
        setTrucks(
          data.map(t => ({
            ...t,
            // Supabase returns locations as object (one-to-one) or array — handle both
            location: Array.isArray(t.locations) ? t.locations[0] : (t.locations ?? undefined),
          }))
        );
      }
    } catch {
      // network / DB error — keep showing previously loaded trucks
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchTrucks();

    const channel = supabase
      .channel(`live-trucks-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks' }, fetchTrucks)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, fetchTrucks)
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchTrucks]);

  return { trucks, loading, refetch: fetchTrucks };
}
