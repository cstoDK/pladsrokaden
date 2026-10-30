import { describe, expect, it } from 'vitest';
import { type Bord, type Lokale } from './model';
import { lavPlacering } from './optimering';
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

// Som lærerens lokale: borde à 2, sat sammen to og to, men bord 3 står for sig selv.
function lokaleMedEnligtBord(): Lokale {
  const bord = (id: string, x: number, y: number): Bord => ({ id, x, y, pladser: 2, lodret: false });
  const borde: Bord[] = [bord('B1', 1, 1.5), bord('B2', 3, 1.5), bord('B3', 10, 1.5)];
  for (const [r, y] of [2.8, 4.1, 5.4].entries()) {
    borde.push(bord(`V${r}a`, 1, y), bord(`V${r}b`, 3, y), bord(`H${r}a`, 8, y), bord(`H${r}b`, 10, y));
  }
  return { id: 'L', navn: '', bredde: 14, hoejde: 8, borde, tavle: { vaeg: 'top', midte: 7, laengde: 6 }, mobilskab: null } as unknown as Lokale;
}

describe('ingen netværksgruppe på under tre', () => {
  it('to ved et bord for sig slås sammen med bordene bagved: 2 + 4 bliver 3 + 3', () => {
    const l = lokaleMedEnligtBord();
    const g = planGrupper(l, { B1: ['a', 'b'], B2: ['c', 'd'], B3: ['e', 'f'], H0a: ['g', 'h'], H0b: ['i', 'j'] });
    expect(g.map((x) => x.par.flat().length)).toEqual([4, 3, 3]);
    // Gruppen med bord 3 sidder lige foran bordet bagved (H0b), så de kan vende sig om.
    const medB3 = g.find((x) => x.par.flat().includes('e'))!;
    expect(medB3.pladser.map((p) => p.bordId).sort()).toEqual(['B3', 'B3', 'H0b']);
  });
  it('én ved et bord for sig giver en gruppe på fem', () => {
    const l = lokaleMedEnligtBord();
    const g = planGrupper(l, { B1: ['a', 'b'], B2: ['c', 'd'], B3: ['e', null], H0a: ['g', 'h'], H0b: ['i', 'j'] });
    expect(g.map((x) => x.par.flat().length)).toEqual([4, 5]);
  });
  it('optimeringen laver aldrig grupper på under tre i lærerens lokale', () => {
    const l = lokaleMedEnligtBord();
    for (const antal of [25, 26, 27, 28, 29, 30]) {
      const elever = Array.from({ length: antal }, (_, i) => ({ id: `e${i}`, navn: `E${i}`, koen: (i % 2 ? 'D' : 'P') as 'D' | 'P' }));
      const { placering } = lavPlacering({ elever, lokale: l, tidligere: [], holdAdskilt: [], laase: [], seed: 1 });
      const g = planGrupper(l, placering);
      expect(Math.min(...g.map((x) => x.par.flat().length)), `${antal} elever`).toBeGreaterThanOrEqual(3);
    }
  });
});
