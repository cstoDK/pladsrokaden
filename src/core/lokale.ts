// Lokaleopstillinger: skabeloner og opbygning af borde i rækker.

import { type Bord, type Lokale, nyId } from './model';

export type SkabelonId = 'par' | 'gruppe3' | 'gruppe4' | 'gruppe5';

export interface Skabelon {
  id: SkabelonId;
  navn: string;
  beskrivelse: string;
  pladserPrBord: number;
  bordePrRaekke: number;
}

export const SKABELONER: Skabelon[] = [
  { id: 'par', navn: 'Borde à 2', beskrivelse: 'Sidemakkere på rækker', pladserPrBord: 2, bordePrRaekke: 4 },
  { id: 'gruppe3', navn: 'Grupper à 3', beskrivelse: 'Små grupper', pladserPrBord: 3, bordePrRaekke: 3 },
  { id: 'gruppe4', navn: 'Grupper à 4', beskrivelse: 'Fire ved hvert bord', pladserPrBord: 4, bordePrRaekke: 3 },
  { id: 'gruppe5', navn: 'Grupper à 5', beskrivelse: 'Fem ved hvert bord', pladserPrBord: 5, bordePrRaekke: 3 },
];

export interface LokaleIndstillinger {
  antalBorde: number;
  pladserPrBord: number;
  bordePrRaekke: number;
  forresteRaekker: number;
}

export const MAKS_BORDE = 40;
export const MAKS_PLADSER_PR_BORD = 8;

/** Bygger et lokale med borde i rækker. Række 0 er nærmest tavlen. */
export function lavLokale(ind: LokaleIndstillinger): Lokale {
  const antal = klem(ind.antalBorde, 1, MAKS_BORDE);
  const prRaekke = klem(ind.bordePrRaekke, 1, antal);
  const pladser = klem(ind.pladserPrBord, 1, MAKS_PLADSER_PR_BORD);
  const borde: Bord[] = [];
  for (let i = 0; i < antal; i++) {
    borde.push({ id: nyId(), raekke: Math.floor(i / prRaekke), kolonne: i % prRaekke, pladser });
  }
  const raekker = Math.ceil(antal / prRaekke);
  return { borde, forresteRaekker: klem(ind.forresteRaekker, 1, raekker) };
}

/** Standardindstillinger for en skabelon ud fra klassens størrelse. */
export function foreslaaIndstillinger(skabelon: SkabelonId, antalElever: number): LokaleIndstillinger {
  const s = SKABELONER.find((x) => x.id === skabelon) ?? SKABELONER[0]!;
  const antalBorde = Math.max(1, Math.ceil(Math.max(antalElever, 1) / s.pladserPrBord));
  return {
    antalBorde,
    pladserPrBord: s.pladserPrBord,
    bordePrRaekke: Math.min(s.bordePrRaekke, antalBorde),
    forresteRaekker: 1,
  };
}

/** Læser indstillingerne ud af et eksisterende lokale (til redigering). */
export function indstillingerFraLokale(lokale: Lokale): LokaleIndstillinger {
  const borde = lokale.borde;
  const prRaekke = Math.max(1, ...borde.filter((b) => b.raekke === 0).map((b) => b.kolonne + 1));
  return {
    antalBorde: borde.length,
    pladserPrBord: borde[0]?.pladser ?? 2,
    bordePrRaekke: prRaekke,
    forresteRaekker: lokale.forresteRaekker,
  };
}

export function antalRaekker(lokale: Lokale): number {
  return lokale.borde.reduce((m, b) => Math.max(m, b.raekke + 1), 0);
}

/**
 * Hvor mange elever der skal sidde ved hvert bord, så forskellen er
 * højst én (når pladserne tillader det). Ekstra elever gives til bordene
 * i den rækkefølge, `prioritet` angiver (standard: lokalets rækkefølge).
 */
export function jaevnFordeling(pladser: number[], antalElever: number, prioritet?: number[]): number[] {
  const n = pladser.length;
  const res = new Array<number>(n).fill(0);
  let tilbage = Math.min(antalElever, pladser.reduce((a, b) => a + b, 0));
  const orden = prioritet ?? pladser.map((_, i) => i);
  while (tilbage > 0) {
    let bedst = -1;
    for (const i of orden) {
      if (res[i]! < pladser[i]! && (bedst === -1 || res[i]! < res[bedst]!)) bedst = i;
    }
    res[bedst]!++;
    tilbage--;
  }
  return res;
}

function klem(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.round(x)));
}
