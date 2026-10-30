import { describe, expect, it } from 'vitest';
import { belaegning, kontrollerInput, lavPlacering, PlanFejl } from './optimering';
import { type ElevId, type Plan } from './model';
import { planGrupper } from './struktur';
import { alene, bordGrupper, forreste, gruppepar, lavElever, makkerpar, par, simuler, testLokale } from './testhjaelp';

const ingen = { tidligere: [] as Plan[], holdAdskilt: [] as [ElevId, ElevId][], laase: [] };

describe('belaegning', () => {
  it('fordeler de tomme pladser jævnt', () => {
    expect(belaegning([11, 10, 10], 28)).toEqual([10, 9, 9]);
    expect(belaegning([4, 4, 4, 4, 4, 4, 4, 4], 31)).toEqual([4, 4, 4, 4, 4, 4, 4, 3]);
    expect(belaegning([4, 4, 4], 9)).toEqual([3, 3, 3]);
  });
  it('lader bageste borde stå tomme, når de forreste kan rumme alle', () => {
    expect(belaegning([4, 4, 4, 4, 4, 4, 4, 4], 26)).toEqual([4, 4, 4, 4, 4, 3, 3, 0]);
    expect(belaegning(new Array(14).fill(2), 10)).toEqual([2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });
  it('giver aldrig et bord kun én elev, når det kan undgås', () => {
    // Ulige antal elever og kun borde à 2: én må sidde alene. Lokale-editoren advarer om det.
    expect(belaegning([2, 2, 2], 5)).toEqual([2, 2, 1]);
    expect(belaegning([3, 3], 5)).toEqual([3, 2]);
    expect(belaegning([4, 4, 4], 6)).toEqual([3, 3, 0]);
  });
  it('tager hensyn til låste elever', () => {
    expect(belaegning([4, 4, 4], 6, [0, 0, 1])).toEqual([3, 0, 3]);
  });
});

describe('lavPlacering: grundlæggende', () => {
  it('placerer hver elev præcis én gang og giver samme resultat med samme startværdi', () => {
    const elever = lavElever(15, 16);
    const lokale = testLokale({ antalBorde: 8, pladserPrBord: 4, bordePrRaekke: 2 });
    const a = lavPlacering({ elever, lokale, ...ingen, seed: 4 });
    const placeret = Object.values(a.placering).flat().filter(Boolean);
    expect(new Set(placeret).size).toBe(31);
    expect(lavPlacering({ elever, lokale, ...ingen, seed: 4 }).placering).toEqual(a.placering);
  });

  it('ingen sidder alene, og de tomme pladser er i enden af bordet', () => {
    const tilfaelde = [
      { elever: 31, borde: 3, pladser: 11, prRaekke: 1 },
      { elever: 28, borde: 3, pladser: 11, prRaekke: 1 },
      { elever: 26, borde: 8, pladser: 4, prRaekke: 3 },
      { elever: 22, borde: 12, pladser: 2, prRaekke: 4 },
    ];
    for (const t of tilfaelde) {
      const elever = lavElever(Math.floor(t.elever / 2), Math.ceil(t.elever / 2));
      const lokale = testLokale({ antalBorde: t.borde, pladserPrBord: t.pladser, bordePrRaekke: t.prRaekke });
      for (const plan of simuler(elever, lokale, 2)) {
        for (const b of lokale.borde) {
          const pladser = plan.placering[b.id]!;
          const antal = pladser.filter(Boolean).length;
          expect(antal).not.toBe(1);
          expect(pladser.slice(0, antal).every(Boolean)).toBe(true); // tomme kun i enden
        }
      }
    }
  });

  it('afviser for mange elever med en besked, der siger hvad man gør', () => {
    const elever = lavElever(10, 10);
    const lokale = testLokale({ antalBorde: 4, pladserPrBord: 4, bordePrRaekke: 2 });
    expect(kontrollerInput({ elever, lokale, laase: [] })[0]).toMatch(/Tilføj borde/);
    expect(() => lavPlacering({ elever, lokale, ...ingen })).toThrow(PlanFejl);
  });
});

describe('lavPlacering: makkerpar og netværksgrupper', () => {
  const elever = lavElever(16, 16);
  const lokale = testLokale({ antalBorde: 8, pladserPrBord: 4, bordePrRaekke: 2 });

  it('makkerpar er en pige og en dreng, når kønsfordelingen tillader det', () => {
    for (const plan of simuler(elever, lokale, 4)) {
      for (const g of planGrupper(plan.lokale, plan.placering)) {
        for (const p of g.par) expect(p.map((id) => id[0]).sort().join('')).toBe('DP');
      }
    }
  });

  it('ingen får samme makker igen over 6 runder', () => {
    const set = new Set<string>();
    for (const plan of simuler(elever, lokale, 6)) {
      for (const p of makkerpar(plan)) {
        expect(set.has(p)).toBe(false);
        set.add(p);
      }
    }
  });

  it('ingen er i netværksgruppe med en fra sidste gruppe over 4 runder', () => {
    let forrige = new Set<string>();
    for (const plan of simuler(elever, lokale, 4)) {
      const nu = gruppepar(plan);
      for (const p of nu) expect(forrige.has(p)).toBe(false);
      forrige = new Set(nu);
    }
  });

  it('lange rækker deles i grupper af fire med blandede makkerpar', () => {
    const e = lavElever(15, 16);
    const l = testLokale({ antalBorde: 3, pladserPrBord: 11, bordePrRaekke: 1 });
    const [plan] = simuler(e, l, 1);
    const g = planGrupper(plan!.lokale, plan!.placering);
    expect(g.every((x) => x.par.flat().length >= 3 && x.par.flat().length <= 4)).toBe(true);
    const blandede = g.flatMap((x) => x.par).filter((p) => new Set(p.map((id) => id[0])).size > 1).length;
    expect(blandede).toBeGreaterThanOrEqual(g.flatMap((x) => x.par).length - 1);
  });
});

describe('lavPlacering: forrest, køn og regler', () => {
  it('forreste borde roterer retfærdigt over 6 runder', () => {
    const elever = lavElever(16, 16);
    const lokale = testLokale({ antalBorde: 8, pladserPrBord: 4, bordePrRaekke: 2 });
    const gange = new Map(elever.map((e) => [e.id, 0]));
    let forrige = new Set<ElevId>();
    for (const plan of simuler(elever, lokale, 6)) {
      const nu = forreste(plan);
      expect(nu).toHaveLength(8);
      for (const id of nu) {
        expect(forrige.has(id)).toBe(false);
        gange.set(id, gange.get(id)! + 1);
      }
      forrige = new Set(nu);
    }
    const tal = [...gange.values()];
    expect(Math.max(...tal) - Math.min(...tal)).toBeLessThanOrEqual(1);
  });

  it('ingen er eneste af sit køn i gruppen to gange i træk, når det kan undgås', () => {
    // 5 piger og 7 drenge ved 3 borde à 4: mindst én er altid alene om sit køn.
    const elever = lavElever(5, 7);
    const lokale = testLokale({ antalBorde: 3, pladserPrBord: 4, bordePrRaekke: 3 });
    for (let seed = 1; seed <= 3; seed++) {
      let forrige = new Set<ElevId>();
      for (const plan of simuler(elever, lokale, 6, { seed })) {
        const nu = alene(plan, elever);
        expect(nu.length).toBeLessThanOrEqual(1);
        for (const id of nu) expect(forrige.has(id)).toBe(false);
        forrige = new Set(nu);
      }
    }
  });

  it('"hold adskilt" overholdes altid, også ved lange rækker', () => {
    const elever = lavElever(10, 10);
    const lokale = testLokale({ antalBorde: 2, pladserPrBord: 11, bordePrRaekke: 1 });
    const holdAdskilt: [ElevId, ElevId][] = [['P0', 'D0'], ['P1', 'D1']];
    for (let seed = 1; seed <= 4; seed++) {
      for (const plan of simuler(elever, lokale, 3, { holdAdskilt, seed })) {
        const sammen = new Set(par(plan));
        for (const [a, b] of holdAdskilt) expect(sammen.has([a, b].sort().join('|'))).toBe(false);
      }
    }
  });

  it('låste elever flyttes ikke', () => {
    const elever = lavElever(12, 12);
    const lokale = testLokale({ antalBorde: 6, pladserPrBord: 4, bordePrRaekke: 3 });
    const laase = [
      { elevId: 'P0', bordId: 'B1', plads: 0 },
      { elevId: 'D3', bordId: 'B5', plads: 2 },
    ];
    for (const plan of simuler(elever, lokale, 4, { laase })) {
      expect(plan.placering['B1']![0]).toBe('P0');
      expect(plan.placering['B5']![2]).toBe('D3');
    }
  });

  it('elever uden køn giver ikke fejl', () => {
    const lokale = testLokale({ antalBorde: 4, pladserPrBord: 4, bordePrRaekke: 2 });
    expect(() => simuler(lavElever(5, 5, 4), lokale, 3)).not.toThrow();
    expect(bordGrupper(simuler(lavElever(5, 5, 4), lokale, 1)[0]!).flat()).toHaveLength(14);
  });

  it('tager under et sekund for 35 elever med historik', () => {
    const elever = lavElever(17, 18);
    for (const ind of [
      { antalBorde: 3, pladserPrBord: 12, bordePrRaekke: 1 },
      { antalBorde: 9, pladserPrBord: 4, bordePrRaekke: 3 },
    ]) {
      const lokale = testLokale(ind);
      const tidligere = simuler(elever, lokale, 8);
      const start = performance.now();
      lavPlacering({ elever, lokale, tidligere, holdAdskilt: [['P0', 'D0']], laase: [], seed: 9 });
      expect(performance.now() - start).toBeLessThan(1000);
    }
  });
});
