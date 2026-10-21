import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/ui/avatar';
import { PixelButton } from '@/ui/button';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette, Spacing } from '@/constants/theme';
import { addCalendarDays, formatCalendarDate, todayCalendarDate } from '@/domain/date';
import { stageInfoForXp } from '@/domain/xp';
import { useProfileStore } from '@/state/profile-store';
import { useSessionStore } from '@/state/session-store';

export default function DungeonGymScreen() {
  const profile = useProfileStore((s) => s.profile);
  const active = useSessionStore((s) => s.active);
  const startSession = useSessionStore((s) => s.start);

  if (!profile) {
    return (
      <Screen>
        <PixelText variant="title">IRON ALTAR</PixelText>
        <Panel highlight>
          <PixelText variant="body" color={Palette.textSecondary}>
            No warrior yet. Forge your profile to begin the path of Milo.
          </PixelText>
          <PixelButton label="Forge Profile" onPress={() => router.push('/profile')} />
        </Panel>
      </Screen>
    );
  }

  const stage = stageInfoForXp(profile.xp);

  const openActiveSession = () => {
    const current = useSessionStore.getState().active;
    if (current) router.push(`/session/${current.id}`);
  };

  const beginWorkout = () => {
    startSession();
    openActiveSession();
  };

  const beginPastWorkout = () => {
    startSession(addCalendarDays(todayCalendarDate(), -1));
    openActiveSession();
  };

  return (
    <Screen>
      <PixelText variant="title">DUNGEON GYM</PixelText>

      <Panel highlight style={styles.avatarPanel}>
        <Avatar stageIndex={stage.index} />
        <PixelText variant="heading" color={Palette.gold}>
          {stage.name}
        </PixelText>
        <PixelText variant="caption" color={Palette.textSecondary}>
          Stage {stage.index + 1} / 10
        </PixelText>
      </Panel>

      <Panel>
        <StatRow label="XP" value={`${profile.xp} / 1000`} />
        <StatRow label="Streak" value="0 weeks" />
        <StatRow label="Trend" value="—" />
      </Panel>

      {active ? (
        <Panel highlight>
          <PixelText variant="label" color={Palette.gold}>
            Work In Progress
          </PixelText>
          <PixelText variant="body" color={Palette.textSecondary}>
            {formatCalendarDate(active.date)} · {active.sets.length} sets logged
          </PixelText>
          <PixelButton label="Resume Session" onPress={openActiveSession} />
        </Panel>
      ) : (
        <PixelButton label="Start Workout" onPress={beginWorkout} />
      )}

      {!active && (
        <PixelButton label="Log Past Workout" variant="secondary" onPress={beginPastWorkout} />
      )}
    </Screen>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <PixelText variant="label" color={Palette.textSecondary}>
        {label}
      </PixelText>
      <PixelText variant="body">{value}</PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarPanel: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
