// Tegning af lokalet med tavle, mobilskab og borde, som de står. Bruges til
// visning af en gemt plan, redigering af en kladde, tavlevisning og print.
// Netværksgrupper har hver sin farve og et nummer; makkerpar er adskilt af
// en tydelig streg.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Plads } from '../../core/kladde';
import { type ElevId, type Lokale, type Placering, MOBILSKAB, bordBredde, bordHoejde, forresteBorde } from '../../core/model';
import { pladsGrupper, planGrupper } from '../../core/struktur';

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
  redigering?: Redigering;
  /** Ekstra klasse, fx "stor" (tavlevisning) eller "print". */
  klasse?: string;
  /** Pladsens størrelse og største skrift i en given enhed (fx mm til print). Udeladt: beregnes til skærmen. */
  maal?: { u: number; skrift: number; enhed: 'px' | 'mm' };
  /** Skjult overskrift over bordene, så overskrifternes rækkefølge holder. */
  overskrift?: string;
}

export const GRUPPEFARVER = ['#dbe8f7', '#f9dde3', '#dcf1e2', '#fbefc8', '#e8e1f7', '#fde3cf', '#d4f0f2', '#ece9e2', '#f3dcf0', '#e3efcf'];

export function gruppefarve(nr: number): string {
  return GRUPPEFARVER[(nr - 1) % GRUPPEFARVER.length]!;
}

