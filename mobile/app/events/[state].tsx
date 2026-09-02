import { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, SectionList, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { EventCard } from '@/components/EventCard';
import { isValidStateCode, stateNameForCode } from '@shared/us-states';
import type { Festival } from '@shared/types';

export default function StateEventsScreen() {
  const { state } = useLocalSearchParams<{ state: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const mountedRef = useRef(true);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);

  const code = (state ?? '').toUpperCase();
  const valid = isValidStateCode(code);
  const stateName = stateNameForCode(code) ?? code;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: valid ? stateName : 'Not found' });
  }, [navigation, valid, stateName]);

  useEffect(() => {
    if (!valid) { setLoading(false); return; }
    async function load() {
      try {
        const todayISO = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('festivals')
          .select('*')
          .eq('state_code', code)
          .gte('end_date', todayISO)
          .order('start_date');
        if (!error && data && mountedRef.current) setFestivals(data as Festival[]);
      } catch {
        // Network error — show empty state rather than crashing
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    load();
  }, [code, valid]);

  if (!valid) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>State not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 15 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // County first, then town within it — matching the web page. A section is one
  // town; the county is carried on the section so its heading can be drawn
  // above the first town in that county. Events with no county recorded fall
  // into a trailing group rather than being given a made-up one.
  const UNGROUPED = ' ungrouped';
  const byCounty = festivals.reduce<Record<string, Record<string, Festival[]>>>((acc, f) => {
    const countyKey = f.county?.trim() ? f.county.trim() : UNGROUPED;
    ((acc[countyKey] ??= {})[f.city] ??= []).push(f);
    return acc;
  }, {});
  const sections = Object.keys(byCounty)
    .sort((a, b) => (a === UNGROUPED ? 1 : b === UNGROUPED ? -1 : a.localeCompare(b)))
    .flatMap((county) =>
      Object.keys(byCounty[county])
        .sort()
        .map((city, i) => ({
          title: city,
          county: county === UNGROUPED ? null : county,
          firstInCounty: i === 0,
          data: byCounty[county][city],
        }))
    );

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <EventCard event={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.headerGroup}>
            {section.firstInCounty && section.county && (
              <Text style={styles.countyHeader}>
                {/county$/i.test(section.county) ? section.county : `${section.county} County`}
              </Text>
            )}
            <Text style={styles.sectionHeader}>{section.title}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎪</Text>
            <Text style={styles.emptyText}>No upcoming festivals in {stateName} yet</Text>
            <Text style={styles.emptySubtext}>Check back soon — new events are added monthly</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: Colors.textSecondary, textAlign: 'center' },
  list: { paddingBottom: 32, flexGrow: 1 },
  headerGroup: { backgroundColor: Colors.background },
  countyHeader: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: `${Colors.primary}33`,
    marginHorizontal: 16,
    paddingLeft: 0,
    marginBottom: 2,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
    backgroundColor: Colors.background,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 64, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 32, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  emptySubtext: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
});
