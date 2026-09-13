import { useEffect, useRef, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { pickImage, removeUpload, uploadImage } from '@/lib/upload';
import { useMyTruck } from '@/hooks/useMyTruck';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import {
  Button, Card, EmptyState, ErrorState, Field, Input, LoadingState, Pill, SectionLabel, T, Toast, ToggleRow,
  s as ui, shadow, useToast,
} from '@/components/ui';

const ALLERGENS = ['Gluten', 'Dairy', 'Nuts', 'Eggs', 'Soy', 'Shellfish', 'Fish'];
const MENU_COLS =
  'id, truck_id, name, description, price, category, allergens, is_popular, is_sold_out, photo, sort_order, created_at';

type MenuItem = {
  id: string; truck_id: string; name: string; description: string | null; price: number; category: string | null;
  allergens: string[] | null; is_popular: boolean | null; is_sold_out: boolean | null; photo: string | null;
  sort_order: number | null; created_at: string;
};
const EMPTY = { name: '', description: '', price: '', category: '', allergens: [] as string[], is_popular: false, is_sold_out: false, photo: '' };

/** Menu items in the operator's chosen order — same ordering as the web. */
async function fetchMenu(truckId: string): Promise<MenuItem[]> {
  const { data, error } = await supabase.from('menu_items').select(MENU_COLS).eq('truck_id', truckId)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as MenuItem[];
}

/** Mobile twin of the web dashboard's Menu tab. */
export default function MenuManagerScreen() {
  const { truck, loading: truckLoading, error: truckError, reload } = useMyTruck();
  const truckId = truck?.id ?? null;
  const mountedRef = useRef(true);
  const menuQ = useAsyncData(truckId ? `menu:${truckId}` : null, () => fetchMenu(truckId!));
  const items = menuQ.data ?? [];
  const setItems = menuQ.setData;
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  // A photo uploaded for an item that hasn't been saved yet — cleaned up if
  // the editor is dismissed, same as the web modal.
  const pendingPhotoRef = useRef<string | null>(null);
  const { toast, show } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function openAdd() {
    pendingPhotoRef.current = null;
    setForm(EMPTY);
    setEditing(null);
    setModal(true);
  }

  function openEdit(item: MenuItem) {
    pendingPhotoRef.current = null;
    setForm({
      name: item.name, description: item.description ?? '', price: String(item.price), category: item.category ?? '',
      allergens: item.allergens ?? [], is_popular: !!item.is_popular, is_sold_out: !!item.is_sold_out, photo: item.photo ?? '',
    });
    setEditing(item);
    setModal(true);
  }

  function closeModal() {
    const orphan = pendingPhotoRef.current;
    pendingPhotoRef.current = null;
    if (orphan) removeUpload('menu-photos', orphan);
    setModal(false);
  }

  async function choosePhoto() {
    if (!truck || uploading) return;
    const asset = await pickImage([4, 3]);
    if (!asset) return;
    setUploading(true);
    try {
      const { path, publicUrl } = await uploadImage('menu-photos', `menu/${truck.id}`, asset);
      setForm((f) => ({ ...f, photo: publicUrl }));
      if (editing) {
        const { error } = await supabase.from('menu_items').update({ photo: publicUrl }).eq('id', editing.id).eq('truck_id', truck.id);
        if (error) {
          removeUpload('menu-photos', path);
          throw new Error('Photo uploaded but failed to save: ' + error.message);
        }
        setItems((list = []) => list.map((i) => (i.id === editing.id ? { ...i, photo: publicUrl } : i)));
      } else {
        const previous = pendingPhotoRef.current;
        if (previous && previous !== path) removeUpload('menu-photos', previous);
        pendingPhotoRef.current = path;
      }
    } catch (err) {
      show(err instanceof Error ? err.message : 'Photo upload failed');
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  async function save() {
    if (!truck || saving || !form.name.trim() || !form.price) return;
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0 || price > 10_000) {
      show('Please enter a valid price between $0.01 and $10,000.00');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        truck_id: truck.id, name: form.name.trim(), description: form.description, price,
        category: form.category.trim() || 'Other', allergens: form.allergens,
        is_popular: form.is_popular, is_sold_out: form.is_sold_out, photo: form.photo,
      };
      if (editing) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', editing.id).eq('truck_id', truck.id);
        if (error) throw new Error(error.message);
      } else {
        const highest = items.reduce((max, i) => (typeof i.sort_order === 'number' && i.sort_order > max ? i.sort_order : max), -1);
        const { error } = await supabase.from('menu_items').insert({ ...payload, sort_order: highest + 1 });
        if (error) throw new Error(error.message);
      }
      const fresh = await fetchMenu(truck.id);
      if (!mountedRef.current) return;
      setItems(fresh);
      pendingPhotoRef.current = null;
      show(editing ? 'Item updated!' : 'Item added!', false);
      setModal(false);
    } catch (err) {
      show('Save failed: ' + (err instanceof Error ? err.message : 'Please try again.'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  function confirmDelete(item: MenuItem) {
    Alert.alert('Delete item?', `Remove "${item.name}" from your menu?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!truck) return;
          try {
            const { error } = await supabase.from('menu_items').delete().eq('id', item.id).eq('truck_id', truck.id);
            if (error) show('Delete failed: ' + error.message);
            else if (mountedRef.current) setItems((list = []) => list.filter((i) => i.id !== item.id));
          } catch {
            show('Delete failed — check your connection and try again');
          }
        },
      },
    ]);
  }

  async function toggleSoldOut(item: MenuItem) {
    if (!truck) return;
    const next = !item.is_sold_out;
    setItems((list = []) => list.map((i) => (i.id === item.id ? { ...i, is_sold_out: next } : i)));
    try {
      const { error } = await supabase.from('menu_items').update({ is_sold_out: next }).eq('id', item.id).eq('truck_id', truck.id);
      if (error) throw new Error(error.message);
    } catch {
      setItems((list = []) => list.map((i) => (i.id === item.id ? { ...i, is_sold_out: item.is_sold_out } : i)));
      show('Could not update item — check your connection');
    }
  }

  /** Swap with the nearest neighbour in the same category — see the web's moveMenuItem. */
  async function move(item: MenuItem, direction: -1 | 1) {
    if (!truck || reorderingId) return;
    const ordered = [...items];
    const from = ordered.findIndex((i) => i.id === item.id);
    if (from === -1) return;
    const category = item.category || 'Other';
    let to = -1;
    for (let i = from + direction; i >= 0 && i < ordered.length; i += direction) {
      if ((ordered[i].category || 'Other') === category) { to = i; break; }
    }
    if (to === -1) return;
    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];
    const changed = ordered.map((it, index) => ({ it, index })).filter(({ it, index }) => it.sort_order !== index);
    if (changed.length === 0) return;
    const previous = items;
    setReorderingId(item.id);
    setItems(ordered.map((it, index) => ({ ...it, sort_order: index })));
    try {
      const results = await Promise.all(changed.map(({ it, index }) =>
        supabase.from('menu_items').update({ sort_order: index }).eq('id', it.id).eq('truck_id', truck.id)));
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    } catch (err) {
      setItems(previous);
      show('Could not reorder: ' + (err instanceof Error ? err.message : 'please try again.'));
    } finally {
      if (mountedRef.current) setReorderingId(null);
    }
  }

  if (truckLoading) return <LoadingState label="Loading your menu..." />;
  if (truckError) return <ErrorState title="Couldn't load your truck" message="Check your connection and try again." onRetry={reload} />;
  if (!truck) return <EmptyState icon="bus-outline" title="No truck on this account" />;
  if (menuQ.loading) return <LoadingState label="Loading your menu..." />;
  if (menuQ.error && items.length === 0) return <ErrorState title="Could not load your menu" message="Check your connection and try again." onRetry={menuQ.reload} />;

  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const cat = item.category || 'Other';
    (acc[cat] ??= []).push(item);
    return acc;
  }, {});

  return (
    <View style={ui.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MENU MANAGER</Text>
          <Text style={styles.headerSub}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
        </View>
        <Button title="+ Add Item" onPress={openAdd} small style={{ borderRadius: 999 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await menuQ.reload(); setRefreshing(false); }} tintColor={Colors.primary} />}
      >
        {items.length === 0 ? (
          <Card>
            <EmptyState
              title="No menu items yet"
              message="Add your first item to get started"
              action={<Button title="Add First Item" onPress={openAdd} small style={{ borderRadius: 999 }} />}
            />
          </Card>
        ) : (
          Object.entries(grouped).map(([cat, list]) => (
            <View key={cat} style={{ marginBottom: 24 }}>
              <View style={styles.catRow}>
                <Text style={styles.catTitle}>{cat.toUpperCase()}</Text>
                <View style={styles.catLine} />
                <Text style={styles.catCount}>{list.length}</Text>
              </View>
              <View style={styles.catCard}>
                {list.map((item, idx) => (
                  <View key={item.id} style={[styles.item, idx < list.length - 1 && ui.rowDivider, item.is_sold_out && { opacity: 0.5 }]}>
                    {item.photo ? (
                      <Image source={{ uri: item.photo }} style={styles.itemPhoto} />
                    ) : (
                      <View style={[styles.itemPhoto, styles.itemPhotoEmpty]}><Ionicons name="image-outline" size={24} color="#BBBBBB" /></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <View style={styles.itemTop}>
                        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.itemName, item.is_sold_out && styles.strike]}>{item.name.toUpperCase()}</Text>
                          {item.is_popular && <Text style={styles.popular}>POPULAR</Text>}
                        </View>
                        <Text style={styles.price}>${(Number(item.price) || 0).toFixed(2)}</Text>
                      </View>
                      {item.description ? <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text> : null}
                      {(item.allergens?.length ?? 0) > 0 && (
                        <View style={styles.allergenRow}>
                          {item.allergens!.map((a) => <Text key={a} style={styles.allergen}>{a}</Text>)}
                        </View>
                      )}
                      <View style={styles.actions}>
                        {list.length > 1 && (
                          <View style={{ flexDirection: 'row' }}>
                            <TouchableOpacity onPress={() => move(item, -1)} disabled={idx === 0 || !!reorderingId} style={[styles.arrow, (idx === 0) && { opacity: 0.25 }]} accessibilityLabel={`Move ${item.name} up`}>
                              <Ionicons name="chevron-up" size={14} color={T.n500} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => move(item, 1)} disabled={idx === list.length - 1 || !!reorderingId} style={[styles.arrow, (idx === list.length - 1) && { opacity: 0.25 }]} accessibilityLabel={`Move ${item.name} down`}>
                              <Ionicons name="chevron-down" size={14} color={T.n500} />
                            </TouchableOpacity>
                          </View>
                        )}
                        <TouchableOpacity onPress={() => toggleSoldOut(item)} style={[styles.soldOutBtn, item.is_sold_out ? { backgroundColor: T.n100 } : { backgroundColor: T.red50 }]}>
                          <Text style={[styles.soldOutText, { color: item.is_sold_out ? T.n500 : Colors.primary }]}>{item.is_sold_out ? 'Mark Available' : 'Mark Sold Out'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openEdit(item)}><Text style={styles.linkText}>Edit</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete(item)}><Text style={[styles.linkText, { color: T.red400 }]}>Delete</Text></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Item' : 'New Item'}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.close} accessibilityLabel="Close menu item editor">
                <Ionicons name="close" size={16} color={T.n500} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity onPress={choosePhoto} style={styles.photoPick} activeOpacity={0.85}>
                {form.photo ? <Image source={{ uri: form.photo }} style={StyleSheet.absoluteFill} /> : null}
                {!form.photo && <Text style={{ color: T.n400 }}>{uploading ? 'Uploading...' : 'Tap to add photo'}</Text>}
                {form.photo && uploading ? <Text style={styles.photoOverlay}>Uploading...</Text> : null}
              </TouchableOpacity>

              <Field label="Item Name *">
                <Input value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} placeholder="e.g. Al Pastor Taco" maxLength={100} />
              </Field>
              <Field label="Description">
                <Input value={form.description} onChangeText={(t) => setForm((f) => ({ ...f, description: t }))} placeholder="Marinated pork, pineapple, cilantro..." maxLength={500} multiline />
              </Field>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Price *">
                    <View style={styles.priceBox}>
                      <Text style={styles.dollar}>$</Text>
                      <Input value={form.price} onChangeText={(t) => setForm((f) => ({ ...f, price: t.replace(/[^0-9.]/g, '') }))} placeholder="0.00" keyboardType="decimal-pad" style={styles.priceInput} />
                    </View>
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Category">
                    <Input value={form.category} onChangeText={(t) => setForm((f) => ({ ...f, category: t }))} placeholder="e.g. Tacos, Sides" maxLength={50} />
                  </Field>
                </View>
              </View>

              <SectionLabel>Allergens</SectionLabel>
              <View style={styles.allergenPick}>
                {ALLERGENS.map((a) => (
                  <Pill
                    key={a}
                    label={a}
                    active={form.allergens.includes(a)}
                    activeColor={T.orange600}
                    onPress={() => setForm((f) => ({ ...f, allergens: f.allergens.includes(a) ? f.allergens.filter((x) => x !== a) : [...f.allergens, a] }))}
                  />
                ))}
              </View>

              <View style={styles.toggles}>
                <ToggleRow label="Mark as Popular" description="Shows a Popular badge" value={form.is_popular} onValueChange={(v) => setForm((f) => ({ ...f, is_popular: v }))} />
                <ToggleRow label="Mark as Sold Out" description="Item greyed out on menu" value={form.is_sold_out} onValueChange={(v) => setForm((f) => ({ ...f, is_sold_out: v }))} last />
              </View>

              <Button
                title={saving ? 'Saving...' : editing ? 'Save Changes' : 'Add to Menu'}
                onPress={save}
                disabled={!form.name.trim() || !form.price || uploading}
                loading={saving}
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
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.n100,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: T.n900, letterSpacing: 0.6 },
  headerSub: { fontSize: 12, color: T.n400 },
  scroll: { padding: 16, paddingBottom: 48 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  catTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, color: T.n500 },
  catLine: { flex: 1, height: 1, backgroundColor: T.n200 },
  catCount: { fontSize: 12, color: T.n400 },
  catCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', ...shadow },
  item: { flexDirection: 'row', gap: 12, padding: 14 },
  itemPhoto: { width: 72, height: 72, borderRadius: 12, backgroundColor: T.n100 },
  itemPhotoEmpty: { backgroundColor: T.n200, alignItems: 'center', justifyContent: 'center' },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemName: { fontSize: 13, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  strike: { textDecorationLine: 'line-through', color: T.n400 },
  popular: { fontSize: 9, fontWeight: '800', color: Colors.primary, backgroundColor: T.red100, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden' },
  price: { fontSize: 15, fontWeight: '900', color: Colors.primary },
  itemDesc: { fontSize: 12, color: T.n400, marginTop: 2 },
  allergenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  allergen: { fontSize: 10, fontWeight: '700', color: T.orange600, backgroundColor: T.orange50, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  arrow: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  soldOutBtn: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  soldOutText: { fontSize: 12, fontWeight: '700' },
  linkText: { fontSize: 12, fontWeight: '600', color: T.n400 },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.n100,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: T.n900 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center' },
  photoPick: {
    height: 144, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: T.n200, backgroundColor: T.n100,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 20,
  },
  photoOverlay: { color: '#fff', fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  priceBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: T.n200, borderRadius: 12, overflow: 'hidden' },
  dollar: { paddingHorizontal: 12, fontSize: 16, fontWeight: '900', color: T.n600, backgroundColor: T.n50, alignSelf: 'stretch', textAlignVertical: 'center', paddingTop: Platform.OS === 'ios' ? 13 : 0 },
  priceInput: { flex: 1, borderWidth: 0, borderRadius: 0 },
  allergenPick: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  toggles: { borderWidth: 1, borderColor: T.n200, borderRadius: 16, paddingHorizontal: 14, marginBottom: 20 },
});
