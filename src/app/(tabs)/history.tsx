import { useFocusEffect, router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette } from '@/constants/theme';
import { formatCalendarDate } from '@/domain/date';
import { formatWeight } from '@/domain/units';
import { useProfileStore } from '@/state/profile-store';
import { useHistoryStore } from '@/state/history-store';

export default function HistoryScreen() {
  const unitPref = useProfileStore((s) => s.profile?.unitPref ?? 'kg');
  const summaries = useHistoryStore((s) => s.summaries);
  const refresh = useHistoryStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return (
    <Screen>
      <PixelText variant="heading">WORKOUT HISTORY</PixelText>

      {summaries.length === 0 ? (
        <Panel>
          <PixelText variant="body" color={Palette.textSecondary}>
            No workouts logged yet. Your completed sessions will appear here.
          </PixelText>
        </Panel>
      ) : (
        summaries.map(({ session, exerciseNames, workingSetCount }) => (
          <Pressable
            key={session.id}
            onPress={() => router.push(`/history/${session.id}`)}
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Panel>
              <View style={styles.cardHeader}>
                <PixelText variant="body" color={Palette.gold}>
                  {formatCalendarDate(session.date)}
                </PixelText>
                <PixelText variant="caption" color={Palette.textSecondary}>
                  {workingSetCount} {workingSetCount === 1 ? 'set' : 'sets'}
                </PixelText>
              </View>

              <PixelText variant="caption" color={Palette.text}>
                {exerciseNames.join(' · ') || 'No sets'}
              </PixelText>

              <View style={styles.cardStats}>
                <PixelText variant="caption" color={Palette.textSecondary}>
                  {formatWeight(session.totalVolumeKg, unitPref)} tonnage
                </PixelText>
                <PixelText variant="caption" color={Palette.textSecondary}>
                  {session.xpEarned.toFixed(0)} XP
                </PixelText>
              </View>
            </Panel>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
