import { describe, expect, it } from 'vitest';
import type { WordEntry } from './types';
import { unlockedWords } from './unlocked';

const w = (word: string, f?: number, h?: number): WordEntry => ({ w: word, rd: [{ p: '' }], f, h });
const words = [w('我们', 10, 1), w('学生', 500, 1), w('大学生', 3000), w('学而不厌', 50000), w('我'), w('生人', 15000)];

describe('unlockedWords', () => {
  it('mots de plusieurs caractères, tous connus, courants', () => {
    const known = new Set(['我', '们', '学', '生', '大', '人']);
    expect(unlockedWords(words, known, new Set()).map((x) => x.w)).toEqual(['我们', '学生', '大学生', '生人']);
  });

  it('exclut les mots déjà possédés et filtre le HSK', () => {
    const known = new Set(['我', '们', '学', '生', '大']);
    expect(unlockedWords(words, known, new Set(['w:我们'])).map((x) => x.w)).toEqual(['学生', '大学生']);
    expect(unlockedWords(words, known, new Set(), { hskOnly: true }).map((x) => x.w)).toEqual(['我们', '学生']);
  });

  it('rien sans caractères connus', () => {
    expect(unlockedWords(words, new Set(), new Set())).toEqual([]);
  });
});
