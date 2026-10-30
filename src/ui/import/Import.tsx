// Import af elever ad tre veje, som alle ender i samme kontrolskærm.
// Indsat tekst og billeder holdes kun i hukommelsen, indtil navnene er
// udtrukket, og smides derefter væk.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type Udtraek, navngivDubletter, retOcrTekst, udtraekFraLinjer, udtraekFraTekst } from '../../core/import';
import { Kontrol, type KontrolRaekke, nyNoegle } from './Kontrol';
import { findBillede, genkendTekst, type OcrStatus } from './ocr';

type Fane = 'tekst' | 'billede' | 'linjer';

const FANER: { id: Fane; navn: string }[] = [
  { id: 'tekst', navn: 'Indsæt liste' },
  { id: 'billede', navn: 'Skærmbillede' },
  { id: 'linjer', navn: 'Skriv navne' },
];

export interface ImportProps {
  /** Elever, der allerede er på listen (når man tilføjer til en eksisterende klasse). */
  start?: KontrolRaekke[];
  gemTekst: (antal: number) => string;
  /** Kaldes før gem. Returnér false for at stoppe (fx manglende klassenavn). */
  foerGem?: () => boolean;
  onGem: (raekker: KontrolRaekke[]) => void;
  onAnnuller?: () => void;
}

export function Import(props: ImportProps) {
  const [raekker, setRaekker] = useState<KontrolRaekke[] | null>(props.start && props.start.length > 0 ? props.start : null);
  const [resultat, setResultat] = useState<{ fundet: number; sprungetOver: number } | null>(null);
  const [henter, setHenter] = useState(raekker === null);

  function modtag(u: Udtraek) {
    const nye: KontrolRaekke[] = navngivDubletter(u.elever).map((n, i) => ({
      noegle: nyNoegle(),
      navn: n.navn,
      koen: u.elever[i]!.koen,
    }));
    setRaekker((gamle) => [...(gamle ?? []), ...nye]);
    setResultat({ fundet: nye.length, sprungetOver: u.sprungetOver });
    setHenter(false);
  }

  if (henter || raekker === null) {
    return (
      <Hent
        onUdtraek={modtag}
        onTilbage={raekker ? () => setHenter(false) : props.onAnnuller}
        tilbageTekst={raekker ? 'Tilbage til listen' : 'Annuller'}
      />
    );
  }
  return (
    <Kontrol
      raekker={raekker}
      setRaekker={setRaekker}
      resultat={resultat}
      gemTekst={props.gemTekst}
      onHentFlere={() => {
        setResultat(null);
        setHenter(true);
      }}
      onGem={(r) => {
        if (props.foerGem && !props.foerGem()) return;
        props.onGem(r);
      }}
    />
  );
}

// ----------------------------------------------------------------------

