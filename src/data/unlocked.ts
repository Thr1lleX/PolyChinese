// « Mots débloqués » (SPEC §3, §9.4) : mots courants dont tous les caractères sont connus,
// mais que l'utilisateur n'a pas encore dans ses éléments.
import type { WordEntry } from './types';

/** Un mot est « courant » s'il est dans le HSK ou parmi les 20 000 plus fréquents. */
export const COMMON_WORD_RANK = 20000;

export function isCommonWord(w: WordEntry): boolean {
  return !!w.h || (w.f !== undefined && w.f <= COMMON_WORD_RANK);
}

/**
 * @param words mots du catalogue, triés par fréquence
 * @param known caractères connus
 * @param owned clés des éléments déjà présents (« w:学生 »)
 */
export function unlockedWords(
  words: WordEntry[],
  known: Set<string>,
  owned: Set<string>,
  options: { hskOnly?: boolean } = {},
): WordEntry[] {
  if (!known.size) return [];
  return words.filter(
    (w) =>
      w.w.length > 1 &&
      isCommonWord(w) &&
      (!options.hskOnly || !!w.h) &&
      !owned.has(`w:${w.w}`) &&
      [...w.w].every((c) => known.has(c)),
  );
}
