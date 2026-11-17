import { create } from 'zustand';

import { clearLocalAuth, refreshSession } from '@/auth/client';
import { loadAuthConfig } from '@/auth/config';
import { loadStoredSession } from '@/auth/storage';
import type { AuthSession } from '@/auth/types';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  hydrate: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  clear: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  session: null,
  hydrate: async () => {
    try {
      const stored = await loadStoredSession();
      if (!stored) {
        set({ status: 'signedOut', session: null });
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
  setSession: (session) => set({ status: 'signedIn', session }),
  clear: async () => {
    try {
      await clearLocalAuth();
    } finally {
      set({ status: 'signedOut', session: null });
    }
  },
}));
