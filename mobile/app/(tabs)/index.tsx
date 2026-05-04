import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import MapView from 'react-native-maps';
import { TruckMap } from '@/components/map/TruckMap';
import { useLiveTrucks } from '@/hooks/useLiveTrucks';
import { Colors } from '@/constants/colors';

// Fallback: center of the continental US (never a single city)
const US_REGION: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 55,
  longitudeDelta: 55,
};

const USER_DELTA = 0.05; // ~3-mile radius around the user

export default function MapTab() {
  const { trucks, loading, refetch } = useLiveTrucks();
  const [region, setRegion] = useState<Region | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Access',
          'Enable location in your device settings to see trucks near you. Showing all live trucks instead.',
          [{ text: 'OK' }]
        );
        return;
      }

      // 1. Try the last known position first — it's instant and good enough
      //    to start the map at the right city while the accurate fix loads.
      try {
        const last = await Location.getLastKnownPositionAsync({});
        if (last) {
          const r: Region = {
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
            latitudeDelta: USER_DELTA,
            longitudeDelta: USER_DELTA,
          };
          setRegion(r);
          mapRef.current?.animateToRegion(r, 400);
        }
      } catch { /* no cached position yet */ }

      // 2. Get the accurate current position and re-center if meaningfully different
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const r: Region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: USER_DELTA,
          longitudeDelta: USER_DELTA,
        };
        setRegion(r);
        mapRef.current?.animateToRegion(r, 400);
      } catch {
        // Already set from last known position — no further action needed
      }
    })();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Trucks</Text>
        <Text style={styles.headerCount}>{trucks.length} live now</Text>
      </View>
      {/* ScrollView wrapper gives the map a pull-to-refresh gesture zone in the header */}
      <View style={styles.mapWrapper}>
        <ScrollView
          style={StyleSheet.absoluteFill}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          scrollEnabled={false}
        />
        <TruckMap trucks={trucks} initialRegion={region ?? US_REGION} mapRef={mapRef} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerCount: { fontSize: 14, color: Colors.textSecondary },
  mapWrapper: { flex: 1, position: 'relative' },
  scrollContent: { flex: 1 },
});
