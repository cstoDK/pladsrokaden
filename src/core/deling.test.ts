import { expect, it } from 'vitest';
import { planSomTekst } from './deling';
import { testLokale } from './testhjaelp';

it('skriver planen som tekst med ét bord pr. linje', () => {
  const lokale = testLokale({ antalBorde: 3, pladserPrBord: 2, bordePrRaekke: 2, forresteRaekker: 1 });
  const navne: Record<string, string> = { a: 'Ida', b: 'Malte', c: 'Sara' };
  const t = planSomTekst('2.c', { id: 'p', dato: '2026-10-30', lokale, placering: { B1: ['a', 'b'], B2: [null, 'c'], B3: [null, null] } }, (id) => navne[id]!);
  expect(t).toBe('2.c, uge 44, 30. okt. 2026\n\nBord 1 (forrest): Ida, Malte\nBord 2 (forrest): Sara\nBord 3: tomt');
});
