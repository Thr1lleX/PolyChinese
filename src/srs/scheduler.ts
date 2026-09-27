// Planification FSRS (ts-fsrs).
import { fsrs, generatorParameters, type FSRS, type Grade } from 'ts-fsrs';
import type { CardRecord } from '../db/model';

let cached: { retention: number; f: FSRS } | undefined;

export function scheduler(retention: number): FSRS {
  if (cached?.retention !== retention) {
    cached = { retention, f: fsrs(generatorParameters({ request_retention: retention, enable_fuzz: true })) };
  }
  return cached.f;
}

/** Probabilité de rappel actuelle (1 pour une carte nouvelle). */
export function retrievability(f: FSRS, card: CardRecord, now: Date): number {
  if (card.fsrs.state === 0) return 1;
  return f.get_retrievability(card.fsrs, now, false);
}

/** Applique une note à une carte et retourne la carte mise à jour. */
export function rate(f: FSRS, card: CardRecord, grade: Grade, now: Date): CardRecord {
  const { card: next } = f.next(card.fsrs, now, grade);
  return { ...card, fsrs: next, due: next.due };
}
