import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const PUSH_TOKEN_KEY = 'expo_push_token_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerTokenWithServer(token: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    // User not signed in yet — will retry after login via registerStoredTokenAfterLogin()
    return;
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl) {
    console.warn('EXPO_PUBLIC_API_URL not set — skipping push token registration with server');
    return;
  }

  const res = await fetch(`${apiUrl}/api/push-subscribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ platform: 'expo', endpoint: token }),
  });

  if (!res.ok) {
    throw new Error(`Push token registration failed (${res.status})`);
  }
}

export async function setupNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted'
    ? { status: existing }
    : await Notifications.requestPermissionsAsync();

  if (status !== 'granted') return null;

  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    console.warn('EXPO_PUBLIC_EAS_PROJECT_ID not set — skipping push token registration');
    return null;
  }

  let token: string;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    token = data;
  } catch (err) {
    console.warn('Failed to get push token:', err);
    return null;
  }

  // Avoid re-registering if the token hasn't changed since last launch
  const cachedToken = await SecureStore.getItemAsync(PUSH_TOKEN_KEY).catch(() => null);
  if (cachedToken === token) return token;

  // Register with the server
  try {
    await registerTokenWithServer(token);
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token).catch(() => {});
  } catch (err) {
    console.warn('Failed to register push token with server:', err);
    // Non-fatal — will retry on next launch
  }

  return token;
}

// Call this after a successful sign-in to ensure the token is registered
// even if the user was not logged in when setupNotifications() first ran.
export async function registerStoredTokenAfterLogin(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY).catch(() => null);
    if (!token) return;
    await registerTokenWithServer(token);
  } catch { /* ignore */ }
}
