import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, View, Image,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import { Button, ErrorState, Input, LoadingState, Pill, SectionLabel, T, s as ui, shadow } from '@/components/ui';

const EVENT_TYPES = ['Corporate Lunch', 'Wedding', 'Birthday Party', 'Festival', 'Private Party', 'Graduation', 'Other'];

type Truck = {
  id: string; name: string; cuisine: string | null; profile_photo: string | null;
  catering_description: string | null; catering_starting_price: number | null; catering_min_guests: number | null;
};
type Pkg = {
  id: string; name: string; description: string | null; price_per_person: number; minimum_guests: number;
  maximum_guests: number; includes: string[] | null; photo: string | null;
};

async function fetchBooking(id: string): Promise<{ truck: Truck | null; packages: Pkg[] }> {
  const [{ data: truck, error }, { data: pkgs }] = await Promise.all([
    supabase.from('trucks').select('id, name, cuisine, profile_photo, catering_description, catering_starting_price, catering_min_guests').eq('id', id).maybeSingle(),
    supabase.from('catering_packages').select('id, name, description, price_per_person, minimum_guests, maximum_guests, includes, photo').eq('truck_id', id).eq('is_active', true).limit(50),
  ]);
  if (error) throw error;
  return { truck: (truck as Truck | null) ?? null, packages: (pkgs ?? []) as Pkg[] };
}

