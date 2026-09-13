import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { cityFromSlug, fetchLiveTrucks, trucksInCity } from '@/lib/cities';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Button, EmptyState, ErrorState, LoadingState, T, TruckPhoto, s as ui, shadow } from '@/components/ui';

/** Mobile twin of /trucks/[city]. */
export default function CityScreen() {
  const params = useLocalSearchParams<{ city: string }>();
  const slug = (Array.isArray(params.city) ? params.city[0] : params.city) ?? '';
  const city = cityFromSlug(slug.slice(0, 100));
  const router = useRouter();
  const q = useAsyncData(`city:${city}`, () => fetchLiveTrucks().then((all) => trucksInCity(all, city)));
  const trucks = q.data ?? [];

  return (
    <View style={ui.screen}>
      <Stack.Screen options={{ title: city }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Food Trucks in {city}</Text>
          <Text style={styles.sub}>{trucks.length} truck{trucks.length !== 1 ? 's' : ''} active in {city}</Text>
        </View>
        <View style={styles.seo}>
          <Text style={styles.seoText}>
            Looking for food trucks in {city}? Hot Truck Map shows you real-time locations of all active food
            trucks near you. Browse menus, check hours, and get directions — all in one place.
          </Text>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          {q.loading ? (
            <View style={{ height: 160 }}><LoadingState /></View>
          ) : q.error ? (
            <ErrorState title="Could not load trucks" message="Check your connection and try again." onRetry={q.reload} />
          ) : trucks.length === 0 ? (
            <EmptyState
              icon="bus-outline"
              title={`No active trucks in ${city} right now`}
              message="Check back later or browse all trucks"
              action={<Button title="Back to Map" onPress={() => router.push('/(tabs)')} small style={{ borderRadius: 999 }} />}
            />
          ) : trucks.map((t) => (
            <TouchableOpacity key={t.id} style={styles.card} onPress={() => router.push(`/truck/${t.id}`)} activeOpacity={0.8}>
              <TruckPhoto uri={t.profile_photo} size={64} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
                  {t.is_live && <Text style={styles.live}>LIVE</Text>}
                </View>
                {t.cuisine ? <Text style={styles.cuisine}>{t.cuisine}</Text> : null}
                {t.description ? <Text style={styles.desc} numberOfLines={2}>{t.description}</Text> : null}
                {t.locations?.[0]?.address ? <Text style={styles.addr} numberOfLines={1}>{t.locations[0].address}</Text> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: T.n100, paddingHorizontal: 16, paddingVertical: 20 },
  title: { fontSize: 24, fontWeight: '700', color: T.n800 },
  sub: { fontSize: 14, color: T.n400, marginTop: 4 },
  seo: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.n50 },
  seoText: { fontSize: 14, color: T.n600, lineHeight: 21 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 16, ...shadow },
  name: { fontSize: 15, fontWeight: '700', color: T.n800, flexShrink: 1 },
  live: { fontSize: 10, fontWeight: '700', color: Colors.primary, backgroundColor: T.red50, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  cuisine: { fontSize: 12, fontWeight: '500', color: Colors.primary, marginTop: 2 },
  desc: { fontSize: 12, color: T.n400, marginTop: 4 },
  addr: { fontSize: 12, color: T.n400, marginTop: 4 },
});
