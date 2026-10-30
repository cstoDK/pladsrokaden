import { describe, expect, it } from 'vitest';
import { lavDemoKlasse } from './demo';
import { flet, fraFil, tilFil } from './fil';
import { tomtAppData } from './model';

describe('sikkerhedskopi', () => {
  it('kan gemmes og hentes igen uden tab', () => {
    const d = { ...tomtAppData(), klasser: [lavDemoKlasse(new Date(2026, 9, 30))] };
    const r = fraFil(tilFil(d));
    expect('klasser' in r && r.klasser).toEqual(d.klasser);
  });

  it('smider ukendte felter væk (fx efternavne eller noter)', () => {
    const k = lavDemoKlasse();
    const fil = JSON.parse(tilFil({ ...tomtAppData(), klasser: [k] }));
    fil.klasser[0].elever[0].efternavn = 'Hemmelig';
    fil.klasser[0].elever[0].note = 'Må ikke gemmes';
    fil.klasser[0].noter = 'Må ikke gemmes';
    const r = fraFil(JSON.stringify(fil));
    expect(JSON.stringify(r)).not.toContain('Hemmelig');
    expect(JSON.stringify(r)).not.toContain('Må ikke gemmes');
  });

  it('afviser andre filer med en forståelig besked', () => {
    expect(fraFil('ikke json')).toEqual({ fejl: expect.stringMatching(/kunne ikke læses/) });
    expect(fraFil('{"klasser": []}')).toEqual({ fejl: expect.stringMatching(/ikke en sikkerhedskopi/) });
    expect(fraFil('{"filtype":"pladsrokaden","version":1,"klasser":[{"id":"x"}]}')).toEqual({ fejl: expect.stringMatching(/beskadiget/) });
  });

  it('fletter: samme klasse erstattes, nye tilføjes', () => {
    const a = lavDemoKlasse();
    const b = lavDemoKlasse();
    const a2 = { ...a, navn: 'Ændret' };
    const d = flet({ ...tomtAppData(), klasser: [a] }, [a2, b]);
    expect(d.klasser.map((k) => k.navn)).toEqual(['Ændret', b.navn]);
  });
});

describe('demoklasse', () => {
  it('har opdigtede elever og tre planer', () => {
    const k = lavDemoKlasse();
    expect(k.erDemo).toBe(true);
    expect(k.navn).toMatch(/opdigtet/);
    expect(k.planer).toHaveLength(3);
    expect(k.elever).toHaveLength(24);
  });
});
