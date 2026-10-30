// Planen som tekst til Teams, Ludus eller en mail.

import { planTitel } from './dato';
import { type ElevId, type Plan, bordNummer, forresteBorde } from './model';
import { planGrupper } from './struktur';

export function planSomTekst(klassenavn: string, plan: Plan, navn: (id: ElevId) => string): string {
  const forrest = forresteBorde(plan.lokale);
  const lokale = plan.lokale.navn ? `, lokale ${plan.lokale.navn}` : '';
  const linjer = [`${klassenavn}, ${planTitel(plan.dato).toLowerCase()}${lokale}`, '', 'Netværksgrupper og makkerpar:'];
  for (const g of planGrupper(plan.lokale, plan.placering)) {
    const bord = `bord ${bordNummer(plan.lokale, g.bordId)}${forrest.has(g.bordId) ? ', forrest' : ''}`;
    linjer.push(`Gruppe ${g.nr} (${bord}): ${g.par.map((p) => p.map(navn).join(' og ')).join(' | ')}`);
  }
  return linjer.join('\n');
}