/** Mobile twin of /catering/book/[id]. */
export default function CateringRequestScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  // useLocalSearchParams can return a string[] if the param appears multiple times;
  // always take the scalar value to avoid passing an array to Supabase or the API.
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { session } = useAuth();
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const q = useAsyncData(id ? `book:${id}` : null, () => fetchBooking(id!));
  const truck = q.data?.truck ?? null;
  const packages = q.data?.packages ?? [];
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState({
    customer_name: '', customer_phone: '', event_date: '', event_time: '',
    event_location: '', guest_count: '', budget: '', event_type: '', notes: '',
  });
  // null = untouched, so a signed-in customer's address is prefilled until they edit it.
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const form = { ...fields, customer_email: emailInput ?? session?.user.email ?? '' };
  const set = (key: keyof typeof form) => (value: string) => {
    if (key === 'customer_email') setEmailInput(value);
    else setFields((f) => ({ ...f, [key]: value }));
    if (error) setError(null);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function submit() {
    if (inFlightRef.current) return;
    const f = form;
    if (!f.customer_name.trim() || !f.customer_email.trim() || !f.event_date.trim() || !f.event_location.trim() || !f.guest_count) {
      setError('Please fill in all required fields (*).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.customer_email.trim())) { setError('Please enter a valid email address.'); return; }
    const date = f.event_date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T00:00:00`).getTime())) {
      setError('Please enter the event date as YYYY-MM-DD (e.g. 2026-10-04).');
      return;
    }
    if (date < new Date().toISOString().slice(0, 10)) { setError('Please select a future date for your event.'); return; }
    const guests = parseInt(f.guest_count, 10);
    if (!Number.isFinite(guests) || guests < 1 || guests > 100000) { setError('Please enter a valid guest count.'); return; }
    const budget = f.budget ? parseFloat(f.budget) : null;
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) { setError('Please enter a valid budget amount.'); return; }

    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/catering-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            truck_id: id,
            customer_name: f.customer_name.trim(),
            customer_email: f.customer_email.trim(),
            customer_phone: f.customer_phone.trim() || null,
            event_date: date,
            event_time: f.event_time.trim() || null,
            event_location: f.event_location.trim(),
            guest_count: guests,
            budget,
            event_type: f.event_type,
            notes: f.notes,
            selected_package_id: selectedPackage,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!mountedRef.current) return;
      if (res.ok) { setSubmitted(true); return; }
      const json = await res.json().catch(() => ({})) as { error?: string };
      setError(res.status === 429 ? 'Too many requests — please wait a few minutes and try again.' : json.error ?? 'Could not submit request. Please try again.');
    } catch {
      if (mountedRef.current) setError('Network error — please check your connection and try again.');
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setSubmitting(false);
    }
  }

  if (q.loading) return <LoadingState />;
  if (q.error) return <ErrorState title="Could not load this truck" message="Check your connection and try again." onRetry={q.reload} />;
  if (!truck) return <ErrorState title="Truck not found" message="This truck may no longer offer catering." />;

  if (submitted) {
    return (
      <View style={[ui.screen, styles.successWrap]}>
        <View style={styles.successCard}>
          <View style={styles.successIcon}><Text style={{ fontSize: 30, color: T.green600 }}>✓</Text></View>
          <Text style={styles.successTitle}>REQUEST SENT!</Text>
          <Text style={styles.successBody}>Your catering request has been sent to</Text>
          <Text style={styles.successTruck}>{truck.name.toUpperCase()}</Text>
          <Text style={styles.successNote}>
            The operator will review your request and get back to you within 24 hours at{' '}
            <Text style={{ fontWeight: '700', color: T.n600 }}>{form.customer_email}</Text>
          </Text>
          <Button title="BROWSE MORE TRUCKS" onPress={() => router.replace('/catering')} style={{ alignSelf: 'stretch' }} />
          <Button title="Back to Map" variant="outline" onPress={() => router.replace('/(tabs)')} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: `Catering — ${truck.name}` }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {/* Truck header */}
        <View style={styles.cover}>
          {truck.profile_photo ? <Image source={{ uri: truck.profile_photo }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          <View style={styles.coverShade} />
          <View style={styles.coverText}>
            <Text style={styles.coverName}>{truck.name.toUpperCase()}</Text>
            {truck.cuisine ? <Text style={styles.coverCuisine}>{truck.cuisine}</Text> : null}
          </View>
        </View>
        <View style={styles.intro}>
          <Text style={styles.introText}>{truck.catering_description ?? 'Available for private catering events'}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
            {truck.catering_starting_price ? <Text style={styles.introMeta}>$ From ${truck.catering_starting_price}/person</Text> : null}
            {truck.catering_min_guests ? <Text style={styles.introMeta}>👥 Min {truck.catering_min_guests} guests</Text> : null}
          </View>
        </View>

        <View style={{ padding: 16, gap: 20 }}>
          {packages.length > 0 && (
            <View>
              <SectionLabel>Select a Package</SectionLabel>
              {packages.map((pkg) => {
                const on = selectedPackage === pkg.id;
                return (
                  <TouchableOpacity key={pkg.id} onPress={() => setSelectedPackage(on ? null : pkg.id)} style={[styles.pkg, on && { borderColor: Colors.primary }]} activeOpacity={0.85}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text style={styles.pkgName}>{pkg.name.toUpperCase()}</Text>
                        {on && <Text style={styles.selected}>SELECTED</Text>}
                      </View>
                      {pkg.description ? <Text style={styles.pkgDesc}>{pkg.description}</Text> : null}
                      {(pkg.includes?.length ?? 0) > 0 && (
                        <View style={styles.includes}>
                          {pkg.includes!.map((it) => <Text key={it} style={styles.include}>{it}</Text>)}
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.pkgPrice}>${pkg.price_per_person}</Text>
                      <Text style={styles.pkgMeta}>per person</Text>
                      <Text style={styles.pkgMeta}>Min {pkg.minimum_guests} guests</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View>
            <SectionLabel>Event Details</SectionLabel>
            <View style={styles.formCard}>
              <View style={styles.cell}>
                <Text style={styles.label}>EVENT TYPE</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {EVENT_TYPES.map((t) => <Pill key={t} label={t} active={form.event_type === t} onPress={() => set('event_type')(t)} />)}
                </View>
              </View>
              <View style={[styles.cell, { flexDirection: 'row', gap: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>EVENT DATE *</Text>
                  <Input value={form.event_date} onChangeText={(t) => set('event_date')(t.replace(/[^0-9-]/g, '').slice(0, 10))} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>EVENT TIME</Text>
                  <Input value={form.event_time} onChangeText={(t) => set('event_time')(t.slice(0, 30))} placeholder="e.g. 6:00 PM" />
                </View>
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>EVENT LOCATION *</Text>
                <Input value={form.event_location} onChangeText={(t) => set('event_location')(t.slice(0, 200))} placeholder="e.g. 123 Main St, Newark NJ" />
              </View>
              <View style={[styles.cell, { flexDirection: 'row', gap: 12, borderBottomWidth: 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>GUEST COUNT *</Text>
                  <Input value={form.guest_count} onChangeText={(t) => set('guest_count')(t.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="e.g. 50" keyboardType="number-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>BUDGET ($)</Text>
                  <Input value={form.budget} onChangeText={(t) => set('budget')(t.replace(/[^0-9.]/g, '').slice(0, 10))} placeholder="Optional" keyboardType="decimal-pad" />
                </View>
              </View>
            </View>
          </View>

          <View>
            <SectionLabel>Additional Notes</SectionLabel>
            <Input
              value={form.notes}
              onChangeText={(t) => set('notes')(t.slice(0, 1000))}
              placeholder="Any special requests, dietary requirements, or details about your event..."
              multiline
              style={{ minHeight: 100 }}
            />
          </View>

          <View>
            <SectionLabel>Your Contact Info</SectionLabel>
            <View style={styles.formCard}>
              <View style={styles.cell}>
                <Text style={styles.label}>FULL NAME *</Text>
                <Input value={form.customer_name} onChangeText={(t) => set('customer_name')(t.slice(0, 100))} placeholder="Your full name" autoCapitalize="words" autoComplete="name" />
              </View>
              <View style={styles.cell}>
                <Text style={styles.label}>EMAIL *</Text>
                <Input value={form.customer_email} onChangeText={(t) => set('customer_email')(t.slice(0, 200))} placeholder="your@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
              </View>
              <View style={[styles.cell, { borderBottomWidth: 0 }]}>
                <Text style={styles.label}>PHONE</Text>
                <Input value={form.customer_phone} onChangeText={(t) => set('customer_phone')(t.slice(0, 30))} placeholder="(201) 555-0123" keyboardType="phone-pad" autoComplete="tel" />
              </View>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={submitting ? 'Sending...' : 'SEND CATERING REQUEST'} onPress={submit} loading={submitting} style={{ borderRadius: 16, paddingVertical: 16 }} />
          <Text style={styles.fine}>No payment required — the operator will contact you to confirm details.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cover: { height: 160, backgroundColor: T.n800, justifyContent: 'flex-end' },
  coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  coverText: { padding: 20 },
  coverName: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  coverCuisine: { fontSize: 14, fontWeight: '600', color: '#FF9A5C', marginTop: 2 },
  intro: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: T.n200 },
  introText: { fontSize: 14, color: T.n500, lineHeight: 20 },
  introMeta: { fontSize: 14, fontWeight: '700', color: T.n700 },
  pkg: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 2, borderColor: 'transparent', marginBottom: 12, ...shadow },
  pkgName: { fontSize: 14, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  selected: { fontSize: 10, fontWeight: '900', color: '#fff', backgroundColor: Colors.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  pkgDesc: { fontSize: 12, color: T.n400, marginTop: 4, lineHeight: 17 },
  includes: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  include: { fontSize: 10, fontWeight: '700', color: T.n500, backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  pkgPrice: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  pkgMeta: { fontSize: 12, color: T.n400 },
  formCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...shadow },
  cell: { padding: 16, borderBottomWidth: 1, borderBottomColor: T.n100 },
  label: { fontSize: 11, fontWeight: '900', color: T.n500, letterSpacing: 0.8, marginBottom: 8 },
  error: { fontSize: 14, color: T.red600, backgroundColor: T.red50, borderRadius: 12, padding: 12, overflow: 'hidden' },
  fine: { fontSize: 12, color: T.n400, textAlign: 'center' },
  successWrap: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, width: '100%', maxWidth: 380, alignItems: 'center', ...shadow },
  successIcon: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  successTitle: { fontSize: 20, fontWeight: '900', color: T.n900, letterSpacing: 0.5, marginBottom: 8 },
  successBody: { fontSize: 14, color: T.n500, marginBottom: 6 },
  successTruck: { fontSize: 16, fontWeight: '900', color: Colors.primary, marginBottom: 14 },
  successNote: { fontSize: 12, color: T.n400, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
});
