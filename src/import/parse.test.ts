import { describe, expect, it } from 'vitest';
import { extractChars, extractWords } from './parse';

// Rangs de fréquence fictifs ; « 我是 » est une entrée rare du dictionnaire
const ranks = new Map([
  ['我', 2], ['是', 4], ['学生', 1022], ['中国', 1406], ['中国人', 3000], ['老师', 900], ['你好', 2021], ['好', 15],
  ['我是', 500000], ['学', 2000], ['生', 3000],
]);
const isWord = (w: string) => ranks.get(w);

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

  it('découpe un texte continu en préférant les mots fréquents', () => {
    expect(extractWords('我是中国人', isWord).found).toEqual(['我', '是', '中国人']);
    expect(extractWords('我是学生', isWord).found).toEqual(['我', '是', '学生']);
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
