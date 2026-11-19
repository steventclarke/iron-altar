import { router } from 'expo-router';
import { useState } from 'react';

import { beginSignIn } from '@/auth/client';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/state/auth-store';
import { PixelButton } from '@/ui/button';
import { NavBar } from '@/ui/nav-bar';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';

export default function LoginScreen() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await beginSignIn('/profile');
      if (outcome.kind === 'signedIn') {
        setSession(outcome.session);
        router.replace(outcome.returnTo as never);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<NavBar />}>
      <PixelText variant="heading">SIGN IN</PixelText>

      {session ? (
        <Panel highlight>
          <PixelText variant="label" color={Palette.gold}>
            SIGNED IN
          </PixelText>
          <PixelText variant="body">
            {session.identity.name ?? session.identity.email ?? 'Google account'}
          </PixelText>
          <PixelText variant="caption" color={Palette.textSecondary}>
            This identity is only shown here. Training data stays on this device.
          </PixelText>
          <PixelButton label="Continue" onPress={() => router.replace('/')} />
          <PixelButton
            label="Sign out"
            variant="secondary"
            onPress={() => router.replace('/logout')}
          />
        </Panel>
      ) : (
        <Panel>
          <PixelText variant="body" color={Palette.textSecondary}>
            Google sign-in is optional. It adds an identity to this app but does not upload or sync
            your training data.
          </PixelText>
          <PixelButton
            label={busy ? 'Opening Google…' : 'Sign in with Google'}
            disabled={busy}
            onPress={signIn}
          />
          {error ? (
            <PixelText variant="caption" color={Palette.danger}>
              {error}
            </PixelText>
          ) : (
            <PixelText variant="caption" color={Palette.textMuted}>
              A development build is required for sign-in on iOS and Android.
            </PixelText>
          )}
        </Panel>
      )}

      <PixelButton
        label="Continue without signing in"
        variant={session ? 'secondary' : 'primary'}
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}
