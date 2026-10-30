// Udtræk af fornavne fra rodet indsat tekst (Ludus, Lectio, regneark,
// tekstgenkendelse) og fra "én pr. linje".
//
// Dataminimering: kun fornavn, køn og højst to bogstaver af efternavnet
// (til at skelne dubletter) forlader dette modul. Alt andet kasseres her.

import { type Koen } from './model';

export interface UdtrukketElev {
  fornavn: string;
  /** Højst to bogstaver af efternavnet. Bruges kun til dubletter og gemmes aldrig. */
  efternavnStart?: string;
  koen: Koen;
  /** Grundforløbshold, fx "GF02". */
  hold?: string;
}

export interface Udtraek {
  elever: UdtrukketElev[];
  /** Antal ikke-tomme linjer, der ikke blev til et navn. */
  sprungetOver: number;
}

// Ord, der optræder i menuer, overskrifter og statuskolonner, men aldrig som navne.
const STOPORD = new Set(
  [
    'forside', 'skema', 'opgaver', 'opgave', 'beskeder', 'besked', 'elever', 'elev', 'elevliste', 'lærere', 'lærer',
    'hold', 'holdet', 'fravær', 'karakterer', 'karakter', 'dokumenter', 'lektier', 'studieplan', 'spørgeskema',
    'hjælp', 'print', 'udskriv', 'udskrevet', 'vis', 'søg', 'kursister', 'kursist', 'hjem', 'indstillinger',
    'aktiviteter', 'aktivitet', 'moduler', 'modul', 'profil', 'kalender', 'bøger', 'grupper', 'gruppe', 'klasse',
    'klassen', 'klasser', 'navn', 'navne', 'fornavn', 'efternavn', 'fornavne', 'efternavne', 'billede', 'foto',
    'status', 'aktiv', 'inaktiv', 'udmeldt', 'afmeldt', 'ja', 'nej', 'mail', 'e-mail', 'email', 'telefon', 'mobil',
    'adresse', 'postnr', 'by', 'fødselsdato', 'født', 'alder', 'køn', 'nr', 'nummer', 'elevnummer', 'kursistnr',
    'studieretning', 'retning', 'årgang', 'side', 'af', 'log', 'ud', 'antal', 'i', 'alt', 'total', 'oversigt',
    'lectio', 'ludus', 'web', 'hhx', 'htx', 'stx', 'hf', 'eux', 'eud', 'ib', 'gymnasium', 'handelsgymnasium',
    'college', 'business', 'kontaktlærer', 'teamleder', 'mentor', 'studievejleder', 'tilmeldt', 'startdato',
    'slutdato', 'dato', 'uddannelse', 'skole', 'afdeling', 'periode', 'kommentar', 'note', 'noter', 'valgt',
    'kvinde', 'mand', 'pige', 'dreng', 'kvinder', 'mænd', 'piger', 'drenge', 'first', 'last', 'name', 'gender',
    'sprog', 'fremmedsprog', 'valgfag', 'fag', 'niveau', 'spansk', 'kinesisk', 'tysk', 'fransk', 'engelsk', 'italiensk',
    'arabisk', 'japansk', 'latin', 'russisk', 'dansk', 'matematik', 'samfundsfag', 'afsætning', 'virksomhedsøkonomi',
    'erhvervsøkonomi', 'informatik', 'grundforløb', 'grundforløbshold', 'gf-klasse', 'kursistnr', 'cpr',
  ],
);

// Fag og sprog, der kan stå sidst i en linje (fx "Ida Hansen K Spansk").
const FAGORD = new Set([
  'spansk', 'kinesisk', 'tysk', 'fransk', 'engelsk', 'italiensk', 'arabisk', 'japansk', 'latin', 'russisk', 'dansk',
  'matematik', 'samfundsfag', 'afsætning', 'virksomhedsøkonomi', 'erhvervsøkonomi', 'informatik',
]);

// Statusord, der betyder, at rækken ikke er en aktiv elev.
const UDMELDT = new Set(['udmeldt', 'afmeldt', 'inaktiv', 'udskrevet']);

