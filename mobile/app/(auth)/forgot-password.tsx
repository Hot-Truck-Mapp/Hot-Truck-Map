import { useState } from 'react';
import {
  StyleSheet, Text, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert('Enter email', 'Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: 'hottruckmap://reset-password',
      });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setSent(true);
      }
    } catch {
      Alert.alert('Error', 'Network error — please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.body}>
          A password reset link has been sent to{'\n'}
          <Text style={styles.email}>{email.trim()}</Text>
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
          accessibilityLabel="Back to login"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.body}>
          Enter your email and we&apos;ll send you a link to reset your password.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={handleReset}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleReset}
          disabled={loading}
          accessibilityLabel={loading ? 'Sending reset link' : 'Send reset link'}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send Reset Link'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Back to login"
          accessibilityRole="button"
        >
          <Text style={styles.link}>Back to login</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  center: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 12 },
  body: { fontSize: 15, color: Colors.textSecondary, marginBottom: 28, lineHeight: 22, textAlign: 'center' },
  email: { color: Colors.text, fontWeight: '600' },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', color: Colors.primary, fontSize: 14 },
});
