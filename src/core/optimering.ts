// Automatisk bordplan med simuleret udglødning.
//
// 1. Belægning: hvor mange elever der sidder ved hvert bord. Ingen sidder
//    alene, tomme pladser kommer i enden af bordet, og er der langt flere
//    pladser end elever, står de bageste borde tomme.
// 2. Inddeling: de optagne pladser deles i netværksgrupper og makkerpar
//    (se struktur.ts). Den ligger fast under optimeringen.
// 3. Udglødning: elever byttes mellem pladserne. Et byt vurderes kun på de
//    berørte grupper og borde, så det er hurtigt.

import { bygHistorik, parNoegle } from './historik';
import { type Elev, type ElevId, type Laas, type Lokale, type Placering, type Plan, antalPladser, forresteBorde } from './model';
import { type Rng, bland, heltal, lavRng } from './rng';
import { inddelPladser, raekkePladser } from './struktur';

export interface Vaegte {
  /** Pr. tidligere gang forrest, for en elev ved et forreste bord. */
  forrest: number;
  /** Ekstra, hvis eleven også var forrest i sidste plan. */
  forrestSidst: number;
  /** Ganges med nylighedsvægtene for to, der har været makkere før, og igen er makkere. */
  makker: number;
  /** Ganges med nylighedsvægtene for to, der har været i samme netværksgruppe og igen er det. */
  gruppe: number;
  /** For et makkerpar, hvor alle har samme køn. */
  parSammeKoen: number;
  /** Ganges med den kvadrerede afvigelse fra klassens kønsfordeling i en netværksgruppe. */
  koen: number;
  /** For hver elev, der er eneste af sit køn i en gruppe. */
  alene: number;
  /** Ekstra, hvis eleven også var alene i sidste plan. */
  aleneSidst: number;
  /** Ekstra pr. tidligere gang alene. */
  aleneTidligere: number;
  /** For et "hold adskilt"-par ved samme bord. */
  holdAdskilt: number;
}

export const STANDARDVAEGTE: Vaegte = {
  forrest: 50,
  forrestSidst: 200,
  makker: 15,
  gruppe: 6,
  parSammeKoen: 30,
  koen: 6,
  alene: 25,
  aleneSidst: 250,
  aleneTidligere: 25,
  holdAdskilt: 1e9,
};

export interface OptimeringsInput {
  elever: Elev[];
  lokale: Lokale;
  /** Gemte planer, ældste først. */
  tidligere: Plan[];
  holdAdskilt: [ElevId, ElevId][];
  laase: Laas[];
  seed?: number;
  starter?: number;
  forsoegPrStart?: number;
  vaegte?: Partial<Vaegte>;
}

export interface OptimeringsResultat {
  placering: Placering;
  straf: number;
}

export class PlanFejl extends Error {}

/** Problemer, der gør det umuligt at lave en plan. Tom liste betyder, at alt er i orden. */
export function kontrollerInput(input: Pick<OptimeringsInput, 'elever' | 'lokale' | 'laase'>): string[] {
  const fejl: string[] = [];
  const pladser = antalPladser(input.lokale);
  if (input.elever.length === 0) fejl.push('Klassen har ingen elever endnu. Tilføj elever først.');
  if (input.lokale.borde.length === 0) fejl.push('Lokalet har ingen borde. Tilføj borde under Lokale.');
  else if (input.elever.length > pladser) {
    const mangler = input.elever.length - pladser;
    fejl.push(`Der er ${input.elever.length} elever, men kun ${pladser} pladser. Tilføj borde eller pladser, så der er plads til ${mangler} mere.`);
  }
  const optaget = new Set<string>();
  for (const l of input.laase) {
    const bord = input.lokale.borde.find((b) => b.id === l.bordId);
    if (!bord || l.plads < 0 || l.plads >= bord.pladser) continue;
    const k = `${l.bordId}#${l.plads}`;
    if (optaget.has(k)) fejl.push('To elever er låst til den samme plads. Lås en af dem op.');
    optaget.add(k);
  }
  return fejl;
}

