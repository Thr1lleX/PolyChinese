import { describe, expect, it } from 'vitest';
import { State, createEmptyCard } from 'ts-fsrs';
import { computeMastery, knownCharsFrom, type Mastery } from './mastery';
import type { CardRecord, UserItem } from './model';

const now = new Date('2026-10-01T10:00:00');
const item = (triage: UserItem['triage']): UserItem => ({ key: 'c:学', kind: 'char', text: '学', triage, addedAt: now });
const card = (type: CardRecord['type'], state: State, stability: number, lastRating?: 1 | 2 | 3 | 4): CardRecord => {
  const fsrs = { ...createEmptyCard(now), state, stability };
  return { id: `c:学|${type}`, itemKey: 'c:学', type, fsrs, due: fsrs.due, createdAt: now, ...(lastRating ? { lastRating } : {}) };
};

describe('computeMastery', () => {
  it('à trier tant que le tri n’est pas fait', () => {
    expect(computeMastery(item('pending'), [])).toBe('pending');
  });

  it('à apprendre tant qu’aucune carte n’est étudiée', () => {
    expect(computeMastery(item('relearn'), [card('writing', State.New, 0)])).toBe('new');
  });

  it('suit l’apprentissage : « à peu près » devient maîtrisé quand les cartes sont solides', () => {
    expect(computeMastery(item('fuzzy'), [card('writing', State.Review, 3), card('meaning', State.Review, 3)])).toBe('learning');
    expect(computeMastery(item('fuzzy'), [card('writing', State.Review, 30), card('meaning', State.Review, 18)])).toBe('known');
  });

  it('« connu » repasse « à revoir » après une erreur', () => {
    expect(computeMastery(item('known'), [card('writing', State.Review, 20, 1), card('meaning', State.Review, 25)])).toBe('review');
  });

  it('une carte sœur pas encore vue ne bloque pas la maîtrise', () => {
    expect(computeMastery(item('new'), [card('writing', State.Review, 20, 3), card('meaning', State.New, 0)])).toBe('known');
  });
});

describe('knownCharsFrom', () => {
  it('garde les caractères étudiés', () => {
    const m = new Map<string, Mastery>([
      ['c:学', 'known'],
      ['c:生', 'review'],
      ['c:新', 'new'],
      ['w:学生', 'known'],
    ]);
    expect([...knownCharsFrom(m)]).toEqual(['学', '生']);
  });
});
