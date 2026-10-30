// Automatisk bordplan med simuleret udglødning.
//
// Eleverne fordeles på pladser. Et træk bytter to elever ved forskellige
// borde, eller flytter en elev til en tom plads, når det holder fordelingen
// jævn. Trækket vurderes kun på de to berørte borde, så det er hurtigt.

import { bygHistorik, parNoegle } from './historik';
import { type Elev, type ElevId, type Laas, type Lokale, type Placering, type Plan, antalPladser, erForrest } from './model';
import { type Rng, bland, heltal, lavRng } from './rng';

export interface Vaegte {
  /** Pr. tidligere gang forrest, for en elev ved et forreste bord. */
  forrest: number;
  /** Ekstra, hvis eleven også var forrest i sidste plan. */
  forrestSidst: number;
  /** Ganges med summen af nylighedsvægte for et par, der har siddet sammen. */
  par: number;
  /** Ganges med den kvadrerede afvigelse fra klassens kønsfordeling ved et bord. */
  koen: number;
  /** For hver elev, der er eneste af sit køn ved et bord. */
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
  par: 10,
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
  if (input.elever.length > pladser) {
    const mangler = input.elever.length - pladser;
    fejl.push(`Der er ${input.elever.length} elever, men kun ${pladser} pladser. Tilføj borde, så der er plads til ${mangler} mere.`);
  }
  const optaget = new Set<string>();
  for (const l of input.laase) {
    const bord = input.lokale.borde.find((b) => b.id === l.bordId);
    if (!bord || l.plads < 0 || l.plads >= bord.pladser) continue; // ugyldige låse ignoreres
    const k = `${l.bordId}#${l.plads}`;
    if (optaget.has(k)) fejl.push('To elever er låst til den samme plads. Lås en af dem op.');
    optaget.add(k);
  }
  return fejl;
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

  const placering: Placering = {};
  for (const bord of input.lokale.borde) placering[bord.id] = new Array(bord.pladser).fill(null);
  bedste!.forEach((elev, plads) => {
    placering[p.pladsBordId[plads]!]![p.pladsNr[plads]!] = elev >= 0 ? input.elever[elev]!.id : null;
  });
  return { placering, straf: bedsteStraf };
}

/** Samlet straf for en given placering (bruges i tests og til at sammenligne). */
export function beregnStraf(input: OptimeringsInput, placering: Placering): number {
  const v: Vaegte = { ...STANDARDVAEGTE, ...input.vaegte };
  const p = forbered(input, v);
  const idx = new Map(input.elever.map((e, i) => [e.id, i]));
  const t = new Int32Array(p.antalPladser).fill(-1);
  for (let s = 0; s < p.antalPladser; s++) {
    const id = placering[p.pladsBordId[s]!]?.[p.pladsNr[s]!];
    if (id) t[s] = idx.get(id) ?? -1;
  }
  let sum = 0;
  for (let b = 0; b < p.antalBorde; b++) sum += bordStraf(p, t, b);
  return sum;
}

// ----------------------------------------------------------------------
// Intern repræsentation: elever og pladser som tal i typede arrays.

interface Forberedt {
  n: number;
  antalPladser: number;
  antalBorde: number;
  pladsBord: Int32Array;
  pladsNr: Int32Array;
  pladsBordId: string[];
  bordPladser: Int32Array[];
  bordForrest: Uint8Array;
  pladsKapacitet: Int32Array;
  /** 1 = dreng, 2 = pige, 0 = ikke angivet. */
  koen: Uint8Array;
  andelDrenge: number;
  forrestStraf: Float64Array;
  aleneStraf: Float64Array;
  /** n × n: straf for at sidde ved samme bord. */
  parStraf: Float64Array;
  koenVaegt: number;
  /** Låste elevers plads (-1 hvis ikke låst). */
  laastPlads: Int32Array;
  pladsLaast: Uint8Array;
}

