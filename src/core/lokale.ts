// Lokaler: skabeloner, automatisk størrelse og nummerering af borde, og
// konvertering af lokaler fra den første version af appen.

import { type Bord, type Lokale, MOBILSKAB, afstandTilTavle, bordBredde, bordHoejde, bordRaekker, nyId } from './model';

export type SkabelonId = 'raekker' | 'fire' | 'par';

export interface Skabelon {
  id: SkabelonId;
  navn: string;
  beskrivelse: string;
}

export const SKABELONER: Skabelon[] = [
  { id: 'raekker', navn: 'Lange rækker', beskrivelse: 'Borde i lange rækker' },
  { id: 'fire', navn: 'Borde à 4', beskrivelse: 'Én netværksgruppe pr. bord' },
  { id: 'par', navn: 'Borde à 2', beskrivelse: 'Sat sammen to og to: rækker á 4' },
];

export interface LokaleIndstillinger {
  antalBorde: number;
  pladserPrBord: number;
  bordePrRaekke: number;
  /** Stil bordene sammen to og to (fx to borde à 2 = en række på 4). */
  toOgTo?: boolean;
}

export const MAKS_BORDE = 40;
export const MAKS_PLADSER_PR_BORD = 16;
const MARGIN = 1;
/** Første række står lidt fra tavlen; rækkerne står 1,3 fra hinanden (bord + gang). */
const RAEKKE_START = 1.5;
const RAEKKE_AFSTAND = 1.3;

/** Standardindstillinger for en skabelon ud fra klassens størrelse. */
export function foreslaaIndstillinger(skabelon: SkabelonId, antalElever: number): LokaleIndstillinger {
  const n = Math.max(antalElever, 2);
  if (skabelon === 'raekker') {
    const raekker = n > 24 ? 3 : 2;
    return { antalBorde: raekker, pladserPrBord: Math.ceil(n / raekker), bordePrRaekke: 1 };
  }
  if (skabelon === 'fire') {
    const antal = Math.ceil(n / 4);
    return { antalBorde: antal, pladserPrBord: 4, bordePrRaekke: Math.min(3, antal) };
  }
  const antal = Math.ceil(n / 2);
  return { antalBorde: antal, pladserPrBord: 2, bordePrRaekke: Math.min(6, antal), toOgTo: true };
}

/** Bygger et lokale med borde i rækker og tavlen øverst. */
export function lavLokale(ind: LokaleIndstillinger, navn = ''): Lokale {
  const antal = klem(ind.antalBorde, 1, MAKS_BORDE);
  const pladser = klem(ind.pladserPrBord, 1, MAKS_PLADSER_PR_BORD);
  const prRaekke = klem(ind.bordePrRaekke, 1, antal);
  const borde: Bord[] = [];
  for (let i = 0; i < antal; i++) {
    const raekke = Math.floor(i / prRaekke);
    const kolonne = i % prRaekke;
    const x = ind.toOgTo ? MARGIN + Math.floor(kolonne / 2) * (2 * pladser + 1) + (kolonne % 2) * pladser : MARGIN + kolonne * (pladser + 1);
    borde.push({ id: nyId(), x, y: RAEKKE_START + raekke * RAEKKE_AFSTAND, pladser, lodret: false });
  }
  const l: Lokale = {
    id: nyId(),
    navn,
    bredde: 0,
    hoejde: 0,
    borde,
    tavle: { vaeg: 'top', midte: 0, laengde: 6 },
    mobilskab: null,
  };
  tilpasStoerrelse(l);
  l.tavle.midte = l.bredde / 2;
  l.tavle.laengde = Math.min(8, Math.max(4, Math.round(l.bredde * 0.5)));
  // Mobilskabet står bagest i lokalet, under det bageste bord.
  l.mobilskab = { x: MARGIN, y: Math.max(...borde.map((b) => b.y + bordHoejde(b))) + 0.6 };
  tilpasStoerrelse(l);
  return l;
}