function Hent(props: { onUdtraek: (u: Udtraek) => void; onTilbage?: () => void; tilbageTekst: string }) {
  const [fane, setFane] = useState<Fane>('tekst');
  const [fejl, setFejl] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrStatus | null>(null);
  const [billedUrl, setBilledUrl] = useState<string | null>(null);
  const faneRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function udtraek(u: Udtraek, kilde: Fane) {
    if (u.elever.length === 0) {
      setFejl(
        kilde === 'billede'
          ? 'Der blev ikke fundet nogen navne i billedet. Prøv et skarpere skærmbillede, hvor navnene fylder mere, eller brug "Indsæt liste".'
          : kilde === 'linjer'
            ? 'Der er ingen navne endnu. Skriv ét navn pr. linje.'
            : 'Der blev ikke fundet nogen navne i teksten. Prøv at kopiere hele listen igen, eller skriv navnene ét pr. linje under "Skriv navne".',
      );
      return;
    }
    setFejl(null);
    props.onUdtraek(u);
  }

  async function laesBillede(fil: Blob) {
    setFane('billede');
    setFejl(null);
    const url = URL.createObjectURL(fil);
    setBilledUrl(url);
    try {
      const tekst = await genkendTekst(fil, setOcr);
      udtraek(udtraekFraTekst(retOcrTekst(tekst)), 'billede');
    } catch {
      setFejl('Billedet kunne ikke læses. Prøv et andet billede, eller brug "Indsæt liste".');
    } finally {
      // Billedet glemmes, så snart teksten er læst.
      URL.revokeObjectURL(url);
      setBilledUrl(null);
      setOcr(null);
    }
  }

  // Ctrl+V virker overalt på siden: et billede læses, tekst udtrækkes.
  useEffect(() => {
    const ved = (e: ClipboardEvent) => {
      if (ocr) return;
      const mål = e.target as HTMLElement | null;
      if (mål?.id === 'linjer-felt') return; // "Skriv navne" bruger almindelig indsætning
      const billede = findBillede(e.clipboardData);
      if (billede) {
        e.preventDefault();
        void laesBillede(billede);
        return;
      }
      const tekst = tekstFraUdklip(e.clipboardData);
      if (tekst.trim()) {
        e.preventDefault();
        setFane('tekst');
        udtraek(udtraekFraTekst(tekst), 'tekst');
      }
    };
    document.addEventListener('paste', ved);
    return () => document.removeEventListener('paste', ved);
  });

  function tastFane(e: KeyboardEvent, i: number) {
    const n = FANER.length;
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % n;
    else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = n - 1;
    if (j >= 0) {
      e.preventDefault();
      setFane(FANER[j]!.id);
      setFejl(null);
      faneRefs.current[j]?.focus();
    }
  }

  return (
    <section class="kort" aria-labelledby="hent-titel">
      <h2 id="hent-titel">Hvem går i klassen?</h2>
      <p class="daempet">Vælg den måde, der er nemmest for dig. Du kan rette navnene bagefter.</p>
      <div class="faner" role="tablist" aria-label="Måde at hente elever på">
        {FANER.map((f, i) => (
          <button
            key={f.id}
            ref={(el) => {
              faneRefs.current[i] = el;
            }}
            class="fane"
            role="tab"
            id={`fane-${f.id}`}
            aria-selected={fane === f.id}
            aria-controls={`panel-${f.id}`}
            tabIndex={fane === f.id ? 0 : -1}
            onClick={() => {
              setFane(f.id);
              setFejl(null);
            }}
            onKeyDown={(e) => tastFane(e, i)}
          >
            {f.navn}
          </button>
        ))}
      </div>

      {fejl && (
        <div class="meddelelse meddelelse-fejl" role="alert">
          {fejl}
        </div>
      )}

      <div role="tabpanel" id={`panel-${fane}`} aria-labelledby={`fane-${fane}`}>
        {fane === 'tekst' && <TekstPanel onTekst={(t) => udtraek(udtraekFraTekst(t), 'tekst')} />}
        {fane === 'billede' && <BilledPanel ocr={ocr} billedUrl={billedUrl} onBillede={laesBillede} />}
        {fane === 'linjer' && <LinjePanel onTekst={(t) => udtraek(udtraekFraLinjer(t), 'linjer')} />}
      </div>

      {props.onTilbage && (
        <p style={{ marginTop: '1rem', marginBottom: 0 }}>
          <button class="knap knap-tekst" type="button" onClick={props.onTilbage}>
            {props.tilbageTekst}
          </button>
        </p>
      )}
    </section>
  );
}

