import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PixelButton } from '@/ui/button';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Fonts, FontSizes, Palette, Spacing } from '@/constants/theme';
import { sessionRepository } from '@/data/repositories/session-repository';
import { SEED_EXERCISES } from '@/data/seed/exercises';
import { formatWeight, fromDisplay, UNIT_LABEL } from '@/domain/units';
import { useProfileStore } from '@/state/profile-store';
import { useSessionStore } from '@/state/session-store';

const EXERCISES = SEED_EXERCISES.filter((e) => e.isMainLift);

export default function SessionScreen() {
  useLocalSearchParams<{ id: string }>();
  const profile = useProfileStore((s) => s.profile);
  const unitPref = profile?.unitPref ?? 'kg';
  const addXp = useProfileStore((s) => s.addXp);

  const active = useSessionStore((s) => s.active);
  const addSet = useSessionStore((s) => s.addSet);
  const removeSet = useSessionStore((s) => s.removeSet);
  const discard = useSessionStore((s) => s.discard);

  const [exerciseId, setExerciseId] = useState(EXERCISES[0]?.id ?? '');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [warmup, setWarmup] = useState(false);

  if (!active) {
    return (
      <Screen>
        <PixelText variant="heading">NO ACTIVE SESSION</PixelText>
        <PixelButton label="Back to Gym" onPress={() => router.back()} />
      </Screen>
    );
  }

  const volumeKg = useSessionStore.getState().totalVolumeKg();
  const xp = useSessionStore.getState().xpEarned();

  const submitSet = () => {
    const parsedWeight = Number.parseFloat(weight || '0');
    const parsedReps = Number.parseInt(reps || '0', 10);
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) return;
    addSet({
      exerciseId,
      weightKg: fromDisplay(Number.isFinite(parsedWeight) ? parsedWeight : 0, unitPref),
      reps: parsedReps,
      isWarmup: warmup,
    });
    setWeight('');
    setReps('');
  };

  const finish = () => {
    sessionRepository.complete(active);
    if (xp > 0) addXp(xp);
    discard();
    router.back();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <PixelText variant="heading">SESSION LOG</PixelText>
        <PixelText variant="caption" color={Palette.textSecondary}>
          {volumeKg.toFixed(0)} kg · {xp.toFixed(0)} XP
        </PixelText>
      </View>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Exercise
        </PixelText>
        <View style={styles.chips}>
          {EXERCISES.map((exercise) => (
            <Pressable key={exercise.id} onPress={() => setExerciseId(exercise.id)}>
              <View style={[styles.chip, exercise.id === exerciseId && styles.chipActive]}>
                <PixelText variant="caption">{exercise.name}</PixelText>
              </View>
            </Pressable>
          ))}
        </View>
      </Panel>

      <Panel>
        <View style={styles.inputRow}>
          <View style={styles.inputHalf}>
            <PixelText variant="label" color={Palette.textSecondary}>
              Weight ({UNIT_LABEL[unitPref]})
            </PixelText>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Palette.textMuted}
              style={styles.input}
            />
          </View>
          <View style={styles.inputHalf}>
            <PixelText variant="label" color={Palette.textSecondary}>
              Reps
            </PixelText>
            <TextInput
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={Palette.textMuted}
              style={styles.input}
            />
          </View>
        </View>

        <PixelButton
          label={warmup ? 'Warmup: On' : 'Warmup: Off'}
          variant={warmup ? 'primary' : 'secondary'}
          onPress={() => setWarmup((w) => !w)}
        />
        <PixelButton label="Log Set" onPress={submitSet} />
      </Panel>

      {active.sets.length > 0 && (
        <Panel>
          <PixelText variant="label" color={Palette.textSecondary}>
            Logged Sets
          </PixelText>
          {active.sets.map((set) => {
            const exercise = SEED_EXERCISES.find((e) => e.id === set.exerciseId);
            return (
              <View key={set.id} style={styles.setRow}>
                <PixelText variant="body">
                  {exercise?.name ?? 'Unknown'} · {formatWeight(set.weightKg, unitPref)} x{' '}
                  {set.reps}
                  {set.isWarmup ? ' (warmup)' : ''}
                </PixelText>
                <Pressable onPress={() => removeSet(set.id)}>
                  <PixelText variant="label" color={Palette.danger}>
                    X
                  </PixelText>
                </Pressable>
              </View>
            );
          })}
        </Panel>
      )}

      <PixelButton label="Finish Workout" onPress={finish} />
      <PixelButton label="Discard" variant="danger" onPress={discard} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderColor: Palette.border,
    borderWidth: 3,
    borderRadius: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    backgroundColor: Palette.surfaceRaised,
  },
  chipActive: {
    borderColor: Palette.gold,
    backgroundColor: Palette.surfacePressed,
  },
  inputRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  inputHalf: {
    flex: 1,
    gap: Spacing.one,
  },
  input: {
    backgroundColor: Palette.void,
    borderColor: Palette.border,
    borderWidth: 3,
    borderRadius: 2,
    color: Palette.text,
    fontFamily: Fonts.body,
    fontSize: FontSizes.lg,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
