// Hjælpefunktioner til tests. Bruges ikke af appen.

import { aleneVedBord, koenOpslag } from './historik';
import { type LokaleIndstillinger, lavLokale } from './lokale';
import { type Elev, type ElevId, type Koen, type Laas, type Lokale, type Plan, elevIderVedBord, forresteBorde } from './model';
import { lavPlacering } from './optimering';
import { planGrupper } from './struktur';

export function lavElever(piger: number, drenge: number, udenKoen = 0): Elev[] {
  const res: Elev[] = [];
  const tilfoej = (præfiks: string, antal: number, koen: Koen) => {
    for (let i = 0; i < antal; i++) res.push({ id: `${præfiks}${i}`, navn: `${præfiks}${i}`, koen });
  };
  tilfoej('P', piger, 'P');
  tilfoej('D', drenge, 'D');
  tilfoej('X', udenKoen, null);
  return res;
}

/** Faste id'er (B1, B2 ...), så tests kan gentages. */
export function testLokale(ind: LokaleIndstillinger): Lokale {
  const l = lavLokale(ind, 'T');
  l.borde.forEach((b, i) => (b.id = `B${i + 1}`));
  return l;
}

export function simuler(
  elever: Elev[],
  lokale: Lokale,
  runder: number,
  ekstra: { holdAdskilt?: [ElevId, ElevId][]; laase?: Laas[]; seed?: number } = {},
): Plan[] {
  const planer: Plan[] = [];
  for (let r = 0; r < runder; r++) {
    const { placering } = lavPlacering({
      elever,
      lokale,
      tidligere: planer,
      holdAdskilt: ekstra.holdAdskilt ?? [],
      laase: ekstra.laase ?? [],
      seed: (ekstra.seed ?? 1) * 1000 + r,
    });
    planer.push({ id: `plan${r}`, dato: `2026-01-${String(r + 1).padStart(2, '0')}`, lokale, placering });
  }
  return planer;
}

export function bordGrupper(plan: Plan): ElevId[][] {
  return plan.lokale.borde.map((b) => elevIderVedBord(plan.placering, b.id));
}

export function forreste(plan: Plan): ElevId[] {
  const f = forresteBorde(plan.lokale);
  return plan.lokale.borde.filter((b) => f.has(b.id)).flatMap((b) => elevIderVedBord(plan.placering, b.id));
}

/** Elever, der er eneste af deres køn i en netværksgruppe. */
export function alene(plan: Plan, elever: Elev[]): ElevId[] {
  const k = koenOpslag(elever);
  return planGrupper(plan.lokale, plan.placering).flatMap((g) => aleneVedBord(g.par.flat(), k));
}

function parAf(lister: ElevId[][]): string[] {
  const res: string[] = [];
  for (const g of lister) {
    for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) res.push([g[a], g[b]].sort().join('|'));
  }
  return res;
}

/** Alle par af elever ved samme bord. */
export function par(plan: Plan): string[] {
  return parAf(bordGrupper(plan));
}

/** Alle makkerpar (par af elever, der er makkere). */
export function makkerpar(plan: Plan): string[] {
  return parAf(planGrupper(plan.lokale, plan.placering).flatMap((g) => g.par));
}

/** Alle par af elever i samme netværksgruppe. */
export function gruppepar(plan: Plan): string[] {
  return parAf(planGrupper(plan.lokale, plan.placering).map((g) => g.par.flat()));
}
