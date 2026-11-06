// Forbindelse over en Firebase Realtime Database i EU (Belgien), så elevernes
// egne computere kan være med. Der bruges kun databasens almindelige
// web-adresser (REST og en strøm af ændringer), ingen bibliotek og ingen login.
//
// Hvad der gemmes: rum/<kode>/kort (lokalets borde og hvilke pladser der er
// optaget) og rum/<kode>/beskeder (tilmeldinger og resultater: plads, figur,
// point). Aldrig navne. Databasens regler tillader kun disse to steder og
// kun beskeder i det rigtige format; alt andet er lukket.

import { type Forbindelse } from './forbindelse';
import { type Besked, laesBesked } from './protokol';

export const DATABASE = 'https://spillepladen-984b5-default-rtdb.europe-west1.firebasedatabase.app';

/** Læser én hændelse fra databasens strøm. Giver beskederne i rækkefølge, med deres nøgle. */
export function laesHaendelse(type: string, raa: string): { noegle: string; tekst: string }[] {
  if (type !== 'put' && type !== 'patch') return [];
  let d: unknown;
  try {
    d = JSON.parse(raa);
  } catch {
    return [];
  }
  if (typeof d !== 'object' || d === null) return [];
  const { path, data } = d as { path?: unknown; data?: unknown };
  if (typeof path !== 'string') return [];
  if (path === '/') {
    if (typeof data !== 'object' || data === null) return [];
    return Object.entries(data as Record<string, unknown>)
      .filter((e): e is [string, string] => typeof e[1] === 'string')
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .map(([noegle, tekst]) => ({ noegle, tekst }));
  }
  const noegle = path.replace(/^\//, '');
  return typeof data === 'string' && !noegle.includes('/') ? [{ noegle, tekst: data }] : [];
}

/** Læser kortet fra en hændelse på rum/<kode>/kort. */
export function laesKortHaendelse(type: string, raa: string): Besked | null {
  if (type !== 'put') return null;
  try {
    const d = JSON.parse(raa) as { path?: string; data?: { json?: unknown } | null };
    if (d.path !== '/' || !d.data || typeof d.data.json !== 'string') return null;
    const b = laesBesked(JSON.parse(d.data.json));
    return b?.t === 'kort' ? b : null;
  } catch {
    return null;
  }
}

interface Valg {
  /** Kun for tavlen: beskeder med denne nøgle eller ældre er allerede behandlet (fx før en genindlæsning). */
  senest?: string | null;
  vedNoegle?: (noegle: string) => void;
}

export function serverForbindelse(kode: string, rolle: 'tavle' | 'elev', valg: Valg = {}): Forbindelse {
  const rum = `${DATABASE}/rum/${kode}`;
  const lyttere = new Set<(b: Besked) => void>();
  const giv = (b: Besked) => {
    for (const fn of lyttere) fn(b);
  };
  let senest = valg.senest ?? '';

  const kilde = new EventSource(rolle === 'tavle' ? `${rum}/beskeder.json` : `${rum}/kort.json`);
  const ved = (type: string) => (e: MessageEvent) => {
    if (rolle === 'elev') {
      const b = laesKortHaendelse(type, e.data as string);
      if (b) giv(b);
      return;
    }
    for (const { noegle, tekst } of laesHaendelse(type, e.data as string)) {
      if (noegle <= senest) continue;
      senest = noegle;
      valg.vedNoegle?.(noegle);
      try {
        const b = laesBesked(JSON.parse(tekst));
        if (b && b.t !== 'kort') giv(b);
      } catch {
        // Ugyldig besked: ignoreres.
      }
    }
  };
  kilde.addEventListener('put', ved('put'));
  kilde.addEventListener('patch', ved('patch'));

  return {
    art: 'server',
    send(b) {
      if (b.t === 'hvem') return; // Eleverne læser kortet direkte.
      const krop = b.t === 'kort' ? { url: `${rum}/kort.json`, metode: 'PUT', data: { json: JSON.stringify(b), tid: { '.sv': 'timestamp' } } } : { url: `${rum}/beskeder.json`, metode: 'POST', data: JSON.stringify(b) };
      fetch(krop.url, { method: krop.metode, body: JSON.stringify(krop.data), referrerPolicy: 'no-referrer' }).catch(() => undefined);
    },
    paaBesked(fn) {
      lyttere.add(fn);
      return () => lyttere.delete(fn);
    },
    luk: () => kilde.close(),
  };
}

/** Lokal afprøvning uden server: tilføj ?lokal til adressen. */
export function brugLokal(): boolean {
  return new URLSearchParams(location.search).has('lokal') || typeof EventSource === 'undefined';
}
