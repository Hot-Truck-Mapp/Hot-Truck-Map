import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useMyTruck } from '@/hooks/useMyTruck';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import { EmptyState, ErrorState, LoadingState, T, s as ui, shadow } from '@/components/ui';

type Range = 'weekly' | 'monthly' | 'yearly';
type Bucket = { label: string; start: Date; end: Date };
type Point = { label: string; followers: number; orders: number };

const RANGE_LABEL: Record<Range, string> = { weekly: 'This Week', monthly: 'This Month', yearly: 'This Year' };
const PERIOD_NOTE: Record<Range, string> = { weekly: 'past 7 days', monthly: 'past 30 days', yearly: 'past 12 months' };
const CHART_NOTE: Record<Range, string> = {
  weekly: 'Day by day this week', monthly: 'Week by week this month', yearly: 'Month by month this year',
};

/** Same bucketing as the web dashboard's loadAnalytics(). */
function buckets(r: Range): { start: Date; buckets: Bucket[] } {
  const now = new Date();
  const out: Bucket[] = [];
  let start: Date;
  if (r === 'weekly') {
    start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const s = new Date(d); s.setHours(0, 0, 0, 0);
      const e = new Date(d); e.setHours(23, 59, 59, 999);
      out.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), start: s, end: e });
    }
  } else if (r === 'monthly') {
    start = new Date(now); start.setDate(start.getDate() - 27); start.setHours(0, 0, 0, 0);
    for (let i = 3; i >= 0; i--) {
      const e = new Date(now); e.setDate(e.getDate() - i * 7); e.setHours(23, 59, 59, 999);
      const s = new Date(e); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
      out.push({ label: `Wk ${4 - i}`, start: s, end: e });
    }
  } else {
    start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), start: d, end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999) });
    }
  }
  return { start, buckets: out };
}

type Analytics = {
  totals: { followers: number; orders: number; revenue: number };
  period: { followers: number; orders: number; views: number; revenue: number };
  chart: Point[];
};

/** Same queries as the web dashboard's loadAnalytics(). */
async function fetchAnalytics(id: string, r: Range): Promise<Analytics> {
  const { start, buckets: bs } = buckets(r);
  const since = start.toISOString();
  const [fw, or, vw, totalFollows, allOrders, allRevenue] = await Promise.all([
    supabase.from('follows').select('created_at').eq('truck_id', id).gte('created_at', since).limit(2000),
    supabase.from('orders').select('created_at,total,status').eq('truck_id', id).gte('created_at', since).limit(2000),
    supabase.from('truck_views').select('created_at').eq('truck_id', id).gte('created_at', since).limit(5000),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('truck_id', id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('truck_id', id),
    supabase.from('orders').select('total').eq('truck_id', id).eq('status', 'picked_up').limit(10000),
  ]);
  const firstError = [fw, or, totalFollows, allOrders, allRevenue].find((res) => res.error)?.error;
  if (firstError) throw firstError;
  const follows = fw.data ?? [], orders = or.data ?? [], views = vw.data ?? [];
  const within = (d: string, b: Bucket) => { const t = new Date(d); return t >= b.start && t <= b.end; };
  return {
    totals: {
      followers: totalFollows.count ?? 0,
      orders: allOrders.count ?? 0,
      revenue: (allRevenue.data ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0),
    },
    chart: bs.map((b) => ({
      label: b.label,
      followers: follows.filter((f) => within(f.created_at, b)).length,
      orders: orders.filter((o) => within(o.created_at, b)).length,
    })),
    period: {
      followers: follows.length,
      orders: orders.length,
      views: views.length,
      revenue: orders.filter((o) => o.status === 'picked_up').reduce((sum, o) => sum + (o.total ?? 0), 0),
    },
  };
}

function BarChart({ data }: { data: Point[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.followers, d.orders]));
  const ticks = [max, Math.round(max / 2), 0];
  return (
    <View>
      <View style={styles.chart}>
        <View style={styles.yAxis}>
          {ticks.map((t, i) => <Text key={i} style={styles.axisText}>{t}</Text>)}
        </View>
        <View style={styles.plot}>
          {[0, 1, 2].map((i) => <View key={i} style={[styles.gridLine, { top: `${i * 50}%` }]} />)}
          {data.map((d) => (
            <View key={d.label} style={styles.group}>
              <View style={styles.bars}>
                <View style={[styles.bar, { height: `${(d.followers / max) * 100}%`, backgroundColor: Colors.primary }]} />
                <View style={[styles.bar, { height: `${(d.orders / max) * 100}%`, backgroundColor: T.orange400 }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.xAxis}>
        {data.map((d) => <Text key={d.label} style={[styles.axisText, styles.xLabel]} numberOfLines={1}>{d.label}</Text>)}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: Colors.primary }]} /><Text style={styles.legendText}>New Followers</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: T.orange400 }]} /><Text style={styles.legendText}>Orders</Text></View>
      </View>
    </View>
  );
}