export function Lokaletegning(props: Props) {
  const { lokale } = props;
  const r = props.redigering;
  const placering = props.placering;
  const forrest = useMemo(() => forresteBorde(lokale), [lokale]);
  const grupper = useMemo(() => (placering ? planGrupper(lokale, placering) : []), [lokale, placering]);
  const pladsInfo = useMemo(() => pladsGrupper(grupper), [grupper]);
  const [traekFra, setTraekFra] = useState<Plads | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const ramme = useRef<HTMLDivElement>(null);
  const [rul, setRul] = useState(false);
  const [plads, setPlads] = useState(900);

  // På skærmen fylder lokalet bredden. Hvert navn får den største skrift,
  // der passer i pladsen; kun hvis et navn ville blive under 10 px, bliver
  // lokalet bredere end skærmen.
  const em = laengsteNavn(placering, props.navn);
  let maal = props.maal;
  if (!maal) {
    let u = Math.min(110, Math.floor((plads - 6) / lokale.bredde));
    if ((u - 8) / em < 10) u = Math.ceil(10 * em + 8);
    u = Math.max(u, 50);
    maal = { u, skrift: Math.min(17, u * 0.3), enhed: 'px' };
  }
  const m = maal;
  const rumStil = { '--u': `${m.u}${m.enhed}`, width: `${m.u * lokale.bredde}${m.enhed}`, height: `${m.u * lokale.hoejde}${m.enhed}` };
  const navneskrift = (n: string) => `${Math.min(m.skrift, ((m.u - (m.enhed === 'px' ? 8 : 2)) * 0.97) / navnebredde(n)).toFixed(2)}${m.enhed}`;

  useEffect(() => {
    const el = ramme.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const tjek = () => {
      setPlads(el.clientWidth);
      setRul(el.scrollWidth > el.clientWidth + 2);
    };
    const ro = new ResizeObserver(tjek);
    ro.observe(el);
    tjek();
    return () => ro.disconnect();
  }, [lokale, m.u]);

  const kanRulle = rul && !props.klasse;
  return (
    <div
      class={`lokale ${props.klasse ?? ''}`}
      ref={ramme}
      role={kanRulle ? 'region' : undefined}
      aria-label={kanRulle ? 'Lokalet (kan rulles til siden)' : undefined}
      tabIndex={kanRulle ? 0 : undefined}
    >
      {props.overskrift && <h2 class="skjult">{props.overskrift}</h2>}
      {kanRulle && <p class="hjaelp rul-hint">Stryg til siden for at se hele lokalet.</p>}
      <div class="rum" style={rumStil}>
        <Tavle lokale={lokale} />
        {lokale.mobilskab && (
          <div class="mobilskab" style={pos(lokale.mobilskab.x, lokale.mobilskab.y, MOBILSKAB.bredde, MOBILSKAB.hoejde)}>
            Mobilskab
          </div>
        )}
        {lokale.borde.map((bord, bi) => {
          const pladser = placering?.[bord.id] ?? new Array(bord.pladser).fill(null);
          const erForrest = forrest.has(bord.id);
          return (
            <div
              key={bord.id}
              role="group"
              aria-label={`Bord ${bi + 1}${erForrest ? ', forrest' : ''}`}
              class={`bord${erForrest ? ' forrest' : ''}${bord.lodret ? ' lodret' : ''}`}
              style={pos(bord.x, bord.y, bordBredde(bord), bordHoejde(bord))}
            >
              <span class="bord-nr" aria-hidden="true">
                {bi + 1}
              </span>
              {pladser.map((elevId, pi) => {
                const info = pladsInfo.get(`${bord.id}#${pi}`);
                const navn = elevId && props.navn ? props.navn(elevId) : '';
                const stil = info ? { background: gruppefarve(info.gruppe) } : undefined;
                const kant = info ? `${info.sidstIGruppe ? ' gruppe-slut' : info.sidstIPar ? ' par-slut' : ''}${pi > 0 && erGruppeStart(pladsInfo, bord.id, pi) ? ' gruppe-start' : ''}` : '';
                const maerke = info && erGruppeStart(pladsInfo, bord.id, pi) ? <span class="gruppe-maerke">G{info.gruppe}</span> : null;
                const beskrivelse = `Bord ${bi + 1}, plads ${pi + 1}: ${navn || 'tom plads'}${info ? `, gruppe ${info.gruppe}` : ''}`;
                if (!r) {
                  return (
                    <div key={pi} class={`plads${elevId ? '' : ' tom'}${kant}`} style={stil}>
                      {maerke}
                      <span class="plads-navn" style={navn ? { fontSize: navneskrift(navn) } : undefined}>
                        {navn || <span class="skjult">Tom plads</span>}
                      </span>
                    </div>
                  );
                }
                const p = { bordId: bord.id, plads: pi };
                const nøgle = `${bord.id}#${pi}`;
                const valgt = r.valgt?.bordId === bord.id && r.valgt.plads === pi;
                const laast = !!elevId && r.laaste.has(elevId);
                return (
                  <div
                    key={pi}
                    class={`plads${elevId ? '' : ' tom'}${valgt ? ' valgt' : ''}${laast ? ' laast' : ''}${over === nøgle ? ' over' : ''}${kant}`}
                    style={valgt ? undefined : stil}
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
                    {maerke}
                    <button
                      type="button"
                      class="plads-knap"
                      draggable={!!elevId}
                      aria-pressed={valgt}
                      style={navn ? { fontSize: navneskrift(navn) } : undefined}
                      aria-label={`${beskrivelse}${laast ? ', låst' : ''}`}
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
          );
        })}
      </div>
    </div>
  );
}

type Info = { gruppe: number; par: number; sidstIPar: boolean; sidstIGruppe: boolean };

function erGruppeStart(m: Map<string, Info>, bordId: string, plads: number): boolean {
  const her = m.get(`${bordId}#${plads}`);
  if (!her) return false;
  for (let i = plads - 1; i >= 0; i--) {
    const f = m.get(`${bordId}#${i}`);
    if (f) return f.gruppe !== her.gruppe;
  }
  return true;
}

export function Tavle(props: { lokale: Lokale }) {
  const { tavle, bredde, hoejde } = props.lokale;
  const tyk = 0.55;
  const vandret = tavle.vaeg === 'top' || tavle.vaeg === 'bund';
  const start = tavle.midte - tavle.laengde / 2;
  const stil = vandret
    ? pos(start, tavle.vaeg === 'top' ? 0.2 : hoejde - tyk - 0.2, tavle.laengde, tyk)
    : pos(tavle.vaeg === 'venstre' ? 0.2 : bredde - tyk - 0.2, start, tyk, tavle.laengde);
  return (
    <div class={`tavle${vandret ? '' : ' lodret'}`} style={stil}>
      <span>Tavle</span>
    </div>
  );
}

export function pos(x: number, y: number, b: number, h: number) {
  return {
    left: `calc(var(--u) * ${x})`,
    top: `calc(var(--u) * ${y})`,
    width: `calc(var(--u) * ${b})`,
    height: `calc(var(--u) * ${h})`,
  };
}

let laerred: HTMLCanvasElement | null = null;

/** Bredden af et navn i fed Atkinson Hyperlegible, ved skriftstørrelse 1 (em). */
export function navnebredde(navn: string): number {
  laerred ??= document.createElement('canvas');
  const ctx = laerred.getContext('2d');
  if (!ctx) return navn.length * 0.6;
  ctx.font = `700 100px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  return ctx.measureText(navn).width / 100;
}

export function laengsteNavn(placering: Placering | undefined, navn?: (id: ElevId) => string): number {
  if (!placering || !navn) return 4;
  const navne = Object.values(placering).flat().filter((x): x is string => !!x).map(navn);
  return Math.max(3.5, ...navne.map(navnebredde));
}

export function LaasIkon(props: { laast: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="11" width="14" height="10" rx="2" fill={props.laast ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" />
      <path d={props.laast ? 'M8 11V8a4 4 0 0 1 8 0v3' : 'M8 11V8a4 4 0 0 1 7.5-2'} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  );
}
