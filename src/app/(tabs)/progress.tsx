import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette } from '@/constants/theme';
import type { MainLift } from '@/domain/types';

const MAIN_LIFTS: { id: MainLift; label: string }[] = [
  { id: 'squat', label: 'Squat' },
  { id: 'bench', label: 'Bench' },
  { id: 'deadlift', label: 'Deadlift' },
  { id: 'overhead_press', label: 'Overhead Press' },
  { id: 'power_clean', label: 'Power Clean' },
];

export default function ProgressScreen() {
  return (
    <Screen>
      <PixelText variant="heading">PROGRESS</PixelText>

      {MAIN_LIFTS.map((lift) => (
        <Panel key={lift.id}>
          <PixelText variant="subheading">{lift.label}</PixelText>
          <PixelText variant="caption" color={Palette.textMuted}>
            Not enough data yet.
          </PixelText>
        </Panel>
      ))}

      <Panel>
        <PixelText variant="subheading">Body Weight</PixelText>
        <PixelText variant="caption" color={Palette.textMuted}>
          No entries yet.
        </PixelText>
      </Panel>
    </Screen>
  );
}
