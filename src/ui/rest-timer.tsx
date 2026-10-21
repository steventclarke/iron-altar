import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { PixelButton } from '@/ui/button';
import { Panel } from '@/ui/panel';
import { PixelText } from '@/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { REST_PRESETS, useRestTimer } from '@/state/rest-timer-store';

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

      <View style={styles.presets}>
        {REST_PRESETS.map((seconds) => (
          <PixelButton
            key={seconds}
            label={`${seconds / 60}m`}
            variant={durationSeconds === seconds && running ? 'primary' : 'secondary'}
            onPress={() => start(seconds)}
            style={styles.preset}
          />
        ))}
      </View>
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
  presets: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  preset: {
    flex: 1,
  },
});
