import '@/global.css';

import { PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { VT323_400Regular } from '@expo-google-fonts/vt323';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { initializeDatabase } from '@/data/db/database';
import { seedDatabase } from '@/data/seed/seed';
import { installReportLogCapture } from '@/lib/report-log-buffer';
import { useAuthStore } from '@/state/auth-store';
import { useProfileStore } from '@/state/profile-store';
import { useRestTimer } from '@/state/rest-timer-store';
import { useSessionStore } from '@/state/session-store';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: 'welcome',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular, VT323_400Regular });
  const [dbReady, setDbReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initializeDatabase();
      installReportLogCapture();
      seedDatabase();
      useProfileStore.getState().hydrate();
      useSessionStore.getState().hydrate();
      useRestTimer.getState().hydrate();
      await useAuthStore.getState().hydrate();
      if (!cancelled) {
        setDbReady(true);
        setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = (fontsLoaded || fontError) && dbReady && authReady;
  const entered = status === 'signedIn' || status === 'anonymous';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Palette.void },
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="auth/callback" />
        <Stack.Protected guard={entered} redirectTo="/welcome">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="rest-timer" />
          <Stack.Screen name="history/[id]" />
          <Stack.Screen name="progress/[lift]" />
          <Stack.Screen name="progress/body-weight" />
          <Stack.Screen name="report" />
          <Stack.Screen name="logout" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}
