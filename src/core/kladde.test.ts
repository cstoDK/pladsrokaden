import { describe, expect, it } from 'vitest';
import { byt, gyldigeLaase, lavKladde, manglerIPlan, skiftLaas } from './kladde';
import { type Kladde, nyKlasse } from './model';
import { lavElever, testLokale } from './testhjaelp';

function kladde(): Kladde {
  const lokale = testLokale({ antalBorde: 2, pladserPrBord: 2, bordePrRaekke: 2 });
  return {
    plan: { id: 'p', dato: '2026-10-30', lokale, placering: { B1: ['a', 'b'], B2: ['c', null] } },
    laase: [{ elevId: 'a', bordId: 'B1', plads: 0 }],
  };
}

describe('byt', () => {
  it('bytter to elever, og låsen følger eleven', () => {
    const k = byt(kladde(), { bordId: 'B1', plads: 0 }, { bordId: 'B2', plads: 0 });
    expect(k.plan.placering).toEqual({ B1: ['c', 'b'], B2: ['a', null] });
    expect(k.laase).toEqual([{ elevId: 'a', bordId: 'B2', plads: 0 }]);
  });
  it('flytter til en tom plads uden at ændre originalen', () => {
    const k0 = kladde();
    const k = byt(k0, { bordId: 'B1', plads: 1 }, { bordId: 'B2', plads: 1 });
    expect(k.plan.placering).toEqual({ B1: ['a', null], B2: ['c', 'b'] });
    expect(k0.plan.placering['B1']).toEqual(['a', 'b']);
  });
});

it('skiftLaas låser og låser op', () => {
  const k = skiftLaas(kladde(), 'c');
  expect(k.laase).toContainEqual({ elevId: 'c', bordId: 'B2', plads: 0 });
  expect(skiftLaas(k, 'a').laase.map((l) => l.elevId)).toEqual(['c']);
});

describe('lavKladde', () => {
  it('respekterer faste pladser og giver fejl ved for få pladser eller intet lokale', () => {
    const k = nyKlasse('1.a', lavElever(3, 3));
    k.faste = [{ elevId: 'P1', bordId: 'B2', plads: 1 }];
    const r = lavKladde(k, testLokale({ antalBorde: 2, pladserPrBord: 4, bordePrRaekke: 2 }), '2026-10-30', undefined, 5);
    expect('kladde' in r && r.kladde.plan.placering['B2']![1]).toBe('P1');
    expect(lavKladde(k, testLokale({ antalBorde: 1, pladserPrBord: 4, bordePrRaekke: 1 }), '2026-10-30')).toEqual({ fejl: expect.stringMatching(/Tilføj borde/) });
    expect(lavKladde(k, null, '2026-10-30')).toEqual({ fejl: 'Vælg først et lokale.' });
  });
  it('dropper låse til borde, der ikke findes længere', () => {
    const lokale = testLokale({ antalBorde: 1, pladserPrBord: 2, bordePrRaekke: 1 });
    expect(gyldigeLaase([{ elevId: 'a', bordId: 'B9', plads: 0 }, { elevId: 'a', bordId: 'B1', plads: 5 }], lokale, [{ id: 'a' }])).toEqual([]);
  });
});

it('manglerIPlan finder nye elever', () => {
  expect(manglerIPlan({ B1: ['a', null] }, [{ id: 'a' }, { id: 'z' }])).toEqual(['z']);
});
