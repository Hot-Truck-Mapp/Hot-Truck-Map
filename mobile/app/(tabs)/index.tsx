import { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet, View, ActivityIndicator, Text,
  TouchableOpacity, Linking, Alert,
} from 'react-native';
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

type LocationStatus = 'requesting' | 'granted' | 'denied';

export default function MapTab() {
  const { trucks, loading, refetch } = useLiveTrucks();
  const [region, setRegion] = useState<Region | undefined>();
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('requesting');
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      try {
        // Check existing permission first (no prompt if already granted/denied)
        const { status: existing } = await Location.getForegroundPermissionsAsync();

        if (existing === 'granted') {
          setLocationStatus('granted');
          await locateUser();
          return;
        }

        if (existing === 'denied') {
          // Already permanently denied — show the in-app banner instead of
          // a system dialog that won't appear.
          setLocationStatus('denied');
          return;
        }

        // Permission is 'undetermined' — show the system prompt now.
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationStatus('granted');
          await locateUser();
        } else {
          setLocationStatus('denied');
        }
      } catch {
        // Location API unavailable — fall back to showing the map without centering
        setLocationStatus('denied');
      }
    })();
  }, []);

  async function locateUser() {
    // 1. Last-known position — instant if the OS has a cached fix.
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
    } catch { /* no cached fix */ }

    // 2. Accurate current position — animates to it when ready.
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const r: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: USER_DELTA,
        longitudeDelta: USER_DELTA,
      };
      setRegion(r);
      mapRef.current?.animateToRegion(r, 400);
    } catch { /* keep last-known position */ }
  }

  function openSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert('Could not open Settings', 'Please open your device Settings manually and enable Location for this app.');
    });
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Location permission denied — show a full-screen prompt ──────────────────
  if (locationStatus === 'denied') {
    return (
      <SafeAreaView style={[styles.container, styles.permissionScreen]} edges={['top']}>
        {/* Pin icon */}
        <View style={styles.permissionIconWrap}>
          <View style={styles.permissionIconBg}>
            <Text style={styles.permissionIconEmoji}>📍</Text>
          </View>
        </View>

        <Text style={styles.permissionTitle}>Allow Location Access</Text>
        <Text style={styles.permissionBody}>
          Hot Truck Map needs your location to show food trucks near you.
          {'\n\n'}
          Open your device Settings and enable Location for this app, then come back.
        </Text>

        <TouchableOpacity style={styles.settingsButton} onPress={openSettings}>
          <Text style={styles.settingsButtonText}>Open Settings</Text>
        </TouchableOpacity>

        {/* Still let them browse the full map */}
        <TouchableOpacity style={styles.skipButton} onPress={() => setLocationStatus('granted')}>
          <Text style={styles.skipButtonText}>Browse all trucks instead</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Trucks</Text>
        <Text style={styles.headerCount}>{trucks.length} live now</Text>
      </View>

      {/* Pull-to-refresh indicator sits above the map without intercepting touches */}
      {refreshing && (
        <View style={styles.refreshingBanner}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      <View style={styles.mapWrapper}>
        <TruckMap trucks={trucks} initialRegion={region ?? US_REGION} mapRef={mapRef} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Permission denied screen
  permissionScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 0,
  },
  permissionIconWrap: { marginBottom: 24 },
  permissionIconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionIconEmoji: { fontSize: 40 },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  settingsButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  settingsButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipButton: { paddingVertical: 12 },
  skipButtonText: { color: Colors.textSecondary, fontSize: 14 },

  // Map screen
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
  mapWrapper: { flex: 1 },
  refreshingBanner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingTop: 8,
    pointerEvents: 'none',
  } as const,
});
