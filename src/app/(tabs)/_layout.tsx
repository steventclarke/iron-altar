import { Tabs } from 'expo-router/js-tabs';

import { Palette } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Palette.void },
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'SESSION' }} />
      <Tabs.Screen name="history" options={{ title: 'HISTORY' }} />
      <Tabs.Screen name="progress" options={{ title: 'PROGRESS' }} />
      <Tabs.Screen name="profile" options={{ title: 'PROFILE' }} />
    </Tabs>
  );
}