/**
 * Hvor mange elever der skal sidde ved hvert bord. Borde bagerst står tomme,
 * hvis de forreste kan rumme alle. De tomme pladser fordeles jævnt, og intet
 * bord får kun én elev, når det kan undgås.
 */
export function belaegning(kapacitet: number[], antal: number, laaste: number[] = []): number[] {
  const n = kapacitet.length;
  const min = (t: number) => laaste[t] ?? 0;
  const brugt = kapacitet.map(() => true);
  const kap = () => kapacitet.reduce((s, c, t) => s + (brugt[t] ? c : 0), 0);
  for (let t = n - 1; t >= 0; t--) {
    if (min(t) > 0) continue;
    brugt[t] = false;
    if (kap() < antal || !brugt.some(Boolean)) brugt[t] = true;
  }
  const ud = kapacitet.map((c, t) => (brugt[t] ? c : 0));
  const tomme = ud.map(() => 0);
  let overskud = ud.reduce((a, b) => a + b, 0) - antal;
  const proev = (tilladEn: boolean) => {
    while (overskud > 0) {
      let bedst = -1;
      for (let t = n - 1; t >= 0; t--) {
        const efter = ud[t]! - 1;
        if (!brugt[t] || efter < Math.max(min(t), tilladEn ? 0 : 2)) continue;
        if (bedst === -1 || tomme[t]! < tomme[bedst]!) bedst = t;
      }
      if (bedst === -1) return;
      ud[bedst]!--;
      tomme[bedst]!++;
      overskud--;
    }
  };
  proev(false);
  proev(true); // kun hvis det ikke kan undgås (meget små klasser)
  return ud;
}

export function lavPlacering(input: OptimeringsInput): OptimeringsResultat {
  const fejl = kontrollerInput(input);
  if (fejl.length > 0) throw new PlanFejl(fejl[0]);
  const v: Vaegte = { ...STANDARDVAEGTE, ...input.vaegte };
  const rng = lavRng(input.seed ?? (Date.now() ^ (Math.random() * 0x7fffffff)));
  const starter = input.starter ?? 8;
  const forsoeg = input.forsoegPrStart ?? 20000;

  const p = forbered(input, v);
  let bedste: Int32Array | null = null;
  let bedsteStraf = Infinity;
  for (let s = 0; s < starter; s++) {
    const { tildeling, straf } = udgloedning(p, rng, forsoeg);
    if (straf < bedsteStraf) {
      bedsteStraf = straf;
      bedste = tildeling;
    }
  }
  return { placering: tilPlacering(p, input, bedste!), straf: bedsteStraf };
}

/** Samlet straf for en given placering (bruges i tests). Inddelingen udledes af placeringen. */
export function beregnStraf(input: OptimeringsInput, placering: Placering): number {
  const v: Vaegte = { ...STANDARDVAEGTE, ...input.vaegte };
  const optagne = raekkePladser(input.lokale).map((r) => r.map((p, i) => (placering[p.bordId]?.[p.plads] ? i : -1)).filter((i) => i >= 0));
  const p = forbered(input, v, optagne);
  const idx = new Map(input.elever.map((e, i) => [e.id, i]));
  const t = new Int32Array(p.pladser.length).fill(-1);
  p.pladser.forEach((pl, s) => {
    const id = placering[input.lokale.borde[pl.bord]!.id]?.[pl.nr];
    if (id) t[s] = idx.get(id) ?? -1;
  });
  let sum = 0;
  for (let g = 0; g < p.grupper.length; g++) sum += gruppeStraf(p, t, g);
  for (let b = 0; b < p.bordPladser.length; b++) sum += bordStraf(p, t, b);
  return sum;
}

// ----------------------------------------------------------------------

