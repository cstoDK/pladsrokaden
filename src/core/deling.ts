// Planen som tekst til Teams, Ludus eller en mail.

import { planTitel } from './dato';
import { type ElevId, type Plan, elevIderVedBord } from './model';

export function planSomTekst(klassenavn: string, plan: Plan, navn: (id: ElevId) => string): string {
  const linjer = [`${klassenavn}, ${planTitel(plan.dato).toLowerCase()}`, ''];
  plan.lokale.borde.forEach((b, i) => {
    const ider = elevIderVedBord(plan.placering, b.id);
    const forrest = b.raekke < plan.lokale.forresteRaekker ? ' (forrest)' : '';
    linjer.push(`Bord ${i + 1}${forrest}: ${ider.length ? ider.map(navn).join(', ') : 'tomt'}`);
  });
  return linjer.join('\n');
}