/** Gør lokalet stort nok til alt indhold (plus luft), men aldrig mindre end 8 × 6. */
export function tilpasStoerrelse(l: Lokale): void {
  let b = 8;
  let h = 4;
  for (const bord of l.borde) {
    b = Math.max(b, bord.x + bordBredde(bord) + MARGIN);
    h = Math.max(h, bord.y + bordHoejde(bord) + MARGIN);
  }
  if (l.mobilskab) {
    b = Math.max(b, l.mobilskab.x + MOBILSKAB.bredde + 0.5);
    h = Math.max(h, l.mobilskab.y + MOBILSKAB.hoejde + 0.5);
  }
  const langsVaeg = l.tavle.vaeg === 'top' || l.tavle.vaeg === 'bund';
  if (langsVaeg) b = Math.max(b, l.tavle.laengde + 2);
  else h = Math.max(h, l.tavle.laengde + 2);
  l.bredde = b;
  l.hoejde = h;
  const vaeglaengde = langsVaeg ? b : h;
  l.tavle.midte = Math.min(vaeglaengde - l.tavle.laengde / 2, Math.max(l.tavle.laengde / 2, l.tavle.midte));
}

/**
 * Nummererer bordene forfra og bagud, og fra venstre mod højre set fra
 * elevernes plads (eller fra tavlens venstre side ved sidevægge).
 */
export function sorterBorde(l: Lokale): void {
  const langs = (b: Bord) => (l.tavle.vaeg === 'top' || l.tavle.vaeg === 'bund' ? b.x : b.y);
  l.borde.sort((a, b) => Math.round(afstandTilTavle(a, l) * 2) - Math.round(afstandTilTavle(b, l) * 2) || langs(a) - langs(b));
}

/**
 * Fjerner tom plads langs væggene: alt indhold rykkes, så der er 1 plads
 * luft til væggene og 1,5 ved tavlens væg.
 */
export function fjernTomPlads(l: Lokale): void {
  const xs = [...l.borde.map((b) => b.x), ...(l.mobilskab ? [l.mobilskab.x] : [])];
  const ys = [...l.borde.map((b) => b.y), ...(l.mobilskab ? [l.mobilskab.y] : [])];
  if (xs.length === 0) return;
  const venstre = l.tavle.vaeg === 'venstre' ? 1.5 : 1;
  const top = l.tavle.vaeg === 'top' ? 1.5 : 1;
  const dx = venstre - Math.min(...xs);
  const dy = top - Math.min(...ys);
  for (const b of l.borde) {
    b.x += dx;
    b.y += dy;
  }
  if (l.mobilskab) {
    l.mobilskab.x = Math.max(0, l.mobilskab.x + dx);
    l.mobilskab.y = Math.max(0, l.mobilskab.y + dy);
  }
  if (l.tavle.vaeg === 'top' || l.tavle.vaeg === 'bund') l.tavle.midte += dx;
  else l.tavle.midte += dy;
  // Højre og nederst beregnes af tilpasStoerrelse; ved tavlens væg gives lidt ekstra.
  l.bredde = 0;
  l.hoejde = 0;
  tilpasStoerrelse(l);
  if (l.tavle.vaeg === 'hoejre') l.bredde += 0.5;
  if (l.tavle.vaeg === 'bund') l.hoejde += 0.5;
}

/**
 * Lokaler fra version 1 og 2 havde borde, der var en hel plads dybe.
 * Nu er de PLADSDYBDE dybe; afstandene presses sammen, så lokalet bevarer
 * sit udseende uden ekstra tom plads.
 */
export function fraDybeBorde(l: Lokale): void {
  const f = 0.75;
  for (const b of l.borde) b.y = Math.round(b.y * f * 2) / 2;
  if (l.mobilskab) l.mobilskab.y = Math.round(l.mobilskab.y * f * 2) / 2;
  if (l.tavle.vaeg === 'venstre' || l.tavle.vaeg === 'hoejre') l.tavle.midte *= f;
  l.bredde = 0;
  l.hoejde = 0;
  tilpasStoerrelse(l);
}

/**
 * Står mobilskabet oven i et bord (fx efter en opdatering af tegningen),
 * flyttes det fri: bag det bageste bord ved venstre væg.
 */
export function flytMobilskabFri(l: Lokale): void {
  const m = l.mobilskab;
  if (!m) return;
  const overlapper = (x: number, y: number) =>
    l.borde.some((b) => x < b.x + bordBredde(b) && b.x < x + MOBILSKAB.bredde && y < b.y + bordHoejde(b) && b.y < y + MOBILSKAB.hoejde);
  if (!overlapper(m.x, m.y)) return;
  const bagest = l.tavle.vaeg === 'bund' ? 0.5 : Math.max(0, ...l.borde.map((b) => b.y + bordHoejde(b))) + 0.6;
  l.mobilskab = { x: MARGIN, y: bagest };
  if (overlapper(l.mobilskab.x, l.mobilskab.y)) l.mobilskab.y = Math.max(0, ...l.borde.map((b) => b.y + bordHoejde(b))) + 0.6;
  tilpasStoerrelse(l);
}