interface Forberedt {
  n: number;
  /** De optagne pladser (én pr. elev). */
  pladser: { bord: number; nr: number }[];
  pladsGruppe: Int32Array;
  pladsBord: Int32Array;
  /** Grupper: listen af par, hvert par er en liste af pladsindeks. */
  grupper: { bord: number; forrest: boolean; par: number[][]; alle: number[] }[];
  /** Pladserne i hver række (borde, der står sammen). "Hold adskilt" gælder rækken. */
  bordPladser: number[][];
  koen: Uint8Array;
  andelDrenge: number;
  forrestStraf: Float64Array;
  aleneStraf: Float64Array;
  /** n × n: straf for at være makkere. */
  makkerStraf: Float64Array;
  /** n × n: straf for at være i samme gruppe (uden at være makkere). */
  gruppeStraf: Float64Array;
  /** n × n: 1 hvis de skal holdes adskilt. */
  adskilt: Uint8Array;
  v: Vaegte;
  laastPlads: Int32Array;
  pladsLaast: Uint8Array;
}

function forbered(input: OptimeringsInput, v: Vaegte, fasteOptagne?: number[][]): Forberedt {
  const { elever, lokale } = input;
  const n = elever.length;
  const idx = new Map(elever.map((e, i) => [e.id, i]));
  const h = bygHistorik(elever, input.tidligere);
  const forrest = forresteBorde(lokale);

  // Gyldige låse
  const laase: { e: number; bord: number; nr: number }[] = [];
  const brugt = new Set<string>();
  for (const l of input.laase) {
    const e = idx.get(l.elevId);
    const b = lokale.borde.findIndex((x) => x.id === l.bordId);
    if (e === undefined || b < 0 || l.plads < 0 || l.plads >= lokale.borde[b]!.pladser) continue;
    if (brugt.has(`${b}#${l.plads}`) || laase.some((x) => x.e === e)) continue;
    brugt.add(`${b}#${l.plads}`);
    laase.push({ e, bord: b, nr: l.plads });
  }

  // Borde, der står kant i kant, er én række. Hvilke pladser i hver række
  // er optaget: de første, så de tomme er i enden.
  const bordIndeks = new Map(lokale.borde.map((b, i) => [b.id, i]));
  const raekker = raekkePladser(lokale).map((r) => r.map((p) => ({ bord: bordIndeks.get(p.bordId)!, nr: p.plads })));
  let optagne = fasteOptagne;
  if (!optagne) {
    const laastI = (r: number) =>
      raekker[r]!.map((p, i) => (laase.some((l) => l.bord === p.bord && l.nr === p.nr) ? i : -1)).filter((i) => i >= 0);
    const bel = belaegning(raekker.map((r) => r.length), n, raekker.map((_, r) => laastI(r).length));
    optagne = raekker.map((r, ri) => {
      const valgt = new Set(laastI(ri));
      for (let i = 0; i < r.length && valgt.size < bel[ri]!; i++) valgt.add(i);
      return [...valgt].sort((x, y) => x - y);
    });
  }

  const pladser: { bord: number; nr: number }[] = [];
  const grupper: Forberedt['grupper'] = [];
  const bordPladser: number[][] = raekker.map(() => []);
  const pladsGruppe: number[] = [];
  const pladsBord: number[] = [];
  const pladsIndeks = new Map<string, number>();
  optagne.forEach((liste, ri) => {
    for (const g of inddelPladser(liste)) {
      const gi = grupper.length;
      const par = g.map((pp) =>
        pp.map((i) => {
          const pl = raekker[ri]![i]!;
          const s = pladser.length;
          pladser.push(pl);
          pladsGruppe.push(gi);
          pladsBord.push(ri);
          bordPladser[ri]!.push(s);
          pladsIndeks.set(`${pl.bord}#${pl.nr}`, s);
          return s;
        }),
      );
      const foerste = pladser[par[0]![0]!]!;
      grupper.push({ bord: ri, forrest: forrest.has(lokale.borde[foerste.bord]!.id), par, alle: par.flat() });
    }
  });

  const koen = new Uint8Array(n);
  let drenge = 0;
  let kendte = 0;
  elever.forEach((e, i) => {
    koen[i] = e.koen === 'D' ? 1 : e.koen === 'P' ? 2 : 0;
    if (e.koen) kendte++;
    if (e.koen === 'D') drenge++;
  });

  const forrestStraf = new Float64Array(n);
  const aleneStraf = new Float64Array(n);
  elever.forEach((e, i) => {
    forrestStraf[i] = v.forrest * (h.forrestAntal.get(e.id) ?? 0) + (h.forrestSidst.has(e.id) ? v.forrestSidst : 0);
    aleneStraf[i] = v.alene + v.aleneTidligere * (h.aleneAntal.get(e.id) ?? 0) + (h.aleneSidst.has(e.id) ? v.aleneSidst : 0);
  });

  const makkerStraf = new Float64Array(n * n);
  const gruppeStraf = new Float64Array(n * n);
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const k = parNoegle(elever[a]!.id, elever[b]!.id);
      const g = v.gruppe * (h.gruppe.vaegt.get(k) ?? 0);
      const m = v.makker * (h.makker.vaegt.get(k) ?? 0) + g;
      makkerStraf[a * n + b] = makkerStraf[b * n + a] = m;
      gruppeStraf[a * n + b] = gruppeStraf[b * n + a] = g;
    }
  }
  const adskilt = new Uint8Array(n * n);
  for (const [x, y] of input.holdAdskilt) {
    const a = idx.get(x);
    const b = idx.get(y);
    if (a === undefined || b === undefined || a === b) continue;
    adskilt[a * n + b] = adskilt[b * n + a] = 1;
  }

  const laastPlads = new Int32Array(n).fill(-1);
  const pladsLaast = new Uint8Array(pladser.length);
  for (const l of laase) {
    const s = pladsIndeks.get(`${l.bord}#${l.nr}`);
    if (s === undefined) continue;
    laastPlads[l.e] = s;
    pladsLaast[s] = 1;
  }

  return {
    n,
    pladser,
    pladsGruppe: Int32Array.from(pladsGruppe),
    pladsBord: Int32Array.from(pladsBord),
    grupper,
    bordPladser,
    koen,
    andelDrenge: kendte > 0 ? drenge / kendte : 0,
    forrestStraf,
    aleneStraf,
    makkerStraf,
    gruppeStraf,
    adskilt,
    v,
    laastPlads,
    pladsLaast,
  };
}

