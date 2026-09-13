import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useMyTruck } from '@/hooks/useMyTruck';
import { useAsyncData, useRefreshOnRefocus } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import {
  Button, EmptyState, ErrorState, LoadingState, Pill, T, Toast, s as ui, useToast,
} from '@/components/ui';
import { REQUEST_COLS, STATUS_CHIP, eventDate, type CateringRequest } from '@/lib/catering';

const FILTERS = ['all', 'pending', 'confirmed', 'declined', 'completed'] as const;

async function fetchRequests(truckId: string): Promise<CateringRequest[]> {
  const { data, error } = await supabase.from('catering_requests').select(REQUEST_COLS)
    .eq('truck_id', truckId).order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as CateringRequest[];
}

/** Mobile twin of /dashboard/catering. */
export default function CateringRequestsScreen() {
  const router = useRouter();
  const { session, truck, setTruck, loading: truckLoading, error: truckError, reload } = useMyTruck();
  const truckId = truck?.id ?? null;
  const q = useAsyncData(truckId ? `catering:${truckId}` : null, () => fetchRequests(truckId!));
  const requests = q.data ?? [];
  const reloadRequests = q.reload;
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [toggling, setToggling] = useState(false);
  const { toast, show } = useToast();

  // Refresh when coming back from a request, so a status changed there shows here.
  useRefreshOnRefocus(reloadRequests);

  async function toggleCatering(next: boolean) {
    if (!truck || !session?.user || toggling) return;
    setToggling(true);
    setTruck({ ...truck, offers_catering: next }); // optimistic
    try {
      const { error } = await supabase.from('trucks').update({ offers_catering: next }).eq('id', truck.id).eq('owner_id', session.user.id);
      if (error) throw error;
    } catch {
      setTruck({ ...truck, offers_catering: !next });
      show('Could not update catering — please try again.');
    } finally {
      setToggling(false);
    }
  }

  if (truckLoading) return <LoadingState label="Loading requests..." />;
  if (truckError) return <ErrorState title="Couldn't load your truck" message="Check your connection and try again." onRetry={reload} />;
  if (!truck) return <EmptyState icon="bus-outline" title="No truck on this account" />;
  if (q.loading) return <LoadingState label="Loading requests..." />;
  if (q.error && requests.length === 0) return <ErrorState title="Could not load catering requests" message="Check your connection and try again." onRetry={q.reload} />;

  const enabled = !!truck.offers_catering;
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === 'all' ? requests.length : requests.filter((r) => r.status === f).length]));
  const filtered = requests.filter((r) => filter === 'all' || r.status === filter);

  return (
    <View style={ui.screen}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await q.reload(); setRefreshing(false); }} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>CATERING REQUESTS</Text>
          <Text style={styles.sub}>{counts.pending} pending · {counts.confirmed} confirmed</Text>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>ACCEPT CATERING</Text>
              <Text style={styles.toggleDesc}>{enabled ? 'Visible on catering page' : 'Hidden from catering page'}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={toggleCatering}
              disabled={toggling}
              trackColor={{ true: Colors.primary, false: T.n200 }}
              thumbColor="#fff"
              ios_backgroundColor={T.n200}
              accessibilityLabel="Accept catering"
            />
          </View>
          <View style={styles.links}>
            <Button title="Manage Packages" onPress={() => router.push('/dashboard/catering/packages')} small style={{ borderRadius: 999 }} />
            <Button title="Edit Catering Info" variant="outline" onPress={() => router.push('/dashboard/catering/packages')} small style={{ borderRadius: 999, borderWidth: 1, borderColor: T.n200 }} />
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
          {FILTERS.map((f) => (
            <Pill key={f} label={f.toUpperCase()} active={filter === f} count={counts[f]} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <EmptyState icon="people-outline" title="No requests yet" message={enabled ? 'Requests will appear here' : 'Enable catering to receive requests'} />
        ) : (
          <View style={styles.list}>
            {filtered.map((r, i) => {
              const chip = STATUS_CHIP[r.status] ?? STATUS_CHIP.pending;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.row, i < filtered.length - 1 && ui.rowDivider]}
                  onPress={() => router.push(`/dashboard/catering/${r.id}`)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.name} numberOfLines={1}>{r.customer_name.toUpperCase()}</Text>
                    <Text style={[styles.chip, { color: chip.fg, backgroundColor: chip.bg, borderColor: chip.border }]}>{r.status.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.meta}>{r.event_type ?? 'Event'} · {r.guest_count} guests</Text>
                  <Text style={styles.metaLight}>📅 {eventDate(r.event_date, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  <Text style={styles.metaLight} numberOfLines={1}>📍 {r.event_location}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
      <Toast toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: T.n200 },
  title: { fontSize: 20, fontWeight: '900', color: T.n900, letterSpacing: 0.5 },
  sub: { fontSize: 13, color: T.n400, marginTop: 2 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 },
  toggleLabel: { fontSize: 11, fontWeight: '900', color: T.n500, letterSpacing: 1 },
  toggleDesc: { fontSize: 12, color: T.n400, marginTop: 2 },
  links: { flexDirection: 'row', gap: 8, marginTop: 16 },
  filters: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: T.n100, flexGrow: 0 },
  list: { backgroundColor: '#fff' },
  row: { padding: 16 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 14, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  chip: { fontSize: 10, fontWeight: '900', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  meta: { fontSize: 12, color: T.n500, fontWeight: '500' },
  metaLight: { fontSize: 12, color: T.n400, marginTop: 2 },
});
