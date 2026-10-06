// Synchronisation entre appareils via un dépôt GitHub privé.
//
// Chaque synchronisation : lire le fichier distant, le fusionner avec les données locales
// (dans une seule transaction, pour ne perdre aucune révision faite pendant ce temps),
// puis réécrire le fichier si quelque chose a changé. En cas d'écriture concurrente
// d'un autre appareil, on recommence.
import { useSyncExternalStore } from 'react';
import { db, markSyncTransaction, onLocalChange } from '../db/db';
import { deviceId } from '../db/device';
import { ConflictError, checkRepo, readFile, writeFile, type GitHubTarget } from './github';
import { mergeData, type SyncData } from './merge';

const CONFIG_KEY = 'polychinese.sync';
const FORMAT = 'polychinese-sync';
export const DEFAULT_PATH = 'polychinese-sync.json.gz';

export interface SyncConfig extends GitHubTarget {
  enabled: boolean;
}

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncAt?: string;
  error?: string;
  /** Modifications locales pas encore envoyées */
  pending: boolean;
}

// --- Configuration (propre à chaque appareil, jamais exportée dans les sauvegardes)

export function getSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SyncConfig) : null;
  } catch {
    return null;
  }
}

function saveSyncConfig(config: SyncConfig | null): void {
  if (config) localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  else localStorage.removeItem(CONFIG_KEY);
}

// --- État observable

const LAST_SYNC_KEY = 'polychinese.lastSync';

