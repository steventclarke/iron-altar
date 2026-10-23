import { router } from 'expo-router';

import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette } from '@/constants/theme';
import { formatCalendarDate } from '@/domain/date';
import { useProfileStore } from '@/state/profile-store';
import { useSessionStore } from '@/state/session-store';

export default function SessionHomeScreen() {
  const profile = useProfileStore((s) => s.profile);
  const active = useSessionStore((s) => s.active);
  const startSession = useSessionStore((s) => s.start);

  if (!profile) {
    return (
      <Screen header={<NavBar />}>
        <PixelText variant="title">SESSION</PixelText>
        <Panel highlight>
          <PixelText variant="body" color={Palette.textSecondary}>
            No warrior yet. Forge your profile to begin the path of Milo.
          </PixelText>
          <PixelButton label="Forge Profile" onPress={() => router.push('/profile')} />
        </Panel>
      </Screen>
    );
  }

  const openActiveSession = () => {
    const current = useSessionStore.getState().active;
    if (current) router.push(`/session/${current.id}`);
  };

  const beginWorkout = () => {
    startSession();
    openActiveSession();
  };

  return (
    <Screen header={<NavBar />}>
      <PixelText variant="title">SESSION</PixelText>
      <PixelText variant="body" color={Palette.textSecondary}>
        {active
          ? 'Resume your workout in progress.'
          : 'Start a workout. Use the date selector in the session log to backdate it.'}
      </PixelText>

      {active ? (
        <Panel highlight>
          <PixelText variant="label" color={Palette.gold}>
            WORK IN PROGRESS
          </PixelText>
          <PixelText variant="body" color={Palette.textSecondary}>
            {formatCalendarDate(active.date)} · {active.sets.length} sets logged
          </PixelText>
          <PixelButton label="Resume Session" onPress={openActiveSession} />
        </Panel>
      ) : (
        <PixelButton label="Start Workout" onPress={beginWorkout} />
      )}
    </Screen>
  );
}
