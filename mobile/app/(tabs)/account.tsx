import { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

export default function AccountTab() {
  const { session } = useAuth();
  const router = useRouter();
  const mountedRef = useRef(true);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);

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

  async function pickAndUploadAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to change your profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      // Use MIME type for extension — Android content URIs don't have file extensions
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const ext = mimeType.split('/')[1] ?? 'jpg';
      const path = `customers/${session.user.id}.${ext}`;

      // Fetch the image as a blob
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Could not read photo from device.');
      const blob = await response.blob();

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });

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
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Avatar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.avatarWrapper} onPress={pickAndUploadAvatar} disabled={uploading}>
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
        <TouchableOpacity activeOpacity={0.7} style={styles.row} onPress={() => router.push('/(tabs)/trucks')}>
          <Text style={styles.rowText}>Browse Trucks</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.7} style={[styles.row, styles.rowLast]} onPress={() => router.push('/(tabs)/orders')}>
          <Text style={styles.rowText}>My Orders</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity activeOpacity={0.7} style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
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
});
