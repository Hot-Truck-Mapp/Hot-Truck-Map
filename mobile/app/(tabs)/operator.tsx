import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, TextInput, Linking, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { API_BASE, authedFetch } from '@/lib/api';
import { useMyTruck } from '@/hooks/useMyTruck';
import { useRefreshOnRefocus } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { T, shadow, type IconName } from '@/components/ui';
import { OPERATOR_WAIT_TTL_MIN, WAIT_BUCKETS, minutesSince, waitLabel } from '@shared/presence';

// Transient steps only — whether the truck is live comes from its row (truck.is_live).
type Phase = 'idle' | 'locating' | 'going-offline';

/** Metres between two points (haversine), for the 50 m re-broadcast threshold. */
function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function addressFor(lat: number, lng: number) {
  try {
    const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (geo) return [geo.streetNumber, geo.street, geo.city, geo.region].filter(Boolean).join(' ');
  } catch { /* fall through to coordinates */ }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/**
 * The operator dashboard home — the app side of the web /dashboard "Go Live"
 * tab, plus the navigation to every other dashboard section.
 */
export default function OperatorTab() {
  const router = useRouter();
  const { session, truck, setTruck, loading: checking, error: loadError, reload } = useMyTruck();
  const truckId = truck?.id ?? null;
  const mountedRef = useRef(true);

  const [menuCount, setMenuCount] = useState<number | null>(null);
  const [followers, setFollowers] = useState(0);
  const [newOrders, setNewOrders] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [address, setAddress] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const broadcastingRef = useRef(false);
  // One follower notification per live session, not one per GPS refresh.
  const notifiedRef = useRef(false);
  // One live_sessions row per live session, likewise.
  const sessionOpenedRef = useRef(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [waitSaving, setWaitSaving] = useState(false);
  const [waitClock, setWaitClock] = useState(() => Date.now());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      watchRef.current?.remove();
      watchRef.current = null;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    };
  }, []);

  const loadStats = useCallback(async () => {
    if (!truck) return;
    try {
      const [menu, follows, loc] = await Promise.all([
        supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('truck_id', truck.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('truck_id', truck.id),
        truck.is_live
          ? supabase.from('locations').select('address').eq('truck_id', truck.id).order('broadcasted_at', { ascending: false }).limit(1).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!mountedRef.current) return;
      setMenuCount(menu.count ?? 0);
      setFollowers(follows.count ?? 0);
      if (loc.data?.address) setAddress(loc.data.address);
    } catch { /* stats are non-critical */ }
  }, [truck]);

  // Refresh when coming back from Menu/Profile so the checklist and nudge update.
  useFocusEffect(useCallback(() => { void loadStats(); }, [loadStats]));
  useRefreshOnRefocus(reload);

  // New-order badge, like the web dashboard's Orders tab counter.
  useEffect(() => {
    if (!truckId) return;
    const channel = supabase
      .channel(`orders-badge-${truckId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `truck_id=eq.${truckId}` }, (payload) => {
        if ((payload.new as { truck_id?: string })?.truck_id !== truckId) return;
        setNewOrders((n) => n + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [truckId]);

  const isLive = !!truck?.is_live;

  // Already live when this screen mounted: the session was opened when they
  // went live, so don't open a second one — just pick the heartbeat back up
  // so the map keeps seeing a current position.
  useEffect(() => {
    if (!isLive) return;
    sessionOpenedRef.current = true;
    notifiedRef.current = true;
    startHeartbeat();
    return () => stopHeartbeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLive, truckId]);

  // An operator-set wait expires on the clock, so the control has to re-render
  // on the clock too.
  useEffect(() => {
    if (!isLive) return;
    const tick = setInterval(() => setWaitClock(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, [isLive]);

  const waitMinutes = truck?.wait_minutes ?? null;
  const waitAge = minutesSince(truck?.wait_set_at ?? null, new Date(waitClock));
  const waitFresh = waitMinutes != null && waitAge != null && waitAge <= OPERATOR_WAIT_TTL_MIN;

  const missing: string[] = [];
  if (truck && !truck.description) missing.push('a short description');
  if (truck && !truck.phone) missing.push('a phone number');
  if (truck && menuCount === 0) missing.push('at least one menu item');

  // ── Liveness heartbeat ──────────────────────────────────────────────────────
  //
  // The watcher only re-broadcasts after 50 m of movement, so a truck parked
  // for a four-hour service looks, from the outside, identical to one whose
  // phone died three hours ago. Customers can now see how old a truck's
  // position is, so a truck that IS there has to keep saying so. Touches the
  // timestamp only — no geocoding, no notification, no change of address.
  const HEARTBEAT_MS = 5 * 60 * 1000;

  async function sendHeartbeat() {
    const id = truck?.id;
    if (!id) return;
    try {
      // The auto-offline cron, or enough "they're gone" reports, can end a
      // session out from under this screen. Heartbeating regardless would
      // keep resurrecting a truck the map has already given up on.
      const { data: current } = await supabase.from('trucks').select('is_live').eq('id', id).maybeSingle();
      if (!current) return;
      if (!current.is_live) {
        stopHeartbeat();
        watchRef.current?.remove();
        watchRef.current = null;
        if (!mountedRef.current) return;
        setTruck((t) => (t ? { ...t, is_live: false } : t));
        setAddress(null);
        notifiedRef.current = false;
        sessionOpenedRef.current = false;
        Alert.alert('You were taken off the map', "Tap Go Live again when you're serving.");
        return;
      }
      await supabase.from('locations').update({ broadcasted_at: new Date().toISOString() }).eq('truck_id', id);
    } catch {
      // The next beat is five minutes out and the staleness window is hours.
    }
  }

  function startHeartbeat() {
    if (heartbeatRef.current) return;
    heartbeatRef.current = setInterval(() => { void sendHeartbeat(); }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
  }

  /**
   * Open a live session unless one is already running. `locations` keeps one
   * row per truck, so without this log there is no record that a truck ever
   * worked a given day — and no way to tell whether it keeps its schedule.
   */
  async function openLiveSession() {
    const id = truck?.id;
    if (!id || sessionOpenedRef.current) return;
    sessionOpenedRef.current = true;
    try {
      const { data: open } = await supabase
        .from('live_sessions').select('id').eq('truck_id', id).is('ended_at', null).limit(1).maybeSingle();
      if (open) return;
      await supabase.from('live_sessions').insert({ truck_id: id });
    } catch { /* reliability loses one sample; the truck is still live */ }
  }

  async function closeLiveSession() {
    const id = truck?.id;
    if (!id) return;
    try {
      await supabase
        .from('live_sessions')
        .update({ ended_at: new Date().toISOString(), ended_by: 'operator' })
        .eq('truck_id', id)
        .is('ended_at', null);
    } catch { /* the cron closes anything left open */ }
  }

  /** Operator-set wait time — expires on its own after OPERATOR_WAIT_TTL_MIN. */
  async function saveWaitTime(minutes: number | null) {
    if (!truck || !session?.user || waitSaving) return;
    setWaitSaving(true);
    const stamp = minutes == null ? null : new Date().toISOString();
    try {
      const { error } = await supabase
        .from('trucks')
        .update({ wait_minutes: minutes, wait_set_at: stamp })
        .eq('id', truck.id)
        .eq('owner_id', session.user.id);
      if (error) throw new Error(error.message);
      if (!mountedRef.current) return;
      setTruck((t) => (t ? { ...t, wait_minutes: minutes, wait_set_at: stamp } : t));
    } catch (e) {
      if (mountedRef.current) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not update the wait time.');
      }
    } finally {
      if (mountedRef.current) setWaitSaving(false);
    }
  }

  async function broadcastLocation(lat: number, lng: number, addr: string) {
    if (!truck || !session?.user) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      throw new Error("Couldn't get a valid GPS location — try again.");
    }
    const { error: locErr } = await supabase.from('locations').upsert(
      { truck_id: truck.id, lat, lng, address: addr.slice(0, 300), broadcasted_at: new Date().toISOString() },
      { onConflict: 'truck_id' }
    );
    if (locErr) throw new Error(locErr.message);
    const { error: truckErr } = await supabase.from('trucks').update({ is_live: true }).eq('id', truck.id).eq('owner_id', session.user.id);
    if (truckErr) throw new Error(truckErr.message);
    lastPosRef.current = { lat, lng };
    if (!mountedRef.current) return;
    setAddress(addr);
    setTruck((t) => (t ? { ...t, is_live: true } : t));
    setPhase('idle');
    // Both routes into "live" — the GPS button and the manual address form —
    // land here, so the session log and the heartbeat start here too.
    void openLiveSession();
    startHeartbeat();
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      authedFetch('/api/notify-followers', {
        method: 'POST',
        body: JSON.stringify({ truck_id: truck.id, truck_name: truck.name }),
      }).catch(() => {});
    }
  }

  // Keep the pin current while live — the web dashboard does the same with
  // watchPosition, re-broadcasting once the truck has moved 50 m.
  async function startWatching() {
    watchRef.current?.remove();
    try {
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 60_000 },
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          const prev = lastPosRef.current;
          if (broadcastingRef.current || (prev && metresBetween(prev.lat, prev.lng, lat, lng) < 50)) return;
          broadcastingRef.current = true;
          try {
            await broadcastLocation(lat, lng, await addressFor(lat, lng));
          } catch { /* a failed refresh leaves the last pin in place */ } finally {
            broadcastingRef.current = false;
          }
        },
      );
    } catch { /* watching is best-effort; the initial broadcast already succeeded */ }
  }

  function blockedBySetup(): boolean {
    if (missing.length === 0) return false;
    const needsMenu = menuCount === 0 && !!truck?.description && !!truck?.phone;
    Alert.alert(
      'Finish your profile first',
      `Before going live, add ${missing.length <= 1 ? missing[0] : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`}. Customers who find you need something to order.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: needsMenu ? 'Add Menu Item' : 'Complete Profile', onPress: () => router.push(needsMenu ? '/dashboard/menu' : '/dashboard/profile') },
      ],
    );
    return true;
  }

  async function goLiveGPS() {
    if (phase !== 'idle' || isLive || blockedBySetup()) return;
    setPhase('locating');
    try {
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== 'granted') {
        Alert.alert('Location needed', 'Please allow location access to go live, or enter your address manually.');
        setPhase('idle');
        setShowManual(true);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = loc.coords;
      await broadcastLocation(lat, lng, await addressFor(lat, lng));
      void startWatching();
    } catch (e) {
      if (mountedRef.current) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not get location. Try entering it manually.');
        setPhase('idle');
        setShowManual(true);
      }
    }
  }

  async function goLiveManual() {
    if (!manualAddress.trim() || phase !== 'idle' || isLive || blockedBySetup()) return;
    setPhase('locating');
    try {
      // Supplied as an EAS project environment variable (see mobile/.env.example),
      // not through eas.json, since GitHub push protection flags Mapbox tokens.
      const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
      if (!token) throw new Error('Address lookup is unavailable in this build. Use GPS to go live.');
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(manualAddress)}.json?access_token=${token}`);
      if (!res.ok) throw new Error(`Location service error (${res.status}) — please try again.`);
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) throw new Error('Address not found. Try being more specific.');
      const [lng, lat] = feature.center;
      await broadcastLocation(lat, lng, feature.place_name);
    } catch (e) {
      if (mountedRef.current) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not find address.');
        setPhase('idle');
      }
    }
  }

  async function goOffline() {
    if (!truck || !session?.user) return;
    setPhase('going-offline');
    watchRef.current?.remove();
    watchRef.current = null;
    stopHeartbeat();
    try {
      const { error } = await supabase.from('trucks').update({ is_live: false }).eq('id', truck.id).eq('owner_id', session.user.id);
      if (error) throw new Error('Failed to go offline — please try again.');
      if (!mountedRef.current) return;
      setTruck((t) => (t ? { ...t, is_live: false } : t));
      setPhase('idle');
      setAddress(null);
      setManualAddress('');
      setShowManual(false);
      await closeLiveSession();
      // A wait time set for a service that just ended must not follow the
      // truck into the next one.
      if (truck.wait_minutes != null) void saveWaitTime(null);
      notifiedRef.current = false; // next Go Live is a new session
      sessionOpenedRef.current = false;
      lastPosRef.current = null;
    } catch (e) {
      if (mountedRef.current) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Could not go offline. You may still be live — try again.');
        setPhase('idle');
      }
    }
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!session && !checking) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <View style={styles.bigIcon}><Ionicons name="bus" size={30} color={Colors.primary} /></View>
        <Text style={styles.title}>Operator Mode</Text>
        <Text style={styles.subtitle}>Sign in to manage your truck and go live on the map.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/signup', params: { role: 'operator' } } as Href)} style={{ marginTop: 16 }}>
          <Text style={styles.link}>New here? List your truck →</Text>
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

  // Distinct from "not an operator": we don't know either way, so don't tell
  // someone who owns a truck that they don't.
  if (loadError && !truck) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Ionicons name="cloud-offline-outline" size={44} color={T.n300} style={{ marginBottom: 12 }} />
        <Text style={styles.title}>Couldn&apos;t load your truck</Text>
        <Text style={styles.subtitle}>Check your connection and try again.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={reload} accessibilityRole="button">
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Signed in, but not an operator ─────────────────────────────────────────
  // A truck account is its own login (the signup route creates both), so a
  // signed-in customer lists a truck through the website.
  if (!truck) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <View style={styles.bigIcon}><Ionicons name="bus" size={30} color={Colors.primary} /></View>
        <Text style={styles.title}>List Your Truck</Text>
        <Text style={styles.subtitle}>
          Truck accounts are separate from customer accounts. Sign up your truck with its own
          email — it takes about two minutes — then sign in here to go live.
        </Text>
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

  const score = (truck.profile_photo ? 25 : 0) + (truck.description ? 25 : 0) + (truck.cuisine ? 25 : 0) + (truck.phone ? 25 : 0);
  const steps = [
    { done: !!truck.name && !!truck.description, label: 'Complete your truck profile', cta: 'Complete Profile', href: '/dashboard/profile' as const },
    { done: !!truck.phone, label: 'Add phone number for order alerts', cta: 'Add Phone', href: '/dashboard/profile' as const },
    { done: (menuCount ?? 0) > 0, label: 'Add at least one menu item', cta: 'Add Menu Item', href: '/dashboard/menu' as const },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const ready = missing.length === 0;

  const SECTIONS: { label: string; icon: IconName; href: Href; badge?: number }[] = [
    { label: 'Orders', icon: 'receipt-outline', href: '/dashboard/orders', badge: newOrders },
    { label: 'Menu', icon: 'restaurant-outline', href: '/dashboard/menu' },
    { label: 'Profile', icon: 'bus-outline', href: '/dashboard/profile' },
    { label: 'Schedule', icon: 'calendar-outline', href: '/dashboard/schedule' },
    { label: 'Analytics', icon: 'bar-chart-outline', href: '/dashboard/analytics' },
    { label: 'Catering', icon: 'people-outline', href: '/dashboard/catering' },
    { label: 'Packages', icon: 'cube-outline', href: '/dashboard/catering/packages' },
    { label: 'Social', icon: 'megaphone-outline', href: '/dashboard/social' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIcon}><Ionicons name="bus" size={17} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerName} numberOfLines={1}>{truck.name || 'My Truck'}</Text>
          {isLive ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.greenDot} />
              <Text style={styles.liveNow}>LIVE NOW</Text>
            </View>
          ) : (
            <Text style={styles.headerSub}>Operator Dashboard</Text>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.viewMap}>
          <Text style={styles.viewMapText}>View Map</Text>
        </TouchableOpacity>
      </View>

      {/* Profile completeness nudge */}
      {!nudgeDismissed && score < 100 && (
        <View style={styles.nudge}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.nudgeTitle}>Complete your profile — more customers find you</Text>
            <TouchableOpacity onPress={() => setNudgeDismissed(true)} accessibilityLabel="Dismiss"><Ionicons name="close" size={16} color={T.amber400} /></TouchableOpacity>
          </View>
          <View style={styles.nudgeTrack}><View style={[styles.nudgeFill, { width: `${score}%` }]} /></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.nudgePct}>{score}% complete</Text>
            <TouchableOpacity onPress={() => router.push('/dashboard/profile')}><Text style={styles.nudgeLink}>Go to Profile →</Text></TouchableOpacity>
          </View>
          <View style={styles.nudgeTags}>
            {!truck.profile_photo && <Text style={styles.nudgeTag}>+ Photo</Text>}
            {!truck.description && <Text style={styles.nudgeTag}>+ Description</Text>}
            {!truck.cuisine && <Text style={styles.nudgeTag}>+ Cuisine type</Text>}
            {!truck.phone && <Text style={styles.nudgeTag}>+ Phone number</Text>}
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await reload(); await loadStats(); setRefreshing(false); }} tintColor={Colors.primary} />}
      >
        {/* Setup checklist — shown until profile + menu are set up */}
        {!ready && menuCount !== null && (
          <View style={styles.card}>
            <View style={{ padding: 16, paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.cardTitle}>Setup Checklist</Text>
                <Text style={styles.cardMeta}>{doneCount}/{steps.length} done</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${Math.round((doneCount / steps.length) * 100)}%` }]} /></View>
            </View>
            {steps.map((step) => (
              <View key={step.label} style={styles.step}>
                <View style={[styles.stepDot, step.done && { backgroundColor: T.green500 }]}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{step.done ? '✓' : ''}</Text>
                </View>
                <Text style={[styles.stepLabel, step.done && styles.stepDone]}>{step.label}</Text>
                {!step.done && (
                  <TouchableOpacity onPress={() => router.push(step.href)} style={styles.stepCta}>
                    <Text style={styles.stepCtaText}>{step.cta} →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Stats row */}
        <View style={styles.stats}>
          {[
            { label: 'Followers', val: String(followers) },
            { label: 'Status', val: isLive ? 'LIVE' : 'Offline' },
            { label: 'Menu Items', val: menuCount === null ? '—' : String(menuCount) },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={[styles.statVal, s.label === 'Status' && isLive && { color: Colors.primary }]}>{s.val}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Big button */}
        <View style={styles.liveCard}>
          {phase === 'idle' && !isLive && (
            <>
              <TouchableOpacity
                style={[styles.circle, ready ? styles.circleReady : styles.circleBlocked]}
                onPress={goLiveGPS}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Go live"
              >
                <Text style={styles.circleTitle}>Go Live</Text>
                <Text style={styles.circleSub}>auto-detects location</Text>
              </TouchableOpacity>
              {!ready && <Text style={styles.hintSmall}>Complete the checklist above to go live</Text>}
              <TouchableOpacity onPress={() => setShowManual(!showManual)} style={{ marginTop: 14 }}>
                <Text style={styles.manualToggle}>{showManual ? 'Hide address entry' : 'Location not working? Enter address manually'}</Text>
              </TouchableOpacity>
              {showManual && (
                <View style={{ width: '100%', gap: 8, marginTop: 12 }}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 123 Main St, Newark NJ"
                    placeholderTextColor={T.n400}
                    value={manualAddress}
                    onChangeText={setManualAddress}
                    returnKeyType="done"
                    onSubmitEditing={goLiveManual}
                    autoCorrect={false}
                    maxLength={200}
                  />
                  <TouchableOpacity style={[styles.manualGo, !manualAddress.trim() && { opacity: 0.4 }]} onPress={goLiveManual} disabled={!manualAddress.trim()}>
                    <Text style={styles.manualGoText}>Go Live at This Address</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          {phase === 'locating' && (
            <View style={[styles.circle, { backgroundColor: T.n100 }]}>
              <ActivityIndicator color={T.n500} />
              <Text style={[styles.circleTitle, { color: T.n500, fontSize: 18, marginTop: 8 }]}>Finding you...</Text>
            </View>
          )}
          {isLive && phase !== 'locating' && (
            <>
              <View style={[styles.circle, styles.circleReady]}>
                <View style={styles.pulse} />
                <Text style={styles.circleTitle}>You&apos;re Live!</Text>
                {address ? <Text style={styles.circleAddr} numberOfLines={3}>{address}</Text> : null}
                <Text style={styles.circleSmall}>📍 Location updates automatically</Text>
              </View>
              {/* Line length — customers can report it, but the person at the
                  window is the one who knows. Their number outranks the
                  crowd's while it's fresh, then expires. */}
              <View style={styles.waitCard}>
                <View style={styles.waitHeader}>
                  <Text style={styles.waitTitle}>How long is your line?</Text>
                  {waitMinutes != null && waitFresh ? (
                    <TouchableOpacity onPress={() => saveWaitTime(null)} disabled={waitSaving} hitSlop={8}>
                      <Text style={styles.waitClear}>Clear</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Text style={styles.waitHint}>
                  {waitMinutes != null && waitFresh
                    ? `Showing "${waitLabel(waitMinutes)}" on your listing — expires ${OPERATOR_WAIT_TTL_MIN} min after you set it.`
                    : 'Shown on your pin and your profile. One tap, and it helps people pick you over a 40-minute delivery.'}
                </Text>
                <View style={styles.waitRow}>
                  {WAIT_BUCKETS.map((bucket) => {
                    const active = waitMinutes === bucket && waitFresh;
                    return (
                      <TouchableOpacity
                        key={bucket}
                        style={[styles.waitChip, active && styles.waitChipActive]}
                        onPress={() => saveWaitTime(bucket)}
                        disabled={waitSaving}
                        accessibilityRole="button"
                        accessibilityLabel={waitLabel(bucket)}
                      >
                        <Text style={[styles.waitChipText, active && styles.waitChipTextActive]}>
                          {waitLabel(bucket).replace(' wait', '')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity style={styles.offline} onPress={goOffline} disabled={phase === 'going-offline'}>
                <Text style={styles.offlineText}>{phase === 'going-offline' ? 'Going Offline…' : 'Go Offline'}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Every other dashboard section */}
        <Text style={styles.sectionLabel}>MANAGE YOUR TRUCK</Text>
        <View style={styles.grid}>
          {SECTIONS.map((sec) => (
            <TouchableOpacity
              key={sec.label}
              style={styles.tile}
              onPress={() => { if (sec.label === 'Orders') setNewOrders(0); router.push(sec.href); }}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={sec.badge ? `${sec.label}, ${sec.badge} new` : sec.label}
            >
              <Ionicons name={sec.icon} size={22} color={Colors.primary} style={{ marginBottom: 6 }} />
              <Text style={styles.tileLabel}>{sec.label}</Text>
              {!!sec.badge && sec.badge > 0 && (
                <View style={styles.badge}><Text style={styles.badgeText}>{sec.badge}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.hint}>Going live notifies your followers and puts your truck on the map instantly.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  waitCard: { width: '100%', backgroundColor: '#fff', borderWidth: 1, borderColor: T.n200, borderRadius: 16, padding: 16, marginTop: 16 },
  waitHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  waitTitle: { fontSize: 14, fontWeight: '900', color: T.n800 },
  waitClear: { fontSize: 11, fontWeight: '700', color: T.n400 },
  waitHint: { fontSize: 11, color: T.n400, marginTop: 4, marginBottom: 12, lineHeight: 15 },
  waitRow: { flexDirection: 'row', gap: 8 },
  waitChip: { flex: 1, paddingVertical: 9, borderRadius: 12, borderWidth: 2, borderColor: T.n200, backgroundColor: '#fff', alignItems: 'center' },
  waitChipActive: { borderColor: Colors.primary, backgroundColor: '#FEF2F0' },
  waitChipText: { fontSize: 12, fontWeight: '700', color: T.n600 },
  waitChipTextActive: { color: Colors.primary },

  container: { flex: 1, backgroundColor: T.n50 },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  scroll: { padding: 16, paddingBottom: 48, gap: 16 },

  bigIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: T.red50, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  urlHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 12, textAlign: 'center' },
  link: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 40 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  header: { backgroundColor: T.n900, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 11, color: T.n500, fontWeight: '500', marginTop: 2 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  liveNow: { fontSize: 11, color: '#4ADE80', fontWeight: '800', letterSpacing: 0.5 },
  viewMap: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' },
  viewMapText: { fontSize: 12, color: T.n400 },

  nudge: { backgroundColor: T.amber50, borderBottomWidth: 1, borderBottomColor: T.amber100, paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  nudgeTitle: { fontSize: 13, fontWeight: '900', color: '#78350F', flex: 1 },
  nudgeTrack: { height: 6, backgroundColor: '#FDE68A', borderRadius: 3, overflow: 'hidden' },
  nudgeFill: { height: '100%', backgroundColor: T.amber500, borderRadius: 3 },
  nudgePct: { fontSize: 12, color: T.amber700 },
  nudgeLink: { fontSize: 12, fontWeight: '700', color: T.amber800 },
  nudgeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nudgeTag: { fontSize: 11, fontWeight: '600', color: T.amber700, backgroundColor: T.amber100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },

  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...shadow },
  cardTitle: { fontSize: 14, fontWeight: '900', color: T.n800 },
  cardMeta: { fontSize: 12, fontWeight: '700', color: T.n400 },
  track: { height: 6, backgroundColor: T.n100, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: T.n50 },
  stepDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: T.n700 },
  stepDone: { textDecorationLine: 'line-through', color: T.n300, fontWeight: '400' },
  stepCta: { backgroundColor: T.red50, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  stepCtaText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 12, alignItems: 'center', ...shadow },
  statVal: { fontSize: 20, fontWeight: '900', color: T.n800 },
  statLabel: { fontSize: 10, fontWeight: '500', color: T.n400, marginTop: 2 },

  liveCard: { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', ...shadow },
  circle: { width: 208, height: 208, borderRadius: 104, alignItems: 'center', justifyContent: 'center', padding: 20 },
  circleReady: { backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  circleBlocked: { backgroundColor: T.n300 },
  circleTitle: { fontSize: 24, fontWeight: '900', color: '#fff' },
  circleSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  circleAddr: { fontSize: 12, color: 'rgba(255,255,255,0.85)', textAlign: 'center', marginTop: 8 },
  circleSmall: { fontSize: 10, color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginTop: 6 },
  pulse: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FECACA', marginBottom: 8 },
  hintSmall: { fontSize: 12, color: T.n400, marginTop: 10, textAlign: 'center' },
  manualToggle: { fontSize: 14, color: T.n400, textDecorationLine: 'underline' },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, color: T.n900, borderWidth: 1, borderColor: T.n200 },
  manualGo: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  manualGoText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  offline: { marginTop: 16, borderWidth: 2, borderColor: T.n300, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 12 },
  offlineText: { color: T.n600, fontWeight: '600', fontSize: 14 },

  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: T.n400, marginBottom: -6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '22.8%', flexGrow: 1, backgroundColor: '#fff', borderRadius: 16, paddingVertical: 14, alignItems: 'center', ...shadow },
  tileLabel: { fontSize: 12, fontWeight: '700', color: T.n700 },
  badge: { position: 'absolute', top: 6, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.green500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  hint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
