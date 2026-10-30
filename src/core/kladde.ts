// Rene funktioner til at arbejde med en kladde: lave forslag, bytte og låse.

import { type BordId, type ElevId, type Klasse, type Kladde, type Laas, type Lokale, type Placering, nyId } from './model';
import { kontrollerInput, lavPlacering } from './optimering';

export interface Plads {
  bordId: BordId;
  plads: number;
}

/** Faste pladser, der stadig passer til lokalet og klassen. */
export function gyldigeLaase(laase: Laas[], lokale: Lokale, elever: { id: ElevId }[]): Laas[] {
  const ider = new Set(elever.map((e) => e.id));
  const brugt = new Set<string>();
  const set = new Set<ElevId>();
  return laase.filter((l) => {
    const bord = lokale.borde.find((b) => b.id === l.bordId);
    const k = `${l.bordId}#${l.plads}`;
    if (!bord || l.plads >= bord.pladser || !ider.has(l.elevId) || brugt.has(k) || set.has(l.elevId)) return false;
    brugt.add(k);
    set.add(l.elevId);
    return true;
  });
}

export type KladdeResultat = { kladde: Kladde } | { fejl: string };

/** Laver et nyt forslag. Låse fra `laase` (eller klassens faste pladser) respekteres. */
export function lavKladde(klasse: Klasse, lokale: Lokale | null, dato: string, laase?: Laas[], seed?: number): KladdeResultat {
  if (!lokale) return { fejl: 'Vælg først et lokale.' };
  const brugte = gyldigeLaase(laase ?? klasse.faste, lokale, klasse.elever);
  const fejl = kontrollerInput({ elever: klasse.elever, lokale, laase: brugte });
  if (fejl.length > 0) return { fejl: fejl[0]! };
  const { placering } = lavPlacering({
    elever: klasse.elever,
    lokale,
    tidligere: klasse.planer,
    holdAdskilt: klasse.holdAdskilt,
    laase: brugte,
    seed,
  });
  return { kladde: { plan: { id: nyId(), dato, lokale: structuredClone(lokale), placering }, laase: brugte } };
}

/** Bytter indholdet af to pladser (en tom plads giver en flytning). Låse følger eleven. */
export function byt(kladde: Kladde, a: Plads, b: Plads): Kladde {
  const placering: Placering = structuredClone(kladde.plan.placering);
  const ea = placering[a.bordId]?.[a.plads] ?? null;
  const eb = placering[b.bordId]?.[b.plads] ?? null;
  if (!placering[a.bordId] || !placering[b.bordId]) return kladde;
  placering[a.bordId]![a.plads] = eb;
  placering[b.bordId]![b.plads] = ea;
  const laase = kladde.laase.map((l) => {
    if (l.elevId === ea) return { elevId: ea, ...b };
    if (l.elevId === eb) return { elevId: eb, ...a };
    return l;
  });
  return { plan: { ...kladde.plan, placering }, laase };
}

export function erLaast(kladde: Kladde, elevId: ElevId): boolean {
  return kladde.laase.some((l) => l.elevId === elevId);
}

/** Låser eleven på sin nuværende plads, eller låser op. */
export function skiftLaas(kladde: Kladde, elevId: ElevId): Kladde {
  if (erLaast(kladde, elevId)) return { ...kladde, laase: kladde.laase.filter((l) => l.elevId !== elevId) };
  const plads = findPlads(kladde.plan.placering, elevId);
  if (!plads) return kladde;
  return { ...kladde, laase: [...kladde.laase, { elevId, ...plads }] };
}

export function findPlads(placering: Placering, elevId: ElevId): Plads | null {
  for (const [bordId, pladser] of Object.entries(placering)) {
    const i = pladser.indexOf(elevId);
    if (i >= 0) return { bordId, plads: i };
  }
  return null;
}

/** Elever i klassen, som ikke har en plads i planen (fx tilføjet senere). */
export function manglerIPlan(placering: Placering, elever: { id: ElevId }[]): ElevId[] {
  const placeret = new Set(Object.values(placering).flat());
  return elever.filter((e) => !placeret.has(e.id)).map((e) => e.id);
}
