import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { deviceId } from './device';
import type { ActiveSession, CardRecord, DayActivity, Deck, ReviewLog, Tombstone, UserItem } from './model';

export const db = new Dexie('polychinese') as Dexie & {
  items: EntityTable<UserItem, 'key'>;
  cards: EntityTable<CardRecord, 'id'>;
  decks: EntityTable<Deck, 'id'>;
  reviewLogs: EntityTable<ReviewLog, 'id'>;
  sessions: EntityTable<ActiveSession, 'id'>;
  days: EntityTable<DayActivity, 'day'>;
  tombstones: EntityTable<Tombstone, 'key'>;
};

db.version(1).stores({
  items: 'key, kind, triage, addedAt',
  cards: 'id, itemKey, type, due',
  decks: '++id, name, createdAt',
});

db.version(2).stores({
  reviewLogs: '++id, cardId, itemKey, type, day, at',
  sessions: 'id, day, status',
  days: 'day',
});

// Version 3 : synchronisation entre appareils (dates de modification, suppressions, activité par appareil)
let upgrading = false;
db.version(3)
  .stores({ decks: '++id, name, createdAt, uid', tombstones: 'key' })
  .upgrade(async (tx) => {
    upgrading = true;
    try {
      const device = deviceId();
      await tx.table('decks').toCollection().modify((d: Deck) => {
        d.uid ??= crypto.randomUUID();
        d.updatedAt ??= d.createdAt.getTime();
      });
      await tx.table('items').toCollection().modify((it: UserItem) => {
        it.updatedAt ??= (it.triagedAt ?? it.addedAt).getTime();
      });
      await tx.table('cards').toCollection().modify((c: CardRecord) => {
        c.updatedAt ??= (c.fsrs.last_review ?? c.createdAt).getTime();
      });
      await tx.table('sessions').toCollection().modify((s: ActiveSession) => {
        s.updatedAt ??= s.startedAt.getTime();
      });
      await tx.table('days').toCollection().modify((d: DayActivity) => {
        d.devices ??= { [device]: { activeMs: d.activeMs, reviews: d.reviews, newItems: d.newItems } };
      });
    } finally {
      upgrading = false;
    }
  });

// --- Suivi des modifications pour la synchronisation

/** Transactions venant de la synchronisation ou d'une restauration : elles gardent les dates d'origine. */
const syncTransactions = new WeakSet<object>();

export function markSyncTransaction(tx: Transaction): void {
  syncTransactions.add(tx);
}

const isSync = (tx: Transaction | undefined) => upgrading || (!!tx && syncTransactions.has(tx));

const changeListeners = new Set<() => void>();

/** Prévenu à chaque modification locale (hors synchronisation). */
export function onLocalChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}
const notifyChange = () => changeListeners.forEach((l) => l());

type Tracked = Dexie.Table<{ updatedAt?: number; uid?: string }, unknown>;

/** Tables synchronisées « dernière modification gagnante », et clé de leurs traces de suppression. */
const TRACKED: { table: Tracked; name: string; key: (pk: unknown, obj: { uid?: string }) => string }[] = [
  { table: db.items as unknown as Tracked, name: 'items', key: (pk) => String(pk) },
  { table: db.cards as unknown as Tracked, name: 'cards', key: (pk) => String(pk) },
  { table: db.decks as unknown as Tracked, name: 'decks', key: (_pk, obj) => obj.uid ?? '' },
  { table: db.sessions as unknown as Tracked, name: 'sessions', key: (pk) => String(pk) },
];

for (const { table, name, key } of TRACKED) {
  table.hook('creating', function (_pk, obj, tx) {
    if (isSync(tx)) return;
    obj.updatedAt = Date.now();
    notifyChange();
  });
  table.hook('updating', function (_mods, _pk, _obj, tx) {
    if (isSync(tx)) return undefined;
    notifyChange();
    return { updatedAt: Date.now() };
  });
  table.hook('deleting', function (pk, obj, tx) {
    if (isSync(tx)) return;
    const k = key(pk, obj);
    if (!k) return;
    const tombstone: Tombstone = { key: `${name}:${k}`, at: Date.now() };
    // La table des suppressions n'est pas forcément dans la transaction : écriture après validation
    tx.on('complete', () => {
      db.tombstones.put(tombstone).catch(() => {});
    });
    notifyChange();
  });
}

for (const table of [db.reviewLogs, db.days] as unknown as Dexie.Table<unknown, unknown>[]) {
  table.hook('creating', function (_pk, _obj, tx) {
    if (!isSync(tx)) notifyChange();
  });
  table.hook('updating', function (_mods, _pk, _obj, tx) {
    if (!isSync(tx)) notifyChange();
    return undefined;
  });
}

let persistRequested = false;

/** Demande au navigateur de ne pas effacer les données (appelé à la première écriture). */
export function requestPersistence(): void {
  if (persistRequested) return;
  persistRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}
