import { supabase } from '@/lib/supabase';
import { firstOf, stopsLeftToday, type ScheduleStop, type StopStatus } from '@shared/discovery';

type StopTruck = { id: string; name: string; is_live: boolean | null };
type StopRow = ScheduleStop & { truck_id: string; trucks: StopTruck | StopTruck[] | null };

export type TodayStop = ScheduleStop & { truck: StopTruck; status: StopStatus };

/**
 * Today's remaining scheduled stops for trucks that aren't live yet, soonest
 * first — what the Map tab shows instead of an empty map.
 */
export async function fetchStopsLeftToday(): Promise<TodayStop[]> {
  const now = new Date();
  const { data, error } = await supabase
    .from('schedules')
    .select('truck_id, day_of_week, open_time, close_time, location, notes, trucks(id, name, is_live)')
    .eq('day_of_week', now.getDay())
    .limit(500);
  if (error) throw error;
  return stopsLeftToday((data ?? []) as StopRow[], now).flatMap((s) => {
    const truck = firstOf(s.trucks);
    return truck && !truck.is_live ? [{ ...s, truck }] : [];
  });
}
