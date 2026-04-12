const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

/**
 * Send a push notification to a list of OneSignal player IDs.
 * Silently no-ops if playerIds is empty or env vars are missing.
 */
export async function sendPushToPlayers(
  playerIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (!playerIds.length || !ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) return;

  const res = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + ONESIGNAL_API_KEY,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { en: title },
      contents: { en: body },
      data: data ?? {},
      web_url: data?.url
        ? (process.env.NEXT_PUBLIC_APP_URL ?? "") + data.url
        : process.env.NEXT_PUBLIC_APP_URL ?? "/",
    }),
  });

  if (!res.ok) {
    console.error("[OneSignal] send failed", await res.text());
  }
}

/** Haversine distance in kilometres between two lat/lng points. */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const FIVE_MILES_KM = 8.047;