/** Gitteret, bordene klikker fast til: hele pladser vandret, rækker lodret. */
export const GITTER = { raekkeStart: RAEKKE_START, raekkeAfstand: RAEKKE_AFSTAND };

/** Nærmeste punkt i gitteret for et bords øverste venstre hjørne. */
export function iGitter(x: number, y: number): { x: number; y: number } {
  const r = Math.max(0, Math.round((y - RAEKKE_START) / RAEKKE_AFSTAND));
  const gy = y < RAEKKE_START - RAEKKE_AFSTAND / 2 ? Math.max(0, Math.round(y * 2) / 2) : RAEKKE_START + r * RAEKKE_AFSTAND;
  return { x: Math.max(0, Math.round(x)), y: Math.round(gy * 100) / 100 };
}

/**
 * Hvor et bord lander, når det trækkes til (x, y). De rækker, der allerede
 * står borde i, vejer tungere end gitteret: står rækkerne ikke præcis i
 * gitteret (fx et lokale fra en ældre version), skal bordet stadig kunne
 * sættes ind på rækken.
 */
export function bordPlacering(l: Lokale, bordId: string, x: number, y: number): { x: number; y: number } {
  const g = iGitter(x, y);
  const b = l.borde.find((d) => d.id === bordId);
  let raekke: number | null = null;
  for (const a of l.borde) {
    if (a.id === bordId || a.lodret !== b?.lodret) continue;
    const d = Math.abs(a.y - y);
    if (d < RAEKKE_AFSTAND / 2 && (raekke === null || d < Math.abs(raekke - y))) raekke = a.y;
  }
  return { x: g.x, y: raekke ?? g.y };
}

/**
 * Retter bordene ind: borde (og borde, der står sammen) i samme række får
 * samme højde, rækkerne får samme afstand, og borde, der står næsten under
 * hinanden, rettes ind i samme kolonne.
 */
export function retBordeneInd(l: Lokale): void {
  const enheder = bordRaekker(l).map((r) => ({ borde: r, x: Math.min(...r.map((b) => b.x)), y: Math.min(...r.map((b) => b.y)) }));
  // Rækker: enheder, hvis top ligger tæt, hører til samme række.
  const efterY = [...enheder].sort((a, b) => a.y - b.y);
  let raekke = -1;
  let sidsteY = -Infinity;
  const start = efterY.length ? iGitter(0, efterY[0]!.y).y : RAEKKE_START;
  const nyY = new Map<(typeof enheder)[number], number>();
  for (const e of efterY) {
    if (e.y - sidsteY > RAEKKE_AFSTAND / 2) {
      raekke++;
      sidsteY = e.y;
    }
    nyY.set(e, Math.round((start + raekke * RAEKKE_AFSTAND) * 100) / 100);
  }
  // Kolonner: venstre kanter tæt på hinanden rettes ind efter den yderste.
  const efterX = [...enheder].sort((a, b) => a.x - b.x);
  const nyX = new Map<(typeof enheder)[number], number>();
  let kolonneX = -Infinity;
  for (const e of efterX) {
    if (e.x - kolonneX > 1.5) kolonneX = Math.round(e.x);
    nyX.set(e, kolonneX);
  }
  for (const e of enheder) {
    const dx = nyX.get(e)! - e.x;
    const dy = nyY.get(e)! - e.y;
    for (const b of e.borde) {
      b.x = Math.round((b.x + dx) * 100) / 100;
      b.y = Math.round((b.y + dy) * 100) / 100;
    }
  }
  tilpasStoerrelse(l);
}

/**
 * Stiller bordene i hver række sammen to og to (kant i kant), med en gang
 * mellem parrene. Rækkerne og deres rækkefølge bevares. Lodrette borde
 * og borde, der allerede står sammen, lades i fred.
 */
