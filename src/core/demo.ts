// Demoklasse med tydeligt opdigtede elever, et lokale og tre tidligere
// planer, så nye brugere kan se historik og forklaringer med det samme.

import { lavLokale } from './lokale';
import { type Elev, type Klasse, type Lokale, type Plan, nyId } from './model';
import { lavPlacering } from './optimering';

const PIGER = ['Ida', 'Freja', 'Emma', 'Alma', 'Clara', 'Laura', 'Asta', 'Nora', 'Agnes', 'Lea', 'Maja', 'Signe'];
const DRENGE = ['Malte', 'Noah', 'Oscar', 'Ahmad', 'Emil', 'Victor', 'William', 'Karl', 'Alfred', 'Elias', 'Anton', 'Lucas', 'Omar', 'Adam'];

export const DEMO_NAVN = 'Demoklasse (opdigtet)';

export function lavDemo(idag: Date = new Date()): { klasse: Klasse; lokale: Lokale } {
  const elever: Elev[] = [
    ...PIGER.map((navn) => ({ id: nyId(), navn, koen: 'P' as const })),
    ...DRENGE.map((navn) => ({ id: nyId(), navn, koen: 'D' as const })),
  ];
  const lokale = lavLokale({ antalBorde: 8, pladserPrBord: 4, bordePrRaekke: 3 }, 'Demo');
  const holdAdskilt: [string, string][] = [[elever[1]!.id, elever[PIGER.length + 2]!.id]];
  const planer: Plan[] = [];
  for (let i = 3; i >= 1; i--) {
    const d = new Date(idag);
    d.setDate(d.getDate() - 21 * i);
    const { placering } = lavPlacering({ elever, lokale, tidligere: planer, holdAdskilt, laase: [], seed: 100 + i });
    planer.push({ id: nyId(), dato: d.toISOString().slice(0, 10), lokale: structuredClone(lokale), placering });
  }
  const klasse: Klasse = { id: nyId(), navn: DEMO_NAVN, erDemo: true, elever, holdAdskilt, faste: [], lokaleId: lokale.id, planer, kladde: null };
  return { klasse, lokale };
}
