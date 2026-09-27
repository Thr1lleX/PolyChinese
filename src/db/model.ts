// Données de l'utilisateur (SPEC §6), stockées dans IndexedDB.
import type { Card as FsrsCard } from 'ts-fsrs';

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
