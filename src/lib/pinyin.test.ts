import { describe, expect, it } from 'vitest';
import { markedToNumeric, numericToMarked, parseNumeric, parseSyllable, stripTones } from './pinyin';

describe('parseSyllable', () => {
  it.each([
    ['xue2', 'xué', 2],
    ['sheng5', 'sheng', 5],
    ['ma', 'ma', 5],
    ['hao3', 'hǎo', 3],
    ['gou3', 'gǒu', 3],
    ['liu2', 'liú', 2],
    ['gui4', 'guì', 4],
    ['lu:4', 'lǜ', 4],
    ['nv3', 'nǚ', 3],
    ['er4', 'èr', 4],
    ['Zhong1', 'Zhōng', 1],
    ['Ou3', 'Ǒu', 3],
  ])('%s -> %s', (raw, text, tone) => {
    expect(parseSyllable(raw)).toEqual({ text, tone });
  });
});

describe('numericToMarked', () => {
  it('assemble les syllabes', () => {
    expect(numericToMarked('xue2 sheng5')).toBe('xuésheng');
    expect(numericToMarked('ni3 hao3', ' ')).toBe('nǐ hǎo');
  });

  it('conserve les tons', () => {
    expect(parseNumeric('zhong1 guo2').map((s) => s.tone)).toEqual([1, 2]);
  });
});

describe('markedToNumeric', () => {
  it.each([
    ['liǎo', 'liao3'],
    ['le', 'le5'],
    ['nǚ', 'nü3'],
    ['xué', 'xue2'],
  ])('%s -> %s', (marked, numeric) => {
    expect(markedToNumeric(marked)).toBe(numeric);
  });
});

describe('stripTones', () => {
  it('rend les formes comparables', () => {
    expect(stripTones('xué sheng')).toBe('xuesheng');
    expect(stripTones('xue2 sheng5')).toBe('xuesheng');
    expect(stripTones('lu:4')).toBe('lv');
    expect(stripTones('Nǚ')).toBe('nv');
  });
});
