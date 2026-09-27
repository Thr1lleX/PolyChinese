import { describe, expect, it } from 'vitest';
import { computeStreak, type DayActivity } from './streak';

const act = (...days: string[]) =>
  new Map<string, DayActivity>(days.map((day) => [day, { day, activeMs: 10 * 60000, reviews: 20, newItems: 5 }]));

describe('computeStreak', () => {
  it('compte les jours consécutifs validés', () => {
    const s = computeStreak(act('2026-09-24', '2026-09-25', '2026-09-26'), '2026-09-27', 2);
    expect(s.current).toBe(3);
    expect(s.validatedToday).toBe(false);
  });

  it('inclut aujourd’hui une fois validé', () => {
    expect(computeStreak(act('2026-09-26', '2026-09-27'), '2026-09-27', 2).current).toBe(2);
  });

  it('un jour manqué consomme un joker sans casser la série', () => {
    // mercredi 23 manqué, semaine du 21
    const s = computeStreak(act('2026-09-21', '2026-09-22', '2026-09-24', '2026-09-25', '2026-09-26'), '2026-09-27', 2);
    expect(s.current).toBe(5);
    expect(s.jokerDays.has('2026-09-23')).toBe(true);
    expect(s.jokersLeft).toBe(1);
  });

  it('au-delà des jokers de la semaine, la série s’arrête', () => {
    const s = computeStreak(act('2026-09-21', '2026-09-25', '2026-09-26'), '2026-09-27', 2);
    // 22, 23, 24 manqués : 2 jokers couvrent 24 et 23, le 22 casse la série
    expect(s.current).toBe(2);
  });

  it('jours de faible activité non validés', () => {
    const m = new Map<string, DayActivity>([['2026-09-26', { day: '2026-09-26', activeMs: 60000, reviews: 3, newItems: 0 }]]);
    expect(computeStreak(m, '2026-09-27', 2).current).toBe(0);
    m.set('2026-09-26', { ...m.get('2026-09-26')!, expressDone: true });
    expect(computeStreak(m, '2026-09-27', 2).current).toBe(1);
  });
});
