import { useRef } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import type { Truck, Location } from '@shared/types';

export type TruckWithLocation = Truck & { location?: Location };

type Props = {
  trucks: TruckWithLocation[];
  initialRegion?: Region;
};

const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export function TruckMap({ trucks, initialRegion }: Props) {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      // Use Google Maps on Android; Apple Maps on iOS (no API key required)
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={initialRegion ?? DEFAULT_REGION}
      showsUserLocation
      showsMyLocationButton
    >
      {trucks
        .filter(t => t.location?.lat != null && t.location?.lng != null)
        .map(truck => (
          <Marker
            key={truck.id}
            coordinate={{
              latitude: truck.location!.lat,
              longitude: truck.location!.lng,
            }}
            title={truck.name}
            description={truck.cuisine}
            onCalloutPress={() => router.push(`/truck/${truck.id}`)}
          >
            <View style={styles.marker}>
              <Text style={styles.markerEmoji}>🚚</Text>
            </View>
          </Marker>
        ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
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
