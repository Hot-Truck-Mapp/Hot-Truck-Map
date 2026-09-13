import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { API_BASE } from '@/lib/api';
import { CONTACT_SUBJECTS, FAQ_ITEMS, SUPPORT_EMAIL } from '@/lib/faq';
import { Colors } from '@/constants/colors';
import { Button, Card, Field, Hero, Input, Pill, T, s as ui, shadow } from '@/components/ui';

type Subject = (typeof CONTACT_SUBJECTS)[number];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faq}>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} style={styles.faqHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.faqQ}>{q}</Text>
        <Text style={[styles.faqPlus, open && { transform: [{ rotate: '45deg' }] }]}>+</Text>
      </TouchableOpacity>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </View>
  );
}

/** Mobile twin of /contact — posts to the same /api/contact route. */
export default function ContactScreen() {
  const { session } = useAuth();
  const mountedRef = useRef(true);
  const [name, setName] = useState('');
  // null = untouched, so a signed-in user's address shows until they edit it.
  const [emailInput, setEmailInput] = useState<string | null>(null);
  const email = emailInput ?? session?.user.email ?? '';
  const setEmail = setEmailInput;
  const [subject, setSubject] = useState<Subject | ''>('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  function validate() {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = 'Please enter a valid email address.';
    if (!subject) e.subject = 'Please select a subject.';
    if (!message.trim()) e.message = 'Message is required.';
    else if (message.trim().length > 1000) e.message = 'Message must be 1000 characters or fewer.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (submitting || success || !validate()) return;
    setSubmitting(true);
    setApiError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/contact`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // The route attaches the sender's account when signed in, same as the web form.
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          signal: controller.signal,
          body: JSON.stringify({ name: name.trim(), email: email.trim(), subject, message: message.trim() }),
        });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!mountedRef.current) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        setApiError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSuccess(true);
    } catch {
      if (mountedRef.current) setApiError('Network error — please check your connection and try again.');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  function reset() {
    setSuccess(false); setName(''); setSubject(''); setMessage(''); setErrors({}); setApiError(null);
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Hero title="Get in Touch" subtitle="Have a question, feedback, or want to list your truck? We'd love to hear from you." />
        <View style={{ padding: 16, gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <Text style={styles.cardTitle}>Send us a message</Text>
            {success ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                <View style={styles.okIcon}><Text style={{ fontSize: 26, color: T.green600 }}>✓</Text></View>
                <Text style={styles.okTitle}>Message sent!</Text>
                <Text style={styles.okBody}>Thanks! We&apos;ll get back to you within 24 hours.</Text>
                <TouchableOpacity onPress={reset}><Text style={styles.link}>Send another message</Text></TouchableOpacity>
              </View>
            ) : (
              <>
                <Field label="Name *" error={errors.name}>
                  <Input value={name} onChangeText={(t) => { setName(t); if (errors.name) setErrors((e) => ({ ...e, name: '' })); }} placeholder="Your name" autoComplete="name" maxLength={200} invalid={!!errors.name} />
                </Field>
                <Field label="Email *" error={errors.email}>
                  <Input value={email} onChangeText={(t) => { setEmail(t); if (errors.email) setErrors((e) => ({ ...e, email: '' })); }} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={320} invalid={!!errors.email} />
                </Field>
                <Field label="Subject *" error={errors.subject}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {CONTACT_SUBJECTS.map((s) => (
                      <Pill key={s} label={s} active={subject === s} onPress={() => { setSubject(s); if (errors.subject) setErrors((e) => ({ ...e, subject: '' })); }} />
                    ))}
                  </View>
                </Field>
                <Field label="Message *" error={errors.message}>
                  <Input value={message} onChangeText={(t) => { setMessage(t); if (errors.message) setErrors((e) => ({ ...e, message: '' })); }} placeholder="Tell us what's on your mind…" multiline maxLength={1000} style={{ minHeight: 120 }} invalid={!!errors.message} />
                  <Text style={[styles.count, message.length > 1000 && { color: T.red500 }]}>{message.length} / 1000</Text>
                </Field>
                {apiError ? <Text style={styles.apiError}>{apiError}</Text> : null}
                <Button title={submitting ? 'Sending…' : 'Send Message'} onPress={submit} loading={submitting} />
              </>
            )}
          </Card>

          <TouchableOpacity style={styles.info} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} activeOpacity={0.8}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(232,72,28,0.1)' }]}><Text style={{ fontSize: 20 }}>📧</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Email</Text>
              <Text style={[styles.infoBody, { color: Colors.primary, fontWeight: '600' }]}>{SUPPORT_EMAIL}</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.info}>
            <View style={[styles.infoIcon, { backgroundColor: 'rgba(255,154,92,0.12)' }]}><Text style={{ fontSize: 20 }}>📍</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Location</Text>
              <Text style={styles.infoBody}>New Jersey &amp; New York</Text>
            </View>
          </View>
          <View style={styles.info}>
            <View style={[styles.infoIcon, { backgroundColor: T.n100 }]}><Text style={{ fontSize: 20 }}>🕐</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Response Time</Text>
              <Text style={styles.infoBody}>Within 24 hours</Text>
            </View>
          </View>
          <View style={styles.cta}>
            <Text style={styles.ctaTitle}>Want to list your truck?</Text>
            <Text style={styles.ctaBody}>It&apos;s free to join. Sign up as an operator and reach hungry customers near you.</Text>
            <Button title="Get Started Free" onPress={() => Linking.openURL(`${API_BASE}/signup?role=operator`)} small style={{ marginTop: 6 }} />
          </View>

          <Card style={{ padding: 20 }}>
            <Text style={styles.cardTitle}>Frequently Asked Questions</Text>
            <Text style={styles.faqSub}>Quick answers to common questions.</Text>
            <View style={{ gap: 10 }}>
              {FAQ_ITEMS.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </View>
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cardTitle: { fontSize: 18, fontWeight: '900', color: T.n900, marginBottom: 16 },
  count: { fontSize: 12, color: T.n400, textAlign: 'right', marginTop: 4 },
  apiError: { fontSize: 14, color: '#B91C1C', backgroundColor: T.red50, borderWidth: 1, borderColor: '#FECACA', borderRadius: 12, padding: 12, marginBottom: 12, overflow: 'hidden' },
  okIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  okTitle: { fontSize: 18, fontWeight: '900', color: T.n900 },
  okBody: { fontSize: 14, color: T.n500, textAlign: 'center' },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginTop: 8 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: T.n200, padding: 16, ...shadow },
  infoIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 14, fontWeight: '900', color: T.n900 },
  infoBody: { fontSize: 14, color: T.n600, marginTop: 2 },
  cta: { backgroundColor: T.n900, borderRadius: 16, padding: 18, gap: 6 },
  ctaTitle: { fontSize: 14, fontWeight: '900', color: '#fff' },
  ctaBody: { fontSize: 12, color: T.n400, lineHeight: 18 },
  faqSub: { fontSize: 14, color: T.n500, marginTop: -10, marginBottom: 16 },
  faq: { borderWidth: 1, borderColor: T.n200, borderRadius: 12, overflow: 'hidden' },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '600', color: T.n900 },
  faqPlus: { fontSize: 18, color: T.n500, width: 20, textAlign: 'center' },
  faqA: { fontSize: 14, color: T.n600, lineHeight: 21, paddingHorizontal: 16, paddingBottom: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.n100 },
});
