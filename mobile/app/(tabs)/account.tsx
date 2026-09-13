import { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Alert, Image, ActivityIndicator, ScrollView, Linking, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clearPushToken, setupNotifications } from '@/lib/notifications';
import { API_BASE } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { T, ToggleRow, TruckPhoto, shadow } from '@/components/ui';

type Followed = {
  truck_id: string;
  trucks: { id: string; name: string; cuisine: string | null; profile_photo: string | null; is_live: boolean | null; avg_rating: number | null } | null;
};
type RecentOrder = {
  id: string; total: number | null; status: string; created_at: string;
  items: { name: string; quantity: number }[] | null; trucks: { name: string } | null;
};
type Tab = 'trucks' | 'orders' | 'settings';

// Same keys and defaults as the web account page — both read and write
// user_metadata.notifications, and the server treats a missing key as opted in.
const DEFAULT_NOTIFICATIONS = { newLocation: true, orderReady: true, weeklyDigest: false, announcements: true };
type NotificationPrefs = typeof DEFAULT_NOTIFICATIONS;

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  picked_up: { bg: T.green50, fg: T.green600 },
  ready: { bg: T.blue50, fg: T.blue600 },
  preparing: { bg: T.yellow50, fg: '#CA8A04' },
};

/** Mobile twin of the web /account page: Favorites, Orders and Settings. */
export default function AccountTab() {
  const { session } = useAuth();
  const router = useRouter();

  if (!session) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.signedOutHero}>
          <View style={styles.signedOutIcon}><Ionicons name="person" size={26} color={T.n400} /></View>
          <Text style={styles.signedOutTitle}>Sign in to your account</Text>
          <Text style={styles.signedOutSub}>Track orders, follow trucks, and more</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(auth)/login')} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} accessibilityRole="button" style={{ marginTop: 12 }}>
            <Text style={styles.signedOutLink}>Create an account</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <LinksCard router={router} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Keyed by user so nothing from one account survives into the next sign-in on this device.
  return <SignedInAccount key={session.user.id} session={session} />;
}

