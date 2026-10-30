import { describe, expect, it } from 'vitest';
import { foreslaaKoen, gaetKoen } from './koensgaet';
import { DRENGENAVNE, PIGENAVNE } from './navnedata';

describe('gaetKoen', () => {
  it('kender almindelige danske navne', () => {
    for (const n of ['Adam', 'Malthe', 'Noah', 'William', 'Oscar', 'Søren', 'Bjørn', 'Asger']) expect(gaetKoen(n)).toEqual({ koen: 'D', sikker: true });
    for (const n of ['Ida', 'Freja', 'Lærke', 'Mathilde', 'Asta', 'Signe', 'Ellen']) expect(gaetKoen(n)).toEqual({ koen: 'P', sikker: true });
  });

  it('kender navne fra de største indvandrergrupper', () => {
    for (const n of ['Mohammed', 'Ali', 'Yusuf', 'Emre', 'Abdirahman', 'Jakub', 'Amar']) expect(gaetKoen(n).koen).toBe('D');
    for (const n of ['Fatima', 'Zeynep', 'Maryam', 'Hodan', 'Weronika', 'Lejla']) expect(gaetKoen(n).koen).toBe('P');
  });

  it('gætter ikke ved navne, der bruges til begge køn', () => {
    for (const n of ['Kim', 'Robin', 'Alex', 'Sasha', 'Charlie', 'Noa', 'Nour', 'Mika', 'Deniz']) expect(gaetKoen(n)).toEqual({ koen: null, sikker: false });
  });

  it('gætter ikke ved ukendte navne', () => {
    expect(gaetKoen('Xyzzy')).toEqual({ koen: null, sikker: false });
    expect(gaetKoen('')).toEqual({ koen: null, sikker: false });
  });

  it('håndterer forbogstav, bindestreg, dobbeltnavne, store bogstaver og accenter', () => {
    expect(gaetKoen('Ida H.').koen).toBe('P');
    expect(gaetKoen('Adam Ha.').koen).toBe('D');
    expect(gaetKoen('Anne-Sofie').koen).toBe('P');
    expect(gaetKoen('Karl Emil').koen).toBe('D');
    expect(gaetKoen('MALTHE').koen).toBe('D');
    expect(gaetKoen('Zoë').koen).toBe('P');
    expect(gaetKoen('Zoé').koen).toBe('P');
  });

  it('ingen navne står som både pige- og drengenavn ved en fejl', () => {
    const p = new Set(PIGENAVNE.split(/\s+/).filter(Boolean));
    const begge = DRENGENAVNE.split(/\s+/).filter((n) => n && p.has(n));
    expect(begge).toEqual([]);
  });
});

describe('foreslaaKoen', () => {
  it('sætter køn ved entydige navne, bevarer valgt køn og lister tvivl', () => {
    const r = foreslaaKoen([
      { navn: 'Adam', koen: null },
      { navn: 'Kim', koen: null },
      { navn: 'Ida', koen: 'D' as const }, // lærerens valg vinder altid
      { navn: 'Xyzzy', koen: null },
    ]);
    expect(r.raekker.map((x) => x.koen)).toEqual(['D', null, 'D', null]);
    expect(r.gaettet).toBe(1);
    expect(r.tvivl).toEqual(['Kim', 'Xyzzy']);
  });
});
