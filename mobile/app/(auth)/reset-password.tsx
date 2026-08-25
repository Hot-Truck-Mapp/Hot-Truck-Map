import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = Array.isArray(params.code) ? params.code[0] : params.code;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let fired = false;

    // Listen for the PASSWORD_RECOVERY event that fires after code exchange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        fired = true;
        if (mountedRef.current) setReady(true);
      }
    });

    // Exchange the PKCE code from the deep link for a recovery session
    if (code) {
      supabase.auth.exchangeCodeForSession(code).catch(() => {
        if (!fired && mountedRef.current) setTimedOut(true);
      });
    }

    // Safety timeout — if the event never fires, show an expired-link message
    const timeout = setTimeout(() => {
      if (!fired && mountedRef.current) setTimedOut(true);
    }, 30000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [code]);

  async function handleUpdate() {
    if (!ready) return;
    if (!password || password !== confirm) {
      Alert.alert('Passwords do not match', 'Please enter the same password in both fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.');
      return;
    }
    if (password.length > 72) {
      Alert.alert('Password too long', 'Password must be 72 characters or fewer.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert('Update failed', 'Could not update your password. Please request a new reset link.');
        return;
      }
      Alert.alert(
        'Password updated!',
        'Your password has been changed. Please sign in with your new password.',
        [{ text: 'Sign In', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch {
      Alert.alert('Error', 'Network error — please check your connection and try again.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  if (timedOut) {
    return (
      <SafeAreaView style={[styles.flex, styles.centered]}>
        <Text style={styles.title}>Link expired</Text>
        <Text style={styles.body}>This reset link has expired or is invalid. Please request a new one.</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/forgot-password')}>
          <Text style={styles.buttonText}>Request New Link</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={[styles.flex, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.body, { marginTop: 16 }]}>Verifying your reset link…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set New Password</Text>
          <Text style={styles.body}>Choose a strong password you&apos;ll remember.</Text>

          <TextInput
            style={styles.input}
            placeholder="New password (min 8 characters)"
            placeholderTextColor={Colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={Colors.textSecondary}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={handleUpdate}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleUpdate}
            disabled={loading}
            accessibilityLabel={loading ? 'Updating password' : 'Update password'}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>{loading ? 'Updating…' : 'Update Password'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  body: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28, lineHeight: 22, textAlign: 'center' },
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
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
