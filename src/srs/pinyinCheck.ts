// Vérification du pinyin tapé (carte Pinyin, SPEC §4) : « xue2sheng1 », « xue2 sheng », « xuésheng »…
import { markedToNumeric, parseNumeric, stripTones, type Tone } from '../lib/pinyin';

export interface SyllableCheck {
  expected: string;
  expectedTone: Tone;
  /** Ton saisi (null si la syllabe est fausse ou absente) */
  tone: Tone | null;
  lettersOk: boolean;
}

export interface PinyinCheck {
  lettersOk: boolean;
  tonesOk: boolean;
  syllables: SyllableCheck[];
}

/** Convertit la saisie en suite de (lettre, ton éventuel porté par cette lettre ou chiffre qui suit). */
function tokenize(input: string): { letters: string; toneAt: Map<number, Tone> } {
  let letters = '';
  const toneAt = new Map<number, Tone>();
  const s = input.toLowerCase().replace(/u:/g, 'v').normalize('NFC');
  for (const ch of s) {
    if (/[1-5]/.test(ch)) {
      if (letters.length) toneAt.set(letters.length - 1, Number(ch) as Tone);
      continue;
    }
    if (/[\s'’·-]/.test(ch)) continue;
    const numeric = markedToNumeric(ch); // « é » -> « e2 », « a » -> « a5 »
    const base = stripTones(numeric.slice(0, -1) || ch);
    const tone = Number(numeric.slice(-1)) as Tone;
    letters += base;
    if (tone !== 5) toneAt.set(letters.length - 1, tone);
  }
  return { letters, toneAt };
}

export function checkPinyin(expectedNumeric: string, input: string): PinyinCheck {
  const expected = parseNumeric(expectedNumeric);
  const { letters, toneAt } = tokenize(input);
  const syllables: SyllableCheck[] = [];
  let pos = 0;
  let lettersOk = true;

  for (const syl of expected) {
    const target = stripTones(syl.text);
    const got = letters.slice(pos, pos + target.length);
    if (lettersOk && got === target) {
      let tone: Tone = 5;
      for (let i = pos; i < pos + target.length; i++) if (toneAt.has(i)) tone = toneAt.get(i)!;
      syllables.push({ expected: syl.text, expectedTone: syl.tone, tone, lettersOk: true });
      pos += target.length;
    } else {
      lettersOk = false;
      syllables.push({ expected: syl.text, expectedTone: syl.tone, tone: null, lettersOk: false });
    }
  }
  if (pos !== letters.length) lettersOk = false;

  const tonesOk = lettersOk && syllables.every((s) => s.tone === s.expectedTone);
  return { lettersOk, tonesOk, syllables };
}

/** Temps de réponse « Facile » : 2,5 s de lecture + 2 s par syllabe à taper. */
export function easyPinyinMs(syllables: number): number {
  return 2500 + 2000 * syllables;
}

/**
 * Note proposée pour une carte pinyin : juste et rapide = Facile, juste = Bien,
 * tons faux = Difficile, syllabe fausse = Raté.
 */
export function gradePinyin(check: PinyinCheck, elapsedMs: number): { rating: 'again' | 'hard' | 'good' | 'easy'; description: string } {
  const seconds = `${(elapsedMs / 1000).toLocaleString('fr', { maximumFractionDigits: 1 })} s`;
  if (!check.lettersOk) return { rating: 'again', description: 'Syllabe(s) fausse(s)' };
  if (!check.tonesOk) return { rating: 'hard', description: `Ton(s) faux · ${seconds}` };
  const fast = elapsedMs <= easyPinyinMs(check.syllables.length);
  return { rating: fast ? 'easy' : 'good', description: `Correct · ${seconds}${fast ? ' (réponse rapide)' : ''}` };
}
