import { describe, expect, it } from 'vitest';
import { kontrollerInput, lavPlacering, PlanFejl } from './optimering';
import { type ElevId, type Plan } from './model';
import { alene, bordGrupper, forreste, lavElever, par, simuler, testLokale } from './testhjaelp';

const ingen = { tidligere: [] as Plan[], holdAdskilt: [] as [ElevId, ElevId][], laase: [] };

describe('lavPlacering: grundlæggende', () => {
  it('placerer hver elev præcis én gang', () => {
    const elever = lavElever(13, 14);
    const lokale = testLokale({ antalBorde: 14, pladserPrBord: 2, bordePrRaekke: 4, forresteRaekker: 1 });
    const { placering } = lavPlacering({ elever, lokale, ...ingen, seed: 1 });
    const placeret = Object.values(placering).flat().filter(Boolean);
    expect(placeret).toHaveLength(27);
    expect(new Set(placeret).size).toBe(27);
    for (const b of lokale.borde) expect(placering[b.id]).toHaveLength(b.pladser);
  });

  it('giver samme resultat med samme startværdi', () => {
    const elever = lavElever(10, 10);
    const lokale = testLokale({ antalBorde: 5, pladserPrBord: 4, bordePrRaekke: 3, forresteRaekker: 1 });
    const a = lavPlacering({ elever, lokale, ...ingen, seed: 42 });
    const b = lavPlacering({ elever, lokale, ...ingen, seed: 42 });
    expect(a.placering).toEqual(b.placering);
  });

  it('fordeler jævnt, når elevtallet ikke passer (højst én i forskel)', () => {
    const tilfaelde = [
      { elever: 25, borde: 7, pladser: 4 },
      { elever: 29, borde: 15, pladser: 2 },
      { elever: 22, borde: 6, pladser: 5 },
      { elever: 10, borde: 4, pladser: 4 },
    ];
    for (const t of tilfaelde) {
      const elever = lavElever(Math.floor(t.elever / 2), Math.ceil(t.elever / 2));
      const lokale = testLokale({ antalBorde: t.borde, pladserPrBord: t.pladser, bordePrRaekke: 3, forresteRaekker: 1 });
      const planer = simuler(elever, lokale, 3);
      for (const plan of planer) {
        const antal = bordGrupper(plan).map((g) => g.length);
        expect(Math.max(...antal) - Math.min(...antal)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('afviser for mange elever med en besked, der siger hvad man gør', () => {
    const elever = lavElever(10, 10);
    const lokale = testLokale({ antalBorde: 9, pladserPrBord: 2, bordePrRaekke: 3, forresteRaekker: 1 });
    expect(kontrollerInput({ elever, lokale, laase: [] })[0]).toMatch(/Tilføj borde/);
    expect(() => lavPlacering({ elever, lokale, ...ingen })).toThrow(PlanFejl);
  });

  it('kan lave en plan for én elev og for ét bord', () => {
    const lokale1 = testLokale({ antalBorde: 3, pladserPrBord: 2, bordePrRaekke: 3, forresteRaekker: 1 });
    expect(Object.values(lavPlacering({ elever: lavElever(1, 0), lokale: lokale1, ...ingen }).placering).flat().filter(Boolean)).toHaveLength(1);
    const lokale2 = testLokale({ antalBorde: 1, pladserPrBord: 5, bordePrRaekke: 1, forresteRaekker: 1 });
    expect(Object.values(lavPlacering({ elever: lavElever(2, 2), lokale: lokale2, ...ingen }).placering).flat().filter(Boolean)).toHaveLength(4);
  });
});

describe('lavPlacering: regler', () => {
  it('låste elever flyttes ikke', () => {
    const elever = lavElever(12, 12);
    const lokale = testLokale({ antalBorde: 6, pladserPrBord: 4, bordePrRaekke: 3, forresteRaekker: 1 });
    const laase = [
      { elevId: 'P0', bordId: 'B1', plads: 0 },
      { elevId: 'D3', bordId: 'B5', plads: 2 },
    ];
    const planer = simuler(elever, lokale, 4, { laase });
    for (const plan of planer) {
      expect(plan.placering['B1']![0]).toBe('P0');
      expect(plan.placering['B5']![2]).toBe('D3');
    }
  });

  it('jævn fordeling holder også med låste elever', () => {
    const elever = lavElever(5, 5);
    const lokale = testLokale({ antalBorde: 4, pladserPrBord: 4, bordePrRaekke: 2, forresteRaekker: 1 });
    const laase = [
      { elevId: 'P0', bordId: 'B1', plads: 0 },
      { elevId: 'P1', bordId: 'B1', plads: 1 },
    ];
    for (const plan of simuler(elever, lokale, 3, { laase })) {
      const antal = bordGrupper(plan).map((g) => g.length);
      expect(Math.max(...antal) - Math.min(...antal)).toBeLessThanOrEqual(1);
    }
  });

  it('"hold adskilt" overholdes altid', () => {
    const elever = lavElever(8, 8);
    const lokale = testLokale({ antalBorde: 4, pladserPrBord: 4, bordePrRaekke: 2, forresteRaekker: 1 });
    const holdAdskilt: [ElevId, ElevId][] = [
      ['P0', 'D0'],
      ['P0', 'P1'],
      ['D1', 'D2'],
      ['P2', 'D3'],
    ];
    for (let seed = 1; seed <= 5; seed++) {
      for (const plan of simuler(elever, lokale, 4, { holdAdskilt, seed })) {
        const parret = new Set(par(plan));
        for (const [a, b] of holdAdskilt) expect(parret.has([a, b].sort().join('|'))).toBe(false);
      }
    }
  });

  it('ingen gentagne makkere over 6 runder med borde à 2', () => {
    const elever = lavElever(14, 16);
    const lokale = testLokale({ antalBorde: 15, pladserPrBord: 2, bordePrRaekke: 5, forresteRaekker: 1 });
    const set = new Set<string>();
    for (const plan of simuler(elever, lokale, 6)) {
      for (const p of par(plan)) {
        expect(set.has(p)).toBe(false);
        set.add(p);
      }
    }
  });

  it('ingen gentagne par over 3 runder med grupper à 4', () => {
    // 2 af 6 borde forrest. (Med 3 af 6 forrest kan gentagelser ikke undgås:
    // de nye forreste borde skulle dannes af elever fra kun 3 tidligere borde.)
    const elever = lavElever(12, 12);
    const lokale = testLokale({ antalBorde: 6, pladserPrBord: 4, bordePrRaekke: 2, forresteRaekker: 1 });
    const set = new Set<string>();
    for (const plan of simuler(elever, lokale, 3)) {
      for (const p of par(plan)) {
        expect(set.has(p)).toBe(false);
        set.add(p);
      }
    }
  });

  it('forreste række roterer retfærdigt over 6 runder', () => {
    const elever = lavElever(13, 15);
    const lokale = testLokale({ antalBorde: 14, pladserPrBord: 2, bordePrRaekke: 4, forresteRaekker: 1 });
    const planer = simuler(elever, lokale, 6);
    const gange = new Map(elever.map((e) => [e.id, 0]));
    let forrige = new Set<ElevId>();
    for (const plan of planer) {
      const nu = forreste(plan);
      expect(nu).toHaveLength(8);
      for (const id of nu) {
        expect(forrige.has(id)).toBe(false); // aldrig forrest to gange i træk
        gange.set(id, gange.get(id)! + 1);
      }
      forrige = new Set(nu);
    }
    const tal = [...gange.values()];
    expect(Math.max(...tal) - Math.min(...tal)).toBeLessThanOrEqual(1);
  });

  it('forreste roterer også med to forreste rækker og grupper', () => {
    const elever = lavElever(12, 12);
    const lokale = testLokale({ antalBorde: 6, pladserPrBord: 4, bordePrRaekke: 2, forresteRaekker: 1 });
    const gange = new Map(elever.map((e) => [e.id, 0]));
    for (const plan of simuler(elever, lokale, 6)) for (const id of forreste(plan)) gange.set(id, gange.get(id)! + 1);
    const tal = [...gange.values()];
    expect(Math.max(...tal) - Math.min(...tal)).toBeLessThanOrEqual(1);
  });

  it('ingen er eneste af sit køn to gange i træk, når det kan undgås', () => {
    // 5 piger og 7 drenge ved 3 borde à 4: mindst én er altid alene om sit køn.
    const elever = lavElever(5, 7);
    const lokale = testLokale({ antalBorde: 3, pladserPrBord: 4, bordePrRaekke: 3, forresteRaekker: 1 });
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

  it('kønsfordelingen følger klassen ved hvert bord', () => {
    const elever = lavElever(12, 12);
    const lokale = testLokale({ antalBorde: 6, pladserPrBord: 4, bordePrRaekke: 3, forresteRaekker: 1 });
    const { placering } = lavPlacering({ elever, lokale, ...ingen, seed: 3 });
    for (const b of lokale.borde) {
      const piger = placering[b.id]!.filter((id) => id?.startsWith('P')).length;
      expect(piger).toBe(2);
    }
  });

  it('elever uden køn giver ikke fejl', () => {
    const elever = lavElever(5, 5, 4);
    const lokale = testLokale({ antalBorde: 4, pladserPrBord: 4, bordePrRaekke: 2, forresteRaekker: 1 });
    expect(() => simuler(elever, lokale, 3)).not.toThrow();
  });
});

describe('lavPlacering: hastighed', () => {
  it('tager under et sekund for 35 elever med historik', () => {
    const elever = lavElever(17, 18);
    const lokale = testLokale({ antalBorde: 9, pladserPrBord: 4, bordePrRaekke: 3, forresteRaekker: 1 });
    const tidligere = simuler(elever, lokale, 10);
    const start = performance.now();
    lavPlacering({ elever, lokale, tidligere, holdAdskilt: [['P0', 'D0']], laase: [], seed: 9 });
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
