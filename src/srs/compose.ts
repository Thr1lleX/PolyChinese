// Composition d'une séance selon le temps disponible (SPEC §9.2 à §9.4). Fonctions pures.
import { State } from 'ts-fsrs';
import type { CardRecord, CardType, ItemKind } from '../db/model';

export type QueueEntry =
  /** Carte à réviser */
  | { kind: 'review'; cardId: string }
  /** Nouvelle carte d'un élément déjà commencé (carte « sœur ») */
  | { kind: 'sister'; cardId: string }
  /** Nouvel élément : fiche de découverte puis première carte */
  | { kind: 'new'; itemKey: string; itemKind: ItemKind; cardType: CardType };

/** Durées par défaut d'une carte (ms), remplacées par les moyennes réelles dès qu'il y a un historique. */
export const DEFAULT_CARD_MS: Record<CardType, number> = {
  writing: 25000,
  meaning: 8000,
  pinyin: 12000,
  listening: 8000,
  speaking: 20000,
};

/** Temps de la fiche de découverte d'un nouvel élément. */
export const DISCOVERY_MS = 20000;

/** Part du temps réservée aux révisions quand des nouveautés sont prévues. */
const REVIEW_SHARE = 0.7;

export interface ComposeInput {
  now: Date;
  budgetMs: number;
  express?: boolean;
  allowedTypes: Set<CardType>;
  cards: CardRecord[];
  /** Fin de la journée d'étude : une carte due avant est « à réviser aujourd'hui » */
  dayEnd: Date;
  /** Cartes déjà révisées aujourd'hui (leurs cartes sœurs attendent demain) */
  reviewedTodayCardIds: Set<string>;
  /** Cartes à ne pas reprendre (déjà faites dans cette séance) */
  excludeCardIds?: Set<string>;
  /** Probabilité de rappel actuelle d'une carte (0-1) */
  retrievability: (c: CardRecord) => number;
  cardMs: Record<CardType, number>;
  /** Nombre de nouveaux éléments encore autorisés aujourd'hui */
  newItemsAllowed: number;
  /** Nouveaux éléments candidats, par ordre de priorité (SPEC §9.4) */
  newCandidates: { itemKey: string; kind: ItemKind }[];
  random?: () => number;
}

export interface ComposeResult {
  queue: QueueEntry[];
  reviews: number;
  sisters: number;
  newItems: number;
  estimatedMs: number;
  /** Révisions dues aujourd'hui qui ne tiennent pas dans la séance */
  postponed: number;
  /** Retard : les révisions dues dépassent le temps disponible (nouveautés suspendues) */
  backlog: boolean;
}

/** Première carte d'un nouvel élément : l'écriture pour un caractère, le sens pour un mot. */
export function firstCardType(kind: ItemKind, allowed: Set<CardType>): CardType {
  if (kind === 'char' && allowed.has('writing')) return 'writing';
  return 'meaning';
}

/** Mélange léger : garde l'ordre d'urgence par blocs, mais varie les types de cartes dans chaque bloc. */
function interleave<T>(list: T[], random: () => number, window = 8): T[] {
  const out: T[] = [];
  for (let i = 0; i < list.length; i += window) {
    const chunk = list.slice(i, i + window);
    for (let j = chunk.length - 1; j > 0; j--) {
      const k = Math.floor(random() * (j + 1));
      [chunk[j], chunk[k]] = [chunk[k], chunk[j]];
    }
    out.push(...chunk);
  }
  return out;
}

