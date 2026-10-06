// Choix des mots pour la dictée de tons et les paires de tons. Fonctions pures.
import type { WordEntry } from '../data/types';
import { comboKey, spokenTones, writtenTones } from './tones';

export interface ToneWord {
  text: string;
  numeric: string;
  /** Tons prononcés (« 2-3 » pour 你好) : la réponse attendue */
  spoken: string;
  /** Tons écrits (« 3-3 » pour 你好) */
  written: string;
  /** Mot connu de l'utilisateur */
  known: boolean;
  /** Rang de fréquence (plus petit = plus courant) */
  rank: number;
}

export interface ToneAttempt {
  expected: string;
  correct: boolean;
}

/**
 * Mots utilisables : 1 ou 2 syllabes, une seule prononciation (pas d'ambiguïté pour la voix de synthèse),
 * pas de nom propre, courants (HSK 1-3 ou 3 000 mots les plus fréquents) ou connus de l'utilisateur.
 */
export function buildTonePool(words: WordEntry[], known: Set<string>): ToneWord[] {
  const pool: ToneWord[] = [];
  for (const w of words) {
    const chars = [...w.w];
    if (chars.length > 2 || w.rd.length !== 1) continue;
    const numeric = w.rd[0].p;
    if (numeric !== numeric.toLowerCase()) continue; // nom propre
    const written = writtenTones(numeric);
    if (written.length !== chars.length) continue;
    const isKnown = known.has(w.w);
    const common = (w.h !== undefined && w.h <= 3) || (w.f !== undefined && w.f <= 3000);
    if (!isKnown && !common) continue;
    pool.push({
      text: w.w,
      numeric,
      spoken: comboKey(spokenTones(w.w, numeric)),
      written: comboKey(written),
      known: isKnown,
      rank: w.f ?? 100000,
    });
  }
  return pool;
}

export interface ComboStats {
  attempts: number;
  correct: number;
}

/** Réussite par combinaison de tons (sur les tentatives fournies, les plus récentes d'abord). */
export function comboStats(attempts: ToneAttempt[], window = 30): Map<string, ComboStats> {
  const stats = new Map<string, ComboStats>();
  for (const a of attempts) {
    const s = stats.get(a.expected) ?? { attempts: 0, correct: 0 };
    if (s.attempts >= window) continue;
    s.attempts++;
    if (a.correct) s.correct++;
    stats.set(a.expected, s);
  }
  return stats;
}

/** Poids d'une combinaison : plus elle est ratée (ou peu travaillée), plus elle revient. */
export function comboWeight(s: ComboStats | undefined): number {
  if (!s || s.attempts < 3) return 2;
  return 1 + 4 * (1 - s.correct / s.attempts);
}

export interface PickOptions {
  count: number;
  stats: Map<string, ComboStats>;
  random?: () => number;
  /** Combinaison travaillée en priorité (la moitié des questions), le reste en combinaisons proches */
  focus?: string;
  /** Proportion de mots d'une seule syllabe */
  singleShare?: number;
}

function weightedPick<T>(items: T[], weight: (x: T) => number, random: () => number): T | undefined {
  const total = items.reduce((s, x) => s + weight(x), 0);
  let r = random() * total;
  for (const x of items) {
    r -= weight(x);
    if (r <= 0) return x;
  }
  return items[items.length - 1];
}

/**
 * Tire les mots d'une dictée : combinaisons faibles plus souvent, mots connus privilégiés,
 * jamais deux fois le même mot.
 */
export function pickDictation(pool: ToneWord[], opts: PickOptions): ToneWord[] {
  const random = opts.random ?? Math.random;
  const singleShare = opts.singleShare ?? 0.25;
  const byCombo = new Map<string, ToneWord[]>();
  for (const w of pool) {
    // Le ton neutre n'est pas noté en dictée
    if (w.spoken.includes('0')) continue;
    const list = byCombo.get(w.spoken) ?? [];
    list.push(w);
    byCombo.set(w.spoken, list);
  }
  const combos = [...byCombo.keys()];
  const singles = combos.filter((c) => !c.includes('-'));
  const pairs = combos.filter((c) => c.includes('-'));
  // Combinaisons voisines du focus : même premier ou même second ton
  const near = (c: string) => opts.focus && c !== opts.focus && c.split('-').some((t, i) => t === opts.focus!.split('-')[i]);

  const used = new Set<string>();
  const out: ToneWord[] = [];
  for (let i = 0; i < opts.count * 4 && out.length < opts.count; i++) {
    let combo: string | undefined;
    if (opts.focus && byCombo.has(opts.focus)) {
      combo = out.length % 2 === 0 ? opts.focus : weightedPick(pairs.filter(near), () => 1, random) ?? opts.focus;
    } else {
      const group = singles.length && random() < singleShare ? singles : pairs.length ? pairs : singles;
      combo = weightedPick(group, (c) => comboWeight(opts.stats.get(c)), random);
    }
    const candidates = (combo ? byCombo.get(combo) ?? [] : []).filter((w) => !used.has(w.text));
    // Mots connus 3 fois plus souvent, puis les plus courants
    const word = weightedPick(candidates, (w) => (w.known ? 3 : 1) / Math.log10(10 + w.rank), random);
    if (!word) continue;
    used.add(word.text);
    out.push(word);
  }
  return out;
}

/** Exemples d'une paire de tons : mots connus d'abord, puis les plus courants. */
export function pairExamples(pool: ToneWord[], combo: string, count = 6): ToneWord[] {
  return pool
    .filter((w) => w.spoken === combo || (w.written === combo && combo.includes('0')))
    .sort((a, b) => Number(b.known) - Number(a.known) || a.rank - b.rank)
    .slice(0, count);
}
