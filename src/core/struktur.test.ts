import { describe, expect, it } from 'vitest';
import { gruppestoerrelser, inddelPladser, parstoerrelser, planGrupper } from './struktur';
import { testLokale } from './testhjaelp';

describe('inddeling i netværksgrupper og makkerpar', () => {
  it('deler et bord i grupper af cirka fire', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(gruppestoerrelser)).toEqual([
      [2], [3], [4], [5], [3, 3], [4, 3], [4, 4], [5, 4], [4, 3, 3], [4, 4, 3], [4, 4, 4],
    ]);
  });
  it('deler en gruppe i makkerpar, hvor et par kan blive på tre', () => {
    expect([2, 3, 4, 5].map(parstoerrelser)).toEqual([[2], [3], [2, 2], [2, 3]]);
  });
  it('følger pladserne, også med huller', () => {
    expect(inddelPladser([0, 1, 2, 3, 4, 5, 6])).toEqual([[[0, 1], [2, 3]], [[4, 5, 6]]]);
    expect(inddelPladser([0, 2, 3, 5])).toEqual([[[0, 2], [3, 5]]]);
    expect(inddelPladser([])).toEqual([]);
  });
  it('nummererer grupperne i bordenes rækkefølge', () => {
    const lokale = testLokale({ antalBorde: 2, pladserPrBord: 6, bordePrRaekke: 2 });
    const g = planGrupper(lokale, { B1: ['a', 'b', 'c', 'd', 'e', null], B2: ['f', 'g', 'h', null, null, null] });
    expect(g.map((x) => [x.nr, x.bordId, x.par])).toEqual([
      [1, 'B1', [['a', 'b'], ['c', 'd', 'e']]],
      [2, 'B2', [['f', 'g', 'h']]],
    ]);
  });
});