export function composeSession(input: ComposeInput): ComposeResult {
  const random = input.random ?? Math.random;
  const exclude = input.excludeCardIds ?? new Set<string>();
  const usable = (c: CardRecord) => !c.suspended && input.allowedTypes.has(c.type) && !exclude.has(c.id);

  // Éléments déjà vus aujourd'hui : leurs autres cartes attendent demain
  const byId = new Map(input.cards.map((c) => [c.id, c]));
  const itemsSeenToday = new Set<string>();
  for (const id of input.reviewedTodayCardIds) {
    const c = byId.get(id);
    if (c) itemsSeenToday.add(c.itemKey);
  }
  const blockedSister = (c: CardRecord) => itemsSeenToday.has(c.itemKey) && !input.reviewedTodayCardIds.has(c.id);

  // --- Révisions dues, les plus menacées d'oubli d'abord
  const due = input.cards
    .filter((c) => usable(c) && c.fsrs.state !== State.New && c.due < input.dayEnd && !blockedSister(c))
    .map((c) => ({ c, r: input.retrievability(c) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.c);

  const dueMs = due.reduce((s, c) => s + input.cardMs[c.type], 0);
  const backlog = dueMs > input.budgetMs;
  const allowNew = !input.express && !backlog && input.newItemsAllowed > 0;
  const reviewBudget = allowNew ? input.budgetMs * REVIEW_SHARE : input.budgetMs;

  const selectedItems = new Set<string>();
  const reviews: CardRecord[] = [];
  let used = 0;
  for (const c of due) {
    if (selectedItems.has(c.itemKey)) continue; // une seule carte par élément et par séance
    const cost = input.cardMs[c.type];
    if (used + cost > reviewBudget) continue;
    reviews.push(c);
    selectedItems.add(c.itemKey);
    used += cost;
  }
  const postponed = due.filter((c) => !reviews.includes(c) && !selectedItems.has(c.itemKey)).length;

  const queue: QueueEntry[] = interleave(reviews, random).map((c) => ({ kind: 'review', cardId: c.id }));
  let sisters = 0;
  let newItems = 0;

  if (!input.express && !backlog) {
    // --- Cartes sœurs d'éléments déjà commencés (sans fiche de découverte)
    const started = new Set(input.cards.filter((c) => c.fsrs.state !== State.New).map((c) => c.itemKey));
    const sisterCards = input.cards.filter(
      (c) =>
        usable(c) &&
        c.fsrs.state === State.New &&
        started.has(c.itemKey) &&
        !itemsSeenToday.has(c.itemKey) &&
        !selectedItems.has(c.itemKey),
    );
    for (const c of sisterCards) {
      if (selectedItems.has(c.itemKey)) continue;
      const cost = input.cardMs[c.type];
      if (used + cost > input.budgetMs) continue;
      queue.push({ kind: 'sister', cardId: c.id });
      selectedItems.add(c.itemKey);
      used += cost;
      sisters++;
    }

    // --- Nouveaux éléments
    if (allowNew) {
      for (const cand of input.newCandidates) {
        if (newItems >= input.newItemsAllowed) break;
        if (selectedItems.has(cand.itemKey) || started.has(cand.itemKey)) continue;
        const cardType = firstCardType(cand.kind, input.allowedTypes);
        const cost = DISCOVERY_MS + input.cardMs[cardType];
        if (used + cost > input.budgetMs) break;
        queue.push({ kind: 'new', itemKey: cand.itemKey, itemKind: cand.kind, cardType });
        selectedItems.add(cand.itemKey);
        used += cost;
        newItems++;
      }
    }
  }

  return { queue, reviews: reviews.length, sisters, newItems, estimatedMs: used, postponed, backlog };
}

/**
 * Nombre de nouveaux éléments par jour selon la charge prévue (SPEC §9.4) :
 * charge des 7 prochains jours ≤ 60 % du budget quotidien → maximum ; au-delà, diminue
 * jusqu'au minimum à 90 % ; à partir de 100 %, plus de nouveautés.
 */
export function adaptiveNewTarget(forecastDailyMs: number, dailyBudgetMs: number, maxNew: number, minNew = 3): number {
  const ratio = forecastDailyMs / dailyBudgetMs;
  if (ratio <= 0.6) return maxNew;
  if (ratio >= 1) return 0;
  if (ratio >= 0.9) return Math.min(minNew, maxNew);
  const t = (ratio - 0.6) / 0.3;
  return Math.round(maxNew - t * (maxNew - Math.min(minNew, maxNew)));
}

/** Charge quotidienne moyenne prévue sur les 7 prochains jours (ms), hors cartes nouvelles. */
export function forecastDailyMs(cards: CardRecord[], from: Date, cardMs: Record<CardType, number>, allowedTypes: Set<CardType>): number {
  const horizon = from.getTime() + 7 * 86400000;
  let total = 0;
  for (const c of cards) {
    if (c.suspended || c.fsrs.state === State.New || !allowedTypes.has(c.type)) continue;
    const t = c.due.getTime();
    if (t >= from.getTime() && t < horizon) total += cardMs[c.type];
  }
  return total / 7;
}