// Små ord, der kan stå inde i et navn ("Sara al Hassan", "Emil af Rosen").
const PARTIKLER = new Set(['van', 'von', 'de', 'da', 'del', 'der', 'la', 'le', 'el', 'al', 'af', 'bin', 'ibn', 'ben', 'di', 'du', 'ter', 'ten', 'zu', 'y']);

const KOEN_ORD: Record<string, 'P' | 'D'> = {
  p: 'P', k: 'P', f: 'P', pige: 'P', kvinde: 'P', kvindelig: 'P', female: 'P',
  d: 'D', m: 'D', dreng: 'D', mand: 'D', mandlig: 'D', male: 'D',
};

const NAVNEORD = /^\p{Lu}[\p{L}\p{M}'’.-]*$/u;
const FORBOGSTAV_ORD = /^\p{L}{1,2}\.$/u;

/**
 * Dataminimering: kun det første fornavn (evt. med forbogstav i efternavnet,
 * "Ida H."). Mellemnavne og efternavne fjernes. "Anne-Sofie" er ét navn.
 */
export function kunFornavn(navn: string): string {
  const ord = navn.trim().split(/\s+/).filter(Boolean);
  if (ord.length <= 1) return ord[0] ?? '';
  if (ord.length === 2 && FORBOGSTAV_ORD.test(ord[1]!)) return `${ord[0]} ${ord[1]}`;
  return ord[0]!;
}
/**
 * Grundforløbshold i kort form: "1.GF02-DIG", "GF 2" og "gf02" bliver alle
 * til "GF02". Andet end et GF-nummer kasseres (kun det, der skal bruges).
 */
export function normaliserHold(tekst: string): string | undefined {
  const m = tekst.match(/G\s*F\s*-?\s*0*(\d{1,2})(?!\d)/i);
  return m ? `GF${m[1]!.padStart(2, '0')}` : undefined;
}

const HEADER: Record<string, 'fornavn' | 'efternavn' | 'navn' | 'koen' | 'hold'> = {
  'gf-klasse': 'hold', 'gf klasse': 'hold', 'gf-hold': 'hold', 'gf hold': 'hold', gf: 'hold', grundforløb: 'hold', grundforløbshold: 'hold',
  fornavn: 'fornavn', fornavne: 'fornavn', 'first name': 'fornavn', kaldenavn: 'fornavn',
  efternavn: 'efternavn', efternavne: 'efternavn', 'last name': 'efternavn',
  navn: 'navn', elev: 'navn', elevnavn: 'navn', kursist: 'navn', kursistnavn: 'navn', 'fulde navn': 'navn', name: 'navn', elever: 'navn',
  køn: 'koen', kon: 'koen', gender: 'koen',
};

/** Udtrækker elever fra indsat tekst i alle de formater, vi kan genkende. */
export function udtraekFraTekst(tekst: string): Udtraek {
  const linjer = normaliser(tekst)
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '');
  if (linjer.length === 0) return { elever: [], sprungetOver: 0 };

  const medTab = linjer.filter((l) => l.includes('\t')).length;
  const medMellemrum = linjer.filter((l) => /\S {2,}\S/.test(l)).length;
  let opdel: ((l: string) => string[]) | null = null;
  if (medTab >= 2 && medTab >= linjer.length * 0.3) opdel = (l) => l.split('\t').map((c) => c.trim());
  else if (medMellemrum >= 2 && medMellemrum >= linjer.length * 0.5) opdel = (l) => l.trim().split(/\s{2,}/);

  const elever: UdtrukketElev[] = [];
  let sprungetOver = 0;

  if (opdel) {
    const raekker = linjer.map((l) => (l.includes('\t') || /\S {2,}\S/.test(l) ? opdel!(l) : [l.trim()]));
    const kolonner = findKolonner(raekker);
    raekker.forEach((celler, i) => {
      if (i === kolonner.headerRaekke) {
        sprungetOver++;
        return;
      }
      const e = celler.length > 1 ? fraRaekke(celler, kolonner) : fraFritekst(celler[0] ?? '');
      if (e) elever.push(e);
      else sprungetOver++;
    });
  } else {
    for (const l of linjer) {
      const e = fraFritekst(l);
      if (e) elever.push(e);
      else sprungetOver++;
    }
  }
  return { elever: elever.map(sikr), sprungetOver };
}

