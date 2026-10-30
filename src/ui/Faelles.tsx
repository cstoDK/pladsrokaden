// Små fælles komponenter.

import { useEffect, useRef } from 'preact/hooks';
import { lukBesked, useBeskeder } from '../app/tilstand';

/**
 * Flytter fokus til skærmens overskrift, når `noegle` skifter (fx nyt trin),
 * så tastatur- og skærmlæserbrugere starter øverst på den nye skærm.
 */
export function useFokusPaaOverskrift(noegle: string) {
  const foerste = useRef(true);
  useEffect(() => {
    // Ikke ved første visning: så starter tastaturet ved "Spring til indhold" som normalt.
    if (foerste.current) {
      foerste.current = false;
      return;
    }
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (!h1 || document.activeElement === h1) return;
    // Kun når fokus er gået tabt (fx fordi knappen, man trykkede på, forsvandt).
    const aktiv = document.activeElement;
    if (aktiv && aktiv !== document.body && document.contains(aktiv)) return;
    h1.tabIndex = -1;
    h1.focus();
  }, [noegle]);
}

export interface Trin {
  navn: string;
  faerdig: boolean;
  aktuelt: boolean;
  /** Udeladt: trinnet kan ikke vælges (fx "Elever" på skærmen "Ny klasse"). */
  href?: string;
}

/** Trinene i opsætningen. Trinene er links, så man kan gå frem og tilbage. */
export function Trinviser(props: { trin: Trin[] }) {
  return (
    <ol class="trin" aria-label="Kom i gang">
      {props.trin.map((t) => {
        const tekst = (
          <>
            {t.navn}
            {t.faerdig && <span class="skjult"> (færdig)</span>}
          </>
        );
        return (
          <li key={t.navn} class={t.faerdig ? 'faerdig' : ''} aria-current={t.aktuelt ? 'step' : undefined}>
            {t.href && !t.aktuelt ? <a href={t.href}>{tekst}</a> : tekst}
          </li>
        );
      })}
    </ol>
  );
}

export function Beskeder() {
  const beskeder = useBeskeder();
  return (
    <div class="beskeder" role="status" aria-live="polite">
      {beskeder.map((b) => (
        <div class="besked" key={b.id}>
          <span>{b.tekst}</span>
          {b.fortryd && (
            <button
              class="knap"
              type="button"
              onClick={() => {
                b.fortryd!();
                lukBesked(b.id);
              }}
            >
              Fortryd
            </button>
          )}
          <button class="knap luk" type="button" aria-label="Luk besked" onClick={() => lukBesked(b.id)}>
            Luk
          </button>
        </div>
      ))}
    </div>
  );
}
