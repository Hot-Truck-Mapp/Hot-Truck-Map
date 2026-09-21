import React, { RefObject } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import type { Truck, Location } from '@shared/types';
import { freshnessOf } from '@shared/presence';

export type TruckWithLocation = Truck & { location?: Location };

/** Current wait and dispute state per truck, precomputed by the screen. */
export type MapSignal = { wait: string | null; disputed: boolean };

type Props = {
  trucks: TruckWithLocation[];
  initialRegion: Region;
  mapRef?: RefObject<MapView | null>;
  /** Only show the blue dot when location permission is actually granted */
  showsUserLocation?: boolean;
  signals?: Record<string, MapSignal>;
};

export function TruckMap({ trucks, initialRegion, mapRef, showsUserLocation = false, signals }: Props) {
  const router = useRouter();

  return (
    <MapView
      ref={mapRef as React.RefObject<MapView>}
      style={styles.map}
      // iOS uses Apple Maps. Android always uses the Google Maps SDK regardless
      // of the `provider` prop and requires android.config.googleMaps.apiKey in
      // app.json — without it the map renders blank with an auth error.
      initialRegion={initialRegion}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={showsUserLocation}
    >
      {trucks
        .filter(t => t.location?.lat != null && t.location?.lng != null)
        .map(truck => {
          // A pin is a claim that a truck is at this spot. The callout carries
          // the evidence: how old the position is, and how long the line is.
          const fresh = freshnessOf(truck.location!.broadcasted_at);
          const signal = signals?.[truck.id];
          const unsure = fresh.level === 'stale' || fresh.level === 'unknown' || !!signal?.disputed;
          const description = [
            truck.cuisine,
            signal?.disputed ? 'Customers report they\u2019ve left' : fresh.label,
            signal?.wait,
          ].filter(Boolean).join(' · ');

          return (
            <Marker
              key={truck.id}
              coordinate={{
                latitude: truck.location!.lat,
                longitude: truck.location!.lng,
              }}
              title={truck.name ?? undefined}
              description={description || undefined}
              onCalloutPress={() => { if (truck.id) router.push(`/truck/${truck.id}`); }}
            >
              <View style={[styles.marker, unsure && styles.markerUnsure]}>
                <Text style={styles.markerEmoji}>🚚</Text>
              </View>
            </Marker>
          );
        })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  // A position we're not sure about should not look as confident as a fresh one.
  markerUnsure: { opacity: 0.55 },
  marker: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerEmoji: { fontSize: 18 },
});
