import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import type { Truck } from '@shared/types';

type Props = {
  truck: Truck & { is_live?: boolean };
};

export function TruckCard({ truck }: Props) {
  const router = useRouter();
  const hasRating = (truck.avg_rating ?? 0) > 0;

  const validPhoto = typeof truck.profile_photo === 'string' && truck.profile_photo.trim().length > 0
    ? truck.profile_photo.trim() : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { if (truck.id) router.push(`/truck/${truck.id}`); }}
      activeOpacity={0.7}
    >
      {validPhoto ? (
        <Image source={{ uri: validPhoto }} style={styles.image} resizeMode="cover" alt={truck.name ?? 'Food truck'} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{truck.name ?? 'Unknown Truck'}</Text>
        <View style={styles.cuisineRow}>
          <Text style={styles.cuisine}>{truck.cuisine ?? 'Food Truck'}</Text>
          {hasRating && (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingValue}>{Number(truck.avg_rating).toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({truck.review_count ?? 0})</Text>
            </View>
          )}
        </View>
        {truck.is_live && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live now</Text>
          </View>
        )}
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
  imagePlaceholder: { backgroundColor: Colors.border },
  info: { flex: 1, padding: 12, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  cuisineRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  cuisine: { fontSize: 14, color: Colors.textSecondary },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingStar: { fontSize: 11, color: '#F5A623' },
  ratingValue: { fontSize: 12, fontWeight: '700', color: Colors.text },
  ratingCount: { fontSize: 11, color: Colors.textSecondary },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveText: { fontSize: 12, color: Colors.success, fontWeight: '500' },
});
