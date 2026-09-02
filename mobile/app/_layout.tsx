/* eslint-disable import/first --
 * enableScreens(false) is deliberately called next to its own import, above the
 * rest of the import block, so the crash workaround below stays legible as one
 * unit. Metro/Babel hoist every require above top-level statements, so the call
 * runs after all imports either way; moving it would only separate it from the
 * comment explaining it.
 */
import { enableScreens } from 'react-native-screens';
// Workaround: RNSTabBarController.updateTabBarAppearance throws an uncaught
// NSException on A18 Pro devices (iPhone 16 Pro/Max) running iOS 26, crashing
// production builds. Disabling native screens bypasses the faulty UIKit path.
// Track: https://github.com/software-mansion/react-native-screens/issues/3940
enableScreens(false);

import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { setupNotifications, registerStoredTokenAfterLogin, clearPushToken } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

function AuthGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const splashHidden = useRef(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  // Check onboarding status — re-check whenever segments change so that
  // completing onboarding (writing to SecureStore then navigating) doesn't
  // get overridden by stale state in AuthGuard.
  useEffect(() => {
    SecureStore.getItemAsync('onboarding_complete')
      .then((val) => {
        setOnboardingComplete(val === 'true');
      })
      .catch(() => {
        setOnboardingComplete(true);
      })
      .finally(() => setOnboardingChecked(true));
  }, [segments]);

  useEffect(() => {
    // Wait for auth, router segments, and onboarding check to all be ready
    if (loading || !segments[0] || !onboardingChecked) return;

    // Redirect to onboarding if not yet completed
    if (!onboardingComplete && (segments[0] as string) !== 'onboarding') {
      router.replace('/onboarding');
      if (!splashHidden.current) {
        splashHidden.current = true;
        SplashScreen.hideAsync().catch(() => { /* already hidden */ });
      }
      return;
    }

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
  }, [session, loading, segments, onboardingChecked, onboardingComplete]);

  return null;
}

export default function RootLayout() {
  useEffect(() => {
    setupNotifications().catch(() => { /* ignore — push notifications are non-critical */ });

    // Register any cached push token that wasn't sent on first launch because
    // the user wasn't signed in yet.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        registerStoredTokenAfterLogin().catch(() => {});
      } else if (event === 'SIGNED_OUT') {
        // Server-initiated sign-outs (token expiry, password change on another device)
        // must also clear the push token so notifications don't reach the wrong user.
        clearPushToken().catch(() => {});
      }
    });

    // Safety valve — always hide splash within 5 s even if auth hangs
    const t = setTimeout(() => SplashScreen.hideAsync(), 5000);
    return () => {
      subscription.unsubscribe();
      clearTimeout(t);
    };
  }, []);

  return (
    <>
      {/* "auto" matches each screen's background — light bg gets dark icons,
          dark bg (onboarding) gets light icons. Individual screens can still
          override with <StatusBar style="light" /> when needed. */}
      <StatusBar style="auto" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="truck/[id]"
          options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="catering/[id]"
          options={{ headerShown: true, title: 'Catering Request', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="events/index"
          options={{ headerShown: true, title: 'Events', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="events/[state]"
          options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="event/[id]"
          options={{ headerShown: true, title: '', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="about"
          options={{ headerShown: true, title: 'About', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
