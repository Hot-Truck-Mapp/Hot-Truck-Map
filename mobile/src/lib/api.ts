import { supabase } from '@/lib/supabase';

/** The website — its /api routes back the app too. */
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';

/**
 * fetch() against a website API route, with the signed-in user's access token
 * attached the same way the web dashboard sends it. Throws when signed out so
 * callers never send an unauthenticated request to an authenticated route.
 */
export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please sign in and try again.');
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

/** "5m ago" style relative time, matching the web's timeAgo helpers. */
export function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
