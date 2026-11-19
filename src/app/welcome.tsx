import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { beginSignIn } from '@/auth/client';
import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/state/auth-store';
import { PixelButton } from '@/ui/button';
import { Panel } from '@/ui/panel';
import { Screen } from '@/ui/screen';
import { PixelText } from '@/ui/text';

export default function WelcomeScreen() {
  const status = useAuthStore((s) => s.status);
  const setSession = useAuthStore((s) => s.setSession);
  const continueAnonymous = useAuthStore((s) => s.continueAnonymous);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'signedIn' || status === 'anonymous') router.replace('/');
  }, [status]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await beginSignIn('/');
      if (outcome.kind === 'signedIn') {
        await setSession(outcome.session);
        router.replace('/');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    setBusy(true);
    setError(null);
    try {
      await continueAnonymous();
      router.replace('/');
    } catch {
      setError('Could not start anonymous mode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottomInset={false}>
      <PixelText variant="heading">IRON ALTAR</PixelText>
      <Panel highlight>
        <PixelText variant="label" color={Palette.gold}>
          CHOOSE YOUR PATH
        </PixelText>
        <PixelText variant="body" color={Palette.textSecondary}>
          Sign in with Google to attach an identity, or continue anonymously. Training data stays on
          this device either way.
        </PixelText>
        <PixelButton
          label={busy ? 'Opening Google…' : 'Sign in with Google'}
          disabled={busy}
          onPress={signIn}
        />
        <PixelButton
          label="Continue as anonymous"
          variant="secondary"
          disabled={busy}
          onPress={skip}
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
    </Screen>
  );
}
