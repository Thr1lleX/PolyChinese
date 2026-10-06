import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import type { CardRecord, DayActivity, Deck, ReviewLog, UserItem } from '../db/model';
import { mergeData, type SyncData } from './merge';

const now = new Date('2026-10-06T10:00:00').getTime();
const empty = (): SyncData => ({ items: [], cards: [], decks: [], reviewLogs: [], days: [], sessions: [], tombstones: [] });
const item = (key: string, updatedAt: number, triage: UserItem['triage'] = 'known'): UserItem => ({
  key,
  kind: 'char',
  text: key.slice(2),
  triage,
  addedAt: new Date(now),
  updatedAt,
});
const card = (id: string, updatedAt: number, reps: number): CardRecord => {
  const fsrs = { ...createEmptyCard(new Date(now)), reps };
  return { id, itemKey: id.split('|')[0], type: 'writing', fsrs, due: fsrs.due, createdAt: new Date(now), updatedAt };
};
const log = (cardId: string, at: number, id?: number): ReviewLog => ({
  id,
  cardId,
  itemKey: cardId.split('|')[0],
  type: 'writing',
  at: new Date(at),
  day: '2026-10-06',
  rating: 3,
  durationMs: 1000,
  stateBefore: 2,
});

describe('mergeData', () => {
  it('la modification la plus récente gagne', () => {
    const local = { ...empty(), cards: [card('c:学|writing', now - 1000, 3)] };
    const remote = { ...empty(), cards: [card('c:学|writing', now, 4)] };
    expect(mergeData(local, remote, now).cards[0].fsrs.reps).toBe(4);
    expect(mergeData(remote, local, now).cards[0].fsrs.reps).toBe(4);
  });

  it('réunit les éléments des deux appareils', () => {
    const local = { ...empty(), items: [item('c:学', now)] };
    const remote = { ...empty(), items: [item('c:生', now)] };
    expect(mergeData(local, remote, now).items.map((i) => i.key).sort()).toEqual(['c:学', 'c:生']);
  });

  it('propage une suppression, sauf modification ultérieure', () => {
    const local = { ...empty(), items: [item('c:学', now - 5000), item('c:生', now)] };
    const remote = {
      ...empty(),
      tombstones: [
        { key: 'items:c:学', at: now - 1000 },
        { key: 'items:c:生', at: now - 1000 },
      ],
    };
    const merged = mergeData(local, remote, now);
    expect(merged.items.map((i) => i.key)).toEqual(['c:生']);
    expect(merged.tombstones).toHaveLength(2);
  });

  it('oublie les traces de suppression trop anciennes', () => {
    const remote = { ...empty(), tombstones: [{ key: 'items:c:学', at: now - 400 * 86400000 }] };
    expect(mergeData(empty(), remote, now).tombstones).toEqual([]);
  });

  it('listes : identifiées par uid, l’identifiant local est conservé', () => {
    const deck = (id: number | undefined, uid: string, name: string, updatedAt: number): Deck => ({
      id,
      uid,
      name,
      itemKeys: [],
      createdAt: new Date(now),
      updatedAt,
    });
    const local = { ...empty(), decks: [deck(1, 'a', 'Cours', now - 1000)] };
    const remote = { ...empty(), decks: [deck(7, 'a', 'Cours S1', now), deck(1, 'b', 'Téléphone', now)] };
    const merged = mergeData(local, remote, now).decks;
    expect(merged.find((d) => d.uid === 'a')).toMatchObject({ id: 1, name: 'Cours S1' });
    expect(merged.find((d) => d.uid === 'b')?.id).toBeUndefined(); // nouvel identifiant local à attribuer
  });

  it('journal : union sans doublon', () => {
    const local = { ...empty(), reviewLogs: [log('c:学|writing', now, 1)] };
    const remote = { ...empty(), reviewLogs: [log('c:学|writing', now, 9), log('c:生|writing', now, 10)] };
    const merged = mergeData(local, remote, now).reviewLogs;
    expect(merged).toHaveLength(2);
    expect(merged.find((l) => l.cardId === 'c:生|writing')?.id).toBeUndefined();
  });

  it('activité : additionne les appareils, garde le compteur le plus avancé de chacun', () => {
    const day = (devices: DayActivity['devices']): DayActivity => ({ day: '2026-10-06', activeMs: 0, reviews: 0, newItems: 0, devices });
    const local = { ...empty(), days: [day({ pc: { activeMs: 600000, reviews: 40, newItems: 5 } })] };
    const remote = {
      ...empty(),
      days: [day({ pc: { activeMs: 300000, reviews: 20, newItems: 2 }, tel: { activeMs: 900000, reviews: 50, newItems: 3 } })],
    };
    const merged = mergeData(local, remote, now).days[0];
    expect(merged).toMatchObject({ activeMs: 1500000, reviews: 90, newItems: 8 });
  });
});
