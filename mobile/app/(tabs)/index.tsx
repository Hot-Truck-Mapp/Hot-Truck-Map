import { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet, View, ActivityIndicator, Text,
  TouchableOpacity, Linking, Alert, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import MapView from 'react-native-maps';
import { TruckMap } from '@/components/map/TruckMap';
import { useLiveTrucks } from '@/hooks/useLiveTrucks';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

type RecentReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  truck_id: string;
  truck_name?: string;
};

// Fallback: center of the continental US (never a single city)
const US_REGION: Region = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 55,
  longitudeDelta: 55,
};

const USER_DELTA = 0.05; // ~3-mile radius around the user

type LocationStatus = 'requesting' | 'granted' | 'skipped' | 'denied';

export default function MapTab() {
  const router = useRouter();
  const { trucks, loading, refetch } = useLiveTrucks();
  const [region, setRegion] = useState<Region | undefined>();
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('requesting');
  const [refreshing, setRefreshing] = useState(false);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const reviewsMountedRef = useRef(true);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    return () => { reviewsMountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadRecentReviews();
  }, []);

  async function loadRecentReviews() {
    try {
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, truck_id, trucks(id, name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!reviewsMountedRef.current || !reviewData) return;
      setRecentReviews(reviewData.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        created_at: r.created_at,
        truck_id: r.truck_id,
        truck_name: r.trucks?.name ?? undefined,
      })));
    } catch {
      // non-critical — section just won't show
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Check existing permission first (no prompt if already granted/denied)
        const { status: existing } = await Location.getForegroundPermissionsAsync();

        if (existing === 'granted') {
          if (!mounted) return;
          setLocationStatus('granted');
          await locateUser(mounted);
          return;
        }

        if (existing === 'denied') {
          // Already permanently denied — show the in-app banner instead of
          // a system dialog that won't appear.
          if (mounted) setLocationStatus('denied');
          return;
        }

        // Permission is 'undetermined' — show the system prompt now.
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!mounted) return;
        if (status === 'granted') {
          setLocationStatus('granted');
          await locateUser(mounted);
        } else {
          setLocationStatus('denied');
        }
      } catch {
        // Location API unavailable — fall back to showing the map without centering
        if (mounted) setLocationStatus('denied');
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function locateUser(mounted = true) {
    // 1. Last-known position — instant if the OS has a cached fix.
    try {
      const last = await Location.getLastKnownPositionAsync({});
      if (last && mounted) {
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
      if (!mounted) return;
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
      await Promise.all([refetch(), loadRecentReviews()]);
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

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={openSettings}
          accessibilityLabel="Open Settings to enable location"
          accessibilityRole="button"
        >
          <Text style={styles.settingsButtonText}>Open Settings</Text>
        </TouchableOpacity>

        {/* Still let them browse the full map — 'skipped' keeps showsUserLocation=false */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => setLocationStatus('skipped')}
          accessibilityLabel="Browse all trucks without location"
          accessibilityRole="button"
        >
          <Text style={styles.skipButtonText}>Browse all trucks instead</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Trucks</Text>
        {trucks.length > 0 ? (
          <Text style={styles.headerCount}>{trucks.length} live now</Text>
        ) : (
          <Text style={styles.headerCountEmpty}>Check back soon</Text>
        )}
      </View>

      {/* Pull-to-refresh indicator sits above the map without intercepting touches */}
      {refreshing && (
        <View style={styles.refreshingBanner}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      <View style={styles.mapWrapper}>
        <TruckMap
          trucks={trucks}
          initialRegion={region ?? US_REGION}
          mapRef={mapRef}
          showsUserLocation={locationStatus === 'granted'}
        />
      </View>

      {/* Recent Reviews horizontal scroll */}
      {recentReviews.length > 0 && (
        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsSectionTitle}>Recent Reviews</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewsRow}>
            {recentReviews.map((review) => (
              <TouchableOpacity
                key={review.id}
                style={styles.reviewCard}
                onPress={() => { if (review.truck_id) router.push(`/truck/${review.truck_id}` as any); }}
                activeOpacity={0.8}
                accessibilityLabel={`Review for ${review.truck_name ?? 'food truck'}, ${review.rating} stars${review.comment ? ': ' + review.comment : ''}`}
                accessibilityRole="button"
              >
                {review.truck_name ? (
                  <Text style={styles.reviewCardTruck} numberOfLines={1}>{review.truck_name}</Text>
                ) : null}
                <View style={styles.reviewCardStars}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Text key={s} style={{ fontSize: 11, color: s <= review.rating ? '#F5A623' : '#ddd' }}>★</Text>
                  ))}
                </View>
                {review.comment ? (
                  <Text style={styles.reviewCardComment} numberOfLines={2}>{review.comment}</Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
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
  headerCount: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  headerCountEmpty: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic' },
  mapWrapper: { flex: 1 },
  refreshingBanner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingTop: 8,
    pointerEvents: 'none',
  } as const,

  // Recent Reviews section
  reviewsSection: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    paddingBottom: 8,
  },
  reviewsSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  reviewsRow: { paddingHorizontal: 16, gap: 10 },
  reviewCard: {
    width: 160,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewCardTruck: { fontSize: 12, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  reviewCardStars: { flexDirection: 'row', gap: 2, marginBottom: 6 },
  reviewCardComment: { fontSize: 12, color: Colors.textSecondary, lineHeight: 16 },
});
