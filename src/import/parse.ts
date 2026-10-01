// Extraction de caractères ou de mots depuis un texte collé (SPEC §10.1).

const HAN = /[㐀-䶿一-鿿]/;
const HAN_RUN = /[㐀-䶿一-鿿]+/g;
const MAX_WORD_LENGTH = 8;

export interface ParseResult {
  /** Éléments reconnus, dans l'ordre d'apparition, sans doublon */
  found: string[];
  /** Caractères ou fragments absents du catalogue */
  unknown: string[];
}

/** Tous les caractères chinois distincts du texte. */
export function extractChars(text: string, isChar: (c: string) => boolean): ParseResult {
  const found: string[] = [];
  const unknown: string[] = [];
  for (const ch of new Set([...text].filter((c) => HAN.test(c)))) {
    (isChar(ch) ? found : unknown).push(ch);
  }
  return { found, unknown };
}

/** Coût fixe d'un mot dans le découpage : favorise les mots longs à fréquence égale. */
const WORD_COST = 3;
/** Coût d'un caractère inconnu du dictionnaire. */
const UNKNOWN_COST = 50;
/** Rang au-delà duquel un mot est trop rare pour être pris tel quel sans vérifier un autre découpage. */
export const RARE_RANK = 200000;

/**
 * Mots du texte. Chaque suite de caractères chinois (séparée par espaces, ponctuation, lettres…)
 * est prise telle quelle si c'est un mot du dictionnaire, sinon découpée en choisissant
 * le découpage le plus probable : mots fréquents, puis mots longs (我是中国人 → 我 / 是 / 中国 / 人,
 * même si le dictionnaire contient une entrée rare « 我是 »).
 *
 * @param wordRank rang de fréquence d'un mot (1 = le plus fréquent), undefined s'il n'existe pas
 */
export function extractWords(text: string, wordRank: (w: string) => number | undefined): ParseResult {
  const found = new Set<string>();
  const unknown = new Set<string>();
  for (const run of text.match(HAN_RUN) ?? []) {
    // Entrée isolée (liste) : prise telle quelle si c'est un mot courant
    const runRank = wordRank(run);
    if (runRank !== undefined && runRank < RARE_RANK) {
      found.add(run);
      continue;
    }
    const chars = [...run];
    const n = chars.length;
    // best[i] : meilleur découpage des i premiers caractères
    const best: { cost: number; from: number; word: boolean }[] = [{ cost: 0, from: 0, word: true }];
    for (let i = 1; i <= n; i++) {
      best[i] = { cost: best[i - 1].cost + UNKNOWN_COST, from: i - 1, word: false };
      for (let len = 1; len <= Math.min(MAX_WORD_LENGTH, i); len++) {
        const rank = wordRank(chars.slice(i - len, i).join(''));
        if (rank === undefined) continue;
        const cost = best[i - len].cost + Math.log(rank) + WORD_COST;
        if (cost < best[i].cost) best[i] = { cost, from: i - len, word: true };
      }
    }
    const pieces: { text: string; word: boolean }[] = [];
    for (let i = n; i > 0; i = best[i].from) pieces.unshift({ text: chars.slice(best[i].from, i).join(''), word: best[i].word });
    for (const piece of pieces) (piece.word ? found : unknown).add(piece.text);
  }
  return { found: [...found], unknown: [...unknown] };
}
