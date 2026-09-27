import { describe, expect, it } from 'vitest';
import { extractChars, extractWords } from './parse';

const words = new Set(['我', '是', '学生', '中国', '中国人', '老师', '你好', '好']);
const isWord = (w: string) => words.has(w);

describe('extractChars', () => {
  it('garde les caractères chinois distincts, ignore le reste', () => {
    expect(extractChars('Leçon 1 : 你好，你好！abc 学', () => true).found).toEqual(['你', '好', '学']);
  });

  it('sépare les caractères inconnus du catalogue', () => {
    const r = extractChars('我猫', (c) => c === '我');
    expect(r.found).toEqual(['我']);
    expect(r.unknown).toEqual(['猫']);
  });
});

describe('extractWords', () => {
  it('liste séparée par des virgules, espaces ou retours à la ligne', () => {
    expect(extractWords('学生, 老师\n中国人、你好', isWord).found).toEqual(['学生', '老师', '中国人', '你好']);
  });

  it('découpe un texte continu par correspondance la plus longue', () => {
    expect(extractWords('我是中国人', isWord).found).toEqual(['我', '是', '中国人']);
  });

  it('signale les fragments inconnus', () => {
    const r = extractWords('我是X学生猫', isWord);
    expect(r.found).toEqual(['我', '是', '学生']);
    expect(r.unknown).toEqual(['猫']);
  });

  it('sans doublon', () => {
    expect(extractWords('学生 学生 学生', isWord).found).toEqual(['学生']);
  });
});
