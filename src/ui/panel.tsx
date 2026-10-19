import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Border, Palette, Radius, Spacing } from '@/constants/theme';

type PanelProps = {
  children: ReactNode;
  /** Brighter border for emphasis. */
  highlight?: boolean;
  style?: ViewStyle;
};

export function Panel({ children, highlight = false, style }: PanelProps) {
  return <View style={[styles.panel, highlight && styles.highlight, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Palette.surface,
    borderColor: Palette.border,
    borderWidth: Border.thick,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  highlight: {
    borderColor: Palette.goldDim,
  },
});