function sikr(e: UdtrukketElev): UdtrukketElev {
  return { ...e, fornavn: kunFornavn(e.fornavn) };
}

/**
 * "Én pr. linje": et navn pr. linje med valgfrit P eller D bagefter ("Ida P").
 * Skrives et fuldt navn, beholdes kun fornavnet.
 */
export function udtraekFraLinjer(tekst: string): Udtraek {
  const elever: UdtrukketElev[] = [];
  let sprungetOver = 0;
  for (const raa of normaliser(tekst).split('\n')) {
    let l = raa.trim().replace(/^(\d+[.)]?|[-*•·])\s+/, '');
    if (!l) continue;
    // GF-hold kan stå på linjen: "Ida P GF02" eller "Ida GF2 P".
    const hold = normaliserHold(l);
    l = l.replace(/[\s,;:\t]*\(?\d?\.?\s*G\s*F\s*-?\s*\d{1,2}(?:-[\p{L}]+)?\)?/giu, ' ').trim();
    let koen: Koen = null;
    const m = l.match(/^(.*?)[\s,;:\t]+\(?(p|d|pige|dreng)\)?$/i);
    if (m && m[1]!.trim()) {
      koen = KOEN_ORD[m[2]!.toLowerCase()] ?? null;
      l = m[1]!.trim();
    }
    const ord = l.split(/\s+/).filter(Boolean);
    if (ord.length === 0 || ord.some((o) => /\d/.test(o))) {
      sprungetOver++;
      continue;
    }
    // "Ida H." og "Anne-Sofie" beholdes. "Ida Marie Hansen" bliver til "Ida" (+ H til dubletter).
    const sidste = ord[ord.length - 1]!;
    if (ord.length === 2 && FORBOGSTAV_ORD.test(sidste)) {
      elever.push({ fornavn: `${paenStavning(ord[0]!)} ${sidste.toUpperCase()}`, koen, ...(hold ? { hold } : {}) });
    } else if (ord.length >= 2) {
      elever.push({ fornavn: paenStavning(ord[0]!), efternavnStart: start(sidste), koen, ...(hold ? { hold } : {}) });
    } else {
      elever.push({ fornavn: paenStavning(ord[0]!), koen, ...(hold ? { hold } : {}) });
    }
  }
  return { elever: elever.map(sikr), sprungetOver };
}

// ----------------------------------------------------------------------
// Dubletter

export interface Navngivet {
  navn: string;
  /** Sand, hvis navnet stadig ikke kan skelnes fra en anden elevs. */
  dublet: boolean;
}

/**
 * Giver elever med samme fornavn forbogstavet i efternavnet ("Ida H.").
 * Er forbogstavet også ens, bruges to bogstaver ("Ida Ha."). Kendes
 * efternavnet ikke, markeres eleven, så læreren kan tilføje det.
 */
export function navngivDubletter(elever: UdtrukketElev[]): Navngivet[] {
  const grupper = new Map<string, number[]>();
  elever.forEach((e, i) => {
    const k = noegle(e.fornavn);
    grupper.set(k, [...(grupper.get(k) ?? []), i]);
  });
  const res: Navngivet[] = elever.map((e) => ({ navn: e.fornavn, dublet: false }));
  for (const idx of grupper.values()) {
    if (idx.length < 2) continue;
    const bogstaver = (i: number, n: number) => elever[i]!.efternavnStart?.slice(0, n) ?? '';
    const tael = (n: number) => {
      const m = new Map<string, number>();
      for (const i of idx) m.set(bogstaver(i, n).toLowerCase(), (m.get(bogstaver(i, n).toLowerCase()) ?? 0) + 1);
      return m;
    };
    const en = tael(1);
    const to = tael(2);
    for (const i of idx) {
      const b1 = bogstaver(i, 1);
      const b2 = bogstaver(i, 2);
      if (!b1) {
        res[i]!.dublet = true;
      } else if (en.get(b1.toLowerCase()) === 1) {
        res[i]!.navn = `${elever[i]!.fornavn} ${b1.toUpperCase()}.`;
      } else if (b2.length === 2 && to.get(b2.toLowerCase()) === 1) {
        res[i]!.navn = `${elever[i]!.fornavn} ${b2[0]!.toUpperCase()}${b2[1]!.toLowerCase()}.`;
      } else {
        res[i]!.navn = `${elever[i]!.fornavn} ${b1.toUpperCase()}.`;
        res[i]!.dublet = true;
      }
    }
  }
  return res;
}

