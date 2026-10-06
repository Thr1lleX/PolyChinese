// Fusion des données de deux appareils. Fonctions pures.
//
// - éléments, cartes, listes, séances : la modification la plus récente gagne (champ updatedAt) ;
// - suppressions : propagées grâce aux traces (tombstones), sauf si l'élément a été modifié après ;
// - journal des révisions : union ;
// - activité quotidienne : comptée par appareil, puis additionnée.
import type { ActiveSession, CardRecord, DayActivity, Deck, DeviceDay, ReviewLog, Tombstone, ToneLog, UserItem } from '../db/model';

export interface SyncData {
  items: UserItem[];
  cards: CardRecord[];
  decks: Deck[];
  reviewLogs: ReviewLog[];
  days: DayActivity[];
  sessions: ActiveSession[];
  tombstones: Tombstone[];
  /** Dictée de tons (absent des fichiers créés avant l'étape 4) */
  toneLogs?: ToneLog[];
}

/** Totaux d'une journée à partir des compteurs de chaque appareil. */
export function sumDevices(devices: Record<string, DeviceDay>): DeviceDay {
  const total: DeviceDay = { activeMs: 0, reviews: 0, newItems: 0 };
  for (const d of Object.values(devices)) {
    total.activeMs += d.activeMs;
    total.reviews += d.reviews;
    total.newItems += d.newItems;
  }
  return total;
}

/** Les traces de suppression plus anciennes sont oubliées. */
export const TOMBSTONE_TTL_MS = 180 * 86400000;

const stamp = (x: { updatedAt?: number }) => x.updatedAt ?? 0;

function lastWriteWins<T extends { updatedAt?: number }>(
  local: T[],
  remote: T[],
  key: (x: T) => string,
  deletedAt: (k: string) => number | undefined,
): T[] {
  const out = new Map<string, T>();
  for (const x of local) out.set(key(x), x);
  for (const x of remote) {
    const k = key(x);
    const mine = out.get(k);
    if (!mine || stamp(x) > stamp(mine)) out.set(k, x);
  }
  // Une suppression l'emporte sur toute modification antérieure
  return [...out.values()].filter((x) => {
    const at = deletedAt(key(x));
    return at === undefined || stamp(x) >= at;
  });
}

function mergeDevice(a: DeviceDay | undefined, b: DeviceDay | undefined): DeviceDay {
  if (!a) return b!;
  if (!b) return a;
  // Compteurs croissants : la version la plus avancée est la plus récente
  return b.reviews > a.reviews || (b.reviews === a.reviews && b.activeMs > a.activeMs) ? b : a;
}

function mergeDays(local: DayActivity[], remote: DayActivity[]): DayActivity[] {
  const out = new Map<string, DayActivity>();
  const withDevices = (d: DayActivity): Record<string, DeviceDay> =>
    d.devices ?? { inconnu: { activeMs: d.activeMs, reviews: d.reviews, newItems: d.newItems } };
  for (const d of [...local, ...remote]) {
    const mine = out.get(d.day);
    if (!mine) {
      out.set(d.day, { ...d, devices: withDevices(d) });
      continue;
    }
    const a = withDevices(mine);
    const b = withDevices(d);
    const devices: Record<string, DeviceDay> = {};
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) devices[id] = mergeDevice(a[id], b[id]);
    out.set(d.day, {
      day: d.day,
      ...sumDevices(devices),
      devices,
      ...(mine.expressDone || d.expressDone ? { expressDone: true } : {}),
    });
  }
  return [...out.values()];
}

export const toneLogKey = (l: ToneLog) => `${l.word}|${l.at.getTime()}`;

function mergeToneLogs(local: ToneLog[], remote: ToneLog[]): ToneLog[] {
  const out = new Map(local.map((l) => [toneLogKey(l), l]));
  for (const l of remote) if (!out.has(toneLogKey(l))) out.set(toneLogKey(l), { ...l, id: undefined });
  return [...out.values()];
}

export function mergeData(local: SyncData, remote: SyncData, now = Date.now()): SyncData {
  // Traces de suppression : la plus récente par clé, les très anciennes oubliées
  const tomb = new Map<string, number>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    if (now - t.at > TOMBSTONE_TTL_MS) continue;
    tomb.set(t.key, Math.max(tomb.get(t.key) ?? 0, t.at));
  }
  const deleted = (table: string) => (k: string) => tomb.get(`${table}:${k}`);

  // Listes : identifiant stable « uid » ; l'identifiant numérique est propre à chaque appareil
  const localDeckIds = new Map(local.decks.map((d) => [d.uid, d.id]));
  const decks = lastWriteWins(local.decks, remote.decks, (d) => d.uid ?? `nom:${d.name}`, deleted('decks')).map((d) => ({
    ...d,
    id: localDeckIds.get(d.uid),
  }));

  // Journal : union, une révision étant identifiée par sa carte et son instant
  const logKey = (l: ReviewLog) => `${l.cardId}|${l.at.getTime()}`;
  const logs = new Map(local.reviewLogs.map((l) => [logKey(l), l]));
  for (const l of remote.reviewLogs) if (!logs.has(logKey(l))) logs.set(logKey(l), { ...l, id: undefined });

  return {
    items: lastWriteWins(local.items, remote.items, (x) => x.key, deleted('items')),
    cards: lastWriteWins(local.cards, remote.cards, (x) => x.id, deleted('cards')),
    decks,
    reviewLogs: [...logs.values()],
    days: mergeDays(local.days, remote.days),
    sessions: lastWriteWins(local.sessions, remote.sessions, (x) => x.id, deleted('sessions')),
    tombstones: [...tomb].map(([key, at]) => ({ key, at })),
    toneLogs: mergeToneLogs(local.toneLogs ?? [], remote.toneLogs ?? []),
  };
}
