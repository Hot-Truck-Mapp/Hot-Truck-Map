import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://hottruckmap.com';

export default function AccountTab() {
  const { session } = useAuth();
  const router = useRouter();
  const mountedRef = useRef(true);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (session?.user) {
      setAvatarUrl(session.user.user_metadata?.avatar_url ?? '');
    }
  }, [session]);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
          } catch {
            Alert.alert('Error', 'Could not sign out. Please try again.');
          }
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            if (deleting) return;
            setDeleting(true);
            try {
              const { data: { session: s } } = await supabase.auth.getSession();
              if (!s?.access_token) throw new Error('Not signed in');

              const res = await fetch(`${API_BASE}/api/account/delete`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${s.access_token}` },
              });

              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error((err as { error?: string }).error ?? 'Deletion failed');
              }

              Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            } catch (err: any) {
              if (mountedRef.current) {
                Alert.alert('Error', err?.message ?? 'Could not delete account. Please try again.');
              }
            } finally {
              if (mountedRef.current) setDeleting(false);
            }
          },
        },
      ]
    );
  }

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (!session?.user) return;

    // Check size (5 MB limit)
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('File too large', 'Please choose a photo under 5 MB.');
      return;
    }

    setUploading(true);
    try {
      // Derive a safe MIME type and extension from the asset
      const rawMime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/jpg': 'jpg',
        'image/png': 'png', 'image/webp': 'webp',
        'image/heic': 'jpg', // HEIC fetched as blob becomes JPEG on iOS
      };
      const safeExt = mimeToExt[rawMime] ?? 'jpg';
      const safeContentType = safeExt === 'jpg' ? 'image/jpeg' : `image/${safeExt}`;
      const path = `customers/${session.user.id}.${safeExt}`;

      // Fetch the image as a blob
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Could not read photo from device.');
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: safeContentType });

      if (uploadErr) throw new Error(uploadErr.message);

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Could not get photo URL — try again.');

      const { error: updateErr } = await supabase.auth.updateUser({
        data: { avatar_url: data.publicUrl },
      });
      if (updateErr) throw new Error('Photo uploaded but failed to save: ' + updateErr.message);

      if (!mountedRef.current) return;
      setAvatarUrl(data.publicUrl);
      Alert.alert('', 'Profile photo updated!');
    } catch (err: any) {
      if (mountedRef.current) Alert.alert('Upload failed', err?.message ?? 'Please try again.');
    } finally {
      if (mountedRef.current) setUploading(false);
    }
  }

  if (!session) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]}>
        <Text style={styles.message}>Sign in to view your account</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/login')}
          accessibilityLabel="Sign in to your account"
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Avatar */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatarWrapper}
          onPress={pickAndUploadAvatar}
          disabled={uploading}
          accessibilityLabel={uploading ? 'Uploading profile photo' : 'Change profile photo'}
          accessibilityRole="button"
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {((session.user.email ?? '?')[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          {/* Camera badge */}
          <View style={styles.cameraBadge}>
            {uploading ? (
              <ActivityIndicator size={10} color="#fff" />
            ) : (
              <Text style={styles.cameraIcon}>📷</Text>
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.email}>{session.user.email}</Text>
        <Text style={styles.avatarHint}>Tap photo to change</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.row}
          onPress={() => router.push('/(tabs)/trucks')}
          accessibilityLabel="Browse trucks"
          accessibilityRole="button"
        >
          <Text style={styles.rowText}>Browse Trucks</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.row, styles.rowLast]}
          onPress={() => router.push('/(tabs)/orders')}
          accessibilityLabel="My orders"
          accessibilityRole="button"
        >
          <Text style={styles.rowText}>My Orders</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.signOutButton}
        onPress={handleSignOut}
        accessibilityLabel="Sign out"
        accessibilityRole="button"
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.deleteButton}
        onPress={handleDeleteAccount}
        disabled={deleting}
        accessibilityLabel="Delete account"
        accessibilityRole="button"
      >
        <Text style={styles.deleteText}>
          {deleting ? 'Deleting...' : 'Delete Account'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  header: { alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  cameraIcon: { fontSize: 10 },
  email: { fontSize: 16, color: Colors.text },
  avatarHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },
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
  deleteButton: {
    marginTop: 12, borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  deleteText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '500' },
});
