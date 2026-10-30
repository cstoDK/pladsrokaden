import { describe, expect, it } from 'vitest';
import { forklar } from './forklaring';
import { type Elev, type Plan } from './model';
import { testLokale } from './testhjaelp';

const elever: Elev[] = [
  { id: 'a', navn: 'Ida', koen: 'P' },
  { id: 'b', navn: 'Malte', koen: 'D' },
  { id: 'c', navn: 'Sara', koen: 'P' },
  { id: 'd', navn: 'Omar', koen: 'D' },
  { id: 'e', navn: 'Emil', koen: 'D' },
  { id: 'f', navn: 'Lea', koen: null },
];
const lokale = testLokale({ antalBorde: 2, pladserPrBord: 4, bordePrRaekke: 1 }); // B1 forrest
const tekster = (f: ReturnType<typeof forklar>) => f.status.map((s) => s.tekst);

describe('forklar', () => {
  const sidst: Plan = { id: 'p', dato: '2026-01-01', lokale, placering: { B1: ['a', 'b', 'c', 'd'], B2: ['e', 'f', null, null] } };

  it('melder nye makkere, grupper og blandede par', () => {
    const f = forklar({ elever, lokale, placering: { B1: ['e', 'a', 'f', 'c'], B2: ['b', 'd', null, null] }, tidligere: [sidst], holdAdskilt: [] });
    expect(tekster(f)).toContain('Alle har en ny makker');
    expect(tekster(f)).toContain('2 er forrest igen'); // Ida og Sara
    expect(tekster(f)).toContain('1 makkerpar er ikke blandet');
    expect(f.borde['B2']!.map((p) => p.tekst)).toEqual(['Malte og Omar er to drenge']);
  });

  it('melder makkere og gruppe fra sidst, og forrest igen', () => {
    const f = forklar({ elever, lokale, placering: { B1: ['a', 'b', 'e', 'f'], B2: ['c', 'd', null, null] }, tidligere: [sidst], holdAdskilt: [] });
    expect(tekster(f)).toContain('3 makkerpar er det samme som sidst'); // Ida+Malte, Emil+Lea, Sara+Omar
    expect(tekster(f)).toContain('3 par af elever var også i samme netværksgruppe sidst');
    expect(tekster(f)).toContain('2 er forrest igen');
    expect(f.borde['B1']!.map((p) => p.tekst)).toContain('Ida og Malte var også makkere sidst');
  });

  it('melder elever alene ved et bord og brudt "hold adskilt" som fejl', () => {
    const f = forklar({ elever, lokale, placering: { B1: ['a', 'b', 'c', 'd'], B2: ['e', null, null, null] }, tidligere: [], holdAdskilt: [['a', 'b']] });
    expect(f.status).toContainEqual({ niveau: 'fejl', tekst: '1 elev sidder alene ved et bord' });
    expect(f.status).toContainEqual({ niveau: 'fejl', tekst: '1 par, der skal holdes adskilt, sidder ved samme bord' });
    expect(f.borde['B2']![0]).toMatchObject({ niveau: 'fejl', tekst: 'Emil sidder alene ved bordet' });
  });

  it('navngiver den, der er eneste af sit køn i gruppen', () => {
    const f = forklar({ elever, lokale, placering: { B1: ['a', 'b', 'd', 'e'], B2: ['c', 'f', null, null] }, tidligere: [], holdAdskilt: [] });
    expect(f.borde['B1']!.map((p) => p.tekst)).toContain('Ida er eneste pige i gruppe 1');
    expect(tekster(f)).toContain('1 er eneste af sit køn i gruppen');
  });
});