function readLastSync(): string | undefined {
  try {
    return localStorage.getItem(LAST_SYNC_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

let status: SyncStatus = {
  state: getSyncConfig()?.enabled ? 'idle' : 'off',
  lastSyncAt: readLastSync(),
  pending: false,
};
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

// --- Lecture et application des données

export async function snapshot(): Promise<SyncData> {
  const [items, cards, decks, reviewLogs, days, sessions, tombstones] = await Promise.all([
    db.items.toArray(),
    db.cards.toArray(),
    db.decks.toArray(),
    db.reviewLogs.toArray(),
    db.days.toArray(),
    db.sessions.toArray(),
    db.tombstones.toArray(),
  ]);
  return { items, cards, decks, reviewLogs, days, sessions, tombstones };
}

const ALL_TABLES = () => [db.items, db.cards, db.decks, db.reviewLogs, db.days, db.sessions, db.tombstones];

/**
 * Fusionne des données distantes avec les données locales et n'écrit que ce qui change.
 * Retourne true si les données locales ont été modifiées.
 */
export async function applyRemote(remote: SyncData): Promise<boolean> {
  return db.transaction('rw', ALL_TABLES(), async (tx) => {
    markSyncTransaction(tx);
    const local = await snapshot();
    const merged = mergeData(local, remote);
    let changed = false;

    const syncKeyed = async <T extends { updatedAt?: number }>(
      table: { bulkPut(x: T[]): Promise<unknown>; bulkDelete(keys: never[]): Promise<void> },
      localRows: T[],
      mergedRows: T[],
      key: (x: T) => string | number | undefined,
      primaryKey: (x: T) => unknown = key,
    ) => {
      const before = new Map(localRows.map((x) => [key(x), x]));
      const toPut = mergedRows.filter((x) => {
        const mine = before.get(key(x));
        return !mine || (mine.updatedAt ?? 0) !== (x.updatedAt ?? 0);
      });
      const kept = new Set(mergedRows.map(key));
      const toDelete = localRows.filter((x) => !kept.has(key(x))).map(primaryKey);
      if (toPut.length) await table.bulkPut(toPut);
      if (toDelete.length) await table.bulkDelete(toDelete as never[]);
      if (toPut.length || toDelete.length) changed = true;
    };

    await syncKeyed(db.items, local.items, merged.items, (x) => x.key);
    await syncKeyed(db.cards, local.cards, merged.cards, (x) => x.id);
    await syncKeyed(db.sessions, local.sessions, merged.sessions, (x) => x.id);
    // Listes : les nouvelles reçoivent un identifiant local
    await syncKeyed(db.decks, local.decks, merged.decks, (x) => x.uid, (x) => x.id);

    const localLogs = new Set(local.reviewLogs.map((l) => `${l.cardId}|${l.at.getTime()}`));
    const newLogs = merged.reviewLogs.filter((l) => !localLogs.has(`${l.cardId}|${l.at.getTime()}`));
    if (newLogs.length) {
      await db.reviewLogs.bulkAdd(newLogs.map((l) => ({ ...l, id: undefined })));
      changed = true;
    }

    const localDays = new Map(local.days.map((d) => [d.day, JSON.stringify(d)]));
    const changedDays = merged.days.filter((d) => localDays.get(d.day) !== JSON.stringify(d));
    if (changedDays.length) {
      await db.days.bulkPut(changedDays);
      changed = true;
    }

    await db.tombstones.clear();
    await db.tombstones.bulkPut(merged.tombstones);
    return changed;
  });
}

// --- Encodage du fichier distant (JSON compressé)

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

async function encode(data: SyncData): Promise<Uint8Array> {
  const json = JSON.stringify({ format: FORMAT, version: 1, device: deviceId(), at: new Date().toISOString(), data });
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decode(bytes: Uint8Array): Promise<SyncData> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  const parsed = JSON.parse(text, (_k, v) => (typeof v === 'string' && ISO_DATE.test(v) ? new Date(v) : v));
  if (parsed?.format !== FORMAT) throw new Error("Le fichier distant n'est pas un fichier de synchronisation PolyChinese.");
  return parsed.data as SyncData;
}

/**
 * Résumé du contenu, indépendant des identifiants propres à chaque appareil :
 * deux résumés égaux = rien de nouveau à envoyer.
 */
export function signature(data: SyncData): string {
  const keyed = (rows: { updatedAt?: number }[], key: (x: never) => unknown) =>
    rows.map((x) => `${String(key(x as never))}@${x.updatedAt ?? 0}`).sort().join(',');
  return [
    keyed(data.items, (x: { key: string }) => x.key),
    keyed(data.cards, (x: { id: string }) => x.id),
    keyed(data.decks, (x: { uid?: string }) => x.uid),
    keyed(data.sessions, (x: { id: string }) => x.id),
    data.reviewLogs.map((l) => `${l.cardId}|${l.at.getTime()}`).sort().join(','),
    data.days.map((d) => `${d.day}:${JSON.stringify(Object.entries(d.devices ?? {}).sort())}:${d.expressDone ?? ''}`).sort().join(','),
    data.tombstones.map((t) => `${t.key}@${t.at}`).sort().join(','),
  ].join('#');
}

// --- Synchronisation

let running: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  running ??= doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync(): Promise<void> {
  const config = getSyncConfig();
  if (!config?.enabled) return;
  setStatus({ state: 'syncing', error: undefined });
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const remoteFile = await readFile(config);
      const remote = remoteFile ? await decode(remoteFile.bytes) : null;
      if (remote) await applyRemote(remote);
      const fresh = await snapshot();
      // Après fusion, les données locales contiennent tout le distant : on n'écrit que s'il y a du neuf
      const unchanged = remote && signature(fresh) === signature(mergeData(remote, remote));
      if (!unchanged) {
        try {
          await writeFile(config, await encode(fresh), remoteFile?.sha, `Synchronisation ${new Date().toISOString().slice(0, 16)}`);
        } catch (e) {
          if (e instanceof ConflictError) continue; // un autre appareil vient d'écrire : on refusionne
          throw e;
        }
      }
      const at = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, at);
      setStatus({ state: 'idle', lastSyncAt: at, pending: false });
      return;
    }
    throw new Error('Trop de modifications simultanées, réessayez dans un instant.');
  } catch (e) {
    setStatus({ state: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

/** Active la synchronisation après vérification de l'accès au dépôt. */
export async function enableSync(repo: string, token: string): Promise<{ private: boolean }> {
  const target = { repo: repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, ''), token: token.trim(), path: DEFAULT_PATH };
  const info = await checkRepo(target);
  saveSyncConfig({ ...target, enabled: true });
  setStatus({ state: 'idle', error: undefined });
  await syncNow();
  return info;
}

export function disableSync(): void {
  saveSyncConfig(null);
  localStorage.removeItem(LAST_SYNC_KEY);
  setStatus({ state: 'off', error: undefined, lastSyncAt: undefined, pending: false });
}

// --- Synchronisation automatique

const AUTO_INTERVAL_MS = 5 * 60000;
const AFTER_CHANGE_MS = 30000;
let started = false;

/** Démarre la synchronisation automatique : au lancement, toutes les 5 min, et peu après chaque modification. */
export function startAutoSync(): void {
  if (started) return;
  started = true;
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const trigger = (delay: number) => {
    if (!getSyncConfig()?.enabled) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => syncNow(), delay);
  };
  onLocalChange(() => {
    if (!status.pending && getSyncConfig()?.enabled) setStatus({ pending: true });
    trigger(AFTER_CHANGE_MS);
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') trigger(0);
  }, AUTO_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    // En quittant l'appli : envoyer tout de suite ce qui reste ; en revenant : récupérer
    if (document.visibilityState === 'hidden' ? status.pending : true) trigger(0);
  });
  window.addEventListener('online', () => trigger(0));
  trigger(1500);
}
