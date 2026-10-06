// Tons écrits et tons prononcés (changements de ton, SPEC §8.2).
import { parseNumeric, type Tone } from '../lib/pinyin';

/** Tons écrits d'un pinyin numérique : « ni3 hao3 » → [3, 3]. */
export function writtenTones(numeric: string): Tone[] {
  return parseNumeric(numeric).map((s) => s.tone);
}

/**
 * Tons réellement prononcés, après les changements de ton du mandarin :
 * - deux 3e tons de suite : le premier devient 2e (你好 nǐ hǎo → ní hǎo) ; dans une suite de 3e tons,
 *   tous sauf le dernier deviennent 2e ;
 * - 一 (yī) : 2e ton devant un 4e, 4e ton devant 1er, 2e ou 3e (en fin de mot il reste 1er) ;
 * - 不 (bù) : 2e ton devant un 4e.
 */
export function spokenTones(text: string, numeric: string): Tone[] {
  const chars = [...text];
  const tones = writtenTones(numeric);
  const out = [...tones];
  if (chars.length !== tones.length) return out;

  for (let i = 0; i < out.length - 1; i++) {
    const next = tones[i + 1];
    if (chars[i] === '一' && tones[i] === 1 && next !== 5) out[i] = next === 4 ? 2 : 4;
    if (chars[i] === '不' && tones[i] === 4 && next === 4) out[i] = 2;
  }
  // Suites de 3e tons (après 一/不, qui ne sont jamais au 3e ton)
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i] === 3 && out[i + 1] === 3) out[i] = 2;
  }
  return out;
}

/** « 2-3 » ; le ton neutre est noté 0 dans les combinaisons. */
export function comboKey(tones: Tone[]): string {
  return tones.map((t) => (t === 5 ? 0 : t)).join('-');
}

export const TONE_NAMES: Record<number, string> = {
  1: '1er ton (haut et plat)',
  2: '2e ton (montant)',
  3: '3e ton (bas)',
  4: '4e ton (descendant)',
  0: 'ton neutre (court et léger)',
};

/** Les 20 paires de tons : 4 × 4, plus chaque ton suivi d'un ton neutre. */
export const TONE_PAIRS: string[] = [1, 2, 3, 4].flatMap((a) => [1, 2, 3, 4, 0].map((b) => `${a}-${b}`));

/** Paires évaluées en dictée (le ton neutre dépend trop de la voix de synthèse pour être noté). */
export const SCORED_PAIRS = TONE_PAIRS.filter((p) => !p.endsWith('-0'));
