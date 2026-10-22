import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { PixelButton } from '@/ui/button';
import { Panel } from '@/ui/panel';
import { PixelText } from '@/ui/text';
import { ValueStepper } from '@/ui/value-stepper';
import { Palette, Spacing } from '@/constants/theme';
import { MAX_REST_SECONDS, MIN_REST_SECONDS, useRestTimer } from '@/state/rest-timer-store';

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function RestTimer() {
  const durationSeconds = useRestTimer((s) => s.durationSeconds);
  const remainingSeconds = useRestTimer((s) => s.remainingSeconds);
  const finished = useRestTimer((s) => s.finished);
  const endsAt = useRestTimer((s) => s.endsAt);
  const setDuration = useRestTimer((s) => s.setDuration);
  const start = useRestTimer((s) => s.start);
  const stop = useRestTimer((s) => s.stop);
  const tick = useRestTimer((s) => s.tick);

  const running = endsAt !== null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, 250);
    tick();
    return () => clearInterval(id);
  }, [running, tick]);

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  const setMinutes = (next: number) =>
    setDuration(Math.min(MAX_REST_SECONDS, Math.max(0, next * 60 + seconds)));
  const setSeconds = (next: number) =>
    setDuration(Math.min(MAX_REST_SECONDS, Math.max(0, minutes * 60 + next)));

  return (
    <Panel>
      <View style={styles.row}>
        <PixelText variant="label" color={Palette.textSecondary}>
          Rest Timer
        </PixelText>
        {running && (
          <PixelButton label="Stop" variant="secondary" onPress={stop} style={styles.stopButton} />
        )}
      </View>

      <PixelText
        variant="title"
        color={finished ? Palette.success : running ? Palette.gold : Palette.text}
      >
        {finished ? 'REST OVER' : formatSeconds(running ? remainingSeconds : durationSeconds)}
      </PixelText>

      <View style={styles.steppers}>
        <ValueStepper
          label="MIN"
          value={minutes}
          onChange={setMinutes}
          canIncrement={durationSeconds + 60 <= MAX_REST_SECONDS}
          canDecrement={durationSeconds - 60 >= MIN_REST_SECONDS}
        />
        <ValueStepper
          label="SEC"
          value={seconds}
          display={String(seconds).padStart(2, '0')}
          step={5}
          onChange={setSeconds}
          canIncrement={durationSeconds + 5 <= MAX_REST_SECONDS}
          canDecrement={durationSeconds - 5 >= MIN_REST_SECONDS}
        />
      </View>

      <PixelButton
        label={running ? 'Restart' : 'Start Rest'}
        onPress={() => start(durationSeconds)}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stopButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  steppers: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
});
