import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, MaxContentWidth, Palette, Spacing } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Fixed header rendered above the scroll area (e.g. the navigation bar). */
  header?: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Extra bottom padding to clear the tab bar. */
  bottomInset?: boolean;
  contentStyle?: ViewStyle;
};

export function Screen({
  children,
  header,
  scroll = true,
  bottomInset = true,
  contentStyle,
}: ScreenProps) {
  const padding = [
    styles.content,
    bottomInset && { paddingBottom: BottomTabInset + Spacing.four },
    contentStyle,
  ];

  const headerNode = header ? <View style={styles.header}>{header}</View> : null;

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {headerNode}
        <View style={[styles.content, styles.flex, padding]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {headerNode}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Palette.void,
  },
  flex: {
    flex: 1,
  },
  header: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
