import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { escapeIlike, firstDishByTruck } from '@shared/discovery';

const NO_HITS: Record<string, string> = {};

/**
 * Menu items matching `search`, as truck_id → first matching dish — the app
 * twin of the website's lib/hooks/useDishSearch. Debounced; returns {} until
 * the current query has answered, so a slow response for "bir" never filters
 * the results for "birria".
 */
export function useDishSearch(search: string): Record<string, string> {
  const q = search.trim();
  const [hits, setHits] = useState<{ q: string; byTruck: Record<string, string> }>({ q: '', byTruck: {} });

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('menu_items')
          .select('truck_id, name')
          .ilike('name', `%${escapeIlike(q)}%`)
          .limit(200);
        if (!cancelled) setHits({ q, byTruck: firstDishByTruck(data ?? []) });
      } catch { /* name/cuisine search still works */ }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  return q.length >= 2 && hits.q === q ? hits.byTruck : NO_HITS;
}
