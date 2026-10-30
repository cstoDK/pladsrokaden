import { describe, expect, it } from 'vitest';
import { kanSaettesSammen, saetSammenToOgTo, flytMobilskabFri, fraDybeBorde, fjernTomPlads, sugSammen, foreslaaIndstillinger, fraV1, lavLokale, normaliserLokale, sorterBorde, tilpasStoerrelse } from './lokale';
import { bordRaekker, forresteBorde, staarSammen } from './model';

describe('lavLokale', () => {
  it('lægger borde i rækker med tavlen øverst og et mobilskab', () => {
    const l = lavLokale({ antalBorde: 5, pladserPrBord: 4, bordePrRaekke: 3 }, '007');
    expect(l.navn).toBe('007');
    expect(l.borde.map((b) => [b.x, b.y])).toEqual([[1, 1.5], [6, 1.5], [11, 1.5], [1, 2.8], [6, 2.8]]);
    expect(l.tavle.vaeg).toBe('top');
    expect(l.mobilskab).not.toBeNull();
    expect(l.bredde).toBeGreaterThanOrEqual(16);
  });
});

describe('borde, der står sammen', () => {
  it('borde à 2 stilles to og to, og hvert par danner én række', () => {
    const l = lavLokale({ antalBorde: 6, pladserPrBord: 2, bordePrRaekke: 6, toOgTo: true });
    expect(l.borde.map((b) => b.x)).toEqual([1, 3, 6, 8, 11, 13]);
    expect(bordRaekker(l).map((r) => r.length)).toEqual([2, 2, 2]);
  });
  it('kun borde kant i kant i samme retning står sammen', () => {
    const l = lavLokale({ antalBorde: 3, pladserPrBord: 2, bordePrRaekke: 3 });
    expect(bordRaekker(l).map((r) => r.length)).toEqual([1, 1, 1]);
    l.borde[1]!.x = l.borde[0]!.x + 2;
    expect(bordRaekker(l).map((r) => r.length)).toEqual([2, 1]);
    l.borde[1]!.lodret = true;
    expect(staarSammen(l.borde[0]!, l.borde[1]!)).toBe(false);
  });
});

it('"Sæt bordene sammen to og to" stiller hver række i par med en gang imellem', () => {
  const l = lavLokale({ antalBorde: 6, pladserPrBord: 2, bordePrRaekke: 4 }); // med mellemrum
  expect(kanSaettesSammen(l)).toBe(true);
  saetSammenToOgTo(l);
  expect(l.borde.map((b) => [b.x, b.y])).toEqual([[1, 1.5], [3, 1.5], [6, 1.5], [8, 1.5], [1, 2.8], [3, 2.8]]);
  expect(bordRaekker(l).map((r) => r.length)).toEqual([2, 2, 2]);
  expect(kanSaettesSammen(l)).toBe(false);
});

it('lokaler fra version 1 får et mobilskab', () => {
  const l = fraV1({ borde: [{ id: 'a', raekke: 0, kolonne: 0, pladser: 2 }], forresteRaekker: 1 });
  expect(l.mobilskab).not.toBeNull();
});

it('mobilskabet flyttes fri, hvis det står oven i et bord', () => {
  const l = lavLokale({ antalBorde: 2, pladserPrBord: 4, bordePrRaekke: 1 });
  l.mobilskab = { x: l.borde[1]!.x, y: l.borde[1]!.y };
  flytMobilskabFri(l);
  expect(l.mobilskab.y).toBeGreaterThanOrEqual(l.borde[1]!.y + 0.6);
});

it('et bord, der slippes tæt på et andet, sættes kant i kant', () => {
  const l = lavLokale({ antalBorde: 2, pladserPrBord: 2, bordePrRaekke: 2 });
  l.borde[1]!.x = l.borde[0]!.x + 2.5;
  l.borde[1]!.y = l.borde[0]!.y + 0.3;
  expect(sugSammen(l, l.borde[1]!.id)).toBe(true);
  expect([l.borde[1]!.x, l.borde[1]!.y]).toEqual([l.borde[0]!.x + 2, l.borde[0]!.y]);
  expect(bordRaekker(l)).toHaveLength(1);
});

