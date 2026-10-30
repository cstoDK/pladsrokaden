// Sammenligning af klassen med en klasseliste (fx fra Ludus): hvem findes
// begge steder, hvem er kun på listen, og hvem er kun i klassen. Bruges til
// at sætte GF-hold og køn og til at finde forskelle, uden at noget gemmes,
// før læreren beslutter det.

import { type UdtrukketElev, navngivDubletter } from './import';
import { type Elev, type ElevId, type Koen } from './model';

export interface Match {
  elevId: ElevId;
  navn: string;
  hold?: string;
  koen: Koen;
}

export interface Sammenligning {
  /** Elever, der findes både i klassen og på listen. */
  begge: Match[];
  /** Elever på listen, som ikke findes i klassen. */
  kunPaaListen: { navn: string; hold?: string; koen: Koen }[];
  /** Elever i klassen, som ikke står på listen. */
  kunIKlassen: ElevId[];
}

const noegle = (n: string) => n.replace(/\s+/g, ' ').trim().toLocaleLowerCase('da');
const fornavn = (n: string) => noegle(n).split(' ')[0] ?? '';

export function sammenlign(elever: Elev[], liste: UdtrukketElev[]): Sammenligning {
  const navne = navngivDubletter(liste).map((n) => n.navn);
  const fri = new Set(elever.map((e) => e.id));
  const begge: Match[] = [];
  const kunPaaListen: Sammenligning['kunPaaListen'] = [];
  const rest: number[] = [];

  // 1) Samme navn (inkl. forbogstav, fx "Ida H.").
  navne.forEach((navn, i) => {
    const e = elever.find((x) => fri.has(x.id) && noegle(x.navn) === noegle(navn));
    if (e) {
      fri.delete(e.id);
      begge.push({ elevId: e.id, navn: e.navn, hold: liste[i]!.hold, koen: liste[i]!.koen });
    } else rest.push(i);
  });
  // 2) Samme fornavn, når det er entydigt begge steder (fx "Ida" og "Ida H.").
  for (const i of rest) {
    const f = fornavn(navne[i]!);
    const iKlassen = elever.filter((x) => fri.has(x.id) && fornavn(x.navn) === f);
    const paaListen = rest.filter((j) => fornavn(navne[j]!) === f);
    if (iKlassen.length === 1 && paaListen.length === 1) {
      fri.delete(iKlassen[0]!.id);
      begge.push({ elevId: iKlassen[0]!.id, navn: iKlassen[0]!.navn, hold: liste[i]!.hold, koen: liste[i]!.koen });
    } else kunPaaListen.push({ navn: navne[i]!, hold: liste[i]!.hold, koen: liste[i]!.koen });
  }
  return { begge, kunPaaListen, kunIKlassen: elever.filter((e) => fri.has(e.id)).map((e) => e.id) };
}
