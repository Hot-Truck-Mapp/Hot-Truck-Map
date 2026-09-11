import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/colors';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mobile twin of components/newsletter/SubscribeForm.tsx — same API, same copy. */
export function NewsletterSubscribe() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  async function handleSubmit() {
    if (submitting || success) return;

    const trimmed = email.trim();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/newsletter-subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ email: trimmed }),
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!mountedRef.current) return;

      if (!res.ok) {
        let msg = 'Something went wrong. Please try again.';
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {
          // ignore parse errors
        }
        setError(msg);
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!mountedRef.current) return;
      if (data?.alreadySubscribed) setAlreadySubscribed(true);
      setSuccess(true);
    } catch {
      if (mountedRef.current) {
        setError('Network error — please check your connection and try again.');
      }
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={styles.box}>
        <Text style={styles.emoji}>{alreadySubscribed ? '📬' : '✅'}</Text>
        <Text style={styles.title}>
          {alreadySubscribed ? "You're already subscribed" : "You're subscribed!"}
        </Text>
        <Text style={styles.body}>
          {alreadySubscribed
            ? "We'll keep sending new issues to your inbox every two weeks."
            : 'Check your inbox for a welcome email — new issues land in your inbox every two weeks.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.emoji}>📬</Text>
      <Text style={styles.title}>Get it in your inbox</Text>
      <Text style={styles.body}>
        Subscribe and new issues land in your inbox every two weeks — no spam, unsubscribe any time.
      </Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
        placeholder="you@example.com"
        placeholderTextColor={Colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        editable={!submitting}
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
        accessibilityLabel="Email address"
      />
      <TouchableOpacity
        style={[styles.button, submitting && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Subscribe to the newsletter"
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Subscribe</Text>
        )}
      </TouchableOpacity>
      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D4D4D4',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emoji: { fontSize: 24, marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '900', color: Colors.text, marginBottom: 4 },
  body: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17, marginBottom: 16, maxWidth: 280 },
  input: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  button: {
    alignSelf: 'stretch',
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  error: { fontSize: 12, color: '#DC2626', marginTop: 12, textAlign: 'center' },
});
