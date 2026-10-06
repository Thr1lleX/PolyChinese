import { describe, expect, it } from 'vitest';
import type { WordEntry } from '../data/types';
import { buildTonePool, comboStats, comboWeight, pairExamples, pickDictation } from './toneWords';

const w = (word: string, p: string, f = 100, h?: number): WordEntry => ({ w: word, rd: [{ p, fr: ['…'] }], f, h });
const words = [
  w('你好', 'ni3 hao3'),
  w('学生', 'xue2 sheng5'),
  w('中国', 'Zhong1 guo2'),
  w('老师', 'lao3 shi1'),
  w('朋友', 'peng2 you5'),
  w('不是', 'bu4 shi4'),
  w('喜欢', 'xi3 huan5'),
  w('明天', 'ming2 tian1'),
  w('电话', 'dian4 hua4'),
  w('飞机', 'fei1 ji1'),
  w('好', 'hao3'),
  w('大', 'da4'),
  w('图书馆', 'tu2 shu1 guan3'),
  w('稀有词', 'xi1 you3 ci2', 90000),
];

describe('buildTonePool', () => {
  const pool = buildTonePool(words, new Set(['老师']));
  it('garde 1-2 syllabes, sans nom propre, avec tons prononcés', () => {
    const texts = pool.map((x) => x.text);
    expect(texts).not.toContain('中国');
    expect(texts).not.toContain('图书馆');
    expect(texts).not.toContain('稀有词');
    expect(pool.find((x) => x.text === '你好')).toMatchObject({ spoken: '2-3', written: '3-3' });
    expect(pool.find((x) => x.text === '不是')).toMatchObject({ spoken: '2-4', written: '4-4' });
    expect(pool.find((x) => x.text === '老师')?.known).toBe(true);
  });

  it('dictée : jamais de ton neutre, jamais deux fois le même mot', () => {
    const picked = pickDictation(pool, { count: 6, stats: new Map(), random: Math.random });
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((x) => !x.spoken.includes('0'))).toBe(true);
    expect(new Set(picked.map((x) => x.text)).size).toBe(picked.length);
  });

  it('focus : la moitié des questions sur la paire travaillée', () => {
    const big = buildTonePool(
      [...words, w('毛笔', 'mao2 bi3'), w('游泳', 'you2 yong3'), w('没有', 'mei2 you3'), w('词典', 'ci2 dian3')],
      new Set(),
    );
    const picked = pickDictation(big, { count: 4, stats: new Map(), focus: '2-3', random: () => 0.3 });
    expect(picked.filter((x) => x.spoken === '2-3').length).toBeGreaterThanOrEqual(2);
  });

  it('exemples de paire : mots connus d’abord', () => {
    expect(pairExamples(pool, '3-1')[0].text).toBe('老师');
    expect(pairExamples(pool, '2-0').map((x) => x.text)).toContain('学生');
  });
});

describe('statistiques', () => {
  it('réussite par paire et poids', () => {
    const stats = comboStats([
      { expected: '2-3', correct: false },
      { expected: '2-3', correct: false },
      { expected: '2-3', correct: true },
      { expected: '1-1', correct: true },
    ]);
    expect(stats.get('2-3')).toEqual({ attempts: 3, correct: 1 });
    expect(comboWeight(stats.get('2-3'))).toBeGreaterThan(comboWeight({ attempts: 10, correct: 10 }));
    expect(comboWeight(undefined)).toBe(2);
  });
});
