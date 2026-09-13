import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/api';
import { Colors } from '@/constants/colors';
import { T } from '@/components/ui';
import { CUISINE_TYPES } from '@shared/cuisines';

type Step = 'choose' | 'operator' | 'customer' | 'done-operator';

function Brand() {
  return (
    <View style={styles.brandRow}>
      <View style={styles.brandIcon}><Text style={styles.brandIconText}>🚚</Text></View>
      <View>
        <Text style={styles.brandName}>
          <Text style={styles.brandNameHot}>HOT </Text>
          <Text style={styles.brandNameTruck}>TRUCK</Text>
        </Text>
        <Text style={styles.brandNameMap}>MAP</Text>
      </View>
    </View>
  );
}

function Legal() {
  return (
    <Text style={styles.legalText}>
      By signing up you agree to our{' '}
      <Text style={styles.legalLink} onPress={() => Linking.openURL(`${API_BASE}/terms`)}>Terms of Service</Text>
      {' '}and{' '}
      <Text style={styles.legalLink} onPress={() => Linking.openURL(`${API_BASE}/privacy`)}>Privacy Policy</Text>.
    </Text>
  );
}

/** Mobile twin of the web /signup — a customer or a truck, same two paths. */
export default function SignupScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  const router = useRouter();
  const [step, setStep] = useState<Step>(params.role === 'operator' ? 'operator' : 'choose');

  // Customer
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  // Operator
  const [truckName, setTruckName] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [opEmail, setOpEmail] = useState('');
  const [opPassword, setOpPassword] = useState('');
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  async function handleSignup() {
    if (loading) return; // in-flight guard
    if (!displayName.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (displayName.trim().length < 2) {
      Alert.alert('Name too short', 'Please enter your full name (at least 2 characters).');
      return;
    }
    if (displayName.trim().length > 100) {
      Alert.alert('Name too long', 'Name must be 100 characters or fewer.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }
    // Matches the web signup (Supabase's own minimum is enforced server-side too).
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { role: 'customer', display_name: displayName.trim() } },
      });
      if (error) {
        // The generic message exists to prevent email enumeration, so it must
        // only cover the "this address is already registered" case.
        const raw = error.message ?? '';
        const isEnumerationRisk = /already|registered|exists/i.test(raw);
        Alert.alert(
          'Sign up failed',
          isEnumerationRisk
            ? 'Could not create account. If you already have an account, try signing in instead.'
            : raw || 'Could not create account. Please check your details and try again.'
        );
      } else {
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Verify your email then sign in.',
          [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    } catch {
      Alert.alert('Sign up failed', 'Network error — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOperatorSignup() {
    if (opLoading) return;
    if (!truckName.trim() || !opEmail.trim() || !opPassword) {
      setOpError('Please fill in your truck name, email and password.');
      return;
    }
    if (truckName.trim().length > 100) { setOpError('Truck name must be 100 characters or fewer.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opEmail.trim()) || opEmail.length > 320) { setOpError('Please enter a valid email address.'); return; }
    if (opPassword.length < 8) { setOpError('Password must be at least 8 characters.'); return; }
    setOpLoading(true);
    setOpError(null);
    try {
      // Same route the web uses: it creates the auth user AND the truck row
      // with the service role, so the truck exists before the email is confirmed.
      const res = await fetch(`${API_BASE}/api/signup/operator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: opEmail.trim(),
          password: opPassword,
          truckName: truckName.trim(),
          cuisine: cuisine || null,
          // The web callback exchanges the confirmation code; after that the
          // operator signs in here with the password they just chose.
          emailRedirectTo: `${API_BASE}/auth/callback`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setOpError(err.error ?? 'Sign-up failed. Please try again.');
        return;
      }
      setStep('done-operator');
    } catch {
      setOpError('Network error — please check your connection and try again.');
    } finally {
      setOpLoading(false);
    }
  }

  // ── Choose ────────────────────────────────────────────────────────────────
  if (step === 'choose') {
    return (
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container}>
          <Brand />
          <Text style={styles.subtitle}>Join the community</Text>
          <TouchableOpacity style={styles.chooseDark} onPress={() => setStep('operator')} activeOpacity={0.85} accessibilityRole="button">
            <View style={styles.chooseIconRed}><Ionicons name="bus" size={22} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chooseDarkTitle}>List my truck</Text>
              <Text style={styles.chooseDarkBody}>Get on the map, go live in 1 tap, get discovered</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.n500} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chooseLight} onPress={() => setStep('customer')} activeOpacity={0.85} accessibilityRole="button">
            <View style={styles.chooseIconLight}><Ionicons name="location" size={22} color={Colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chooseLightTitle}>Find food trucks near me</Text>
              <Text style={styles.chooseLightBody}>Follow your favorites, get notified when they go live</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.n300} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} accessibilityRole="button">
            <Text style={styles.link}>Already have an account? <Text style={{ fontWeight: '700' }}>Sign In</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Operator done ─────────────────────────────────────────────────────────
  if (step === 'done-operator') {
    return (
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.doneIcon}><Ionicons name="checkmark" size={28} color="#fff" /></View>
          <Text style={styles.doneTitle}>{truckName.trim()} is ready!</Text>
          <Text style={styles.subtitle}>One last step to get on the map.</Text>
          <View style={styles.steps}>
            {[
              { num: '1', title: 'Confirm your email', desc: `We sent a link to ${opEmail.trim()} — tap it to activate your account.`, active: true },
              { num: '2', title: 'Sign in here', desc: 'Complete your profile, add menu items, and set your schedule.', active: false },
              { num: '3', title: 'Tap Go Live', desc: 'One tap and your truck appears on the map instantly.', active: false },
            ].map((s, i) => (
              <View key={s.num} style={[styles.stepRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: T.n100 }]}>
                <View style={[styles.stepNum, s.active && { backgroundColor: Colors.primary }]}>
                  <Text style={[styles.stepNumText, s.active && { color: '#fff' }]}>{s.num}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, !s.active && { color: T.n500 }]}>{s.title}</Text>
                  <Text style={styles.stepDesc}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')} accessibilityRole="button">
            <Text style={styles.buttonText}>Go to Sign In</Text>
          </TouchableOpacity>
          <Text style={styles.legalText}>Can&apos;t find the email? Check your spam folder.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Operator form ─────────────────────────────────────────────────────────
  if (step === 'operator') {
    return (
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setStep('choose')} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={18} color={T.n600} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>List your truck</Text>
            <Text style={styles.formSub}>Under 2 minutes.</Text>

            <Text style={styles.section}>YOUR TRUCK</Text>
            <Text style={styles.label}>Truck Name *</Text>
            <TextInput style={styles.input} placeholder="e.g. The Taco Truck" placeholderTextColor={T.n400} value={truckName} onChangeText={(t) => { setTruckName(t); setOpError(null); }} maxLength={100} />
            <Text style={styles.label}>Cuisine Type</Text>
            <View style={styles.cuisines}>
              {CUISINE_TYPES.map((c) => (
                <TouchableOpacity key={c} onPress={() => setCuisine(cuisine === c ? '' : c)} style={[styles.cuisinePill, cuisine === c && styles.cuisinePillOn]}>
                  <Text style={[styles.cuisineText, cuisine === c && { color: '#fff' }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.section}>YOUR ACCOUNT</Text>
            <Text style={styles.label}>Email *</Text>
            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={T.n400} value={opEmail} onChangeText={(t) => { setOpEmail(t); setOpError(null); }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <Text style={styles.label}>Password *</Text>
            <TextInput style={styles.input} placeholder="Min 8 characters" placeholderTextColor={T.n400} value={opPassword} onChangeText={(t) => { setOpPassword(t); setOpError(null); }} secureTextEntry autoComplete="new-password" onSubmitEditing={handleOperatorSignup} />

            {opError ? <Text style={styles.error}>{opError}</Text> : null}
            <TouchableOpacity style={[styles.button, opLoading && styles.buttonDisabled]} onPress={handleOperatorSignup} disabled={opLoading} accessibilityRole="button">
              {opLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create My Truck</Text>}
            </TouchableOpacity>
            <Legal />
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} accessibilityRole="button">
              <Text style={styles.link}>Already have an account? Sign in</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Customer form ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setStep('choose')} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={18} color={T.n600} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Brand />
        <Text style={styles.subtitle}>Create your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor={Colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="next"
          accessibilityLabel="Your name"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="next"
          accessibilityLabel="Email address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="next"
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={Colors.textSecondary}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={handleSignup}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
          accessibilityLabel={loading ? 'Creating account' : 'Sign up'}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{loading ? 'Creating account…' : 'Sign Up'}</Text>
        </TouchableOpacity>

        <Legal />

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          accessibilityLabel="Already have an account? Sign in"
          accessibilityRole="button"
        >
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 6 },
  brandIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandIconText: { fontSize: 26 },
  brandName: { fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  brandNameHot: { color: Colors.primary },
  brandNameTruck: { color: Colors.text },
  brandNameMap: { fontSize: 22, fontWeight: '900', color: '#FF9A5C', letterSpacing: 1, lineHeight: 24 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 28 },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  legalText: { textAlign: 'center', color: Colors.textSecondary, fontSize: 12, marginBottom: 16, lineHeight: 18 },
  legalLink: { color: Colors.primary, fontWeight: '600' },
  link: { textAlign: 'center', color: Colors.primary, fontSize: 14 },

  chooseDark: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: T.n900, borderRadius: 18, padding: 18, marginBottom: 12 },
  chooseIconRed: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  chooseDarkTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 2 },
  chooseDarkBody: { fontSize: 13, color: T.n400, lineHeight: 18 },
  chooseLight: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: T.n200, marginBottom: 24 },
  chooseIconLight: { width: 44, height: 44, borderRadius: 14, backgroundColor: T.red50, alignItems: 'center', justifyContent: 'center' },
  chooseLightTitle: { fontSize: 17, fontWeight: '800', color: T.n800, marginBottom: 2 },
  chooseLightBody: { fontSize: 13, color: T.n400, lineHeight: 18 },

  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: 12 },
  backText: { fontSize: 14, color: T.n600, fontWeight: '600' },
  formTitle: { fontSize: 26, fontWeight: '900', color: T.n900 },
  formSub: { fontSize: 14, color: T.n500, marginTop: 2, marginBottom: 20 },
  section: { fontSize: 11, fontWeight: '900', color: T.n400, letterSpacing: 1.4, marginTop: 8, marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '600', color: T.n700, marginBottom: 6 },
  cuisines: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  cuisinePill: { borderWidth: 1, borderColor: T.n200, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  cuisinePillOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  cuisineText: { fontSize: 13, fontWeight: '500', color: T.n600 },
  error: { fontSize: 14, color: T.red600, backgroundColor: T.red50, borderRadius: 10, padding: 12, marginBottom: 4, overflow: 'hidden' },

  doneIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  doneTitle: { fontSize: 24, fontWeight: '900', color: T.n900, textAlign: 'center' },
  steps: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: T.n100, overflow: 'hidden', marginBottom: 8 },
  stepRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: T.n100, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumText: { fontSize: 12, fontWeight: '900', color: T.n400 },
  stepTitle: { fontSize: 14, fontWeight: '700', color: T.n900 },
  stepDesc: { fontSize: 12, color: T.n400, marginTop: 2, lineHeight: 17 },
});
