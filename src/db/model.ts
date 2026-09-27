// Données de l'utilisateur (SPEC §6), stockées dans IndexedDB.
import type { Card as FsrsCard } from 'ts-fsrs';
import type { QueueEntry } from '../srs/compose';

export type ItemKind = 'char' | 'word';

/**
 * Statut issu du tri (SPEC §10.2) :
 * - pending : importé, pas encore trié
 * - known   : « je connais bien »
 * - fuzzy   : « à peu près »
 * - relearn : « à réapprendre » (prioritaire parmi les nouveautés)
 * - new     : ajouté pour être appris
 */
export type TriageStatus = 'pending' | 'known' | 'fuzzy' | 'relearn' | 'new';

export const TRIAGE_LABELS: Record<TriageStatus, string> = {
  pending: 'À trier',
  known: 'Connu',
  fuzzy: 'À peu près',
  relearn: 'À réapprendre',
  new: 'À apprendre',
};

export interface UserItem {
  /** « c:学 » ou « w:学生 » */
  key: string;
  kind: ItemKind;
  text: string;
  triage: TriageStatus;
  addedAt: Date;
  triagedAt?: Date;
  note?: string;
}

export type CardType = 'writing' | 'meaning' | 'pinyin' | 'listening' | 'speaking';

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  writing: 'Écriture',
  meaning: 'Sens',
  pinyin: 'Pinyin',
  listening: 'Écoute',
  speaking: 'Prononciation',
};

/** Cartes créées par défaut (SPEC §4). */
export const DEFAULT_CARD_TYPES: Record<ItemKind, CardType[]> = {
  char: ['writing', 'meaning'],
  word: ['meaning', 'pinyin', 'listening', 'speaking'],
};

export interface CardRecord {
  /** « c:学|writing » */
  id: string;
  itemKey: string;
  type: CardType;
  fsrs: FsrsCard;
  /** Copie de fsrs.due, indexée */
  due: Date;
  /** Nouveauté prioritaire (« à réapprendre ») */
  priority?: boolean;
  suspended?: boolean;
  createdAt: Date;
}

export interface Deck {
  id?: number;
  name: string;
  /** Clés des éléments, dans l'ordre d'import */
  itemKeys: string[];
  cardTypes?: CardType[];
  createdAt: Date;
}

export const itemKey = (kind: ItemKind, text: string) => `${kind === 'char' ? 'c' : 'w'}:${text}`;

export function parseItemKey(key: string): { kind: ItemKind; text: string } {
  return { kind: key.startsWith('c:') ? 'char' : 'word', text: key.slice(2) };
}

// --- Étape 3 : révisions, séances, activité

/** Journal d'une révision. */
export interface ReviewLog {
  id?: number;
  cardId: string;
  itemKey: string;
  type: CardType;
  at: Date;
  /** Journée d'étude « 2026-09-27 » */
  day: string;
  /** 1 = Raté, 2 = Difficile, 3 = Bien, 4 = Facile */
  rating: 1 | 2 | 3 | 4;
  /** Note proposée par la machine, si notation automatique */
  autoRating?: 1 | 2 | 3 | 4;
  durationMs: number;
  /** État FSRS avant la révision (0 = nouvelle) */
  stateBefore: number;
  /** Détail : erreurs par trait, pinyin saisi… */
  detail?: unknown;
}

/** Où se trouve l'utilisateur (SPEC §9.2 bis). */
export type SessionContext = 'speak' | 'listen' | 'silent';

export const CONTEXT_LABELS: Record<SessionContext, { icon: string; label: string; help: string }> = {
  speak: { icon: '🗣️', label: 'Parler', help: 'Son et micro' },
  listen: { icon: '🎧', label: 'Écoute seule', help: 'Son, sans parler' },
  silent: { icon: '🔇', label: 'Silence', help: 'Ni son ni micro' },
};

export interface ActiveSession {
  id: string;
  day: string;
  startedAt: Date;
  durationMin: number;
  /** Minutes ajoutées avec « +5 min » */
  extraMin: number;
  express: boolean;
  context: SessionContext;
  queue: QueueEntry[];
  position: number;
  /** Temps actif écoulé (ms), pauses exclues */
  activeMs: number;
  /** Cartes notées pendant la séance */
  results: { cardId: string; rating: 1 | 2 | 3 | 4; isNew: boolean }[];
  status: 'running' | 'done' | 'expired';
}

/** Activité d'une journée d'étude (régularité, statistiques). */
export interface DayActivity {
  day: string;
  activeMs: number;
  reviews: number;
  newItems: number;
  expressDone?: boolean;
}
