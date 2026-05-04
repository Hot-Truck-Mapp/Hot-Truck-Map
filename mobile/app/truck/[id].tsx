import { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, Image, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Truck, MenuItem, Location } from '@shared/types';

type TruckDetail = Truck & {
  location?: Location;
  menu_items?: MenuItem[];
};

export default function TruckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [truck, setTruck] = useState<TruckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    async function load() {
      try {
        const [truckRes, menuRes, locationRes] = await Promise.all([
          supabase.from('trucks').select('*').eq('id', id).maybeSingle(),
          supabase.from('menu_items').select('*').eq('truck_id', id).eq('is_sold_out', false),
          supabase
            .from('locations')
            .select('*')
            .eq('truck_id', id)
            .order('broadcasted_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (truckRes.data) {
          navigation.setOptions({ title: truckRes.data.name });
          setTruck({
            ...truckRes.data,
            menu_items: menuRes.data ?? [],
            location: locationRes.data ?? undefined,
          });
        }
      } catch {
        // network error — "Truck not found" state will show
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      supabase
        .from('follows')
        .select('truck_id')
        .eq('user_id', user.id)
        .eq('truck_id', id)
        .maybeSingle()
        .then(({ data }) => setFollowing(!!data));
    });
  }, [id]);

  async function toggleFollow() {
    if (!userId) { Alert.alert('Sign in required', 'Please sign in to follow trucks.'); return; }

    if (following) {
      setFollowing(false); // optimistic
      const { error } = await supabase.from('follows').delete().eq('user_id', userId).eq('truck_id', id);
      if (error) { setFollowing(true); Alert.alert('Error', 'Could not unfollow. Please try again.'); }
    } else {
      setFollowing(true); // optimistic
      const { error } = await supabase.from('follows').insert({ user_id: userId, truck_id: id });
      if (error) { setFollowing(false); Alert.alert('Error', 'Could not follow. Please try again.'); }
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!truck) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Truck not found</Text>
      </View>
    );
  }

  const isLive = truck.is_live && truck.location
    ? Date.now() - new Date(truck.location.broadcasted_at).getTime() < 30 * 60 * 1000
    : false;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {truck.profile_photo ? (
        <Image source={{ uri: truck.profile_photo }} style={styles.hero} />
      ) : (
        <View style={[styles.hero, styles.heroPlaceholder]} />
      )}

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{truck.name}</Text>
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          )}
        </View>

        {truck.cuisine ? <Text style={styles.cuisine}>{truck.cuisine}</Text> : null}

        {truck.description ? (
          <Text style={styles.description}>{truck.description}</Text>
        ) : null}

        {isLive && truck.location && (
          <View style={styles.locationBox}>
            <Text style={styles.locationLabel}>Current location</Text>
            <Text style={styles.locationAddress}>{truck.location.address}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.followButton, following && styles.followButtonActive]}
          onPress={toggleFollow}
        >
          <Text style={[styles.followButtonText, following && styles.followButtonTextActive]}>
            {following ? '✓ Following' : '+ Follow'}
          </Text>
        </TouchableOpacity>

        {(truck.menu_items?.length ?? 0) > 0 && (
          <>
            <Text style={styles.menuHeading}>Menu</Text>
            {truck.menu_items?.map(item => (
              <View key={item.id} style={styles.menuItem}>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                </View>
                <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 100 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: 16 },
  hero: { width: '100%', height: 220 },
  heroPlaceholder: { backgroundColor: Colors.border },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: '800', color: Colors.text, flex: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveText: { fontSize: 12, fontWeight: '600', color: Colors.success },
  cuisine: { fontSize: 16, color: Colors.textSecondary, marginBottom: 12 },
  description: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 16 },
  locationBox: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginBottom: 16 },
  locationLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  locationAddress: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  followButton: {
    borderWidth: 2, borderColor: Colors.primary,
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginBottom: 24,
  },
  followButtonActive: { backgroundColor: Colors.primary },
  followButtonText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  followButtonTextActive: { color: '#fff' },
  menuHeading: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuItemInfo: { flex: 1, paddingRight: 12 },
  menuItemName: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  menuItemDesc: { fontSize: 13, color: Colors.textSecondary },
  menuItemPrice: { fontSize: 15, fontWeight: '700', color: Colors.primary },
});
