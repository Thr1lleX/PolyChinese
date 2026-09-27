import { describe, expect, it } from 'vitest';
import { State } from 'ts-fsrs';
import { initialCards } from './initialCards';

const now = new Date('2026-09-27T10:00:00');
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (d: Date) => Math.round((d.getTime() - now.getTime()) / DAY);

describe('initialCards', () => {
  it('crée écriture + sens pour un caractère, 4 cartes pour un mot', () => {
    expect(initialCards('c:学', 'char', 'new', now).map((c) => c.type)).toEqual(['writing', 'meaning']);
    expect(initialCards('w:学生', 'word', 'new', now).map((c) => c.type)).toEqual([
      'meaning',
      'pinyin',
      'listening',
      'speaking',
    ]);
  });

  it('« connu » : carte en révision, échéance entre 1 et 30 jours', () => {
    for (let i = 0; i < 50; i++) {
      for (const card of initialCards('c:学', 'char', 'known', now)) {
        expect(card.fsrs.state).toBe(State.Review);
        expect(card.fsrs.stability).toBe(20);
        const d = daysFromNow(card.due);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(31);
      }
    }
  });

  it('« à peu près » : échéance dans la semaine', () => {
    for (const card of initialCards('w:学生', 'word', 'fuzzy', now)) {
      expect(card.fsrs.stability).toBe(3);
      expect(daysFromNow(card.due)).toBeLessThanOrEqual(8);
    }
  });

  it('les cartes sœurs ne tombent pas le même jour', () => {
    const alwaysSame = () => 0.5;
    const cards = initialCards('w:学生', 'word', 'fuzzy', now, alwaysSame);
    const days = cards.map((c) => daysFromNow(c.due));
    expect(new Set(days).size).toBe(days.length);
  });

  it('« à réapprendre » : nouvelle carte prioritaire', () => {
    for (const card of initialCards('c:学', 'char', 'relearn', now)) {
      expect(card.fsrs.state).toBe(State.New);
      expect(card.priority).toBe(true);
    }
  });
});
