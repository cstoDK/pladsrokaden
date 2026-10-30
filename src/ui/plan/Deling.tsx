// Deling af en gemt plan: udskriv / PDF, kopiér som tekst og vis på tavlen.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { planTitel } from '../../core/dato';
import { planSomTekst } from '../../core/deling';
import { type Klasse, type Plan } from '../../core/model';
import { hentUdskrift, kopierTekst, lytTilUdskrift, nulstilUdskrift, udskriv } from '../../app/handlinger';
import { hentData, visBesked } from '../../app/tilstand';
import { Lokaletegning } from './Lokaletegning';

function navneOpslag(k: Klasse) {
  const m = new Map(k.elever.map((e) => [e.id, e.navn]));
  return (id: string) => m.get(id) ?? '';
}

export function DelKnapper(props: { klasse: Klasse; plan: Plan }) {
  const [tavle, setTavle] = useState(false);
  const { klasse, plan } = props;
  return (
    <>
      <div class="vaerktoejer" role="group" aria-label="Del planen">
        <button class="knap" type="button" onClick={() => udskriv(klasse, plan)}>
          Udskriv / gem som PDF
        </button>
        <button
          class="knap"
          type="button"
          onClick={async () => {
            const ok = await kopierTekst(planSomTekst(klasse.navn, plan, navneOpslag(klasse)));
            visBesked(ok ? 'Planen er kopieret som tekst. Indsæt den fx i Teams eller Ludus.' : 'Planen kunne ikke kopieres. Brug "Udskriv / gem som PDF" i stedet.');
          }}
        >
          Kopiér som tekst
        </button>
        <button class="knap" type="button" onClick={() => setTavle(true)}>
          Vis på tavlen
        </button>
      </div>
      {tavle && <Tavlevisning klasse={klasse} plan={plan} onLuk={() => setTavle(false)} />}
    </>
  );
}

/** Fuldskærm til projektor. Esc eller "Luk" lukker. */
function Tavlevisning(props: { klasse: Klasse; plan: Plan; onLuk: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lukRef = useRef<HTMLButtonElement>(null);
  const navn = useMemo(() => navneOpslag(props.klasse), [props.klasse]);
  const [skrift, setSkrift] = useState(() => tavleSkrift(props.plan, navn, window.innerWidth, window.innerHeight));

  useEffect(() => {
    const ny = () => setSkrift(tavleSkrift(props.plan, navn, window.innerWidth, window.innerHeight));
    window.addEventListener('resize', ny);
    return () => window.removeEventListener('resize', ny);
  }, [props.plan, navn]);

  useEffect(() => {
    const forrige = document.activeElement as HTMLElement | null;
    lukRef.current?.focus();
    ref.current?.requestFullscreen?.().catch(() => undefined);
    const ved = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onLuk();
    };
    const fuld = () => {
      if (!document.fullscreenElement) props.onLuk();
    };
    document.addEventListener('keydown', ved);
    document.addEventListener('fullscreenchange', fuld);
    document.body.classList.add('tavle-aaben');
    return () => {
      document.removeEventListener('keydown', ved);
      document.removeEventListener('fullscreenchange', fuld);
      document.body.classList.remove('tavle-aaben');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      forrige?.focus();
    };
  }, []);

  return (
    <div class="tavlevisning" ref={ref} style={{ '--tavle-skrift': `${skrift}px` }} role="dialog" aria-modal="true" aria-label={`Bordplan for ${props.klasse.navn} på tavlen`}>
      <div class="tavlevisning-hoved">
        <h2>
          {props.klasse.navn} <span class="daempet">{planTitel(props.plan.dato)}</span>
        </h2>
        <button ref={lukRef} class="knap" type="button" onClick={props.onLuk}>
          Luk (Esc)
        </button>
      </div>
      <Lokaletegning lokale={props.plan.lokale} placering={props.plan.placering} navn={navn} klasse="stor" />
    </div>
  );
}

