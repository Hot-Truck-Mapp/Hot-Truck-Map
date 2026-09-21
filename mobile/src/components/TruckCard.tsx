import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { T, TruckPhoto } from '@/components/ui';
import { formatMiles } from '@shared/discovery';
import { freshnessOf } from '@shared/presence';

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
  /** Miles from the user, when known (live trucks only). */
  miles?: number | null;
  /** A menu item that matched the search, shown as "Serves …". */
  dish?: string | null;
  /** When the truck last pinged its position — "OPEN" without this is a claim
   *  with nothing behind it, so live rows show how old the position is. */
  broadcastedAt?: string | null;
  /** Current wait, already reduced to a chip by the caller. */
  waitChip?: string | null;
  /** Enough customers reported an empty curb to be worth flagging. */
  disputed?: boolean;
  followerCount?: number;
  favorite?: boolean;
  onToggleFavorite?: () => void;
};

/** A row in the truck list — same layout as a card on the web /trucks page. */
export function TruckCard({
  truck, address, miles, dish, broadcastedAt, waitChip, disputed,
  followerCount = 0, favorite, onToggleFavorite,
}: Props) {
  const router = useRouter();
  const hasRating = (truck.avg_rating ?? 0) > 0;
  const freshness = truck.is_live ? freshnessOf(broadcastedAt) : null;
  const freshStyle = freshness
    ? freshness.level === 'fresh' ? styles.chipFresh
      : freshness.level === 'recent' ? styles.chipRecent
      : styles.chipStale
    : styles.chipStale;
  const freshTextStyle = freshness
    ? freshness.level === 'fresh' ? styles.chipFreshText
      : freshness.level === 'recent' ? styles.chipRecentText
      : styles.chipStaleText
    : styles.chipStaleText;

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
          {miles != null && <Text style={styles.miles}>· {formatMiles(miles)}</Text>}
        </View>

        {dish ? (
          <Text style={styles.dish} numberOfLines={1}>
            Serves <Text style={{ fontWeight: '700', color: T.n700 }}>{dish}</Text>
          </Text>
        ) : null}

        {truck.description ? <Text style={styles.desc} numberOfLines={2}>{truck.description}</Text> : null}

        <View style={styles.footer}>
          {address ? (
            <View style={styles.addrRow}>
              <Ionicons name="location-outline" size={11} color={Colors.primary} />
              <Text style={styles.addr} numberOfLines={1}>{address}</Text>
            </View>
          ) : (
            <Text style={styles.noAddr}>{truck.is_live ? 'No location set' : 'Not out right now'}</Text>
          )}
          {followerCount > 0 && (
            <View style={styles.followers}>
              <Ionicons name="people-outline" size={11} color={T.n400} />
              <Text style={styles.followerText}>{followerCount}</Text>
            </View>
          )}
        </View>

        {(freshness || waitChip || disputed) && (
          <View style={styles.signals}>
            {freshness && (
              <View style={[styles.chip, freshStyle]}>
                <Text style={[styles.chipText, freshTextStyle]}>{freshness.label}</Text>
              </View>
            )}
            {waitChip ? (
              <View style={[styles.chip, styles.chipNeutral]}>
                <Text style={[styles.chipText, styles.chipNeutralText]}>{waitChip}</Text>
              </View>
            ) : null}
            {disputed ? (
              <View style={[styles.chip, styles.chipDisputed]}>
                <Text style={[styles.chipText, styles.chipDisputedText]}>Reported gone</Text>
              </View>
            ) : null}
          </View>
        )}

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
  miles: { fontSize: 11, fontWeight: '700', color: T.n600 },
  dish: { fontSize: 12, color: T.n500, marginBottom: 6 },
  desc: { fontSize: 12, color: T.n500, lineHeight: 17, marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  addr: { fontSize: 12, color: T.n400, flex: 1 },
  noAddr: { fontSize: 12, color: T.n300 },
  followers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  followerText: { fontSize: 12, color: T.n400 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8 },
  chip: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '700' },
  chipFresh: { backgroundColor: '#F0FDF4' },
  chipFreshText: { color: '#15803D' },
  chipRecent: { backgroundColor: '#FFFBEB' },
  chipRecentText: { color: '#B45309' },
  chipStale: { backgroundColor: T.n100 },
  chipStaleText: { color: T.n500 },
  chipNeutral: { backgroundColor: T.n100 },
  chipNeutralText: { color: T.n600 },
  chipDisputed: { backgroundColor: '#FEF3C7' },
  chipDisputedText: { color: '#92400E' },
  contact: { flexDirection: 'row', gap: 12, marginTop: 6 },
  contactText: { fontSize: 11, color: T.n400 },
});
