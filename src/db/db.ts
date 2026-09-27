import Dexie, { type EntityTable } from 'dexie';
import type { CardRecord, Deck, UserItem } from './model';

export const db = new Dexie('polychinese') as Dexie & {
  items: EntityTable<UserItem, 'key'>;
  cards: EntityTable<CardRecord, 'id'>;
  decks: EntityTable<Deck, 'id'>;
};

db.version(1).stores({
  items: 'key, kind, triage, addedAt',
  cards: 'id, itemKey, type, due',
  decks: '++id, name, createdAt',
});

let persistRequested = false;

/** Demande au navigateur de ne pas effacer les données (appelé à la première écriture). */
export function requestPersistence(): void {
  if (persistRequested) return;
  persistRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}
