// Sikkerhedskopi som JSON-fil. Ved indlæsning bygges alt op på ny ud fra
// kendte felter, så en fil aldrig kan få appen til at gemme andet end
// fornavn, køn, lokale, planer, låse og "hold adskilt"-par.

import { type AppData, type Bord, type Elev, type Klasse, type Kladde, type Laas, type Lokale, type Placering, type Plan } from './model';

export const FILTYPE = 'pladsrokaden';
const MAKS_NAVN = 60;

export function tilFil(d: AppData, nu: Date = new Date()): string {
  return JSON.stringify({ filtype: FILTYPE, version: 1, gemt: nu.toISOString(), klasser: d.klasser.map(rensKlasse) }, null, 1);
}

export function filnavn(dato: string): string {
  return `pladsrokaden-${dato}.json`;
}

export type FilResultat = { klasser: Klasse[] } | { fejl: string };

export function fraFil(tekst: string): FilResultat {
  let raa: unknown;
  try {
    raa = JSON.parse(tekst);
  } catch {
    return { fejl: 'Filen kunne ikke læses. Vælg en fil, der er gemt med "Gem sikkerhedskopi".' };
  }
  if (!erObjekt(raa) || raa['filtype'] !== FILTYPE || !Array.isArray(raa['klasser'])) {
    return { fejl: 'Filen er ikke en sikkerhedskopi fra Pladsrokaden. Vælg en fil, der hedder noget med "pladsrokaden".' };
  }
  if (typeof raa['version'] !== 'number' || raa['version'] > 1) {
    return { fejl: 'Filen er lavet med en nyere version af Pladsrokaden. Genindlæs siden, og prøv igen.' };
  }
  const klasser: Klasse[] = [];
  for (const k of raa['klasser']) {
    const r = laesKlasse(k);
    if (!r) return { fejl: 'Filen er beskadiget og kan ikke hentes. Prøv en anden sikkerhedskopi.' };
    klasser.push(r);
  }
  return { klasser };
}

/** Lægger klasser fra en fil ind. Klasser med samme id erstattes; andre tilføjes. */
export function flet(d: AppData, klasser: Klasse[]): AppData {
  const ud = d.klasser.map((k) => klasser.find((n) => n.id === k.id) ?? k);
  for (const n of klasser) if (!d.klasser.some((k) => k.id === n.id)) ud.push(n);
  return { ...d, klasser: ud, aktivKlasseId: d.aktivKlasseId ?? klasser[0]?.id ?? null };
}

// ----------------------------------------------------------------------

function rensKlasse(k: Klasse): Klasse {
  return laesKlasse(JSON.parse(JSON.stringify(k)))!;
}

function erObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
const tekst = (x: unknown, maks = 100): x is string => typeof x === 'string' && x.length > 0 && x.length <= maks;
const heltal = (x: unknown, min: number, maks: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= maks;
const dato = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);

function laesKlasse(x: unknown): Klasse | null {
  if (!erObjekt(x) || !tekst(x['id']) || !tekst(x['navn'], MAKS_NAVN) || !Array.isArray(x['elever'])) return null;
  const elever: Elev[] = [];
  for (const e of x['elever']) {
    if (!erObjekt(e) || !tekst(e['id']) || !tekst(e['navn'], MAKS_NAVN)) return null;
    const koen = e['koen'] === 'P' || e['koen'] === 'D' ? e['koen'] : null;
    elever.push({ id: e['id'], navn: e['navn'], koen });
  }
  const ider = new Set(elever.map((e) => e.id));
  const holdAdskilt: [string, string][] = [];
  for (const p of Array.isArray(x['holdAdskilt']) ? x['holdAdskilt'] : []) {
    if (Array.isArray(p) && p.length === 2 && ider.has(p[0]) && ider.has(p[1]) && p[0] !== p[1]) holdAdskilt.push([p[0], p[1]]);
  }
  const lokale = x['lokale'] == null ? null : laesLokale(x['lokale']);
  if (x['lokale'] != null && !lokale) return null;
  const planer: Plan[] = [];
  for (const p of Array.isArray(x['planer']) ? x['planer'] : []) {
    const plan = laesPlan(p);
    if (!plan) return null;
    planer.push(plan);
  }
  let kladde: Kladde | null = null;
  if (erObjekt(x['kladde'])) {
    const plan = laesPlan(x['kladde']['plan']);
    if (plan) kladde = { plan, laase: laesLaase(x['kladde']['laase']) };
  }
  return {
    id: x['id'],
    navn: x['navn'],
    erDemo: x['erDemo'] === true,
    elever,
    holdAdskilt,
    faste: laesLaase(x['faste']).filter((l) => ider.has(l.elevId)),
    lokale,
    planer,
    kladde,
  };
}

function laesLokale(x: unknown): Lokale | null {
  if (!erObjekt(x) || !Array.isArray(x['borde']) || x['borde'].length === 0 || x['borde'].length > 60) return null;
  const borde: Bord[] = [];
  for (const b of x['borde']) {
    if (!erObjekt(b) || !tekst(b['id']) || !heltal(b['raekke'], 0, 60) || !heltal(b['kolonne'], 0, 60) || !heltal(b['pladser'], 1, 12)) return null;
    borde.push({ id: b['id'], raekke: b['raekke'], kolonne: b['kolonne'], pladser: b['pladser'] });
  }
  return { borde, forresteRaekker: heltal(x['forresteRaekker'], 1, 60) ? x['forresteRaekker'] : 1 };
}

function laesPlan(x: unknown): Plan | null {
  if (!erObjekt(x) || !tekst(x['id']) || !dato(x['dato'])) return null;
  const lokale = laesLokale(x['lokale']);
  if (!lokale || !erObjekt(x['placering'])) return null;
  const placering: Placering = {};
  for (const b of lokale.borde) {
    const pladser = x['placering'][b.id];
    placering[b.id] = Array.from({ length: b.pladser }, (_, i) => {
      const v = Array.isArray(pladser) ? pladser[i] : null;
      return tekst(v) ? v : null;
    });
  }
  return { id: x['id'], dato: x['dato'], lokale, placering };
}

function laesLaase(x: unknown): Laas[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((l): l is Record<string, unknown> => erObjekt(l) && tekst(l['elevId']) && tekst(l['bordId']) && heltal(l['plads'], 0, 12))
    .map((l) => ({ elevId: l['elevId'] as string, bordId: l['bordId'] as string, plads: l['plads'] as number }));
}
