// Små fælles komponenter.

import { lukBesked, useBeskeder } from '../app/tilstand';

const TRIN = ['Elever', 'Lokale', 'Første plan'];

export function Trinviser(props: { aktuelt: 1 | 2 | 3 }) {
  return (
    <ol class="trin" aria-label="Kom i gang">
      {TRIN.map((t, i) => {
        const nr = i + 1;
        const status = nr < props.aktuelt ? 'faerdig' : '';
        return (
          <li key={t} class={status} aria-current={nr === props.aktuelt ? 'step' : undefined}>
            {t}
            {nr < props.aktuelt && <span class="skjult"> (færdig)</span>}
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
