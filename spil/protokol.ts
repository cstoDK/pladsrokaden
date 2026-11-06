// Beskederne mellem spillepladen (lærerens computer) og elevernes spil.
//
// Databeskyttelse: ingen besked indeholder navne. Spillepladen sender et kort
// over lokalet (borde, tavle, hvilke pladser der er optaget), og eleverne
// sender en plads ("bordId#plads"), en figur og point. Navnet slås først op
// på lærerens egen computer, når det skal vises på tavlen.
//
// Alt, der modtages, er utroværdigt: det læses strengt, og ukendte felter
// smides væk.

import { type Lokale } from '../core/model';
import { findFigur } from './figurer';

/** "bordId#plads", fx "b3#1". */
export type PladsNoegle = string;

export function pladsNoegle(bordId: string, plads: number): PladsNoegle {
  return `${bordId}#${plads}`;
}

/** Lokalet uden noget om eleverne: kun borde, tavle og mobilskab. */
export type Kort = Pick<Lokale, 'navn' | 'bredde' | 'hoejde' | 'borde' | 'tavle' | 'mobilskab'>;

export type Besked =
  /** Spillepladen → elever: kortet og de pladser, der kan vælges. */
  | { t: 'kort'; kort: Kort; optagne: PladsNoegle[]; taget: PladsNoegle[] }
  /** Elev → spillepladen: send kortet (fx når en elev lige har åbnet spillet). */
  | { t: 'hvem' }
  /** Elev → spillepladen: her sidder jeg, og det er min figur. */
  | { t: 'tilmeld'; enhed: string; plads: PladsNoegle; figur: string }
  /** Elev → spillepladen: et resultat fra et spil. */
  | { t: 'resultat'; id: string; enhed: string; plads: PladsNoegle; spil: string; point: number; maks: number };

const KORT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const PLADS = /^[A-Za-z0-9_-]{1,64}#\d{1,3}$/;
const TEKST = /^[\p{L}\p{N} _.,:'-]{1,40}$/u;

function erObjekt(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}
const tal = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;

/** Læser en modtaget besked strengt. Ugyldige beskeder giver null. */
export function laesBesked(raa: unknown): Besked | null {
  if (!erObjekt(raa)) return null;
  switch (raa['t']) {
    case 'hvem':
      return { t: 'hvem' };
    case 'tilmeld': {
      const { enhed, plads, figur } = raa;
      if (typeof enhed !== 'string' || !KORT_ID.test(enhed)) return null;
      if (typeof plads !== 'string' || !PLADS.test(plads)) return null;
      if (typeof figur !== 'string' || !findFigur(figur)) return null;
      return { t: 'tilmeld', enhed, plads, figur };
    }
    case 'resultat': {
      const { id, enhed, plads, spil, point, maks } = raa;
      if (typeof id !== 'string' || !KORT_ID.test(id)) return null;
      if (typeof enhed !== 'string' || !KORT_ID.test(enhed)) return null;
      if (typeof plads !== 'string' || !PLADS.test(plads)) return null;
      if (typeof spil !== 'string' || !TEKST.test(spil)) return null;
      if (!tal(maks, 1, 1e6) || !tal(point, -1e6, 1e6)) return null;
      return { t: 'resultat', id, enhed, plads, spil, point, maks };
    }
    case 'kort': {
      const kort = laesKort(raa['kort']);
      const optagne = laesPladser(raa['optagne']);
      const taget = laesPladser(raa['taget']);
      if (!kort || !optagne || !taget) return null;
      return { t: 'kort', kort, optagne, taget };
    }
    default:
      return null;
  }
}

function laesPladser(x: unknown): PladsNoegle[] | null {
  if (!Array.isArray(x) || x.length > 200) return null;
  return x.every((p) => typeof p === 'string' && PLADS.test(p)) ? (x as string[]) : null;
}

function laesKort(x: unknown): Kort | null {
  if (!erObjekt(x)) return null;
  const { navn, bredde, hoejde, borde, tavle, mobilskab } = x;
  if (typeof navn !== 'string' || navn.length > 40 || !tal(bredde, 1, 100) || !tal(hoejde, 1, 100)) return null;
  if (!Array.isArray(borde) || borde.length > 80) return null;
  const ud: Kort['borde'] = [];
  for (const b of borde) {
    if (!erObjekt(b) || typeof b['id'] !== 'string' || !KORT_ID.test(b['id'])) return null;
    if (!tal(b['x'], -1, 100) || !tal(b['y'], -1, 100) || !tal(b['pladser'], 1, 40) || typeof b['lodret'] !== 'boolean') return null;
    ud.push({ id: b['id'], x: b['x'], y: b['y'], pladser: Math.round(b['pladser']), lodret: b['lodret'], ...(typeof b['forrest'] === 'boolean' ? { forrest: b['forrest'] } : {}) });
  }
  if (!erObjekt(tavle) || !['top', 'bund', 'venstre', 'hoejre'].includes(tavle['vaeg'] as string) || !tal(tavle['midte'], -1, 100) || !tal(tavle['laengde'], 0, 100)) return null;
  let skab: Kort['mobilskab'] = null;
  if (mobilskab !== null && mobilskab !== undefined) {
    if (!erObjekt(mobilskab) || !tal(mobilskab['x'], -1, 100) || !tal(mobilskab['y'], -1, 100)) return null;
    skab = { x: mobilskab['x'], y: mobilskab['y'], ...(mobilskab['lodret'] === true ? { lodret: true } : {}) };
  }
  return { navn, bredde, hoejde, borde: ud, tavle: { vaeg: tavle['vaeg'] as Lokale['tavle']['vaeg'], midte: tavle['midte'], laengde: tavle['laengde'] }, mobilskab: skab };
}

/** Kortet til eleverne: lokalet uden id og uden noget om eleverne. */
export function lavKort(l: Lokale): Kort {
  return {
    navn: l.navn,
    bredde: l.bredde,
    hoejde: l.hoejde,
    borde: l.borde.map((b) => ({ id: b.id, x: b.x, y: b.y, pladser: b.pladser, lodret: b.lodret, ...(b.forrest !== undefined ? { forrest: b.forrest } : {}) })),
    tavle: { ...l.tavle },
    mobilskab: l.mobilskab ? { ...l.mobilskab } : null,
  };
}

/** Et kort, der kan gives til Lokaletegning (som forventer et helt lokale). */
export function kortSomLokale(k: Kort): Lokale {
  return { id: 'kort', ...k };
}
