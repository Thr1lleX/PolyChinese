import { describe, expect, it } from 'vitest';
import { SCORED_PAIRS, TONE_PAIRS, comboKey, spokenTones, writtenTones } from './tones';

describe('spokenTones', () => {
  it.each([
    ['你好', 'ni3 hao3', [2, 3]],
    ['老虎', 'lao3 hu3', [2, 3]],
    ['展览馆', 'zhan3 lan3 guan3', [2, 2, 3]],
    ['一定', 'yi1 ding4', [2, 4]],
    ['一起', 'yi1 qi3', [4, 3]],
    ['一天', 'yi1 tian1', [4, 1]],
    ['统一', 'tong3 yi1', [3, 1]],
    ['不是', 'bu4 shi4', [2, 4]],
    ['不好', 'bu4 hao3', [4, 3]],
    ['学生', 'xue2 sheng1', [2, 1]],
  ])('%s (%s) se prononce %j', (text, numeric, expected) => {
    expect(spokenTones(text, numeric)).toEqual(expected);
  });

  it('tons écrits inchangés', () => {
    expect(writtenTones('ni3 hao3')).toEqual([3, 3]);
  });
});

describe('paires', () => {
  it('20 paires, dont 16 notées', () => {
    expect(TONE_PAIRS).toHaveLength(20);
    expect(SCORED_PAIRS).toHaveLength(16);
    expect(comboKey([3, 5])).toBe('3-0');
  });
});
