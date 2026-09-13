import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { Hero, LoadingState, T, TruckPhoto, s as ui, shadow } from '@/components/ui';

type LeaderTruck = {
  id: string; name: string; cuisine: string | null; profile_photo: string | null;
  avg_rating: number | null; review_count: number | null; follower_count: number; order_count: number;
};
type Tab = 'followed' | 'rated' | 'active';
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'followed', label: 'Most Followed', emoji: '❤️' },
  { id: 'rated', label: 'Highest Rated', emoji: '⭐' },
  { id: 'active', label: 'Most Active', emoji: '🔥' },
];
const RANK_COLORS = ['#E8481C', '#F5A623', '#888888', '#666666', '#555555'];

/** Mobile twin of /trucks/leaderboard — same three rankings, same queries. */
export default function LeaderboardScreen() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [tab, setTab] = useState<Tab>('followed');
  const [lists, setLists] = useState<Record<Tab, LeaderTruck[]>>({ followed: [], rated: [], active: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        const [followedRes, activeRes] = await Promise.all([
          supabase.from('trucks').select('id, name, cuisine, profile_photo, avg_rating, review_count, follows_agg:follows(count)').limit(100),
          supabase.from('trucks').select('id, name, cuisine, profile_photo, avg_rating, review_count, orders_agg:orders(count)').limit(100),
        ]);
        type Row = Omit<LeaderTruck, 'follower_count' | 'order_count'> & { follows_agg?: { count: number }[]; orders_agg?: { count: number }[] };
        const withFollows = ((followedRes.data ?? []) as Row[]).map((t) => ({ ...t, follower_count: Number(t.follows_agg?.[0]?.count ?? 0), order_count: 0 }));
        const withOrders = ((activeRes.data ?? []) as Row[]).map((t) => ({ ...t, follower_count: 0, order_count: Number(t.orders_agg?.[0]?.count ?? 0) }));
        if (!mountedRef.current) return;
        setLists({
          followed: [...withFollows].sort((a, b) => b.follower_count - a.follower_count).slice(0, 10),
          rated: withFollows.filter((t) => (t.review_count ?? 0) >= 1).sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)).slice(0, 10),
          active: withOrders.filter((t) => t.order_count > 0).sort((a, b) => b.order_count - a.order_count).slice(0, 10),
        });
      } catch {
        // network error — show empty states
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, []);

  function stat(t: LeaderTruck) {
    if (tab === 'followed') return `${t.follower_count} followers`;
    if (tab === 'rated') return `${(t.avg_rating ?? 0).toFixed(1)} ★ (${t.review_count ?? 0})`;
    return `${t.order_count} orders`;
  }

  const list = lists[tab];

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Hero emoji="🏆" title="Truck Leaderboards" subtitle="The top food trucks in the city" />
      <View style={{ padding: 16 }}>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && { backgroundColor: Colors.primary }]} accessibilityRole="button" accessibilityState={{ selected: tab === t.id }}>
              <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
              <Text style={[styles.tabText, tab === t.id && { color: '#fff' }]}>{t.label.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.list}>
          {loading ? (
            <View style={{ height: 200 }}><LoadingState label="Loading leaderboard..." /></View>
          ) : list.length === 0 ? (
            <Text style={styles.empty}>No data yet — check back soon!</Text>
          ) : list.map((t, i) => (
            <TouchableOpacity key={t.id} style={[styles.row, i < list.length - 1 && ui.rowDivider]} onPress={() => router.push(`/truck/${t.id}`)} activeOpacity={0.7}>
              <View style={[styles.rank, { backgroundColor: i < RANK_COLORS.length ? `${RANK_COLORS[i]}22` : T.n100 }]}>
                <Text style={[styles.rankText, { color: i < RANK_COLORS.length ? RANK_COLORS[i] : '#999' }]}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </Text>
              </View>
              <TruckPhoto uri={t.profile_photo} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{t.name.toUpperCase()}</Text>
                <Text style={styles.cuisine}>{t.cuisine ?? 'Food Truck'}</Text>
                <Text style={styles.stat}>{stat(t)}</Text>
              </View>
              <View style={styles.view}><Text style={styles.viewText}>View</Text></View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 20, ...shadow },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12 },
  tabText: { fontSize: 10, fontWeight: '900', color: T.n400, letterSpacing: 0.4 },
  list: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rank: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 13, fontWeight: '900' },
  name: { fontSize: 13, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  cuisine: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginTop: 2 },
  stat: { fontSize: 12, color: T.n400, marginTop: 2 },
  view: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  viewText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  empty: { textAlign: 'center', color: T.n400, fontSize: 14, paddingVertical: 64 },
});