function SignedInAccount({ session }: { session: Session }) {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [avatarUrl, setAvatarUrl] = useState<string>(() => session.user.user_metadata?.avatar_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<Tab>('trucks');
  const [followed, setFollowed] = useState<Followed[]>([]);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // Merge over the defaults rather than replacing, like the web page.
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => {
    const saved = session.user.user_metadata?.notifications;
    return saved && typeof saved === 'object' ? { ...DEFAULT_NOTIFICATIONS, ...saved } : DEFAULT_NOTIFICATIONS;
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [pushStatus, setPushStatus] = useState<'granted' | 'denied' | 'undetermined' | 'unknown'>('unknown');
  const [pushWorking, setPushWorking] = useState(false);
  const unfollowInFlight = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true; // reset on every mount (e.g. tab re-navigation)
    return () => { mountedRef.current = false; };
  }, []);

  const userId = session.user.id;
  const loadData = useCallback(async () => {
    try {
      const [{ data: follows }, { data: orderData }] = await Promise.all([
        supabase.from('follows').select('truck_id, trucks(id, name, cuisine, profile_photo, is_live, avg_rating)').eq('user_id', userId).limit(200),
        supabase.from('orders').select('id, total, status, created_at, items, trucks(name)').eq('customer_id', userId)
          .order('created_at', { ascending: false }).limit(20),
      ]);
      if (!mountedRef.current) return;
      setFollowed((follows ?? []) as unknown as Followed[]);
      setOrders((orderData ?? []) as unknown as RecentOrder[]);
    } catch { /* keep what's on screen */ }
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (mountedRef.current) setPushStatus(status as 'granted' | 'denied' | 'undetermined');
    } catch { /* unsupported (simulator) */ }
  }, [userId]);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  async function unfollow(truckId: string) {
    if (unfollowInFlight.current.has(truckId)) return;
    unfollowInFlight.current.add(truckId);
    const snapshot = followed;
    setFollowed((prev) => prev.filter((f) => f.truck_id !== truckId));
    try {
      const { error } = await supabase.from('follows').delete().eq('truck_id', truckId).eq('user_id', userId);
      if (error) throw error;
    } catch {
      if (mountedRef.current) {
        setFollowed(snapshot);
        Alert.alert('', 'Could not remove favorite — please try again.');
      }
    } finally {
      unfollowInFlight.current.delete(truckId);
    }
  }

  async function updatePref(key: keyof NotificationPrefs, value: boolean) {
    if (savingPrefs) return;
    const prev = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSavingPrefs(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { notifications: next } });
      if (error) throw error;
    } catch {
      if (mountedRef.current) {
        setPrefs(prev);
        Alert.alert('', 'Could not save preference — please try again.');
      }
    } finally {
      if (mountedRef.current) setSavingPrefs(false);
    }
  }

  async function enablePush() {
    if (pushWorking) return;
    if (pushStatus === 'denied') {
      // iOS won't show the prompt twice; the only way back is Settings.
      Linking.openSettings().catch(() => {});
      return;
    }
    setPushWorking(true);
    try {
      await setupNotifications();
      const { status } = await Notifications.getPermissionsAsync();
      if (mountedRef.current) setPushStatus(status as 'granted' | 'denied' | 'undetermined');
    } catch { /* leave status as-is */ } finally {
      if (mountedRef.current) setPushWorking(false);
    }
  }


  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearPushToken();
            await supabase.auth.signOut();
          } catch {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          }
        },
      },
    ]);
  }

  /**
   * Performs the deletion. `deleteTruck` acknowledges the truck cascade —
   * the API refuses with 409 + requiresTruckAck until it is true for an
   * account that owns a listing.
   */
  async function runDeleteAccount(deleteTruck: boolean) {
    if (deleting) return;
    setDeleting(true);
    try {
      const { data: { session: s } } = await supabase.auth.getSession();
      if (!s?.access_token) throw new Error('Not signed in');

      const res = await fetch(`${API_BASE}/api/account/delete`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${s.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleteTruck }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as {
          error?: string;
          requiresTruckAck?: boolean;
          truck?: { name: string; menuItems: number; followers: number };
        };

        // This account owns a truck. Deleting the auth user cascades to the
        // listing, its menu, schedule, photos, followers and reviews. Say so
        // plainly and take a second confirmation rather than failing here —
        // in-app deletion has to remain completable (App Store 5.1.1(v)).
        if (err.requiresTruckAck && err.truck) {
          const t = err.truck;
          if (mountedRef.current) setDeleting(false);
          Alert.alert(
            `This also deletes ${t.name}`,
            `Your truck listing is tied to this account. Deleting it removes:\n\n` +
              `• Your listing and its place on the map\n` +
              `• ${t.menuItems} menu item${t.menuItems === 1 ? '' : 's'}, your weekly schedule and your photos\n` +
              `• ${t.followers} follower${t.followers === 1 ? '' : 's'} and every review customers have left you\n\n` +
              `Past orders are kept for your records but will no longer be linked to the truck. ` +
              `None of this can be restored.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Truck & Account',
                style: 'destructive',
                onPress: () => { void runDeleteAccount(true); },
              },
            ]
          );
          return;
        }
        throw new Error(err.error ?? 'Deletion failed');
      }

      Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
      await clearPushToken();
      await supabase.auth.signOut();
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Could not delete account. Please try again.';
        Alert.alert('Error', message);
      }
    } finally {
      if (mountedRef.current) setDeleting(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => { void runDeleteAccount(false); },
        },
      ]
    );
  }

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!session?.user) return;

    // Check size (5 MB limit)
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Please choose a photo under 5 MB.');
      return;
    }

    setUploading(true);
    try {
      // Derive a safe MIME type and extension from the asset
      const rawMime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg',
        'image/png': 'png', 'image/webp': 'webp',
        'image/heic': 'jpg', // HEIC fetched as blob becomes JPEG on iOS
      };
      const safeExt = mimeToExt[rawMime] ?? 'jpg';
      const safeContentType = safeExt === 'jpg' ? 'image/jpeg' : `image/${safeExt}`;
      const path = `customers/${session.user.id}.${safeExt}`;

      // Fetch the image as a blob
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Could not read photo from device.');
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: safeContentType });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Could not get photo URL — try again.');

      const { error: updateErr } = await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl },
      });
      if (updateErr) throw new Error('Photo uploaded but failed to save: ' + updateErr.message);

      if (!mountedRef.current) return;
      setAvatarUrl(data.publicUrl);
      Alert.alert('', 'Profile photo updated!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      if (mountedRef.current) Alert.alert('Upload failed', message);
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  const memberSince = session.user.created_at
    ? new Date(session.user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={pickAndUploadAvatar}
          disabled={uploading}
          accessibilityLabel={uploading ? 'Uploading profile photo' : 'Change profile photo'}
          accessibilityRole="button"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" alt="Your profile photo" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{((session.user.email ?? '?')[0] ?? '?').toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            {uploading ? <ActivityIndicator size={10} color="#fff" /> : <Ionicons name="camera" size={11} color="#fff" />}
          </View>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Account</Text>
          <Text style={styles.headerEmail} numberOfLines={1}>{session.user.email}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { id: 'trucks', label: 'Favorites', count: followed.length },
          { id: 'orders', label: 'Orders', count: orders.length },
          { id: 'settings', label: 'Settings', count: null },
        ] as { id: Tab; label: string; count: number | null }[]).map((t) => (
          <TouchableOpacity
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.id }}
          >
            <Text style={[styles.tabText, tab === t.id && { color: Colors.primary }]}>{t.label}</Text>
            {t.count !== null && (
              <View style={[styles.tabCount, tab === t.id && { backgroundColor: T.red100 }]}>
                <Text style={[styles.tabCountText, tab === t.id && { color: Colors.primary }]}>{t.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={Colors.primary} />}
      >
        {tab === 'trucks' && (
          followed.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={36} color={T.n300} />
              <Text style={styles.emptyTitle}>No favorites yet</Text>
              <Text style={styles.emptyBody}>Tap the heart on any truck to follow it and get notified when it goes live.</Text>
              <TouchableOpacity style={[styles.primaryButton, { marginTop: 16 }]} onPress={() => router.push('/(tabs)/trucks')}>
                <Text style={styles.primaryButtonText}>Browse Trucks</Text>
              </TouchableOpacity>
            </View>
          ) : followed.map((f) => f.trucks && (
            <TouchableOpacity key={f.truck_id} style={styles.favCard} onPress={() => router.push(`/truck/${f.truck_id}`)} activeOpacity={0.8}>
              <TruckPhoto uri={f.trucks.profile_photo} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.favName} numberOfLines={1}>{f.trucks.name.toUpperCase()}</Text>
                <Text style={styles.favCuisine}>{f.trucks.cuisine ?? 'Food Truck'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  {f.trucks.is_live ? <Text style={styles.liveBadge}>● LIVE</Text> : <Text style={styles.offBadge}>Offline</Text>}
                  {(f.trucks.avg_rating ?? 0) > 0 && <Text style={styles.rating}>★ {Number(f.trucks.avg_rating).toFixed(1)}</Text>}
                </View>
              </View>
              <TouchableOpacity onPress={() => unfollow(f.truck_id)} hitSlop={10} accessibilityLabel={`Remove ${f.trucks.name} from favorites`}>
                <Ionicons name="heart" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        {tab === 'orders' && (
          orders.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyBody}>Orders you place from a truck&apos;s menu show up here.</Text>
            </View>
          ) : (
            <>
              {orders.map((o) => {
                const st = STATUS_STYLE[o.status] ?? { bg: T.n100, fg: T.n500 };
                return (
                  <View key={o.id} style={styles.orderCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.orderTruck}>{o.trucks?.name ?? 'Food Truck'}</Text>
                        <Text style={styles.orderDate}>{new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={styles.orderTotal}>${(o.total ?? 0).toFixed(2)}</Text>
                        <Text style={[styles.status, { backgroundColor: st.bg, color: st.fg }]}>{o.status.replace('_', ' ').toUpperCase()}</Text>
                      </View>
                    </View>
                    {Array.isArray(o.items) && o.items.length > 0
                      ? o.items.map((it, i) => <Text key={i} style={styles.orderItem}>x{it.quantity} {it.name}</Text>)
                      : <Text style={styles.orderItem}>No items</Text>}
                  </View>
                );
              })}
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={styles.linkText}>See live order status →</Text>
              </TouchableOpacity>
            </>
          )
        )}

        {tab === 'settings' && (
          <>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle}>Notifications</Text>
                {savingPrefs && <Text style={styles.saving}>Saving...</Text>}
              </View>
              <ToggleRow label="New location alerts" description="When a followed truck goes live" value={prefs.newLocation} onValueChange={(v) => updatePref('newLocation', v)} />
              <ToggleRow label="Order ready" description="When your order is ready for pickup" value={prefs.orderReady} onValueChange={(v) => updatePref('orderReady', v)} />
              <ToggleRow label="Weekly digest" description="New trucks and updates in your area" value={prefs.weeklyDigest} onValueChange={(v) => updatePref('weeklyDigest', v)} />
              <ToggleRow label="Hot Truck Map announcements" description="Occasional news about the app itself" value={prefs.announcements} onValueChange={(v) => updatePref('announcements', v)} last />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Push Notifications</Text>
              <Text style={styles.cardSub}>Get alerts on this phone when your favorite trucks go live or your order is ready.</Text>
              <View style={styles.pushRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pushState}>
                    {pushStatus === 'granted' ? 'Enabled on this device' : pushStatus === 'denied' ? 'Blocked in Settings' : 'Not enabled'}
                  </Text>
                  <Text style={styles.cardSub}>
                    {pushStatus === 'denied' ? 'Turn notifications on for Hot Truck Map in your phone settings.' : pushStatus === 'granted' ? 'You’re all set.' : 'Tap Enable to allow alerts.'}
                  </Text>
                </View>
                {pushStatus !== 'granted' && (
                  <TouchableOpacity style={styles.smallBtn} onPress={enablePush} disabled={pushWorking}>
                    {pushWorking ? <ActivityIndicator size="small" color="#fff" /> : (
                      <Text style={styles.smallBtnText}>{pushStatus === 'denied' ? 'Open Settings' : 'Enable'}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account</Text>
              <View style={styles.infoRow}><Text style={styles.infoLabel}>Email</Text><Text style={styles.infoValue} numberOfLines={1}>{session.user.email}</Text></View>
              {memberSince ? <View style={[styles.infoRow, { borderBottomWidth: 0 }]}><Text style={styles.infoLabel}>Member since</Text><Text style={styles.infoValue}>{memberSince}</Text></View> : null}
            </View>

            <LinksCard router={router} />

            <TouchableOpacity activeOpacity={0.7} style={styles.signOutButton} onPress={handleSignOut} accessibilityRole="button">
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={styles.danger}>
              <Text style={styles.dangerTitle}>Delete Account</Text>
              <Text style={styles.dangerBody}>Permanently delete your account and all your data. This cannot be undone.</Text>
              <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount} disabled={deleting} accessibilityRole="button">
                <Text style={styles.dangerBtnText}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Everywhere else in the app — the website's footer, as a list. */
function LinksCard({ router }: { router: ReturnType<typeof useRouter> }) {
  const rows: { label: string; onPress: () => void }[] = [
    { label: 'Newsletter', onPress: () => router.push('/newsletter') },
    { label: 'Community Reviews', onPress: () => router.push('/reviews') },
    { label: 'Leaderboards', onPress: () => router.push('/leaderboard') },
    { label: 'Food Truck Catering', onPress: () => router.push('/catering') },
    { label: 'Contact Us', onPress: () => router.push('/contact') },
    { label: 'Support', onPress: () => router.push('/support') },
    { label: 'About Hot Truck Map', onPress: () => router.push('/about' as Href) },
    { label: 'Privacy Policy', onPress: () => Linking.openURL(`${API_BASE}/privacy`) },
    { label: 'Terms of Service', onPress: () => Linking.openURL(`${API_BASE}/terms`) },
  ];
  return (
    <View style={[styles.card, { paddingVertical: 0 }]}>
      {rows.map((r, i) => (
        <TouchableOpacity key={r.label} onPress={r.onPress} style={[styles.linkRow, i === rows.length - 1 && { borderBottomWidth: 0 }]} accessibilityRole="button">
          <Text style={styles.linkRowText}>{r.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.n100 },
  header: { backgroundColor: T.n900, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 },
  avatarWrapper: { position: 'relative' },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: T.n900, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#fff' },
  headerEmail: { fontSize: 12, color: T.n500, marginTop: 2 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: T.n100 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontWeight: '700', color: T.n400 },
  tabCount: { backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  tabCountText: { fontSize: 11, fontWeight: '700', color: T.n400 },
  body: { padding: 16, gap: 12, paddingBottom: 48 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: T.n800, marginTop: 8 },
  emptyBody: { fontSize: 14, color: T.n400, textAlign: 'center', marginTop: 4, lineHeight: 20 },
  favCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 12, ...shadow },
  favName: { fontSize: 14, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  favCuisine: { fontSize: 12, fontWeight: '700', color: Colors.primary, marginTop: 2 },
  liveBadge: { fontSize: 10, fontWeight: '900', color: Colors.primary },
  offBadge: { fontSize: 10, fontWeight: '600', color: T.n400 },
  rating: { fontSize: 11, fontWeight: '700', color: T.n600 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 4, ...shadow },
  orderTruck: { fontSize: 15, fontWeight: '600', color: T.n800 },
  orderDate: { fontSize: 12, color: T.n400, marginTop: 2 },
  orderTotal: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  status: { fontSize: 10, fontWeight: '700', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  orderItem: { fontSize: 12, color: T.n400 },
  linkText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, ...shadow },
  cardTitle: { fontSize: 14, fontWeight: '700', color: T.n800 },
  cardSub: { fontSize: 12, color: T.n400, marginTop: 4, lineHeight: 17 },
  saving: { fontSize: 12, color: T.n400 },
  pushRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  pushState: { fontSize: 14, fontWeight: '500', color: T.n700 },
  smallBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, minWidth: 80, alignItems: 'center' },
  smallBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.n100 },
  infoLabel: { fontSize: 14, color: T.n600 },
  infoValue: { fontSize: 14, color: T.n400, flexShrink: 1 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.n100 },
  linkRowText: { fontSize: 15, color: T.n800 },
  chevron: { fontSize: 20, color: T.n300 },
  signOutButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: T.n200, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  signOutText: { color: T.n700, fontSize: 15, fontWeight: '700' },
  danger: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', padding: 16 },
  dangerTitle: { fontSize: 14, fontWeight: '700', color: T.n800 },
  dangerBody: { fontSize: 12, color: T.n400, marginTop: 4, lineHeight: 17 },
  dangerBtn: { marginTop: 12, borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  dangerBtnText: { color: T.red600, fontSize: 14, fontWeight: '700' },
  signedOutHero: { backgroundColor: T.n900, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  signedOutIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: T.n800, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  signedOutTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  signedOutSub: { fontSize: 14, color: T.n400, marginTop: 4, marginBottom: 20 },
  signedOutLink: { fontSize: 14, fontWeight: '600', color: T.n300 },
  primaryButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 36 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
