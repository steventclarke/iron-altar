import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PixelButton } from '@/ui/button';
import { EntryDateStepper } from '@/ui/date-stepper';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { RestTimer } from '@/ui/rest-timer';
import { PixelText } from '@/ui/text';
import { Fonts, FontSizes, Palette, Spacing } from '@/constants/theme';
import { exerciseRepository } from '@/data/repositories/exercise-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { groupSetsByExercise, type ExerciseGroup, type WeightRow } from '@/domain/session';
import { formatWeight, fromDisplay, UNIT_LABEL } from '@/domain/units';
import { useProfileStore } from '@/state/profile-store';
import { useRestTimer } from '@/state/rest-timer-store';
import { useSessionStore } from '@/state/session-store';

export default function SessionScreen() {
  useLocalSearchParams<{ id: string }>();
  const profile = useProfileStore((s) => s.profile);
  const unitPref = profile?.unitPref ?? 'kg';
  const addXp = useProfileStore((s) => s.addXp);

  const active = useSessionStore((s) => s.active);
  const addSet = useSessionStore((s) => s.addSet);
  const removeSet = useSessionStore((s) => s.removeSet);
  const updateSet = useSessionStore((s) => s.updateSet);
  const duplicateSet = useSessionStore((s) => s.duplicateSet);
  const setEntryDate = useSessionStore((s) => s.setEntryDate);
  const discard = useSessionStore((s) => s.discard);
  const startRest = useRestTimer((s) => s.start);
  const restDuration = useRestTimer((s) => s.durationSeconds);

  const exercises = exerciseRepository.all();
  const mainLifts = exercises.filter((e) => e.isMainLift);
  const accessories = exercises.filter((e) => !e.isMainLift);

  const [exerciseId, setExerciseId] = useState(mainLifts[0]?.id ?? exercises[0]?.id ?? '');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [warmup, setWarmup] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!active) {
    return (
      <Screen>
        <NavBar />
        <PixelText variant="heading">NO ACTIVE SESSION</PixelText>
        <PixelButton label="Back to Gym" onPress={() => router.back()} />
      </Screen>
    );
  }

  const volumeKg = useSessionStore.getState().totalVolumeKg();
  const xp = useSessionStore.getState().xpEarned();
  const lastSet = active.sets.length > 0 ? active.sets[active.sets.length - 1] : null;
  const groups = groupSetsByExercise(active.sets);

  const submitSet = () => {
    const parsedWeight = Number.parseFloat(weight || '0');
    const parsedReps = Number.parseInt(reps || '0', 10);
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) {
      setError('Weight must be 0 or more.');
      return;
    }
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      setError('Reps must be 1 or more.');
      return;
    }
    setError(null);
    addSet({
      exerciseId,
      weightKg: fromDisplay(parsedWeight, unitPref),
      reps: parsedReps,
      isWarmup: warmup,
      notes: notes.trim() || undefined,
    });
    setWeight('');
    setReps('');
    setNotes('');
    startRest(restDuration);
  };

  const finish = () => {
    sessionRepository.complete(active);
    if (xp > 0) addXp(xp);
    discard();
    router.back();
  };

  return (
    <Screen>
      <NavBar />

      <View style={styles.header}>
        <PixelText variant="heading">SESSION LOG</PixelText>
        <PixelText variant="caption" color={Palette.textSecondary}>
          {formatWeight(volumeKg, unitPref)} tonnage · {xp.toFixed(0)} XP
        </PixelText>
      </View>

      <RestTimer />

      <Panel>
        <EntryDateStepper date={active.date} onChange={setEntryDate} />
      </Panel>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Exercise
        </PixelText>
        <View style={styles.chips}>
          {[...mainLifts, ...accessories].map((exercise) => (
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

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes (RPE, form, superset...)"
          placeholderTextColor={Palette.textMuted}
          style={styles.input}
        />

        <PixelButton
          label={warmup ? 'Warmup: On' : 'Warmup: Off'}
          variant={warmup ? 'primary' : 'secondary'}
          onPress={() => setWarmup((w) => !w)}
        />
        {error && (
          <PixelText variant="caption" color={Palette.danger}>
            {error}
          </PixelText>
        )}
        <PixelButton label="Log Set" onPress={submitSet} />
        {lastSet && (
          <PixelButton
            label="Repeat Last Set"
            variant="secondary"
            onPress={() => duplicateSet(lastSet.id)}
          />
        )}
      </Panel>

      {groups.length > 0 && (
        <Panel>
          <PixelText variant="label" color={Palette.textSecondary}>
            Logged Sets
          </PixelText>
          {groups.map((group) => (
            <ExerciseGroupBlock
              key={group.exerciseId}
              group={group}
              unitPref={unitPref}
              onDuplicate={duplicateSet}
              onRemove={removeSet}
              onUpdateReps={(setId, nextReps) => updateSet(setId, { reps: nextReps })}
            />
          ))}
        </Panel>
      )}

      <PixelButton label="Finish Workout" onPress={finish} />
      <PixelButton
        label="Discard"
        variant="danger"
        onPress={() => {
          discard();
          router.back();
        }}
      />
    </Screen>
  );
}

function ExerciseGroupBlock({
  group,
  unitPref,
  onDuplicate,
  onRemove,
  onUpdateReps,
}: {
  group: ExerciseGroup;
  unitPref: 'kg' | 'lb' | 'st';
  onDuplicate: (setId: string) => void;
  onRemove: (setId: string) => void;
  onUpdateReps: (setId: string, reps: number) => void;
}) {
  const exercise = exerciseRepository.byId(group.exerciseId);
  const name = exercise?.name ?? 'Unknown';
  const count = group.workingSetCount;

  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <PixelText variant="body" color={Palette.gold} style={styles.setText}>
          {name}
        </PixelText>
        <PixelText variant="caption" color={Palette.textSecondary}>
          {count} {count === 1 ? 'set' : 'sets'}
        </PixelText>
      </View>

      {group.rows.map((row) => (
        <WeightRowLine
          key={`${row.weightKg}-${row.isWarmup}`}
          row={row}
          unitPref={unitPref}
          onDuplicate={onDuplicate}
          onRemove={onRemove}
          onUpdateReps={onUpdateReps}
        />
      ))}
    </View>
  );
}

function WeightRowLine({
  row,
  unitPref,
  onDuplicate,
  onRemove,
  onUpdateReps,
}: {
  row: WeightRow;
  unitPref: 'kg' | 'lb' | 'st';
  onDuplicate: (setId: string) => void;
  onRemove: (setId: string) => void;
  onUpdateReps: (setId: string, reps: number) => void;
}) {
  return (
    <View style={styles.row}>
      <PixelText variant="body" color={row.isWarmup ? Palette.textMuted : Palette.text}>
        {formatWeight(row.weightKg, unitPref)}
        {row.isWarmup ? ' (warmup)' : ''}
      </PixelText>

      <View style={styles.repsRow}>
        {row.reps.map((repCount, index) => (
          <RepField
            key={row.setIds[index]}
            reps={repCount}
            onCommit={(next) => onUpdateReps(row.setIds[index], next)}
          />
        ))}
      </View>

      <View style={styles.setActions}>
        <Pressable onPress={() => onDuplicate(row.setIds[row.setIds.length - 1])} hitSlop={Spacing.two}>
          <PixelText variant="heading" color={Palette.gold}>
            +
          </PixelText>
        </Pressable>
        <Pressable onPress={() => onRemove(row.setIds[row.setIds.length - 1])} hitSlop={Spacing.two}>
          <PixelText variant="label" color={Palette.danger}>
            X
          </PixelText>
        </Pressable>
      </View>
    </View>
  );
}

function RepField({ reps, onCommit }: { reps: number; onCommit: (next: number) => void }) {
  const [text, setText] = useState(String(reps));

  const commit = () => {
    const parsed = Number.parseInt(text, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      if (parsed !== reps) onCommit(parsed);
      setText(String(parsed));
    } else {
      setText(String(reps));
    }
  };

  return (
    <View style={styles.repField}>
      <PixelText variant="caption" color={Palette.textSecondary}>
        x
      </PixelText>
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        selectTextOnFocus
        style={styles.repInput}
      />
    </View>
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
  group: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: Palette.border,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  setText: {
    flex: 1,
  },
  repsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  repField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  repInput: {
    minWidth: 40,
    textAlign: 'center',
    backgroundColor: Palette.void,
    borderColor: Palette.border,
    borderWidth: 2,
    borderRadius: 2,
    color: Palette.text,
    fontFamily: Fonts.body,
    fontSize: FontSizes.md,
    paddingHorizontal: Spacing.one,
    paddingVertical: 0,
  },
  setActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
});
