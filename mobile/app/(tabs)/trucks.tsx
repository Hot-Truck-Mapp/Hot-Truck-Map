import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, TextInput, ActivityIndicator, Text, RefreshControl, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TruckCard } from '@/components/TruckCard';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Truck } from '@shared/types';

type TopTruck = {
  id: string;
  name: string;
  cuisine: string | null;
  profile_photo: string | null;
  follower_count: number;
};

export default function TrucksTab() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [topTrucks, setTopTrucks] = useState<TopTruck[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const loadTrucks = useCallback(async () => {
    setLoadError(false);
    try {
      const { data, error } = await supabase
        .from('trucks')
        .select('id, name, cuisine, description, profile_photo, is_live, dietary_tags, avg_rating, review_count, created_at')
        .order('name')
        .limit(200);
      if (error) throw error;
      if (data && mountedRef.current) setTrucks(data);
    } catch {
      // Only show error banner on initial load — don't discard existing list on refresh failure
      if (mountedRef.current) {
        setTrucks((prev) => {
          if (prev.length === 0) setLoadError(true);
          return prev;
        });
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const loadTopTrucks = useCallback(async () => {
    try {
      // Use PostgREST embedded count — no row scanning of the follows table
      const { data } = await supabase
        .from('trucks')
        .select('id, name, cuisine, profile_photo, follows_agg:follows(count)')
        .limit(100);
      if (!mountedRef.current) return;
      const top: TopTruck[] = (data ?? [])
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          cuisine: t.cuisine,
          profile_photo: t.profile_photo,
          follower_count: Number(t.follows_agg?.[0]?.count ?? 0),
        }))
        .sort((a, b) => b.follower_count - a.follower_count)
        .slice(0, 5);
      if (mountedRef.current) setTopTrucks(top);
    } catch {
      // non-critical — leaderboard row just won't show
    }
  }, []);

  useEffect(() => { loadTrucks(); loadTopTrucks(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTrucks();
  }, [loadTrucks]);

  const filtered = query
    ? trucks.filter(t => {
        const q = query.toLowerCase();
        return (t.name?.toLowerCase() ?? '').includes(q) ||
               (t.cuisine?.toLowerCase() ?? '').includes(q);
      })
    : trucks;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Could not load trucks</Text>
        <TouchableOpacity
          onPress={loadTrucks}
          style={{ marginTop: 12 }}
          accessibilityLabel="Retry loading trucks"
          accessibilityRole="button"
        >
          <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 15 }}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topTrucksHeader = topTrucks.length > 0 ? (
    <View style={styles.leaderboardSection}>
      <Text style={styles.leaderboardTitle}>🏆 Top Trucks</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.leaderboardRow}>
        {topTrucks.map((truck, i) => (
          <TouchableOpacity
            key={truck.id}
            style={styles.leaderboardCard}
            onPress={() => router.push(`/truck/${truck.id}` as any)}
            activeOpacity={0.8}
            accessibilityLabel={`${truck.name}, ${truck.follower_count} followers`}
            accessibilityRole="button"
          >
            <View style={styles.leaderboardCardRank}>
              <Text style={styles.leaderboardRankText}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</Text>
            </View>
            <View style={styles.leaderboardCardPhoto}>
              {truck.profile_photo ? (
                <Image source={{ uri: truck.profile_photo }} style={styles.leaderboardCardPhotoImg} />
              ) : (
                <Text style={styles.leaderboardCardPhotoPlaceholder}>🚚</Text>
              )}
            </View>
            <Text style={styles.leaderboardCardName} numberOfLines={1}>{truck.name}</Text>
            {truck.cuisine ? (
              <Text style={styles.leaderboardCardCuisine} numberOfLines={1}>{truck.cuisine}</Text>
            ) : null}
            <Text style={styles.leaderboardCardFollowers}>{truck.follower_count} followers</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.search}
          placeholder="Search trucks or cuisine…"
          placeholderTextColor={Colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoComplete="off"
          autoCorrect={false}
          accessibilityLabel="Search food trucks by name or cuisine"
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TruckCard truck={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={topTrucksHeader}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {query ? 'No trucks match your search' : 'No trucks yet'}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  searchContainer: { padding: 16, paddingBottom: 8 },
  search: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 48, fontSize: 16 },

  // Leaderboard row
  leaderboardSection: { paddingHorizontal: 16, paddingVertical: 12 },
  leaderboardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 10 },
  leaderboardRow: { gap: 10, paddingBottom: 4 },
  leaderboardCard: {
    width: 120,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leaderboardCardRank: { position: 'absolute', top: 8, left: 8 },
  leaderboardRankText: { fontSize: 14 },
  leaderboardCardPhoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 8, marginTop: 4 },
  leaderboardCardPhotoImg: { width: '100%', height: '100%' },
  leaderboardCardPhotoPlaceholder: { fontSize: 24 },
  leaderboardCardName: { fontSize: 12, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  leaderboardCardCuisine: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  leaderboardCardFollowers: { fontSize: 11, color: Colors.primary, fontWeight: '600', marginTop: 4, textAlign: 'center' },
});
