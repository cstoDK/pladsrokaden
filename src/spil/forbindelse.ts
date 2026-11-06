// Forbindelsen mellem spillepladen og elevernes spil. Den er udskiftelig:
//
// - "lokal" bruger browserens BroadcastChannel. Den virker kun mellem faner
//   i samme browser og sender intet over netværket. Til afprøvning og til
//   spil, der køres på projektoren.
// - En server-forbindelse (fx en database i EU) kommer senere og skal kun
//   opfylde samme interface. Den får aldrig navne: se protokol.ts.

import { type Besked, laesBesked } from './protokol';

export interface Forbindelse {
  art: 'lokal' | 'server';
  send(b: Besked): void;
  /** Lytter efter beskeder. Returnerer en funktion, der stopper lytningen. */
  paaBesked(fn: (b: Besked) => void): () => void;
  luk(): void;
}

// Uden bogstaver og tal, der let forveksles (O/0, I/1, L).
const TEGN = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function nyKode(rnd: () => number = Math.random): string {
  return Array.from({ length: 4 }, () => TEGN[Math.floor(rnd() * TEGN.length)]).join('');
}

export function normaliserKode(tekst: string): string | null {
  const k = tekst.trim().toUpperCase().replace(/\s+/g, '');
  return k.length === 4 && [...k].every((c) => TEGN.includes(c)) ? k : null;
}

export function lokalForbindelse(kode: string): Forbindelse {
  if (typeof BroadcastChannel === 'undefined') throw new Error('Browseren kan ikke sende beskeder mellem faner.');
  const kanal = new BroadcastChannel(`spillepladen:${kode}`);
  const lyttere = new Set<(b: Besked) => void>();
  kanal.onmessage = (e: MessageEvent) => {
    const b = laesBesked(e.data);
    if (b) for (const fn of lyttere) fn(b);
  };
  return {
    art: 'lokal',
    send: (b) => kanal.postMessage(b),
    paaBesked(fn) {
      lyttere.add(fn);
      return () => lyttere.delete(fn);
    },
    luk: () => kanal.close(),
  };
}

/** Et id, der kun bruges til at kende elevens enhed i denne session. Ingen navne. */
export function nytEnhedsId(): string {
  return `e${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}
