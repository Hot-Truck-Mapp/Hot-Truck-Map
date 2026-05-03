import { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TextInput, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TruckCard } from '@/components/TruckCard';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Truck } from '@shared/types';

export default function TrucksTab() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('trucks')
      .select('*')
      .order('name')
      .then(({ data, error }) => {
        if (error) console.warn('Failed to load trucks:', error.message);
        if (data) setTrucks(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = query
    ? trucks.filter(t => {
        const q = query.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.cuisine.toLowerCase().includes(q);
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
        ListEmptyComponent={
          <Text style={styles.empty}>No trucks found</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { padding: 16 },
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
  list: { paddingBottom: 16 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 48, fontSize: 16 },
});
