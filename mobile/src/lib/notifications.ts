import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { supabase } from './supabase';

const PUSH_TOKEN_KEY = 'expo_push_token_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
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

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  if (!projectId) {
    console.warn('EAS project ID not found — skipping push token registration');
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

type NotificationRouter = { push: (href: any) => void };

// Website paths a push's `data.url` can point at that the app has no screen
// for — open these in the system browser instead of trying to route to them.
const WEB_ONLY_PATHS = new Set(['/admin']);

function resolveNotificationUrl(url: string): { type: 'app' | 'web'; path: string } {
  if (WEB_ONLY_PATHS.has(url)) return { type: 'web', path: url };
  if (url === '/orders') return { type: 'app', path: '/(tabs)/orders' };
  return { type: 'app', path: '/(tabs)' };
}

function handleNotificationUrl(router: NotificationRouter, url: unknown): void {
  if (typeof url !== 'string' || !url) return;
  const target = resolveNotificationUrl(url);
  if (target.type === 'web') {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (apiUrl) Linking.openURL(`${apiUrl}${target.path}`).catch(() => {});
    return;
  }
  router.push(target.path);
}

/**
 * Routes to wherever a tapped push notification's `url` payload points
 * (mapping known website paths to their app screen, and opening web-only
 * paths like /admin in the system browser since the app has no such screen).
 * Also handles the app being launched cold by a notification tap. Call once
 * from the root layout; returns a cleanup function.
 */
export function addNotificationResponseListener(router: NotificationRouter): () => void {
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      handleNotificationUrl(router, response.notification.request.content.data?.url);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    })
    .catch(() => {});

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationUrl(router, response.notification.request.content.data?.url);
  });

  return () => subscription.remove();
}

// Call this on sign-out so the token is not delivered to the wrong user on
// the same device. Deregisters from the server AND clears the local cache.
export async function clearPushToken(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync(PUSH_TOKEN_KEY).catch(() => null);
    if (token) {
      // Best-effort server deregistration — don't block sign-out if it fails
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const { data: { session } } = await supabase.auth.getSession();
      if (apiUrl && session?.access_token) {
        await fetch(`${apiUrl}/api/push-subscribe`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpoint: token }),
        }).catch(() => {});
      }
    }
  } catch { /* ignore — local clear must still happen */ }
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY).catch(() => {});
}
