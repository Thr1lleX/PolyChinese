// Migration d'une base existante (version 2, avant la synchronisation) vers la version 3.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>([['polychinese.deviceId', 'pc']]);
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

describe('migration vers la version 3', () => {
  it('ajoute dates de modification, uid des listes et activité par appareil, sans perte', async () => {
    const reviewed = new Date('2026-10-01T10:00:00Z');
    const old = new Dexie('polychinese');
    old.version(1).stores({ items: 'key, kind, triage, addedAt', cards: 'id, itemKey, type, due', decks: '++id, name, createdAt' });
    old.version(2).stores({ reviewLogs: '++id, cardId, itemKey, type, day, at', sessions: 'id, day, status', days: 'day' });
    await old.open();
    await old.table('items').add({ key: 'c:学', kind: 'char', text: '学', triage: 'known', addedAt: new Date('2026-09-27T10:00:00Z') });
    await old.table('cards').add({
      id: 'c:学|writing',
      itemKey: 'c:学',
      type: 'writing',
      fsrs: { due: reviewed, last_review: reviewed, state: 2, stability: 20 },
      due: reviewed,
      createdAt: new Date('2026-09-27T10:00:00Z'),
    });
    await old.table('decks').add({ name: 'Cours', itemKeys: ['c:学'], createdAt: new Date('2026-09-27T10:00:00Z') });
    await old.table('days').add({ day: '2026-10-01', activeMs: 600000, reviews: 30, newItems: 4 });
    old.close();

    const { db } = await import('./db');
    await db.open();
    const [item] = await db.items.toArray();
    const [card] = await db.cards.toArray();
    const [deck] = await db.decks.toArray();
    const [day] = await db.days.toArray();
    expect(item.updatedAt).toBe(new Date('2026-09-27T10:00:00Z').getTime());
    expect(card.updatedAt).toBe(reviewed.getTime());
    expect(deck.uid).toMatch(/[0-9a-f-]{36}/);
    expect(day.devices).toEqual({ pc: { activeMs: 600000, reviews: 30, newItems: 4 } });
    expect(await db.tombstones.count()).toBe(0);
  });
});
