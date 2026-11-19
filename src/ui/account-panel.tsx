import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Palette } from '@/constants/theme';
import { useAuthStore } from '@/state/auth-store';
import { PixelButton } from '@/ui/button';
import { Panel } from '@/ui/panel';
import { PixelText } from '@/ui/text';

export function AccountPanel() {
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);

  if (status === 'loading') {
    return (
      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Account
        </PixelText>
        <PixelText variant="caption" color={Palette.textMuted}>
          Checking your entry mode…
        </PixelText>
      </Panel>
    );
  }

  if (session) {
    const { identity } = session;
    const label = identity.name ?? identity.email ?? 'Google account';
    return (
      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Account
        </PixelText>
        <PixelText variant="body">{label}</PixelText>
        <PixelText variant="caption" color={Palette.textSecondary}>
          {identity.email
            ? `${identity.email} · ${session.environment}`
            : `Signed in with Google · ${session.environment}`}
        </PixelText>
        <PixelText variant="caption" color={Palette.textMuted}>
          Identity only. Training data stays on this device.
        </PixelText>
        <PixelButton
          label="Sign out"
          variant="secondary"
          style={styles.button}
          onPress={() => router.push('/logout')}
        />
      </Panel>
    );
  }

  if (status === 'anonymous') {
    return (
      <Panel>
        <PixelText variant="label" color={Palette.textSecondary}>
          Account
        </PixelText>
        <PixelText variant="body" color={Palette.textSecondary}>
          Anonymous
        </PixelText>
        <PixelText variant="caption" color={Palette.textMuted}>
          Local mode. Sign out to switch to Google.
        </PixelText>
        <PixelButton
          label="Sign out"
          variant="secondary"
          style={styles.button}
          onPress={() => router.push('/logout')}
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <PixelText variant="label" color={Palette.textSecondary}>
        Account
      </PixelText>
      <PixelText variant="body" color={Palette.textSecondary}>
        Choose how to enter on the welcome screen.
      </PixelText>
      <PixelButton
        label="Go to welcome"
        style={styles.button}
        onPress={() => router.replace('/welcome')}
      />
    </Panel>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 4,
  },
});
