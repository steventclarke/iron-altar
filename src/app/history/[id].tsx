import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { exerciseRepository } from '@/data/repositories/exercise-repository';
import { sessionRepository } from '@/data/repositories/session-repository';
import { formatCalendarDate } from '@/domain/date';
import { groupSetsByExercise } from '@/domain/session';
import { formatWeight } from '@/domain/units';
import { useProfileStore } from '@/state/profile-store';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const unitPref = useProfileStore((s) => s.profile?.unitPref ?? 'kg');

  const session = id ? sessionRepository.byId(id) : null;

  if (!session) {
    return (
      <Screen>
        <NavBar />
        <PixelText variant="heading">SESSION NOT FOUND</PixelText>
        <PixelButton label="Back to History" onPress={() => router.back()} />
      </Screen>
    );
  }

  const sets = sessionRepository.setsForSession(session.id);
  const groups = groupSetsByExercise(sets);

  return (
    <Screen>
      <NavBar />

      <View style={styles.header}>
        <PixelText variant="heading">{formatCalendarDate(session.date)}</PixelText>
        <PixelText variant="caption" color={Palette.textSecondary}>
          {formatWeight(session.totalVolumeKg, unitPref)} tonnage · {session.xpEarned.toFixed(0)} XP
        </PixelText>
        {!session.startedAt && (
          <PixelText variant="caption" color={Palette.gold}>
            Retroactive entry
          </PixelText>
        )}
      </View>

      {session.notes && (
        <Panel>
          <PixelText variant="label" color={Palette.textSecondary}>
            Notes
          </PixelText>
          <PixelText variant="body">{session.notes}</PixelText>
        </Panel>
      )}

      {groups.length === 0 ? (
        <Panel>
          <PixelText variant="body" color={Palette.textSecondary}>
            This session has no sets.
          </PixelText>
        </Panel>
      ) : (
        groups.map((group) => (
          <Panel key={group.exerciseId}>
            <View style={styles.groupHeader}>
              <PixelText variant="body" color={Palette.gold}>
                {exerciseRepository.byId(group.exerciseId)?.name ?? 'Unknown'}
              </PixelText>
              <PixelText variant="caption" color={Palette.textSecondary}>
                {group.workingSetCount} working
              </PixelText>
            </View>

            {group.rows.map((row) => (
              <View key={`${row.weightKg}-${row.isWarmup}`} style={styles.row}>
                <PixelText
                  variant="body"
                  color={row.isWarmup ? Palette.textMuted : Palette.text}
                  style={styles.rowWeight}
                >
                  {formatWeight(row.weightKg, unitPref)}
                  {row.isWarmup ? ' (warmup)' : ''}
                </PixelText>
                <PixelText variant="body" color={Palette.text}>
                  {row.reps.join(', ')}
                </PixelText>
              </View>
            ))}
          </Panel>
        ))
      )}

      <PixelButton label="Back to History" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowWeight: {
    flex: 1,
  },
});
