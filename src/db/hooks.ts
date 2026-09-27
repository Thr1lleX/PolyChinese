import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Deck, UserItem } from './model';

/** Tous les éléments de l'utilisateur, indexés par clé (undefined pendant le chargement). */
export function useItemsMap(): Map<string, UserItem> | undefined {
  return useLiveQuery(async () => new Map((await db.items.toArray()).map((it) => [it.key, it])), []);
}

export function useItem(key: string): UserItem | undefined | null {
  // null = chargé mais absent
  return useLiveQuery(async () => (await db.items.get(key)) ?? null, [key]);
}

export function useDecks(): Deck[] | undefined {
  return useLiveQuery(() => db.decks.orderBy('createdAt').toArray(), []);
}

export function useDeck(id: number): Deck | undefined | null {
  return useLiveQuery(async () => (await db.decks.get(id)) ?? null, [id]);
}

/** Caractères considérés comme connus (triés « connu » ou « à peu près »). */
export function knownChars(items: Map<string, UserItem> | undefined): Set<string> {
  const set = new Set<string>();
  for (const it of items?.values() ?? []) {
    if (it.kind === 'char' && (it.triage === 'known' || it.triage === 'fuzzy')) set.add(it.text);
  }
  return set;
}