/**
 * Positionerne af navne, der ikke kan skelnes: ens navne (uden hensyn til
 * store/små bogstaver), og et fornavn uden forbogstav, når en anden elev
 * har samme fornavn med forbogstav ("Ida" ved siden af "Ida H.").
 */
export function findDubletter(navne: string[]): Set<number> {
  const fuld = new Map<string, number[]>();
  const medForbogstav = new Set<string>();
  navne.forEach((n, i) => {
    const k = noegle(n);
    if (!k) return;
    fuld.set(k, [...(fuld.get(k) ?? []), i]);
    const m = k.match(FORBOGSTAV);
    if (m) medForbogstav.add(m[1]!);
  });
  const res = new Set<number>();
  for (const idx of fuld.values()) if (idx.length > 1) idx.forEach((i) => res.add(i));
  navne.forEach((n, i) => {
    const k = noegle(n);
    if (k && !FORBOGSTAV.test(k) && medForbogstav.has(k)) res.add(i);
  });
  return res;
}

const FORBOGSTAV = /^(.*\S) \p{L}{1,2}\.$/u;

/**
 * Retter typiske fejl fra tekstgenkendelse, før teksten udtrækkes:
 * "ldaTestesen" bliver til "Ida Testesen", og lodrette streger fjernes.
 */
export function retOcrTekst(tekst: string): string {
  return tekst
    .split('\n')
    .map((linje) =>
      linje
        .replace(/[|¦]/g, ' ')
        // Sammenklistrede ord: "IdaTestesen" -> "Ida Testesen"
        .replace(/(\p{Ll}{2,})(\p{Lu}\p{Ll}{2,})/gu, '$1 $2')
        // Stort I læst som lille l først i et ord: "lda" -> "Ida"
        .replace(/(^|\s)l(?=[bdgmnrsv]\p{Ll}|da\b|da\s|ngrid|sabel|sak|lias|smail|brahim|ben\b)/gu, '$1I'),
    )
    .join('\n');
}

/** Rydder op i et navn, som læreren har skrevet: mellemrum og store forbogstaver. */
export function rydNavn(navn: string): string {
  return navn
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((o) => (/^\p{Ll}/u.test(o) && !PARTIKLER.has(o) ? o[0]!.toUpperCase() + o.slice(1) : o))
    .join(' ');
}

// ----------------------------------------------------------------------
// Intern logik

interface Kolonner {
  headerRaekke: number;
  fornavn: number;
  efternavn: number;
  navn: number[];
  koen: number;
  hold: number;
}

function findKolonner(raekker: string[][]): Kolonner {
  const k: Kolonner = { headerRaekke: -1, fornavn: -1, efternavn: -1, navn: [], koen: -1, hold: -1 };
  for (let r = 0; r < Math.min(raekker.length, 8); r++) {
    const celler = raekker[r]!;
    if (celler.length < 2) continue;
    const typer = celler.map((c) => HEADER[c.toLowerCase().replace(/[.:*]/g, '').trim()]);
    if (!typer.some(Boolean)) continue;
    // En overskriftsrække indeholder ingen navne.
    if (celler.some((c, i) => !typer[i] && erNavneagtig(c))) continue;
    k.headerRaekke = r;
    typer.forEach((t, i) => {
      if (t === 'fornavn' && k.fornavn < 0) k.fornavn = i;
      else if (t === 'efternavn' && k.efternavn < 0) k.efternavn = i;
      else if (t === 'navn') k.navn.push(i);
      else if (t === 'koen' && k.koen < 0) k.koen = i;
      else if (t === 'hold' && k.hold < 0) k.hold = i;
    });
    if (k.fornavn >= 0 || k.navn.length > 0) return k;
  }
  // Ingen brugbar overskrift: vælg de kolonner, hvor de fleste celler ligner navne.
  const fler = raekker.filter((c) => c.length > 1);
  const bredde = Math.max(0, ...fler.map((c) => c.length));
  const navnekolonner: number[] = [];
  for (let i = 0; i < bredde; i++) {
    const udfyldt = fler.filter((c) => (c[i] ?? '') !== '');
    if (udfyldt.length === 0) continue;
    const andel = udfyldt.filter((c) => erNavneagtig(c[i]!)).length / udfyldt.length;
    if (andel >= 0.6) navnekolonner.push(i);
  }
  if (navnekolonner.length >= 2) {
    // To navnekolonner uden overskrift: den med komma er "Efternavn, Fornavn",
    // ellers går vi ud fra fornavn først.
    const medKomma = navnekolonner.find((i) => fler.some((c) => (c[i] ?? '').includes(',')));
    if (medKomma !== undefined) k.navn = [medKomma];
    else {
      // Fornavn og efternavn står normalt lige efter hinanden.
      k.fornavn = navnekolonner[0]!;
      k.efternavn = navnekolonner[1]!;
    }
  } else k.navn = navnekolonner;
  return k;
}

