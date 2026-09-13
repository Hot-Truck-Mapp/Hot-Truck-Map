import { useState, useRef } from 'react';
import {
  StyleSheet, View, FlatList, TextInput, ActivityIndicator, Text, RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TruckCard, type TruckListItem } from '@/components/TruckCard';
import { TruckPhoto, T } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAsyncData, useRefreshOnRefocus } from '@/hooks/useAsyncData';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { CUISINE_TYPES } from '@shared/cuisines';

// "All" plus every cuisine a truck profile can be saved under — the same list
// the web /trucks filter and the operator profile editor use.
const CUISINES = ['All', ...CUISINE_TYPES];
const DIETARY = ['Vegan', 'Gluten-Free', 'Halal', 'Vegetarian'];

type ListTruck = TruckListItem & {
  dietary_tags: string[] | null;
  locations: { id: string; address: string | null }[] | null;
  follows_agg: { count: number }[] | null;
};

const NO_FAVORITES = new Set<string>();

async function fetchTrucks(): Promise<ListTruck[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select('id, name, cuisine, description, profile_photo, is_live, dietary_tags, avg_rating, review_count, locations(id, address), follows_agg:follows(count)')
    .order('is_live', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as ListTruck[];
}

async function fetchFavorites(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('follows').select('truck_id').eq('user_id', userId).limit(1000);
  if (error) throw error;
  return new Set((data ?? []).map((f: { truck_id: string }) => f.truck_id));
}

const QUICK_LINKS: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; href: Href }[] = [
  { label: 'Events', icon: 'calendar-outline', href: '/events' },
  { label: 'Newsletter', icon: 'newspaper-outline', href: '/newsletter' },
  { label: 'Leaderboard', icon: 'trophy-outline', href: '/leaderboard' },
  { label: 'Catering', icon: 'restaurant-outline', href: '/catering' },
  { label: 'Reviews', icon: 'star-outline', href: '/reviews' },
  { label: 'By City', icon: 'location-outline', href: '/cities' },
];

