import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function SignupScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
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
        Alert.alert('Sign up failed', error.message);
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

  return (
    <SafeAreaView style={styles.flex}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconText}>🚚</Text>
          </View>
          <View>
            <Text style={styles.brandName}>
              <Text style={styles.brandNameHot}>HOT </Text>
              <Text style={styles.brandNameTruck}>TRUCK</Text>
            </Text>
            <Text style={styles.brandNameMap}>MAP</Text>
          </View>
        </View>
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

        <Text style={styles.legalText}>
          By signing up you agree to our{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://hottruckmap.com/terms')}
          >
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://hottruckmap.com/privacy')}
          >
            Privacy Policy
          </Text>
          .
        </Text>

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
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32 },
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
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  legalText: { textAlign: 'center', color: Colors.textSecondary, fontSize: 12, marginBottom: 16, lineHeight: 18 },
  legalLink: { color: Colors.primary, fontWeight: '600' },
  link: { textAlign: 'center', color: Colors.primary, fontSize: 14 },
});
