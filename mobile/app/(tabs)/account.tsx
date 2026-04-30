import { StyleSheet, View, Text, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function AccountTab() {
  const { session } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
        // Navigation handled by AuthGuard after session clears
      },
    ]);
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.message}>Sign in to view your account</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(session.user.email ?? '?')[0].toUpperCase()}
          </Text>
        </View>
        <Text style={styles.email}>{session.user.email}</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/(tabs)/trucks')}>
          <Text style={styles.rowText}>Browse Trucks</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/(tabs)/orders')}>
          <Text style={styles.rowText}>My Orders</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={[styles.row, styles.rowLast]}>
          <Text style={styles.rowText}>Push Notifications</Text>
          <Switch
            value={true}
            onValueChange={() =>
              Alert.alert('Coming soon', 'Granular notification settings are coming soon.')
            }
            trackColor={{ true: Colors.primary }}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  header: { alignItems: 'center', marginBottom: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  email: { fontSize: 16, color: Colors.text },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    marginBottom: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { fontSize: 16, color: Colors.text },
  chevron: { fontSize: 20, color: Colors.textSecondary },
  message: { fontSize: 16, color: Colors.textSecondary },
  primaryButton: {
    backgroundColor: Colors.primary, borderRadius: 10,
    paddingVertical: 14, paddingHorizontal: 32,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  signOutButton: {
    borderWidth: 1, borderColor: Colors.error,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  signOutText: { color: Colors.error, fontSize: 16, fontWeight: '600' },
});
