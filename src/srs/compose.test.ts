import { describe, expect, it } from 'vitest';
import { State, createEmptyCard } from 'ts-fsrs';
import type { CardRecord, CardType } from '../db/model';
import { DEFAULT_CARD_MS, adaptiveNewTarget, composeSession, type ComposeInput } from './compose';

const now = new Date('2026-09-27T10:00:00');
const dayEnd = new Date('2026-09-28T04:00:00');
const ALL: Set<CardType> = new Set(['writing', 'meaning', 'pinyin', 'listening']);

function card(itemKey: string, type: CardType, opts: { due?: Date; state?: State; r?: number } = {}): CardRecord {
  const fsrs = { ...createEmptyCard(now), state: opts.state ?? State.Review, due: opts.due ?? new Date('2026-09-27T08:00:00') };
  return { id: `${itemKey}|${type}`, itemKey, type, fsrs, due: fsrs.due, createdAt: now };
}

function input(partial: Partial<ComposeInput>): ComposeInput {
  return {
    now,
    budgetMs: 25 * 60000,
    allowedTypes: ALL,
    cards: [],
    dayEnd,
    reviewedTodayCardIds: new Set(),
    retrievability: () => 0.8,
    cardMs: DEFAULT_CARD_MS,
    newItemsAllowed: 8,
    newCandidates: [],
    random: () => 0,
    ...partial,
  };
}

describe('composeSession', () => {
  it('prend les révisions dues, une seule carte par élément', () => {
    const cards = [card('c:学', 'writing'), card('c:学', 'meaning'), card('c:生', 'meaning')];
    const r = composeSession(input({ cards }));
    expect(r.reviews).toBe(2);
    expect(new Set(r.queue.map((q) => (q.kind === 'review' ? q.cardId.split('|')[0] : '')))).toEqual(new Set(['c:学', 'c:生']));
  });

  it('ignore les cartes pas encore dues et les types exclus par le contexte', () => {
    const cards = [card('w:学生', 'listening'), card('c:生', 'meaning', { due: new Date('2026-09-29T08:00:00') })];
    const r = composeSession(input({ cards, allowedTypes: new Set(['writing', 'meaning', 'pinyin']) }));
    expect(r.queue).toEqual([]);
  });

  it('les plus menacées d’oubli d’abord quand le temps manque', () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(`c:${i}`, 'meaning'));
    const r = composeSession(
      input({ cards, budgetMs: 3 * 8000, retrievability: (c) => Number(c.itemKey.slice(2)) / 10 }),
    );
    expect(new Set(r.queue.map((q) => (q.kind === 'review' ? q.cardId : '')))).toEqual(
      new Set(['c:0|meaning', 'c:1|meaning', 'c:2|meaning']),
    );
    expect(r.postponed).toBe(7);
  });

  it('retard : les nouveautés sont suspendues', () => {
    const cards = Array.from({ length: 300 }, (_, i) => card(`c:${i}`, 'writing'));
    const r = composeSession(input({ cards, newCandidates: [{ itemKey: 'c:新', kind: 'char' }] }));
    expect(r.backlog).toBe(true);
    expect(r.newItems).toBe(0);
  });

  it('ajoute des nouveautés dans la limite autorisée', () => {
    const newCandidates = Array.from({ length: 20 }, (_, i) => ({ itemKey: `w:${i}`, kind: 'word' as const }));
    const r = composeSession(input({ newCandidates, newItemsAllowed: 5 }));
    expect(r.newItems).toBe(5);
    expect(r.queue.filter((q) => q.kind === 'discover')).toHaveLength(5);
    expect(r.queue.filter((q) => q.kind === 'new' && q.cardType === 'meaning')).toHaveLength(5);
  });

  it('la première question arrive au moins 3 cartes après la découverte', () => {
    const cards = Array.from({ length: 6 }, (_, i) => card(`c:r${i}`, 'meaning'));
    for (const [nNew, withReviews] of [[1, false], [3, false], [8, false], [8, true], [2, true]] as const) {
      const newCandidates = Array.from({ length: nNew }, (_, i) => ({ itemKey: `w:${i}`, kind: 'word' as const }));
      const { queue } = composeSession(input({ cards: withReviews ? cards : [], newCandidates, newItemsAllowed: nNew }));
      for (const [j, q] of queue.entries()) {
        if (q.kind !== 'new') continue;
        const i = queue.findIndex((d) => d.kind === 'discover' && d.itemKey === q.itemKey);
        expect(i).toBeGreaterThanOrEqual(0);
        // Écart maximal possible : les autres cartes de la séance (autres nouveautés, révisions)
        const others = nNew - 1 + (withReviews ? cards.length : 0);
        expect(j - i - 1).toBeGreaterThanOrEqual(Math.min(3, others));
      }
    }
  });

  it('séance express : révisions uniquement', () => {
    const r = composeSession(
      input({ express: true, budgetMs: 5 * 60000, cards: [card('c:学', 'meaning')], newCandidates: [{ itemKey: 'c:新', kind: 'char' }] }),
    );
    expect(r.queue).toEqual([{ kind: 'review', cardId: 'c:学|meaning' }]);
  });

  it('cartes sœurs : pas le même jour qu’une autre carte de l’élément', () => {
    // L'écriture a été révisée aujourd'hui (prochaine échéance dans 2 semaines)
    const cards = [card('c:学', 'writing', { due: new Date('2026-10-10') }), card('c:学', 'meaning', { state: State.New })];
    const seen = composeSession(input({ cards, reviewedTodayCardIds: new Set(['c:学|writing']) }));
    expect(seen.queue).toEqual([]);
    const later = composeSession(input({ cards }));
    expect(later.queue).toEqual([{ kind: 'sister', cardId: 'c:学|meaning' }]);
  });
});

describe('adaptiveNewTarget', () => {
  const budget = 25 * 60000;
  it('charge faible : maximum', () => expect(adaptiveNewTarget(0.5 * budget, budget, 8)).toBe(8));
  it('charge moyenne : diminue', () => expect(adaptiveNewTarget(0.75 * budget, budget, 8)).toBeLessThan(8));
  it('charge élevée : minimum', () => expect(adaptiveNewTarget(0.95 * budget, budget, 8)).toBe(3));
  it('surcharge : aucune', () => expect(adaptiveNewTarget(1.2 * budget, budget, 8)).toBe(0));
});
