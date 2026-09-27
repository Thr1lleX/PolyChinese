import Dexie, { type EntityTable } from 'dexie';
import type { ActiveSession, CardRecord, DayActivity, Deck, ReviewLog, UserItem } from './model';

export const db = new Dexie('polychinese') as Dexie & {
  items: EntityTable<UserItem, 'key'>;
  cards: EntityTable<CardRecord, 'id'>;
  decks: EntityTable<Deck, 'id'>;
  reviewLogs: EntityTable<ReviewLog, 'id'>;
  sessions: EntityTable<ActiveSession, 'id'>;
  days: EntityTable<DayActivity, 'day'>;
};

db.version(1).stores({
  items: 'key, kind, triage, addedAt',
  cards: 'id, itemKey, type, due',
  decks: '++id, name, createdAt',
});

db.version(2).stores({
  reviewLogs: '++id, cardId, itemKey, type, day, at',
  sessions: 'id, day, status',
  days: 'day',
});

let persistRequested = false;

/** Demande au navigateur de ne pas effacer les données (appelé à la première écriture). */
export function requestPersistence(): void {
  if (persistRequested) return;
  persistRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}