function fraRaekke(celler: string[], k: Kolonner): UdtrukketElev | null {
  const e = fraRaekkeUdenHold(celler, k);
  if (!e) return null;
  const hold = k.hold >= 0 ? normaliserHold(celler[k.hold] ?? '') : celler.map(normaliserHold).find(Boolean);
  return hold ? { ...e, hold } : e;
}

function fraRaekkeUdenHold(celler: string[], k: Kolonner): UdtrukketElev | null {
  if (celler.some((c) => UDMELDT.has(c.toLowerCase()))) return null;
  let koen: Koen = null;
  if (k.koen >= 0) koen = KOEN_ORD[(celler[k.koen] ?? '').toLowerCase()] ?? null;
  else {
    for (const c of celler) {
      const v = KOEN_ORD[c.toLowerCase()];
      if (v && c.length > 1) koen = v; // enkeltbogstaver uden overskrift er for usikre
    }
  }

  if (k.fornavn >= 0) {
    const f = rensCelle(celler[k.fornavn] ?? '');
    if (!erNavneagtig(f)) return null;
    const e = k.efternavn >= 0 ? rensCelle(celler[k.efternavn] ?? '') : '';
    // Kun det første fornavn: mellemnavne er ofte slægtsnavne og må ikke gemmes.
    return { fornavn: paenStavning(f.split(/[\s,]+/)[0]!), efternavnStart: e ? start(e) : undefined, koen };
  }
  for (const i of k.navn) {
    const n = parseNavn(rensCelle(celler[i] ?? ''));
    if (n) return { ...n, koen };
  }
  if (k.navn.length === 0) {
    // Ukendt opbygning: tag den første celle, der ligner et navn.
    for (const c of celler) {
      const n = parseNavn(rensCelle(c));
      if (n) return { ...n, koen };
    }
  }
  return null;
}

function fraFritekst(linje: string): UdtrukketElev | null {
  const e = fraFritekstUdenHold(linje);
  const hold = normaliserHold(linje);
  return e && hold ? { ...e, hold } : e;
}

function fraFritekstUdenHold(linje: string): UdtrukketElev | null {
  const ord0 = linje.toLowerCase().split(/[\s,;:|]+/);
  if (ord0.some((o) => UDMELDT.has(o))) return null;
  let tekst = rensCelle(linje);
  // Fag og sprog sidst i linjen fjernes, så køn og navn kan læses.
  const ord = tekst.split(' ');
  while (ord.length > 1 && FAGORD.has(ord[ord.length - 1]!.toLowerCase())) ord.pop();
  tekst = ord.join(' ');
  let koen: Koen = null;
  // Køn som sidste ord: "Ida Hansen P", "Ida Hansen, pige"
  const m = tekst.match(/^(.*\S)[\s,]+(P|D|K|M|pige|dreng|kvinde|mand)$/i);
  if (m && (m[2]!.length > 1 || m[2] === m[2]!.toUpperCase())) {
    koen = KOEN_ORD[m[2]!.toLowerCase()] ?? null;
    tekst = m[1]!.replace(/,\s*$/, '');
  }
  const n = parseNavn(tekst);
  return n ? { ...n, koen } : null;
}

