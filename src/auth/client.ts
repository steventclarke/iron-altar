import {
  AuthRequest,
  Prompt,
  ResponseType,
  exchangeCodeAsync,
  refreshAsync,
  type TokenResponse,
} from 'expo-auth-session';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { authEndpoints, cognitoLogoutUrl, getRedirectUri, loadAuthConfig } from '@/auth/config';
import {
  clearPendingAuth,
  clearStoredSession,
  loadPendingAuth,
  savePendingAuth,
  saveStoredSession,
} from '@/auth/storage';
import { verifyIdToken } from '@/auth/tokens';
import type { AuthConfig, AuthSession, PendingAuth } from '@/auth/types';

export type SignInOutcome =
  | { kind: 'signedIn'; session: AuthSession; returnTo: string }
  | { kind: 'redirecting' }
  | { kind: 'cancelled' };

function sessionFromTokenResponse(
  response: TokenResponse,
  config: AuthConfig,
  previousRefreshToken: string | null = null,
): Promise<AuthSession> {
  const { idToken, accessToken } = response;
  if (!idToken || !accessToken) {
    throw new Error('The sign-in response did not include the expected tokens.');
  }

  return verifyIdToken(idToken, config).then((identity) => {
    const expiresIn = response.expiresIn ?? 3600;
    return {
      identity,
      idToken,
      accessToken,
      refreshToken: response.refreshToken ?? previousRefreshToken,
      expiresAt: (response.issuedAt + expiresIn) * 1000,
      environment: config.environment,
    };
  });
}

export async function beginSignIn(returnTo = '/profile'): Promise<SignInOutcome> {
  const config = await loadAuthConfig();
  const endpoints = authEndpoints(config);
  const redirectUri = getRedirectUri();
  const request = new AuthRequest({
    clientId: config.clientId,
    redirectUri,
    responseType: ResponseType.Code,
    scopes: ['openid', 'email', 'profile'],
    usePKCE: true,
    prompt: Prompt.Consent,
    extraParams: { identity_provider: 'Google' },
  });

  const url = await request.makeAuthUrlAsync(endpoints);
  const pending: PendingAuth = {
    state: request.state,
    codeVerifier: request.codeVerifier ?? '',
    redirectUri,
    createdAt: Date.now(),
    returnTo,
  };
  await savePendingAuth(pending);

  if (Platform.OS === 'web') {
    window.location.assign(url);
    return { kind: 'redirecting' };
  }

  const result = await request.promptAsync(endpoints);
  if (result.type === 'success') {
    const session = await completeSignIn(result.params, config, pending);
    return { kind: 'signedIn', session, returnTo: pending.returnTo };
  }
  if (result.type === 'error') {
    throw new Error(result.error?.message ?? 'Google sign-in failed.');
  }
  return { kind: 'cancelled' };
}

export async function completeSignIn(
  params: { code?: string; state?: string; error?: string; error_description?: string },
  config?: AuthConfig,
  pendingOverride?: PendingAuth,
): Promise<AuthSession> {
  if (params.error) {
    throw new Error(params.error_description || params.error);
  }
  if (!params.code) throw new Error('The sign-in callback did not include a code.');

  const pending = pendingOverride ?? (await loadPendingAuth());
  if (!pending) throw new Error('Sign-in expired. Start again from the sign-in screen.');
  if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
    await clearPendingAuth();
    throw new Error('Sign-in expired. Start again from the sign-in screen.');
  }
  if (!pending.codeVerifier) throw new Error('Sign-in verification failed. Start again.');
  if (params.state !== pending.state) {
    throw new Error('Sign-in verification failed. Start again.');
  }

  const resolvedConfig = config ?? (await loadAuthConfig());
  const response = await exchangeCodeAsync(
    {
      clientId: resolvedConfig.clientId,
      code: params.code,
      redirectUri: pending.redirectUri,
      extraParams: { code_verifier: pending.codeVerifier },
    },
    { tokenEndpoint: authEndpoints(resolvedConfig).tokenEndpoint },
  );

  const session = await sessionFromTokenResponse(response, resolvedConfig);
  await saveStoredSession(session);
  await clearPendingAuth();
  return session;
}

export async function refreshSession(
  session: AuthSession,
  config: AuthConfig,
): Promise<AuthSession | null> {
  if (!session.refreshToken) return null;
  try {
    const response = await refreshAsync(
      { clientId: config.clientId, refreshToken: session.refreshToken },
      { tokenEndpoint: authEndpoints(config).tokenEndpoint },
    );
    const refreshed = await sessionFromTokenResponse(response, config, session.refreshToken);
    await saveStoredSession(refreshed);
    return refreshed;
  } catch {
    return null;
  }
}

export async function clearLocalAuth(): Promise<void> {
  await clearStoredSession();
  await clearPendingAuth();
}

export async function finishSignOut(): Promise<void> {
  const config = await loadAuthConfig().catch(() => null);
  await clearLocalAuth();
  if (!config) return;

  const url = cognitoLogoutUrl(config);
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return;
  }
  void WebBrowser.openBrowserAsync(url);
}
