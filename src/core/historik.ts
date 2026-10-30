// Udtræk af historik fra tidligere planer: hvem har været forrest, hvem
// har siddet sammen, og hvem har været eneste af sit køn ved et bord.

import { type Elev, type ElevId, type Koen, type Plan, elevIderVedBord, erForrest } from './model';

/** Vægt for et par, der sad sammen: sidste plan, næstsidste, tredjesidste. Ældre planer vægter 1. */
export const NYLIGHEDSVAEGTE = [4, 2.5, 1.5];
export const AELDRE_VAEGT = 1;

export function nylighedsvaegt(planerSiden: number): number {
  return NYLIGHEDSVAEGTE[planerSiden] ?? AELDRE_VAEGT;
}

export function parNoegle(a: ElevId, b: ElevId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface Historik {
  antalPlaner: number;
  forrestAntal: Map<ElevId, number>;
  forrestSidst: Set<ElevId>;
  aleneAntal: Map<ElevId, number>;
  aleneSidst: Set<ElevId>;
  /** Sum af nylighedsvægte over planer, hvor parret sad ved samme bord. */
  parVaegt: Map<string, number>;
  parAntal: Map<string, number>;
  parSidst: Set<string>;
}

/**
 * Eleverne ved et bord, der er eneste af deres køn. En elev er "alene",
 * når ingen andre ved bordet har samme køn, og mindst to har det andet køn.
 * Elever uden angivet køn tæller ikke med.
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

/** Bygger historikken ud fra gemte planer (ældste først). */
export function bygHistorik(elever: Elev[], planer: Plan[]): Historik {
  const koenAf = koenOpslag(elever);
  const h: Historik = {
    antalPlaner: planer.length,
    forrestAntal: new Map(),
    forrestSidst: new Set(),
    aleneAntal: new Map(),
    aleneSidst: new Set(),
    parVaegt: new Map(),
    parAntal: new Map(),
    parSidst: new Set(),
  };
  planer.forEach((plan, i) => {
    const siden = planer.length - 1 - i;
    const erSidste = siden === 0;
    const vaegt = nylighedsvaegt(siden);
    for (const bord of plan.lokale.borde) {
      const ider = elevIderVedBord(plan.placering, bord.id);
      if (erForrest(bord, plan.lokale)) {
        for (const id of ider) {
          h.forrestAntal.set(id, (h.forrestAntal.get(id) ?? 0) + 1);
          if (erSidste) h.forrestSidst.add(id);
        }
      }
      for (const id of aleneVedBord(ider, koenAf)) {
        h.aleneAntal.set(id, (h.aleneAntal.get(id) ?? 0) + 1);
        if (erSidste) h.aleneSidst.add(id);
      }
      for (let a = 0; a < ider.length; a++) {
        for (let b = a + 1; b < ider.length; b++) {
          const k = parNoegle(ider[a]!, ider[b]!);
          h.parVaegt.set(k, (h.parVaegt.get(k) ?? 0) + vaegt);
          h.parAntal.set(k, (h.parAntal.get(k) ?? 0) + 1);
          if (erSidste) h.parSidst.add(k);
        }
      }
    }
  });
  return h;
}

export interface ElevStatistik {
  elevId: ElevId;
  gangeForrest: number;
  gangeAlene: number;
  /** Antal nuværende klassekammerater, eleven endnu ikke har siddet ved bord med. */
  ikkeMoedt: number;
}

export function elevStatistik(elever: Elev[], planer: Plan[]): ElevStatistik[] {
  const h = bygHistorik(elever, planer);
  return elever.map((e) => {
    let ikkeMoedt = 0;
    for (const anden of elever) {
      if (anden.id !== e.id && !h.parAntal.has(parNoegle(e.id, anden.id))) ikkeMoedt++;
    }
    return {
      elevId: e.id,
      gangeForrest: h.forrestAntal.get(e.id) ?? 0,
      gangeAlene: h.aleneAntal.get(e.id) ?? 0,
      ikkeMoedt,
    };
  });
}
