// Deling af en gemt plan: udskriv / PDF, kopiér som tekst og vis på tavlen.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { planTitel } from '../../core/dato';
import { planSomTekst } from '../../core/deling';
import { type Klasse, type Plan } from '../../core/model';
import { planGrupper } from '../../core/struktur';
import { hentUdskrift, kopierTekst, lytTilUdskrift, nulstilUdskrift, udskriv } from '../../app/handlinger';
import { hentData, visBesked } from '../../app/tilstand';
import { Lokaletegning, gruppefarve } from './Lokaletegning';

export function navneOpslag(k: Klasse) {
  const m = new Map(k.elever.map((e) => [e.id, e.navn]));
  return (id: string) => m.get(id) ?? 'Tidligere elev';
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
            visBesked(ok ? 'Grupperne er kopieret som tekst. Indsæt dem fx i Teams eller Ludus.' : 'Planen kunne ikke kopieres. Brug "Udskriv / gem som PDF" i stedet.');
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

/** Netværksgrupper med makkerpar, i samme farver som i lokalet. */
export function GruppeOversigt(props: { plan: Plan; navn: (id: string) => string; overskriftNiveau?: 2 | 3 }) {
  const grupper = useMemo(() => planGrupper(props.plan.lokale, props.plan.placering), [props.plan]);
  if (grupper.length === 0) return null;
  return (
    <ul class="gruppeoversigt" aria-label="Netværksgrupper og makkerpar">
      {grupper.map((g) => (
        <li key={g.nr} style={{ background: gruppefarve(g.nr) }}>
          <h3>Gruppe {g.nr}</h3>
          {g.par.map((p, i) => (
            <p key={i}>{p.map(props.navn).join(' og ')}</p>
          ))}
        </li>
      ))}
    </ul>
  );
}

/** Fuldskærm til projektor. Esc eller "Luk" lukker. */
function Tavlevisning(props: { klasse: Klasse; plan: Plan; onLuk: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lukRef = useRef<HTMLButtonElement>(null);
  const navn = useMemo(() => navneOpslag(props.klasse), [props.klasse]);
  const [visning, setVisning] = useState<'plan' | 'grupper'>('plan');
  const [str, setStr] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const ny = () => setStr({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', ny);
    return () => window.removeEventListener('resize', ny);
  }, []);

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

  const l = props.plan.lokale;
  const u = Math.floor(Math.min((str.w * 0.96) / l.bredde, (str.h - 90) / l.hoejde));

  return (
    <div class="tavlevisning" ref={ref} role="dialog" aria-modal="true" aria-label={`Bordplan for ${props.klasse.navn} på tavlen`}>
      <div class="tavlevisning-hoved">
        <h2>
          {props.klasse.navn} <span class="daempet">{planTitel(props.plan.dato)}</span>
        </h2>
        <button class="knap" type="button" onClick={() => setVisning(visning === 'plan' ? 'grupper' : 'plan')}>
          {visning === 'plan' ? 'Vis grupperne' : 'Vis bordplanen'}
        </button>
        <button ref={lukRef} class="knap" type="button" onClick={props.onLuk}>
          Luk (Esc)
        </button>
      </div>
      {visning === 'plan' ? (
        <Lokaletegning lokale={l} placering={props.plan.placering} navn={navn} klasse="stor" maal={{ u, skrift: u * 0.36, enhed: 'px' }} />
      ) : (
        <div class="tavle-grupper">
          <GruppeOversigt plan={props.plan} navn={navn} />
        </div>
      )}
    </div>
  );
}

/** Arket, der kommer på papir: side 1 bordplanen, side 2 grupperne. Usynligt på skærmen. */
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
  const l = plan.lokale;
  // Siden er 277 × 190 mm; overskriften tager ca. 14 mm.
  const u = Math.min(277 / l.bredde, 172 / l.hoejde);
  const titel = `${planTitel(plan.dato)}${l.navn ? `, lokale ${l.navn}` : ''}`;
  return (
    <div class="print-ark" aria-hidden="true">
      <section class="print-side">
        <div class="print-hoved">
          <strong>Siddepladser, {klasse.navn}</strong>
          <span>{titel}</span>
        </div>
        <Lokaletegning lokale={l} placering={plan.placering} navn={navn} klasse="print" maal={{ u, skrift: Math.min(u * 0.34, 9), enhed: 'mm' }} />
      </section>
      <section class="print-side">
        <div class="print-hoved">
          <strong>Netværksgrupper og makkerpar, {klasse.navn}</strong>
          <span>{titel}</span>
        </div>
        <GruppeOversigt plan={plan} navn={navn} />
      </section>
    </div>
  );
}
