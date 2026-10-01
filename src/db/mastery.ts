// Statut d'un élément calculé à partir de ses cartes : il suit l'apprentissage réel,
// le tri initial ne sert que de point de départ.
import { State } from 'ts-fsrs';
import type { CardRecord, UserItem } from './model';

/**
 * - pending  : importé, pas encore trié
 * - new      : aucune carte encore étudiée
 * - review   : la dernière réponse à une de ses cartes était fausse
 * - learning : en cours (au moins une carte encore fragile)
 * - known    : toutes les cartes étudiées sont solides (stabilité ≥ 14 jours)
 */
export type Mastery = 'pending' | 'new' | 'review' | 'learning' | 'known';

export const MASTERY_LABELS: Record<Mastery, string> = {
  pending: 'À trier',
  new: 'À apprendre',
  review: 'À revoir',
  learning: 'En cours',
  known: 'Maîtrisé',
};

export const MASTERY_ORDER: Mastery[] = ['known', 'learning', 'review', 'new', 'pending'];

/** Stabilité FSRS (jours) à partir de laquelle une carte est considérée comme maîtrisée. */
export const MASTERED_STABILITY_DAYS = 14;

export function computeMastery(item: UserItem, cards: CardRecord[]): Mastery {
  if (item.triage === 'pending') return 'pending';
  const started = cards.filter((c) => c.fsrs.state !== State.New && !c.suspended);
  if (!started.length) return 'new';
  if (started.some((c) => c.lastRating === 1 || c.fsrs.state === State.Relearning)) return 'review';
  return started.every((c) => c.fsrs.stability >= MASTERED_STABILITY_DAYS) ? 'known' : 'learning';
}

export function buildMasteryMap(items: UserItem[], cards: CardRecord[]): Map<string, Mastery> {
  const byItem = new Map<string, CardRecord[]>();
  for (const c of cards) {
    let list = byItem.get(c.itemKey);
    if (!list) byItem.set(c.itemKey, (list = []));
    list.push(c);
  }
  return new Map(items.map((it) => [it.key, computeMastery(it, byItem.get(it.key) ?? [])]));
}

/** Caractères considérés comme connus : déjà étudiés (maîtrisés, en cours ou à revoir). */
export function knownCharsFrom(mastery: Map<string, Mastery> | undefined): Set<string> {
  const set = new Set<string>();
  for (const [key, m] of mastery ?? []) {
    if (key.startsWith('c:') && (m === 'known' || m === 'learning' || m === 'review')) set.add(key.slice(2));
  }
  return set;
}
