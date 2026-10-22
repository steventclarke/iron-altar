import { Pressable, StyleSheet, View } from 'react-native';

import { PixelText } from '@/ui/text';
import { Border, Palette, Radius, Spacing } from '@/constants/theme';

type ValueStepperProps = {
  label: string;
  value: number;
  /** Rendered value (defaults to the zero-padded number). */
  display?: string;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  /** Disable increment (or decrement) when at the bound. */
  canIncrement?: boolean;
  canDecrement?: boolean;
};

/**
 * Two-button (up/down) numeric stepper used for the rest-timer minute and
 * second fields. The pixel up/down arrows are reliable taps on every platform,
 * unlike native wheels, and keep the 8-bit look.
 */
export function ValueStepper({
  label,
  value,
  display,
  onChange,
  step = 1,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  canIncrement = true,
  canDecrement = true,
}: ValueStepperProps) {
  const bump = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)));

  return (
    <View style={styles.column}>
      <PixelText variant="caption" color={Palette.textSecondary}>
        {label}
      </PixelText>

      <StepArrow label="\u25B2" disabled={!canIncrement} onPress={() => bump(step)} />

      <View style={styles.valueBox}>
        <PixelText variant="title" color={Palette.gold} style={styles.valueText}>
          {display ?? String(value).padStart(2, '0')}
        </PixelText>
      </View>

      <StepArrow label="\u25BC" disabled={!canDecrement} onPress={() => bump(-step)} />
    </View>
  );
}

function StepArrow({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={Spacing.two}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <PixelText variant="body" color={Palette.text}>
        {label}
      </PixelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  arrow: {
    width: 64,
    paddingVertical: Spacing.one,
    borderWidth: Border.thick,
    borderRadius: Radius.sm,
    borderColor: Palette.borderBright,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
  },
  pressed: {
    backgroundColor: Palette.surfacePressed,
    transform: [{ translateY: 2 }],
  },
  disabled: {
    opacity: 0.35,
  },
  valueBox: {
    width: 64,
    paddingVertical: Spacing.one,
    borderWidth: Border.thick,
    borderRadius: Radius.sm,
    borderColor: Palette.border,
    backgroundColor: Palette.void,
    alignItems: 'center',
  },
  valueText: {
    lineHeight: 34,
  },
});
