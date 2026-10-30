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

export interface Bord {
  id: BordId;
  /** 0 er rækken nærmest tavlen. */
  raekke: number;
  kolonne: number;
  pladser: number;
}

export interface Lokale {
  borde: Bord[];
  /** Antal rækker, der tæller som "forrest". */
  forresteRaekker: number;
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
  lokale: Lokale;
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
  version: 1;
  klasser: Klasse[];
  aktivKlasseId: string | null;
  /** Hvornår der sidst blev gemt en sikkerhedskopi (ISO-tidspunkt). */
  sidstEksporteret: string | null;
}

export function nyId(): string {
  return crypto.randomUUID();
}

/** Er bordet i de forreste rækker? */
export function erForrest(bord: Bord, lokale: Lokale): boolean {
  return bord.raekke < lokale.forresteRaekker;
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