function forbered(input: OptimeringsInput, v: Vaegte): Forberedt {
  const { elever, lokale } = input;
  const n = elever.length;
  const idx = new Map(elever.map((e, i) => [e.id, i]));
  const h = bygHistorik(elever, input.tidligere);

  const pladsBord: number[] = [];
  const pladsNr: number[] = [];
  const pladsBordId: string[] = [];
  const bordPladser: Int32Array[] = [];
  const bordForrest = new Uint8Array(lokale.borde.length);
  lokale.borde.forEach((bord, b) => {
    const liste: number[] = [];
    for (let i = 0; i < bord.pladser; i++) {
      liste.push(pladsBord.length);
      pladsBord.push(b);
      pladsNr.push(i);
      pladsBordId.push(bord.id);
    }
    bordPladser.push(Int32Array.from(liste));
    bordForrest[b] = erForrest(bord, lokale) ? 1 : 0;
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

  const parStraf = new Float64Array(n * n);
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const s = v.par * (h.parVaegt.get(parNoegle(elever[a]!.id, elever[b]!.id)) ?? 0);
      parStraf[a * n + b] = s;
      parStraf[b * n + a] = s;
    }
  }
  for (const [x, y] of input.holdAdskilt) {
    const a = idx.get(x);
    const b = idx.get(y);
    if (a === undefined || b === undefined || a === b) continue;
    parStraf[a * n + b]! += v.holdAdskilt;
    parStraf[b * n + a]! += v.holdAdskilt;
  }

  const laastPlads = new Int32Array(n).fill(-1);
  const pladsLaast = new Uint8Array(pladsBord.length);
  for (const l of input.laase) {
    const e = idx.get(l.elevId);
    const b = lokale.borde.findIndex((x) => x.id === l.bordId);
    if (e === undefined || b < 0 || l.plads < 0 || l.plads >= lokale.borde[b]!.pladser) continue;
    const s = bordPladser[b]![l.plads]!;
    if (pladsLaast[s] || laastPlads[e]! >= 0) continue;
    laastPlads[e] = s;
    pladsLaast[s] = 1;
  }

  return {
    n,
    antalPladser: pladsBord.length,
    antalBorde: lokale.borde.length,
    pladsBord: Int32Array.from(pladsBord),
    pladsNr: Int32Array.from(pladsNr),
    pladsBordId,
    bordPladser,
    bordForrest,
    pladsKapacitet: Int32Array.from(lokale.borde.map((b) => b.pladser)),
    koen,
    andelDrenge: kendte > 0 ? drenge / kendte : 0,
    forrestStraf,
    aleneStraf,
    parStraf,
    koenVaegt: v.koen,
    laastPlads,
    pladsLaast,
  };
}

/** Straffen for ét bord ud fra, hvem der sidder der lige nu. */
function bordStraf(p: Forberedt, t: Int32Array, b: number): number {
  const pladser = p.bordPladser[b]!;
  let straf = 0;
  let drenge = 0;
  let piger = 0;
  const forrest = p.bordForrest[b] === 1;
  for (let i = 0; i < pladser.length; i++) {
    const e = t[pladser[i]!]!;
    if (e < 0) continue;
    if (forrest) straf += p.forrestStraf[e]!;
    const k = p.koen[e];
    if (k === 1) drenge++;
    else if (k === 2) piger++;
    const raekke = e * p.n;
    for (let j = i + 1; j < pladser.length; j++) {
      const f = t[pladser[j]!]!;
      if (f >= 0) straf += p.parStraf[raekke + f]!;
    }
  }
  const kendte = drenge + piger;
  if (kendte > 0) {
    const afv = drenge - p.andelDrenge * kendte;
    straf += p.koenVaegt * afv * afv;
  }
  const aleneKoen = drenge === 1 && piger >= 2 ? 1 : piger === 1 && drenge >= 2 ? 2 : 0;
  if (aleneKoen) {
    for (let i = 0; i < pladser.length; i++) {
      const e = t[pladser[i]!]!;
      if (e >= 0 && p.koen[e] === aleneKoen) straf += p.aleneStraf[e]!;
    }
  }
  return straf;
}

