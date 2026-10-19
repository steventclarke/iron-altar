import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { Fonts, Palette } from '@/constants/theme';

function TabGlyph({ focused }: { focused: boolean }) {
  return <View style={[styles.glyph, focused ? styles.glyphFocused : styles.glyphIdle]} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: Palette.void },
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Palette.gold,
        tabBarInactiveTintColor: Palette.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => <TabGlyph focused={focused} />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'GYM' }} />
      <Tabs.Screen name="history" options={{ title: 'HISTORY' }} />
      <Tabs.Screen name="progress" options={{ title: 'PROGRESS' }} />
      <Tabs.Screen name="profile" options={{ title: 'PROFILE' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Palette.surface,
    borderTopColor: Palette.border,
    borderTopWidth: 3,
    paddingTop: 6,
  },
  tabLabel: {
    fontFamily: Fonts.display,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  glyph: {
    width: 10,
    height: 10,
    borderWidth: 2,
  },
  glyphFocused: {
    backgroundColor: Palette.gold,
    borderColor: Palette.goldDim,
  },
  glyphIdle: {
    backgroundColor: Palette.border,
    borderColor: Palette.borderBright,
  },
});