/** Arket, der kommer på papir. Usynligt på skærmen. */
export function PrintArk() {
  const [, saet] = useState(0);
  useEffect(() => {
    const af = lytTilUdskrift(() => saet((x) => x + 1));
    const efter = () => nulstilUdskrift();
    window.addEventListener('afterprint', efter);
    return () => {
      af();
      window.removeEventListener('afterprint', efter);
    };
  }, []);
  // Uden valgt plan (fx Ctrl+P) udskrives den aktive klasses gældende plan.
  let valg = hentUdskrift();
  if (!valg) {
    const d = hentData();
    const k = d.klasser.find((x) => x.id === d.aktivKlasseId);
    const p = k?.planer[k.planer.length - 1];
    if (k && p) valg = { klasse: k, plan: p };
  }
  if (!valg) return null;
  const { klasse, plan } = valg;
  const navn = navneOpslag(klasse);
  return (
    <div class="print-ark" aria-hidden="true" style={{ '--print-skrift': `${printSkrift(plan, navn)}pt` }}>
      <div class="print-hoved">
        <strong>{klasse.navn}</strong>
        <span>{planTitel(plan.dato)}</span>
      </div>
      <Lokaletegning lokale={plan.lokale} placering={plan.placering} navn={navn} klasse="print" />
    </div>
  );
}

interface Maal {
  kolonner: number;
  raekker: number;
  pladsKol: number;
  pladsRaek: number;
  /** Bredden af det længste navn ved skriftstørrelse 1 (i em). */
  em: number;
}

let laerred: HTMLCanvasElement | null = null;

/** Måler navnets bredde i den rigtige skrift (fed Atkinson Hyperlegible). */
function navnebredde(navn: string): number {
  laerred ??= document.createElement('canvas');
  const ctx = laerred.getContext('2d');
  if (!ctx) return navn.length * 0.6;
  ctx.font = `700 100px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  return ctx.measureText(navn).width / 100;
}

function maal(plan: Plan, navn: (id: string) => string): Maal {
  const borde = plan.lokale.borde;
  const maks = Math.max(1, ...borde.map((b) => b.pladser));
  const pladsKol = maks === 1 ? 1 : maks >= 5 ? 3 : 2;
  const navne = Object.values(plan.placering).flat().filter((x): x is string => !!x).map(navn);
  return {
    kolonner: Math.max(1, ...borde.map((b) => b.kolonne + 1)),
    raekker: Math.max(1, ...borde.map((b) => b.raekke + 1)),
    pladsKol,
    pladsRaek: Math.ceil(maks / pladsKol),
    em: Math.max(2.5, ...navne.map(navnebredde)),
  };
}

/**
 * Største skrift, hvor det længste navn kan være på én linje, og alle
 * rækker kan være i højden. Mål i samme enhed som `bredde` og `hoejde`.
 */
function passendeSkrift(m: Maal, bredde: number, hoejde: number, gab: number, bordKant: number, pladsKant: number, titel: number): number {
  const bordB = (bredde - (m.kolonner - 1) * gab) / m.kolonner - 2 * bordKant;
  const pladsB = (bordB - (m.pladsKol - 1) * bordKant) / m.pladsKol - 2 * pladsKant;
  const bordH = (hoejde - (m.raekker - 1) * gab) / m.raekker - 2 * bordKant - titel;
  const pladsH = (bordH - (m.pladsRaek - 1) * bordKant) / m.pladsRaek - 2 * pladsKant;
  return Math.min(pladsB / (m.em * 1.04), pladsH / 1.2);
}

/** Skriftstørrelse (pt), så hele lokalet kan være på én A4-side på tværs. */
export function printSkrift(plan: Plan, navn: (id: string) => string): number {
  // Siden er 277 × 190 mm. Overskrift og tavle tager ca. 26 mm.
  const mm = passendeSkrift(maal(plan, navn), 277, 160, 4, 2.6, 2, 5);
  return Math.floor(Math.max(8, Math.min(32, mm / 0.3528)));
}

/** Skriftstørrelse (px) til tavlevisning, så alt kan ses uden at rulle. */
export function tavleSkrift(plan: Plan, navn: (id: string) => string, w: number, h: number): number {
  const gab = w * 0.012;
  const px = passendeSkrift(maal(plan, navn), w * 0.96, h * 0.97 - 140, gab, 9, 8, 24);
  return Math.floor(Math.max(12, Math.min(72, px)));
}
