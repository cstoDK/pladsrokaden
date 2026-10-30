// Navigation med adresser i #-delen (fx #/klasse/<id>/elever), så
// browserens tilbage- og frem-knapper virker. Adressen indeholder kun
// klassens tekniske id, aldrig elevdata.

import { useEffect, useState } from 'preact/hooks';

export type Fane = 'plan' | 'elever' | 'lokale' | 'historik';

export type Rute =
  | { side: 'start' }
  | { side: 'ny' }
  | { side: 'data' }
  /** Opdatér den åbne klasse fra en liste i adressen (kun i #-delen, som aldrig sendes til en server). */
  | { side: 'opdater'; liste: string }
  | { side: 'klasse'; id: string; fane: Fane | null };

const FANER: Fane[] = ['plan', 'elever', 'lokale', 'historik'];

export function laesRute(hash: string): Rute | null {
  const dele = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (dele.length === 0) return null;
  if (dele[0] === 'start') return { side: 'start' };
  if (dele[0] === 'ny') return { side: 'ny' };
  if (dele[0] === 'data') return { side: 'data' };
  if (dele[0] === 'opdater' && dele[1]) {
    try {
      return { side: 'opdater', liste: decodeURIComponent(dele.slice(1).join('/')) };
    } catch {
      return null;
    }
  }
  if (dele[0] === 'klasse' && dele[1]) {
    const fane = FANER.includes(dele[2] as Fane) ? (dele[2] as Fane) : null;
    return { side: 'klasse', id: decodeURIComponent(dele[1]), fane };
  }
  return null;
}

export function tilHash(r: Rute): string {
  if (r.side === 'klasse') return `#/klasse/${encodeURIComponent(r.id)}${r.fane ? `/${r.fane}` : ''}`;
  if (r.side === 'opdater') return `#/opdater/${encodeURIComponent(r.liste)}`;
  return `#/${r.side}`;
}

/** Går til en side. `erstat` bruges, når den nuværende side ikke skal kunne gås tilbage til. */
export function gaaTil(r: Rute, erstat = false): void {
  const hash = tilHash(r);
  if (location.hash === hash) return;
  if (erstat) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else location.hash = hash;
  window.scrollTo(0, 0);
}

export function useRute(): Rute | null {
  const [rute, setRute] = useState(() => laesRute(location.hash));
  useEffect(() => {
    const ved = () => setRute(laesRute(location.hash));
    window.addEventListener('hashchange', ved);
    return () => window.removeEventListener('hashchange', ved);
  }, []);
  return rute;
}
