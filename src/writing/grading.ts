// Notation automatique d'une carte d'écriture (SPEC §4).

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy'];

export const RATING_LABELS: Record<Rating, string> = {
  again: 'Raté',
  hard: 'Difficile',
  good: 'Bien',
  easy: 'Facile',
};

export interface WritingResult {
  strokeCount: number;
  /** Erreurs totales (traits refusés) */
  mistakes: number;
  /** Erreurs par trait */
  mistakesPerStroke: number[];
  /** Un indice a été affiché (automatique ou demandé) */
  hintUsed: boolean;
  /** « Je ne sais pas » */
  gaveUp: boolean;
  /** Temps moyen par trait, du premier trait au dernier (ms) ; null si non mesurable */
  msPerStroke: number | null;
}

/** En dessous de ce temps moyen par trait, un tracé sans erreur est « Facile ». */
export const EASY_MS_PER_STROKE = 1500;

/** Nombre d'erreurs toléré pour « Difficile » : max(1, 15 % des traits). */
export function hardMistakeLimit(strokeCount: number): number {
  return Math.max(1, Math.floor(strokeCount * 0.15));
}

export function gradeWriting(r: WritingResult): Rating {
  if (r.gaveUp || r.hintUsed) return 'again';
  if (r.mistakes === 0) {
    return r.msPerStroke !== null && r.msPerStroke < EASY_MS_PER_STROKE ? 'easy' : 'good';
  }
  return r.mistakes <= hardMistakeLimit(r.strokeCount) ? 'hard' : 'again';
}

/** Note FSRS (1 = Raté … 4 = Facile). */
export const GRADE: Record<Rating, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };
