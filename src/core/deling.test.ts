import { expect, it } from 'vitest';
import { planSomTekst } from './deling';
import { testLokale } from './testhjaelp';

it('skriver netværksgrupper og makkerpar som tekst', () => {
  const lokale = testLokale({ antalBorde: 2, pladserPrBord: 4, bordePrRaekke: 1 });
  const navne: Record<string, string> = { a: 'Ida', b: 'Malte', c: 'Sara', d: 'Omar', e: 'Emil', f: 'Lea', g: 'Noah' };
  const t = planSomTekst('2.c', { id: 'p', dato: '2026-10-30', lokale, placering: { B1: ['a', 'b', 'c', 'd'], B2: ['e', 'f', 'g', null] } }, (id) => navne[id]!);
  expect(t).toBe(
    '2.c, uge 44, 30. okt. 2026, lokale T\n\nNetværksgrupper og makkerpar:\n' +
      'Gruppe 1 (bord 1, forrest): Ida og Malte | Sara og Omar\n' +
      'Gruppe 2 (bord 2): Emil og Lea og Noah',
  );
});
