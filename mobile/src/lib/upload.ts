import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg',
  'image/png': 'png', 'image/webp': 'webp',
  'image/heic': 'jpg', // HEIC fetched as a blob comes back as JPEG on iOS
};

/**
 * Lets the user pick a photo from their library. Returns null when they
 * cancel, deny access, or pick something over the web's 5 MB limit (the
 * reason is shown to them here, so callers only need to handle null).
 */
export async function pickImage(aspect: [number, number] = [1, 1]): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Please allow photo access to add a picture.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.7,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
    Alert.alert('File too large', 'Photo must be under 5 MB.');
    return null;
  }
  return asset;
}

/**
 * Uploads a picked photo to Supabase Storage and returns its storage path and
 * public URL. `folder` must match the bucket's storage policy — e.g.
 * `trucks/<truck-id>` in `avatars`, `menu/<truck-id>` in `menu-photos` — the
 * same shapes the web dashboard writes.
 */
export async function uploadImage(
  bucket: string,
  folder: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ path: string; publicUrl: string }> {
  const mime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  const ext = MIME_TO_EXT[mime] ?? 'jpg';
  const contentType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const path = `${folder}/photo-${Date.now()}.${ext}`;

  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Could not read photo from device.');
  const blob = await response.blob();

  const { error } = await supabase.storage.from(bucket).upload(path, blob, { upsert: true, contentType });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('Could not get photo URL — try again.');
  return { path, publicUrl: data.publicUrl };
}

/** Best-effort removal of an uploaded file that ended up unused. */
export function removeUpload(bucket: string, path: string) {
  void supabase.storage.from(bucket).remove([path]).then(() => {}, () => {});
}
