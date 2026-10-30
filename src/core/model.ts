// Datamodellen. Bevidst minimal: kun fornavn, køn, bordplaner og
// "hold adskilt"-par. Ingen efternavne, numre eller fritekst om elever.

export type ElevId = string;
export type BordId = string;

/** P = pige, D = dreng, null = ikke angivet (tæller ikke med i kønsbalancen). */
export type Koen = 'P' | 'D' | null;

export interface Elev {
  id: ElevId;
  /** Fornavn, evt. med forbogstav i efternavnet ved dubletter ("Ida H."). */
  navn: string;
  koen: Koen;
}

/**
 * Et bord er en række pladser. Koordinater er i "pladser": én plads er 1 bred
 * og et bord er PLADSDYBDE dybt. (0, 0) er lokalets øverste venstre hjørne.
 * Ved lodrette borde tegnes hver plads som en bred, lav boks, så navnet
 * kan stå vandret.
 */
export interface Bord {
  id: BordId;
  x: number;
  y: number;
  pladser: number;
  /** Pladserne står under hinanden i stedet for ved siden af hinanden. */
  lodret: boolean;
  /** Lærerens eget valg. Udeladt: afgøres automatisk ud fra afstanden til tavlen. */
  forrest?: boolean;
}

export type Vaeg = 'top' | 'bund' | 'venstre' | 'hoejre';

export interface Lokale {
  id: string;
  /** Lokalets nummer eller navn, fx "007". */
  navn: string;
  bredde: number;
  hoejde: number;
  borde: Bord[];
  /** Tavlen står ved en væg. `midte` er midten langs væggen (i pladser). */
  tavle: { vaeg: Vaeg; midte: number; laengde: number };
  /** Mobilskabets øverste venstre hjørne, eller null hvis der ikke er et. */
  mobilskab: { x: number; y: number } | null;
}

/** Hvem sidder på hvilken plads. Listen har én post pr. plads; null er en tom plads. */
export type Placering = Record<BordId, (ElevId | null)[]>;

export interface Plan {
  id: string;
  /** ISO-dato (ÅÅÅÅ-MM-DD). Ugenummeret beregnes ud fra den. */
  dato: string;
  /** Kopi af lokalet, så historikken passer, selvom lokalet senere ændres. */
  lokale: Lokale;
  placering: Placering;
}

export interface Laas {
  elevId: ElevId;
  bordId: BordId;
  plads: number;
}

export interface Klasse {
  id: string;
  navn: string;
  erDemo: boolean;
  elever: Elev[];
  holdAdskilt: [ElevId, ElevId][];
  /** Faste pladser, som følger med fra plan til plan. Ingen begrundelse gemmes. */
  faste: Laas[];
  /** Lokalet, klassen bruger. null, indtil læreren har valgt et. */
  lokaleId: string | null;
  /** Gemte planer, ældste først. */
  planer: Plan[];
  /** Forslag, der ikke er gemt endnu. */
  kladde: Kladde | null;
}

export interface Kladde {
  plan: Plan;
  /** Låse sat i denne kladde (gælder kun denne plan). */
  laase: Laas[];
}

export interface AppData {
  version: 3;
  klasser: Klasse[];
  /** Lokaler deles mellem klasserne og huskes med deres indretning. */
  lokaler: Lokale[];
  aktivKlasseId: string | null;
  /** Hvornår der sidst blev gemt en sikkerhedskopi (ISO-tidspunkt). */
  sidstEksporteret: string | null;
}

export function tomtAppData(): AppData {
  return { version: 3, klasser: [], lokaler: [], aktivKlasseId: null, sidstEksporteret: null };
}

export function nyKlasse(navn: string, elever: Elev[]): Klasse {
  return { id: nyId(), navn, erDemo: false, elever, holdAdskilt: [], faste: [], lokaleId: null, planer: [], kladde: null };
}

export function findLokale(d: { lokaler: Lokale[] }, k: Klasse): Lokale | null {
  return d.lokaler.find((l) => l.id === k.lokaleId) ?? null;
}

