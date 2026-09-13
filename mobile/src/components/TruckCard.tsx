import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { T, TruckPhoto } from '@/components/ui';

export type TruckListItem = {
  id: string;
  name: string | null;
  cuisine: string | null;
  description?: string | null;
  profile_photo: string | null;
  is_live?: boolean | null;
  avg_rating?: number | null;
  review_count?: number | null;
  instagram?: string | null;
  phone?: string | null;
};

type Props = {
  truck: TruckListItem;
  address?: string | null;
  followerCount?: number;
  favorite?: boolean;
  onToggleFavorite?: () => void;
};

/** A row in the truck list — same layout as a card on the web /trucks page. */
export function TruckCard({ truck, address, followerCount = 0, favorite, onToggleFavorite }: Props) {
  const router = useRouter();
  const hasRating = (truck.avg_rating ?? 0) > 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => { if (truck.id) router.push(`/truck/${truck.id}`); }}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${truck.name ?? 'Food truck'}${truck.is_live ? ', open now' : ''}`}
    >
      <TruckPhoto uri={truck.profile_photo} size={88} radius={16} />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>{(truck.name ?? 'Unknown Truck').toUpperCase()}</Text>
          <View style={styles.badges}>
            {truck.is_live && (
              <View style={styles.open}>
                <View style={styles.openDot} />
                <Text style={styles.openText}>OPEN</Text>
              </View>
            )}
            {onToggleFavorite && (
              <TouchableOpacity
                onPress={onToggleFavorite}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? Colors.primary : T.n300} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.cuisineRow}>
          <Text style={styles.cuisine}>{truck.cuisine ?? 'Food Truck'}</Text>
          {hasRating && (
            <View style={styles.rating}>
              <Ionicons name="star" size={10} color={T.star} />
              <Text style={styles.ratingValue}>{Number(truck.avg_rating).toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({truck.review_count ?? 0})</Text>
            </View>
          )}
        </View>

        {truck.description ? <Text style={styles.desc} numberOfLines={2}>{truck.description}</Text> : null}

        <View style={styles.footer}>
          {address ? (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={11} color={Colors.primary} />
              <Text style={styles.addr} numberOfLines={1}>{address}</Text>
            </View>
          ) : (
            <Text style={styles.noAddr}>No location set</Text>
          )}
          {followerCount > 0 && (
            <View style={styles.followers}>
              <Ionicons name="people-outline" size={11} color={T.n400} />
              <Text style={styles.followerText}>{followerCount}</Text>
            </View>
          )}
        </View>

        {!!(truck.instagram || truck.phone) && (
          <View style={styles.contact}>
            {truck.instagram ? <Text style={styles.contactText}>@{truck.instagram}</Text> : null}
            {truck.phone ? <Text style={styles.contactText}>{truck.phone}</Text> : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: T.n100 },
  info: { flex: 1, paddingVertical: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 14, fontWeight: '900', color: T.n900, letterSpacing: 0.4, lineHeight: 18 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  openDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  openText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },
  cuisineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cuisine: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingValue: { fontSize: 11, fontWeight: '700', color: T.n700 },
  ratingCount: { fontSize: 11, color: T.n400 },
  desc: { fontSize: 12, color: T.n500, lineHeight: 17, marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  addr: { fontSize: 12, color: T.n400, flex: 1 },
  noAddr: { fontSize: 12, color: T.n300 },
  followers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  followerText: { fontSize: 12, color: T.n400 },
  contact: { flexDirection: 'row', gap: 12, marginTop: 6 },
  contactText: { fontSize: 11, color: T.n400 },
});
