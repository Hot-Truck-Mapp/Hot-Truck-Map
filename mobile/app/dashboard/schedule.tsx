import { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useMyTruck } from '@/hooks/useMyTruck';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import {
  Button, EmptyState, ErrorState, Field, Input, LoadingState, SectionLabel, T, Toast, s as ui, shadow, useToast,
} from '@/components/ui';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Same list as the web dashboard, so a time saved on one side is selectable on the other.
const HOURS = [
  '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
  '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM',
  '12:00 AM', '1:00 AM', '2:00 AM',
];
const SCHED_COLS = 'id, truck_id, day_of_week, open_time, close_time, location, notes';

type Entry = { id: string; truck_id: string; day_of_week: number; open_time: string; close_time: string; location: string; notes: string | null };

async function fetchSchedule(truckId: string): Promise<Entry[]> {
  const { data, error } = await supabase.from('schedules').select(SCHED_COLS).eq('truck_id', truckId).order('day_of_week').limit(50);
  if (error) throw error;
  return (data ?? []) as Entry[];
}

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
      onLayout={() => {
        const idx = HOURS.indexOf(value);
        if (idx > 2) ref.current?.scrollTo({ x: (idx - 2) * 84, animated: false });
      }}
    >
      {HOURS.map((h) => (
        <TouchableOpacity
          key={h}
          onPress={() => onChange(h)}
          style={[styles.timeChip, value === h && styles.timeChipOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === h }}
        >
          <Text style={[styles.timeChipText, value === h && { color: '#fff' }]}>{h}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/** Mobile twin of the web dashboard's Schedule tab. */
export default function ScheduleScreen() {
  const { truck, loading: truckLoading, error: truckError, reload } = useMyTruck();
  const mountedRef = useRef(true);
  const today = new Date().getDay();
  const truckId = truck?.id ?? null;
  const schedQ = useAsyncData(truckId ? `schedule:${truckId}` : null, () => fetchSchedule(truckId!));
  const schedule = schedQ.data ?? [];
  const [day, setDay] = useState(today);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState({ day_of_week: today, location: '', open_time: '10:00 AM', close_time: '3:00 PM', notes: '' });
  const [saving, setSaving] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function openAdd(d: number) {
    setForm({ day_of_week: d, location: '', open_time: '10:00 AM', close_time: '3:00 PM', notes: '' });
    setEditing(null);
    setModal(true);
  }

  function openEdit(e: Entry) {
    setForm({ day_of_week: e.day_of_week, location: e.location, open_time: e.open_time, close_time: e.close_time, notes: e.notes ?? '' });
    setEditing(e);
    setModal(true);
  }

  async function save() {
    if (!truck || saving || !form.location.trim()) return;
    if (HOURS.indexOf(form.close_time) <= HOURS.indexOf(form.open_time)) {
      show('Closing time must be after opening time');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        truck_id: truck.id, ...form,
        location: form.location.trim().slice(0, 200),
        notes: form.notes.trim().slice(0, 500),
      };
      const { error } = editing
        ? await supabase.from('schedules').update(payload).eq('id', editing.id).eq('truck_id', truck.id)
        : await supabase.from('schedules').insert(payload);
      if (error) throw new Error(error.message);
      await schedQ.reload();
      show('Schedule saved!', false);
      if (mountedRef.current) setModal(false);
    } catch (err) {
      show('Save failed: ' + (err instanceof Error ? err.message : 'Please try again.'));
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  function confirmRemove(e: Entry) {
    Alert.alert('Remove this stop?', `${e.location}\n${e.open_time} – ${e.close_time}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          if (!truck) return;
          try {
            const { error } = await supabase.from('schedules').delete().eq('id', e.id).eq('truck_id', truck.id);
            if (error) show('Delete failed: ' + error.message);
            else if (mountedRef.current) schedQ.setData((list = []) => list.filter((x) => x.id !== e.id));
          } catch {
            show('Delete failed — check your connection and try again');
          }
        },
      },
    ]);
  }

  if (truckLoading) return <LoadingState />;
  if (truckError) return <ErrorState title="Couldn't load your truck" message="Check your connection and try again." onRetry={reload} />;
  if (!truck) return <EmptyState icon="bus-outline" title="No truck on this account" />;
  if (schedQ.loading) return <LoadingState />;
  if (schedQ.error && schedule.length === 0) return <ErrorState title="Could not load your schedule" message="Check your connection and try again." onRetry={schedQ.reload} />;

  const dayEntries = schedule.filter((s) => s.day_of_week === day);

  return (
    <View style={ui.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>WEEKLY SCHEDULE</Text>
          <Text style={styles.headerSub}>Set your hours and location for each day</Text>
        </View>
        <Button title="+ Add" onPress={() => openAdd(day)} small style={{ borderRadius: 999 }} />
      </View>

      <View style={styles.dayBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {DAYS.map((d, i) => {
            const selected = day === i;
            const hasEntry = schedule.some((s) => s.day_of_week === i);
            return (
              <TouchableOpacity key={d} onPress={() => setDay(i)} style={[styles.dayPill, selected ? styles.dayPillOn : styles.dayPillOff]}>
                <Text style={[styles.dayText, { color: selected ? '#fff' : T.n600 }]}>{d.toUpperCase()}</Text>
                {i === today ? (
                  <Text style={[styles.todayText, { color: selected ? '#FECACA' : Colors.primary }]}>TODAY</Text>
                ) : hasEntry ? (
                  <View style={[styles.dot, { backgroundColor: selected ? '#FECACA' : Colors.primary }]} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>{FULL_DAYS[day].toUpperCase()}</Text>
          {dayEntries.length > 0 && (
            <TouchableOpacity onPress={() => openAdd(day)}><Text style={styles.addAnother}>+ Add Another Stop</Text></TouchableOpacity>
          )}
        </View>

        {dayEntries.length === 0 ? (
          <EmptyState
            dashed
            icon="calendar-outline"
            title={`No schedule for ${FULL_DAYS[day]}`}
            message="Add your location and hours for this day"
            action={<Button title="Add Schedule" onPress={() => openAdd(day)} small style={{ borderRadius: 999 }} />}
          />
        ) : (
          dayEntries.map((e) => (
            <View key={e.id} style={styles.entry}>
              <View style={styles.pin}><Ionicons name="location-outline" size={18} color={Colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryLoc} numberOfLines={2}>{e.location}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <Ionicons name="time-outline" size={13} color={Colors.primary} />
                  <Text style={styles.entryTime}>{e.open_time} – {e.close_time}</Text>
                </View>
                {e.notes ? <Text style={styles.entryNotes}>{e.notes}</Text> : null}
              </View>
              <View style={{ gap: 10, alignItems: 'flex-end' }}>
                <TouchableOpacity onPress={() => openEdit(e)}><Text style={styles.link}>Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => confirmRemove(e)}><Text style={[styles.link, { color: T.red400 }]}>Remove</Text></TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <SectionLabel style={{ marginTop: 24 }}>Full Week at a Glance</SectionLabel>
        <View style={styles.week}>
          {FULL_DAYS.map((full, i) => {
            const entries = schedule.filter((s) => s.day_of_week === i);
            const isToday = i === today;
            return (
              <TouchableOpacity key={full} onPress={() => setDay(i)} style={[styles.weekRow, i < 6 && ui.rowDivider, isToday && { backgroundColor: 'rgba(254,242,242,0.6)' }]}>
                <View style={{ width: 64 }}>
                  <Text style={[styles.weekDay, isToday && { color: Colors.primary }]}>{DAYS[i]}</Text>
                  {isToday && <Text style={styles.weekToday}>TODAY</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  {entries.length === 0 ? (
                    <Text style={styles.closed}>— Closed</Text>
                  ) : entries.map((en) => (
                    <Text key={en.id} style={styles.weekEntry} numberOfLines={1}>
                      <Text style={{ fontWeight: '600' }}>{en.open_time} – {en.close_time}</Text>
                      <Text style={{ color: T.n400 }}>  · {en.location}</Text>
                    </Text>
                  ))}
                </View>
                {entries.length > 0 && <View style={[styles.dot, { backgroundColor: Colors.primary, width: 8, height: 8, borderRadius: 4 }]} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalHead}>
              <View>
                <Text style={styles.modalTitle}>{editing ? 'Edit Hours' : 'Add Schedule'}</Text>
                <Text style={styles.headerSub}>{FULL_DAYS[form.day_of_week]}</Text>
              </View>
              <TouchableOpacity onPress={() => setModal(false)} style={styles.close} accessibilityLabel="Close schedule editor">
                <Ionicons name="close" size={16} color={T.n500} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <SectionLabel>Hours</SectionLabel>
              <Field label="Opening Time"><TimePicker value={form.open_time} onChange={(v) => setForm((f) => ({ ...f, open_time: v }))} /></Field>
              <Field label="Closing Time"><TimePicker value={form.close_time} onChange={(v) => setForm((f) => ({ ...f, close_time: v }))} /></Field>
              <SectionLabel>Location</SectionLabel>
              <Field label="Address or Intersection *">
                <Input value={form.location} onChangeText={(t) => setForm((f) => ({ ...f, location: t }))} placeholder="e.g. Main St & 5th Ave, Newark NJ" maxLength={200} />
              </Field>
              <Field label="Notes (optional)">
                <Input value={form.notes} onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))} placeholder="e.g. Near the farmers market entrance" maxLength={200} />
              </Field>
              <Button
                title={saving ? 'Saving...' : editing ? 'Save Changes' : 'Add to Schedule'}
                onPress={save}
                loading={saving}
                disabled={!form.location.trim()}
                style={{ borderRadius: 16, paddingVertical: 16, marginTop: 8 }}
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: T.n900, letterSpacing: 0.6 },
  headerSub: { fontSize: 12, color: T.n400, marginTop: 2 },
  dayBar: { backgroundColor: T.n50, borderBottomWidth: 1, borderBottomColor: T.n100, paddingVertical: 12 },
  dayPill: { alignItems: 'center', gap: 2, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, minWidth: 58 },
  dayPillOn: { backgroundColor: Colors.primary },
  dayPillOff: { backgroundColor: '#fff', borderWidth: 1, borderColor: T.n200 },
  dayText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  todayText: { fontSize: 9, fontWeight: '900' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  scroll: { padding: 16, paddingBottom: 48 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dayTitle: { fontSize: 14, fontWeight: '900', color: T.n700, letterSpacing: 1.4 },
  addAnother: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  entry: { flexDirection: 'row', gap: 12, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: T.n100, padding: 16, marginBottom: 12, ...shadow },
  pin: { width: 40, height: 40, borderRadius: 12, backgroundColor: T.red50, alignItems: 'center', justifyContent: 'center' },
  entryLoc: { fontSize: 14, fontWeight: '700', color: T.n900 },
  entryTime: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  entryNotes: { fontSize: 12, color: T.n400, marginTop: 4 },
  link: { fontSize: 12, fontWeight: '600', color: T.n400 },
  week: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: T.n100, overflow: 'hidden', ...shadow },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  weekDay: { fontSize: 14, fontWeight: '700', color: T.n400 },
  weekToday: { fontSize: 9, fontWeight: '900', color: Colors.primary, letterSpacing: 0.5 },
  closed: { fontSize: 14, color: T.n300 },
  weekEntry: { fontSize: 14, color: T.n700 },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: T.n100,
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: T.n900 },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center' },
  timeChip: { width: 78, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: T.n200, backgroundColor: '#fff' },
  timeChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeChipText: { fontSize: 13, fontWeight: '700', color: T.n600 },
});
