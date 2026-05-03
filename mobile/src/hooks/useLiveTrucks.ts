import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Truck, Location } from '@shared/types';

export type TruckWithLocation = Truck & { location?: Location };

const LIVE_WINDOW_MS = 30 * 60 * 1000;

export function useLiveTrucks() {
  const [trucks, setTrucks] = useState<TruckWithLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - LIVE_WINDOW_MS).toISOString();
      const { data } = await supabase
        .from('trucks')
        .select('*, locations!inner(*)')
        .eq('is_live', true)
        .gte('locations.broadcasted_at', cutoff);

      if (data) {
        setTrucks(
          data.map(t => ({
            ...t,
            location: Array.isArray(t.locations) ? t.locations[0] : undefined,
          }))
        );
      }
    } catch {
      // network error — keep showing previously loaded trucks
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();

    const channel = supabase
      .channel('live-trucks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, fetch)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetch]);

  return { trucks, loading, refetch: fetch };
}
