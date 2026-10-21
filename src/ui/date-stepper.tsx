import { Pressable, StyleSheet, View } from 'react-native';

import { PixelText } from '@/ui/text';
import { Border, Palette, Radius, Spacing } from '@/constants/theme';
import { addCalendarDays, formatCalendarDate, todayCalendarDate } from '@/domain/date';
import type { CalendarDate } from '@/domain/types';

type EntryDateStepperProps = {
  date: CalendarDate;
  onChange: (date: CalendarDate) => void;
};

/**
 * Pixel-styled performed-day picker: step a day at a time, with a one-tap
 * "Today" reset. Future dates are clamped out (you can't log a workout you
 * haven't done). Built as a stepper rather than a native date wheel to stay on
 * theme and work identically on iOS/Android/web.
 */
export function EntryDateStepper({ date, onChange }: EntryDateStepperProps) {
  const today = todayCalendarDate();
  const isToday = date === today;

  const shift = (days: number) => onChange(addCalendarDays(date, days));

  return (
    <View>
      <PixelText variant="label" color={Palette.textSecondary}>
        Entry Date
      </PixelText>

      <View style={styles.row}>
        <StepButton label="<" onPress={() => shift(-1)} />

        <View style={styles.dateBox}>
          <PixelText variant="label" color={isToday ? Palette.text : Palette.gold}>
            {formatCalendarDate(date)}
          </PixelText>
          {!isToday && (
            <PixelText variant="caption" color={Palette.textSecondary}>
              Retroactive
            </PixelText>
          )}
        </View>

        <StepButton label=">" disabled={isToday} onPress={() => shift(1)} />
      </View>

      {!isToday && (
        <Pressable onPress={() => onChange(today)} hitSlop={Spacing.two}>
          <PixelText variant="label" color={Palette.gold}>
            Today
          </PixelText>
        </Pressable>
      )}
    </View>
  );
}

function StepButton({
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
      style={({ pressed }) => [styles.step, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <PixelText variant="heading">{label}</PixelText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  step: {
    width: 44,
    borderWidth: Border.thick,
    borderRadius: Radius.sm,
    borderColor: Palette.borderBright,
    backgroundColor: Palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: Palette.surfacePressed,
    transform: [{ translateY: 2 }],
  },
  disabled: {
    opacity: 0.35,
  },
  dateBox: {
    flex: 1,
    borderWidth: Border.thick,
    borderRadius: Radius.sm,
    borderColor: Palette.border,
    backgroundColor: Palette.void,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    gap: 2,
  },
});