/** Straffen for én netværksgruppe: makkerpar, gruppe, køn og forrest. */
function gruppeStraf(p: Forberedt, t: Int32Array, gi: number): number {
  const g = p.grupper[gi]!;
  const n = p.n;
  let straf = 0;
  let drenge = 0;
  let piger = 0;
  for (let pi = 0; pi < g.par.length; pi++) {
    const par = g.par[pi]!;
    let pd = 0;
    let pp = 0;
    for (let i = 0; i < par.length; i++) {
      const e = t[par[i]!]!;
      if (e < 0) continue;
      if (g.forrest) straf += p.forrestStraf[e]!;
      const k = p.koen[e];
      if (k === 1) pd++;
      else if (k === 2) pp++;
      for (let j = i + 1; j < par.length; j++) {
        const f = t[par[j]!]!;
        if (f >= 0) straf += p.makkerStraf[e * n + f]!;
      }
      // Med de andre par i gruppen
      for (let qi = pi + 1; qi < g.par.length; qi++) {
        for (const s of g.par[qi]!) {
          const f = t[s]!;
          if (f >= 0) straf += p.gruppeStraf[e * n + f]!;
        }
      }
    }
    if (par.length >= 2 && pd + pp === par.length && (pd === 0 || pp === 0)) straf += p.v.parSammeKoen;
    drenge += pd;
    piger += pp;
  }
  const kendte = drenge + piger;
  if (kendte > 0) {
    const afv = drenge - p.andelDrenge * kendte;
    straf += p.v.koen * afv * afv;
  }
  const aleneKoen = drenge === 1 && piger >= 2 ? 1 : piger === 1 && drenge >= 2 ? 2 : 0;
  if (aleneKoen) {
    for (const s of g.alle) {
      const e = t[s]!;
      if (e >= 0 && p.koen[e] === aleneKoen) straf += p.aleneStraf[e]!;
    }
  }
  return straf;
}

