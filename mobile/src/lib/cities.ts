import { supabase } from '@/lib/supabase';

export type LiveTruck = {
  id: string; name: string; cuisine: string | null; description: string | null; profile_photo: string | null;
  is_live: boolean | null; locations: { id: string; address: string | null; broadcasted_at: string | null }[] | null;
};

/** "new-brunswick" → "New Brunswick", the same slug rule as /trucks/[city]. */
export function cityFromSlug(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function slugForCity(city: string): string {
  return city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Live trucks with their locations. Like the web page, filtering happens in
 * memory: PostgREST ignores .ilike() on joined columns for parent filtering,
 * and the live set is small.
 */
export async function fetchLiveTrucks(): Promise<LiveTruck[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select('id, name, cuisine, description, profile_photo, is_live, locations(id, address, broadcasted_at)')
    .eq('is_live', true)
    .limit(100);
  if (error) throw error;
  return (data ?? []) as LiveTruck[];
}

export function trucksInCity(trucks: LiveTruck[], city: string): LiveTruck[] {
  const needle = city.toLowerCase();
  return trucks.filter((t) => t.locations?.some((l) => l.address?.toLowerCase().includes(needle)));
}

/**
 * Best-effort town names from live addresses. Geocoded addresses look like
 * "123 Main St, Newark, New Jersey 07102, United States", so the town is the
 * segment after the street. Addresses without commas are skipped rather than
 * guessed at.
 */
export function citiesFrom(trucks: LiveTruck[]): { city: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const t of trucks) {
    const addr = t.locations?.[0]?.address ?? '';
    const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const city = parts[1];
    if (!city || /\d/.test(city) || city.length > 40) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return [...counts.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));
}
