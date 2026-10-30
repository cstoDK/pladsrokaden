// Udtræk af historik fra tidligere planer: hvem har været forrest, hvem har
// været makkere eller i samme netværksgruppe, og hvem har været eneste af
// sit køn i en gruppe.

import { type Elev, type ElevId, type Koen, type Plan, forresteBorde, elevIderVedBord } from './model';
import { planGrupper } from './struktur';

/** Vægt for et par: sidste plan, næstsidste, tredjesidste. Ældre planer vægter 1. */
export const NYLIGHEDSVAEGTE = [4, 2.5, 1.5];
export const AELDRE_VAEGT = 1;

export function nylighedsvaegt(planerSiden: number): number {
  return NYLIGHEDSVAEGTE[planerSiden] ?? AELDRE_VAEGT;
}

export function parNoegle(a: ElevId, b: ElevId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface Relation {
  /** Sum af nylighedsvægte. */
  vaegt: Map<string, number>;
  antal: Map<string, number>;
  sidst: Set<string>;
}

export interface Historik {
  antalPlaner: number;
  forrestAntal: Map<ElevId, number>;
  forrestSidst: Set<ElevId>;
  aleneAntal: Map<ElevId, number>;
  aleneSidst: Set<ElevId>;
  /** Har været makkerpar. */
  makker: Relation;
  /** Har været i samme netværksgruppe (også som makkere). */
  gruppe: Relation;
}

/**
 * Elever i en gruppe, der er eneste af deres køn. En elev er "alene", når
 * ingen andre i gruppen har samme køn, og mindst to har det andet køn.
 */
export function aleneVedBord(ider: ElevId[], koenAf: (id: ElevId) => Koen): ElevId[] {
  let p = 0;
  let d = 0;
  for (const id of ider) {
    const k = koenAf(id);
    if (k === 'P') p++;
    else if (k === 'D') d++;
  }
  const res: ElevId[] = [];
  if (p === 1 && d >= 2) res.push(...ider.filter((id) => koenAf(id) === 'P'));
  if (d === 1 && p >= 2) res.push(...ider.filter((id) => koenAf(id) === 'D'));
  return res;
}

export function koenOpslag(elever: Elev[]): (id: ElevId) => Koen {
  const m = new Map(elever.map((e) => [e.id, e.koen]));
  return (id) => m.get(id) ?? null;
}

function nyRelation(): Relation {
  return { vaegt: new Map(), antal: new Map(), sidst: new Set() };
}

function noter(r: Relation, ider: ElevId[], vaegt: number, sidste: boolean) {
  for (let a = 0; a < ider.length; a++) {
    for (let b = a + 1; b < ider.length; b++) {
      const k = parNoegle(ider[a]!, ider[b]!);
      r.vaegt.set(k, (r.vaegt.get(k) ?? 0) + vaegt);
      r.antal.set(k, (r.antal.get(k) ?? 0) + 1);
      if (sidste) r.sidst.add(k);
    }
  }
}

/** Bygger historikken ud fra gemte planer (ældste først). */
export function bygHistorik(elever: Elev[], planer: Plan[]): Historik {
  const koenAf = koenOpslag(elever);
  const h: Historik = {
    antalPlaner: planer.length,
    forrestAntal: new Map(),
    forrestSidst: new Set(),
    aleneAntal: new Map(),
    aleneSidst: new Set(),
    makker: nyRelation(),
    gruppe: nyRelation(),
  };
  planer.forEach((plan, i) => {
    const siden = planer.length - 1 - i;
    const sidste = siden === 0;
    const vaegt = nylighedsvaegt(siden);
    const forrest = forresteBorde(plan.lokale);
    for (const bord of plan.lokale.borde) {
      if (!forrest.has(bord.id)) continue;
      for (const id of elevIderVedBord(plan.placering, bord.id)) {
        h.forrestAntal.set(id, (h.forrestAntal.get(id) ?? 0) + 1);
        if (sidste) h.forrestSidst.add(id);
      }
    }
    for (const g of planGrupper(plan.lokale, plan.placering)) {
      const alle = g.par.flat();
      for (const p of g.par) noter(h.makker, p, vaegt, sidste);
      noter(h.gruppe, alle, vaegt, sidste);
      for (const id of aleneVedBord(alle, koenAf)) {
        h.aleneAntal.set(id, (h.aleneAntal.get(id) ?? 0) + 1);
        if (sidste) h.aleneSidst.add(id);
      }
    }
  });
  return h;
}

export interface ElevStatistik {
  elevId: ElevId;
  gangeForrest: number;
  gangeAlene: number;
  /** Antal nuværende klassekammerater, eleven endnu ikke har været i netværksgruppe med. */
  ikkeMoedt: number;
  /** Antal forskellige makkere indtil nu. */
  makkere: number;
}

export function elevStatistik(elever: Elev[], planer: Plan[]): ElevStatistik[] {
  const h = bygHistorik(elever, planer);
  return elever.map((e) => {
    let ikkeMoedt = 0;
    let makkere = 0;
    for (const anden of elever) {
      if (anden.id === e.id) continue;
      const k = parNoegle(e.id, anden.id);
      if (!h.gruppe.antal.has(k)) ikkeMoedt++;
      if (h.makker.antal.has(k)) makkere++;
    }
    return { elevId: e.id, gangeForrest: h.forrestAntal.get(e.id) ?? 0, gangeAlene: h.aleneAntal.get(e.id) ?? 0, ikkeMoedt, makkere };
  });
}
