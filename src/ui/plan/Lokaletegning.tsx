// Tegning af lokalet med tavlen øverst. Bruges til forhåndsvisning,
// visning af en gemt plan og redigering af en kladde.

import { useEffect, useRef, useState } from 'preact/hooks';
import { type BordProblem } from '../../core/forklaring';
import { type Plads } from '../../core/kladde';
import { type ElevId, type Lokale, type Placering, erForrest } from '../../core/model';
import { antalRaekker } from '../../core/lokale';

export interface Redigering {
  valgt: Plads | null;
  laaste: Set<ElevId>;
  onVaelg: (p: Plads) => void;
  onByt: (a: Plads, b: Plads) => void;
}

interface Props {
  lokale: Lokale;
  placering?: Placering;
  navn?: (id: ElevId) => string;
  problemer?: Record<string, BordProblem[]>;
  redigering?: Redigering;
  /** Skjul navne og vis kun bordenes form (forhåndsvisning af lokalet). */
  kunForm?: boolean;
  /** Ekstra klasse, fx til tavlevisning. */
  klasse?: string;
  /** Skjult overskrift over bordene, så overskrifternes rækkefølge holder. */
  overskrift?: string;
}

export function Lokaletegning(props: Props) {
  const { lokale } = props;
  const kolonner = Math.max(1, ...lokale.borde.map((b) => b.kolonne + 1));
  const raekker = antalRaekker(lokale);
  const [traekFra, setTraekFra] = useState<Plads | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const r = props.redigering;
  const ramme = useRef<HTMLDivElement>(null);
  const [rul, setRul] = useState(false);
  useEffect(() => {
    const el = ramme.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const tjek = () => setRul(el.scrollWidth > el.clientWidth + 2);
    const ro = new ResizeObserver(tjek);
    ro.observe(el);
    tjek();
    return () => ro.disconnect();
  }, [lokale]);

  return (
    <div
      class={`lokale ${props.klasse ?? ''}`}
      ref={ramme}
      role={rul && !props.klasse ? 'region' : undefined}
      aria-label={rul && !props.klasse ? 'Lokalet (kan rulles til siden)' : undefined}
      tabIndex={rul && !props.klasse ? 0 : undefined}
    >
      {props.overskrift && <h2 class="skjult">{props.overskrift}</h2>}
      {rul && <p class="hjaelp rul-hint">Stryg til siden for at se hele lokalet.</p>}
      <div class="tavle" aria-hidden="true">
        Tavle
      </div>
      <div
        class="lokale-gitter"
        style={{ '--kolonner': String(kolonner), '--raekker': String(raekker) }}
      >
        {lokale.borde.map((bord, bi) => {
          const forrest = erForrest(bord, lokale);
          const pladser = props.placering?.[bord.id] ?? new Array(bord.pladser).fill(null);
          const problemer = props.problemer?.[bord.id] ?? [];
          const titelId = `bord-${bord.id}`;
          return (
            <div
              role="group"
              key={bord.id}
              class={`bord${forrest ? ' forrest' : ''}`}
              style={{ gridRow: String(bord.raekke + 1), gridColumn: String(bord.kolonne + 1) }}
              aria-labelledby={titelId}
            >
              <h3 class="bord-titel" id={titelId}>
                Bord {bi + 1}
                {forrest && <span class="maerke-forrest">Forrest</span>}
              </h3>
              <div class={`bord-pladser n${bord.pladser}`}>
                {pladser.map((elevId, pi) => {
                  const p = { bordId: bord.id, plads: pi };
                  const nøgle = `${bord.id}#${pi}`;
                  const navn = elevId && props.navn ? props.navn(elevId) : '';
                  if (props.kunForm) return <div key={pi} class="plads form" aria-hidden="true" />;
                  if (!r) {
                    return (
                      <div key={pi} class={`plads${elevId ? '' : ' tom'}`}>
                        <span class="plads-navn">{navn || <span class="skjult">Tom plads</span>}</span>
                      </div>
                    );
                  }
                  const valgt = r.valgt?.bordId === bord.id && r.valgt.plads === pi;
                  const laast = !!elevId && r.laaste.has(elevId);
                  const beskrivelse = `Bord ${bi + 1}, plads ${pi + 1}: ${navn || 'tom plads'}${laast ? ', låst' : ''}`;
                  return (
                    <div
                      key={pi}
                      class={`plads${elevId ? '' : ' tom'}${valgt ? ' valgt' : ''}${laast ? ' laast' : ''}${over === nøgle ? ' over' : ''}`}
                      onDragOver={(e) => {
                        if (!traekFra) return;
                        e.preventDefault();
                        setOver(nøgle);
                      }}
                      onDragLeave={() => setOver((o) => (o === nøgle ? null : o))}
                      onDrop={(e) => {
                        e.preventDefault();
                        setOver(null);
                        if (traekFra && (traekFra.bordId !== p.bordId || traekFra.plads !== p.plads)) r.onByt(traekFra, p);
                        setTraekFra(null);
                      }}
                    >
                      <button
                        type="button"
                        class="plads-knap"
                        draggable={!!elevId}
                        aria-pressed={valgt}
                        aria-label={beskrivelse}
                        onClick={() => r.onVaelg(p)}
                        onDragStart={(e) => {
                          setTraekFra(p);
                          e.dataTransfer?.setData('text/plain', navn);
                          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setTraekFra(null);
                          setOver(null);
                        }}
                      >
                        {navn || 'Tom'}
                      </button>
                      {laast && (
                        <span class="laas-ikon" title="Låst på pladsen">
                          <LaasIkon laast />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {problemer.length > 0 && (
                <ul class="bord-problemer">
                  {problemer.map((pr, i) => (
                    <li key={i} class={pr.niveau}>
                      {pr.tekst}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LaasIkon(props: { laast: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="10" rx="2" fill={props.laast ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" />
      <path d={props.laast ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}