/** "Hold adskilt" gælder hele bordet (og borde, der står sammen med det). */
function bordStraf(p: Forberedt, t: Int32Array, b: number): number {
  const pl = p.bordPladser[b]!;
  let straf = 0;
  for (let i = 0; i < pl.length; i++) {
    const e = t[pl[i]!]!;
    if (e < 0) continue;
    for (let j = i + 1; j < pl.length; j++) {
      const f = t[pl[j]!]!;
      if (f >= 0 && p.adskilt[e * p.n + f]) straf += p.v.holdAdskilt;
    }
  }
  return straf;
}

function udgloedning(p: Forberedt, rng: Rng, forsoeg: number): { tildeling: Int32Array; straf: number } {
  const S = p.pladser.length;
  const t = new Int32Array(S).fill(-1);
  const frie: number[] = [];
  for (let e = 0; e < p.n; e++) {
    if (p.laastPlads[e]! >= 0) t[p.laastPlads[e]!] = e;
    else frie.push(e);
  }
  const ledige = bland(rng, Array.from({ length: S }, (_, s) => s).filter((s) => t[s] === -1));
  bland(rng, frie).forEach((e, i) => (t[ledige[i]!] = e));

  const gS = new Float64Array(p.grupper.length);
  const bS = new Float64Array(p.bordPladser.length);
  let straf = 0;
  for (let g = 0; g < gS.length; g++) straf += gS[g] = gruppeStraf(p, t, g);
  for (let b = 0; b < bS.length; b++) straf += bS[b] = bordStraf(p, t, b);
  let bedsteStraf = straf;
  let bedste = t.slice();

  const flytbare: number[] = [];
  for (let s = 0; s < S; s++) if (!p.pladsLaast[s]) flytbare.push(s);
  if (flytbare.length < 2) return { tildeling: bedste, straf };

  const tStart = 60;
  const tSlut = 0.2;
  const faktor = Math.pow(tSlut / tStart, 1 / forsoeg);
  let temp = tStart;

  for (let i = 0; i < forsoeg; i++, temp *= faktor) {
    const a = flytbare[heltal(rng, flytbare.length)]!;
    const b = flytbare[heltal(rng, flytbare.length)]!;
    if (a === b) continue;
    const ga = p.pladsGruppe[a]!;
    const gb = p.pladsGruppe[b]!;
    const ba = p.pladsBord[a]!;
    const bb = p.pladsBord[b]!;
    const ea = t[a]!;
    const eb = t[b]!;
    t[a] = eb;
    t[b] = ea;
    const nyGa = gruppeStraf(p, t, ga);
    const nyGb = ga === gb ? 0 : gruppeStraf(p, t, gb);
    const nyBa = ba === bb ? bS[ba]! : bordStraf(p, t, ba);
    const nyBb = ba === bb ? 0 : bordStraf(p, t, bb);
    const foer = gS[ga]! + (ga === gb ? 0 : gS[gb]!) + (ba === bb ? bS[ba]! : bS[ba]! + bS[bb]!);
    const delta = nyGa + nyGb + nyBa + nyBb - foer;
    if (delta <= 0 || rng() < Math.exp(-delta / temp)) {
      gS[ga] = nyGa;
      if (ga !== gb) gS[gb] = nyGb;
      bS[ba] = nyBa;
      if (ba !== bb) bS[bb] = nyBb;
      straf += delta;
      if (straf < bedsteStraf - 1e-9) {
        bedsteStraf = straf;
        bedste = t.slice();
      }
    } else {
      t[a] = ea;
      t[b] = eb;
    }
  }
  return { tildeling: bedste, straf: bedsteStraf };
}

function tilPlacering(p: Forberedt, input: OptimeringsInput, t: Int32Array): Placering {
  const placering: Placering = {};
  for (const bord of input.lokale.borde) placering[bord.id] = new Array(bord.pladser).fill(null);
  t.forEach((e, s) => {
    const pl = p.pladser[s]!;
    placering[input.lokale.borde[pl.bord]!.id]![pl.nr] = e >= 0 ? input.elever[e]!.id : null;
  });
  return placering;
}
