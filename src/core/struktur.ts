// Netværksgrupper og makkerskabspar. Inddelingen følger pladserne: de
// optagne pladser ved et bord deles fra den ene ende i grupper af cirka
// fire, og hver gruppe i makkerpar af to (et par kan blive på tre, så ingen
// står uden makker). Byttes elever, følger grupperne derfor pladserne.

import { type BordId, type ElevId, type Lokale, type Placering, bordRaekker } from './model';

/** Hvor mange elever hver gruppe får, når et bord har `antal` elever. */
export function gruppestoerrelser(antal: number): number[] {
  if (antal <= 0) return [];
  const grupper = Math.max(1, Math.round(antal / 4));
  const base = Math.floor(antal / grupper);
  const ekstra = antal % grupper;
  return Array.from({ length: grupper }, (_, i) => base + (i < ekstra ? 1 : 0));
}

/** Makkerpar i en gruppe: par af to, og det sidste par på tre ved ulige antal. */
export function parstoerrelser(gruppe: number): number[] {
  if (gruppe <= 3) return [gruppe];
  const par = Math.floor(gruppe / 2);
  return Array.from({ length: par }, (_, i) => (i === par - 1 && gruppe % 2 === 1 ? 3 : 2));
}

/** Deler optagne pladser (i rækkefølge) i grupper → par → pladsnumre. */
export function inddelPladser(optagne: number[]): number[][][] {
  const ud: number[][][] = [];
  let i = 0;
  for (const g of gruppestoerrelser(optagne.length)) {
    const gruppe: number[][] = [];
    for (const p of parstoerrelser(g)) {
      gruppe.push(optagne.slice(i, i + p));
      i += p;
    }
    ud.push(gruppe);
  }
  return ud;
}

export interface Netvaerksgruppe {
  /** Gruppens nummer i hele lokalet, fra 1. */
  nr: number;
  /** Bordet, gruppen starter ved. En gruppe kan strække sig over borde, der står sammen. */
  bordId: BordId;
  /** Makkerparrene i gruppen. */
  par: ElevId[][];
  /** Pladserne, gruppen dækker, i rækkefølge. */
  pladser: { bordId: BordId; plads: number }[];
}

/** Alle pladser i hver række af borde, der står sammen, i rækkefølge. */
export function raekkePladser(lokale: Lokale): { bordId: BordId; plads: number }[][] {
  return bordRaekker(lokale).map((r) => r.flatMap((b) => Array.from({ length: b.pladser }, (_, plads) => ({ bordId: b.id, plads }))));
}

/** Alle netværksgrupper i en plan, nummereret i bordenes rækkefølge. */
export function planGrupper(lokale: Lokale, placering: Placering): Netvaerksgruppe[] {
  const ud: Netvaerksgruppe[] = [];
  for (const pladser of raekkePladser(lokale)) {
    const elev = (i: number) => placering[pladser[i]!.bordId]?.[pladser[i]!.plads] ?? null;
    const optagne = pladser.map((_, i) => (elev(i) ? i : -1)).filter((i) => i >= 0);
    for (const g of inddelPladser(optagne)) {
      const dækker = g.flat().map((i) => pladser[i]!);
      ud.push({ nr: ud.length + 1, bordId: dækker[0]!.bordId, par: g.map((p) => p.map((i) => elev(i)!)), pladser: dækker });
    }
  }
  return ud;
}

/** Gruppe og par for hver plads: "bordId#plads" → gruppenr, parindeks og om pladsen afslutter et par/en gruppe. */
export function pladsGrupper(grupper: Netvaerksgruppe[]): Map<string, { gruppe: number; par: number; sidstIPar: boolean; sidstIGruppe: boolean }> {
  const m = new Map<string, { gruppe: number; par: number; sidstIPar: boolean; sidstIGruppe: boolean }>();
  for (const g of grupper) {
    let k = 0;
    g.par.forEach((p, pi) => {
      p.forEach((_, j) => {
        const pl = g.pladser[k++]!;
        m.set(`${pl.bordId}#${pl.plads}`, {
          gruppe: g.nr,
          par: pi,
          sidstIPar: j === p.length - 1,
          sidstIGruppe: pi === g.par.length - 1 && j === p.length - 1,
        });
      });
    });
  }
  return m;
}
