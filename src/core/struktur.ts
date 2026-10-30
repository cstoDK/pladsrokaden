// Netværksgrupper og makkerskabspar. Inddelingen følger pladserne: de
// optagne pladser ved borde, der står sammen, deles fra den ene ende i
// grupper af cirka fire, og hver gruppe i makkerpar af to (et par kan blive
// på tre, så ingen står uden makker). Byttes elever, følger grupperne derfor
// pladserne. En gruppe må aldrig have under tre: sidder kun en eller to ved
// et bord for sig, slås de sammen med bordene ved siden af, foran eller bagved.

import { type BordId, type ElevId, type Lokale, type Placering, bordBredde, bordHoejde, bordRaekker } from './model';

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

type Plads = { bordId: BordId; plads: number };

/** Mindste antal i en netværksgruppe; færre ved et bord slås sammen med naboerne. */
const MINDST = 3;

/**
 * De optagne pladser samlet i segmenter, som grupperne laves af. Et segment
 * er normalt en række borde, der står sammen. Har et segment kun en eller to
 * elever, slås det sammen med det nærmeste segment på samme række eller lige
 * foran eller bagved, så gruppen kan sidde sammen og vende sig om.
 */
export function gruppeSegmenter(lokale: Lokale, optaget: (p: Plads) => boolean): Plads[][] {
  const segmenter = bordRaekker(lokale)
    .map((r) => ({
      pladser: r.flatMap((b) => Array.from({ length: b.pladser }, (_, plads) => ({ bordId: b.id, plads }))).filter(optaget),
      x0: Math.min(...r.map((b) => b.x)),
      x1: Math.max(...r.map((b) => b.x + bordBredde(b))),
      y0: Math.min(...r.map((b) => b.y)),
      y1: Math.max(...r.map((b) => b.y + bordHoejde(b))),
    }))
    .filter((s) => s.pladser.length > 0);

  // Afstand mellem to segmenter, hvis de sidder "sammen": på samme række med
  // højst et par pladsers mellemrum, eller over for hinanden (foran/bagved).
  function afstand(a: (typeof segmenter)[number], b: (typeof segmenter)[number]): number | null {
    const overlapX = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
    const overlapY = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
    const hulX = Math.max(0, -overlapX);
    const hulY = Math.max(0, -overlapY);
    if (overlapY > 0 && hulX <= 3) return hulX;
    if (overlapX > 0 && hulY <= 2) return hulY + 0.01;
    return null;
  }

  for (;;) {
    const smaa = segmenter.filter((s) => s.pladser.length < MINDST).sort((a, b) => a.pladser.length - b.pladser.length);
    let flettet = false;
    for (const s of smaa) {
      let bedst: (typeof segmenter)[number] | null = null;
      let bedstAfstand = Infinity;
      for (const t of segmenter) {
        if (t === s) continue;
        const d = afstand(s, t);
        if (d !== null && d < bedstAfstand) {
          bedst = t;
          bedstAfstand = d;
        }
      }
      if (!bedst) continue;
      // Det lille segment sættes i den ende, det sidder nærmest, så gruppen
      // i den ende også sidder sammen.
      const foerst = s.x0 + s.x1 < bedst.x0 + bedst.x1;
      bedst.pladser = foerst ? [...s.pladser, ...bedst.pladser] : [...bedst.pladser, ...s.pladser];
      bedst.x0 = Math.min(bedst.x0, s.x0);
      bedst.x1 = Math.max(bedst.x1, s.x1);
      bedst.y0 = Math.min(bedst.y0, s.y0);
      bedst.y1 = Math.max(bedst.y1, s.y1);
      segmenter.splice(segmenter.indexOf(s), 1);
      flettet = true;
      break;
    }
    if (!flettet) break;
  }
  return segmenter.map((s) => s.pladser);
}

/** Alle netværksgrupper i en plan, nummereret i bordenes rækkefølge. */
export function planGrupper(lokale: Lokale, placering: Placering): Netvaerksgruppe[] {
  const elev = (p: Plads) => placering[p.bordId]?.[p.plads] ?? null;
  const ud: Netvaerksgruppe[] = [];
  for (const pladser of gruppeSegmenter(lokale, (p) => !!elev(p))) {
    for (const g of inddelPladser(pladser.map((_, i) => i))) {
      const dækker = g.flat().map((i) => pladser[i]!);
      ud.push({ nr: ud.length + 1, bordId: dækker[0]!.bordId, par: g.map((p) => p.map((i) => elev(pladser[i]!)!)), pladser: dækker });
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
