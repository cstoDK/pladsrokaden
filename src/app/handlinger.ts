// Handlinger, der bruges flere steder: sikkerhedskopi, demoklasse, udskrift.

import { iDag } from '../core/dato';
import { lavDemo } from '../core/demo';
import { filnavn, flet, fraFil, tilFil } from '../core/fil';
import { type Klasse, type Plan } from '../core/model';
import { hentData, medFortryd, opdater, visBesked } from './tilstand';

export function gemSikkerhedskopi(): void {
  const d = hentData();
  const blob = new Blob([tilFil(d)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filnavn(iDag());
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  opdater((x) => void (x.sidstEksporteret = new Date().toISOString()));
  visBesked('Sikkerhedskopien er gemt i din mappe med overførsler. Flyt den gerne til skolens OneDrive.');
}

export async function hentSikkerhedskopi(fil: File): Promise<void> {
  const r = fraFil(await fil.text());
  if ('fejl' in r) {
    visBesked(r.fejl);
    return;
  }
  const n = r.klasser.length;
  medFortryd(`${n} ${n === 1 ? 'klasse' : 'klasser'} er hentet fra filen.`, (d) => {
    const ny = flet(d, r);
    d.klasser = ny.klasser;
    d.lokaler = ny.lokaler;
    d.aktivKlasseId = r.klasser[0]?.id ?? ny.aktivKlasseId;
  });
}

/** Åbner demoklassen (laver den, hvis den ikke findes) og returnerer dens id. */
export function aabnDemo(): string {
  const findes = hentData().klasser.find((k) => k.erDemo);
  if (findes) {
    opdater((d) => void (d.aktivKlasseId = findes.id));
    return findes.id;
  }
  const { klasse, lokale } = lavDemo();
  opdater((d) => {
    d.lokaler.push(lokale);
    d.klasser.push(klasse);
    d.aktivKlasseId = klasse.id;
  });
  return klasse.id;
}

export function sletAlt(): void {
  medFortryd('Alle klasser er slettet fra denne computer.', (d) => {
    d.klasser = [];
    d.lokaler = [];
    d.aktivKlasseId = null;
  });
}

/** Skal der mindes om sikkerhedskopi? (Aldrig gemt, eller over 14 dage siden.) */
export function boerTageSikkerhedskopi(nu: Date = new Date()): boolean {
  const d = hentData();
  const rigtige = d.klasser.filter((k) => !k.erDemo && k.planer.length > 0);
  if (rigtige.length === 0) return false;
  if (!d.sidstEksporteret) return true;
  return nu.getTime() - new Date(d.sidstEksporteret).getTime() > 14 * 86400000;
}

// ----------------------------------------------------------------------
// Udskrift: hvilken plan der skal på papir.

let udskrift: { klasse: Klasse; plan: Plan } | null = null;
const udskriftLyttere = new Set<() => void>();

export function hentUdskrift() {
  return udskrift;
}
export function lytTilUdskrift(l: () => void): () => void {
  udskriftLyttere.add(l);
  return () => void udskriftLyttere.delete(l);
}

export function udskriv(klasse: Klasse, plan: Plan): void {
  udskrift = { klasse, plan };
  udskriftLyttere.forEach((l) => l());
  // Vent til arket er tegnet, før printdialogen åbnes.
  requestAnimationFrame(() => setTimeout(() => window.print(), 30));
}

export function nulstilUdskrift(): void {
  udskrift = null;
  udskriftLyttere.forEach((l) => l());
}

export async function kopierTekst(tekst: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(tekst);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = tekst;
    t.setAttribute('readonly', '');
    t.className = 'skjult';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}
