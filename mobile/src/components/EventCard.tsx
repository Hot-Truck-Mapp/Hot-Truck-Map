import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import type { Festival } from '@shared/types';

type Props = {
  event: Festival;
};

function formatDateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const start = new Date(startDate + 'T00:00:00').toLocaleDateString([], opts);
  if (endDate === startDate) return start;
  const end = new Date(endDate + 'T00:00:00').toLocaleDateString([], opts);
  return `${start} – ${end}`;
}

export function EventCard({ event }: Props) {
  const router = useRouter();

  const validImage = typeof event.image_url === 'string' && event.image_url.trim().length > 0
    ? event.image_url.trim() : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { if (event.id) router.push(`/event/${event.id}`); }}
      activeOpacity={0.7}
    >
      {validImage ? (
        <Image source={{ uri: validImage }} style={styles.image} resizeMode="cover" alt={event.name ?? 'Festival'} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderEmoji}>🎪</Text>
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{event.name ?? 'Untitled Event'}</Text>
        <Text style={styles.subtext} numberOfLines={1}>
          {event.venue ? `${event.city} · ${event.venue}` : event.city}
        </Text>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{formatDateRange(event.start_date, event.end_date)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    overflow: 'hidden',
  },
  image: { width: 80, height: 80 },
  imagePlaceholder: { backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderEmoji: { fontSize: 28 },
  info: { flex: 1, padding: 12, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  subtext: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  dateBadge: { alignSelf: 'flex-start', backgroundColor: `${Colors.primary}1A`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  dateText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
});
