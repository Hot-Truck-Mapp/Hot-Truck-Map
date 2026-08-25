import { useState } from 'react';
import { StyleSheet, View, FlatList, TextInput, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { USAMapSelector } from '@/components/USAMapSelector';
import { US_STATES, type USState } from '@shared/us-states';

export default function EventsIndexScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const filtered = US_STATES.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase() === q;
  });

  function goToState(code: string) {
    router.push(`/events/${code.toLowerCase()}`);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        numColumns={3}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.mapCard}>
              <USAMapSelector onSelect={goToState} />
              <Text style={styles.mapHint}>Tap a state to see its festivals and events</Text>
            </View>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.search}
                placeholder="Or search states…"
                placeholderTextColor={Colors.textSecondary}
                value={query}
                onChangeText={setQuery}
                clearButtonMode="while-editing"
                autoComplete="off"
                autoCorrect={false}
                accessibilityLabel="Search states"
              />
            </View>
          </View>
        }
        renderItem={({ item }: { item: USState }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => goToState(item.code)}
            activeOpacity={0.7}
          >
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardCode}>{item.code}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No states match &ldquo;{query}&rdquo;</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mapCard: {
    margin: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapHint: { textAlign: 'center', fontSize: 12, color: Colors.textSecondary, marginTop: 8 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
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
  list: { paddingHorizontal: 12, paddingBottom: 32 },
  card: {
    flex: 1 / 3,
    margin: 4,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardName: { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  cardCode: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: 48, fontSize: 16 },
});
