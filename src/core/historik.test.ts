import { describe, expect, it } from 'vitest';
import { aleneVedBord, bygHistorik, elevStatistik, nylighedsvaegt, parNoegle } from './historik';
import { type Koen, type Plan } from './model';
import { lavElever, testLokale } from './testhjaelp';

const koen = (m: Record<string, Koen>) => (id: string) => m[id] ?? null;

describe('aleneVedBord', () => {
  it('finder eneste pige i en gruppe med mindst tre', () => {
    expect(aleneVedBord(['a', 'b', 'c'], koen({ a: 'P', b: 'D', c: 'D' }))).toEqual(['a']);
    expect(aleneVedBord(['a', 'b', 'c', 'd'], koen({ a: 'D', b: 'P', c: 'P', d: 'P' }))).toEqual(['a']);
  });
  it('tæller ikke par eller blandede grupper', () => {
    expect(aleneVedBord(['a', 'b'], koen({ a: 'P', b: 'D' }))).toEqual([]);
    expect(aleneVedBord(['a', 'b', 'c', 'd'], koen({ a: 'P', b: 'P', c: 'D', d: 'D' }))).toEqual([]);
  });
  it('ignorerer elever uden køn', () => {
    expect(aleneVedBord(['a', 'b', 'c'], koen({ a: 'P', b: 'D', c: null }))).toEqual([]);
  });
});

describe('bygHistorik', () => {
  const elever = lavElever(4, 4); // P0..P3 D0..D3
  const lokale = testLokale({ antalBorde: 2, pladserPrBord: 4, bordePrRaekke: 1 }); // B1 forrest
  const plan = (placering: Plan['placering'], i: number): Plan => ({ id: `p${i}`, dato: '2026-01-01', lokale, placering });
  const planer = [
    plan({ B1: ['P0', 'D0', 'P1', 'D1'], B2: ['P2', 'D2', 'P3', 'D3'] }, 0),
    plan({ B1: ['P2', 'D2', 'P0', 'D1'], B2: ['P1', 'D0', 'P3', 'D3'] }, 1),
  ];

  it('skelner mellem makkere og netværksgruppe og vægter nyere planer højere', () => {
    expect([0, 1, 2, 3, 10].map(nylighedsvaegt)).toEqual([4, 2.5, 1.5, 1, 1]);
    const h = bygHistorik(elever, planer);
    expect(h.makker.vaegt.get(parNoegle('P0', 'D0'))).toBe(2.5);
    expect(h.makker.vaegt.get(parNoegle('P2', 'D2'))).toBe(2.5 + 4);
    expect(h.makker.antal.has(parNoegle('P0', 'P1'))).toBe(false);
    expect(h.gruppe.vaegt.get(parNoegle('P0', 'P1'))).toBe(2.5);
    expect(h.makker.sidst.has(parNoegle('P0', 'D1'))).toBe(true);
    expect(h.gruppe.sidst.has(parNoegle('P2', 'D1'))).toBe(true);
  });

  it('tæller gange forrest ud fra afstanden til tavlen', () => {
    const h = bygHistorik(elever, planer);
    expect(h.forrestAntal.get('P0')).toBe(2);
    expect(h.forrestAntal.get('P2')).toBe(1);
    expect([...h.forrestSidst].sort()).toEqual(['D1', 'D2', 'P0', 'P2']);
  });

  it('elevstatistik: forrest, klassekammerater i gruppe, antal makkere', () => {
    const s = elevStatistik(elever, planer);
    expect(s.find((x) => x.elevId === 'P0')).toEqual({ elevId: 'P0', gangeForrest: 2, gangeAlene: 0, ikkeMoedt: 2, makkere: 2 });
  });
});
