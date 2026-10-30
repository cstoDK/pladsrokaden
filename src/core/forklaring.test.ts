import { describe, expect, it } from 'vitest';
import { forklar } from './forklaring';
import { type Elev, type Plan } from './model';
import { testLokale } from './testhjaelp';

const elever: Elev[] = [
  { id: 'a', navn: 'Ida', koen: 'P' },
  { id: 'b', navn: 'Malte', koen: 'D' },
  { id: 'c', navn: 'Sara', koen: 'P' },
  { id: 'd', navn: 'Omar', koen: 'D' },
];

describe('forklar: borde à 2', () => {
  const lokale = testLokale({ antalBorde: 2, pladserPrBord: 2, bordePrRaekke: 1, forresteRaekker: 1 });
  const sidst: Plan = { id: 'p', dato: '2026-01-01', lokale, placering: { B1: ['a', 'b'], B2: ['c', 'd'] } };
  const tekster = (f: ReturnType<typeof forklar>) => f.status.map((s) => s.tekst);

  it('melder ingen gentagelser, når alle har nye makkere', () => {
    const f = forklar({ elever, lokale, placering: { B1: ['c', 'b'], B2: ['a', 'd'] }, tidligere: [sidst], holdAdskilt: [] });
    expect(tekster(f)).toContain('Alle sidder med nye makkere');
    expect(tekster(f)).toContain('1 er forrest igen');
    expect(f.borde['B1']!.map((p) => p.tekst)).toEqual(['Malte er forrest igen']);
    expect(f.borde['B2']).toEqual([]);
  });

  it('melder par, der sidder sammen igen, ved bordet og samlet', () => {
    const f = forklar({ elever, lokale, placering: { B1: ['c', 'd'], B2: ['a', 'b'] }, tidligere: [sidst], holdAdskilt: [] });
    expect(tekster(f)).toContain('2 par sad også sammen sidst');
    expect(tekster(f)).toContain('Ingen er forrest to gange i træk');
    expect(f.borde['B2']!.map((p) => p.tekst)).toEqual(['Ida og Malte sad også sammen sidst']);
  });

  it('viser intet om historik ved første plan', () => {
    const f = forklar({ elever, lokale, placering: sidst.placering, tidligere: [], holdAdskilt: [] });
    expect(f.status).toEqual([]);
  });

  it('melder brudt "hold adskilt" som fejl', () => {
    const f = forklar({ elever, lokale, placering: sidst.placering, tidligere: [], holdAdskilt: [['a', 'b']] });
    expect(f.status).toContainEqual({ niveau: 'fejl', tekst: '1 par, der skal holdes adskilt, sidder ved samme bord' });
    expect(f.borde['B1']![0]).toMatchObject({ niveau: 'fejl', tekst: 'Ida og Malte skal holdes adskilt' });
  });
});

describe('forklar: grupper', () => {
  const lokale = testLokale({ antalBorde: 2, pladserPrBord: 3, bordePrRaekke: 2, forresteRaekker: 1 });
  const seks: Elev[] = [...elever, { id: 'e', navn: 'Emil', koen: 'D' }, { id: 'f', navn: 'Lea', koen: null }];

  it('navngiver den, der er eneste af sit køn, og siger "igen"', () => {
    const tidligere: Plan[] = [{ id: 'p', dato: '2026-01-01', lokale, placering: { B1: ['a', 'b', 'd'], B2: ['c', 'e', 'f'] } }];
    const f = forklar({ elever: seks, lokale, placering: { B1: ['a', 'e', 'd'], B2: ['c', 'b', 'f'] }, tidligere, holdAdskilt: [] });
    expect(f.borde['B1']!.map((p) => p.tekst)).toContain('Ida er eneste pige ved bordet igen');
    expect(f.status.map((s) => s.tekst)).toContain('1 er eneste af sit køn ved bordet igen');
    expect(f.status.map((s) => s.tekst)).toContain('1 elev mangler køn og tæller ikke med i kønsfordelingen');
  });

  it('roser en plan uden nogen alene om sit køn', () => {
    const f = forklar({ elever: seks, lokale, placering: { B1: ['a', 'c', 'f'], B2: ['b', 'd', 'e'] }, tidligere: [], holdAdskilt: [] });
    expect(f.status.map((s) => s.tekst)).toContain('Ingen er eneste af sit køn ved et bord');
  });
});
