// Forklaring af en bordplan i almindeligt sprog: korte statusmærker for
// hele planen og de problemer ved hvert bord, der ikke kunne undgås.

import { aleneVedBord, bygHistorik, koenOpslag, parNoegle } from './historik';
import { type BordId, type Elev, type ElevId, type Lokale, type Placering, type Plan, elevIderVedBord, erForrest } from './model';

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
  const navn = new Map(elever.map((e) => [e.id, e.navn]));
  const n = (id: ElevId) => navn.get(id) ?? 'Ukendt';
  const koenAf = koenOpslag(elever);
  const h = bygHistorik(elever, tidligere);
  const harHistorik = tidligere.length > 0;
  const adskilt = new Set(input.holdAdskilt.map(([a, b]) => parNoegle(a, b)));
  const kunPar = lokale.borde.every((b) => b.pladser <= 2);

  const borde: Record<BordId, BordProblem[]> = {};
  let parIgen = 0;
  let parFoer = 0;
  let forrestIgen = 0;
  let alene = 0;
  let aleneIgen = 0;
  let adskiltBrudt = 0;
  let harStoreBorde = false;
  let harForreste = false;

  for (const bord of lokale.borde) {
    const ider = elevIderVedBord(placering, bord.id);
    const problemer: BordProblem[] = [];
    if (ider.length >= 3) harStoreBorde = true;

    for (let a = 0; a < ider.length; a++) {
      for (let b = a + 1; b < ider.length; b++) {
        const x = ider[a]!;
        const y = ider[b]!;
        const k = parNoegle(x, y);
        const par = `${n(x)} og ${n(y)}`;
        if (adskilt.has(k)) {
          adskiltBrudt++;
          problemer.push({ niveau: 'fejl', tekst: `${par} skal holdes adskilt`, elevIder: [x, y] });
        }
        if (h.parSidst.has(k)) {
          parIgen++;
          problemer.push({ niveau: 'bemaerk', tekst: `${par} sad også sammen sidst`, elevIder: [x, y] });
        } else if (h.parAntal.has(k)) {
          parFoer++;
          const gange = h.parAntal.get(k)!;
          if (gange >= 2) {
            problemer.push({ niveau: 'bemaerk', tekst: `${par} har siddet sammen ${gange} gange før`, elevIder: [x, y] });
          }
        }
      }
    }

    if (erForrest(bord, lokale)) {
      harForreste = true;
      for (const id of ider) {
        if (h.forrestSidst.has(id)) {
          forrestIgen++;
          problemer.push({ niveau: 'bemaerk', tekst: `${n(id)} er forrest igen`, elevIder: [id] });
        }
      }
    }

    for (const id of aleneVedBord(ider, koenAf)) {
      alene++;
      const ord = koenAf(id) === 'P' ? 'pige' : 'dreng';
      if (h.aleneSidst.has(id)) {
        aleneIgen++;
        problemer.push({ niveau: 'bemaerk', tekst: `${n(id)} er eneste ${ord} ved bordet igen`, elevIder: [id] });
      } else {
        problemer.push({ niveau: 'bemaerk', tekst: `${n(id)} er eneste ${ord} ved bordet`, elevIder: [id] });
      }
    }

    borde[bord.id] = problemer;
  }

  const status: Statusmaerke[] = [];
  const makker = kunPar ? 'makker' : 'bordmakker';

  if (harHistorik) {
    if (parIgen === 0 && parFoer === 0) {
      status.push({ niveau: 'ok', tekst: `Alle sidder med nye ${makker}e` });
    } else if (parIgen === 0) {
      status.push({ niveau: 'ok', tekst: `Ingen sidder med samme ${makker} som sidst` });
    } else {
      status.push({ niveau: 'bemaerk', tekst: `${antal(parIgen, 'par', 'par')} sad også sammen sidst` });
    }
  }

  if (harHistorik && harForreste) {
    status.push(
      forrestIgen === 0
        ? { niveau: 'ok', tekst: 'Ingen er forrest to gange i træk' }
        : { niveau: 'bemaerk', tekst: `${forrestIgen} er forrest igen` },
    );
  }

  if (harStoreBorde) {
    if (alene === 0) status.push({ niveau: 'ok', tekst: 'Ingen er eneste af sit køn ved et bord' });
    else if (aleneIgen > 0) status.push({ niveau: 'bemaerk', tekst: `${aleneIgen} er eneste af sit køn ved bordet igen` });
    else if (harHistorik) status.push({ niveau: 'bemaerk', tekst: `${alene} er eneste af sit køn ved bordet, men ingen to gange i træk` });
    else status.push({ niveau: 'bemaerk', tekst: `${alene} er eneste af sit køn ved bordet` });
  }

  const udenKoen = elever.filter((e) => e.koen === null).length;
  if (udenKoen > 0) {
    status.push({
      niveau: 'bemaerk',
      tekst: `${antal(udenKoen, 'elev', 'elever')} mangler køn og tæller ikke med i kønsfordelingen`,
    });
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
