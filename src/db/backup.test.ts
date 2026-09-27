import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, parseBackup } from './backup';

describe('parseBackup', () => {
  it('reconstitue les dates, garde les chaînes de date ISO attendues', () => {
    const text = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: '2026-09-27T10:00:00.000Z',
      settings: { lastExportAt: '2026-09-20T10:00:00.000Z' },
      items: [{ key: 'c:学', addedAt: new Date('2026-09-01T08:00:00Z') }],
      cards: [{ id: 'c:学|writing', due: new Date('2026-10-01T02:00:00Z'), fsrs: { due: new Date('2026-10-01T02:00:00Z') } }],
      decks: [],
      reviewLogs: [],
      days: [{ day: '2026-09-27', activeMs: 1000 }],
      sessions: [],
    });
    const b = parseBackup(text);
    expect(b.exportedAt).toBe('2026-09-27T10:00:00.000Z');
    expect(b.settings.lastExportAt).toBe('2026-09-20T10:00:00.000Z');
    expect(b.items[0].addedAt).toBeInstanceOf(Date);
    expect(b.cards[0].fsrs.due).toBeInstanceOf(Date);
    expect(b.days[0].day).toBe('2026-09-27'); // une journée reste une chaîne
  });

  it('refuse un fichier étranger', () => {
    expect(() => parseBackup('{"hello": 1}')).toThrow(/PolyChinese/);
  });
});
