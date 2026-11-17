import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { completeSignIn } from '@/auth/client';
import { loadAuthConfig } from '@/auth/config';
import { loadPendingAuth } from '@/auth/storage';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/state/auth-store';
import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const pending = await loadPendingAuth();
        if (!pending) {
          throw new Error('Sign-in expired. Start again from the sign-in screen.');
        }
        const config = await loadAuthConfig();
        const session = await completeSignIn(params, config, pending);
        setSession(session);
        router.replace(pending.returnTo as never);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
      }
    })();
  }, [params, setSession]);

  return (
    <Screen header={<NavBar />}>
      <PixelText variant="heading">SIGN IN</PixelText>
      <Panel highlight={!error}>
        {error ? (
          <>
            <PixelText variant="label" color={Palette.danger}>
              SIGN-IN FAILED
            </PixelText>
            <PixelText variant="body" color={Palette.textSecondary}>
              {error}
            </PixelText>
          </>
        ) : (
          <>
            <PixelText variant="label" color={Palette.gold}>
              FINISHING SIGN-IN
            </PixelText>
            <PixelText variant="body" color={Palette.textSecondary}>
              Verifying your Google account…
            </PixelText>
          </>
        )}
      </Panel>

      {error ? <PixelButton label="Try again" onPress={() => router.replace('/login')} /> : null}
      <PixelButton
        label="Continue without signing in"
        variant="secondary"
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}
