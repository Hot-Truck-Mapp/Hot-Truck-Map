import { useEffect, useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { pickImage, removeUpload, uploadImage } from '@/lib/upload';
import { useMyTruck, type MyTruck } from '@/hooks/useMyTruck';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import { CUISINE_TYPES } from '@shared/cuisines';
import {
  Button, EmptyState, ErrorState, Field, Input, LoadingState, Pill, T, Toast, s as ui, useToast,
} from '@/components/ui';

const DIETARY = ['Vegan', 'Vegetarian', 'Gluten-Free', 'Halal', 'Kosher'];

async function fetchMenuCount(truckId: string): Promise<number> {
  const { count, error } = await supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('truck_id', truckId);
  if (error) throw error;
  return count ?? 0;
}

/** Mobile twin of the web dashboard's Profile tab. */
export default function TruckProfileScreen() {
  const { session, truck, setTruck, loading, error, reload } = useMyTruck();
  if (loading) return <LoadingState />;
  if (error) return <ErrorState title="Couldn't load your truck" message="Check your connection and try again." onRetry={reload} />;
  if (!truck || !session) return <EmptyState icon="bus-outline" title="No truck on this account" />;
  // Keyed so the form starts fresh from the saved truck if the account changes.
  return <ProfileForm key={truck.id} truck={truck} setTruck={setTruck} ownerId={session.user.id} />;
}

function ProfileForm({ truck, setTruck, ownerId }: {
  truck: MyTruck; setTruck: (t: MyTruck) => void; ownerId: string;
}) {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [form, setForm] = useState(() => ({
    name: truck.name ?? '', description: truck.description ?? '', cuisine: truck.cuisine ?? '',
    phone: truck.phone ?? '', instagram: truck.instagram ?? '', profile_photo: truck.profile_photo ?? '',
    dietary_tags: truck.dietary_tags ?? [],
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const menuCount = useAsyncData(`menu-count:${truck.id}`, () => fetchMenuCount(truck.id)).data ?? null;
  const { toast, show } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function choosePhoto() {
    if (uploading) return;
    const asset = await pickImage([1, 1]);
    if (!asset) return;
    setUploading(true);
    try {
      const { path, publicUrl } = await uploadImage('avatars', `trucks/${truck.id}`, asset);
      const { error: saveErr } = await supabase.from('trucks').update({ profile_photo: publicUrl }).eq('id', truck.id);
      if (saveErr) {
        removeUpload('avatars', path);
        throw new Error('Photo uploaded but failed to save: ' + saveErr.message);
      }
      if (!mountedRef.current) return;
      setForm((f) => ({ ...f, profile_photo: publicUrl }));
      setTruck({ ...truck, profile_photo: publicUrl });
    } catch (err) {
      show(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  async function save() {
    if (saving || !form.name.trim()) return;
    if (form.name.trim().length > 100) { show('Truck name must be 100 characters or fewer.'); return; }
    setSaving(true);
    try {
      // Same sanitising as the web's saveProfile().
      const update = {
        name: form.name.trim(),
        description: form.description.slice(0, 1000),
        cuisine: form.cuisine,
        phone: form.phone.replace(/[^\d\s().+\-x]/g, '').slice(0, 20),
        instagram: form.instagram.replace(/[^\w.]/g, '').slice(0, 30),
        profile_photo: form.profile_photo,
        dietary_tags: form.dietary_tags,
      };
      const { error: err } = await supabase.from('trucks').update(update).eq('id', truck.id).eq('owner_id', ownerId);
      if (err) throw new Error(err.message);
      if (!mountedRef.current) return;
      setTruck({ ...truck, ...update });
      setSaved(true);
      setTimeout(() => { if (mountedRef.current) setSaved(false); }, 3000);
    } catch (err) {
      show('Save failed: ' + (err instanceof Error ? err.message : 'Please try again.'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.photoWrap}>
          <TouchableOpacity onPress={choosePhoto} style={styles.photo} activeOpacity={0.85} accessibilityLabel="Change truck photo">
            {form.profile_photo ? (
              <Image source={{ uri: form.profile_photo }} style={StyleSheet.absoluteFill} />
            ) : (
              <Ionicons name="bus-outline" size={38} color="#AAAAAA" />
            )}
          </TouchableOpacity>
          <Text style={styles.photoHint}>{uploading ? 'Uploading...' : 'Tap to add photo'}</Text>
        </View>

        <Field label="Truck Name *">
          <Input value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="e.g. The Taco Truck" maxLength={100} />
        </Field>

        <Field label="Cuisine Type">
          <View style={styles.wrap}>
            {CUISINE_TYPES.map((c) => (
              <Pill key={c} label={c} active={form.cuisine === c} onPress={() => setForm((f) => ({ ...f, cuisine: f.cuisine === c ? '' : c }))} />
            ))}
          </View>
        </Field>

        <Field label="Dietary Options" hint="Shown on the truck list so customers with dietary needs can find you">
          <View style={styles.wrap}>
            {DIETARY.map((tag) => (
              <Pill
                key={tag}
                label={tag}
                active={form.dietary_tags.includes(tag)}
                activeColor={T.green600}
                onPress={() => setForm((f) => ({
                  ...f,
                  dietary_tags: f.dietary_tags.includes(tag) ? f.dietary_tags.filter((t) => t !== tag) : [...f.dietary_tags, tag],
                }))}
              />
            ))}
          </View>
        </Field>

        <Field label="Description">
          <Input
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t.slice(0, 200) }))}
            placeholder="Tell customers what makes your truck special..."
            maxLength={200}
            multiline
          />
          <Text style={[styles.counter, form.description.length >= 190 && { color: Colors.primary }]}>{form.description.length}/200</Text>
        </Field>

        <Field
          label="Phone Number"
          right={<Text style={styles.smsBadge}>SMS order alerts</Text>}
          hint="You'll get a text message every time a customer places an order"
        >
          <Input value={form.phone} onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))} placeholder="(201) 555-0123" keyboardType="phone-pad" maxLength={20} />
        </Field>

        <Field label="Instagram">
          <View style={styles.igBox}>
            <View style={styles.igPrefix}>
              <Ionicons name="logo-instagram" size={16} color="#DC2743" />
              <Text style={styles.igAt}>@</Text>
            </View>
            <Input
              value={form.instagram}
              onChangeText={(t) => setForm((f) => ({ ...f, instagram: t.replace('@', '').slice(0, 30) }))}
              placeholder="yourtruck"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={30}
              style={styles.igInput}
            />
          </View>
          {form.instagram ? (
            <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${form.instagram}`)}>
              <Text style={styles.igLink}>instagram.com/{form.instagram}  ↗</Text>
            </TouchableOpacity>
          ) : null}
        </Field>

        <Button
          title={saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Profile'}
          onPress={save}
          loading={saving}
          disabled={!form.name.trim()}
          style={{ borderRadius: 16, paddingVertical: 16 }}
        />

        {saved && (
          <View style={styles.savedBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={20} color={T.green500} />
              <Text style={styles.savedTitle}>Profile saved!</Text>
            </View>
            {menuCount === 0 && (
              <View style={styles.savedNext}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedNextTitle}>Add your menu items</Text>
                  <Text style={styles.savedNextBody}>Let customers browse and order before they arrive</Text>
                </View>
                <Button title="Add Menu →" onPress={() => router.push('/dashboard/menu')} small />
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <Toast toast={toast} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 56 },
  photoWrap: { alignItems: 'center', paddingVertical: 8, marginBottom: 12 },
  photo: {
    width: 112, height: 112, borderRadius: 56, backgroundColor: T.n200, overflow: 'hidden', alignItems: 'center',
    justifyContent: 'center', borderWidth: 4, borderColor: '#fff', marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  photoHint: { fontSize: 14, color: T.n400 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  counter: { fontSize: 12, color: T.n400, marginTop: 4 },
  smsBadge: { fontSize: 11, fontWeight: '700', color: T.green600, backgroundColor: T.green50, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  igBox: { flexDirection: 'row', borderWidth: 1, borderColor: T.n200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
  igPrefix: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, backgroundColor: T.n50, borderRightWidth: 1, borderRightColor: T.n200 },
  igAt: { fontSize: 14, fontWeight: '700', color: T.n500 },
  igInput: { flex: 1, borderWidth: 0, borderRadius: 0 },
  igLink: { fontSize: 12, fontWeight: '600', color: Colors.primary, marginTop: 6 },
  savedBox: { marginTop: 16, backgroundColor: T.green50, borderWidth: 1, borderColor: '#BBF7D0', borderRadius: 16, padding: 16, gap: 12 },
  savedTitle: { fontSize: 14, fontWeight: '800', color: '#166534' },
  savedNext: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  savedNextTitle: { fontSize: 14, fontWeight: '700', color: T.n800 },
  savedNextBody: { fontSize: 12, color: T.n400, marginTop: 2 },
});