export function saetSammenToOgTo(l: Lokale): void {
  const raekker = new Map<number, Bord[]>();
  for (const b of l.borde) {
    if (b.lodret) continue;
    const k = Math.round(b.y * 2);
    raekker.set(k, [...(raekker.get(k) ?? []), b]);
  }
  for (const raekke of raekker.values()) {
    raekke.sort((a, b) => a.x - b.x);
    const y = raekke[0]!.y;
    let x = raekke[0]!.x;
    for (let i = 0; i < raekke.length; i += 2) {
      const a = raekke[i]!;
      const b = raekke[i + 1];
      a.x = x;
      a.y = y;
      x += bordBredde(a);
      if (b) {
        b.x = x;
        b.y = y;
        x += bordBredde(b);
      }
      x += 1;
    }
  }
  tilpasStoerrelse(l);
}

/** Er der borde i samme række, som ikke står sammen to og to? */
export function kanSaettesSammen(l: Lokale): boolean {
  const vandrette = l.borde.filter((b) => !b.lodret);
  const iRaekke = (b: Bord) => vandrette.filter((x) => Math.abs(x.y - b.y) < 0.25).length;
  const raekker = new Map<number, number>();
  for (const b of vandrette) if (iRaekke(b) >= 2) raekker.set(Math.round(b.y * 2), 1);
  if (raekker.size === 0) return false;
  const proeve = structuredClone(l);
  saetSammenToOgTo(proeve);
  return proeve.borde.some((b, i) => b.x !== l.borde[i]!.x || b.y !== l.borde[i]!.y);
}

/**
 * Trækkes et bord tæt på enden af et andet bord i samme retning, sættes
 * det kant i kant med det, så de to borde står sammen.
 */
export function sugSammen(l: Lokale, bordId: string): boolean {
  const b = l.borde.find((x) => x.id === bordId);
  if (!b) return false;
  for (const a of l.borde) {
    if (a.id === b.id || a.lodret !== b.lodret) continue;
    if (!b.lodret && Math.abs(a.y - b.y) < 0.5) {
      if (Math.abs(a.x + bordBredde(a) - b.x) < 0.75) return saet(b, a.x + bordBredde(a), a.y);
      if (Math.abs(b.x + bordBredde(b) - a.x) < 0.75) return saet(b, a.x - bordBredde(b), a.y);
    }
    if (b.lodret && Math.abs(a.x - b.x) < 0.5) {
      if (Math.abs(a.y + bordHoejde(a) - b.y) < 0.75) return saet(b, a.x, a.y + bordHoejde(a));
      if (Math.abs(b.y + bordHoejde(b) - a.y) < 0.75) return saet(b, a.x, a.y - bordHoejde(b));
    }
  }
  return false;
}

function saet(b: Bord, x: number, y: number): boolean {
  if (x < 0 || y < 0) return false;
  b.x = x;
  b.y = y;
  return true;
}

/** Klargør et lokale til at blive gemt: tom plads, rækkefølge og størrelse. */
export function normaliserLokale(l: Lokale): Lokale {
  const kopi = structuredClone(l);
  fjernTomPlads(kopi);
  sorterBorde(kopi);
  return kopi;
}

/** Lokale fra appens første version (borde i et gitter). */
export interface LokaleV1 {
  borde: { id: string; raekke: number; kolonne: number; pladser: number }[];
  forresteRaekker: number;
}

export function fraV1(v1: LokaleV1, navn = ''): Lokale {
  const maks = Math.max(1, ...v1.borde.map((b) => b.pladser));
  const borde: Bord[] = v1.borde.map((b) => ({
    id: b.id,
    x: MARGIN + b.kolonne * (maks + 1),
    y: RAEKKE_START + b.raekke * RAEKKE_AFSTAND,
    pladser: b.pladser,
    lodret: false,
    ...(v1.forresteRaekker > 1 ? { forrest: b.raekke < v1.forresteRaekker } : {}),
  }));
  const l: Lokale = { id: nyId(), navn, bredde: 0, hoejde: 0, borde, tavle: { vaeg: 'top', midte: 0, laengde: 6 }, mobilskab: null };
  tilpasStoerrelse(l);
  l.tavle.midte = l.bredde / 2;
  // Alle klasselokaler har et mobilskab; det stilles bag det bageste bord.
  l.mobilskab = { x: MARGIN, y: Math.max(0, ...borde.map((b) => b.y + bordHoejde(b))) + 0.6 };
  tilpasStoerrelse(l);
  return l;
}

export function antalRaekker(lokale: Lokale): number {
  return new Set(lokale.borde.map((b) => Math.round(afstandTilTavle(b, lokale)))).size;
}

function klem(x: number, min: number, max: number): number {
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, Math.round(x)));
}
