import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, Text, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Order } from '@shared/types';

const STATUS_COLOR: Record<Order['status'], string> = {
  pending: Colors.warning,
  preparing: Colors.info,
  ready: Colors.success,
  picked_up: Colors.textSecondary,
};

const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready for Pickup!',
  picked_up: 'Picked Up',
};

export default function OrdersTab() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadOrders = useCallback(async (uid?: string) => {
    const id = uid ?? userId;
    if (!id) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, trucks(name)')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setOrders(data);
    } catch { /* network error — keep existing list */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setUserId(user.id);
        await loadOrders(user.id);

        // Realtime — update order card immediately when operator changes status
        channelRef.current = supabase
          .channel(`customer-orders-${user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'orders',
              filter: `customer_id=eq.${user.id}`,
            },
            (payload) => {
              setOrders((prev) =>
                prev.map((o) => o.id === payload.new.id ? { ...o, ...payload.new } : o)
              );
            }
          )
          .subscribe();
      } catch { setLoading(false); }
    }
    init();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadOrders(userId ?? undefined);
  }, [loadOrders, userId]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={['top', 'bottom']}>
        <Text style={styles.emptyTitle}>Sign in to see your orders</Text>
        <Text style={[styles.emptyBody, { marginBottom: 24 }]}>Create an account to place and track orders</Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
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
              <Text style={styles.truckName}>{(item as any).trucks?.name ?? 'Food Truck'}</Text>
              <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? Colors.textSecondary) + '22' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] ?? Colors.textSecondary }]}>
                  {STATUS_LABEL[item.status] ?? item.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.orderId}>Order #{item.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.items} numberOfLines={2}>
              {(item.items ?? []).map((i: { quantity: number; name: string }) => `${i.quantity}× ${i.name}`).join(', ')}
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
  list: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  truckName: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1, marginRight: 8 },
  orderId: { fontSize: 12, color: Colors.textSecondary },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  items: { fontSize: 14, color: Colors.textSecondary },
  total: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  date: { fontSize: 12, color: Colors.textSecondary },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  signInButton: { backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  signInButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