export function nyId(): string {
  return crypto.randomUUID();
}

export const PLADSDYBDE = 0.6;
export const MOBILSKAB = { bredde: 2, hoejde: 0.7 };

export function bordBredde(b: Bord): number {
  return b.lodret ? 1 : b.pladser;
}
export function bordHoejde(b: Bord): number {
  return b.lodret ? b.pladser * PLADSDYBDE : PLADSDYBDE;
}

/** Afstand fra bordets nærmeste kant til tavlens væg. */
export function afstandTilTavle(b: Bord, l: Lokale): number {
  switch (l.tavle.vaeg) {
    case 'top':
      return b.y;
    case 'bund':
      return l.hoejde - (b.y + bordHoejde(b));
    case 'venstre':
      return b.x;
    case 'hoejre':
      return l.bredde - (b.x + bordBredde(b));
  }
}

/**
 * De borde, der tæller som forrest: lærerens eget valg, ellers de borde,
 * der står nærmest tavlen (den forreste "række").
 */
export function forresteBorde(l: Lokale): Set<BordId> {
  const auto = l.borde.filter((b) => b.forrest === undefined);
  const min = Math.min(...auto.map((b) => afstandTilTavle(b, l)));
  const res = new Set<BordId>();
  for (const b of l.borde) {
    if (b.forrest === true || (b.forrest === undefined && afstandTilTavle(b, l) <= min + 0.75)) res.add(b.id);
  }
  return res;
}

export function erForrest(bord: Bord, lokale: Lokale): boolean {
  return forresteBorde(lokale).has(bord.id);
}

/** Står de to borde kant i kant i samme retning, så de danner én række? */
export function staarSammen(a: Bord, b: Bord): boolean {
  const n = (x: number, y: number) => Math.abs(x - y) < 0.05;
  if (a.lodret !== b.lodret) return false;
  if (!a.lodret) return n(a.y, b.y) && (n(a.x + bordBredde(a), b.x) || n(b.x + bordBredde(b), a.x));
  return n(a.x, b.x) && (n(a.y + bordHoejde(a), b.y) || n(b.y + bordHoejde(b), a.y));
}

/**
 * Borde, der står kant i kant, danner én række (fx to borde à 2 = en række
 * på 4). Hver række er bordene i rækkefølge fra venstre (eller oppefra).
 * Rækkerne kommer i rækkefølge efter deres første bord i lokalet.
 */
export function bordRaekker(l: Lokale): Bord[][] {
  const forælder = l.borde.map((_, i) => i);
  const rod = (i: number): number => (forælder[i] === i ? i : (forælder[i] = rod(forælder[i]!)));
  for (let i = 0; i < l.borde.length; i++) {
    for (let j = i + 1; j < l.borde.length; j++) {
      if (staarSammen(l.borde[i]!, l.borde[j]!)) forælder[rod(j)] = rod(i);
    }
  }
  const grupper = new Map<number, Bord[]>();
  l.borde.forEach((b, i) => {
    const r = rod(i);
    grupper.set(r, [...(grupper.get(r) ?? []), b]);
  });
  const ud = [...grupper.values()].map((r) => r.sort((a, b) => (a.lodret ? a.y - b.y : a.x - b.x)));
  return ud.sort((a, b) => Math.min(...a.map((x) => l.borde.indexOf(x))) - Math.min(...b.map((x) => l.borde.indexOf(x))));
}

/** Bordets nummer, som læreren ser det (1, 2, 3 ...), i lokalets rækkefølge. */
export function bordNummer(lokale: Lokale, bordId: BordId): number {
  return lokale.borde.findIndex((b) => b.id === bordId) + 1;
}

export function antalPladser(lokale: Lokale): number {
  return lokale.borde.reduce((sum, b) => sum + b.pladser, 0);
}

/** Eleverne ved hvert bord, uden tomme pladser. */
export function elevIderVedBord(placering: Placering, bordId: BordId): ElevId[] {
  return (placering[bordId] ?? []).filter((id): id is ElevId => id !== null);
}
