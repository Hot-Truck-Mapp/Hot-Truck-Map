import { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet, View, ActivityIndicator, Text,
  TouchableOpacity, Linking, Alert, ScrollView, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import MapView from 'react-native-maps';
import { TruckMap } from '@/components/map/TruckMap';
import { useLiveTrucks } from '@/hooks/useLiveTrucks';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { stateForName, type USState } from '@shared/us-states';
import { CUISINE_TYPES } from '@shared/cuisines';
import { T } from '@/components/ui';
import { useAsyncData, useRefreshOnRefocus } from '@/hooks/useAsyncData';
import { useDishSearch } from '@/hooks/useDishSearch';
import { fetchStopsLeftToday } from '@/lib/schedules';
import { formatMiles, milesBetween, sortByLiveThenDistance, toLatLng, type LatLng } from '@shared/discovery';

const DIETARY = ['Vegan', 'Gluten-Free', 'Halal', 'Vegetarian'];

type FeaturedTruck = { id: string; name: string; cuisine: string | null; profile_photo: string | null; message: string };

/** "Truck of the Week" — the same site_settings keys the web home page reads. */
async function fetchFeaturedTruck(): Promise<FeaturedTruck | null> {
  const { data: settings } = await supabase.from('site_settings').select('key, value').in('key', ['featured_truck_id', 'featured_message']);
  const sm: Record<string, string> = {};
  for (const row of settings ?? []) sm[row.key] = row.value ?? '';
  if (!sm.featured_truck_id) return null;
  const { data: truck } = await supabase.from('trucks').select('id, name, cuisine, profile_photo').eq('id', sm.featured_truck_id).maybeSingle();
  return truck ? { ...truck, message: sm.featured_message ?? '' } : null;
}

async function fetchRecentReviews(): Promise<RecentReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, created_at, truck_id, trucks(id, name)')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const truckRel = r.trucks as { name?: string } | { name?: string }[] | null;
    return {
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      truck_id: r.truck_id,
      truck_name: Array.isArray(truckRel) ? truckRel[0]?.name : truckRel?.name,
    };
  });
}

type RecentReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  truck_id: string;
  truck_name?: string;
};

