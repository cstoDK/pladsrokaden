import { describe, expect, it } from 'vitest';
import { fjernTomPlads, foreslaaIndstillinger, fraV1, lavLokale, normaliserLokale, sorterBorde, tilpasStoerrelse } from './lokale';
import { forresteBorde } from './model';

describe('lavLokale', () => {
  it('lægger borde i rækker med tavlen øverst og et mobilskab', () => {
    const l = lavLokale({ antalBorde: 5, pladserPrBord: 4, bordePrRaekke: 3 }, '007');
    expect(l.navn).toBe('007');
    expect(l.borde.map((b) => [b.x, b.y])).toEqual([[1, 2], [6, 2], [11, 2], [1, 4], [6, 4]]);
    expect(l.tavle.vaeg).toBe('top');
    expect(l.mobilskab).not.toBeNull();
    expect(l.bredde).toBeGreaterThanOrEqual(16);
  });
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
    expect(l.hoejde).toBe(6.5); // mindst 6, plus luft ved tavlen
  });
  it('foreslår opstillinger ud fra klassens størrelse', () => {
    expect(foreslaaIndstillinger('raekker', 31)).toEqual({ antalBorde: 3, pladserPrBord: 11, bordePrRaekke: 1 });
    expect(foreslaaIndstillinger('fire', 31)).toEqual({ antalBorde: 8, pladserPrBord: 4, bordePrRaekke: 3 });
    expect(foreslaaIndstillinger('par', 9)).toMatchObject({ antalBorde: 5, pladserPrBord: 2 });
  });
});

describe('fraV1', () => {
  it('bevarer bordenes id og pladser og omsætter rækker til positioner', () => {
    const l = fraV1({ borde: [{ id: 'a', raekke: 0, kolonne: 0, pladser: 2 }, { id: 'b', raekke: 1, kolonne: 1, pladser: 2 }], forresteRaekker: 1 });
    expect(l.borde.map((b) => [b.id, b.x, b.y, b.pladser])).toEqual([['a', 1, 2, 2], ['b', 4, 4, 2]]);
    expect([...forresteBorde(l)]).toEqual(['a']);
  });
});
