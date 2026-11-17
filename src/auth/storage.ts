import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthSession, PendingAuth } from '@/auth/types';

const SESSION_META_KEY = 'iron-altar.auth.session.meta';
const SESSION_ID_TOKEN_KEY = 'iron-altar.auth.session.id-token';
const SESSION_ACCESS_TOKEN_KEY = 'iron-altar.auth.session.access-token';
const SESSION_REFRESH_TOKEN_KEY = 'iron-altar.auth.session.refresh-token';
const PENDING_KEY = 'iron-altar.auth.pending';

function sessionStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return window.sessionStorage;
}

export async function savePendingAuth(pending: PendingAuth): Promise<void> {
  const store = sessionStorage();
  if (store) {
    store.setItem(PENDING_KEY, JSON.stringify(pending));
    return;
  }
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(pending));
}

export async function loadPendingAuth(): Promise<PendingAuth | null> {
  const store = sessionStorage();
  const raw = store ? store.getItem(PENDING_KEY) : await SecureStore.getItemAsync(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingAuth;
  } catch {
    return null;
  }
}

export async function clearPendingAuth(): Promise<void> {
  const store = sessionStorage();
  if (store) {
    store.removeItem(PENDING_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(PENDING_KEY);
}

type StoredSessionMeta = Pick<AuthSession, 'identity' | 'expiresAt' | 'environment'>;

export async function saveStoredSession(session: AuthSession): Promise<void> {
  if (Platform.OS === 'web') return;
  const meta: StoredSessionMeta = {
    identity: session.identity,
    expiresAt: session.expiresAt,
    environment: session.environment,
  };
  await Promise.all([
    SecureStore.setItemAsync(SESSION_META_KEY, JSON.stringify(meta)),
    SecureStore.setItemAsync(SESSION_ID_TOKEN_KEY, session.idToken),
    SecureStore.setItemAsync(SESSION_ACCESS_TOKEN_KEY, session.accessToken),
    session.refreshToken
      ? SecureStore.setItemAsync(SESSION_REFRESH_TOKEN_KEY, session.refreshToken)
      : SecureStore.deleteItemAsync(SESSION_REFRESH_TOKEN_KEY),
  ]);
}

export async function loadStoredSession(): Promise<AuthSession | null> {
  if (Platform.OS === 'web') return null;
  const [rawMeta, idToken, accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(SESSION_META_KEY),
    SecureStore.getItemAsync(SESSION_ID_TOKEN_KEY),
    SecureStore.getItemAsync(SESSION_ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(SESSION_REFRESH_TOKEN_KEY),
  ]);
  if (!rawMeta || !idToken || !accessToken) return null;
  try {
    const meta = JSON.parse(rawMeta) as StoredSessionMeta;
    return { ...meta, idToken, accessToken, refreshToken };
  } catch {
    return null;
  }
}

export async function clearStoredSession(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_META_KEY),
    SecureStore.deleteItemAsync(SESSION_ID_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_REFRESH_TOKEN_KEY),
  ]);
}
