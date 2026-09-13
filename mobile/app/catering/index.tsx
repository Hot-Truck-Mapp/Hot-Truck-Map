import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/api';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import { EmptyState, ErrorState, LoadingState, SectionLabel, T, s as ui, shadow } from '@/components/ui';

type CateringTruck = {
  id: string; name: string; cuisine: string | null; profile_photo: string | null;
  catering_description: string | null; catering_starting_price: number | null; catering_min_guests: number | null;
};

async function fetchCateringTrucks(): Promise<CateringTruck[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select('id, name, cuisine, profile_photo, catering_description, catering_starting_price, catering_min_guests')
    .eq('offers_catering', true)
    .order('name', { ascending: true })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CateringTruck[];
}

/** Mobile twin of /catering. */
export default function CateringLandingScreen() {
  const router = useRouter();
  const q = useAsyncData('catering-trucks', fetchCateringTrucks);
  const trucks = q.data ?? [];

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Text style={{ fontSize: 30 }}>🚚</Text></View>
        <Text style={styles.heroTitle}>Food Truck Catering</Text>
        <Text style={styles.heroSub}>Book a food truck for your event. Browse packages and send a request directly to operators.</Text>
        <View style={styles.heroBtns}>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.outlineText}>Back to Map</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.redBtn} onPress={() => Linking.openURL(`${API_BASE}/signup?role=operator`)}>
            <Text style={styles.redText}>List My Truck</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        {q.loading ? (
          <View style={{ height: 200 }}><LoadingState /></View>
        ) : q.error ? (
          <ErrorState title="Could not load catering trucks" message="Check your connection and try again." onRetry={q.reload} />
        ) : trucks.length === 0 ? (
          <EmptyState icon="bus-outline" title="No catering trucks available yet" message="Check back soon — more trucks are joining!" />
        ) : (
          <>
            <SectionLabel>{`${trucks.length} truck${trucks.length !== 1 ? 's' : ''} available for catering`}</SectionLabel>
            {trucks.map((t) => (
              <TouchableOpacity key={t.id} style={styles.card} onPress={() => router.push(`/catering/${t.id}`)} activeOpacity={0.85}>
                {t.profile_photo ? (
                  <Image source={{ uri: t.profile_photo }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={[styles.photo, styles.photoEmpty]}><Text style={{ fontSize: 30, opacity: 0.4 }}>🚚</Text></View>
                )}
                <View style={{ padding: 16 }}>
                  <Text style={styles.name}>{t.name.toUpperCase()}</Text>
                  {t.cuisine ? <Text style={styles.cuisine}>{t.cuisine}</Text> : null}
                  {t.catering_description ? <Text style={styles.desc} numberOfLines={2}>{t.catering_description}</Text> : null}
                  <View style={styles.metaRow}>
                    {t.catering_starting_price ? <Text style={styles.price}>From ${t.catering_starting_price}/person</Text> : null}
                    {t.catering_min_guests ? <Text style={styles.min}>Min {t.catering_min_guests} guests</Text> : null}
                  </View>
                  <View style={styles.cta}><Text style={styles.ctaText}>REQUEST CATERING →</Text></View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: T.n900, paddingHorizontal: 20, paddingVertical: 32, alignItems: 'center' },
  heroIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: 14, color: T.n400, textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  heroBtns: { flexDirection: 'row', gap: 12, marginTop: 24 },
  outlineBtn: { borderWidth: 1, borderColor: T.n600, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  outlineText: { color: T.n300, fontWeight: '700', fontSize: 14 },
  redBtn: { backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  redText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 16, ...shadow },
  photo: { width: '100%', height: 144, backgroundColor: T.n200 },
  photoEmpty: { backgroundColor: T.n800, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  cuisine: { fontSize: 12, fontWeight: '500', color: Colors.primary, marginTop: 2 },
  desc: { fontSize: 12, color: T.n400, marginTop: 8, lineHeight: 18 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  price: { fontSize: 12, fontWeight: '700', color: T.n600 },
  min: { fontSize: 12, color: T.n400 },
  cta: { alignSelf: 'flex-start', backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12 },
  ctaText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
});