describe('forresteBorde', () => {
  it('er de borde, der står nærmest tavlen', () => {
    const l = lavLokale({ antalBorde: 6, pladserPrBord: 4, bordePrRaekke: 3 });
    const f = forresteBorde(l);
    expect(l.borde.map((b) => f.has(b.id))).toEqual([true, true, true, false, false, false]);
    l.tavle.vaeg = 'bund';
    const g = forresteBorde(l);
    expect(l.borde.map((b) => g.has(b.id))).toEqual([false, false, false, true, true, true]);
  });
  it('kan sættes af læreren', () => {
    const l = lavLokale({ antalBorde: 4, pladserPrBord: 4, bordePrRaekke: 2 });
    l.borde[3]!.forrest = true;
    l.borde[0]!.forrest = false;
    const f = forresteBorde(l);
    expect(l.borde.map((b) => f.has(b.id))).toEqual([false, true, false, true]);
  });
});

describe('størrelse og rækkefølge', () => {
  it('lokalet vokser med indholdet', () => {
    const l = lavLokale({ antalBorde: 1, pladserPrBord: 4, bordePrRaekke: 1 });
    l.borde[0]!.x = 20;
    tilpasStoerrelse(l);
    expect(l.bredde).toBe(25);
  });
  it('bordene nummereres forfra set fra tavlen', () => {
    const l = lavLokale({ antalBorde: 4, pladserPrBord: 2, bordePrRaekke: 2 });
    const [a, b, c, d] = l.borde.map((x) => x.id);
    l.tavle.vaeg = 'bund';
    sorterBorde(l);
    expect(l.borde.map((x) => x.id)).toEqual([c, d, a, b]);
    expect(normaliserLokale(l)).not.toBe(l);
  });
  it('fjerner tom plads ved den væg, tavlen er flyttet fra', () => {
    const l = lavLokale({ antalBorde: 2, pladserPrBord: 4, bordePrRaekke: 2 });
    l.tavle.vaeg = 'bund';
    l.mobilskab = null;
    fjernTomPlads(l);
    expect(l.borde.map((b) => [b.x, b.y])).toEqual([[1, 1], [6, 1]]);
    expect(l.hoejde).toBe(4.5); // mindst 4, plus luft ved tavlen
  });
  it('foreslår opstillinger ud fra klassens størrelse', () => {
    expect(foreslaaIndstillinger('raekker', 31)).toEqual({ antalBorde: 3, pladserPrBord: 11, bordePrRaekke: 1 });
    expect(foreslaaIndstillinger('fire', 31)).toEqual({ antalBorde: 8, pladserPrBord: 4, bordePrRaekke: 3 });
    expect(foreslaaIndstillinger('par', 9)).toMatchObject({ antalBorde: 5, pladserPrBord: 2, toOgTo: true });
  });
});

it('lokaler fra version 2 presses sammen lodret, fordi bordene nu er lavere', () => {
  const l = lavLokale({ antalBorde: 2, pladserPrBord: 4, bordePrRaekke: 1 });
  l.borde[0]!.y = 2;
  l.borde[1]!.y = 4;
  fraDybeBorde(l);
  expect(l.borde.map((b) => b.y)).toEqual([1.5, 3]);
});

describe('fraV1', () => {
  it('bevarer bordenes id og pladser og omsætter rækker til positioner', () => {
    const l = fraV1({ borde: [{ id: 'a', raekke: 0, kolonne: 0, pladser: 2 }, { id: 'b', raekke: 1, kolonne: 1, pladser: 2 }], forresteRaekker: 1 });
    expect(l.borde.map((b) => [b.id, b.x, b.y, b.pladser])).toEqual([['a', 1, 1.5, 2], ['b', 4, 2.8, 2]]);
    expect([...forresteBorde(l)]).toEqual(['a']);
  });
});
