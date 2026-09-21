import { useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useAsyncData } from '@/hooks/useAsyncData';

export type MyTruck = {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  phone: string | null;
  instagram: string | null;
  profile_photo: string | null;
  is_live: boolean | null;
  dietary_tags: string[] | null;
  offers_catering: boolean | null;
  catering_description: string | null;
  catering_starting_price: number | null;
  catering_min_guests: number | null;
  wait_minutes: number | null;
  wait_set_at: string | null;
};

const TRUCK_COLS =
  'id, name, description, cuisine, phone, instagram, profile_photo, is_live, dietary_tags, ' +
  'offers_catering, catering_description, catering_starting_price, catering_min_guests, ' +
  'wait_minutes, wait_set_at';

/**
 * The operator's truck, or null if this account doesn't own one.
 *
 * Mirrors the web dashboard's self-heal: if the server-side signup insert
 * never landed, recreate the row from the truck name stashed in
 * user_metadata at signup, which the trucks_owner_insert RLS policy allows.
 */
async function fetchMyTruck(user: User): Promise<MyTruck | null> {
  const { data, error } = await supabase.from('trucks').select(TRUCK_COLS).eq('owner_id', user.id).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data as unknown as MyTruck;

  const meta = user.user_metadata ?? {};
  const name = typeof meta.truck_name === 'string' ? meta.truck_name.trim() : '';
  if (meta.role !== 'operator' || !name) return null;
  const cuisine = typeof meta.cuisine === 'string' && meta.cuisine.trim() ? meta.cuisine.trim() : null;
  const { data: created } = await supabase
    .from('trucks')
    .insert({ owner_id: user.id, name, cuisine, is_live: false })
    .select(TRUCK_COLS)
    .maybeSingle();
  return (created as unknown as MyTruck | null) ?? null;
}

/**
 * The signed-in operator's truck — the app side of the web dashboard's
 * loadAll(). Truck ownership in the DB is the only authority on who is an
 * operator (never user_metadata.role), so `truck === null` once loaded means
 * "not an operator".
 */
export function useMyTruck() {
  const { session, loading: authLoading } = useAuth();
  const user = session?.user ?? null;
  const key = authLoading ? null : `truck:${user?.id ?? 'signed-out'}`;
  const { data, setData, loading, error, reload } = useAsyncData(key, () => (user ? fetchMyTruck(user) : Promise.resolve(null)));

  const setTruck = useCallback(
    (next: MyTruck | null | ((prev: MyTruck | null) => MyTruck | null)) =>
      setData((prev: MyTruck | null | undefined) => (typeof next === 'function' ? next(prev ?? null) : next)),
    [setData],
  );

  return { session, truck: data ?? null, setTruck, loading: authLoading || loading, error, reload };
}
