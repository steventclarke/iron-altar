import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { Border, Palette, Radius, Spacing } from '@/constants/theme';
import { PixelText } from '@/ui/text';

type Variant = 'primary' | 'secondary' | 'danger';

type PixelButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
};

const VARIANTS: Record<Variant, { bg: string; border: string; text: string }> = {
  primary: { bg: Palette.gold, border: Palette.goldDim, text: Palette.void },
  secondary: { bg: Palette.surfaceRaised, border: Palette.borderBright, text: Palette.text },
  danger: { bg: Palette.crimson, border: Palette.crimsonDim, text: Palette.text },
};

export function PixelButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: PixelButtonProps) {
  const v = VARIANTS[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <PixelText variant="label" color={v.text} style={styles.label}>
        {label}
      </PixelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: Border.thick,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textTransform: 'uppercase',
  },
  pressed: {
    transform: [{ translateY: 2 }],
  },
  disabled: {
    opacity: 0.4,
  },
});