/** En tilfældig startfordeling, der er så jævn som muligt. */
function startfordeling(p: Forberedt, rng: Rng): { t: Int32Array; antal: Int32Array } {
  const t = new Int32Array(p.antalPladser).fill(-1);
  const antal = new Int32Array(p.antalBorde);
  const frie: number[] = [];
  for (let e = 0; e < p.n; e++) {
    const s = p.laastPlads[e]!;
    if (s >= 0) {
      t[s] = e;
      antal[p.pladsBord[s]!]!++;
    } else frie.push(e);
  }
  // Jævn fordeling oven på de låste: læg én elev ad gangen ved det mindst
  // fyldte bord med ledig plads. Lige store borde vælges tilfældigt.
  const maal = Array.from(antal);
  const orden = bland(rng, Array.from({ length: p.antalBorde }, (_, b) => b));
  for (let k = 0; k < frie.length; k++) {
    let bedst = -1;
    for (const b of orden) {
      if (maal[b]! < p.pladsKapacitet[b]! && (bedst === -1 || maal[b]! < maal[bedst]!)) bedst = b;
    }
    maal[bedst]!++;
  }
  const blandede = bland(rng, frie);
  let k = 0;
  for (let b = 0; b < p.antalBorde; b++) {
    const tomme = bland(rng, Array.from(p.bordPladser[b]!).filter((s) => t[s] === -1));
    for (let i = 0; antal[b]! < maal[b]!; i++) {
      t[tomme[i]!] = blandede[k++]!;
      antal[b]!++;
    }
  }
  return { t, antal };
}

function udgloedning(p: Forberedt, rng: Rng, forsoeg: number): { tildeling: Int32Array; straf: number } {
  const { t, antal } = startfordeling(p, rng);
  const bordS = new Float64Array(p.antalBorde);
  let straf = 0;
  for (let b = 0; b < p.antalBorde; b++) {
    bordS[b] = bordStraf(p, t, b);
    straf += bordS[b]!;
  }
  let bedsteStraf = straf;
  let bedste = t.slice();

  const flytbare: number[] = [];
  for (let s = 0; s < p.antalPladser; s++) if (!p.pladsLaast[s]) flytbare.push(s);
  const antalElever = flytbare.reduce((a, s) => a + (t[s]! >= 0 ? 1 : 0), 0);
  if (antalElever === 0 || p.antalBorde < 2) return { tildeling: bedste, straf };

  const tStart = 60;
  const tSlut = 0.2;
  const faktor = Math.pow(tSlut / tStart, 1 / forsoeg);
  let temp = tStart;

  for (let i = 0; i < forsoeg; i++, temp *= faktor) {
    const a = flytbare[heltal(rng, flytbare.length)]!;
    const b = flytbare[heltal(rng, flytbare.length)]!;
    const ba = p.pladsBord[a]!;
    const bb = p.pladsBord[b]!;
    if (ba === bb) continue;
    const ea = t[a]!;
    const eb = t[b]!;
    if (ea < 0 && eb < 0) continue;
    // Flyt til tom plads kun, hvis bordene stadig er jævnt fyldt bagefter.
    if (eb < 0 && antal[ba] !== antal[bb]! + 1) continue;
    if (ea < 0 && antal[bb] !== antal[ba]! + 1) continue;

    t[a] = eb;
    t[b] = ea;
    const nyA = bordStraf(p, t, ba);
    const nyB = bordStraf(p, t, bb);
    const delta = nyA + nyB - bordS[ba]! - bordS[bb]!;
    if (delta <= 0 || rng() < Math.exp(-delta / temp)) {
      bordS[ba] = nyA;
      bordS[bb] = nyB;
      straf += delta;
      if (ea < 0) {
        antal[ba]!++;
        antal[bb]!--;
      } else if (eb < 0) {
        antal[ba]!--;
        antal[bb]!++;
      }
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