/** Mobile twin of the web /trucks page. */
export default function TrucksTab() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const inFlightFav = useRef<Set<string>>(new Set());
  const trucksQ = useAsyncData('trucks', fetchTrucks);
  const trucks = trucksQ.data ?? [];
  const favsQ = useAsyncData(userId ? `favorites:${userId}` : null, () => fetchFavorites(userId!));
  const favorites = (userId && favsQ.data) || NO_FAVORITES;
  // A follow/unfollow on a truck page or in Account should show here on return.
  useRefreshOnRefocus(favsQ.reload);
  const [search, setSearch] = useState('');
  const [openNow, setOpenNow] = useState(true);
  const [cuisine, setCuisine] = useState('All');
  const [dietary, setDietary] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function toggleFavorite(truckId: string) {
    if (!userId) { router.push('/(auth)/login'); return; }
    if (inFlightFav.current.has(truckId)) return;
    inFlightFav.current.add(truckId);
    const was = favorites.has(truckId);
    const flip = (on: boolean) => favsQ.setData((prev) => {
      const next = new Set(prev ?? []);
      if (on) next.add(truckId); else next.delete(truckId);
      return next;
    });
    flip(!was);
    try {
      const { error } = was
        ? await supabase.from('follows').delete().eq('truck_id', truckId).eq('user_id', userId)
        : await supabase.from('follows').insert({ truck_id: truckId, user_id: userId });
      if (error) flip(was);
    } catch {
      flip(was);
    } finally {
      inFlightFav.current.delete(truckId);
    }
  }

  const q = search.trim().toLowerCase();
  const filtered = trucks.filter((t) => {
    if (openNow && !t.is_live) return false;
    if (cuisine !== 'All' && t.cuisine !== cuisine) return false;
    if (q && !(t.name ?? '').toLowerCase().includes(q) && !(t.cuisine ?? '').toLowerCase().includes(q)) return false;
    if (dietary.length > 0 && !dietary.every((d) => (t.dietary_tags ?? []).includes(d))) return false;
    return true;
  });
  const activeFilterCount = dietary.length + (cuisine !== 'All' ? 1 : 0) + (openNow ? 1 : 0);

  // Top five by followers, from the list already loaded.
  const topTrucks = [...trucks]
    .map((t) => ({ ...t, followers: Number(t.follows_agg?.[0]?.count ?? 0) }))
    .filter((t) => t.followers > 0)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, 5);

  function clearAll() {
    setSearch(''); setCuisine('All'); setDietary([]); setOpenNow(false);
  }

  if (trucksQ.loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  if (trucksQ.error && trucks.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load trucks</Text>
        <TouchableOpacity onPress={trucksQ.reload} style={{ marginTop: 12 }} accessibilityRole="button" accessibilityLabel="Retry loading trucks">
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const header = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLinks}>
        {QUICK_LINKS.map((l) => (
          <TouchableOpacity key={l.label} style={styles.quickLink} onPress={() => router.push(l.href)} accessibilityRole="link">
            <Ionicons name={l.icon} size={15} color={Colors.primary} />
            <Text style={styles.quickLinkText}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {topTrucks.length > 0 && !q && (
        <View style={styles.topSection}>
          <View style={styles.topHeader}>
            <Text style={styles.topTitle}>Top Trucks</Text>
            <TouchableOpacity onPress={() => router.push('/leaderboard')}><Text style={styles.topMore}>Leaderboards →</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
            {topTrucks.map((t, i) => (
              <TouchableOpacity key={t.id} style={styles.topCard} onPress={() => router.push(`/truck/${t.id}`)} activeOpacity={0.8} accessibilityLabel={`${t.name}, ${t.followers} followers`}>
                <Text style={styles.topRank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</Text>
                <TruckPhoto uri={t.profile_photo} size={52} radius={26} />
                <Text style={styles.topName} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.topFollowers}>{t.followers} followers</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.results}>
        <Text style={styles.resultsText}>
          <Text style={{ fontWeight: '800', color: T.n900 }}>{filtered.length}</Text> food truck{filtered.length !== 1 ? 's' : ''} found
          {openNow ? ' · open now' : ''}{cuisine !== 'All' ? ` · ${cuisine}` : ''}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Search + filter bar */}
      <View style={styles.barWrap}>
        <View style={styles.bar}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={17} color={T.n400} />
            <TextInput
              style={styles.search}
              placeholder="Search by name or cuisine..."
              placeholderTextColor={T.n400}
              value={search}
              onChangeText={setSearch}
              autoComplete="off"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search food trucks by name or cuisine"
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn} accessibilityLabel="Clear search">
                <Ionicons name="close" size={12} color={T.n600} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setShowFilters(!showFilters)}
                style={[styles.filterBtn, (showFilters || activeFilterCount > 0) && { backgroundColor: Colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Filters"
              >
                <Ionicons name="funnel" size={11} color={showFilters || activeFilterCount > 0 ? '#fff' : T.n600} />
                <Text style={[styles.filterText, (showFilters || activeFilterCount > 0) && { color: '#fff' }]}>
                  {activeFilterCount > 0 ? `${activeFilterCount} Active` : 'Filter'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.divider} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPills} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setOpenNow(!openNow)} style={[styles.pill, openNow ? styles.pillRed : styles.pillOff]} accessibilityState={{ selected: openNow }}>
              <View style={[styles.pillDot, { backgroundColor: openNow ? '#fff' : T.n400 }]} />
              <Text style={[styles.pillText, openNow && { color: '#fff' }]}>Open Now</Text>
            </TouchableOpacity>
            {CUISINES.filter((c) => c !== 'All').slice(0, 5).map((c) => (
              <TouchableOpacity key={c} onPress={() => setCuisine(cuisine === c ? 'All' : c)} style={[styles.pill, cuisine === c ? styles.pillDark : styles.pillOff]} accessibilityState={{ selected: cuisine === c }}>
                <Text style={[styles.pillText, cuisine === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showFilters && (
            <View style={styles.expanded}>
              <Text style={styles.expandedLabel}>CUISINE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CUISINES.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setCuisine(c)} style={[styles.pill, cuisine === c ? styles.pillDark : styles.pillOff]}>
                    <Text style={[styles.pillText, cuisine === c && { color: '#fff' }]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[styles.expandedLabel, { marginTop: 12 }]}>DIETARY</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {DIETARY.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDietary(dietary.includes(d) ? dietary.filter((x) => x !== d) : [...dietary, d])}
                    style={[styles.pill, dietary.includes(d) ? styles.pillRed : styles.pillOff]}
                  >
                    <Text style={[styles.pillText, dietary.includes(d) && { color: '#fff' }]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={() => { setDietary([]); setCuisine('All'); setOpenNow(false); }} style={{ marginTop: 12 }}>
                  <Text style={styles.clearAll}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <TruckCard
            truck={item}
            address={item.locations?.[0]?.address ?? null}
            followerCount={Number(item.follows_agg?.[0]?.count ?? 0)}
            favorite={favorites.has(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await Promise.all([trucksQ.reload(), favsQ.reload()]); setRefreshing(false); }} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons name="bus-outline" size={34} color={T.n300} /></View>
            <Text style={styles.emptyTitle}>No trucks found</Text>
            <Text style={styles.emptyBody}>
              {openNow
                ? 'No trucks are open right now. Turn off Open Now to browse all trucks.'
                : search
                  ? `No results for "${search}". Try a broader search or clear your filters.`
                  : 'No trucks match your current filters. Try adjusting or clearing them.'}
            </Text>
            <Text style={styles.emptyNote}>New trucks are added regularly — check back soon!</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={clearAll} accessibilityRole="button">
              <Text style={styles.emptyBtnText}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.n100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  retry: { color: Colors.primary, fontWeight: '600', fontSize: 15 },

  barWrap: { backgroundColor: T.n50, borderBottomWidth: 1, borderBottomColor: T.n200, paddingHorizontal: 16, paddingVertical: 10 },
  bar: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 2 },
  search: { flex: 1, paddingHorizontal: 10, paddingVertical: 11, fontSize: 15, color: T.n800 },
  clearBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  filterText: { fontSize: 12, fontWeight: '700', color: T.n600 },
  divider: { height: 1, backgroundColor: T.n100, marginHorizontal: 14 },
  quickPills: { gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pillOff: { backgroundColor: T.n100 },
  pillRed: { backgroundColor: Colors.primary },
  pillDark: { backgroundColor: T.n900 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '700', color: T.n600 },
  expanded: { borderTopWidth: 1, borderTopColor: T.n100, paddingHorizontal: 14, paddingVertical: 12 },
  expandedLabel: { fontSize: 11, fontWeight: '900', color: T.n400, letterSpacing: 1.4, marginBottom: 8 },
  clearAll: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  quickLinks: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  quickLink: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999,
    borderWidth: 1, borderColor: T.n200, paddingHorizontal: 12, paddingVertical: 7,
  },
  quickLinkText: { fontSize: 12, fontWeight: '700', color: T.n700 },

  topSection: { paddingBottom: 12 },
  topHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  topTitle: { fontSize: 15, fontWeight: '900', color: T.n900 },
  topMore: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  topCard: { width: 118, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.n200, gap: 4 },
  topRank: { position: 'absolute', top: 6, left: 8, fontSize: 13 },
  topName: { fontSize: 12, fontWeight: '700', color: T.n900, textAlign: 'center', marginTop: 4 },
  topFollowers: { fontSize: 11, fontWeight: '600', color: Colors.primary },

  results: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: T.n100, borderTopWidth: 1, borderTopColor: T.n100 },
  resultsText: { fontSize: 14, color: T.n600 },

  empty: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 24 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: T.n200, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: T.n800, marginBottom: 4 },
  emptyBody: { fontSize: 14, color: T.n400, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  emptyNote: { fontSize: 12, color: T.n300, marginTop: 4, marginBottom: 18 },
  emptyBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
