"use client";

import { useEffect, useState } from "react";
import { toLatLng, type LatLng } from "@/lib/discovery";

/**
 * The visitor's position, but only if they've already granted location access
 * (on the map, say) — this never triggers a permission prompt of its own.
 */
export function useKnownPosition(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator === "undefined" || !navigator.geolocation || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((status) => {
        if (cancelled || status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (p) => { if (!cancelled) setPos(toLatLng({ lat: p.coords.latitude, lng: p.coords.longitude })); },
          () => { /* distances just won't show */ },
          { timeout: 8000, maximumAge: 5 * 60_000, enableHighAccuracy: false },
        );
      })
      .catch(() => { /* Permissions API unsupported — skip distances */ });
    return () => { cancelled = true; };
  }, []);

  return pos;
}
