import { useEffect, useRef, useState } from 'preact/hooks';
import { planTitel } from '../core/dato';
import { findLokale, nyId, nyKlasse } from '../core/model';
import { type Rute, gaaTil, tilHash, useRute } from '../app/navigation';
import { harLagerFejl, opdater, useData } from '../app/tilstand';
import { Beskeder, Trinviser, useFokusPaaOverskrift } from './Faelles';
import { Import } from './import/Import';
import { type KontrolRaekke } from './import/Kontrol';
import { KlasseVisning } from './Klasse';
import { DataSide } from './DataSide';
import { PrintArk } from './plan/Deling';
import { aabnDemo, gemSikkerhedskopi, hentSikkerhedskopi, sletAlt } from '../app/handlinger';

export function App() {
  const data = useData();
  const rute = useRute();
  const aktiv = data.klasser.find((k) => k.id === data.aktivKlasseId) ?? data.klasser[0] ?? null;

  // Uden adresse åbnes den senest brugte klasse; ellers startsiden.
  let r: Rute = rute ?? (aktiv ? { side: 'klasse', id: aktiv.id, fane: null } : { side: 'start' });
  const klasseId = r.side === 'klasse' ? r.id : null;
  const klasse = klasseId ? data.klasser.find((k) => k.id === klasseId) ?? null : null;
  if (r.side === 'klasse' && !klasse) r = { side: 'start' };

  // Husk den åbne klasse, så appen åbner den næste gang.
  useEffect(() => {
    if (klasse && data.aktivKlasseId !== klasse.id) opdater((d) => void (d.aktivKlasseId = klasse.id));
  }, [klasse?.id]);

  useFokusPaaOverskrift(r.side === 'klasse' ? `klasse-${r.id}` : r.side);

  let indhold;
  if (r.side === 'data') indhold = <DataSide onTilbage={() => history.back()} />;
  else if (r.side === 'ny') indhold = <NyKlasse kanAnnullere={data.klasser.length > 0} />;
  else if (r.side === 'klasse' && klasse) indhold = <KlasseVisning klasse={klasse} fane={r.fane} />;
  else indhold = data.klasser.length === 0 ? <Velkomst /> : <Startside />;

  return (
    <>
      <a class="spring-til" href="#indhold">
        Spring til indhold
      </a>
      <header class="topbjaelke">
        <div class="topbjaelke-indre">
          <a class="logo" href="#/start" aria-label="Pladsrokaden, gå til startsiden">
            Pladsrokaden
          </a>
          {data.klasser.length > 0 && (
            <div class="klassevaelger">
              <label for="klassevalg" class="skjult">
                Klasse
              </label>
              <select
                id="klassevalg"
                value={klasse?.id ?? ''}
                onChange={(e) => {
                  const id = e.currentTarget.value;
                  if (id) gaaTil({ side: 'klasse', id, fane: null });
                }}
              >
                {!klasse && <option value="">Vælg klasse</option>}
                {data.klasser.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.navn}
                  </option>
                ))}
              </select>
              <a class="knap kun-bred" href="#/ny">
                Ny klasse
              </a>
            </div>
          )}
          <Menu harKlasser={data.klasser.length > 0} />
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
      <footer class="sidefod">
        <p>
          Alt gemmes automatisk i denne browser. Intet sendes nogen steder hen. <a href="#/data">Sådan håndteres data</a>
        </p>
      </footer>
      <Beskeder />
      <PrintArk />
    </>
  );
}

/** Startsiden: dine klasser, og hvor langt hver er nået. */
function Startside() {
  const data = useData();
  return (
    <section class="smal">
      <h1>Dine klasser</h1>
      <ul class="klasseliste">
        {data.klasser.map((k) => {
          const lokale = findLokale(data, k);
          const plan = k.planer[k.planer.length - 1];
          const status = !lokale ? 'Mangler lokale' : plan ? `Gældende plan: ${planTitel(plan.dato)}` : 'Mangler første plan';
          return (
            <li key={k.id}>
              <a class="klassekort" href={tilHash({ side: 'klasse', id: k.id, fane: null })}>
                <strong>{k.navn}</strong>
                <span class="daempet">
                  {k.elever.length} elever{lokale?.navn ? `, lokale ${lokale.navn}` : ''}
                </span>
                <span class={plan ? 'daempet' : 'bemaerk-tekst'}>{status}</span>
              </a>
            </li>
          );
        })}
      </ul>
      <div class="raekke">
        <a class="knap knap-primaer knap-stor" href="#/ny">
          Opret ny klasse
        </a>
      </div>
    </section>
  );
}