// Fallback region — centered on NJ/NYC metro where the app launched
const US_REGION: Region = {
  latitude: 40.8859,
  longitude: -74.0435,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const USER_DELTA = 0.05; // ~3-mile radius around the user

type LocationStatus = 'requesting' | 'granted' | 'skipped' | 'denied';

export default function MapTab() {
  const router = useRouter();
  const { trucks, loading, refetch } = useLiveTrucks();
  const [region, setRegion] = useState<Region | undefined>();
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('requesting');
  const [nearbyState, setNearbyState] = useState<USState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { data: reviewsData, reload: reloadReviews } = useAsyncData('recent-reviews', fetchRecentReviews);
  const recentReviews = reviewsData ?? [];
  const featured = useAsyncData('featured-truck', fetchFeaturedTruck).data ?? null;
  const mapRef = useRef<MapView>(null);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [cuisine, setCuisine] = useState('All');
  const [dietary, setDietary] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [featuredDismissed, setFeaturedDismissed] = useState(false);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const dishes = useDishSearch(search);
  // Who's out later today — shown over the map when nobody is live.
  const { data: stopsData, reload: reloadStops } = useAsyncData('stops-left-today', fetchStopsLeftToday);
  const stopsToday = stopsData ?? [];
  useRefreshOnRefocus(reloadStops);

  // Resolves coordinates to a US state via Expo Location's built-in reverse
  // geocoder (no network call needed beyond the OS's own geocoding service).
  // Fails silently — this only powers a nice-to-have "Events near you" banner.
  async function resolveNearbyState(lat: number, lng: number, mounted: boolean) {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const match = stateForName(results?.[0]?.region ?? null);
      if (mounted && match) setNearbyState(match);
    } catch { /* non-critical */ }
  }

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
        setUserPos(toLatLng({ lat: last.coords.latitude, lng: last.coords.longitude }));
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
      setUserPos(toLatLng({ lat: loc.coords.latitude, lng: loc.coords.longitude }));
      mapRef.current?.animateToRegion(r, 400);
      resolveNearbyState(loc.coords.latitude, loc.coords.longitude, mounted);
    } catch { /* keep last-known position */ }
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

  function openSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert('Could not open Settings', 'Please open your device Settings manually and enable Location for this app.');
    });
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetch(), reloadReviews(), reloadStops()]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, reloadReviews, reloadStops]);

  const q = search.trim().toLowerCase();
  const matchesSearch = (t: (typeof trucks)[number]) =>
    !q || (t.name ?? '').toLowerCase().includes(q) || (t.cuisine ?? '').toLowerCase().includes(q) || !!dishes[t.id];
  const milesTo = (t: (typeof trucks)[number]) => {
    const pos = toLatLng(t.location);
    return userPos && pos ? milesBetween(userPos, pos) : null;
  };
  const filtered = trucks.filter((t) => {
    if (cuisine !== 'All' && t.cuisine !== cuisine) return false;
    if (!matchesSearch(t)) return false;
    if (dietary.length > 0 && !dietary.every((d) => (t.dietary_tags ?? []).includes(d))) return false;
    return true;
  });
  const searchResults = q ? sortByLiveThenDistance(trucks.filter(matchesSearch), () => true, milesTo) : [];
  const activeFilterCount = dietary.length + (cuisine !== 'All' ? 1 : 0);

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
          <Text style={styles.headerCount}>{filtered.length === trucks.length ? `${trucks.length} live now` : `${filtered.length} of ${trucks.length} live`}</Text>
        ) : (
          <Text style={styles.headerCountEmpty}>Check back soon</Text>
        )}
      </View>

      {/* Search + filters — same controls as the web map */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={T.n400} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Search trucks, cuisines, or dishes..."
            placeholderTextColor={T.n400}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search live food trucks by name, cuisine, or dish"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} style={styles.searchClear} accessibilityLabel="Clear search">
              <Ionicons name="close" size={12} color={T.n600} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setShowFilter(!showFilter)}
              style={[styles.filterBtn, (showFilter || activeFilterCount > 0) && { backgroundColor: Colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Filters"
            >
              <Ionicons name="funnel" size={11} color={showFilter || activeFilterCount > 0 ? '#fff' : T.n600} />
              <Text style={[styles.filterText, (showFilter || activeFilterCount > 0) && { color: '#fff' }]}>
                {activeFilterCount > 0 ? `${activeFilterCount}` : 'Filter'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {searchFocused && q.length > 0 && (
          <View style={styles.dropdown}>
            {searchResults.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No live trucks match &ldquo;{search}&rdquo;</Text>
            ) : searchResults.slice(0, 6).map((t) => (
              <TouchableOpacity key={t.id} style={styles.dropdownRow} onPress={() => router.push(`/truck/${t.id}`)}>
                <Text style={styles.dropdownName} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.dropdownCuisine} numberOfLines={1}>
                  {dishes[t.id] ? `Serves ${dishes[t.id]}` : t.cuisine ?? 'Food Truck'}
                  {milesTo(t) != null ? ` · ${formatMiles(milesTo(t)!)}` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {showFilter && (
          <View style={styles.filterPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {['All', ...CUISINE_TYPES].map((c) => (
                <TouchableOpacity key={c} onPress={() => setCuisine(c)} style={[styles.pill, cuisine === c && { backgroundColor: T.n900 }]}>
                  <Text style={[styles.pillText, cuisine === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {DIETARY.map((d) => (
                <TouchableOpacity key={d} onPress={() => setDietary(dietary.includes(d) ? dietary.filter((x) => x !== d) : [...dietary, d])} style={[styles.pill, dietary.includes(d) && { backgroundColor: Colors.primary }]}>
                  <Text style={[styles.pillText, dietary.includes(d) && { color: '#fff' }]}>{d}</Text>
                </TouchableOpacity>
              ))}
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={() => { setCuisine('All'); setDietary([]); }} style={{ justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={styles.clearFilters}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Truck of the Week */}
      {featured && !featuredDismissed && (
        <View style={styles.featured}>
          {featured.profile_photo ? (
            <Image source={{ uri: featured.profile_photo }} style={styles.featuredPhoto} />
          ) : (
            <View style={[styles.featuredPhoto, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="bus" size={20} color="#fff" /></View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.featuredLabel}>🏆 TRUCK OF THE WEEK</Text>
            <Text style={styles.featuredName} numberOfLines={1}>{featured.name.toUpperCase()}</Text>
            {featured.cuisine ? <Text style={styles.featuredSub}>{featured.cuisine}</Text> : null}
            {featured.message ? <Text style={styles.featuredMsg} numberOfLines={1}>{featured.message}</Text> : null}
          </View>
          <TouchableOpacity style={styles.featuredView} onPress={() => router.push(`/truck/${featured.id}`)}>
            <Text style={styles.featuredViewText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFeaturedDismissed(true)} hitSlop={8} accessibilityLabel="Dismiss featured truck">
            <Ionicons name="close" size={16} color="#FECACA" />
          </TouchableOpacity>
        </View>
      )}

      {/* Events near you — shown once we've resolved the user's state */}
      {locationStatus === 'granted' && nearbyState && (
        <TouchableOpacity
          style={styles.eventsBanner}
          onPress={() => router.push(`/events/${nearbyState.code.toLowerCase()}`)}
          activeOpacity={0.8}
          accessibilityLabel={`Events near you in ${nearbyState.name}`}
          accessibilityRole="button"
        >
          <Text style={styles.eventsBannerEmoji}>🎪</Text>
          <Text style={styles.eventsBannerText}>Events near you in {nearbyState.name}</Text>
          <Text style={styles.eventsBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Pull-to-refresh indicator sits above the map without intercepting touches */}
      {refreshing && (
        <View style={styles.refreshingBanner}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      <View style={styles.mapWrapper}>
        <TruckMap
          trucks={filtered}
          initialRegion={region ?? US_REGION}
          mapRef={mapRef}
          showsUserLocation={locationStatus === 'granted'}
        />

        {/* Nobody live — say so, and point at who's out later today instead of
            leaving an empty map. Mirrors the card on the web home page. */}
        {trucks.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyCardTitle}>No trucks live right now</Text>
            {stopsToday.length > 0 ? (
              <>
                <Text style={styles.emptyCardSub}>
                  {stopsToday.length === 1 ? '1 stop' : `${stopsToday.length} stops`} coming up today
                </Text>
                {stopsToday.slice(0, 3).map((s, i) => (
                  <TouchableOpacity
                    key={`${s.truck.id}-${i}`}
                    style={styles.stopRow}
                    onPress={() => router.push(`/truck/${s.truck.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.truck.name}, ${s.open_time} to ${s.close_time}${s.location ? `, ${s.location}` : ''}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopName} numberOfLines={1}>{s.truck.name}</Text>
                      <Text style={styles.stopWhere} numberOfLines={1}>
                        {s.status === 'open' ? `Scheduled now · until ${s.close_time}` : `${s.open_time}–${s.close_time}`}
                        {s.location ? ` · ${s.location}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.stopView}>View →</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <TouchableOpacity onPress={() => router.push('/trucks')} accessibilityRole="link">
                <Text style={styles.emptyCardSub}>
                  <Text style={styles.emptyCardLink}>Follow your favorites</Text> and we&apos;ll tell you the moment they go live.
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
                onPress={() => { if (review.truck_id) router.push(`/truck/${review.truck_id}`); }}
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
  eventsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventsBannerEmoji: { fontSize: 16 },
  eventsBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: Colors.text },
  eventsBannerArrow: { fontSize: 14, color: Colors.primary, fontWeight: '700' },
  mapWrapper: { flex: 1 },
  emptyCard: {
    position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  emptyCardTitle: { fontSize: 14, fontWeight: '900', color: T.n900 },
  emptyCardSub: { fontSize: 12, color: T.n500, marginTop: 2 },
  emptyCardLink: { fontWeight: '700', color: Colors.primary },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: T.n50, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9, marginTop: 8,
  },
  stopName: { fontSize: 14, fontWeight: '700', color: T.n800 },
  stopWhere: { fontSize: 12, color: T.n500, marginTop: 1 },
  stopView: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Search + filters
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, zIndex: 20 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12,
    borderWidth: 1, borderColor: T.n200,
  },
  searchInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 10, fontSize: 15, color: T.n800 },
  searchClear: { width: 22, height: 22, borderRadius: 11, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  filterText: { fontSize: 12, fontWeight: '700', color: T.n600 },
  dropdown: {
    position: 'absolute', top: 58, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 14, paddingVertical: 4,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 30,
  },
  dropdownRow: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.n50 },
  dropdownName: { fontSize: 14, fontWeight: '700', color: T.n900 },
  dropdownCuisine: { fontSize: 12, color: Colors.primary, marginTop: 1 },
  dropdownEmpty: { fontSize: 13, color: T.n400, padding: 14 },
  filterPanel: { marginTop: 8 },
  pill: { backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontSize: 12, fontWeight: '700', color: T.n600 },
  clearFilters: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Truck of the Week
  featured: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, padding: 10,
    backgroundColor: Colors.primary, borderRadius: 16,
  },
  featuredPhoto: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#B91C1C' },
  featuredLabel: { fontSize: 9, fontWeight: '900', color: '#FECACA', letterSpacing: 1.2 },
  featuredName: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.3 },
  featuredSub: { fontSize: 11, color: '#FECACA' },
  featuredMsg: { fontSize: 11, color: '#FEE2E2', marginTop: 1 },
  featuredView: { backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  featuredViewText: { fontSize: 12, fontWeight: '900', color: Colors.primary },
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
