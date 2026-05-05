import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Validate required env vars at startup with a clear message
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars — check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.');
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
