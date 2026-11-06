import { describe, expect, it } from 'vitest';
import { lavDemo } from '../core/demo';
import { fortrydKlik, givKlik, modtagResultat, nulstil, nyRunde, procent, rundePoint, stilling, tilmeld, tomStand, type GruppePladser, type Stand } from './pointtavle';
import { kortSomLokale, laesBesked, lavKort } from './protokol';

const G: GruppePladser[] = [
  { nr: 1, pladser: ['a#0', 'a#1', 'a#2'] },
  { nr: 2, pladser: ['b#0', 'b#1', 'b#2', 'b#3', 'b#4'] },
];
const GYLDIGE = new Set(G.flatMap((g) => g.pladser));

function med(stand: Stand, ...pladser: string[]): Stand {
  return pladser.reduce((s, p) => tilmeld(s, { plads: p, figur: 'koala', enhed: `e-${p.replace('#', '-')}` }, GYLDIGE), stand);
}
function res(stand: Stand, plads: string, point: number, maks: number, id = `${plads}-${point}`): Stand {
  return modtagResultat(stand, { id: id.replace('#', '-'), enhed: `e-${plads.replace('#', '-')}`, plads, spil: 'Test', point, maks });
}

describe('procent', () => {
  it('regner om til 0-100 og klipper negative point til 0', () => {
    expect(procent({ point: 9, maks: 18 })).toBe(50);
    expect(procent({ point: -12, maks: 18 })).toBe(0);
    expect(procent({ point: 30, maks: 18 })).toBe(100);
    expect(procent({ point: 5, maks: 0 })).toBe(0);
  });
});

describe('rundePoint', () => {
  it('er gennemsnittet pr. elev, så en lille gruppe ikke taber på størrelsen', () => {
    let s = med(tomStand(), ...G[0]!.pladser, ...G[1]!.pladser);
    for (const p of G[0]!.pladser) s = res(s, p, 8, 10);
    for (const p of G[1]!.pladser) s = res(s, p, 8, 10);
    expect(rundePoint(G[0]!, s)).toBe(80);
    expect(rundePoint(G[1]!, s)).toBe(80);
  });

  it('elever, der er med men ikke har spillet, tæller som 0', () => {
    let s = med(tomStand(), 'a#0', 'a#1');
    s = res(s, 'a#0', 10, 10);
    expect(rundePoint(G[0]!, s)).toBe(50);
  });

  it('elever, der ikke er logget på, tæller ikke med', () => {
    let s = med(tomStand(), 'a#0');
    s = res(s, 'a#0', 6, 10);
    expect(rundePoint(G[0]!, s)).toBe(60);
  });

  it('kun det nyeste resultat pr. plads tæller', () => {
    let s = med(tomStand(), 'a#0');
    s = res(s, 'a#0', 2, 10, 'r1');
    s = res(s, 'a#0', 9, 10, 'r2');
    expect(rundePoint(G[0]!, s)).toBe(90);
  });
});

describe('modtagResultat', () => {
  it('afviser resultater fra en anden enhed end den, der sidder på pladsen', () => {
    const s = med(tomStand(), 'a#0');
    const efter = modtagResultat(s, { id: 'x', enhed: 'fremmed', plads: 'a#0', spil: 'Test', point: 10, maks: 10 });
    expect(efter.aktuel).toHaveLength(0);
  });
  it('tæller samme resultat-id kun én gang', () => {
    let s = med(tomStand(), 'a#0');
    s = res(s, 'a#0', 10, 10, 'samme');
    s = res(s, 'a#0', 10, 10, 'samme');
    expect(s.aktuel).toHaveLength(1);
  });
});

describe('tilmeld', () => {
  it('en enhed kan kun sidde ét sted', () => {
    let s = tilmeld(tomStand(), { plads: 'a#0', figur: 'koala', enhed: 'e1' }, GYLDIGE);
    s = tilmeld(s, { plads: 'b#2', figur: 'gufo', enhed: 'e1' }, GYLDIGE);
    expect(Object.keys(s.deltagere)).toEqual(['b#2']);
  });
  it('ignorerer pladser, der ikke findes', () => {
    const s = tilmeld(tomStand(), { plads: 'z#9', figur: 'koala', enhed: 'e1' }, GYLDIGE);
    expect(s.deltagere).toEqual({});
  });
});

