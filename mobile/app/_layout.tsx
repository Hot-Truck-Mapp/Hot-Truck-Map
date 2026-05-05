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
  const splashHidden = useRef(false);

  useEffect(() => {
    // Wait for auth to resolve and for the router to settle its initial segments
    if (loading || segments.length === 0) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Allow unauthenticated users to browse the map, truck list, and truck detail.
    // Only redirect to login if they are in a route that isn't public.
    // Currently all (tabs) routes and truck/[id] are public — auth is
    // enforced at action level (follow, order) inside those screens.
    if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }

    // Hide splash exactly once — after auth + segments are both resolved
    if (!splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => { /* already hidden */ });
    }
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
