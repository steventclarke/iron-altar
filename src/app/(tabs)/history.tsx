import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette } from '@/constants/theme';

export default function HistoryScreen() {
  return (
    <Screen>
      <PixelText variant="heading">WORKOUT HISTORY</PixelText>
      <Panel>
        <PixelText variant="body" color={Palette.textSecondary}>
          No workouts logged yet. Your completed sessions will appear here.
        </PixelText>
      </Panel>
    </Screen>
  );
}
