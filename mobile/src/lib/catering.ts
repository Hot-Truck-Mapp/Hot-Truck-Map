import { T } from '@/components/ui';

export type CateringRequest = {
  id: string; truck_id: string; customer_name: string; customer_email: string; customer_phone: string | null;
  event_date: string; event_time: string | null; event_location: string; guest_count: number; budget: number | null;
  event_type: string | null; notes: string | null; status: string; created_at: string; selected_package_id: string | null;
};
export const REQUEST_COLS =
  'id, truck_id, customer_name, customer_email, customer_phone, event_date, event_time, event_location, guest_count, budget, event_type, notes, status, created_at, selected_package_id';

export const STATUS_CHIP: Record<string, { fg: string; bg: string; border: string }> = {
  pending: { fg: T.yellow700, bg: T.yellow50, border: '#FEF08A' },
  confirmed: { fg: T.green700, bg: T.green50, border: '#BBF7D0' },
  declined: { fg: T.red600, bg: T.red50, border: '#FECACA' },
  completed: { fg: T.n500, bg: T.n100, border: T.n200 },
};

/** event_date is a calendar date; parse at local midnight so it never shifts a day. */
export function eventDate(d: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-US', opts);
}
