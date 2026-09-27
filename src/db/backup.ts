// Sauvegarde : export et import de toutes les données utilisateur en JSON (SPEC §6).
import { db } from './db';
import { getSettings, updateSettings, type Settings } from '../settings';
import type { ActiveSession, CardRecord, DayActivity, Deck, ReviewLog, UserItem } from './model';

export const BACKUP_FORMAT = 'polychinese-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  settings: Settings;
  items: UserItem[];
  cards: CardRecord[];
  decks: Deck[];
  reviewLogs: ReviewLog[];
  days: DayActivity[];
  sessions: ActiveSession[];
}

export async function buildBackup(): Promise<Backup> {
  const [items, cards, decks, reviewLogs, days, sessions] = await Promise.all([
    db.items.toArray(),
    db.cards.toArray(),
    db.decks.toArray(),
    db.reviewLogs.toArray(),
    db.days.toArray(),
    db.sessions.toArray(),
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    items,
    cards,
    decks,
    reviewLogs,
    days,
    sessions,
  };
}

/** Télécharge la sauvegarde dans un fichier « polychinese-2026-09-27.json ». */
export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `polychinese-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  updateSettings({ lastExportAt: backup.exportedAt });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** JSON.parse avec reconstitution des dates ISO. */
export function parseBackup(text: string): Backup {
  const data = JSON.parse(text, (_key, value) => (typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value));
  if (data?.format !== BACKUP_FORMAT) throw new Error("Ce fichier n'est pas une sauvegarde PolyChinese.");
  if (data.version > BACKUP_VERSION) throw new Error('Sauvegarde créée par une version plus récente de PolyChinese.');
  // exportedAt reste une chaîne
  if (data.exportedAt instanceof Date) data.exportedAt = data.exportedAt.toISOString();
  if (data.settings?.lastExportAt instanceof Date) data.settings.lastExportAt = data.settings.lastExportAt.toISOString();
  return data as Backup;
}

/**
 * Importe une sauvegarde.
 * - replace : efface tout et restaure la sauvegarde ;
 * - merge : ajoute ce qui manque ; pour une carte présente des deux côtés, garde la plus récemment révisée.
 */
export async function restoreBackup(backup: Backup, mode: 'replace' | 'merge'): Promise<void> {
  const tables = [db.items, db.cards, db.decks, db.reviewLogs, db.days, db.sessions];
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all(tables.map((t) => t.clear()));
      await db.items.bulkAdd(backup.items);
      await db.cards.bulkAdd(backup.cards);
      await db.decks.bulkAdd(backup.decks);
      await db.reviewLogs.bulkAdd(backup.reviewLogs);
      await db.days.bulkAdd(backup.days);
      await db.sessions.bulkAdd(backup.sessions);
      return;
    }

    const existingItems = new Set(await db.items.toCollection().primaryKeys());
    await db.items.bulkAdd(backup.items.filter((it) => !existingItems.has(it.key)));

    const lastReview = (c: CardRecord | undefined) => c?.fsrs.last_review?.getTime() ?? 0;
    const localCards = new Map((await db.cards.toArray()).map((c) => [c.id, c]));
    await db.cards.bulkPut(backup.cards.filter((c) => lastReview(c) > lastReview(localCards.get(c.id)) || !localCards.has(c.id)));

    for (const deck of backup.decks) {
      const local = await db.decks.where('name').equals(deck.name).first();
      if (!local) await db.decks.add({ ...deck, id: undefined });
      else await db.decks.update(local.id!, { itemKeys: [...new Set([...local.itemKeys, ...deck.itemKeys])] });
    }

    const logKey = (l: ReviewLog) => `${l.cardId}|${l.at.getTime()}`;
    const localLogs = new Set((await db.reviewLogs.toArray()).map(logKey));
    await db.reviewLogs.bulkAdd(backup.reviewLogs.filter((l) => !localLogs.has(logKey(l))).map((l) => ({ ...l, id: undefined })));

    for (const d of backup.days) {
      const local = await db.days.get(d.day);
      await db.days.put(
        local
          ? {
              day: d.day,
              activeMs: Math.max(local.activeMs, d.activeMs),
              reviews: Math.max(local.reviews, d.reviews),
              newItems: Math.max(local.newItems, d.newItems),
              expressDone: local.expressDone || d.expressDone,
            }
          : d,
      );
    }
  });
  if (mode === 'replace') updateSettings({ ...backup.settings, lastExportAt: getSettings().lastExportAt });
}

/** Efface toutes les données utilisateur (les réglages sont conservés). */
export async function wipeUserData(): Promise<void> {
  await Promise.all([db.items, db.cards, db.decks, db.reviewLogs, db.days, db.sessions].map((t) => t.clear()));
}
