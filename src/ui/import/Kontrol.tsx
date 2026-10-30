// Kontrolskærmen: ret, fjern eller tilføj navne, og sæt køn med ét tryk.
// Intet gemmes, før læreren trykker på knappen nederst.

import { useRef, useState } from 'preact/hooks';
import { findDubletter, navngivDubletter, rydNavn, udtraekFraLinjer } from '../../core/import';
import { foreslaaKoen } from '../../core/koensgaet';
import { type Koen } from '../../core/model';
import { visBesked } from '../../app/tilstand';

export interface KontrolRaekke {
  noegle: string;
  /** Sat, hvis eleven allerede findes i klassen. */
  elevId?: string;
  navn: string;
  koen: Koen;
  /** Køn kunne ikke afgøres ud fra navnet, så læreren skal tage stilling. */
  tjekKoen?: boolean;
  /** Grundforløbshold, fx "GF02". */
  hold?: string;
}

let taeller = 0;
export function nyNoegle(): string {
  return `r${++taeller}`;
}

interface Props {
  raekker: KontrolRaekke[];
  setRaekker: (fn: (r: KontrolRaekke[] | null) => KontrolRaekke[]) => void;
  resultat: { fundet: number; sprungetOver: number; gaettet: number; tvivl: number } | null;
  gemTekst: (antal: number) => string;
  onHentFlere: () => void;
  onGem: (r: KontrolRaekke[]) => void;
}

