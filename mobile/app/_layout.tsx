import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '@/hooks/useAuth';
import { setupNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

function AuthGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }

    SplashScreen.hideAsync();
  }, [session, loading, segments]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    setupNotifications().catch(() => { /* ignore — push notifications are non-critical */ });
    // Safety valve — always hide splash within 5 s even if auth hangs
    const t = setTimeout(() => SplashScreen.hideAsync(), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="truck/[id]"
          options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