function Velkomst() {
  return (
    <section class="smal">
      <h1>Bordplaner, der skifter retfærdigt</h1>
      <p>Pladsrokaden laver en ny bordplan til din klasse på et øjeblik. Hver gang sørger den for, at</p>
      <ul>
        <li>eleverne får nye sidemakkere,</li>
        <li>alle skiftes til at sidde forrest,</li>
        <li>kønnene blandes ved bordene.</li>
      </ul>
      <p>
        Alt bliver på din egen computer. Intet sendes nogen steder hen.{' '}
        <a href="#/data">Sådan håndteres data</a>
      </p>
      <div class="raekke">
        <a class="knap knap-primaer knap-stor" href="#/ny">
          Opret din første klasse
        </a>
        <button
          class="knap knap-stor"
          type="button"
          onClick={() => {
            const id = aabnDemo();
            gaaTil({ side: 'klasse', id, fane: null });
          }}
        >
          Se en demoklasse
        </button>
      </div>
      <p class="hjaelp" style={{ marginTop: '1.5rem' }}>
        Har du brugt Pladsrokaden på en anden computer? Vælg "Hent sikkerhedskopi" i menuen øverst til højre.
      </p>
    </section>
  );
}

function NyKlasse(props: { kanAnnullere: boolean }) {
  const [navn, setNavn] = useState('');
  const [navnFejl, setNavnFejl] = useState<string | null>(null);

  function gem(raekker: KontrolRaekke[]) {
    const klasse = nyKlasse(
      navn.trim(),
      raekker.map((r) => ({ id: nyId(), navn: r.navn, koen: r.koen, ...(r.hold ? { hold: r.hold } : {}) })),
    );
    opdater((d) => {
      d.klasser.push(klasse);
      d.aktivKlasseId = klasse.id;
    });
    // Erstat "ny klasse" i historikken, så Tilbage ikke opretter klassen igen.
    gaaTil({ side: 'klasse', id: klasse.id, fane: 'lokale' }, true);
  }

  return (
    <div class="smal">
      <Trinviser
        trin={[
          { navn: 'Elever', faerdig: false, aktuelt: true },
          { navn: 'Lokale', faerdig: false, aktuelt: false },
          { navn: 'Første plan', faerdig: false, aktuelt: false },
        ]}
      />
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
        onAnnuller={props.kanAnnullere ? () => history.back() : undefined}
      />
    </div>
  );
}

function Menu(props: { harKlasser: boolean }) {
  const [aaben, setAaben] = useState(false);
  const rod = useRef<HTMLDivElement>(null);
  const knap = useRef<HTMLButtonElement>(null);
  const fil = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aaben) return;
    const klik = (e: MouseEvent) => {
      if (!rod.current?.contains(e.target as Node)) setAaben(false);
    };
    const tast = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAaben(false);
        knap.current?.focus();
      }
    };
    document.addEventListener('mousedown', klik);
    document.addEventListener('keydown', tast);
    rod.current?.querySelector<HTMLButtonElement>('.menu-liste button')?.focus();
    return () => {
      document.removeEventListener('mousedown', klik);
      document.removeEventListener('keydown', tast);
    };
  }, [aaben]);

  const punkt = (tekst: string, handling: () => void, fare = false, klasse?: string) => (
    <li class={klasse}>
      <button
        type="button"
        class={`knap knap-tekst${fare ? ' knap-fare' : ''}`}
        onClick={() => {
          setAaben(false);
          handling();
        }}
      >
        {tekst}
      </button>
    </li>
  );

  return (
    <div class="menu" ref={rod}>
      <button ref={knap} class="knap" type="button" aria-expanded={aaben} aria-controls="hovedmenu" onClick={() => setAaben(!aaben)}>
        Menu
      </button>
      <input
        ref={fil}
        type="file"
        accept=".json,application/json"
        class="skjult"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (f) void hentSikkerhedskopi(f);
        }}
      />
      {aaben && (
        <ul class="menu-liste" id="hovedmenu">
          {punkt('Startside', () => gaaTil({ side: 'start' }))}
          {props.harKlasser && punkt('Ny klasse', () => gaaTil({ side: 'ny' }), false, 'kun-smal')}
          {props.harKlasser && punkt('Gem sikkerhedskopi', gemSikkerhedskopi)}
          {punkt('Hent sikkerhedskopi', () => fil.current?.click())}
          {punkt('Se demoklassen', () => gaaTil({ side: 'klasse', id: aabnDemo(), fane: null }))}
          {punkt('Sådan håndteres data', () => gaaTil({ side: 'data' }))}
          {props.harKlasser && (
            <>
              <li>
                <hr />
              </li>
              {punkt('Slet alt', sletAlt, true)}
            </>
          )}
        </ul>
      )}
    </div>
  );
}
