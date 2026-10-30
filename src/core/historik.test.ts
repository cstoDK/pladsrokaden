import { describe, expect, it } from 'vitest';
import { aleneVedBord, bygHistorik, elevStatistik, nylighedsvaegt, parNoegle } from './historik';
import { type Koen, type Plan } from './model';
import { lavElever, testLokale } from './testhjaelp';

const koen = (m: Record<string, Koen>) => (id: string) => m[id] ?? null;

describe('aleneVedBord', () => {
  it('finder eneste pige ved et bord med mindst tre', () => {
    expect(aleneVedBord(['a', 'b', 'c'], koen({ a: 'P', b: 'D', c: 'D' }))).toEqual(['a']);
    expect(aleneVedBord(['a', 'b', 'c', 'd'], koen({ a: 'D', b: 'P', c: 'P', d: 'P' }))).toEqual(['a']);
  });
  it('tæller ikke borde à 2 eller blandede borde', () => {
    expect(aleneVedBord(['a', 'b'], koen({ a: 'P', b: 'D' }))).toEqual([]);
    expect(aleneVedBord(['a', 'b', 'c', 'd'], koen({ a: 'P', b: 'P', c: 'D', d: 'D' }))).toEqual([]);
    expect(aleneVedBord(['a', 'b', 'c'], koen({ a: 'P', b: 'P', c: 'P' }))).toEqual([]);
  });
  it('ignorerer elever uden køn', () => {
    expect(aleneVedBord(['a', 'b', 'c'], koen({ a: 'P', b: 'D', c: null }))).toEqual([]);
    expect(aleneVedBord(['a', 'b', 'c', 'd'], koen({ a: 'P', b: 'D', c: 'D', d: null }))).toEqual(['a']);
  });
});

describe('bygHistorik', () => {
  const elever = lavElever(2, 2); // P0 P1 D0 D1
  const lokale = testLokale({ antalBorde: 2, pladserPrBord: 2, bordePrRaekke: 1, forresteRaekker: 1 });
  const plan = (placering: Plan['placering'], i: number): Plan => ({ id: `p${i}`, dato: '2026-01-01', lokale, placering });
  const planer = [
    plan({ B1: ['P0', 'D0'], B2: ['P1', 'D1'] }, 0),
    plan({ B1: ['P0', 'D1'], B2: ['P1', 'D0'] }, 1),
    plan({ B1: ['P1', 'D1'], B2: ['P0', 'D0'] }, 2),
  ];

  it('vægter nyere planer højere', () => {
    expect([0, 1, 2, 3, 10].map(nylighedsvaegt)).toEqual([4, 2.5, 1.5, 1, 1]);
    const h = bygHistorik(elever, planer);
    expect(h.parVaegt.get(parNoegle('P0', 'D0'))).toBe(1.5 + 4);
    expect(h.parVaegt.get(parNoegle('P0', 'D1'))).toBe(2.5);
    expect(h.parAntal.get(parNoegle('P0', 'D0'))).toBe(2);
    expect(h.parSidst.has(parNoegle('D1', 'P1'))).toBe(true);
    expect(h.parSidst.has(parNoegle('P0', 'D1'))).toBe(false);
  });

  it('tæller gange forrest og hvem der var forrest sidst', () => {
    const h = bygHistorik(elever, planer);
    expect(h.forrestAntal.get('P0')).toBe(2);
    expect(h.forrestAntal.get('D0')).toBe(1);
    expect([...h.forrestSidst].sort()).toEqual(['D1', 'P1']);
  });

  it('bruger hver plans eget lokale, selvom lokalet er ændret siden', () => {
    const toForreste = { ...lokale, forresteRaekker: 2 };
    const h = bygHistorik(elever, [{ ...planer[0]!, lokale: toForreste }]);
    expect(h.forrestAntal.get('D1')).toBe(1);
  });

  it('elevstatistik tæller klassekammerater, eleven ikke har mødt', () => {
    const s = elevStatistik(elever, planer.slice(0, 1));
    expect(s.find((x) => x.elevId === 'P0')).toEqual({ elevId: 'P0', gangeForrest: 1, gangeAlene: 0, ikkeMoedt: 2 });
  });

  it('elever, der er slettet fra klassen, giver ikke fejl', () => {
    expect(() => elevStatistik(elever.slice(0, 2), planer)).not.toThrow();
  });
});
