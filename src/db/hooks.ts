import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { buildMasteryMap, type Mastery } from './mastery';
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

/** Statut d'apprentissage de chaque élément, recalculé à chaque révision (voir mastery.ts). */
export function useMasteryMap(): Map<string, Mastery> | undefined {
  return useLiveQuery(async () => buildMasteryMap(await db.items.toArray(), await db.cards.toArray()), []);
}
