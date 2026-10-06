// Sauvegarde : export et import de toutes les données utilisateur en JSON (SPEC §6).
import { applyRemote } from '../sync/syncService';
import type { SyncData } from '../sync/merge';
import { db, markSyncTransaction } from './db';
import { getSettings, updateSettings, type Settings } from '../settings';
import type { ActiveSession, CardRecord, DayActivity, Deck, ReviewLog, Tombstone, UserItem } from './model';

export const BACKUP_FORMAT = 'polychinese-backup';
export const BACKUP_VERSION = 2;

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
  /** Suppressions récentes (version 2) */
  tombstones?: Tombstone[];
}

export async function buildBackup(): Promise<Backup> {
  const [items, cards, decks, reviewLogs, days, sessions, tombstones] = await Promise.all([
    db.items.toArray(),
    db.cards.toArray(),
    db.decks.toArray(),
    db.reviewLogs.toArray(),
    db.days.toArray(),
    db.sessions.toArray(),
    db.tombstones.toArray(),
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
    tombstones,
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
 * - merge : fusionne comme une synchronisation (la modification la plus récente gagne).
 */
export async function restoreBackup(backup: Backup, mode: 'replace' | 'merge'): Promise<void> {
  const data: SyncData = {
    items: backup.items,
    cards: backup.cards,
    decks: backup.decks.map((d) => ({ ...d, uid: d.uid ?? crypto.randomUUID() })),
    reviewLogs: backup.reviewLogs,
    days: backup.days,
    sessions: backup.sessions,
    tombstones: backup.tombstones ?? [],
  };
  if (mode === 'merge') {
    await applyRemote(data);
    return;
  }
  const tables = [db.items, db.cards, db.decks, db.reviewLogs, db.days, db.sessions, db.tombstones];
  await db.transaction('rw', tables, async (tx) => {
    // Restauration : on garde les dates de modification de la sauvegarde
    markSyncTransaction(tx);
    await Promise.all(tables.map((t) => t.clear()));
    await db.items.bulkAdd(data.items);
    await db.cards.bulkAdd(data.cards);
    await db.decks.bulkAdd(data.decks);
    await db.reviewLogs.bulkAdd(data.reviewLogs);
    await db.days.bulkAdd(data.days);
    await db.sessions.bulkAdd(data.sessions);
    await db.tombstones.bulkAdd(data.tombstones);
  });
  updateSettings({ ...backup.settings, lastExportAt: getSettings().lastExportAt });
}

/** Efface toutes les données utilisateur (les réglages sont conservés). */
export async function wipeUserData(): Promise<void> {
  const tables = [db.items, db.cards, db.decks, db.reviewLogs, db.days, db.sessions, db.tombstones];
  // Effacement local uniquement : aucune trace de suppression à propager aux autres appareils
  await db.transaction('rw', tables, async (tx) => {
    markSyncTransaction(tx);
    await Promise.all(tables.map((t) => t.clear()));
  });
}
