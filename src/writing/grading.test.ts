import { describe, expect, it } from 'vitest';
import { gradeWriting, hardMistakeLimit, type WritingResult } from './grading';

const base: WritingResult = {
  strokeCount: 8,
  mistakes: 0,
  mistakesPerStroke: [],
  hintUsed: false,
  gaveUp: false,
  msPerStroke: 2000,
};

describe('gradeWriting', () => {
  it('sans erreur et rapide : Facile', () => {
    expect(gradeWriting({ ...base, msPerStroke: 900 })).toBe('easy');
  });

  it('sans erreur : Bien', () => {
    expect(gradeWriting(base)).toBe('good');
    expect(gradeWriting({ ...base, msPerStroke: null })).toBe('good');
  });

  it('quelques erreurs : Difficile', () => {
    expect(gradeWriting({ ...base, mistakes: 1 })).toBe('hard');
  });

  it('trop d’erreurs : Raté', () => {
    expect(gradeWriting({ ...base, mistakes: 2 })).toBe('again');
  });

  it('indice ou abandon : Raté, même sans erreur', () => {
    expect(gradeWriting({ ...base, hintUsed: true })).toBe('again');
    expect(gradeWriting({ ...base, gaveUp: true })).toBe('again');
  });
});

describe('hardMistakeLimit', () => {
  it('au moins 1, puis 15 % des traits', () => {
    expect(hardMistakeLimit(2)).toBe(1);
    expect(hardMistakeLimit(8)).toBe(1);
    expect(hardMistakeLimit(14)).toBe(2);
    expect(hardMistakeLimit(20)).toBe(3);
  });
});
