// Klassens skærm. Mens klassen sættes op, er trinene (Elever, Lokale,
// Første plan) navigationen og viser, hvor langt man er. Bagefter er
// fanerne Plan, Elever, Lokale og Historik altid synlige.

import { type Fane, gaaTil, tilHash } from '../app/navigation';
import { useData, visBesked } from '../app/tilstand';
import { type Klasse, findLokale } from '../core/model';
import { EleverFane } from './elever/EleverFane';
import { Trinviser, useFokusPaaOverskrift } from './Faelles';
import { HistorikFane } from './historik/HistorikFane';
import { LokaleSkaerm } from './lokale/LokaleEditor';
import { PlanFane } from './plan/PlanFane';

const FANER: { id: Fane; navn: string }[] = [
  { id: 'plan', navn: 'Plan' },
  { id: 'elever', navn: 'Elever' },
  { id: 'lokale', navn: 'Lokale' },
  { id: 'historik', navn: 'Historik' },
];

export function KlasseVisning(props: { klasse: Klasse; fane: Fane | null; forhaandsliste?: string }) {
  const k = props.klasse;
  const lokale = findLokale(useData(), k);
  const opsaetning = !lokale || k.planer.length === 0;
  // Uden valgt fane: næste skridt i opsætningen, ellers planen.
  const fane: Fane = props.fane ?? (!lokale ? 'lokale' : 'plan');
  const til = (f: Fane) => tilHash({ side: 'klasse', id: k.id, fane: f });
  const gaa = (f: Fane) => gaaTil({ side: 'klasse', id: k.id, fane: f });

  useFokusPaaOverskrift(`${k.id}|${fane}|${!!lokale}|${k.planer.length}`);

  return (
    <div>
      {k.erDemo && (
        <p class="demo-banner">
          Eleverne i demoklassen er opdigtede. Prøv at lave en ny plan og flytte rundt. Du kan slette klassen under Elever.
        </p>
      )}
      {opsaetning && (
        <Trinviser
          trin={[
            { navn: 'Elever', faerdig: k.elever.length > 0, aktuelt: fane === 'elever', href: til('elever') },
            { navn: 'Lokale', faerdig: !!lokale, aktuelt: fane === 'lokale', href: til('lokale') },
            { navn: 'Første plan', faerdig: k.planer.length > 0, aktuelt: fane === 'plan', href: til('plan') },
          ]}
        />
      )}
      {/* Under opsætningen er trinviseren navigationen; to menuer oven på hinanden er for meget. */}
      {!opsaetning && (
        <nav class="faner" aria-label={`Klasse ${k.navn}`}>
          {FANER.map((f) => (
            <a key={f.id} class="fane" href={til(f.id)} aria-current={fane === f.id ? 'page' : undefined}>
              {f.navn}
            </a>
          ))}
        </nav>
      )}

      {fane === 'plan' &&
        (k.elever.length === 0 ? (
          <section class="kort smal">
            <h1>{k.navn} har ingen elever endnu</h1>
            <p>Start med at tilføje klassens elever. Så kan du lave en plan bagefter.</p>
            <a class="knap knap-primaer knap-stor" href={til('elever')}>
              Tilføj elever
            </a>
          </section>
        ) : !lokale ? (
          <section class="kort smal">
            <h1>Vælg først lokalet</h1>
            <p>Planen laves ud fra, hvordan bordene står i lokalet.</p>
            <a class="knap knap-primaer knap-stor" href={til('lokale')}>
              Vælg lokale
            </a>
          </section>
        ) : (
          <PlanFane key={k.id} klasse={k} lokale={lokale} foersteGang={k.planer.length === 0} onFane={gaa} />
        ))}

      {fane === 'elever' && (
        <>
          <EleverFane key={`${k.id}|${props.forhaandsliste ?? ''}`} klasse={k} lokale={lokale} forhaandsliste={props.forhaandsliste} />
          {opsaetning && (
            <div class="smal videre">
              <a class="knap knap-primaer knap-stor" href={til(lokale ? 'plan' : 'lokale')}>
                {lokale ? 'Videre til første plan' : 'Videre til lokalet'}
              </a>
            </div>
          )}
        </>
      )}

      {fane === 'lokale' && (
        <div>
          <h1>Lokalet for {k.navn}</h1>
          {opsaetning && <p class="daempet">Vælg lokalet, eller byg det. Lokalet huskes, så det kan genbruges af dine andre klasser.</p>}
          <LokaleSkaerm
            key={k.id}
            klasse={k}
            gemTekst={k.planer.length === 0 ? 'Gem lokale og lav første plan' : 'Gem lokale'}
            onGemt={() => {
              if (k.planer.length > 0) visBesked('Lokalet er gemt. Det bruges fra næste plan.');
              gaa('plan');
            }}
          />
        </div>
      )}

      {fane === 'historik' && <HistorikFane key={k.id} klasse={k} />}
    </div>
  );
}
