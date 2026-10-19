/**
 * Auth / sync seam.
 *
 * Iron Altar v1 is offline-only with no accounts, but all repository reads and
 * writes funnel through this interface so that federated login and cloud sync
 * can be added later without touching the UI or domain layers.
 *
 * `NoopSyncAdapter` is the v1 implementation: it reports `offline` and never
 * mutates anything.
 */

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

export type SyncAdapter = {
  status: SyncStatus;
  /** Push local changes to the backing store. Resolves when flushed. */
  push(): Promise<void>;
  /** Pull remote changes into the local store. */
  pull(): Promise<void>;
  /** Begin tracking sync once a session/account exists. */
  connect(): Promise<void>;
  disconnect(): void;
};

export const noopSyncAdapter: SyncAdapter = {
  status: 'offline',
  async push() {},
  async pull() {},
  async connect() {},
  disconnect() {},
};
