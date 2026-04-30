import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import type { Truck } from '@shared/types';

type Props = {
  truck: Truck & { is_live?: boolean };
};

export function TruckCard({ truck }: Props) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/truck/${truck.id}`)}
      activeOpacity={0.7}
    >
      {truck.profile_photo ? (
        <Image source={{ uri: truck.profile_photo }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{truck.name}</Text>
        <Text style={styles.cuisine}>{truck.cuisine}</Text>
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
  cuisine: { fontSize: 14, color: Colors.textSecondary, marginBottom: 6 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveText: { fontSize: 12, color: Colors.success, fontWeight: '500' },
});
