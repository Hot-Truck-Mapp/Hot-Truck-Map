import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, FlatList, TextInput, ActivityIndicator, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TruckCard } from '@/components/TruckCard';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Truck } from '@shared/types';

export default function TrucksTab() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrucks = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('trucks')
        .select('*')
        .order('name')
        .limit(200);
      if (data) setTrucks(data);
    } catch { /* network error — keep existing list */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTrucks(); }, []);

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
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <TruckCard truck={item} />}
        contentContainerStyle={styles.list}
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
});
