import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Never throw at module load — a throw here aborts the JS bundle before the
// app can mount, which surfaces to iOS as an EXC_CRASH/SIGABRT on the Expo
// error-recovery queue and gets the build rejected by App Review.
// If env vars are missing we fall back to placeholder strings so the app can
// still boot; auth/data calls will fail with a network error and the user
// sees a normal error state instead of a crash on launch.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://missing-env.invalid';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'missing';
if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY — check eas.json env block.');
}

// expo-secure-store is used instead of @supabase/ssr's cookie storage.
// Errors are swallowed so a locked/unavailable keychain doesn't corrupt auth state.
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key).catch(() => null),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value).catch(() => {}),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key).catch(() => {}),
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
