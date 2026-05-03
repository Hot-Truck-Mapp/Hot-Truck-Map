import { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Order } from '@shared/types';

const STATUS_COLOR: Record<Order['status'], string> = {
  pending: Colors.warning,
  preparing: Colors.info,
  ready: Colors.success,
  picked_up: Colors.textSecondary,
};

export default function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) return;
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });
        if (error) console.warn('Failed to load orders:', error.message);
        if (data) setOrders(data);
      } catch { /* network error — keep empty list */ } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.heading}>My Orders</Text>}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyBody}>Find a food truck and place your first order</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.orderId}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? Colors.textSecondary) + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] ?? Colors.textSecondary }]}>
                  {item.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.items} numberOfLines={2}>
              {item.items.map(i => `${i.quantity}× ${i.name}`).join(', ')}
            </Text>
            <View style={styles.cardRow}>
              <Text style={styles.total}>${(item.total ?? 0).toFixed(2)}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  heading: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: '600', color: Colors.text },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  items: { fontSize: 14, color: Colors.textSecondary },
  total: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  date: { fontSize: 12, color: Colors.textSecondary },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
