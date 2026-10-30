// Forklaring af en bordplan i almindeligt sprog: korte statusmærker for
// hele planen og de problemer ved hvert bord, der ikke kunne undgås.

import { aleneVedBord, bygHistorik, koenOpslag, parNoegle } from './historik';
import { type BordId, type Elev, type ElevId, type Lokale, type Placering, type Plan, elevIderVedBord, forresteBorde } from './model';
import { planGrupper } from './struktur';

export type Niveau = 'ok' | 'bemaerk' | 'fejl';

export interface Statusmaerke {
  niveau: Niveau;
  tekst: string;
}

export interface BordProblem {
  niveau: Exclude<Niveau, 'ok'>;
  tekst: string;
  elevIder: ElevId[];
}

export interface Forklaring {
  status: Statusmaerke[];
  borde: Record<BordId, BordProblem[]>;
}

export interface ForklaringsInput {
  elever: Elev[];
  lokale: Lokale;
  placering: Placering;
  tidligere: Plan[];
  holdAdskilt: [ElevId, ElevId][];
}

export function forklar(input: ForklaringsInput): Forklaring {
  const { elever, lokale, placering, tidligere } = input;
  const navne = new Map(elever.map((e) => [e.id, e.navn]));
  const n = (id: ElevId) => navne.get(id) ?? 'Ukendt';
  const og = (ider: ElevId[]) => ider.map(n).join(' og ');
  const koenAf = koenOpslag(elever);
  const h = bygHistorik(elever, tidligere);
  const harHistorik = tidligere.length > 0;
  const adskilt = new Set(input.holdAdskilt.map(([a, b]) => parNoegle(a, b)));
  const forrest = forresteBorde(lokale);
  const grupper = planGrupper(lokale, placering);

  const borde: Record<BordId, BordProblem[]> = {};
  for (const b of lokale.borde) borde[b.id] = [];
  let makkerIgen = 0;
  let makkerFoer = 0;
  let gruppeIgen = 0;
  let ikkeBlandet = 0;
  let kanBlandes = 0;
  let forrestIgen = 0;
  let alene = 0;
  let aleneIgen = 0;
  let adskiltBrudt = 0;
  let ensomme = 0;

  for (const g of grupper) {
    const liste = borde[g.bordId]!;
    for (const par of g.par) {
      const k = par.map(koenAf);
      if (par.length >= 2 && k.every(Boolean)) {
        kanBlandes++;
        if (k.every((x) => x === k[0])) {
          ikkeBlandet++;
          liste.push({ niveau: 'bemaerk', tekst: `${og(par)} er ${par.length === 2 ? 'to' : 'tre'} ${k[0] === 'P' ? 'piger' : 'drenge'}`, elevIder: par });
        }
      }
      for (let a = 0; a < par.length; a++) {
        for (let b = a + 1; b < par.length; b++) {
          const nk = parNoegle(par[a]!, par[b]!);
          if (h.makker.sidst.has(nk)) {
            makkerIgen++;
            liste.push({ niveau: 'bemaerk', tekst: `${og([par[a]!, par[b]!])} var også makkere sidst`, elevIder: [par[a]!, par[b]!] });
          } else if (h.makker.antal.has(nk)) {
            makkerFoer++;
            liste.push({ niveau: 'bemaerk', tekst: `${og([par[a]!, par[b]!])} har været makkere før`, elevIder: [par[a]!, par[b]!] });
          }
        }
      }
    }
    const alle = g.par.flat();
    for (let a = 0; a < alle.length; a++) {
      for (let b = a + 1; b < alle.length; b++) if (h.gruppe.sidst.has(parNoegle(alle[a]!, alle[b]!))) gruppeIgen++;
    }
    for (const id of aleneVedBord(alle, koenAf)) {
      alene++;
      const ord = koenAf(id) === 'P' ? 'pige' : 'dreng';
      const igen = h.aleneSidst.has(id);
      if (igen) aleneIgen++;
      liste.push({ niveau: 'bemaerk', tekst: `${n(id)} er eneste ${ord} i gruppe ${g.nr}${igen ? ' igen' : ''}`, elevIder: [id] });
    }
  }

  for (const bord of lokale.borde) {
    const ider = elevIderVedBord(placering, bord.id);
    const liste = borde[bord.id]!;
    if (ider.length === 1) {
      ensomme++;
      liste.unshift({ niveau: 'fejl', tekst: `${n(ider[0]!)} sidder alene ved bordet`, elevIder: ider });
    }
    for (let a = 0; a < ider.length; a++) {
      for (let b = a + 1; b < ider.length; b++) {
        if (adskilt.has(parNoegle(ider[a]!, ider[b]!))) {
          adskiltBrudt++;
          liste.unshift({ niveau: 'fejl', tekst: `${og([ider[a]!, ider[b]!])} skal holdes adskilt`, elevIder: [ider[a]!, ider[b]!] });
        }
      }
    }
    if (forrest.has(bord.id)) {
      for (const id of ider) {
        if (h.forrestSidst.has(id)) {
          forrestIgen++;
          liste.push({ niveau: 'bemaerk', tekst: `${n(id)} er forrest igen`, elevIder: [id] });
        }
      }
    }
  }

  const status: Statusmaerke[] = [];
  if (ensomme > 0) {
    status.push({ niveau: 'fejl', tekst: `${ensomme} ${ensomme === 1 ? 'elev sidder' : 'elever sidder'} alene ved et bord` });
  }
  if (harHistorik) {
    if (makkerIgen === 0 && makkerFoer === 0) status.push({ niveau: 'ok', tekst: 'Alle har en ny makker' });
    else if (makkerIgen === 0) status.push({ niveau: 'ok', tekst: 'Ingen har samme makker som sidst' });
    else status.push({ niveau: 'bemaerk', tekst: `${antal(makkerIgen, 'makkerpar', 'makkerpar')} er det samme som sidst` });
    status.push(
      gruppeIgen === 0
        ? { niveau: 'ok', tekst: 'Ingen er i netværksgruppe med en fra sidste gruppe' }
        : { niveau: 'bemaerk', tekst: `${antal(gruppeIgen, 'par af elever', 'par af elever')} var også i samme netværksgruppe sidst` },
    );
  }
  if (kanBlandes > 0) {
    status.push(
      ikkeBlandet === 0
        ? { niveau: 'ok', tekst: 'Alle makkerpar er blandede (pige og dreng)' }
        : { niveau: 'bemaerk', tekst: `${antal(ikkeBlandet, 'makkerpar', 'makkerpar')} er ikke blandet` },
    );
  }
  if (harHistorik && forrest.size > 0) {
    status.push(forrestIgen === 0 ? { niveau: 'ok', tekst: 'Ingen er forrest to gange i træk' } : { niveau: 'bemaerk', tekst: `${forrestIgen} er forrest igen` });
  }
  if (alene > 0) {
    if (aleneIgen > 0) status.push({ niveau: 'bemaerk', tekst: `${aleneIgen} er eneste af sit køn i gruppen igen` });
    else status.push({ niveau: 'bemaerk', tekst: `${alene} er eneste af sit køn i gruppen${harHistorik ? ', men ingen to gange i træk' : ''}` });
  }
  const udenKoen = elever.filter((e) => e.koen === null).length;
  if (udenKoen > 0) {
    status.push({ niveau: 'bemaerk', tekst: `${antal(udenKoen, 'elev', 'elever')} mangler køn og tæller ikke med i kønsfordelingen` });
  }
  if (input.holdAdskilt.length > 0) {
    status.push(
      adskiltBrudt === 0
        ? { niveau: 'ok', tekst: 'Alle, der skal holdes adskilt, sidder ved hver sit bord' }
        : { niveau: 'fejl', tekst: `${antal(adskiltBrudt, 'par', 'par')}, der skal holdes adskilt, sidder ved samme bord` },
    );
  }
  return { status, borde };
}

function antal(x: number, ental: string, flertal: string): string {
  return `${x} ${x === 1 ? ental : flertal}`;
}
