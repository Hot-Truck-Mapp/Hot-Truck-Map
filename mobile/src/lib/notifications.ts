import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  // Store token in user metadata — no extra table needed
  await supabase.auth.updateUser({ data: { push_token: token } });

  return token;
}

// OneSignal note: to migrate from the web's react-onesignal setup, replace
// getExpoPushTokenAsync above with OneSignal.initialize() + getDeviceState()
// using the react-native-onesignal package.
