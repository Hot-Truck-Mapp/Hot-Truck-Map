import { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Festival } from '@shared/types';

function formatDateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const start = new Date(startDate + 'T00:00:00').toLocaleDateString([], opts);
  if (endDate === startDate) return start;
  const end = new Date(endDate + 'T00:00:00').toLocaleDateString([], opts);
  return `${start} – ${end}`;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const mountedRef = useRef(true);
  const [event, setEvent] = useState<Festival | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    async function load() {
      try {
        const { data } = await supabase.from('festivals').select('*').eq('id', id).maybeSingle();
        if (mountedRef.current) setEvent((data as Festival) ?? null);
      } catch {
        // Network error — falls through to not-found state
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  const validImage = typeof event.image_url === 'string' && event.image_url.trim().length > 0
    ? event.image_url.trim() : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {validImage ? (
        <Image source={{ uri: validImage }} style={styles.image} resizeMode="cover" alt={event.name} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderEmoji}>🎪</Text>
        </View>
      )}

      <Text style={styles.name}>{event.name}</Text>
      <Text style={styles.location}>{event.city}, {event.state_code}</Text>

      <View style={styles.dateBadge}>
        <Text style={styles.dateText}>{formatDateRange(event.start_date, event.end_date)}</Text>
      </View>

      {event.venue && (
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Venue</Text>
          <Text style={styles.rowValue}>{event.venue}</Text>
        </View>
      )}

      {event.description && (
        <Text style={styles.description}>{event.description}</Text>
      )}

      {event.website_url && (
        <TouchableOpacity
          style={styles.websiteButton}
          onPress={() => Linking.openURL(event.website_url!)}
          activeOpacity={0.8}
        >
          <Text style={styles.websiteButtonText}>Visit website</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 48 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: Colors.textSecondary },
  image: { width: '100%', height: 180, borderRadius: 16, marginBottom: 16 },
  imagePlaceholder: { backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderEmoji: { fontSize: 48 },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text },
  location: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
  dateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.primary}1A`,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  dateText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  row: { marginTop: 16 },
  rowLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { fontSize: 15, color: Colors.text, marginTop: 2 },
  description: { fontSize: 15, color: Colors.text, lineHeight: 22, marginTop: 16 },
  websiteButton: {
    marginTop: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  websiteButtonText: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
});
