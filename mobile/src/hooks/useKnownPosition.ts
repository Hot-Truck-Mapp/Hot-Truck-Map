import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { toLatLng, type LatLng } from '@shared/discovery';

/**
 * The user's position, but only if they've already granted location access —
 * this never shows a permission prompt of its own (the Map tab asks).
 */
export function useKnownPosition(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
        const fix = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled) setPos(toLatLng({ lat: fix.coords.latitude, lng: fix.coords.longitude }));
      } catch { /* distances just won't show */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return pos;
}
