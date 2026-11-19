import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { finishSignOut } from '@/auth/client';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/state/auth-store';
import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';

export default function LogoutScreen() {
  const clear = useAuthStore((s) => s.clear);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      await clear();
      await finishSignOut();
      router.replace('/welcome');
    })();
  }, [clear]);

  return (
    <Screen header={<NavBar />}>
      <PixelText variant="heading">SIGNING OUT</PixelText>
      <Panel>
        <PixelText variant="body" color={Palette.textSecondary}>
          Clearing this session. Your training data stays on this device.
        </PixelText>
      </Panel>
      <PixelButton label="Back to welcome" onPress={() => router.replace('/welcome')} />
    </Screen>
  );
}
