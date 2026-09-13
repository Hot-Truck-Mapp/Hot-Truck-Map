import { useEffect, useRef, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { pickImage, removeUpload, uploadImage } from '@/lib/upload';
import { useMyTruck, type MyTruck } from '@/hooks/useMyTruck';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import {
  Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, SectionLabel, T, Toast, ToggleRow,
  s as ui, shadow, useToast,
} from '@/components/ui';

type Pkg = {
  id: string; truck_id: string; name: string; description: string | null; price_per_person: number;
  minimum_guests: number; maximum_guests: number; includes: string[] | null; photo: string | null; is_active: boolean; created_at: string;
};
const PKG_COLS = 'id, truck_id, name, description, price_per_person, minimum_guests, maximum_guests, includes, photo, is_active, created_at';
const EMPTY = { name: '', description: '', price_per_person: '', minimum_guests: '20', maximum_guests: '500', includes: [] as string[], photo: '', is_active: true };

async function fetchPackages(truckId: string): Promise<Pkg[]> {
  const { data, error } = await supabase.from('catering_packages').select(PKG_COLS).eq('truck_id', truckId)
    .order('created_at', { ascending: true }).limit(50);
  if (error) throw error;
  return (data ?? []) as Pkg[];
}

/** Mobile twin of /dashboard/catering/packages. */
export default function CateringPackagesScreen() {
  const { session, truck, setTruck, loading, error, reload } = useMyTruck();
  if (loading) return <LoadingState label="Loading packages..." />;
  if (error) return <ErrorState title="Couldn't load your truck" message="Check your connection and try again." onRetry={reload} />;
  if (!truck || !session) return <EmptyState icon="bus-outline" title="No truck on this account" />;
  return <PackagesEditor key={truck.id} truck={truck} setTruck={setTruck} ownerId={session.user.id} />;
}

function PackagesEditor({ truck, setTruck, ownerId }: {
  truck: MyTruck; setTruck: (t: MyTruck) => void; ownerId: string;
}) {
  const mountedRef = useRef(true);
  const pkgQ = useAsyncData(`packages:${truck.id}`, () => fetchPackages(truck.id));
  const packages = pkgQ.data ?? [];
  const setPackages = pkgQ.setData;
  const [info, setInfo] = useState(() => ({
    catering_description: truck.catering_description ?? '',
    catering_starting_price: truck.catering_starting_price ? String(truck.catering_starting_price) : '',
    catering_min_guests: truck.catering_min_guests ? String(truck.catering_min_guests) : '20',
  }));
  const [savingInfo, setSavingInfo] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [includeInput, setIncludeInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const pendingPhotoRef = useRef<string | null>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function saveInfo() {
    if (savingInfo) return;
    if (info.catering_description.length > 1000) { show('Description must be 1000 characters or fewer.'); return; }
    const price = info.catering_starting_price ? parseFloat(info.catering_starting_price) : null;
    const minGuests = info.catering_min_guests ? parseInt(info.catering_min_guests, 10) : null;
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100_000)) { show('Starting price must be between $0 and $100,000.'); return; }
    if (minGuests !== null && (!Number.isFinite(minGuests) || minGuests < 1 || minGuests > 100_000)) { show('Minimum guests must be between 1 and 100,000.'); return; }
    setSavingInfo(true);
    try {
      const update = { catering_description: info.catering_description, catering_starting_price: price, catering_min_guests: minGuests };
      const { error } = await supabase.from('trucks').update(update).eq('id', truck.id).eq('owner_id', ownerId);
      if (error) { show('Save failed: ' + error.message); return; }
      setTruck({ ...truck, ...update });
      show('Catering info saved!', false);
    } catch {
      show('Network error — please try again.');
    } finally {
      if (mountedRef.current) setSavingInfo(false);
    }
  }

  function openAdd() {
    pendingPhotoRef.current = null;
    setForm(EMPTY);
    setIncludeInput('');
    setEditing(null);
    setModal(true);
  }

  function openEdit(p: Pkg) {
    pendingPhotoRef.current = null;
    setForm({
      name: p.name, description: p.description ?? '', price_per_person: String(p.price_per_person),
      minimum_guests: String(p.minimum_guests), maximum_guests: String(p.maximum_guests),
      includes: p.includes ?? [], photo: p.photo ?? '', is_active: p.is_active,
    });
    setIncludeInput('');
    setEditing(p);
    setModal(true);
  }

  function closeModal() {
    const orphan = pendingPhotoRef.current;
    pendingPhotoRef.current = null;
    if (orphan) removeUpload('menu-photos', orphan);
    setModal(false);
  }

  async function choosePhoto() {
    if (uploading) return;
    const asset = await pickImage([4, 3]);
    if (!asset) return;
    setUploading(true);
    try {
      const { path, publicUrl } = await uploadImage('menu-photos', `catering/${truck.id}`, asset);
      const previous = pendingPhotoRef.current;
      if (previous && previous !== path) removeUpload('menu-photos', previous);
      pendingPhotoRef.current = path;
      if (mountedRef.current) setForm((f) => ({ ...f, photo: publicUrl }));
    } catch (err) {
      show(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  function addInclude() {
    const v = includeInput.trim();
    if (!v) return;
    if (v.length > 100) { show('Item must be 100 characters or fewer.'); return; }
    if (form.includes.length >= 20) { show('Maximum 20 included items allowed.'); return; }
    setForm((f) => ({ ...f, includes: [...f.includes, v] }));
    setIncludeInput('');
  }

  async function savePackage() {
    if (saving || !form.name.trim() || !form.price_per_person) return;
    if (form.name.trim().length > 100) { show('Package name must be 100 characters or fewer.'); return; }
    if (form.description.length > 1000) { show('Description must be 1000 characters or fewer.'); return; }
    const price = parseFloat(form.price_per_person);
    if (!Number.isFinite(price) || price <= 0 || price > 100_000) { show('Price per person must be between $0.01 and $100,000.'); return; }
    const minG = parseInt(form.minimum_guests, 10);
    const maxG = parseInt(form.maximum_guests, 10);
    if (Number.isFinite(minG) && Number.isFinite(maxG) && maxG > 0 && maxG < minG) { show('Maximum guests must be greater than or equal to minimum guests.'); return; }
    setSaving(true);
    try {
      const payload = {
        truck_id: truck.id, name: form.name.trim(), description: form.description, price_per_person: price,
        minimum_guests: Number.isFinite(minG) ? minG : 1, maximum_guests: Number.isFinite(maxG) ? maxG : 500,
        includes: form.includes, photo: form.photo, is_active: form.is_active,
      };
      const { error } = editing
        ? await supabase.from('catering_packages').update(payload).eq('id', editing.id).eq('truck_id', truck.id)
        : await supabase.from('catering_packages').insert(payload);
      if (error) { show('Save failed: ' + error.message); return; }
      pendingPhotoRef.current = null;
      if (!mountedRef.current) return;
      setModal(false);
      setEditing(null);
      void pkgQ.reload();
    } catch {
      show('Network error — please try again.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  function confirmDelete(p: Pkg) {
    Alert.alert('Delete package?', `Remove "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const { error } = await supabase.from('catering_packages').delete().eq('id', p.id).eq('truck_id', truck.id);
            if (error) show('Delete failed: ' + error.message);
            else if (mountedRef.current) setPackages((list = []) => list.filter((x) => x.id !== p.id));
          } catch {
            show('Network error — please try again.');
          }
        },
      },
    ]);
  }

  async function toggleActive(p: Pkg) {
    const snapshot = packages;
    setPackages((list = []) => list.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
    try {
      const { error } = await supabase.from('catering_packages').update({ is_active: !p.is_active }).eq('id', p.id).eq('truck_id', truck.id);
      if (error) throw error;
    } catch {
      setPackages(snapshot);
      show('Failed to update package — please try again.');
    }
  }

  if (pkgQ.loading) return <LoadingState label="Loading packages..." />;

  return (
    <View style={ui.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>CATERING PACKAGES</Text>
          <Text style={styles.sub}>{packages.length} package{packages.length !== 1 ? 's' : ''}</Text>
        </View>
        <Button title="+ Add" onPress={openAdd} small style={{ borderRadius: 999 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <SectionLabel>Catering Info</SectionLabel>
          <Card style={{ marginBottom: 24 }}>
            <Field label="Description">
              <Input value={info.catering_description} onChangeText={(t) => setInfo((i) => ({ ...i, catering_description: t }))} placeholder="Describe your catering service..." maxLength={1000} multiline />
            </Field>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Starting Price / person">
                  <Input value={info.catering_starting_price} onChangeText={(t) => setInfo((i) => ({ ...i, catering_starting_price: t.replace(/[^0-9.]/g, '') }))} placeholder="0.00" keyboardType="decimal-pad" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Minimum Guests">
                  <Input value={info.catering_min_guests} onChangeText={(t) => setInfo((i) => ({ ...i, catering_min_guests: t.replace(/[^0-9]/g, '') }))} placeholder="20" keyboardType="number-pad" />
                </Field>
              </View>
            </View>
            <Button title={savingInfo ? 'Saving...' : 'Save Catering Info'} onPress={saveInfo} loading={savingInfo} />
          </Card>

          <SectionLabel>Your Packages</SectionLabel>
          {packages.length === 0 ? (
            <Card>
              <EmptyState
                icon="cube-outline"
                title="No packages yet"
                message="Create packages so customers can pick exactly what they want"
                action={<Button title="Create First Package" onPress={openAdd} small style={{ borderRadius: 999 }} />}
              />
            </Card>
          ) : packages.map((p) => (
            <View key={p.id} style={[styles.pkg, !p.is_active && { opacity: 0.6 }]}>
              {p.photo ? <Image source={{ uri: p.photo }} style={styles.pkgPhoto} /> : null}
              <View style={{ padding: 16 }}>
                <View style={styles.pkgTop}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={styles.pkgName}>{p.name.toUpperCase()}</Text>
                    {!p.is_active && <Text style={styles.inactive}>INACTIVE</Text>}
                  </View>
                  <Text style={styles.pkgPrice}>${p.price_per_person}<Text style={styles.pp}>/pp</Text></Text>
                </View>
                {p.description ? <Text style={styles.pkgDesc} numberOfLines={2}>{p.description}</Text> : null}
                <Text style={styles.guests}>{p.minimum_guests}–{p.maximum_guests} guests</Text>
                {(p.includes?.length ?? 0) > 0 && (
                  <View style={styles.includes}>
                    {p.includes!.map((it) => <Text key={it} style={styles.include}>{it}</Text>)}
                  </View>
                )}
                <View style={styles.pkgActions}>
                  <TouchableOpacity onPress={() => toggleActive(p)} style={[styles.activeBtn, { backgroundColor: p.is_active ? T.green50 : T.n100 }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: p.is_active ? T.green600 : T.n500 }}>{p.is_active ? 'Active' : 'Inactive'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openEdit(p)}><Text style={styles.link}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(p)}><Text style={[styles.link, { color: T.red400 }]}>Delete</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{editing ? 'EDIT PACKAGE' : 'NEW PACKAGE'}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.close} accessibilityLabel="Close package editor">
                <Ionicons name="close" size={16} color={T.n500} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity onPress={choosePhoto} style={styles.photoPick} activeOpacity={0.85}>
                {form.photo ? <Image source={{ uri: form.photo }} style={StyleSheet.absoluteFill} /> : (
                  <Text style={{ color: T.n400 }}>{uploading ? 'Uploading...' : 'Tap to add photo'}</Text>
                )}
              </TouchableOpacity>
              <Field label="Package Name *">
                <Input value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="e.g. Classic Taco Package" maxLength={100} />
              </Field>
              <Field label="Description">
                <Input value={form.description} onChangeText={(t) => setForm((f) => ({ ...f, description: t }))} placeholder="What's included in this package..." maxLength={1000} multiline />
              </Field>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field label="$ / Person *">
                    <Input value={form.price_per_person} onChangeText={(t) => setForm((f) => ({ ...f, price_per_person: t.replace(/[^0-9.]/g, '') }))} placeholder="0.00" keyboardType="decimal-pad" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Min Guests">
                    <Input value={form.minimum_guests} onChangeText={(t) => setForm((f) => ({ ...f, minimum_guests: t.replace(/[^0-9]/g, '') }))} placeholder="20" keyboardType="number-pad" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Max Guests">
                    <Input value={form.maximum_guests} onChangeText={(t) => setForm((f) => ({ ...f, maximum_guests: t.replace(/[^0-9]/g, '') }))} placeholder="500" keyboardType="number-pad" />
                  </Field>
                </View>
              </View>
              <Field label="What's Included">
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Input value={includeInput} onChangeText={setIncludeInput} placeholder="e.g. Tacos, Drinks, Setup..." maxLength={100} style={{ flex: 1 }} onSubmitEditing={addInclude} returnKeyType="done" />
                  <Button title="Add" onPress={addInclude} small />
                </View>
                {form.includes.length > 0 && (
                  <View style={[styles.includes, { marginTop: 10 }]}>
                    {form.includes.map((it, i) => (
                      <TouchableOpacity key={`${it}-${i}`} onPress={() => setForm((f) => ({ ...f, includes: f.includes.filter((_, j) => j !== i) }))} accessibilityLabel={`Remove ${it}`}>
                        <Text style={[styles.include, { paddingRight: 10 }]}>{it}  ✕</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Field>
              <View style={styles.toggleBox}>
                <ToggleRow label="Active" description="Customers can see and select this package" value={form.is_active} onValueChange={(v) => setForm((f) => ({ ...f, is_active: v }))} last />
              </View>
              <Button
                title={saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Package'}
                onPress={savePackage}
                loading={saving}
                disabled={!form.name.trim() || !form.price_per_person || uploading}
                style={{ borderRadius: 16, paddingVertical: 16 }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
          <Toast toast={toast} />
        </SafeAreaView>
      </Modal>
      <Toast toast={modal ? null : toast} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.n200,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  title: { fontSize: 18, fontWeight: '900', color: T.n900, letterSpacing: 0.5 },
  sub: { fontSize: 13, color: T.n400, marginTop: 2 },
  pkg: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', marginBottom: 12, ...shadow },
  pkgPhoto: { width: '100%', height: 140, backgroundColor: T.n100 },
  pkgTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pkgName: { fontSize: 14, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  inactive: { fontSize: 9, fontWeight: '900', color: T.n500, backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  pkgPrice: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  pp: { fontSize: 11, color: T.n400, fontWeight: '600' },
  pkgDesc: { fontSize: 12, color: T.n400, marginTop: 4 },
  guests: { fontSize: 12, color: T.n500, marginTop: 6, fontWeight: '600' },
  includes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  include: { fontSize: 11, fontWeight: '700', color: T.n500, backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  pkgActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  activeBtn: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  link: { fontSize: 12, fontWeight: '600', color: T.n400 },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.n100,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: T.n900, letterSpacing: 0.5 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center' },
  photoPick: {
    height: 144, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: T.n200, backgroundColor: T.n100,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 20,
  },
  toggleBox: { borderWidth: 1, borderColor: T.n200, borderRadius: 16, paddingHorizontal: 14, marginBottom: 20 },
});
