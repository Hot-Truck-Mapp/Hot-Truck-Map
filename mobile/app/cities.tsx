import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { citiesFrom, fetchLiveTrucks, slugForCity } from '@/lib/cities';
import { Button, Input, LoadingState, PageHeader, SectionLabel, T, s as ui, shadow } from '@/components/ui';

/** Entry point for the app's version of the web's /trucks/[city] pages. */
export default function CitiesScreen() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<{ city: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchLiveTrucks()
      .then((trucks) => { if (mountedRef.current) setCities(citiesFrom(trucks)); })
      .catch(() => {})
      .finally(() => { if (mountedRef.current) setLoading(false); });
    return () => { mountedRef.current = false; };
  }, []);

  function go(city: string) {
    const slug = slugForCity(city);
    if (slug) router.push(`/city/${slug}`);
  }

  return (
    <View style={ui.screen}>
      <PageHeader title="Food Trucks by City" subtitle="See which trucks are live in your town right now" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.search}>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Enter a city or town — e.g. Hoboken"
            returnKeyType="search"
            onSubmitEditing={() => go(query)}
            autoCorrect={false}
            style={{ flex: 1 }}
            accessibilityLabel="City or town"
          />
          <Button title="Search" onPress={() => go(query)} disabled={!query.trim()} small />
        </View>

        <SectionLabel style={{ marginTop: 24 }}>Live right now</SectionLabel>
        {loading ? (
          <View style={{ height: 120 }}><LoadingState /></View>
        ) : cities.length === 0 ? (
          <Text style={styles.empty}>No trucks are live at the moment — search a town to check, or come back later.</Text>
        ) : (
          <View style={styles.list}>
            {cities.map((c, i) => (
              <TouchableOpacity key={c.city} onPress={() => go(c.city)} style={[styles.row, i < cities.length - 1 && ui.rowDivider]} activeOpacity={0.7}>
                <Text style={styles.city}>📍  {c.city}</Text>
                <Text style={styles.count}>{c.count} live</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  empty: { fontSize: 14, color: T.n400, lineHeight: 20 },
  list: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  city: { flex: 1, fontSize: 15, fontWeight: '700', color: T.n800 },
  count: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  chevron: { fontSize: 20, color: T.n300 },
});
