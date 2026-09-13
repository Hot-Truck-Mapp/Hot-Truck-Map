"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { escapeIlike, firstDishByTruck } from "@/lib/discovery";

/**
 * Menu items matching `search`, as truck_id → first matching dish, so a search
 * for "birria" finds the truck that sells it even when its name and cuisine
 * don't say so. Debounced; returns {} until the current query has answered, so
 * a slow response for "bir" never filters the results for "birria".
 */
export function useDishSearch(search: string): Record<string, string> {
  const q = search.trim();
  const [hits, setHits] = useState<{ q: string; byTruck: Record<string, string> }>({ q: "", byTruck: {} });

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await createClient()
          .from("menu_items")
          .select("truck_id, name")
          .ilike("name", `%${escapeIlike(q)}%`)
          .limit(200);
        if (!cancelled) setHits({ q, byTruck: firstDishByTruck(data ?? []) });
      } catch { /* name/cuisine search still works */ }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  return q.length >= 2 && hits.q === q ? hits.byTruck : NO_HITS;
}

const NO_HITS: Record<string, string> = {};
