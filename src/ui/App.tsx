import { useState } from 'preact/hooks';
import { type Klasse, nyId, nyKlasse } from '../core/model';
import { harLagerFejl, opdater, useData } from '../app/tilstand';
import { Beskeder, Trinviser } from './Faelles';
import { Import } from './import/Import';
import { type KontrolRaekke } from './import/Kontrol';

export function App() {
  const data = useData();
  const [nyKlasseAaben, setNyKlasseAaben] = useState(false);
  const aktiv = data.klasser.find((k) => k.id === data.aktivKlasseId) ?? data.klasser[0] ?? null;

  let indhold;
  if (nyKlasseAaben) {
    indhold = <NyKlasse onFaerdig={() => setNyKlasseAaben(false)} kanAnnullere={data.klasser.length > 0} />;
  } else if (!aktiv) {
    indhold = <Velkomst onStart={() => setNyKlasseAaben(true)} />;
  } else {
    indhold = <KlasseVisning klasse={aktiv} />;
  }

  return (
    <>
      <a class="spring-til" href="#indhold">
        Spring til indhold
      </a>
      <header class="topbjaelke">
        <div class="topbjaelke-indre">
          <span class="logo">Pladsrokaden</span>
          {data.klasser.length > 0 && !nyKlasseAaben && (
            <div class="klassevaelger">
              <label for="klassevalg" class="skjult">
                Klasse
              </label>
              <select
                id="klassevalg"
                value={aktiv?.id}
                onChange={(e) => {
                  const id = e.currentTarget.value;
                  opdater((d) => void (d.aktivKlasseId = id));
                }}
              >
                {data.klasser.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.navn}
                  </option>
                ))}
              </select>
              <button class="knap" type="button" onClick={() => setNyKlasseAaben(true)}>
                Ny klasse
              </button>
            </div>
          )}
        </div>
      </header>
      <main id="indhold" tabIndex={-1}>
        {harLagerFejl() && (
          <div class="meddelelse meddelelse-fejl" role="alert">
            Browseren vil ikke gemme dine data (måske et privat vindue, eller lagerpladsen er fuld). Gem en sikkerhedskopi, før du
            lukker siden.
          </div>
        )}
        {indhold}
      </main>
      <Beskeder />
    </>
  );
}

function Velkomst(props: { onStart: () => void }) {
  return (
    <section class="smal">
      <h1>Bordplaner, der skifter retfærdigt</h1>
      <p>Pladsrokaden laver en ny bordplan til din klasse på et øjeblik. Hver gang sørger den for, at</p>
      <ul>
        <li>eleverne får nye sidemakkere,</li>
        <li>alle skiftes til at sidde forrest,</li>
        <li>kønnene blandes ved bordene.</li>
      </ul>
      <p>Alt bliver på din egen computer. Intet sendes nogen steder hen.</p>
      <button class="knap knap-primaer knap-stor" type="button" onClick={props.onStart}>
        Opret din første klasse
      </button>
    </section>
  );
}

function NyKlasse(props: { onFaerdig: () => void; kanAnnullere: boolean }) {
  const [navn, setNavn] = useState('');
  const [navnFejl, setNavnFejl] = useState<string | null>(null);

  function gem(raekker: KontrolRaekke[]) {
    const klasse = nyKlasse(
      navn.trim(),
      raekker.map((r) => ({ id: nyId(), navn: r.navn, koen: r.koen })),
    );
    opdater((d) => {
      d.klasser.push(klasse);
      d.aktivKlasseId = klasse.id;
    });
    props.onFaerdig();
  }

  return (
    <div class="smal">
      <Trinviser aktuelt={1} />
      <h1>Ny klasse</h1>
      <div class="kort">
        <label for="klassenavn">Hvad hedder klassen?</label>
        <input
          id="klassenavn"
          type="text"
          value={navn}
          placeholder="Fx 1.a"
          autocomplete="off"
          aria-invalid={!!navnFejl}
          aria-describedby={navnFejl ? 'klassenavn-fejl' : undefined}
          onInput={(e) => {
            setNavn(e.currentTarget.value);
            setNavnFejl(null);
          }}
          style={{ maxWidth: '16rem' }}
        />
        {navnFejl && (
          <p class="feltfejl" id="klassenavn-fejl">
            {navnFejl}
          </p>
        )}
      </div>
      <Import
        gemTekst={(n) => `Gem ${n} ${n === 1 ? 'elev' : 'elever'} og fortsæt`}
        foerGem={() => {
          if (navn.trim()) return true;
          setNavnFejl('Skriv klassens navn, fx 1.a.');
          document.getElementById('klassenavn')?.focus();
          return false;
        }}
        onGem={gem}
        onAnnuller={props.kanAnnullere ? props.onFaerdig : undefined}
      />
    </div>
  );
}

function KlasseVisning(props: { klasse: Klasse }) {
  const k = props.klasse;
  if (!k.lokale) {
    return (
      <div class="smal">
        <Trinviser aktuelt={2} />
        <h1>Lokalet</h1>
        <p class="daempet">
          {k.navn} har {k.elever.length} elever. Opsætning af lokalet kommer i næste version.
        </p>
      </div>
    );
  }
  return <p>Planvisning kommer i næste version.</p>;
}
