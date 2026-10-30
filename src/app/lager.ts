// Gemmer appens data i browserens localStorage. Intet sendes nogen steder hen.

import { type AppData, tomtAppData } from '../core/model';

const NOEGLE = 'pladsrokaden.v1';

export function indlaes(): AppData {
  try {
    const raa = localStorage.getItem(NOEGLE);
    if (!raa) return tomtAppData();
    const d = JSON.parse(raa) as AppData;
    if (d?.version !== 1 || !Array.isArray(d.klasser)) return tomtAppData();
    return d;
  } catch {
    return tomtAppData();
  }
}

/** Gemmer data. Returnerer false, hvis browseren ikke ville gemme (fx privat vindue eller fuld lagerplads). */
export function gem(d: AppData): boolean {
  try {
    localStorage.setItem(NOEGLE, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function sletAltLokalt(): void {
  try {
    localStorage.removeItem(NOEGLE);
  } catch {
    // Intet at gøre: der er så heller ikke noget gemt.
  }
}

/** Beder browseren om ikke at rydde data automatisk, når der mangler plads. */
export function bedOmVedvarendeLager(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}
