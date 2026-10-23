import { router } from 'expo-router';

import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { RestTimer } from '@/ui/rest-timer';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';
import { Palette } from '@/constants/theme';

export default function RestTimerScreen() {
  return (
    <Screen header={<NavBar />}>
      <PixelText variant="heading">REST TIMER</PixelText>
      <PixelText variant="caption" color={Palette.textSecondary}>
        The countdown keeps running when you leave this screen.
      </PixelText>
      <RestTimer />
      <PixelButton label="Back to Session" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
