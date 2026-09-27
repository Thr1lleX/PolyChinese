// Régularité (SPEC §13) : jour validé, série avec jokers.
import type { DayActivity } from '../db/model';
import { addDays, weekStart } from './studyDay';

export type { DayActivity };

/** Un jour est validé à partir de 5 minutes actives, ou après une séance express terminée. */
export const VALIDATION_MS = 5 * 60 * 1000;

export function isValidated(a: DayActivity | undefined): boolean {
  return !!a && (a.activeMs >= VALIDATION_MS || !!a.expressDone);
}

export interface StreakInfo {
  /** Jours validés dans la série en cours */
  current: number;
  validatedToday: boolean;
  /** Jokers encore disponibles cette semaine */
  jokersLeft: number;
  /** Jours manqués couverts par un joker (pour l'affichage du calendrier) */
  jokerDays: Set<string>;
}

/**
 * Remonte le temps depuis hier : un jour validé allonge la série, un jour manqué consomme
 * un joker de sa semaine (N par semaine) ; sans joker disponible, la série s'arrête.
 * Aujourd'hui ne casse jamais la série (la journée n'est pas finie).
 */
export function computeStreak(activity: Map<string, DayActivity>, today: string, jokersPerWeek: number): StreakInfo {
  const validatedToday = isValidated(activity.get(today));
  const firstDay = [...activity.keys()].filter((d) => isValidated(activity.get(d))).sort()[0];
  const jokerDays = new Set<string>();
  const jokersUsed = new Map<string, number>();
  let current = validatedToday ? 1 : 0;

  if (firstDay) {
    for (let day = addDays(today, -1); day >= firstDay; day = addDays(day, -1)) {
      if (isValidated(activity.get(day))) {
        current++;
        continue;
      }
      const week = weekStart(day);
      const used = jokersUsed.get(week) ?? 0;
      if (used >= jokersPerWeek) break;
      jokersUsed.set(week, used + 1);
      jokerDays.add(day);
    }
  }

  // Jokers restants cette semaine : jours manqués depuis lundi (hors aujourd'hui)
  const monday = weekStart(today);
  let missedThisWeek = 0;
  if (firstDay) {
    for (let day = monday; day < today; day = addDays(day, 1)) {
      if (day >= firstDay && !isValidated(activity.get(day))) missedThisWeek++;
    }
  }
  return { current, validatedToday, jokersLeft: Math.max(0, jokersPerWeek - missedThisWeek), jokerDays };
}
