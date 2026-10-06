// Opérations sur les données utilisateur.
import { db, requestPersistence } from './db';
import { initialCards } from './initialCards';
import { itemKey, parseItemKey, type ItemKind, type TriageStatus, type UserItem } from './model';

export const DEFAULT_DECK_NAME = 'Mes ajouts';

/**
 * Ajoute des éléments à une liste (créée si besoin, par son nom). Les éléments déjà présents
 * dans « mes éléments » gardent leur statut ; les autres sont marqués « à trier ».
 * Retourne l'identifiant de la liste et le nombre d'éléments à trier.
 */
export async function addToDeck(
  deckName: string,
  entries: { kind: ItemKind; text: string }[],
  status: TriageStatus = 'pending',
): Promise<{ deckId: number; added: number; pending: number }> {
  requestPersistence();
  const now = new Date();
  return db.transaction('rw', db.items, db.cards, db.decks, async () => {
    const keys = [...new Set(entries.map((e) => itemKey(e.kind, e.text)))];
    const existing = await db.items.bulkGet(keys);
    const fresh: UserItem[] = [];
    keys.forEach((key, i) => {
      if (existing[i]) return;
      const { kind, text } = parseItemKey(key);
      fresh.push({ key, kind, text, triage: status, addedAt: now, ...(status !== 'pending' ? { triagedAt: now } : {}) });
    });
    await db.items.bulkAdd(fresh);
    if (status !== 'pending') {
      await db.cards.bulkPut(fresh.flatMap((it) => initialCards(it.key, it.kind, status, now)));
    }

    let deck = await db.decks.where('name').equals(deckName).first();
    if (!deck) {
      const id = await db.decks.add({ name: deckName, itemKeys: [], createdAt: now, uid: crypto.randomUUID() });
      deck = (await db.decks.get(id))!;
    }
    const inDeck = new Set(deck.itemKeys);
    const itemKeys = [...deck.itemKeys, ...keys.filter((k) => !inDeck.has(k))];
    await db.decks.update(deck.id!, { itemKeys });

    const pending = await db.items.where('key').anyOf(itemKeys).filter((it) => it.triage === 'pending').count();
    return { deckId: deck.id!, added: fresh.length, pending };
  });
}

/** Fixe le statut d'un élément et (re)crée ses cartes selon ce statut. */
export async function setTriage(key: string, status: TriageStatus): Promise<void> {
  requestPersistence();
  const now = new Date();
  await db.transaction('rw', db.items, db.cards, async () => {
    const item = await db.items.get(key);
    if (!item) return;
    await db.items.update(key, { triage: status, triagedAt: status === 'pending' ? undefined : now });
    // Étape 2 : pas encore d'historique de révision, on repart des cartes initiales.
    await db.cards.where('itemKey').equals(key).delete();
    if (status !== 'pending') await db.cards.bulkPut(initialCards(key, item.kind, status, now));
  });
}

/** Ajoute un seul élément avec un statut donné (depuis une fiche). */
export async function addItem(kind: ItemKind, text: string, status: Exclude<TriageStatus, 'pending'>, deckName = DEFAULT_DECK_NAME) {
  const key = itemKey(kind, text);
  const existing = await db.items.get(key);
  await addToDeck(deckName, [{ kind, text }], status);
  if (existing) await setTriage(key, status);
}

/** Retire un élément de toutes les listes et supprime ses cartes. */
export async function removeItem(key: string): Promise<void> {
  await db.transaction('rw', db.items, db.cards, db.decks, async () => {
    await db.items.delete(key);
    await db.cards.where('itemKey').equals(key).delete();
    await db.decks.toCollection().modify((d) => {
      d.itemKeys = d.itemKeys.filter((k) => k !== key);
    });
  });
}

/** Supprime une liste ; ses éléments restent dans « mes éléments » s'ils sont triés, sinon ils sont retirés. */
export async function deleteDeck(id: number): Promise<void> {
  await db.transaction('rw', db.items, db.cards, db.decks, async () => {
    const deck = await db.decks.get(id);
    if (!deck) return;
    await db.decks.delete(id);
    const others = new Set((await db.decks.toArray()).flatMap((d) => d.itemKeys));
    const orphansPending = (await db.items.bulkGet(deck.itemKeys)).filter(
      (it): it is UserItem => !!it && it.triage === 'pending' && !others.has(it.key),
    );
    await db.items.bulkDelete(orphansPending.map((it) => it.key));
  });
}

export async function renameDeck(id: number, name: string): Promise<void> {
  await db.decks.update(id, { name });
}
