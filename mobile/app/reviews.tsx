import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import { ErrorState, LoadingState, Pill, Stars, T, s as ui, shadow } from '@/components/ui';

type Review = {
  id: string; rating: number; comment: string | null; created_at: string; truck_id: string;
  truck_name?: string; truck_cuisine?: string | null;
};
type Filter = 'all' | '5' | '4+' | '3+';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: '5', label: '5★' }, { id: '4+', label: '4★+' }, { id: '3+', label: '3★+' },
];

async function fetchReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews').select('id, rating, comment, created_at, truck_id')
    .order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((r) => r.truck_id))];
  const { data: trucks } = ids.length
    ? await supabase.from('trucks').select('id, name, cuisine').in('id', ids)
    : { data: [] as { id: string; name: string; cuisine: string | null }[] };
  const byId = new Map((trucks ?? []).map((t) => [t.id, t]));
  return (data ?? []).map((r) => ({ ...r, truck_name: byId.get(r.truck_id)?.name, truck_cuisine: byId.get(r.truck_id)?.cuisine }));
}

/** Mobile twin of /reviews. */
export default function ReviewsFeedScreen() {
  const router = useRouter();
  const q = useAsyncData('reviews', fetchReviews);
  const reviews = q.data ?? [];
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = reviews.filter((r) =>
    filter === '5' ? r.rating === 5 : filter === '4+' ? r.rating >= 4 : filter === '3+' ? r.rating >= 3 : true);

  return (
    <View style={ui.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Community Reviews</Text>
        <Text style={styles.sub}>Recent reviews from the Hot Truck Map community</Text>
        <View style={styles.filters}>
          {FILTERS.map((f) => <Pill key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} style={{ paddingHorizontal: 16 }} />)}
        </View>
      </View>
      {q.loading ? (
        <LoadingState label="Loading reviews..." />
      ) : q.error ? (
        <ErrorState title="Could not load reviews" message="Check your connection and try again." onRetry={q.reload} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await q.reload(); setRefreshing(false); }} tintColor={Colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>No reviews match this filter.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.top}>
                <View style={{ flex: 1 }}>
                  {item.truck_name ? (
                    <TouchableOpacity onPress={() => router.push(`/truck/${item.truck_id}`)} accessibilityRole="link">
                      <Text style={styles.truck}>{item.truck_name.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ) : <Text style={styles.truck}>Unknown Truck</Text>}
                  {item.truck_cuisine ? <Text style={styles.cuisine}>{item.truck_cuisine}</Text> : null}
                </View>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
              <Stars rating={item.rating} />
              {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: T.n100, padding: 16, paddingTop: 20 },
  title: { fontSize: 24, fontWeight: '900', color: T.n900 },
  sub: { fontSize: 14, color: T.n500, marginTop: 4 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 16, flexWrap: 'wrap' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, ...shadow },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  truck: { fontSize: 14, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  cuisine: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginTop: 2 },
  time: { fontSize: 11, color: T.n400 },
  comment: { fontSize: 14, color: T.n600, lineHeight: 21 },
  empty: { textAlign: 'center', color: T.n400, fontSize: 14, marginTop: 48 },
});
