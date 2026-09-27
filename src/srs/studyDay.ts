// Journée d'étude (SPEC §9.6) : elle bascule à 4 h du matin (réglable), heure locale.

export const DEFAULT_CUTOFF_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, '0');
const format = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parse(day: string): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m, d];
}

/** « 2026-09-27 » : journée d'étude à laquelle appartient cet instant. */
export function studyDay(date: Date, cutoffHour = DEFAULT_CUTOFF_HOUR): string {
  const shifted = new Date(date);
  shifted.setHours(shifted.getHours() - cutoffHour);
  return format(shifted);
}

/** Début d'une journée d'étude (à l'heure de bascule). */
export function dayStart(day: string, cutoffHour = DEFAULT_CUTOFF_HOUR): Date {
  const [y, m, d] = parse(day);
  return new Date(y, m - 1, d, cutoffHour);
}

/** Fin d'une journée d'étude = début de la suivante. */
export function dayEnd(day: string, cutoffHour = DEFAULT_CUTOFF_HOUR): Date {
  return dayStart(addDays(day, 1), cutoffHour);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = parse(day);
  return format(new Date(y, m - 1, d + n));
}

/** Lundi de la semaine de `day`. */
export function weekStart(day: string): string {
  const [y, m, d] = parse(day);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7; // lundi = 0
  return addDays(day, -weekday);
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = parse(from);
  const [y2, m2, d2] = parse(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
