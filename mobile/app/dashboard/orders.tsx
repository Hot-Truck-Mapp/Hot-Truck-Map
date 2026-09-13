import { useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { authedFetch } from '@/lib/api';
import { useMyTruck } from '@/hooks/useMyTruck';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import {
  Button, Card, EmptyState, ErrorState, LoadingState, T, Toast, s as ui, shadow, useToast,
} from '@/components/ui';

type OrderItem = { name: string; quantity: number; price: number };
type Order = {
  id: string; truck_id: string; pickup_name: string | null; notes: string | null;
  items: OrderItem[] | null; total: number | null; status: string; created_at: string; customer_id: string | null;
};

const ORDER_COLS = 'id, truck_id, pickup_name, notes, items, total, status, created_at, customer_id';
const GROUPS = ['pending', 'preparing', 'ready', 'picked_up', 'no_show', 'cancelled'] as const;
const LABEL: Record<string, string> = {
  pending: 'New Orders', preparing: 'Preparing', ready: 'Ready for Pickup',
  picked_up: 'Picked Up', no_show: 'No-Shows', cancelled: 'Cancelled',
};
const CHIP: Record<string, { fg: string; bg: string; border: string }> = {
  pending: { fg: '#D97706', bg: T.amber50, border: '#FDE68A' },
  preparing: { fg: T.blue600, bg: T.blue50, border: '#BFDBFE' },
  ready: { fg: T.green600, bg: T.green50, border: '#BBF7D0' },
  picked_up: { fg: T.n400, bg: T.n50, border: T.n200 },
  no_show: { fg: T.red600, bg: T.red50, border: '#FECACA' },
  cancelled: { fg: T.n400, bg: T.n50, border: T.n200 },
};
const EDGE: Record<string, string> = {
  pending: T.amber400, preparing: T.blue400, ready: '#4ADE80', no_show: T.red400,
};

async function fetchOrders(truckId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders').select(ORDER_COLS).eq('truck_id', truckId)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (data ?? []) as Order[];
}

function ago(created: string) {
  const diff = Math.floor((Date.now() - new Date(created).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/** Mobile twin of the web dashboard's Orders tab. */
export default function OperatorOrdersScreen() {
  const { truck, loading: truckLoading, error: truckError, reload } = useMyTruck();
  const truckId = truck?.id ?? null;
  const mountedRef = useRef(true);
  const ordersQ = useAsyncData(truckId ? `orders:${truckId}` : null, () => fetchOrders(truckId!));
  const orders = ordersQ.data ?? [];
  const setOrders = ordersQ.setData;
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Real-time: new orders appear without a refresh, same as the web tab.
  useEffect(() => {
    if (!truckId) return;
    const channel = supabase
      .channel(`orders-app-${truckId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `truck_id=eq.${truckId}` }, (payload) => {
        const order = payload.new as Order;
        if (order?.truck_id !== truckId) return; // guard against a filter bypass
        setOrders((prev = []) => [order, ...prev.filter((o) => o.id !== order.id)].slice(0, 100));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `truck_id=eq.${truckId}` }, (payload) => {
        const order = payload.new as Order;
        if (order?.truck_id !== truckId) return;
        setOrders((prev = []) => prev.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [truckId, setOrders]);

  async function updateStatus(order: Order, status: 'preparing' | 'ready' | 'picked_up' | 'no_show') {
    if (!truck || updatingId) return;
    setUpdatingId(order.id);
    try {
      const { error } = await supabase.from('orders').update({ status }).eq('id', order.id).eq('truck_id', truck.id);
      if (error) { show('Failed to update order status — please try again'); return; }
      if (!mountedRef.current) return;
      setOrders((prev = []) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
      if (order.customer_id) {
        // Fire-and-forget, like the web: a failed push must not undo the update.
        authedFetch('/api/notify-customer', {
          method: 'POST',
          body: JSON.stringify({ customer_id: order.customer_id, order_id: order.id, status, truck_name: truck.name }),
        }).catch(() => {});
      }
    } catch {
      show('Failed to update order status — check your connection');
    } finally {
      if (mountedRef.current) setUpdatingId(null);
    }
  }

  function confirmNoShow(order: Order) {
    Alert.alert('Mark as no-show?', 'This counts as a strike against the customer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'No Show', style: 'destructive', onPress: () => { void updateStatus(order, 'no_show'); } },
    ]);
  }

  // The web downloads a .csv; on a phone the share sheet is the equivalent —
  // it can save to Files, AirDrop, or send it by email.
  async function exportCsv() {
    if (!truck || exporting) return;
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('orders').select('id, pickup_name, items, total, status, created_at')
        .eq('truck_id', truck.id).order('created_at', { ascending: false }).limit(5000);
      if (error) throw new Error(error.message);
      const rows = [['Order ID', 'Customer Name', 'Items', 'Total', 'Status', 'Date'].join(',')];
      for (const o of data ?? []) {
        const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
        rows.push([
          o.id,
          JSON.stringify(o.pickup_name ?? ''),
          JSON.stringify(items.map((i) => `${i.quantity}x ${i.name}`).join('; ')),
          (o.total ?? 0).toFixed(2),
          o.status,
          JSON.stringify(new Date(o.created_at).toLocaleString()),
        ].join(','));
      }
      await Share.share({ title: `orders-${new Date().toISOString().slice(0, 10)}.csv`, message: rows.join('\n') });
    } catch (err) {
      show('Export failed: ' + (err instanceof Error ? err.message : 'Please try again.'));
    } finally {
      if (mountedRef.current) setExporting(false);
    }
  }

  if (truckLoading) return <LoadingState label="Loading orders..." />;
  if (truckError) return <ErrorState title="Couldn't load your truck" message="Check your connection and try again." onRetry={reload} />;
  if (!truck) return <EmptyState icon="bus-outline" title="No truck on this account" message="Orders appear here once you've listed a truck." />;
  if (ordersQ.loading) return <LoadingState label="Loading orders..." />;

  return (
    <View style={ui.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await ordersQ.reload(); setRefreshing(false); }} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Incoming Orders</Text>
            <Text style={styles.subtitle}>Updates in real time — no refresh needed</Text>
          </View>
          {orders.length > 0 && (
            <View style={styles.totalChip}><Text style={styles.totalChipText}>{orders.length} total</Text></View>
          )}
        </View>
        <Button title={exporting ? 'Exporting...' : '⤓  Export CSV'} onPress={exportCsv} loading={exporting} variant="dark" small style={styles.export} />

        {ordersQ.error && orders.length === 0 ? (
          <ErrorState title="Could not load orders" message="Pull down to try again." />
        ) : orders.length === 0 ? (
          <Card style={{ paddingVertical: 8 }}>
            <EmptyState icon="bag-handle-outline" title="No orders yet" message="When customers place orders from your menu, they'll appear here instantly." />
          </Card>
        ) : (
          GROUPS.map((group) => {
            const list = orders.filter((o) => o.status === group);
            if (list.length === 0) return null;
            const chip = CHIP[group];
            return (
              <View key={group} style={{ marginBottom: 8 }}>
                <View style={[styles.groupChip, { backgroundColor: chip.bg, borderColor: chip.border }]}>
                  <Text style={[styles.groupChipText, { color: chip.fg }]}>{LABEL[group].toUpperCase()} · {list.length}</Text>
                </View>
                {list.map((order) => {
                  const items = Array.isArray(order.items) ? order.items : [];
                  const busy = updatingId === order.id;
                  return (
                    <View key={order.id} style={[styles.order, { borderLeftColor: EDGE[order.status] ?? T.n200 }]}>
                      <View style={styles.orderHead}>
                        <View style={{ flex: 1 }}>
                          <View style={styles.nameRow}>
                            <Text style={styles.customer}>{order.pickup_name ?? 'Customer'}</Text>
                            <Text style={styles.orderId}>#{order.id.slice(0, 6).toUpperCase()}</Text>
                          </View>
                          <Text style={styles.ago}>{ago(order.created_at)}</Text>
                        </View>
                        <Text style={styles.total}>${(order.total ?? 0).toFixed(2)}</Text>
                      </View>
                      <View style={styles.items}>
                        {items.map((item, i) => (
                          <View key={i} style={styles.itemRow}>
                            <Text style={styles.itemName}><Text style={styles.qty}>{item.quantity}× </Text>{item.name}</Text>
                            <Text style={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</Text>
                          </View>
                        ))}
                        {order.notes ? <Text style={styles.notes}>📝 {order.notes}</Text> : null}
                      </View>
                      {order.status === 'pending' && (
                        <Button title={busy ? 'Updating...' : 'Start Preparing'} variant="blue" onPress={() => updateStatus(order, 'preparing')} disabled={busy} style={styles.action} />
                      )}
                      {order.status === 'preparing' && (
                        <Button title={busy ? 'Updating...' : 'Mark Ready'} variant="green" onPress={() => updateStatus(order, 'ready')} disabled={busy} style={styles.action} />
                      )}
                      {order.status === 'ready' && (
                        <View style={[styles.action, { flexDirection: 'row', gap: 8 }]}>
                          <Button title={busy ? 'Updating...' : 'Picked Up ✓'} variant="dark" onPress={() => updateStatus(order, 'picked_up')} disabled={busy} style={{ flex: 1 }} />
                          <Button title="No Show" variant="danger" onPress={() => confirmNoShow(order)} disabled={busy} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
      <Toast toast={toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { fontSize: 20, fontWeight: '900', color: T.n800 },
  subtitle: { fontSize: 12, color: T.n400, marginTop: 2 },
  totalChip: { backgroundColor: T.n200, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  totalChipText: { fontSize: 12, fontWeight: '700', color: T.n500 },
  export: { alignSelf: 'flex-start', marginBottom: 16 },
  groupChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  groupChipText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  order: { backgroundColor: '#fff', borderRadius: 16, borderLeftWidth: 4, marginBottom: 12, overflow: 'hidden', ...shadow },
  orderHead: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, paddingBottom: 12, gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  customer: { fontSize: 16, fontWeight: '900', color: T.n900 },
  orderId: { fontSize: 10, fontWeight: '700', color: T.n400, backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  ago: { fontSize: 12, color: T.n400, marginTop: 2 },
  total: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  items: { borderTopWidth: 1, borderTopColor: T.n50, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 14, color: T.n700, flex: 1 },
  qty: { fontWeight: '700', color: T.n400 },
  itemPrice: { fontSize: 14, color: T.n400 },
  notes: { fontSize: 12, color: T.amber700, backgroundColor: T.amber50, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4, overflow: 'hidden' },
  action: { marginHorizontal: 16, marginBottom: 16 },
});
