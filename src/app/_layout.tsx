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
import { useProfileStore } from '@/state/profile-store';
import { useRestTimer } from '@/state/rest-timer-store';
import { useSessionStore } from '@/state/session-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular, VT323_400Regular });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initializeDatabase();
      seedDatabase();
      useProfileStore.getState().hydrate();
      useSessionStore.getState().hydrate();
      useRestTimer.getState().hydrate();
      if (!cancelled) setDbReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = (fontsLoaded || fontError) && dbReady;

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
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="history/[id]" />
        <Stack.Screen name="progress/[lift]" />
        <Stack.Screen name="progress/body-weight" />
      </Stack>
    </SafeAreaProvider>
  );
}
