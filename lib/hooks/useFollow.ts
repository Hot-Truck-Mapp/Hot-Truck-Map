"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

async function savePushSubscription(userId: string): Promise<void> {
  try {
    // Dynamically import to avoid SSR issues
    const OneSignal = (await import("react-onesignal")).default;

    const granted = await OneSignal.Notifications.requestPermission();
    if (!granted) return;

    const playerId = OneSignal.User?.PushSubscription?.id;
    if (!playerId) return;

    // Try to get user location for proximity filtering on go-live alerts.
    // Silently skip if denied — we'll still send to users with no location stored.
    let lat: number | null = null;
    let lng: number | null = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch {
      // location permission denied — fine, proximity filter will skip this user
    }

    const supabase = createClient();
    await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        onesignal_player_id: playerId,
        last_lat: lat,
        last_lng: lng,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,onesignal_player_id" }
    );
  } catch {
    // OneSignal not initialised yet, or browser doesn't support push — skip
  }
}

/**
 * Manages follow state for a truck page.
 * On first follow: requests push notification permission and saves the
 * player ID + location to push_subscriptions so the user receives
 * go-live and moved alerts.
 */
export function useFollow(
  truckId: string,
  initialFollowing: boolean,
  onCountChange: (delta: 1 | -1) => void
) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  const toggleFollow = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);

    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("truck_id", truckId)
        .eq("user_id", user.id);
      setFollowing(false);
      onCountChange(-1);
    } else {
      await supabase.from("follows").insert({ truck_id: truckId, user_id: user.id });
      setFollowing(true);
      onCountChange(1);
      // Fire-and-forget: request push permission after inserting the follow row
      savePushSubscription(user.id);
    }

    setLoading(false);
  }, [following, truckId, onCountChange]);

  return { following, loading, toggleFollow };
}
