// Datoer og ugenumre (ISO 8601, som bruges i Danmark).

/** ISO-uge for en dato på formen ÅÅÅÅ-MM-DD. */
export function isoUge(dato: string): { aar: number; uge: number } {
  const [a, m, d] = dato.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(a, m - 1, d));
  const ugedag = t.getUTCDay() || 7; // mandag = 1, søndag = 7
  t.setUTCDate(t.getUTCDate() + 4 - ugedag); // torsdag i samme uge
  const aar = t.getUTCFullYear();
  const start = Date.UTC(aar, 0, 1);
  const uge = Math.ceil(((t.getTime() - start) / 86400000 + 1) / 7);
  return { aar, uge };
}

/** Dagens dato som ÅÅÅÅ-MM-DD i lokal tid. */
export function iDag(nu: Date = new Date()): string {
  const m = String(nu.getMonth() + 1).padStart(2, '0');
  const d = String(nu.getDate()).padStart(2, '0');
  return `${nu.getFullYear()}-${m}-${d}`;
}

const MAANEDER = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'];

/** "30. okt. 2026" */
export function kortDato(dato: string): string {
  const [a, m, d] = dato.split('-').map(Number) as [number, number, number];
  return `${d}. ${MAANEDER[m - 1]} ${a}`;
}

/** "Uge 44, 30. okt. 2026" */
export function planTitel(dato: string): string {
  return `Uge ${isoUge(dato).uge}, ${kortDato(dato)}`;
}