export function Kontrol(props: Props) {
  const { raekker, setRaekker } = props;
  const [nyt, setNyt] = useState('');
  const [gemFejl, setGemFejl] = useState<string | null>(null);
  const listeRef = useRef<HTMLOListElement>(null);

  const navne = raekker.map((r) => r.navn);
  const dubletter = findDubletter(navne);
  const piger = raekker.filter((r) => r.koen === 'P').length;
  const drenge = raekker.filter((r) => r.koen === 'D').length;
  const udenKoen = raekker.length - piger - drenge;

  function opdater(noegle: string, ændring: Partial<KontrolRaekke>) {
    setRaekker((r) => (r ?? []).map((x) => (x.noegle === noegle ? { ...x, ...ændring } : x)));
    setGemFejl(null);
  }

  function fjern(i: number) {
    const fjernet = raekker[i]!;
    setRaekker((r) => (r ?? []).filter((x) => x.noegle !== fjernet.noegle));
    visBesked(`${fjernet.navn || 'Tom linje'} er fjernet fra listen.`, () =>
      setRaekker((r) => {
        const kopi = [...(r ?? [])];
        kopi.splice(Math.min(i, kopi.length), 0, fjernet);
        return kopi;
      }),
    );
    // Flyt fokus til næste række, så tastaturbrugere ikke mister deres plads.
    requestAnimationFrame(() => {
      const felter = listeRef.current?.querySelectorAll<HTMLInputElement>('input[type="text"]');
      felter?.[Math.min(i, felter.length - 1)]?.focus();
    });
  }

  function tilfoej() {
    const u = udtraekFraLinjer(nyt);
    if (u.elever.length === 0) return;
    const navngivet = navngivDubletter(u.elever);
    setRaekker((r) => [...(r ?? []), ...medKoensforslag(navngivet.map((n, i) => ({ noegle: nyNoegle(), navn: n.navn, koen: u.elever[i]!.koen }))).raekker]);
    setNyt('');
  }

  function gem() {
    const rensede = raekker.map((r) => ({ ...r, navn: rydNavn(r.navn) })).filter((r) => r.navn !== '');
    if (rensede.length === 0) {
      setGemFejl('Listen er tom. Tilføj mindst én elev.');
      return;
    }
    const d = findDubletter(rensede.map((r) => r.navn));
    if (d.size > 0) {
      const foerste = [...d][0]!;
      const n = rensede[foerste]!.navn;
      setGemFejl(`"${n}" kan ikke skelnes fra en anden elev. Tilføj forbogstavet i efternavnet, fx "${n.replace(/ \p{L}{1,2}\.$/u, '')} H.".`);
      const idx = raekker.findIndex((r) => r.noegle === rensede[foerste]!.noegle);
      listeRef.current?.querySelectorAll<HTMLInputElement>('input[type="text"]')[idx]?.focus();
      return;
    }
    props.onGem(rensede);
  }

  return (
    <section class="kort" aria-labelledby="kontrol-titel">
      <h2 id="kontrol-titel">Tjek navnene</h2>
      {props.resultat && (
        <p class="meddelelse meddelelse-ok" role="status">
          Fandt {props.resultat.fundet} {props.resultat.fundet === 1 ? 'navn' : 'navne'}.
          {props.resultat.sprungetOver > 0 &&
            ` ${props.resultat.sprungetOver} ${props.resultat.sprungetOver === 1 ? 'linje' : 'linjer'} med overskrifter, numre og lignende blev sprunget over.`}
          {props.resultat.gaettet > 0 && ` Køn er sat ud fra navnet ved ${props.resultat.gaettet}.`}
        </p>
      )}
      {raekker.some((r) => r.tjekKoen && !r.koen) && (
        <p class="meddelelse meddelelse-bemaerk">
          Køn kunne ikke afgøres ud fra navnet ved{' '}
          {raekker
            .filter((r) => r.tjekKoen && !r.koen)
            .map((r) => r.navn)
            .join(', ')}
          . De er markeret herunder. Tryk P eller D.
        </p>
      )}
      <p class="daempet">
        Ret navnene, hvis noget er forkert. Køn er foreslået ud fra navnet; tryk P for pige eller D for dreng for at rette. Kønnet
        bruges kun til at blande bordene. Kun fornavnet gemmes.
      </p>
      <p class="opsummering" aria-live="polite">
        <span>
          <strong>{raekker.length}</strong> elever
        </span>
        <span>
          <strong>{piger}</strong> piger
        </span>
        <span>
          <strong>{drenge}</strong> drenge
        </span>
        {udenKoen > 0 && (
          <span>
            <strong>{udenKoen}</strong> mangler køn
          </span>
        )}
      </p>

      <ol class="kontrolliste" ref={listeRef}>
        {raekker.map((r, i) => {
          const dublet = dubletter.has(i);
          const fejlId = `dublet-${r.noegle}`;
          const tjek = !!r.tjekKoen && !r.koen;
          return (
            <li key={r.noegle}>
              <span class="nr" aria-hidden="true">
                {i + 1}
              </span>
              <span class="navnfelt">
              <input
                type="text"
                value={r.navn}
                aria-label={`Navn, elev ${i + 1}`}
                aria-invalid={dublet}
                aria-describedby={dublet ? fejlId : undefined}
                autocomplete="off"
                spellcheck={false}
                onInput={(e) => opdater(r.noegle, { navn: e.currentTarget.value })}
              />
              {r.hold && <span class="hold-maerke" title="Grundforløbshold">{r.hold}</span>}
              </span>
              <span
                class={`koenvalg${tjek ? ' tjek' : ''}`}
                role="group"
                aria-label={`Køn for ${r.navn || `elev ${i + 1}`}${tjek ? ', skal vælges' : ''}`}
              >
                <button type="button" aria-pressed={r.koen === 'P'} aria-label="Pige" title="Pige" onClick={() => opdater(r.noegle, { koen: r.koen === 'P' ? null : 'P' })}>
                  P
                </button>
                <button type="button" aria-pressed={r.koen === 'D'} aria-label="Dreng" title="Dreng" onClick={() => opdater(r.noegle, { koen: r.koen === 'D' ? null : 'D' })}>
                  D
                </button>
              </span>
              <button type="button" class="knap knap-tekst fjern" aria-label={`Fjern ${r.navn || `elev ${i + 1}`}`} onClick={() => fjern(i)}>
                Fjern
              </button>
              {tjek && <p class="tjek-tekst">Vælg køn. Navnet siger ikke sikkert, om det er en pige eller en dreng.</p>}
              {dublet && (
                <p class="feltfejl" id={fejlId}>
                  Der er flere, der hedder {r.navn.trim()}. Tilføj forbogstav i efternavnet, fx "{r.navn.trim()} H."
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <form
        class="raekke"
        style={{ marginTop: '1rem', alignItems: 'end' }}
        onSubmit={(e) => {
          e.preventDefault();
          tilfoej();
        }}
      >
        <div style={{ flex: '1 1 14rem' }}>
          <label for="ny-elev">Tilføj elev</label>
          <input id="ny-elev" type="text" value={nyt} placeholder="Fx Ida P" autocomplete="off" onInput={(e) => setNyt(e.currentTarget.value)} />
        </div>
        <button class="knap" type="submit">
          Tilføj
        </button>
        <button class="knap knap-tekst" type="button" onClick={props.onHentFlere}>
          Hent flere fra en liste
        </button>
      </form>

      <div class="handlingsbar">
        {gemFejl && (
          <p class="feltfejl" role="alert">
            {gemFejl}
          </p>
        )}
        <button class="knap knap-primaer knap-stor" type="button" onClick={gem}>
          {props.gemTekst(raekker.filter((r) => r.navn.trim()).length)}
        </button>
        {udenKoen > 0 && <span class="daempet">Køn kan også sættes senere.</span>}
      </div>
    </section>
  );
}

/** Foreslår køn ud fra navnet ved rækker uden køn og markerer dem, der ikke kan afgøres. */
export function medKoensforslag(raekker: KontrolRaekke[]) {
  const r = foreslaaKoen(raekker);
  return { ...r, raekker: r.raekker.map((x) => (x.koen ? x : { ...x, tjekKoen: true })) };
}
