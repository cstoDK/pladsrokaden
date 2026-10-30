// Klassens skærm. Første gang guides læreren gennem tre trin; derefter
// åbner klassen på den gældende plan med fanerne Plan, Elever og Lokale.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Klasse } from '../core/model';
import { opdaterKlasse, visBesked } from '../app/tilstand';
import { EleverFane } from './elever/EleverFane';
import { HistorikFane } from './historik/HistorikFane';
import { Trinviser, useFokusPaaOverskrift } from './Faelles';
import { LokaleEditor } from './lokale/LokaleEditor';
import { PlanFane } from './plan/PlanFane';

type Fane = 'plan' | 'elever' | 'lokale' | 'historik';
const FANER: { id: Fane; navn: string }[] = [
  { id: 'plan', navn: 'Plan' },
  { id: 'elever', navn: 'Elever' },
  { id: 'lokale', navn: 'Lokale' },
  { id: 'historik', navn: 'Historik' },
];

export function KlasseVisning(props: { klasse: Klasse }) {
  const k = props.klasse;
  const [fane, setFane] = useState<Fane>('plan');
  const forrigeKlasse = useRef(k.id);
  useEffect(() => {
    if (forrigeKlasse.current !== k.id) {
      forrigeKlasse.current = k.id;
      setFane('plan');
    }
  }, [k.id]);

  const trin = !k.lokale ? 'lokale' : k.planer.length === 0 ? 'foerste' : 'faner';
  useFokusPaaOverskrift(`${k.id}|${trin}|${fane}|${k.planer.length}`);

  // Trin 2: lokalet
  if (!k.lokale) {
    return (
      <div>
        <Trinviser aktuelt={2} />
        <h1>Lokalet for {k.navn}</h1>
        <p class="daempet">Vælg den opstilling, der ligner jeres lokale mest. Du kan altid ændre den senere.</p>
        <LokaleEditor
          klasse={k}
          gemTekst="Gem lokale og lav første plan"
          onGem={(lokale) => opdaterKlasse(k.id, (x) => void (x.lokale = lokale))}
        />
      </div>
    );
  }

  // Trin 3: første plan
  if (k.planer.length === 0) {
    return (
      <div>
        <Trinviser aktuelt={3} />
        <PlanFane klasse={k} foersteGang onRetLokale={() => opdaterKlasse(k.id, (x) => void (x.lokale = null))} />
      </div>
    );
  }

  return (
    <div>
      {k.erDemo && (
        <p class="demo-banner">
          Eleverne i demoklassen er opdigtede. Prøv at lave en ny plan og flytte rundt. Du kan slette klassen under Elever.
        </p>
      )}
      <nav class="faner" aria-label={`Klasse ${k.navn}`}>
        {FANER.map((f) => (
          <button key={f.id} type="button" class="fane" aria-current={fane === f.id ? 'page' : undefined} onClick={() => setFane(f.id)}>
            {f.navn}
          </button>
        ))}
      </nav>
      {fane === 'plan' && k.elever.length === 0 && (
        <section class="kort smal">
          <h1>{k.navn} har ingen elever endnu</h1>
          <p>Start med at tilføje klassens elever. Så kan du lave en plan bagefter.</p>
          <button class="knap knap-primaer knap-stor" type="button" onClick={() => setFane('elever')}>
            Tilføj elever
          </button>
        </section>
      )}
      {fane === 'plan' && k.elever.length > 0 && <PlanFane key={k.id} klasse={k} onRetLokale={() => setFane('lokale')} />}
      {fane === 'elever' && <EleverFane key={k.id} klasse={k} />}
      {fane === 'historik' && <HistorikFane key={k.id} klasse={k} />}
      {fane === 'lokale' && (
        <div>
          <h1>Lokalet for {k.navn}</h1>
          <LokaleEditor
            key={k.id}
            klasse={k}
            gemTekst="Gem lokale"
            onGem={(lokale) => {
              opdaterKlasse(k.id, (x) => {
                x.lokale = lokale;
                x.kladde = null;
              });
              visBesked('Lokalet er gemt. Det bruges fra næste plan.');
              setFane('plan');
            }}
          />
        </div>
      )}
    </div>
  );
}
