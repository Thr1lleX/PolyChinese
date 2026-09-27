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

/**
 * Mots du texte. Chaque suite de caractères chinois (séparée par espaces, ponctuation, lettres…)
 * est prise telle quelle si c'est un mot du dictionnaire, sinon découpée par correspondance
 * la plus longue.
 */
export function extractWords(text: string, isWord: (w: string) => boolean): ParseResult {
  const found = new Set<string>();
  const unknown = new Set<string>();
  for (const run of text.match(HAN_RUN) ?? []) {
    if (isWord(run)) {
      found.add(run);
      continue;
    }
    const chars = [...run];
    let i = 0;
    while (i < chars.length) {
      let len = Math.min(MAX_WORD_LENGTH, chars.length - i);
      while (len > 0 && !isWord(chars.slice(i, i + len).join(''))) len--;
      if (len === 0) {
        unknown.add(chars[i]);
        i++;
      } else {
        found.add(chars.slice(i, i + len).join(''));
        i += len;
      }
    }
  }
  return { found: [...found], unknown: [...unknown] };
}
