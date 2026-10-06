import { describe, expect, it } from 'vitest';
import { checkPinyin, gradePinyin } from './pinyinCheck';

describe('checkPinyin', () => {
  it.each(['xue2sheng5', 'xue2 sheng5', 'xue2sheng', 'XUE2 SHENG', 'xuésheng', "xué'sheng"])('accepte « %s »', (input) => {
    const r = checkPinyin('xue2 sheng5', input);
    expect(r.lettersOk).toBe(true);
    expect(r.tonesOk).toBe(true);
  });

  it('ton faux : lettres justes, tons faux', () => {
    const r = checkPinyin('xue2 sheng5', 'xue2sheng1');
    expect(r.lettersOk).toBe(true);
    expect(r.tonesOk).toBe(false);
    expect(r.syllables[1]).toMatchObject({ expectedTone: 5, tone: 1 });
  });

  it('ton oublié sur une syllabe tonale', () => {
    expect(checkPinyin('ni3 hao3', 'ni3hao').tonesOk).toBe(false);
  });

  it('syllabe fausse', () => {
    const r = checkPinyin('peng2 you5', 'pen2you');
    expect(r.lettersOk).toBe(false);
  });

  it('lettres en trop', () => {
    expect(checkPinyin('hao3', 'hao3ma').lettersOk).toBe(false);
  });

  it('ü : v, u: ou ü', () => {
    for (const input of ['nv3', 'nu:3', 'nǚ']) expect(checkPinyin('nü3', input).tonesOk).toBe(true);
  });

  it('noms propres (majuscule dans le dictionnaire)', () => {
    expect(checkPinyin('Zhong1 guo2', 'zhong1guo2').tonesOk).toBe(true);
  });
});

describe('gradePinyin', () => {
  const ok = checkPinyin('xue2 sheng5', 'xue2sheng5');
  it('juste et rapide : Facile', () => expect(gradePinyin(ok, 4000).rating).toBe('easy'));
  it('juste mais lent : Bien', () => expect(gradePinyin(ok, 9000).rating).toBe('good'));
  it('ton faux : Difficile', () => expect(gradePinyin(checkPinyin('xue2 sheng5', 'xue2sheng1'), 3000).rating).toBe('hard'));
  it('syllabe fausse : Raté', () => expect(gradePinyin(checkPinyin('xue2 sheng5', 'xie2sheng'), 3000).rating).toBe('again'));
});
