// Sikkerhedskopi som JSON-fil, og indlæsning af gemte data. Alt bygges op
// på ny ud fra kendte felter, så en fil aldrig kan få appen til at gemme
// andet end fornavn, køn, lokaler, planer, låse og "hold adskilt"-par.
// Data fra appens første version (version 1) flyttes over automatisk.

import { kunFornavn, navngivDubletter, normaliserHold } from './import';
import { type LokaleV1, flytMobilskabFri, fraDybeBorde, fraV1 } from './lokale';
import {
  type AppData,
  type Bord,
  type Elev,
  type Klasse,
  type Kladde,
  type Laas,
  type Lokale,
  type Placering,
  type Plan,
  type Vaeg,
  nyId,
  tomtAppData,
} from './model';

export const FILTYPE = 'pladsrokaden';
const MAKS_NAVN = 60;

export function tilFil(d: AppData, nu: Date = new Date()): string {
  const indhold = laesIndhold({ klasser: d.klasser, lokaler: d.lokaler });
  return JSON.stringify({ filtype: FILTYPE, version: 3, gemt: nu.toISOString(), ...indhold }, null, 1);
}

export function filnavn(dato: string): string {
  return `pladsrokaden-${dato}.json`;
}

export interface Indhold {
  klasser: Klasse[];
  lokaler: Lokale[];
}

export type FilResultat = Indhold | { fejl: string };

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
  if (typeof raa['version'] !== 'number' || raa['version'] > 3) {
    return { fejl: 'Filen er lavet med en nyere version af Pladsrokaden. Genindlæs siden, og prøv igen.' };
  }
  const r = laesIndhold(raa);
  if (r && raa['version'] < 3) opgraderTil3(r);
  if (r) for (const l of r.lokaler) flytMobilskabFri(l);
  return r ?? { fejl: 'Filen er beskadiget og kan ikke hentes. Prøv en anden sikkerhedskopi.' };
}

/** Læser data fra browserens lager (version 1 eller 2). Ugyldige data giver tomme data. */
export function laesAppData(raa: unknown): AppData {
  if (!erObjekt(raa) || ![1, 2, 3].includes(raa['version'] as number)) return tomtAppData();
  const r = laesIndhold(raa);
  if (!r) return tomtAppData();
  if ((raa['version'] as number) < 3) opgraderTil3(r);
  for (const l of r.lokaler) flytMobilskabFri(l);
  const aktiv = typeof raa['aktivKlasseId'] === 'string' && r.klasser.some((k) => k.id === raa['aktivKlasseId']) ? raa['aktivKlasseId'] : null;
  const sidst = typeof raa['sidstEksporteret'] === 'string' ? raa['sidstEksporteret'] : null;
  return { version: 3, klasser: r.klasser, lokaler: r.lokaler, aktivKlasseId: aktiv, sidstEksporteret: sidst };
}

/** Engangsopgradering af data fra version 1 og 2: navne og bordenes dybde. */
function opgraderTil3(r: Indhold): void {
  for (const l of r.lokaler) fraDybeBorde(l);
  for (const k of r.klasser) {
    k.elever = forkortNavne(k.elever);
    for (const p of k.planer) fraDybeBorde(p.lokale);
    if (k.kladde) fraDybeBorde(k.kladde.plan.lokale);
  }
}

/**
 * Engangsoprydning af data fra version 1 og 2, hvor en fejl i importen kunne
 * gemme mellemnavne og efternavne: kun første fornavn beholdes. Navne, der
 * derved bliver ens, får forbogstavet i det sidste af de fjernede navne.
 */
export function forkortNavne(elever: Elev[]): Elev[] {
  const udtraek = elever.map((e) => {
    const kort = kunFornavn(e.navn);
    const ord = e.navn.trim().split(/\s+/);
    const sidste = kort === e.navn.trim() ? undefined : ord[ord.length - 1];
    return { fornavn: kort, efternavnStart: sidste?.replace(/[^\p{L}]/gu, '').slice(0, 2), koen: e.koen };
  });
  const navne = navngivDubletter(udtraek);
  return elever.map((e, i) => ({ ...e, navn: navne[i]!.navn }));
}

/** Lægger klasser og lokaler fra en fil ind. Samme id erstattes; andre tilføjes. */
export function flet(d: AppData, ind: Indhold): AppData {
  const fletListe = <T extends { id: string }>(gamle: T[], nye: T[]) => [
    ...gamle.map((g) => nye.find((n) => n.id === g.id) ?? g),
    ...nye.filter((n) => !gamle.some((g) => g.id === n.id)),
  ];
  return {
    ...d,
    klasser: fletListe(d.klasser, ind.klasser),
    lokaler: fletListe(d.lokaler, ind.lokaler),
    aktivKlasseId: d.aktivKlasseId ?? ind.klasser[0]?.id ?? null,
  };
}

// ----------------------------------------------------------------------

function erObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
const tekst = (x: unknown, maks = 100): x is string => typeof x === 'string' && x.length > 0 && x.length <= maks;
const heltal = (x: unknown, min: number, maks: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= maks;
const tal = (x: unknown, min: number, maks: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= maks;
const dato = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const VAEGGE: Vaeg[] = ['top', 'bund', 'venstre', 'hoejre'];

function laesIndhold(x: Record<string, unknown> | Indhold): Indhold | null {
  const raa = x as Record<string, unknown>;
  const lokaler: Lokale[] = [];
  for (const l of Array.isArray(raa['lokaler']) ? raa['lokaler'] : []) {
    const lok = laesLokale(l);
    if (!lok) return null;
    lokaler.push(lok);
  }
  const klasser: Klasse[] = [];
  for (const k of Array.isArray(raa['klasser']) ? raa['klasser'] : []) {
    const r = laesKlasse(k, lokaler);
    if (!r) return null;
    klasser.push(r);
  }
  return { klasser, lokaler };
}

function laesKlasse(x: unknown, lokaler: Lokale[]): Klasse | null {
  if (!erObjekt(x) || !tekst(x['id']) || !tekst(x['navn'], MAKS_NAVN) || !Array.isArray(x['elever'])) return null;
  const elever: Elev[] = [];
  for (const e of x['elever']) {
    if (!erObjekt(e) || !tekst(e['id']) || !tekst(e['navn'], MAKS_NAVN)) return null;
    const koen = e['koen'] === 'P' || e['koen'] === 'D' ? e['koen'] : null;
    const hold = typeof e['hold'] === 'string' ? normaliserHold(e['hold']) : undefined;
    elever.push({ id: e['id'], navn: e['navn'], koen, ...(hold ? { hold } : {}) });
  }
  const ider = new Set(elever.map((e) => e.id));
  const holdAdskilt: [string, string][] = [];
  for (const p of Array.isArray(x['holdAdskilt']) ? x['holdAdskilt'] : []) {
    if (Array.isArray(p) && p.length === 2 && ider.has(p[0]) && ider.has(p[1]) && p[0] !== p[1]) holdAdskilt.push([p[0], p[1]]);
  }
  // Version 1: lokalet lå i klassen. Det bliver til et selvstændigt lokale.
  let lokaleId: string | null = null;
  if (x['lokale'] != null) {
    const lok = laesLokale(x['lokale']);
    if (!lok) return null;
    lok.id = nyId();
    lokaler.push(lok);
    lokaleId = lok.id;
  } else if (typeof x['lokaleId'] === 'string' && lokaler.some((l) => l.id === x['lokaleId'])) {
    lokaleId = x['lokaleId'];
  }
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
    lokaleId,
    planer,
    kladde,
  };
}

function laesLokale(x: unknown): Lokale | null {
  if (!erObjekt(x) || !Array.isArray(x['borde']) || x['borde'].length > 80) return null;
  // Version 1: borde i et gitter.
  if (x['borde'].some((b) => erObjekt(b) && 'raekke' in b)) {
    const v1: LokaleV1 = { borde: [], forresteRaekker: heltal(x['forresteRaekker'], 1, 60) ? x['forresteRaekker'] : 1 };
    for (const b of x['borde']) {
      if (!erObjekt(b) || !tekst(b['id']) || !heltal(b['raekke'], 0, 60) || !heltal(b['kolonne'], 0, 60) || !heltal(b['pladser'], 1, 16)) return null;
      v1.borde.push({ id: b['id'], raekke: b['raekke'], kolonne: b['kolonne'], pladser: b['pladser'] });
    }
    return fraV1(v1);
  }
  const borde: Bord[] = [];
  for (const b of x['borde']) {
    if (!erObjekt(b) || !tekst(b['id']) || !tal(b['x'], 0, 500) || !tal(b['y'], 0, 500) || !heltal(b['pladser'], 1, 16)) return null;
    const bord: Bord = { id: b['id'], x: b['x'], y: b['y'], pladser: b['pladser'], lodret: b['lodret'] === true };
    if (typeof b['forrest'] === 'boolean') bord.forrest = b['forrest'];
    borde.push(bord);
  }
  const t = erObjekt(x['tavle']) ? x['tavle'] : {};
  const m = erObjekt(x['mobilskab']) ? x['mobilskab'] : null;
  return {
    id: tekst(x['id']) ? x['id'] : nyId(),
    navn: typeof x['navn'] === 'string' ? x['navn'].slice(0, 20) : '',
    bredde: tal(x['bredde'], 1, 600) ? x['bredde'] : 20,
    hoejde: tal(x['hoejde'], 1, 600) ? x['hoejde'] : 12,
    borde,
    tavle: {
      vaeg: VAEGGE.includes(t['vaeg'] as Vaeg) ? (t['vaeg'] as Vaeg) : 'top',
      midte: tal(t['midte'], 0, 600) ? t['midte'] : 5,
      laengde: tal(t['laengde'], 1, 60) ? t['laengde'] : 6,
    },
    mobilskab: m && tal(m['x'], 0, 600) && tal(m['y'], 0, 600) ? { x: m['x'], y: m['y'] } : null,
  };
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
    .filter((l): l is Record<string, unknown> => erObjekt(l) && tekst(l['elevId']) && tekst(l['bordId']) && heltal(l['plads'], 0, 16))
    .map((l) => ({ elevId: l['elevId'] as string, bordId: l['bordId'] as string, plads: l['plads'] as number }));
}
