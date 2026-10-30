// Forslag til køn ud fra fornavnet. Bruger kun navnelisten, der følger med
// appen. Navne, der bruges til begge køn, eller som ikke står på listen,
// gættes ikke: dem skal læreren selv tage stilling til.

import { DRENGENAVNE, KOENSNEUTRALE, PIGENAVNE } from './navnedata';

type Svar = 'P' | 'D' | 'tvivl';

let opslag: Map<string, Svar> | null = null;

function byg(): Map<string, Svar> {
  const m = new Map<string, Svar>();
  const tilfoej = (liste: string, koen: 'P' | 'D') => {
    for (const n of liste.split(/\s+/).filter(Boolean)) {
      const k = normaliser(n);
      const før = m.get(k);
      m.set(k, før && før !== koen ? 'tvivl' : koen);
    }
  };
  tilfoej(PIGENAVNE, 'P');
  tilfoej(DRENGENAVNE, 'D');
  for (const n of KOENSNEUTRALE.split(/\s+/).filter(Boolean)) m.set(normaliser(n), 'tvivl');
  return m;
}

function normaliser(navn: string): string {
  return navn
    .toLocaleLowerCase('da')
    .replace(/å/g, '\u0001') // å, æ og ø er selvstændige bogstaver på dansk og må ikke forsvinde
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0001/g, 'å')
    .trim();
}

export interface Koensgaet {
  koen: 'P' | 'D' | null;
  /** Sand, når navnet står på listen som entydigt pige- eller drengenavn. */
  sikker: boolean;
}

/**
 * Gætter køn ud fra fornavnet. "Ida H." læses som "Ida". Ved sammensatte
 * navne ("Anne-Sofie", "Karl Emil") bruges hele navnet, hvis det står på
 * listen, ellers det første led.
 */
export function gaetKoen(navn: string): Koensgaet {
  opslag ??= byg();
  const rent = navn.replace(/\s+\p{L}{1,2}\.$/u, '').trim();
  const kandidater = [rent, rent.split(/[\s-]/)[0] ?? ''].map(normaliser).filter(Boolean);
  for (const k of kandidater) {
    const svar = opslag.get(k);
    if (svar === 'P' || svar === 'D') return { koen: svar, sikker: true };
    if (svar === 'tvivl') return { koen: null, sikker: false };
  }
  return { koen: null, sikker: false };
}

export interface GaetResultat<T> {
  raekker: T[];
  gaettet: number;
  /** Navne, hvor køn ikke kunne afgøres. */
  tvivl: string[];
}

/** Sætter køn ved dem, der mangler, når navnet er entydigt. Andre bevarer deres køn. */
export function foreslaaKoen<T extends { navn: string; koen: 'P' | 'D' | null }>(raekker: T[]): GaetResultat<T> {
  let gaettet = 0;
  const tvivl: string[] = [];
  const ud = raekker.map((r) => {
    if (r.koen) return r;
    const g = gaetKoen(r.navn);
    if (g.sikker && g.koen) {
      gaettet++;
      return { ...r, koen: g.koen };
    }
    tvivl.push(r.navn);
    return r;
  });
  return { raekker: ud, gaettet, tvivl };
}
