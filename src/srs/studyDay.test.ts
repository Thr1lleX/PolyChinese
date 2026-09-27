import { describe, expect, it } from 'vitest';
import { addDays, dayEnd, dayStart, daysBetween, studyDay, weekStart } from './studyDay';

describe('studyDay', () => {
  it('bascule à 4 h du matin', () => {
    expect(studyDay(new Date(2026, 8, 27, 3, 59))).toBe('2026-09-26');
    expect(studyDay(new Date(2026, 8, 27, 4, 0))).toBe('2026-09-27');
    expect(studyDay(new Date(2026, 8, 27, 23, 30))).toBe('2026-09-27');
  });

  it('début et fin de journée', () => {
    expect(dayStart('2026-09-27')).toEqual(new Date(2026, 8, 27, 4));
    expect(dayEnd('2026-09-30')).toEqual(new Date(2026, 9, 1, 4));
  });

  it('calculs de dates', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekStart('2026-09-27')).toBe('2026-09-21'); // dimanche -> lundi précédent
    expect(weekStart('2026-09-21')).toBe('2026-09-21');
    expect(daysBetween('2026-09-21', '2026-09-27')).toBe(6);
  });
});