/** Fjerner alt, der ikke kan være en del af et navn: tal, e-mails, klassekoder, parenteser. */
function rensCelle(celle: string): string {
  return celle
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\S+@\S+/g, ' ')
    .replace(/(https?:\/\/|www\.)\S+/gi, ' ')
    .split(/\s+/)
    .map((o) => o.replace(/^[|:;•*"'“”«»_]+|[|:;•*"“”«»_]+$/g, ''))
    .filter((o) => o && !/\d/.test(o) && /\p{L}/u.test(o))
    .join(' ')
    .replace(/\s+,/g, ',')
    .trim();
}

function erNavneagtig(celle: string): boolean {
  const ord = rensCelle(celle).split(/[\s,]+/).filter(Boolean);
  if (ord.length === 0 || ord.length > 6) return false;
  if (!ord.some((o) => NAVNEORD.test(o) && o.replace(/[.'’-]/g, '').length >= 2)) return false;
  if (!NAVNEORD.test(ord[0]!) && !erPartikel(ord[0]!)) return false;
  return ord.every((o) => !STOPORD.has(o.toLowerCase().replace(/[.:]+$/, '')) && (NAVNEORD.test(o) || erPartikel(o)));
}

/** "al", "de", "van" eller med bindestreg: "al-Fiktiv". */
function erPartikel(o: string): boolean {
  if (PARTIKLER.has(o)) return true;
  const m = o.match(/^(\p{Ll}+)[-'’](\p{Lu}.*)$/u);
  return !!m && PARTIKLER.has(m[1]!) && NAVNEORD.test(m[2]!);
}

function parseNavn(tekst: string): { fornavn: string; efternavnStart?: string } | null {
  if (!erNavneagtig(tekst)) return null;
  const komma = tekst.indexOf(',');
  if (komma > 0) {
    // "Efternavn, Fornavn Mellemnavn"
    const efter = tekst.slice(0, komma).trim().split(/\s+/);
    const for_ = tekst.slice(komma + 1).trim().split(/\s+/).filter(Boolean);
    if (for_.length === 0) return null;
    return { fornavn: paenStavning(for_[0]!), efternavnStart: start(efter.find((o) => !PARTIKLER.has(o)) ?? efter[0]!) };
  }
  const ord = tekst.split(/\s+/);
  const versaler = (o: string) => o.length >= 2 && o === o.toUpperCase() && o !== o.toLowerCase();
  if (ord.length >= 2 && versaler(ord[0]!) && ord.slice(1).some((o) => !versaler(o))) {
    // "HANSEN Ida Marie"
    return { fornavn: paenStavning(ord[1]!), efternavnStart: start(ord[0]!) };
  }
  if (ord.length === 1) return { fornavn: paenStavning(ord[0]!) };
  const foerste = ord.findIndex((o) => !erPartikel(o));
  if (foerste > 0) {
    // "de Fiktiv Noah" uden komma: læses som efternavn først.
    const rest = ord.slice(foerste);
    if (rest.length >= 2) return { fornavn: paenStavning(rest[rest.length - 1]!), efternavnStart: start(rest[0]!) };
  }
  const sidste = [...ord].reverse().find((o) => !PARTIKLER.has(o)) ?? ord[ord.length - 1]!;
  return { fornavn: paenStavning(ord[0]!), efternavnStart: start(sidste) };
}

/** "IDA" bliver til "Ida", "ANNE-SOFIE" til "Anne-Sofie". Blandet skrivemåde bevares. */
function paenStavning(o: string): string {
  if (o !== o.toUpperCase() || o.length < 2) return o;
  return o
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, f: string, b: string) => f + b.toUpperCase());
}

function start(efternavn: string): string {
  return efternavn.replace(/^\p{Ll}+[-'’](?=\p{Lu})/u, '').replace(/[^\p{L}]/gu, '').slice(0, 2);
}

function noegle(navn: string): string {
  return navn.replace(/\s+/g, ' ').trim().toLocaleLowerCase('da');
}

function normaliser(tekst: string): string {
  return tekst
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿]/g, '');
}