/** Mobile twin of the web dashboard's Analytics tab. */
export default function AnalyticsScreen() {
  const { truck, loading: truckLoading, error: truckError, reload } = useMyTruck();
  const truckId = truck?.id ?? null;
  const [range, setRange] = useState<Range>('weekly');
  const [refreshing, setRefreshing] = useState(false);
  const q = useAsyncData(truckId ? `analytics:${truckId}:${range}` : null, () => fetchAnalytics(truckId!, range));
  const loading = q.loading;
  const totals = q.data?.totals ?? { followers: 0, orders: 0, revenue: 0 };
  const period = q.data?.period ?? { followers: 0, orders: 0, views: 0, revenue: 0 };
  const chart = q.data?.chart ?? [];

  if (truckLoading) return <LoadingState />;
  if (truckError) return <ErrorState title="Couldn't load your truck" message="Check your connection and try again." onRetry={reload} />;
  if (!truck) return <EmptyState icon="bus-outline" title="No truck on this account" />;
  if (q.error) return <ErrorState title="Could not load analytics" message="Check your connection and try again." onRetry={q.reload} />;

  const hasChartData = chart.some((d) => d.followers > 0 || d.orders > 0);

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await q.reload(); setRefreshing(false); }} tintColor="#fff" />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>ALL TIME</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroCard}>
            <View style={styles.heroCardHead}>
              <View style={[styles.heroIcon, { backgroundColor: 'rgba(232,72,28,0.2)' }]}><Text>👥</Text></View>
              <Text style={styles.heroCardLabel}>Followers</Text>
            </View>
            <Text style={styles.heroValue}>{loading ? '—' : totals.followers.toLocaleString()}</Text>
            <Text style={styles.heroNote}>customers following your truck</Text>
          </View>
          <View style={styles.heroCard}>
            <View style={styles.heroCardHead}>
              <View style={[styles.heroIcon, { backgroundColor: 'rgba(249,115,22,0.2)' }]}><Text>🛍️</Text></View>
              <Text style={styles.heroCardLabel}>Orders</Text>
            </View>
            <Text style={styles.heroValue}>{loading ? '—' : totals.orders.toLocaleString()}</Text>
            <Text style={styles.heroNote}>total orders placed</Text>
          </View>
        </View>
        <View style={styles.revenue}>
          <Text style={styles.revenueLabel}>$  Total Revenue</Text>
          <Text style={styles.revenueValue}>{loading ? '—' : `$${totals.revenue.toFixed(2)}`}</Text>
        </View>
      </View>

      <View style={{ padding: 16, gap: 16 }}>
        <View style={styles.segment}>
          {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
            <TouchableOpacity key={r} onPress={() => setRange(r)} style={[styles.segmentBtn, range === r && styles.segmentOn]} accessibilityRole="button" accessibilityState={{ selected: range === r }}>
              <Text style={[styles.segmentText, range === r && { color: T.n900 }]}>{RANGE_LABEL[r]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statGrid}>
          {[
            { label: 'New Followers', value: period.followers.toLocaleString(), note: PERIOD_NOTE[range], color: Colors.primary },
            { label: 'Orders', value: period.orders.toLocaleString(), note: PERIOD_NOTE[range], color: T.orange400 },
            { label: 'Revenue', value: `$${period.revenue.toFixed(2)}`, note: 'from orders this period', color: T.green500 },
            { label: 'Profile Views', value: period.views.toLocaleString(), note: 'customers viewed your page', color: T.blue400 },
          ].map((stat) => (
            <View key={stat.label} style={[styles.stat, { borderLeftColor: stat.color }]}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{loading ? '—' : stat.value}</Text>
              <Text style={styles.statNote}>{stat.note}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>Followers & Orders Trend</Text>
          <Text style={styles.chartNote}>{CHART_NOTE[range]}</Text>
          {loading ? (
            <View style={{ height: 180, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: T.n300 }}>Loading…</Text></View>
          ) : hasChartData ? (
            <BarChart data={chart} />
          ) : (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ color: T.n300, fontSize: 14 }}>No data for this period yet</Text>
              <Text style={{ color: T.n300, fontSize: 12, marginTop: 4 }}>Go live and start getting customers!</Text>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: T.n900, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20, gap: 14 },
  heroLabel: { fontSize: 11, fontWeight: '900', color: T.n500, letterSpacing: 1.4 },
  heroRow: { flexDirection: 'row', gap: 12 },
  heroCard: { flex: 1, backgroundColor: T.n800, borderRadius: 16, padding: 14 },
  heroCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  heroIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  heroCardLabel: { fontSize: 12, fontWeight: '700', color: T.n400 },
  heroValue: { fontSize: 34, fontWeight: '900', color: '#fff' },
  heroNote: { fontSize: 11, color: T.n500, marginTop: 4 },
  revenue: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(20,83,45,0.4)', borderWidth: 1, borderColor: 'rgba(21,128,61,0.3)',
  },
  revenueLabel: { fontSize: 14, fontWeight: '700', color: '#4ADE80' },
  revenueValue: { fontSize: 20, fontWeight: '900', color: '#4ADE80' },
  segment: { flexDirection: 'row', backgroundColor: T.n200, borderRadius: 16, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  segmentOn: { backgroundColor: '#fff', ...shadow },
  segmentText: { fontSize: 13, fontWeight: '700', color: T.n400 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { width: '47.5%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderLeftWidth: 4, ...shadow },
  statLabel: { fontSize: 12, fontWeight: '600', color: T.n400, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '900', color: T.n900 },
  statNote: { fontSize: 11, color: T.n400, marginTop: 4 },
  chartCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, ...shadow },
  chartTitle: { fontSize: 14, fontWeight: '900', color: T.n800 },
  chartNote: { fontSize: 12, color: T.n400, marginTop: 2, marginBottom: 16 },
  chart: { flexDirection: 'row', height: 180 },
  yAxis: { width: 26, justifyContent: 'space-between', paddingRight: 4 },
  plot: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: T.n100 },
  group: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: '100%', width: '70%', maxWidth: 40, justifyContent: 'center' },
  bar: { flex: 1, borderTopLeftRadius: 4, borderTopRightRadius: 4, minHeight: 0 },
  xAxis: { flexDirection: 'row', marginLeft: 26, marginTop: 6 },
  xLabel: { flex: 1, textAlign: 'center' },
  axisText: { fontSize: 10, color: T.n400 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: T.n600 },
});
