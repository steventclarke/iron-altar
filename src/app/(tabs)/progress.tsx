import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { bodyWeightRepository } from '@/data/repositories/body-weight-repository';
import { exerciseRepository } from '@/data/repositories/exercise-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { formatWeight, toDisplay, UNIT_LABEL } from '@/domain/units';
import { liftProgress, workingSetsByExercise } from '@/domain/progress';
import type { MainLift } from '@/domain/types';
import { useProfileStore } from '@/state/profile-store';

type LiftSummary = {
  mainLift: MainLift;
  name: string;
  latestTopKg: number | null;
  workingSets: number;
  sessions: number;
};

type ProgressSummary = {
  lifts: LiftSummary[];
  bodyWeightKg: number | null;
  bodyWeightDeltaKg: number | null;
  bodyWeightEntries: number;
};

function loadSummary(): ProgressSummary {
  const sessions = sessionRepository.all();
  const sets = sessionRepository.allSets();
  const workingSets = workingSetsByExercise(sets);

  const lifts = exerciseRepository.mainLifts().flatMap((exercise): LiftSummary[] => {
    if (!exercise.mainLift) return [];
    const points = liftProgress(sessions, sets, exercise.id);
    const latest = points[points.length - 1];
    return [
      {
        mainLift: exercise.mainLift,
        name: exercise.name,
        latestTopKg: latest?.topWeightKg ?? null,
        workingSets: workingSets[exercise.id] ?? 0,
        sessions: points.length,
      },
    ];
  });

  const weights = bodyWeightRepository.all();
  const latest = weights[weights.length - 1];
  const previous = weights[weights.length - 2];

  return {
    lifts,
    bodyWeightKg: latest?.weightKg ?? null,
    bodyWeightDeltaKg: latest && previous ? latest.weightKg - previous.weightKg : null,
    bodyWeightEntries: weights.length,
  };
}

export default function ProgressScreen() {
  const unitPref = useProfileStore((s) => s.profile?.unitPref ?? 'kg');
  const [summary, setSummary] = useState<ProgressSummary>(loadSummary);

  useFocusEffect(
    useCallback(() => {
      setSummary(loadSummary());
    }, []),
  );

  const formatDelta = (deltaKg: number) => {
    const value = Number(toDisplay(deltaKg, unitPref).toFixed(1));
    return `${value > 0 ? '+' : ''}${value}${UNIT_LABEL[unitPref]}`;
  };

  return (
    <Screen>
      <PixelText variant="heading">PROGRESS</PixelText>

      {summary.lifts.map((lift) => (
        <Pressable
          key={lift.mainLift}
          onPress={() => router.push(`/progress/${lift.mainLift}`)}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Panel>
            <View style={styles.row}>
              <PixelText variant="subheading">{lift.name}</PixelText>
              <PixelText variant="label" color={Palette.gold}>
                VIEW
              </PixelText>
            </View>

            {lift.latestTopKg === null ? (
              <PixelText variant="caption" color={Palette.textMuted}>
                No working sets yet.
              </PixelText>
            ) : (
              <View style={styles.row}>
                <PixelText variant="caption" color={Palette.textSecondary}>
                  Top set {formatWeight(lift.latestTopKg, unitPref)}
                </PixelText>
                <PixelText variant="caption" color={Palette.textSecondary}>
                  {lift.workingSets} working sets · {lift.sessions}{' '}
                  {lift.sessions === 1 ? 'session' : 'sessions'}
                </PixelText>
              </View>
            )}
          </Panel>
        </Pressable>
      ))}

      <Pressable
        onPress={() => router.push('/progress/body-weight')}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        <Panel>
          <View style={styles.row}>
            <PixelText variant="subheading">Body Weight</PixelText>
            <PixelText variant="label" color={Palette.gold}>
              VIEW
            </PixelText>
          </View>

          {summary.bodyWeightKg === null ? (
            <PixelText variant="caption" color={Palette.textMuted}>
              No entries yet. Log your first weigh-in.
            </PixelText>
          ) : (
            <View style={styles.row}>
              <PixelText variant="caption" color={Palette.textSecondary}>
                {formatWeight(summary.bodyWeightKg, unitPref)}
              </PixelText>
              <PixelText variant="caption" color={Palette.textSecondary}>
                {summary.bodyWeightDeltaKg === null
                  ? `${summary.bodyWeightEntries} entries`
                  : `${formatDelta(summary.bodyWeightDeltaKg)} since last`}
              </PixelText>
            </View>
          )}
        </Panel>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