function TekstPanel(props: { onTekst: (t: string) => void }) {
  const [tekst, setTekst] = useState('');
  return (
    <div class="stak">
      <ol class="hjaelp" style={{ paddingLeft: '1.25rem' }}>
        <li>Åbn klasselisten i Ludus eller Lectio.</li>
        <li>Markér det hele med Ctrl+A (Cmd+A på Mac), og kopiér med Ctrl+C.</li>
        <li>Klik i feltet herunder, og indsæt med Ctrl+V. Appen finder selv fornavnene.</li>
      </ol>
      <div>
        <label for="tekst-felt">Klasselisten</label>
        <textarea
          id="tekst-felt"
          value={tekst}
          onInput={(e) => setTekst(e.currentTarget.value)}
          placeholder="Indsæt hele listen her. Overskrifter, numre og e-mails bliver sorteret fra."
          spellcheck={false}
          autocomplete="off"
        />
      </div>
      <button
        class="knap knap-primaer"
        type="button"
        onClick={() => {
          props.onTekst(tekst);
          setTekst('');
        }}
      >
        Find navne
      </button>
    </div>
  );
}

function BilledPanel(props: { ocr: OcrStatus | null; billedUrl: string | null; onBillede: (f: Blob) => void }) {
  const [over, setOver] = useState(false);
  const filRef = useRef<HTMLInputElement>(null);
  const { ocr } = props;
  return (
    <div class="stak">
      <p class="lokalt">Billedet behandles kun på din computer</p>
      <p class="hjaelp">
        Tag et skærmbillede af klasselisten, og indsæt det med Ctrl+V. Du kan også trække billedet herind. Billedet sendes ikke
        nogen steder hen og gemmes ikke.
      </p>
      <div
        class={`slip${over ? ' aktiv' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = findBillede(e.dataTransfer);
          if (f) props.onBillede(f);
        }}
      >
        {ocr ? (
          <div class="stak" aria-live="polite">
            {props.billedUrl && <img class="forhaandsvisning" src={props.billedUrl} alt="Skærmbilledet, der læses" />}
            <p style={{ margin: 0 }}>
              {ocr.tekst}
              {ocr.andel !== null && ` ${Math.round(ocr.andel * 100)} %`}
            </p>
            <progress max={1} value={ocr.andel ?? undefined} aria-label="Fremskridt for tekstgenkendelse" />
          </div>
        ) : (
          <div class="stak">
            <p style={{ margin: 0 }}>
              <strong>Indsæt (Ctrl+V) eller træk et billede herind</strong>
            </p>
            <div>
              <button class="knap" type="button" onClick={() => filRef.current?.click()}>
                Vælg billede
              </button>
              <input
                ref={filRef}
                type="file"
                accept="image/*"
                class="skjult"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  e.currentTarget.value = '';
                  if (f) props.onBillede(f);
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LinjePanel(props: { onTekst: (t: string) => void }) {
  const [tekst, setTekst] = useState('');
  return (
    <div class="stak">
      <div>
        <label for="linjer-felt">Ét navn pr. linje</label>
        <p class="hjaelp" id="linjer-hjaelp">
          Skriv P (pige) eller D (dreng) efter navnet, hvis du vil. Fx "Ida P".
        </p>
        <textarea
          id="linjer-felt"
          aria-describedby="linjer-hjaelp"
          value={tekst}
          onInput={(e) => setTekst(e.currentTarget.value)}
          placeholder={'Ida P\nMalte D\nSara'}
          spellcheck={false}
          autocomplete="off"
        />
      </div>
      <button
        class="knap knap-primaer"
        type="button"
        onClick={() => {
          props.onTekst(tekst);
          setTekst('');
        }}
      >
        Fortsæt
      </button>
    </div>
  );
}

/**
 * Læser tekst fra udklipsholderen. Er der en HTML-tabel (kopieret fra en
 * webside), laves den om til tabulator-adskilte rækker, som giver det
 * sikreste udtræk. HTML'en fortolkes inaktivt: intet hentes eller køres.
 */
export function tekstFraUdklip(data: DataTransfer | null): string {
  if (!data) return '';
  const html = data.getData('text/html');
  if (html && /<t[dh][\s>]/i.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const raekker = Array.from(doc.querySelectorAll('tr'));
    if (raekker.length > 0) {
      return raekker
        .map((tr) =>
          Array.from(tr.querySelectorAll('td, th'))
            .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
            .join('\t'),
        )
        .join('\n');
    }
  }
  return data.getData('text/plain');
}
