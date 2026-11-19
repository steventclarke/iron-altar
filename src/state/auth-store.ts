import { create } from 'zustand';

import { clearLocalAuth, refreshSession } from '@/auth/client';
import { loadAuthConfig } from '@/auth/config';
import {
  clearAnonymousEntry,
  loadAnonymousEntry,
  loadStoredSession,
  saveAnonymousEntry,
} from '@/auth/storage';
import type { AuthSession } from '@/auth/types';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'anonymous';

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  hydrate: () => Promise<void>;
  continueAnonymous: () => Promise<void>;
  setSession: (session: AuthSession) => Promise<void>;
  clear: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  hydrate: async () => {
    try {
      const stored = await loadStoredSession();
      if (!stored) {
        const anonymous = await loadAnonymousEntry();
        set({ status: anonymous ? 'anonymous' : 'signedOut', session: null });
        return;
      }

      if (stored.expiresAt > Date.now() + 60_000) {
        set({ status: 'signedIn', session: stored });
        return;
      }

      const config = await loadAuthConfig().catch(() => null);
      const refreshed = config ? await refreshSession(stored, config) : null;
      if (!refreshed) {
        await clearLocalAuth();
        set({ status: 'signedOut', session: null });
        return;
      }
      set({ status: 'signedIn', session: refreshed });
    } catch {
      set({ status: 'signedOut', session: null });
    }
  },
  continueAnonymous: async () => {
    try {
      await Promise.all([clearLocalAuth(), saveAnonymousEntry()]);
    } finally {
      set({ status: 'anonymous', session: null });
    }
  },
  setSession: async (session) => {
    await clearAnonymousEntry();
    set({ status: 'signedIn', session });
  },
  clear: async () => {
    try {
      await Promise.all([clearLocalAuth(), clearAnonymousEntry()]);
    } finally {
      set({ status: 'signedOut', session: null });
    }
  },
}));
