import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ActivityIndicator, Text, Alert, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import { TruckMap } from '@/components/map/TruckMap';
import { useLiveTrucks } from '@/hooks/useLiveTrucks';
import { Colors } from '@/constants/colors';

export default function MapTab() {
  const { trucks, loading, refetch } = useLiveTrucks();
  const [region, setRegion] = useState<Region | undefined>();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Access',
          'Enable location in your device settings to see trucks near you. Showing all live trucks instead.',
          [{ text: 'OK' }]
        );
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch {
        // Silently fall back to default region — map still shows all trucks
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
        <TruckMap trucks={trucks} initialRegion={region} />
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
