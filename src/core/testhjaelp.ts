// Hjælpefunktioner til tests. Bruges ikke af appen.

import { aleneVedBord, koenOpslag } from './historik';
import { type LokaleIndstillinger, lavLokale } from './lokale';
import { type Elev, type ElevId, type Koen, type Laas, type Lokale, type Plan, elevIderVedBord, erForrest } from './model';
import { lavPlacering } from './optimering';

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

/** Faste id'er, så tests kan gentages. */
export function testLokale(ind: LokaleIndstillinger): Lokale {
  const l = lavLokale(ind);
  l.borde.forEach((b, i) => (b.id = `B${i + 1}`));
  return l;
}

export interface Simulering {
  planer: Plan[];
}

/** Laver `runder` planer efter hinanden, som en lærer ville gøre det. */
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
  return plan.lokale.borde.filter((b) => erForrest(b, plan.lokale)).flatMap((b) => elevIderVedBord(plan.placering, b.id));
}

export function alene(plan: Plan, elever: Elev[]): ElevId[] {
  const k = koenOpslag(elever);
  return bordGrupper(plan).flatMap((g) => aleneVedBord(g, k));
}

export function par(plan: Plan): string[] {
  const res: string[] = [];
  for (const g of bordGrupper(plan)) {
    for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) res.push([g[a], g[b]].sort().join('|'));
  }
  return res;
}
