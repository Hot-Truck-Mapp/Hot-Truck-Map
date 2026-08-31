import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/colors';

type Status = 'idle' | 'locating' | 'live' | 'going-offline';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';

/** ["a", "b", "c"] → "a, b and c" */
function listToSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export default function OperatorTab() {
  const { session } = useAuth();
  const router = useRouter();
  const mountedRef = useRef(true);

  const [checking, setChecking] = useState(true);
  const [truck, setTruck] = useState<{ id: string; name: string } | null>(null);
  // What's still missing before this truck should be on the map. The web
  // dashboard gates Go Live behind the same three checks; mobile had none, so
  // a truck with no description, phone or menu could go live and customers
  // would find an order page with nothing on it.
  const [missing, setMissing] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [address, setAddress] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualAddress, setManualAddress] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function checkOperatorStatus() {
    try {
      setLoadError(false);
      const { data, error } = await supabase
        .from('trucks')
        .select('id, name, is_live, description, phone')
        .eq('owner_id', session!.user.id)
        .maybeSingle();
      if (!mountedRef.current) return;
      if (error) throw new Error(error.message);

      setTruck(data ? { id: data.id, name: data.name } : null);
      if (data?.is_live) setStatus('live');

      if (data) {
        const { count } = await supabase
          .from('menu_items')
          .select('id', { count: 'exact', head: true })
          .eq('truck_id', data.id);
        if (!mountedRef.current) return;
        const gaps: string[] = [];
        if (!data.description) gaps.push('a short description');
        if (!data.phone) gaps.push('a phone number');
        if (!count) gaps.push('at least one menu item');
        setMissing(gaps);
      }
    } catch {
      // Without this, a network blip threw out of the async function and left
      // truck as null — showing a real operator the "List Your Truck" screen
      // as though they'd never signed up.
      if (mountedRef.current) setLoadError(true);
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }

  useEffect(() => {
    if (!session?.user) { setChecking(false); return; }
    checkOperatorStatus();
  }, [session]);

  async function broadcastLocation(lat: number, lng: number, addr: string) {
    if (!truck) return;
    const { error: locErr } = await supabase.from('locations').upsert(
      { truck_id: truck.id, lat, lng, address: addr.slice(0, 300), broadcasted_at: new Date().toISOString() },
      { onConflict: 'truck_id' }
    );
    if (locErr) throw new Error(locErr.message);
    const { error: truckErr } = await supabase.from('trucks')
      .update({ is_live: true })
      .eq('id', truck.id)
      .eq('owner_id', session!.user.id);
    if (truckErr) throw new Error(truckErr.message);
    if (!mountedRef.current) return;
    setAddress(addr);
    setStatus('live');
    // Notify followers (fire-and-forget)
    const token = session?.access_token;
    if (token) {
      fetch(`${API_BASE}/api/notify-followers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ truck_id: truck.id, truck_name: truck.name }),
      }).catch(() => {});
    }
  }

  /** Same three checks the web dashboard enforces before Go Live. */
  function blockedBySetup(): boolean {
    if (missing.length === 0) return false;
    Alert.alert(
      'Finish your profile first',
      `Before going live, add ${listToSentence(missing)} at hottruckmap.com/dashboard. ` +
        'Customers who find you need something to order.'
    );
    return true;
  }

  async function goLiveGPS() {
    if (status !== 'idle') return;
    if (blockedBySetup()) return;
    setStatus('locating');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Location needed', 'Please allow location access to go live, or enter your address manually.');
        setStatus('idle');
        setShowManual(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const addr = geo ? [geo.streetNumber, geo.street, geo.city, geo.region].filter(Boolean).join(' ') : `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`;
      await broadcastLocation(loc.coords.latitude, loc.coords.longitude, addr);
    } catch (e) {
      if (mountedRef.current) {
        const message = e instanceof Error ? e.message : 'Could not get location. Try entering it manually.';
        Alert.alert('Error', message);
        setStatus('idle');
        setShowManual(true);
      }
    }
  }

  async function goLiveManual() {
    if (!manualAddress.trim() || status !== 'idle') return;
    if (blockedBySetup()) return;
    setStatus('locating');
    try {
      // Supplied as an EAS environment variable rather than through
      // eas.json — GitHub push protection flags Mapbox tokens, so it is
      // deliberately not in the repo. See mobile/.env.example for how to
      // set it. It was in no build profile at all until now, which made
      // this whole fallback dead in every shipped build.
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
      if (!token) {
        throw new Error(
          'Address lookup is unavailable in this build. Use GPS to go live, or update your location from the dashboard.'
        );
      }
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(manualAddress)}.json?access_token=${token}`);
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) throw new Error('Address not found. Try being more specific.');
      const [lng, lat] = feature.center;
      await broadcastLocation(lat, lng, feature.place_name);
    } catch (e) {
      if (mountedRef.current) {
        const message = e instanceof Error ? e.message : 'Could not find address.';
        Alert.alert('Error', message);
        setStatus('idle');
      }
    }
  }

  async function goOffline() {
    if (!truck || !session?.user) return;
    setStatus('going-offline');
    try {
      const { error } = await supabase.from('trucks')
        .update({ is_live: false })
        .eq('id', truck.id)
        .eq('owner_id', session.user.id);
      if (error) throw new Error('Failed to go offline — please try again.');
      if (!mountedRef.current) return;
      setStatus('idle');
      setAddress(null);
      setManualAddress('');
      setShowManual(false);
    } catch (e) {
      if (mountedRef.current) {
        const message = e instanceof Error ? e.message : 'Could not go offline. You may still be live — try again.';
        Alert.alert('Error', message);
        setStatus('live');
      }
    }
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!session) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.emoji}>🚚</Text>
        <Text style={styles.title}>Operator Mode</Text>
        <Text style={styles.subtitle}>Sign in to manage your truck and go live on the map.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (checking) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // ── Couldn't reach the server ──────────────────────────────────────────────
  // Distinct from "not an operator": we don't know either way, so don't tell
  // someone who owns a truck that they don't.
  if (loadError && !truck) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.emoji}>📡</Text>
        <Text style={styles.title}>Couldn&apos;t load your truck</Text>
        <Text style={styles.subtitle}>Check your connection and try again.</Text>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => { setChecking(true); checkOperatorStatus(); }}
          accessibilityRole="button"
        >
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Not an operator ────────────────────────────────────────────────────────
  if (!truck) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.emoji}>🚚</Text>
        <Text style={styles.title}>List Your Truck</Text>
        <Text style={styles.subtitle}>
          Food truck signup happens on the web. It takes about two minutes, and
          then you can go live from right here.
        </Text>
        {/* This used to be flat, untappable text reading "hottruckmap.com/signup",
            which left the operator to retype a URL by hand. ?role=operator is
            read by the web signup page and jumps straight to the operator step. */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => Linking.openURL(`${API_BASE}/signup?role=operator`)}
          accessibilityLabel="Sign up as a food truck operator"
          accessibilityRole="link"
        >
          <Text style={styles.primaryBtnText}>Sign Up My Truck</Text>
        </TouchableOpacity>
        <Text style={styles.urlHint}>Opens hottruckmap.com in your browser</Text>
      </SafeAreaView>
    );
  }

  // ── Operator: Go Live screen ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.truckName}>{truck.name}</Text>

        {/* LIVE state */}
        {(status === 'live' || status === 'going-offline') && (
          <View style={styles.liveSection}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>YOU&apos;RE LIVE</Text>
            </View>
            {address ? <Text style={styles.addressText}>{address}</Text> : null}
            <TouchableOpacity
              style={[styles.offlineBtn, status === 'going-offline' && styles.btnDisabled]}
              onPress={goOffline}
              disabled={status === 'going-offline'}
            >
              <Text style={styles.offlineBtnText}>
                {status === 'going-offline' ? 'Going Offline…' : 'Go Offline'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LOCATING state */}
        {status === 'locating' && (
          <View style={styles.locatingSection}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.locatingText}>Finding your location…</Text>
          </View>
        )}

        {/* Setup gaps — same three the web dashboard checks */}
        {status === 'idle' && missing.length > 0 && (
          <View style={styles.setupBox}>
            <Text style={styles.setupTitle}>Finish setup to go live</Text>
            <Text style={styles.setupBody}>
              Add {listToSentence(missing)} in your dashboard at hottruckmap.com.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`${API_BASE}/dashboard`)}
              accessibilityRole="link"
            >
              <Text style={styles.setupLink}>Open my dashboard →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* IDLE state */}
        {status === 'idle' && (
          <View style={styles.idleSection}>
            <TouchableOpacity
              style={[styles.goLiveBtn, missing.length > 0 && styles.btnDisabled]}
              onPress={goLiveGPS}
              activeOpacity={0.85}
            >
              <Text style={styles.goLiveBtnText}>📍  Go Live</Text>
              <Text style={styles.goLiveSubtext}>Tap to broadcast your GPS location</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.manualToggle} onPress={() => setShowManual(!showManual)}>
              <Text style={styles.manualToggleText}>
                {showManual ? 'Hide manual entry' : 'GPS not working? Enter address'}
              </Text>
            </TouchableOpacity>

            {showManual && (
              <View style={styles.manualSection}>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 190 Main St, Hackensack NJ"
                  placeholderTextColor={Colors.textSecondary}
                  value={manualAddress}
                  onChangeText={setManualAddress}
                  returnKeyType="done"
                  onSubmitEditing={goLiveManual}
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.manualGoBtn, !manualAddress.trim() && styles.btnDisabled]}
                  onPress={goLiveManual}
                  disabled={!manualAddress.trim()}
                >
                  <Text style={styles.manualGoBtnText}>Go Live at This Address</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <Text style={styles.hint}>
          Going live notifies your followers and puts your truck on the map instantly.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 16, alignItems: 'center' },

  emoji: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  urlHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 12, textAlign: 'center' },

  setupBox: {
    width: '100%', backgroundColor: Colors.card, borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: Colors.border,
  },
  setupTitle: { fontSize: 15, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  setupBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 10 },
  setupLink: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  truckName: { fontSize: 20, fontWeight: '800', color: Colors.text, marginBottom: 32, textAlign: 'center' },

  // Live
  liveSection: { width: '100%', alignItems: 'center', marginBottom: 24 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(22,163,74,0.1)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 12 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16a34a' },
  liveText: { fontSize: 14, fontWeight: '800', color: '#16a34a', letterSpacing: 1 },
  addressText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  offlineBtn: { borderWidth: 2, borderColor: Colors.error, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  offlineBtnText: { color: Colors.error, fontWeight: '700', fontSize: 16 },

  // Locating
  locatingSection: { alignItems: 'center', gap: 16, paddingVertical: 40 },
  locatingText: { color: Colors.textSecondary, fontSize: 15 },

  // Idle
  idleSection: { width: '100%', alignItems: 'center' },
  goLiveBtn: {
    width: '100%', backgroundColor: Colors.primary, borderRadius: 20,
    paddingVertical: 28, alignItems: 'center', marginBottom: 20,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  goLiveBtnText: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  goLiveSubtext: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },

  manualToggle: { marginBottom: 16 },
  manualToggleText: { color: Colors.textSecondary, fontSize: 13 },
  manualSection: { width: '100%', gap: 10 },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 15, color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  manualGoBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  manualGoBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 40 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  hint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', marginTop: 32, lineHeight: 18 },
});
