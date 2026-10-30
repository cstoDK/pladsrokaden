import { expect, it } from 'vitest';
import { sammenlign } from './sammenlign';
import { type Elev } from './model';

const elever: Elev[] = [
  { id: 'a', navn: 'Ida', koen: 'P' },
  { id: 'b', navn: 'Malte', koen: null },
  { id: 'c', navn: 'Emil H.', koen: 'D' },
  { id: 'd', navn: 'Emil J.', koen: 'D' },
  { id: 'e', navn: 'Sara', koen: 'P' },
];

it('finder elever begge steder, kun på listen og kun i klassen', () => {
  const r = sammenlign(elever, [
    { fornavn: 'Ida', efternavnStart: 'Te', koen: 'P', hold: 'GF02' },
    { fornavn: 'Malte', koen: 'D', hold: 'GF01' },
    { fornavn: 'Emil', efternavnStart: 'Ha', koen: 'D', hold: 'GF03' },
    { fornavn: 'Emil', efternavnStart: 'Je', koen: 'D', hold: 'GF04' },
    { fornavn: 'Noah', koen: 'D', hold: 'GF05' },
  ]);
  expect(r.begge.map((m) => [m.elevId, m.hold])).toEqual([['a', 'GF02'], ['b', 'GF01'], ['c', 'GF03'], ['d', 'GF04']]);
  expect(r.kunPaaListen.map((x) => x.navn)).toEqual(['Noah']);
  expect(r.kunIKlassen).toEqual(['e']);
});

it('matcher "Ida" med "Ida H.", når fornavnet er entydigt', () => {
  const r = sammenlign([{ id: 'a', navn: 'Ida H.', koen: 'P' }], [{ fornavn: 'Ida', koen: 'P', hold: 'GF01' }]);
  expect(r.begge.map((m) => m.elevId)).toEqual(['a']);
});
