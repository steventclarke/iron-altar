import { getDatabase, mutate } from '@/data/db/database';
import type { DraftSession } from '@/data/db/schema';
import { toCalendarDate, todayCalendarDate } from '@/domain/date';
import { generateId } from '@/domain/id';
import type { Session, SetEntry } from '@/domain/types';
import { xpFromSets } from '@/domain/xp';

function timestamp(session: Session): number {
  return new Date(session.startedAt ?? session.endedAt ?? session.date).getTime();
}

function byDateDesc(a: Session, b: Session): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return timestamp(b) - timestamp(a);
}

export const sessionRepository = {
  all(): Session[] {
    return [...getDatabase().sessions].sort(byDateDesc);
  },

  recent(limit: number): Session[] {
    return this.all().slice(0, limit);
  },

  byId(id: string): Session | null {
    return getDatabase().sessions.find((s) => s.id === id) ?? null;
  },

  setsForSession(sessionId: string): SetEntry[] {
    return getDatabase()
      .sets.filter((s) => s.sessionId === sessionId)
      .sort((a, b) => a.order - b.order);
  },

  /** Persist a finished draft as a completed session + its sets. */
  complete(draft: DraftSession): Session {
    const date = draft.date ?? todayCalendarDate();
    // Timestamps only describe a session logged live on its performed day; a
    // backdated entry has no wall-clock record.
    const loggedLive = date === toCalendarDate(draft.startedAt);

    const session: Session = {
      id: draft.id,
      date,
      ...(loggedLive ? { startedAt: draft.startedAt, endedAt: new Date().toISOString() } : {}),
      notes: draft.notes || undefined,
      completed: true,
      totalVolumeKg: draft.sets
        .filter((s) => !s.isWarmup)
        .reduce((sum, s) => sum + s.weightKg * s.reps, 0),
      xpEarned: xpFromSets(draft.sets),
    };

    return mutate((db) => {
      db.sessions = db.sessions.filter((s) => s.id !== session.id);
      db.sets = db.sets.filter((s) => s.sessionId !== session.id);
      db.sessions.push(session);
      db.sets.push(...draft.sets.map((set) => ({ ...set, sessionId: session.id })));
      return session;
    });
  },

  remove(id: string): void {
    mutate((db) => {
      db.sessions = db.sessions.filter((s) => s.id !== id);
      db.sets = db.sets.filter((s) => s.sessionId !== id);
    });
  },

  newId(): string {
    return generateId();
  },
};
