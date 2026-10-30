import { describe, expect, it } from 'vitest';
import { antalRaekker, foreslaaIndstillinger, indstillingerFraLokale, jaevnFordeling, lavLokale } from './lokale';
import { antalPladser, erForrest } from './model';

describe('lavLokale', () => {
  it('lægger borde i rækker med række 0 nærmest tavlen', () => {
    const l = lavLokale({ antalBorde: 7, pladserPrBord: 4, bordePrRaekke: 3, forresteRaekker: 1 });
    expect(l.borde.map((b) => [b.raekke, b.kolonne])).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0]]);
    expect(antalRaekker(l)).toBe(3);
    expect(antalPladser(l)).toBe(28);
    expect(l.borde.filter((b) => erForrest(b, l))).toHaveLength(3);
  });

  it('begrænser urimelige værdier', () => {
    const l = lavLokale({ antalBorde: 3, pladserPrBord: 0, bordePrRaekke: 10, forresteRaekker: 9 });
    expect(l.borde.every((b) => b.pladser === 1)).toBe(true);
    expect(l.forresteRaekker).toBe(1);
  });

  it('kan læse sine indstillinger tilbage', () => {
    const ind = { antalBorde: 10, pladserPrBord: 2, bordePrRaekke: 4, forresteRaekker: 2 };
    expect(indstillingerFraLokale(lavLokale(ind))).toEqual(ind);
  });
});

describe('foreslaaIndstillinger', () => {
  it('foreslår nok borde til klassen', () => {
    expect(foreslaaIndstillinger('par', 27)).toMatchObject({ antalBorde: 14, pladserPrBord: 2 });
    expect(foreslaaIndstillinger('gruppe4', 30)).toMatchObject({ antalBorde: 8, pladserPrBord: 4 });
    expect(foreslaaIndstillinger('gruppe5', 0)).toMatchObject({ antalBorde: 1 });
  });
});

describe('jaevnFordeling', () => {
  it('giver højst én elev i forskel', () => {
    expect(jaevnFordeling([4, 4, 4, 4, 4, 4, 4], 25)).toEqual([4, 4, 4, 4, 3, 3, 3]);
    expect(jaevnFordeling([2, 2, 2], 3)).toEqual([1, 1, 1]);
  });
  it('respekterer borde af forskellig størrelse', () => {
    expect(jaevnFordeling([2, 6, 6], 12)).toEqual([2, 5, 5]);
  });
  it('fylder aldrig mere end pladserne', () => {
    expect(jaevnFordeling([2, 2], 9)).toEqual([2, 2]);
  });
});
