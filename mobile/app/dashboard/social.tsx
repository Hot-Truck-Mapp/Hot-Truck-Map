import { useEffect, useRef, useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { authedFetch } from '@/lib/api';
import { useMyTruck } from '@/hooks/useMyTruck';
import { Colors } from '@/constants/colors';
import {
  Button, Card, EmptyState, Input, LoadingState, PageHeader, T, Toast, s as ui, shadow, useToast,
} from '@/components/ui';

const PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#E1306C', description: 'Post your location automatically when you go live' },
  { id: 'facebook', name: 'Facebook', icon: '👥', color: '#1877F2', description: 'Share your location to your Facebook page' },
  { id: 'twitter', name: 'X (Twitter)', icon: '🐦', color: '#000000', description: 'Tweet your location to your followers' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#010101', description: "Notify your TikTok followers when you're live" },
];
const TEMPLATES = [
  "📍 We're live at {location}! Come find us 🚚🔥 #foodtruck #HotTruckMap",
  '🚚 {truck_name} is open NOW at {location}! {cuisine} done right. Come eat! 🙌',
  '📍 Lunch is served! Find us at {location} today until {close_time} 🍽️',
];
const MAX_BROADCAST = 160;
const RATE_LIMIT_SECS = 60;

/** Mobile twin of /dashboard/social. */
export default function SocialScreen() {
  const { truck, loading } = useMyTruck();
  const mountedRef = useRef(true);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [template, setTemplate] = useState(0);
  const [custom, setCustom] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const { toast, show } = useToast();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  function startCooldown() {
    setCooldown(RATE_LIMIT_SECS);
    cooldownRef.current = setInterval(() => {
      setCooldown((n) => {
        if (n <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  async function sendBroadcast() {
    if (!msg.trim() || !truck || cooldown > 0 || sending) return;
    setSending(true);
    try {
      const res = await authedFetch('/api/notify-followers', {
        method: 'POST',
        body: JSON.stringify({ truck_id: truck.id, message: msg.trim() }),
      });
      if (!mountedRef.current) return;
      const data = await res.json().catch(() => ({})) as { sent?: number; error?: string };
      if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
      const sent = data.sent ?? 0;
      show(`Broadcast sent to ${sent} follower${sent !== 1 ? 's' : ''}!`, false);
      setMsg('');
      startCooldown();
    } catch (err) {
      if (mountedRef.current) show(err instanceof Error ? err.message : 'Broadcast failed — try again.');
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  function comingSoon() {
    Alert.alert(
      '🚧 Coming in Phase 5',
      "We're working on integrations for Facebook, X, and TikTok. Instagram is up first — stay tuned!",
      [{ text: 'Got it' }],
    );
  }

  if (loading) return <LoadingState />;
  if (!truck) return <EmptyState icon="bus-outline" title="No truck on this account" />;

  const active = useCustom ? custom : TEMPLATES[template];
  const preview = active
    .replaceAll('{location}', 'Main St & 5th Ave, Newark NJ')
    .replaceAll('{truck_name}', truck.name || 'Your Truck Name')
    .replaceAll('{close_time}', '3:00 PM')
    .replaceAll('{cuisine}', truck.cuisine || 'Tacos');

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <PageHeader title="Social Sync" subtitle="Auto-post your location when you go live" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Card>
          <View style={styles.row}>
            <View style={styles.redDot}><Text style={{ fontSize: 14 }}>📣</Text></View>
            <Text style={styles.cardTitle}>Broadcast to Followers</Text>
          </View>
          <Text style={styles.cardSub}>Send a push notification directly to everyone who follows your truck.</Text>
          <Input
            value={msg}
            onChangeText={(t) => setMsg(t.slice(0, MAX_BROADCAST))}
            placeholder="e.g. We're out of Al Pastor today — try the Birria instead! 🔥"
            maxLength={MAX_BROADCAST}
            multiline
            style={{ fontSize: 14 }}
          />
          <View style={[styles.row, { justifyContent: 'space-between', marginTop: 8 }]}>
            <Text style={[styles.counter, msg.length >= MAX_BROADCAST - 10 && { color: Colors.primary }]}>{msg.length}/{MAX_BROADCAST}</Text>
            <Button
              title={sending ? 'Sending...' : cooldown > 0 ? `Wait ${cooldown}s` : 'Send Broadcast'}
              onPress={sendBroadcast}
              disabled={cooldown > 0 || !msg.trim()}
              loading={sending}
              small
            />
          </View>
          {cooldown > 0 && (
            <View style={{ marginTop: 8 }}>
              <View style={styles.track}><View style={[styles.fill, { width: `${(cooldown / RATE_LIMIT_SECS) * 100}%` }]} /></View>
              <Text style={styles.cardSub}>You can send another broadcast in {cooldown}s</Text>
            </View>
          )}
        </Card>

        <View style={styles.soon}>
          <Text style={{ fontSize: 24 }}>📡</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.soonTitle}>Auto-posting coming soon</Text>
            <Text style={styles.soonBody}>
              Connect your accounts now to be ready. When live, your location will automatically post every time you tap Go Live.
            </Text>
          </View>
        </View>

        <Card>
          <Text style={[styles.cardTitle, { marginBottom: 12 }]}>How it works</Text>
          {[
            { icon: '📍', text: 'You tap Go Live on your dashboard' },
            { icon: '📡', text: 'HotTruckMap gets your GPS location' },
            { icon: '📸', text: 'Your location posts automatically to connected accounts' },
            { icon: '👥', text: 'Your followers know exactly where to find you' },
          ].map((step) => (
            <View key={step.text} style={[styles.row, { marginBottom: 10 }]}>
              <View style={styles.stepIcon}><Text>{step.icon}</Text></View>
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </Card>

        <View>
          <Text style={styles.sectionTitle}>Connect Accounts</Text>
          {PLATFORMS.map((p) => (
            <View key={p.id} style={styles.platform}>
              <View style={[styles.platformIcon, { backgroundColor: `${p.color}15` }]}><Text style={{ fontSize: 22 }}>{p.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.platformName}>{p.name}</Text>
                  <Text style={styles.soonBadge}>SOON</Text>
                </View>
                <Text style={styles.cardSub}>{p.description}</Text>
              </View>
              <TouchableOpacity onPress={comingSoon} style={styles.soonBtn}><Text style={styles.soonBtnText}>Soon</Text></TouchableOpacity>
            </View>
          ))}
        </View>

        <Card>
          <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
            <Text style={styles.cardTitle}>Post Template</Text>
            <TouchableOpacity onPress={() => setUseCustom(!useCustom)}><Text style={styles.customize}>{useCustom ? 'Use preset' : 'Customize'}</Text></TouchableOpacity>
          </View>
          {!useCustom ? TEMPLATES.map((t, i) => (
            <TouchableOpacity key={t} onPress={() => setTemplate(i)} style={[styles.template, template === i ? styles.templateOn : styles.templateOff]}>
              <Text style={styles.templateText}>{t}</Text>
            </TouchableOpacity>
          )) : (
            <Input
              value={custom}
              onChangeText={(t) => setCustom(t.slice(0, 500))}
              placeholder="Write your custom post... Use {location}, {truck_name}, {close_time} as variables"
              maxLength={500}
              multiline
              style={{ fontSize: 14 }}
            />
          )}
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>PREVIEW</Text>
            <Text style={styles.templateText}>{preview}</Text>
          </View>
        </Card>

        <View style={styles.liveCard}>
          <Text style={styles.liveTitle}>●  When you Go Live</Text>
          <Text style={styles.liveBody}>Connect at least one account above to enable auto-posting when you go live.</Text>
        </View>
      </ScrollView>
      <Toast toast={toast} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  redDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: T.n800 },
  cardSub: { fontSize: 12, color: T.n400, marginTop: 4, marginBottom: 8 },
  counter: { fontSize: 12, fontWeight: '500', color: T.n400 },
  track: { height: 4, backgroundColor: T.n100, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  soon: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(232,72,28,0.05)', borderWidth: 1, borderColor: 'rgba(232,72,28,0.2)', borderRadius: 16, padding: 16 },
  soonTitle: { fontSize: 14, fontWeight: '600', color: T.n800 },
  soonBody: { fontSize: 12, color: T.n500, marginTop: 2, lineHeight: 17 },
  stepIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: T.red50, alignItems: 'center', justifyContent: 'center' },
  stepText: { flex: 1, fontSize: 14, color: T.n600 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: T.n700, marginBottom: 10 },
  platform: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, ...shadow },
  platformIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  platformName: { fontSize: 14, fontWeight: '600', color: T.n800 },
  soonBadge: { fontSize: 10, fontWeight: '700', color: T.n400, backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  soonBtn: { backgroundColor: T.n100, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  soonBtnText: { fontSize: 12, fontWeight: '600', color: T.n400 },
  customize: { fontSize: 12, fontWeight: '500', color: Colors.primary },
  template: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 8 },
  templateOn: { borderColor: Colors.primary, backgroundColor: T.red50 },
  templateOff: { borderColor: T.n100, backgroundColor: T.n50 },
  templateText: { fontSize: 12, color: T.n600, lineHeight: 18 },
  preview: { marginTop: 8, padding: 12, backgroundColor: T.n50, borderRadius: 12, borderWidth: 1, borderColor: T.n100 },
  previewLabel: { fontSize: 10, fontWeight: '700', color: T.n400, marginBottom: 4 },
  liveCard: { backgroundColor: Colors.primary, borderRadius: 16, padding: 16 },
  liveTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 6 },
  liveBody: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
});
