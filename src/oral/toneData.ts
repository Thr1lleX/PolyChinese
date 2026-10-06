// Accès aux données de la dictée de tons (réservoir de mots, historique, enregistrement).
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Catalog } from '../data/catalog';
import { useCatalog } from '../data/CatalogContext';
import { db } from '../db/db';
import { useMasteryMap } from '../db/hooks';
import type { Mastery } from '../db/mastery';
import type { ToneLog } from '../db/model';
import { getSettings } from '../settings';
import { studyDay } from '../srs/studyDay';
import { buildTonePool, comboStats, type ComboStats, type ToneWord } from './toneWords';

/** Mots et caractères déjà étudiés par l'utilisateur. */
export function knownTexts(mastery: Map<string, Mastery> | undefined): Set<string> {
  const out = new Set<string>();
  for (const [key, m] of mastery ?? []) if (m === 'known' || m === 'learning' || m === 'review') out.add(key.slice(2));
  return out;
}

export function tonePool(catalog: Catalog, known: Set<string>): ToneWord[] {
  return buildTonePool(catalog.words, known);
}

export function useTonePool(): ToneWord[] | undefined {
  const catalog = useCatalog();
  const mastery = useMasteryMap();
  return useMemo(() => (mastery ? tonePool(catalog, knownTexts(mastery)) : undefined), [catalog, mastery]);
}

/** Réussite par paire de tons (30 dernières tentatives de chaque paire). */
export async function loadComboStats(): Promise<Map<string, ComboStats>> {
  const logs = await db.toneLogs.orderBy('at').reverse().limit(2000).toArray();
  return comboStats(logs.map((l) => ({ expected: l.expected, correct: l.correct })));
}

export function useComboStats(): Map<string, ComboStats> | undefined {
  return useLiveQuery(loadComboStats, []);
}

export async function logToneAnswer(word: ToneWord, answer: string, correct: boolean, source: ToneLog['source']): Promise<void> {
  await db.toneLogs.add({
    at: new Date(),
    day: studyDay(new Date(), getSettings().dayCutoffHour),
    word: word.text,
    expected: word.spoken,
    written: word.written,
    answer,
    correct,
    source,
  });
}
