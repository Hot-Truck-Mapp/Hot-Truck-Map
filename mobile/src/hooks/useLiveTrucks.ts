import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAsyncData } from '@/hooks/useAsyncData';
import { firstOf } from '@shared/discovery';
import type { Truck, Location } from '@shared/types';

export type TruckWithLocation = Truck & { location?: Location };

// Every truck marked live, like the website's map. There is deliberately no
// "broadcast in the last N minutes" cutoff: a truck parked for a lunch service
// doesn't move, so it doesn't re-broadcast, and a 30-minute cutoff here used to
// drop it from the app while the website still showed it. Stale sessions are
// cleared server-side by the hourly /api/trucks/auto-offline cron instead.
async function fetchLiveTrucks(): Promise<TruckWithLocation[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select('id, name, cuisine, profile_photo, is_live, avg_rating, review_count, dietary_tags, locations!inner(id, lat, lng, address, broadcasted_at)')
    .eq('is_live', true);
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...t,
    // locations is unique per truck, so PostgREST embeds it as an object.
    location: firstOf(t.locations as Location | Location[] | null) ?? undefined,
  }));
}

export function useLiveTrucks() {
  const { data, loading, reload } = useAsyncData('live-trucks', fetchLiveTrucks);

  useEffect(() => {
    // One refetch per burst of changes — a truck going live writes both its
    // location and its trucks row within milliseconds.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void reload(); }, 400);
    };
    const channel = supabase
      .channel(`live-trucks-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trucks' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, refetch)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [reload]);

  return { trucks: data ?? [], loading, refetch: reload };
}
