import { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, View, Text, Image, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert,
  Modal, FlatList, Dimensions, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { Truck, MenuItem, Location, Review } from '@shared/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PHOTO_COL_SIZE = (SCREEN_WIDTH - 48 - 8) / 2; // 2 columns with padding

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';

type TruckPhoto = {
  id: string;
  user_id: string;
  photo_url: string;
  created_at: string;
};

type SpottedPost = {
  id: string;
  user_id: string;
  location: string;
  note: string | null;
  created_at: string;
};

type ScheduleDay = {
  open: boolean;
  open_time?: string;
  close_time?: string;
  location?: string;
};

type Schedule = Record<string, ScheduleDay>;

type TruckDetail = Truck & {
  location?: Location;
  menu_items?: MenuItem[];
  schedule?: Schedule | null;
  offers_catering?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmt24to12(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24 ?? '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  if (isNaN(h)) return time24;
  const m = mStr ?? '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function TruckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mountedRef = useRef(true);
  const followInFlightRef = useRef(false);

  // Core
  const [truck, setTruck] = useState<TruckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Photos
  const [photos, setPhotos] = useState<TruckPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Cart / Order
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderModalVisible, setOrderModalVisible] = useState(false);
  const [pickupName, setPickupName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const orderInFlightRef = useRef(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Spotted
  const [spottedPosts, setSpottedPosts] = useState<SpottedPost[]>([]);
  const [spottedLocation, setSpottedLocation] = useState('');
  const [spottedNote, setSpottedNote] = useState('');
  const spottedInFlightRef = useRef(false);
  const [spottedSubmitting, setSpottedSubmitting] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userReview, setUserReview] = useState<Review | null | undefined>(undefined); // undefined = not checked yet
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const reviewInFlightRef = useRef(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Load truck data
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    async function load() {
      try {
        const [truckRes, menuRes, locationRes, spottedRes, reviewsRes] = await Promise.all([
          supabase.from('trucks').select('id, name, cuisine, description, profile_photo, is_live, dietary_tags, instagram, phone, avg_rating, review_count, catering_description, catering_starting_price, catering_min_guests, schedule').eq('id', id).maybeSingle(),
          supabase.from('menu_items').select('id, truck_id, name, description, price, allergens, is_sold_out, photo, is_popular, sort_order, category').eq('truck_id', id).limit(200),
          supabase
            .from('locations')
            .select('id, lat, lng, address, broadcasted_at')
            .eq('truck_id', id)
            .order('broadcasted_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('spotted_posts')
            .select('id, user_id, location, note, created_at')
            .eq('truck_id', id)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('reviews')
            .select('id, rating, comment, created_at, truck_id')
            .eq('truck_id', id)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);

        if (!mountedRef.current) return;
        if (truckRes.data) {
          navigation.setOptions({ title: truckRes.data.name });
          setTruck({
            ...truckRes.data,
            menu_items: menuRes.data ?? [],
            location: locationRes.data ?? undefined,
          });
        }
        setSpottedPosts(spottedRes.data ?? []);
        setReviews(reviewsRes.data ?? []);

        // Photos
        const { data: photoData } = await supabase
          .from('truck_photos')
          .select('id, user_id, photo_url, created_at')
          .eq('truck_id', id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (mountedRef.current) setPhotos(photoData ?? []);
      } catch {
        // network error — "Truck not found" state will show
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }
    load();
  }, [id]);

  // Load auth state and keep token fresh via onAuthStateChange
  useEffect(() => {
    let mounted = true;

    async function loadFollowAndReview(uid: string) {
      const [followRes, reviewRes] = await Promise.all([
        supabase.from('follows').select('truck_id').eq('user_id', uid).eq('truck_id', id).maybeSingle(),
        supabase.from('reviews').select('id, rating, comment, created_at, truck_id, user_id').eq('truck_id', id).eq('user_id', uid).maybeSingle(),
      ]);
      if (!mounted) return;
      setFollowing(!!followRes.data);
      setUserReview(reviewRes.data ?? null);
    }

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || !mounted) return;
        setUserId(session.user.id);
        setAuthToken(session.access_token);
        await loadFollowAndReview(session.user.id);
      } catch {
        if (mounted) setUserReview(null);
      }
    }

    initAuth();

    // Keep token fresh — fires on token refresh and sign-in/out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUserId(session.user.id);
        setAuthToken(session.access_token);
      } else {
        setUserId(null);
        setAuthToken(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [id]);

  // ── Follow ────────────────────────────────────────────────────────────────

  async function toggleFollow() {
    if (!userId) { Alert.alert('Sign in required', 'Please sign in to follow trucks.'); return; }
    if (followInFlightRef.current) return;
    followInFlightRef.current = true;
    try {
      if (following) {
        const { error } = await supabase.from('follows').delete().eq('user_id', userId).eq('truck_id', id);
        if (error) { Alert.alert('Error', 'Could not unfollow. Please try again.'); }
        else if (mountedRef.current) setFollowing(false);
      } else {
        const { error } = await supabase.from('follows').insert({ user_id: userId, truck_id: id });
        if (error) { Alert.alert('Error', 'Could not follow. Please try again.'); }
        else if (mountedRef.current) setFollowing(true);
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      followInFlightRef.current = false;
    }
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  async function pickAndUploadPhoto() {
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to upload a photo.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload a photo of this truck.');
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Photos must be under 10 MB.');
        return;
      }
      if (!mountedRef.current) return;
      setPhotoUploading(true);
      const uri = asset.uri;
      // Prefer mimeType from the asset; fall back to extension-based guess
      const mimeType = asset.mimeType ?? `image/${uri.split('.').pop()?.toLowerCase() ?? 'jpeg'}`;
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
      const path = `truck-photos/${id}/${userId}-${Date.now()}.${ext}`;
      const response = await fetch(uri);
      if (!response.ok) throw new Error('Could not read photo from device.');
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Photo appears to be empty. Please try a different photo.');
      const { error: uploadError } = await supabase.storage
        .from('truck-photos')
        .upload(path, blob, { upsert: false, contentType: mimeType });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from('truck-photos').getPublicUrl(path);
      const { error: dbError } = await supabase.from('truck_photos').insert({
        truck_id: id,
        user_id: userId,
        photo_url: urlData.publicUrl,
      });
      if (dbError) {
        // Clean up the orphaned storage file before surfacing the error
        void supabase.storage.from('truck-photos').remove([path]).catch(() => {});
        throw new Error(dbError.message);
      }
      const { data: refreshed } = await supabase
        .from('truck_photos')
        .select('id, user_id, photo_url, created_at')
        .eq('truck_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (mountedRef.current) {
        setPhotos(refreshed ?? []);
        Alert.alert('Photo uploaded!', 'Your photo has been added.');
      }
    } catch (err: any) {
      if (mountedRef.current) Alert.alert('Upload failed', err?.message ?? 'Please try again.');
    } finally {
      if (mountedRef.current) setPhotoUploading(false);
    }
  }

  // ── Cart helpers ──────────────────────────────────────────────────────────

  const MAX_ITEM_QTY = 99;

  function addToCart(itemId: string) {
    setCart(prev => {
      const current = prev[itemId] ?? 0;
      if (current >= MAX_ITEM_QTY) return prev;
      return { ...prev, [itemId]: current + 1 };
    });
  }

  function removeFromCart(itemId: string) {
    setCart(prev => {
      const qty = (prev[itemId] ?? 0) - 1;
      if (qty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: qty };
    });
  }

  function cartCount(): number {
    return Object.values(cart).reduce((s, q) => s + q, 0);
  }

  function cartTotal(): number {
    return (truck?.menu_items ?? []).reduce((sum, item) => {
      return sum + (cart[item.id] ?? 0) * item.price;
    }, 0);
  }

  // ── Place Order ───────────────────────────────────────────────────────────

  async function placeOrder() {
    if (orderInFlightRef.current) return;
    if (!authToken) {
      Alert.alert('Sign In Required', 'You need to sign in before placing an order. This helps food trucks ensure every order gets picked up.');
      return;
    }
    if (!pickupName.trim()) {
      Alert.alert('Required', 'Please enter your pickup name.');
      return;
    }
    if (cartCount() === 0) {
      Alert.alert('Empty cart', 'Add items to your cart first.');
      return;
    }

    orderInFlightRef.current = true;
    setOrderSubmitting(true);
    try {
      const items = (truck?.menu_items ?? [])
        .filter(item => (cart[item.id] ?? 0) > 0)
        .map(item => ({
          menu_item_id: item.id,
          name: item.name,
          price: item.price,
          quantity: cart[item.id],
        }));

      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          truck_id: id,
          pickup_name: pickupName.trim(),
          notes: orderNotes.trim() || null,
          items,
          total: cartTotal(),
        }),
      });

      const json = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok) {
        if ((json as any).no_show_block) {
          Alert.alert(
            'Ordering Blocked',
            'Your account has been temporarily restricted due to multiple missed pickups. Please visit a food truck in person to order.',
          );
          return;
        }
        throw new Error((json as any).error ?? 'Order failed');
      }

      if (mountedRef.current) {
        setOrderModalVisible(false);
        setCart({});
        setPickupName('');
        setOrderNotes('');
        const shortId = typeof json.orderId === 'string' ? json.orderId.slice(0, 8).toUpperCase() : '—';
        Alert.alert('Order placed!', `Your order ID is #${shortId}`);
      }
    } catch (err: any) {
      if (mountedRef.current) Alert.alert('Error', err?.message ?? 'Could not place order. Please try again.');
    } finally {
      orderInFlightRef.current = false;
      if (mountedRef.current) setOrderSubmitting(false);
    }
  }

  // ── Spotted ───────────────────────────────────────────────────────────────

  async function submitSpotted() {
    if (spottedInFlightRef.current) return;
    if (!spottedLocation.trim()) {
      Alert.alert('Required', 'Please enter a location.');
      return;
    }
    if (!authToken) {
      Alert.alert('Sign in required', 'Please sign in to report a sighting.');
      return;
    }
    spottedInFlightRef.current = true;
    setSpottedSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/spotted`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          truck_id: id,
          location: spottedLocation.trim(),
          note: spottedNote.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not post sighting');

      if (mountedRef.current) {
        const newPost: SpottedPost = {
          id: json.id ?? String(Date.now()),
          user_id: userId ?? '',
          location: spottedLocation.trim(),
          note: spottedNote.trim() || null,
          created_at: new Date().toISOString(),
        };
        setSpottedPosts(prev => [newPost, ...prev.slice(0, 4)]);
        setSpottedLocation('');
        setSpottedNote('');
      }
    } catch (err: any) {
      if (mountedRef.current) Alert.alert('Error', err?.message ?? 'Could not post sighting. Please try again.');
    } finally {
      spottedInFlightRef.current = false;
      if (mountedRef.current) setSpottedSubmitting(false);
    }
  }

  // ── Review ────────────────────────────────────────────────────────────────

  async function submitReview() {
    if (reviewInFlightRef.current) return;
    if (reviewRating < 1 || reviewRating > 5) {
      Alert.alert('Required', 'Please select a star rating.');
      return;
    }
    if (!userId) {
      Alert.alert('Sign in required', 'Please sign in to leave a review.');
      return;
    }
    reviewInFlightRef.current = true;
    setReviewSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          truck_id: id,
          user_id: userId,
          rating: reviewRating,
          comment: reviewComment.trim().slice(0, 500) || null,
        })
        .select('id, rating, comment, created_at, truck_id')
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (mountedRef.current && data) {
        setUserReview(data);
        setReviews(prev => [data, ...prev]);
        setReviewRating(0);
        setReviewComment('');
        Alert.alert('Review submitted!', 'Thanks for your feedback.');
      }
    } catch (err: any) {
      if (mountedRef.current) Alert.alert('Error', err?.message ?? 'Could not submit review. Please try again.');
    } finally {
      reviewInFlightRef.current = false;
      if (mountedRef.current) setReviewSubmitting(false);
    }
  }

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!truck) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Truck not found</Text>
      </View>
    );
  }

  const isLive = truck.is_live === true;

  const cartItemCount = cartCount();
  const cartTotalAmt = cartTotal();

  // Order modal cart items
  const cartItems = (truck.menu_items ?? []).filter(item => (cart[item.id] ?? 0) > 0);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {truck.profile_photo ? (
          <Image source={{ uri: truck.profile_photo }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]} />
        )}

        <View style={styles.body}>
          {/* Title row */}
          <View style={styles.titleRow}>
            <Text style={styles.name}>{truck.name}</Text>
            {isLive && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Live</Text>
              </View>
            )}
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            {truck.cuisine ? <Text style={styles.cuisine}>{truck.cuisine}</Text> : null}
            {(truck.avg_rating ?? 0) > 0 && (
              <View style={styles.ratingRow}>
                <Text style={styles.ratingStar}>★</Text>
                <Text style={styles.ratingValue}>{Number(truck.avg_rating).toFixed(1)}</Text>
                <Text style={styles.ratingCount}>({truck.review_count ?? 0} review{(truck.review_count ?? 0) !== 1 ? 's' : ''})</Text>
              </View>
            )}
          </View>

          {truck.description ? (
            <Text style={styles.description}>{truck.description}</Text>
          ) : null}

          {/* Location */}
          {isLive && truck.location && (
            <View style={styles.locationBox}>
              <Text style={styles.locationLabel}>Current location</Text>
              <Text style={styles.locationAddress}>{truck.location.address ?? ''}</Text>
            </View>
          )}

          {/* ── Weekly Schedule ── */}
          <View style={styles.scheduleBox}>
            <Text style={styles.sectionHeading}>Weekly Schedule</Text>
            {truck.schedule && Object.keys(truck.schedule).length > 0 ? (
              DAY_KEYS.map(day => {
                const entry = (truck.schedule as Schedule)[day];
                if (!entry || !entry.open) {
                  return (
                    <View key={day} style={styles.scheduleRow}>
                      <Text style={styles.scheduleDay}>{DAY_LABELS[day]}</Text>
                      <Text style={styles.scheduleClosed}>Closed</Text>
                    </View>
                  );
                }
                // Support both key naming conventions (web saves start/end, older data may use open_time/close_time)
                const openKey = (entry as any).start ?? (entry as any).open_time;
                const closeKey = (entry as any).end ?? (entry as any).close_time;
                const timeStr = openKey && closeKey
                  ? `${fmt24to12(openKey)} – ${fmt24to12(closeKey)}`
                  : 'Hours vary';
                return (
                  <View key={day} style={styles.scheduleRow}>
                    <Text style={styles.scheduleDay}>{DAY_LABELS[day]}</Text>
                    <Text style={styles.scheduleTime}>{timeStr}{entry.location ? ` · ${entry.location}` : ''}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.scheduleEmpty}>No schedule posted yet</Text>
            )}
          </View>

          <TouchableOpacity
            style={[styles.followButton, following && styles.followButtonActive]}
            onPress={toggleFollow}
            accessibilityLabel={following ? 'Unfollow this truck' : 'Follow this truck'}
            accessibilityRole="button"
          >
            <Text style={[styles.followButtonText, following && styles.followButtonTextActive]}>
              {following ? '✓ Following' : '+ Follow'}
            </Text>
          </TouchableOpacity>

          {/* ── Catering Button ── */}
          {truck.offers_catering && (
            <TouchableOpacity
              style={styles.cateringButton}
              onPress={() => router.push(`/catering/${id}` as any)}
              accessibilityLabel="Request catering from this truck"
              accessibilityRole="button"
            >
              <Text style={styles.cateringButtonText}>Request Catering</Text>
            </TouchableOpacity>
          )}

          {/* ── Menu ── */}
          {(truck.menu_items?.length ?? 0) > 0 && (
            <>
              <Text style={styles.menuHeading}>Menu</Text>
              {!isLive && (
                <Text style={styles.notLiveNote}>Not currently accepting orders</Text>
              )}
              {truck.menu_items?.map(item => {
                const soldOut = (item as any).is_sold_out === true;
                return (
                  <View key={item.id} style={[styles.menuItem, soldOut && { opacity: 0.45 }]}>
                    <View style={styles.menuItemInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.menuItemName}>{item.name}</Text>
                        {soldOut && (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#E8481C', backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>SOLD OUT</Text>
                        )}
                      </View>
                      {item.description ? (
                        <Text style={styles.menuItemDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}
                    </View>
                    <View style={styles.menuItemRight}>
                      <Text style={styles.menuItemPrice}>${(item.price ?? 0).toFixed(2)}</Text>
                      {isLive && !soldOut && (
                        <View style={styles.cartControls}>
                          <TouchableOpacity
                            style={styles.cartBtn}
                            onPress={() => removeFromCart(item.id)}
                            disabled={(cart[item.id] ?? 0) === 0}
                          >
                            <Text style={[styles.cartBtnText, (cart[item.id] ?? 0) === 0 && styles.cartBtnDisabled]}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.cartQty}>{cart[item.id] ?? 0}</Text>
                          <TouchableOpacity
                            style={styles.cartBtn}
                            onPress={() => addToCart(item.id)}
                          >
                            <Text style={styles.cartBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* ── Spotted Section ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>📍 Spotted Here!</Text>
          </View>

          {spottedPosts.length === 0 ? (
            <Text style={styles.emptyPhotos}>No sightings yet — be the first!</Text>
          ) : (
            spottedPosts.map(post => (
              <View key={post.id} style={styles.spottedCard}>
                <View style={styles.spottedRow}>
                  <Text style={styles.spottedLocation}>{post.location}</Text>
                  <Text style={styles.spottedTime}>{timeAgo(post.created_at)}</Text>
                </View>
                {post.note ? <Text style={styles.spottedNote}>{post.note}</Text> : null}
              </View>
            ))
          )}

          {userId && authToken && (
            <View style={styles.spottedForm}>
              <Text style={styles.formLabel}>Report a sighting</Text>
              <TextInput
                style={styles.input}
                placeholder="Location (e.g. Main St & 5th Ave)"
                placeholderTextColor={Colors.textMuted}
                value={spottedLocation}
                onChangeText={t => setSpottedLocation(t.slice(0, 100))}
                maxLength={100}
              />
              <TextInput
                style={styles.input}
                placeholder="Note (optional)"
                placeholderTextColor={Colors.textMuted}
                value={spottedNote}
                onChangeText={t => setSpottedNote(t.slice(0, 200))}
                maxLength={200}
              />
              <TouchableOpacity
                style={[styles.submitBtn, spottedSubmitting && styles.submitBtnDisabled]}
                onPress={submitSpotted}
                disabled={spottedSubmitting}
              >
                {spottedSubmitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.submitBtnText}>Report Sighting</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Reviews Section ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Reviews</Text>
          </View>

          {reviews.length === 0 ? (
            <Text style={styles.emptyPhotos}>No reviews yet.</Text>
          ) : (
            reviews.map(review => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewRow}>
                  <Text style={styles.reviewStars}>{'★'.repeat(Math.max(0, Math.min(5, review.rating ?? 0)))}{'☆'.repeat(Math.max(0, 5 - Math.min(5, review.rating ?? 0)))}</Text>
                  <Text style={styles.reviewTime}>{timeAgo(review.created_at)}</Text>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            ))
          )}

          {/* Review Form */}
          {userId && userReview === null && (
            <View style={styles.reviewForm}>
              <Text style={styles.formLabel}>Leave a Review</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map(star => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Text style={[styles.starIcon, star <= reviewRating && styles.starIconFilled]}>
                      {star <= reviewRating ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Comment (optional)"
                placeholderTextColor={Colors.textMuted}
                value={reviewComment}
                onChangeText={t => setReviewComment(t.slice(0, 500))}
                maxLength={500}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.submitBtn, reviewSubmitting && styles.submitBtnDisabled]}
                onPress={submitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.submitBtnText}>Submit Review</Text>}
              </TouchableOpacity>
            </View>
          )}
          {userId && userReview !== null && userReview !== undefined && (
            <Text style={styles.alreadyReviewed}>You've already reviewed this truck.</Text>
          )}

          {/* ── Photos Section ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Photos</Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={pickAndUploadPhoto}
              disabled={photoUploading}
              accessibilityLabel="Upload a photo of this truck"
              accessibilityRole="button"
            >
              {photoUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.uploadButtonText}>+ Add Photo</Text>
              )}
            </TouchableOpacity>
          </View>

          {photos.length === 0 ? (
            <Text style={styles.emptyPhotos}>No photos yet — be the first to share!</Text>
          ) : (
            <View style={styles.photoGrid}>
              {photos.map((photo) => (
                <TouchableOpacity
                  key={photo.id}
                  style={styles.photoItem}
                  onPress={() => setLightboxUrl(photo.photo_url)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: photo.photo_url }} style={styles.photoThumb} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky "View Order" button ── */}
      {isLive && cartItemCount > 0 && (
        <View style={[styles.viewOrderBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={styles.viewOrderButton}
            onPress={() => setOrderModalVisible(true)}
          >
            <Text style={styles.viewOrderText}>
              View Order ({cartItemCount} item{cartItemCount !== 1 ? 's' : ''}) · ${cartTotalAmt.toFixed(2)}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Order Modal ── */}
      <Modal
        visible={orderModalVisible}
        animationType="slide"
        onRequestClose={() => setOrderModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Your Order</Text>
            <TouchableOpacity
              onPress={() => setOrderModalVisible(false)}
              accessibilityLabel="Close order"
              accessibilityRole="button"
            >
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {cartItems.map(item => (
              <View key={item.id} style={styles.orderLine}>
                <Text style={styles.orderLineName}>{cart[item.id]}× {item.name}</Text>
                <Text style={styles.orderLinePrice}>${((cart[item.id] ?? 0) * item.price).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.orderTotalRow}>
              <Text style={styles.orderTotalLabel}>Total</Text>
              <Text style={styles.orderTotalValue}>${cartTotalAmt.toFixed(2)}</Text>
            </View>

            <Text style={styles.formLabel}>Pickup Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={Colors.textMuted}
              value={pickupName}
              onChangeText={t => setPickupName(t.slice(0, 100))}
              maxLength={100}
            />
            <Text style={styles.formLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Allergies, special requests…"
              placeholderTextColor={Colors.textMuted}
              value={orderNotes}
              onChangeText={t => setOrderNotes(t.slice(0, 500))}
              maxLength={500}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.placeOrderBtn, orderSubmitting && styles.submitBtnDisabled]}
              onPress={placeOrder}
              disabled={orderSubmitting}
            >
              {orderSubmitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.placeOrderBtnText}>Place Order</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lightbox Modal */}
      <Modal
        visible={!!lightboxUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxUrl(null)}
      >
        <TouchableOpacity
          style={styles.lightboxBackdrop}
          activeOpacity={1}
          onPress={() => setLightboxUrl(null)}
        >
          {lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxUrl(null)}
            accessibilityLabel="Close photo viewer"
            accessibilityRole="button"
          >
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 120 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.textSecondary, fontSize: 16 },
  hero: { width: '100%', height: 220 },
  heroPlaceholder: { backgroundColor: Colors.border },
  body: { padding: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: '800', color: Colors.text, flex: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.success + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  liveText: { fontSize: 12, fontWeight: '600', color: Colors.success },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  cuisine: { fontSize: 16, color: Colors.textSecondary },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingStar: { fontSize: 14, color: '#F5A623' },
  ratingValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  ratingCount: { fontSize: 13, color: Colors.textSecondary },
  description: { fontSize: 15, color: Colors.text, lineHeight: 22, marginBottom: 16 },
  locationBox: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginBottom: 16 },
  locationLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  locationAddress: { fontSize: 15, color: Colors.text, fontWeight: '500' },

  // Schedule
  scheduleBox: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginBottom: 16 },
  scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  scheduleDay: { fontSize: 13, fontWeight: '700', color: Colors.text, width: 36 },
  scheduleTime: { fontSize: 13, color: Colors.text, flex: 1, textAlign: 'right' },
  scheduleClosed: { fontSize: 13, color: Colors.textMuted, flex: 1, textAlign: 'right' },
  scheduleEmpty: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 6 },

  followButton: {
    borderWidth: 2, borderColor: Colors.primary,
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginBottom: 12,
  },
  followButtonActive: { backgroundColor: Colors.primary },
  followButtonText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  followButtonTextActive: { color: '#fff' },

  cateringButton: {
    borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', marginBottom: 24,
    backgroundColor: Colors.card,
    borderWidth: 1, borderColor: Colors.border,
  },
  cateringButtonText: { fontSize: 16, fontWeight: '600', color: Colors.text },

  // Menu
  menuHeading: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  notLiveNote: { fontSize: 13, color: Colors.textSecondary, marginBottom: 12 },
  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuItemInfo: { flex: 1, paddingRight: 12 },
  menuItemName: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  menuItemDesc: { fontSize: 13, color: Colors.textSecondary },
  menuItemRight: { alignItems: 'flex-end', gap: 6 },
  menuItemPrice: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  cartControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  cartBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 20 },
  cartBtnDisabled: { color: 'rgba(255,255,255,0.4)' },
  cartQty: { fontSize: 14, fontWeight: '700', color: Colors.text, minWidth: 16, textAlign: 'center' },

  // Sticky order bar
  viewOrderBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border, padding: 12 },
  viewOrderButton: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  viewOrderText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Order Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  modalClose: { fontSize: 20, color: Colors.textSecondary, paddingHorizontal: 4 },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  orderLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  orderLineName: { fontSize: 15, color: Colors.text, flex: 1 },
  orderLinePrice: { fontSize: 15, fontWeight: '700', color: Colors.text },
  orderTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: 20 },
  orderTotalLabel: { fontSize: 16, fontWeight: '700', color: Colors.text },
  orderTotalValue: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  placeOrderBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  placeOrderBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Spotted
  spottedCard: { backgroundColor: Colors.card, borderRadius: 10, padding: 12, marginBottom: 8 },
  spottedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  spottedLocation: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1 },
  spottedTime: { fontSize: 12, color: Colors.textSecondary },
  spottedNote: { fontSize: 13, color: Colors.textSecondary },
  spottedForm: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginTop: 8, marginBottom: 8 },

  // Reviews
  reviewCard: { backgroundColor: Colors.card, borderRadius: 10, padding: 12, marginBottom: 8 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reviewStars: { fontSize: 15, color: '#F5A623' },
  reviewTime: { fontSize: 12, color: Colors.textSecondary },
  reviewComment: { fontSize: 14, color: Colors.text },
  reviewForm: { backgroundColor: Colors.card, borderRadius: 10, padding: 14, marginTop: 8, marginBottom: 8 },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  starIcon: { fontSize: 28, color: Colors.border },
  starIconFilled: { color: '#F5A623' },
  alreadyReviewed: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 12 },

  // Shared form
  formLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: Colors.text, marginBottom: 10,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Section headers
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  sectionHeading: { fontSize: 20, fontWeight: '700', color: Colors.text },

  // Photos
  uploadButton: { backgroundColor: Colors.primary, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14, minWidth: 40, alignItems: 'center' },
  uploadButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  emptyPhotos: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: PHOTO_COL_SIZE, height: PHOTO_COL_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: Colors.border },
  photoThumb: { width: '100%', height: '100%' },

  // Lightbox
  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
  lightboxClose: { position: 'absolute', top: 48, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightboxCloseText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
