// Pointene på spillepladen. Ren logik uden DOM.
//
// Spil giver meget forskellige point (Micro Trader fra -6 til +3 pr. case,
// Counter-Norm i tusinder), og grupperne er på 3 til 5 elever. Derfor regnes
// hvert resultat om til procent af det mulige (0 til 100), og en gruppes
// runde er gennemsnittet for de elever i gruppen, der er med i spillet.
// Elever, der er med, men ikke har spillet endnu, tæller som 0, så hele
// gruppen skal bidrage. Elever, der ikke er logget på (fx fraværende),
// tæller ikke med. Klikpoint fra læreren lægges oven i.

import { type PladsNoegle } from './protokol';

export interface Deltager {
  plads: PladsNoegle;
  figur: string;
  enhed: string;
}

export interface Resultat {
  id: string;
  plads: PladsNoegle;
  spil: string;
  point: number;
  maks: number;
}

export interface Klik {
  id: string;
  gruppe: number;
  point: number;
}

export interface Stand {
  deltagere: Record<PladsNoegle, Deltager>;
  /** Afsluttede runder: gruppenummer → rundens point. */
  runder: Record<number, number>[];
  /** Resultater i den runde, der er i gang. */
  aktuel: Resultat[];
  klik: Klik[];
}

export function tomStand(): Stand {
  return { deltagere: {}, runder: [], aktuel: [], klik: [] };
}

export interface GruppePladser {
  nr: number;
  pladser: PladsNoegle[];
}

/** Et resultat i procent af det mulige, mellem 0 og 100. */
export function procent(r: { point: number; maks: number }): number {
  if (!(r.maks > 0)) return 0;
  return Math.max(0, Math.min(100, (r.point / r.maks) * 100));
}

/** Den nyeste procent for hver plads i runden. */
function senestePrPlads(resultater: Resultat[]): Map<PladsNoegle, number> {
  const m = new Map<PladsNoegle, number>();
  for (const r of resultater) m.set(r.plads, procent(r));
  return m;
}

/** Gruppens point i den runde, der er i gang (0 til 100). */
export function rundePoint(g: GruppePladser, stand: Stand): number {
  const med = g.pladser.filter((p) => stand.deltagere[p]);
  if (med.length === 0) return 0;
  const seneste = senestePrPlads(stand.aktuel);
  const sum = med.reduce((s, p) => s + (seneste.get(p) ?? 0), 0);
  return Math.round(sum / med.length);
}

export interface Placering {
  nr: number;
  total: number;
  runde: number;
  klik: number;
  /** Elever i gruppen, der er med i spillet. */
  med: number;
  /** Af dem: hvor mange har et resultat i runden. */
  spillet: number;
  /** 1 for førstepladsen. Lige mange point giver samme plads. */
  plads: number;
}

export function stilling(grupper: GruppePladser[], stand: Stand): Placering[] {
  const seneste = senestePrPlads(stand.aktuel);
  const raekke = grupper.map((g) => {
    const runde = rundePoint(g, stand);
    const tidligere = stand.runder.reduce((s, r) => s + (r[g.nr] ?? 0), 0);
    const klik = stand.klik.filter((k) => k.gruppe === g.nr).reduce((s, k) => s + k.point, 0);
    const med = g.pladser.filter((p) => stand.deltagere[p]);
    return { nr: g.nr, total: tidligere + runde + klik, runde, klik, med: med.length, spillet: med.filter((p) => seneste.has(p)).length, plads: 0 };
  });
  raekke.sort((a, b) => b.total - a.total || a.nr - b.nr);
  raekke.forEach((r, i) => {
    r.plads = i > 0 && r.total === raekke[i - 1]!.total ? raekke[i - 1]!.plads : i + 1;
  });
  return raekke;
}

/** En elev melder sig på en plads. En enhed kan kun sidde ét sted; flytter den, frigives den gamle plads. */
export function tilmeld(stand: Stand, d: Deltager, gyldige: Set<PladsNoegle>): Stand {
  if (!gyldige.has(d.plads)) return stand;
  const deltagere: Record<PladsNoegle, Deltager> = {};
  for (const [p, x] of Object.entries(stand.deltagere)) if (x.enhed !== d.enhed) deltagere[p] = x;
  deltagere[d.plads] = d;
  return { ...stand, deltagere };
}

/** Et resultat fra et spil. Kun fra den enhed, der sidder på pladsen, og kun én gang pr. id. */
export function modtagResultat(stand: Stand, r: Resultat & { enhed: string }): Stand {
  const d = stand.deltagere[r.plads];
  if (!d || d.enhed !== r.enhed) return stand;
  if (stand.aktuel.some((x) => x.id === r.id)) return stand;
  const { enhed: _enhed, ...resultat } = r;
  return { ...stand, aktuel: [...stand.aktuel, resultat] };
}

export function givKlik(stand: Stand, k: Klik): Stand {
  return { ...stand, klik: [...stand.klik, k] };
}

/** Fjerner det seneste klik, læreren gav (til "Fortryd"). */
export function fortrydKlik(stand: Stand): Stand {
  return { ...stand, klik: stand.klik.slice(0, -1) };
}

/** Afslutter runden: pointene gemmes, og eleverne kan spille igen fra 0. */
export function nyRunde(stand: Stand, grupper: GruppePladser[]): Stand {
  if (stand.aktuel.length === 0) return stand;
  const runde: Record<number, number> = {};
  for (const g of grupper) runde[g.nr] = rundePoint(g, stand);
  return { ...stand, runder: [...stand.runder, runde], aktuel: [] };
}

/** Starter forfra, men eleverne bliver siddende med deres figurer. */
export function nulstil(stand: Stand): Stand {
  return { ...stand, runder: [], aktuel: [], klik: [] };
}
