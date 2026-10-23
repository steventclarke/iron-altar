import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/ui/avatar';
import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Fonts, FontSizes, Palette, Spacing } from '@/constants/theme';
import { bodyWeightRepository } from '@/data/repositories/body-weight-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { formatCalendarDate } from '@/domain/date';
import { trainingSummary, trendDisplay } from '@/domain/gamification';
import { workingSetsByExercise } from '@/domain/progress';
import type { UnitPreference } from '@/domain/types';
import { formatWeight } from '@/domain/units';
import { stageInfoForXp, X_PER_WEEK_DECAY } from '@/domain/xp';
import { useProfileStore } from '@/state/profile-store';

const UNITS: UnitPreference[] = ['kg', 'lb', 'st'];

function loadStats() {
  const sets = sessionRepository.allSets();
  const counts = workingSetsByExercise(sets);
  const bodyWeight = bodyWeightRepository.latest();

  return {
    summary: trainingSummary(sessionRepository.all()),
    totalWorkingSets: Object.values(counts).reduce((total, count) => total + count, 0),
    bodyWeightKg: bodyWeight?.weightKg ?? null,
  };
}

export default function ProfileScreen() {
  const profile = useProfileStore((s) => s.profile);
  const createProfile = useProfileStore((s) => s.createProfile);
  const setUnitPref = useProfileStore((s) => s.setUnitPref);
  const reset = useProfileStore((s) => s.reset);
  const [name, setName] = useState('');
  const [stats, setStats] = useState(loadStats);

  useFocusEffect(
    useCallback(() => {
      setStats(loadStats());
    }, []),
  );

  if (!profile) {
    return (
      <Screen header={<NavBar />}>
        <PixelText variant="heading">FORGE YOUR PROFILE</PixelText>
        <Panel>
          <PixelText variant="label" color={Palette.textSecondary}>
            Name
          </PixelText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter name"
            placeholderTextColor={Palette.textMuted}
            style={styles.input}
          />
          <PixelButton label="Create" onPress={() => createProfile(name)} />
        </Panel>
      </Screen>
    );
  }

  const stage = stageInfoForXp(profile.xp);
  const trend = trendDisplay(stats.summary.trend);
  const trendColor =
    stats.summary.trend === 'up'
      ? Palette.xpUp
      : stats.summary.trend === 'down'
        ? Palette.xpDown
        : Palette.textSecondary;
  const progressPercent = Math.min(100, Math.max(0, Math.round(stage.withinStage * 100)));
  const xpToNext =
    stage.nextThreshold === null ? null : Math.ceil(stage.nextThreshold - profile.xp);

  return (
    <Screen header={<NavBar />}>
      <PixelText variant="heading">PROFILE</PixelText>

      <Panel highlight style={styles.avatarPanel}>
        <Avatar stageIndex={stage.index} unit={6} />
        <PixelText variant="subheading">{profile.name}</PixelText>
        <PixelText variant="caption" color={Palette.gold}>
          {stage.name} · {profile.xp} XP
        </PixelText>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${progressPercent}%` }]} />
        </View>
        <PixelText variant="caption" color={Palette.textSecondary}>
          {xpToNext === null || xpToNext <= 0
            ? 'Peak form reached.'
            : `${xpToNext} XP to the next stage`}
        </PixelText>
      </Panel>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Training
        </PixelText>
        <StatRow label="XP" value={`${profile.xp} / 1000`} />
        <StatRow
          label="Streak"
          value={`${stats.summary.streakWeeks} ${stats.summary.streakWeeks === 1 ? 'week' : 'weeks'}`}
        />
        <StatRow label="Trend" value={`${trend.symbol} ${trend.label}`} valueColor={trendColor} />
        <StatRow
          label="Body weight"
          value={
            stats.bodyWeightKg === null ? '—' : formatWeight(stats.bodyWeightKg, profile.unitPref)
          }
        />
        <StatRow label="Working sets" value={String(stats.totalWorkingSets)} />
        <StatRow
          label="Last trained"
          value={
            stats.summary.lastTrainingDate
              ? formatCalendarDate(stats.summary.lastTrainingDate)
              : '—'
          }
        />
      </Panel>

      <PixelText variant="caption" color={Palette.textMuted}>
        Miss a full week of training and Milo loses {X_PER_WEEK_DECAY} XP.
      </PixelText>

      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Units
        </PixelText>
        <View style={styles.unitRow}>
          {UNITS.map((unit) => (
            <PixelButton
              key={unit}
              label={unit.toUpperCase()}
              variant={profile.unitPref === unit ? 'primary' : 'secondary'}
              onPress={() => setUnitPref(unit)}
              style={styles.unitButton}
            />
          ))}
        </View>
      </Panel>

      <PixelButton label="Reset Profile" variant="danger" onPress={reset} />
    </Screen>
  );
}

function StatRow({
  label,
  value,
  valueColor = Palette.text,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statRow}>
      <PixelText variant="label" color={Palette.textSecondary}>
        {label}
      </PixelText>
      <PixelText variant="body" color={valueColor}>
        {value}
      </PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarPanel: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  xpTrack: {
    width: '100%',
    height: 8,
    backgroundColor: Palette.void,
    borderWidth: 2,
    borderColor: Palette.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: Palette.gold,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
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
  unitRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  unitButton: {
    flex: 1,
  },
});
