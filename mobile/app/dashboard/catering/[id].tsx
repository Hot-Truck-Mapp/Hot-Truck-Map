import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useMyTruck } from '@/hooks/useMyTruck';
import { useAsyncData } from '@/hooks/useAsyncData';
import { Colors } from '@/constants/colors';
import {
  Button, Card, ErrorState, InfoRows, Input, LoadingState, SectionLabel, T, Toast, s as ui, useToast,
} from '@/components/ui';
import { REQUEST_COLS, STATUS_CHIP, eventDate, type CateringRequest } from '@/lib/catering';

type Message = { id: string; sender_id: string; message: string; created_at: string };

async function fetchRequest(truckId: string, id: string): Promise<{ request: CateringRequest | null; packageName: string | null }> {
  const { data, error } = await supabase.from('catering_requests').select(REQUEST_COLS).eq('id', id).eq('truck_id', truckId).maybeSingle();
  if (error) throw error;
  const request = (data as CateringRequest | null) ?? null;
  let packageName: string | null = null;
  if (request?.selected_package_id) {
    const { data: pkg } = await supabase.from('catering_packages').select('name').eq('id', request.selected_package_id).maybeSingle();
    packageName = pkg?.name ?? null;
  }
  return { request, packageName };
}

async function fetchMessages(requestId: string): Promise<Message[]> {
  const { data, error } = await supabase.from('catering_messages').select('id, sender_id, message, created_at')
    .eq('request_id', requestId).order('created_at', { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []) as Message[];
}

/** Detail pane of /dashboard/catering, as its own screen on a phone. */
export default function CateringRequestDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session, truck, loading: truckLoading } = useMyTruck();
  const truckId = truck?.id ?? null;
  const mountedRef = useRef(true);
  const detailQ = useAsyncData(truckId && id ? `request:${truckId}:${id}` : null, () => fetchRequest(truckId!, id!));
  const request = detailQ.data?.request ?? null;
  const packageName = detailQ.data?.packageName ?? null;
  const messagesQ = useAsyncData(truckId && id ? `messages:${id}` : null, () => fetchMessages(id!));
  const messages = messagesQ.data ?? [];
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function updateStatus(status: 'confirmed' | 'declined' | 'completed') {
    if (!truck || !request || updating) return;
    setUpdating(true);
    try {
      const { error } = await supabase.from('catering_requests').update({ status }).eq('id', request.id).eq('truck_id', truck.id);
      if (error) throw error;
      if (mountedRef.current) detailQ.setData((d) => (d?.request ? { ...d, request: { ...d.request, status } } : { request: null, packageName: null }));
    } catch {
      show('Failed to update status — please try again.');
    } finally {
      if (mountedRef.current) setUpdating(false);
    }
  }

  async function send() {
    const text = message.trim();
    if (!text || !request || !truck || sending || request.truck_id !== truck.id) return;
    if (text.length > 1000) { show('Message must be 1000 characters or fewer.'); return; }
    setSending(true);
    try {
      const { error } = await supabase.from('catering_messages').insert({ request_id: request.id, sender_id: session?.user.id, message: text });
      if (error) throw error;
      if (!mountedRef.current) return;
      setMessage('');
      await messagesQ.reload();
    } catch {
      show('Failed to send message — please try again.');
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  if (truckLoading || detailQ.loading) return <LoadingState />;
  if (detailQ.error) return <ErrorState title="Could not load this request" message="Check your connection and try again." onRetry={detailQ.reload} />;
  if (!request) return <ErrorState title="Request not found" message="It may have been removed." />;

  const chip = STATUS_CHIP[request.status] ?? STATUS_CHIP.pending;

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{request.customer_name.toUpperCase()}</Text>
              <Text style={styles.sub}>{request.event_type ?? 'Event'} · {request.guest_count} guests</Text>
            </View>
            <Text style={[styles.chip, { color: chip.fg, backgroundColor: chip.bg, borderColor: chip.border }]}>{request.status.toUpperCase()}</Text>
          </View>
          {request.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button title="CONFIRM" variant="green" onPress={() => updateStatus('confirmed')} disabled={updating} style={{ flex: 1 }} />
              <Button title="DECLINE" variant="ghost" onPress={() => updateStatus('declined')} disabled={updating} style={{ flex: 1, backgroundColor: T.n200 }} />
            </View>
          )}
          {request.status === 'confirmed' && (
            <Button title="MARK AS COMPLETED" variant="dark" onPress={() => updateStatus('completed')} disabled={updating} style={{ marginTop: 16, backgroundColor: T.n900 }} />
          )}
        </View>

        <View style={{ padding: 16, gap: 16 }}>
          <Card style={{ paddingVertical: 4 }}>
            <SectionLabel style={{ marginTop: 10, marginBottom: 2 }}>Event Details</SectionLabel>
            <InfoRows rows={[
              { label: 'Date', value: eventDate(request.event_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) },
              { label: 'Time', value: request.event_time ?? 'Not specified' },
              { label: 'Location', value: request.event_location },
              { label: 'Guests', value: `${request.guest_count} people` },
              { label: 'Budget', value: request.budget ? `$${request.budget}` : 'Not specified' },
              { label: 'Event Type', value: request.event_type ?? 'Not specified' },
              ...(packageName ? [{ label: 'Package', value: packageName }] : []),
            ]} />
          </Card>

          <Card style={{ paddingVertical: 4 }}>
            <SectionLabel style={{ marginTop: 10, marginBottom: 2 }}>Contact Info</SectionLabel>
            <InfoRows rows={[
              { label: 'Email', value: <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${request.customer_email}`)}>{request.customer_email}</Text> },
              ...(request.customer_phone ? [{ label: 'Phone', value: <Text style={styles.link} onPress={() => Linking.openURL(`tel:${request.customer_phone}`)}>{request.customer_phone}</Text> }] : []),
            ]} />
          </Card>

          {request.notes ? (
            <Card>
              <SectionLabel>Customer Notes</SectionLabel>
              <Text style={styles.notes}>{request.notes}</Text>
            </Card>
          ) : null}

          <Card>
            <SectionLabel>Messages</SectionLabel>
            {messages.length === 0 ? (
              <Text style={styles.noMsg}>No messages yet. Start the conversation!</Text>
            ) : messages.map((m) => (
              <View key={m.id} style={styles.msg}>
                <Text style={styles.msgText}>{m.message}</Text>
                <Text style={styles.msgTime}>{new Date(m.created_at).toLocaleString()}</Text>
              </View>
            ))}
            <View style={styles.compose}>
              <Input value={message} onChangeText={setMessage} placeholder="Type a message..." maxLength={1000} style={{ flex: 1, paddingVertical: 10, fontSize: 15 }} returnKeyType="send" onSubmitEditing={send} />
              <Button title="Send" onPress={send} loading={sending} disabled={!message.trim()} small />
            </View>
          </Card>
        </View>
      </ScrollView>
      <Toast toast={toast} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: '#fff', padding: 20, borderBottomWidth: 1, borderBottomColor: T.n200 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  name: { fontSize: 18, fontWeight: '900', color: T.n900, letterSpacing: 0.4 },
  sub: { fontSize: 14, color: T.n500, marginTop: 2 },
  chip: { fontSize: 11, fontWeight: '900', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden', letterSpacing: 0.5 },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary, textAlign: 'right', flex: 1 },
  notes: { fontSize: 14, color: T.n600, lineHeight: 21 },
  noMsg: { fontSize: 12, color: T.n400, textAlign: 'center', paddingVertical: 16 },
  msg: { backgroundColor: T.n50, borderRadius: 12, padding: 12, marginBottom: 8 },
  msgText: { fontSize: 14, color: T.n700 },
  msgTime: { fontSize: 10, color: T.n400, marginTop: 4 },
  compose: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: T.n100, paddingTop: 12, marginTop: 4 },
});