describe('stilling, runder og klik', () => {
  it('lægger runder og klik sammen og giver samme plads ved lige point', () => {
    let s = med(tomStand(), 'a#0', 'b#0');
    s = res(s, 'a#0', 10, 10);
    s = res(s, 'b#0', 5, 10);
    s = nyRunde(s, G);
    expect(s.aktuel).toHaveLength(0);
    s = givKlik(s, { id: 'k1', gruppe: 2, point: 50 });
    const st = stilling(G, s);
    expect(st.map((x) => [x.nr, x.total, x.plads])).toEqual([
      [1, 100, 1],
      [2, 100, 1],
    ]);
    s = fortrydKlik(s);
    expect(stilling(G, s)[0]!.nr).toBe(1);
    s = nulstil(s);
    expect(stilling(G, s).every((x) => x.total === 0)).toBe(true);
    expect(Object.keys(s.deltagere)).toHaveLength(2);
  });
});

describe('protokol', () => {
  it('kortet indeholder ingen elevdata og kan læses igen', () => {
    const { klasse } = lavDemo(new Date('2026-11-06'));
    const plan = klasse.planer.at(-1)!;
    const kort = lavKort(plan.lokale);
    const tekst = JSON.stringify(kort);
    for (const e of klasse.elever) expect(tekst).not.toContain(e.navn);
    const b = laesBesked(JSON.parse(JSON.stringify({ t: 'kort', kort, optagne: [], taget: [] })));
    expect(b?.t).toBe('kort');
    expect(kortSomLokale(kort).borde).toHaveLength(plan.lokale.borde.length);
  });
  it('smider ugyldige og ukendte felter væk', () => {
    expect(laesBesked({ t: 'tilmeld', enhed: 'e1', plads: 'a#0', figur: 'tung-tung' })).toBeNull();
    expect(laesBesked({ t: 'resultat', id: 'r', enhed: 'e1', plads: 'a#0', spil: '<script>', point: 1, maks: 1 })).toBeNull();
    expect(laesBesked({ t: 'resultat', id: 'r', enhed: 'e1', plads: 'a#0', spil: 'Counter-Norm', point: 1, maks: 1, navn: 'Ida' })).toEqual({
      t: 'resultat',
      id: 'r',
      enhed: 'e1',
      plads: 'a#0',
      spil: 'Counter-Norm',
      point: 1,
      maks: 1,
    });
  });
});

describe('server-hændelser', async () => {
  const { laesHaendelse, laesKortHaendelse } = await import('./server');
  it('læser en samlet put i nøgleorden og enkelte beskeder', () => {
    const alt = laesHaendelse('put', JSON.stringify({ path: '/', data: { '-b': 'y', '-a': 'x', '-c': 3 } }));
    expect(alt.map((x) => x.noegle)).toEqual(['-a', '-b']);
    expect(laesHaendelse('put', JSON.stringify({ path: '/-z', data: 'z' }))).toEqual([{ noegle: '-z', tekst: 'z' }]);
    expect(laesHaendelse('keep-alive', 'null')).toEqual([]);
    expect(laesHaendelse('put', 'ikke json')).toEqual([]);
  });
  it('læser kortet og afviser andet', () => {
    const kort = { t: 'kort', kort: { navn: '', bredde: 5, hoejde: 5, borde: [], tavle: { vaeg: 'top', midte: 2, laengde: 2 }, mobilskab: null }, optagne: [], taget: [] };
    expect(laesKortHaendelse('put', JSON.stringify({ path: '/', data: { json: JSON.stringify(kort), tid: 1 } }))?.t).toBe('kort');
    expect(laesKortHaendelse('put', JSON.stringify({ path: '/', data: { json: '{"t":"hvem"}', tid: 1 } }))).toBeNull();
  });
});
