import { describe, expect, it } from 'vitest';
import { lavDemo } from './demo';
import { flet, fraFil, laesAppData, tilFil } from './fil';
import { tomtAppData } from './model';

function data() {
  const { klasse, lokale } = lavDemo(new Date(2026, 9, 30));
  return { ...tomtAppData(), klasser: [klasse], lokaler: [lokale] };
}

describe('sikkerhedskopi', () => {
  it('kan gemmes og hentes igen uden tab', () => {
    const d = data();
    const r = fraFil(tilFil(d));
    expect(r).toEqual({ klasser: d.klasser, lokaler: d.lokaler });
  });

  it('smider ukendte felter væk (fx efternavne eller noter)', () => {
    const fil = JSON.parse(tilFil(data()));
    fil.klasser[0].elever[0].efternavn = 'Hemmelig';
    fil.klasser[0].elever[0].note = 'Må ikke gemmes';
    fil.lokaler[0].note = 'Må ikke gemmes';
    const r = JSON.stringify(fraFil(JSON.stringify(fil)));
    expect(r).not.toContain('Hemmelig');
    expect(r).not.toContain('Må ikke gemmes');
  });

  it('afviser andre filer med en forståelig besked', () => {
    expect(fraFil('ikke json')).toEqual({ fejl: expect.stringMatching(/kunne ikke læses/) });
    expect(fraFil('{"klasser": []}')).toEqual({ fejl: expect.stringMatching(/ikke en sikkerhedskopi/) });
    expect(fraFil('{"filtype":"pladsrokaden","version":2,"klasser":[{"id":"x"}]}')).toEqual({ fejl: expect.stringMatching(/beskadiget/) });
  });

  it('fletter klasser og lokaler', () => {
    const a = data();
    const b = data();
    const d = flet(a, { klasser: [{ ...a.klasser[0]!, navn: 'Ændret' }, ...b.klasser], lokaler: b.lokaler });
    expect(d.klasser.map((k) => k.navn)).toEqual(['Ændret', b.klasser[0]!.navn]);
    expect(d.lokaler).toHaveLength(2);
  });
});

describe('data fra version 1', () => {
  const v1 = {
    version: 1,
    aktivKlasseId: 'k1',
    sidstEksporteret: null,
    klasser: [
      {
        id: 'k1', navn: '1.a', erDemo: false,
        elever: [{ id: 'a', navn: 'Ida', koen: 'P' }, { id: 'b', navn: 'Malte', koen: 'D' }],
        holdAdskilt: [], faste: [],
        lokale: { borde: [{ id: 't1', raekke: 0, kolonne: 0, pladser: 2 }], forresteRaekker: 1 },
        planer: [{ id: 'p', dato: '2026-10-30', lokale: { borde: [{ id: 't1', raekke: 0, kolonne: 0, pladser: 2 }], forresteRaekker: 1 }, placering: { t1: ['a', 'b'] } }],
        kladde: null,
      },
    ],
  };

  it('flyttes over: lokalet bliver selvstændigt, planerne bevares', () => {
    const d = laesAppData(v1);
    expect(d.version).toBe(3);
    expect(d.aktivKlasseId).toBe('k1');
    expect(d.lokaler).toHaveLength(1);
    expect(d.klasser[0]!.lokaleId).toBe(d.lokaler[0]!.id);
    expect(d.klasser[0]!.planer[0]!.placering).toEqual({ t1: ['a', 'b'] });
    expect(d.klasser[0]!.planer[0]!.lokale.borde[0]).toMatchObject({ id: 't1', pladser: 2, lodret: false });
  });

  it('kan også hentes fra en gammel sikkerhedskopi', () => {
    const r = fraFil(JSON.stringify({ filtype: 'pladsrokaden', ...v1 }));
    expect('klasser' in r && r.lokaler).toHaveLength(1);
  });

  it('ugyldige data giver tomme data i stedet for fejl', () => {
    expect(laesAppData({ version: 7 }).klasser).toEqual([]);
    expect(laesAppData(null).klasser).toEqual([]);
  });
});

describe('oprydning af navne fra version 1 og 2', () => {
  const v2 = (navne: string[]) => ({
    version: 2,
    lokaler: [],
    klasser: [{ id: 'k', navn: '1.a', elever: navne.map((navn, i) => ({ id: `e${i}`, navn, koen: null })), holdAdskilt: [], faste: [], lokaleId: null, planer: [] }],
  });

  it('beholder kun første fornavn og skelner dubletter med forbogstav', () => {
    const d = laesAppData(v2(['William Roland', 'Ida', 'Christian Erik Testesen', 'Christian Opdigt', 'Anne-Sofie', 'Ida H.']));
    expect(d.klasser[0]!.elever.map((e) => e.navn)).toEqual(['William', 'Ida', 'Christian T.', 'Christian O.', 'Anne-Sofie', 'Ida H.']);
  });

  it('gælder også gamle sikkerhedskopier, men ikke nye', () => {
    const gammel = fraFil(JSON.stringify({ filtype: 'pladsrokaden', ...v2(['Malte Skov']) }));
    expect('klasser' in gammel && gammel.klasser[0]!.elever[0]!.navn).toBe('Malte');
    const ny = fraFil(JSON.stringify({ filtype: 'pladsrokaden', ...v2(['Anna Isabel']), version: 3 }));
    expect('klasser' in ny && ny.klasser[0]!.elever[0]!.navn).toBe('Anna Isabel');
  });
});

it('demoklassen har opdigtede elever, et lokale og tre planer', () => {
  const { klasse, lokale } = lavDemo();
  expect(klasse.erDemo).toBe(true);
  expect(klasse.navn).toMatch(/opdigtet/);
  expect(klasse.planer).toHaveLength(3);
  expect(klasse.lokaleId).toBe(lokale.id);
});
