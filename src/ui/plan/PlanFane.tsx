// Planfanen: den gældende plan, eller kladden til en ny plan.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { iDag, planTitel } from '../../core/dato';
import { forklar } from '../../core/forklaring';
import { type Plads, byt, lavKladde, manglerIPlan, skiftLaas } from '../../core/kladde';
import { type Klasse, type Kladde } from '../../core/model';
import { medFortryd, opdaterKlasse, visBesked } from '../../app/tilstand';
import { Lokaletegning } from './Lokaletegning';
import { DelKnapper } from './Deling';
import { boerTageSikkerhedskopi, gemSikkerhedskopi } from '../../app/handlinger';
import { hentData } from '../../app/tilstand';

export function PlanFane(props: { klasse: Klasse; foersteGang?: boolean; onRetLokale: () => void }) {
  const k = props.klasse;
  const [redigerer, setRedigerer] = useState(props.foersteGang ?? false);
  const [fejl, setFejl] = useState<string | null>(null);

  function nyPlan() {
    if (k.kladde) {
      setRedigerer(true);
      return;
    }
    const r = lavKladde(k, iDag());
    if ('fejl' in r) {
      setFejl(r.fejl);
      return;
    }
    setFejl(null);
    opdaterKlasse(k.id, (x) => void (x.kladde = r.kladde));
    setRedigerer(true);
  }

  // Første gang laves forslaget med det samme.
  useEffect(() => {
    if (props.foersteGang && !k.kladde) nyPlan();
  }, []);

  if (redigerer && k.kladde) {
    return <KladdeEditor klasse={k} kladde={k.kladde} foersteGang={props.foersteGang} onLuk={() => setRedigerer(false)} />;
  }

  const plan = k.planer[k.planer.length - 1];
  return (
    <div>
      <div class="planhoved">
        <h1>{plan ? planTitel(plan.dato) : 'Ingen plan endnu'}</h1>
        <button class="knap knap-primaer knap-stor" type="button" onClick={nyPlan}>
          {k.kladde ? 'Fortsæt med kladden' : 'Lav ny plan'}
        </button>
      </div>
      {fejl && (
        <div class="meddelelse meddelelse-fejl" role="alert">
          {fejl}{' '}
          <button class="knap knap-tekst" type="button" onClick={props.onRetLokale}>
            Ret lokalet
          </button>
        </div>
      )}
      {k.kladde && (
        <p class="meddelelse meddelelse-bemaerk">Du har en kladde til en ny plan, som ikke er gemt endnu.</p>
      )}
      {plan ? <GemtPlan klasse={k} /> : <p class="daempet">Tryk på "Lav ny plan" for at lave klassens første bordplan.</p>}
    </div>
  );
}

function GemtPlan(props: { klasse: Klasse }) {
  const k = props.klasse;
  const plan = k.planer[k.planer.length - 1]!;
  const navn = useNavne(k);
  const f = useMemo(
    () => forklar({ elever: k.elever, lokale: plan.lokale, placering: plan.placering, tidligere: k.planer.slice(0, -1), holdAdskilt: k.holdAdskilt }),
    [k, plan],
  );
  const mangler = manglerIPlan(plan.placering, k.elever);
  return (
    <>
      {mangler.length > 0 && (
        <p class="meddelelse meddelelse-bemaerk">
          {mangler.map(navn).join(', ')} er ikke med i denne plan. Lav en ny plan for at få{' '}
          {mangler.length === 1 ? 'eleven' : 'dem'} med.
        </p>
      )}
      {!k.erDemo && boerTageSikkerhedskopi() && (
        <div class="meddelelse meddelelse-bemaerk raekke">
          <span style={{ flex: '1 1 18rem' }}>
            {hentData().sidstEksporteret
              ? 'Det er over 14 dage siden, du sidst gemte en sikkerhedskopi.'
              : 'Dine planer ligger kun i denne browser. Gem en sikkerhedskopi, fx på skolens OneDrive, så du ikke mister dem.'}
          </span>
          <button class="knap" type="button" onClick={gemSikkerhedskopi}>
            Gem sikkerhedskopi
          </button>
        </div>
      )}
      <DelKnapper klasse={k} plan={plan} />
      <Statusliste status={f.status} />
      <Lokaletegning lokale={plan.lokale} placering={plan.placering} navn={navn} />
    </>
  );
}

function useNavne(k: Klasse) {
  return useMemo(() => {
    const m = new Map(k.elever.map((e) => [e.id, e.navn]));
    return (id: string) => m.get(id) ?? 'Tidligere elev';
  }, [k.elever]);
}

export function Statusliste(props: { status: { niveau: string; tekst: string }[] }) {
  if (props.status.length === 0) return null;
  return (
    <ul class="statusliste" aria-label="Status for planen">
      {props.status.map((s) => (
        <li key={s.tekst} class={s.niveau}>
          {s.tekst}
        </li>
      ))}
    </ul>
  );
}

// ----------------------------------------------------------------------

function KladdeEditor(props: { klasse: Klasse; kladde: Kladde; foersteGang?: boolean; onLuk: () => void }) {
  const k = props.klasse;
  const kladde = props.kladde;
  const [valgt, setValgt] = useState<Plads | null>(null);
  const [stak, setStak] = useState<Kladde[]>([]);
  const [annonce, setAnnonce] = useState('');
  const [fejl, setFejl] = useState<string | null>(null);
  const navn = useNavne(k);
  const plan = kladde.plan;

  const f = useMemo(
    () => forklar({ elever: k.elever, lokale: plan.lokale, placering: plan.placering, tidligere: k.planer, holdAdskilt: k.holdAdskilt }),
    [k.elever, k.planer, k.holdAdskilt, plan],
  );
  const laaste = useMemo(() => new Set(kladde.laase.map((l) => l.elevId)), [kladde.laase]);
  const mangler = manglerIPlan(plan.placering, k.elever);

  function aendr(ny: Kladde, besked: string) {
    setStak((s) => [...s.slice(-49), kladde]);
    opdaterKlasse(k.id, (x) => void (x.kladde = ny));
    setAnnonce(besked);
  }

  function fortryd() {
    const forrige = stak[stak.length - 1];
    if (!forrige) return;
    setStak((s) => s.slice(0, -1));
    opdaterKlasse(k.id, (x) => void (x.kladde = forrige));
    setValgt(null);
    setAnnonce('Sidste ændring er fortrudt.');
  }

  useEffect(() => {
    const ved = (e: KeyboardEvent) => {
      const mål = e.target as HTMLElement;
      if (mål.tagName === 'INPUT' || mål.tagName === 'TEXTAREA' || mål.tagName === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        fortryd();
      } else if (e.key === 'Escape' && valgt) {
        setValgt(null);
        setAnnonce('Valget er annulleret.');
      }
    };
    document.addEventListener('keydown', ved);
    return () => document.removeEventListener('keydown', ved);
  });

  function navnPaa(p: Plads) {
    const id = plan.placering[p.bordId]?.[p.plads];
    return id ? navn(id) : null;
  }

  function bytPladser(a: Plads, b: Plads) {
    const na = navnPaa(a);
    const nb = navnPaa(b);
    if (!na && !nb) return;
    const besked = na && nb ? `${na} og ${nb} har byttet plads.` : `${na ?? nb} er flyttet.`;
    aendr(byt(kladde, a, b), besked);
    setValgt(null);
  }

  function vaelg(p: Plads) {
    if (!valgt) {
      const n = navnPaa(p);
      if (!n) {
        setAnnonce('Pladsen er tom. Vælg først en elev, og derefter pladsen.');
        return;
      }
      setValgt(p);
      setAnnonce(`${n} er valgt. Vælg den plads, ${n} skal bytte med.`);
      return;
    }
    if (valgt.bordId === p.bordId && valgt.plads === p.plads) {
      setValgt(null);
      setAnnonce('Valget er annulleret.');
      return;
    }
    bytPladser(valgt, p);
  }

  function nytForslag() {
    const r = lavKladde(k, plan.dato, kladde.laase);
    if ('fejl' in r) {
      setFejl(r.fejl);
      return;
    }
    setFejl(null);
    setValgt(null);
    aendr({ plan: { ...r.kladde.plan, id: plan.id }, laase: r.kladde.laase }, 'Der er lavet et nyt forslag. Låste elever står stadig samme sted.');
  }

  function gem() {
    if (mangler.length > 0) {
      setFejl(`${mangler.map(navn).join(', ')} mangler en plads. Tryk "Nyt forslag" for at få alle med.`);
      return;
    }
    opdaterKlasse(k.id, (x) => {
      x.planer.push(structuredClone(plan));
      x.kladde = null;
    });
    visBesked(`Planen for ${planTitel(plan.dato).toLowerCase()} er gemt.`);
    props.onLuk();
  }

  function kasser() {
    medFortryd('Kladden er kasseret.', (d) => {
      const x = d.klasser.find((y) => y.id === k.id);
      if (x) x.kladde = null;
    });
    props.onLuk();
  }

  const valgtNavn = valgt ? navnPaa(valgt) : null;

  return (
    <div>
      <div class="planhoved">
        <h1>{props.foersteGang ? 'Dit første forslag' : 'Ny plan'}</h1>
        <div class="datofelt">
          <label for="plandato">Gælder fra</label>
          <input
            id="plandato"
            type="date"
            value={plan.dato}
            onChange={(e) => {
              const v = e.currentTarget.value;
              if (v) opdaterKlasse(k.id, (x) => void (x.kladde && (x.kladde.plan.dato = v)));
            }}
          />
        </div>
        <button class="knap knap-primaer knap-stor" type="button" onClick={gem}>
          Gem plan
        </button>
      </div>

      <div class="kladde-banner">
        <strong>Kladde. Ikke gemt endnu.</strong>
        <span class="daempet">Tryk på to elever for at bytte dem, eller træk en elev hen på en anden plads.</span>
      </div>

      {fejl && (
        <div class="meddelelse meddelelse-fejl" role="alert">
          {fejl}
        </div>
      )}

      <div class="vaerktoejer">
        <button class="knap" type="button" onClick={fortryd} disabled={stak.length === 0} aria-keyshortcuts="Control+Z">
          Fortryd
        </button>
        <button class="knap" type="button" onClick={nytForslag}>
          Nyt forslag
        </button>
        <span class="afstand" />
        {!props.foersteGang && (
          <button class="knap knap-tekst" type="button" onClick={props.onLuk}>
            Tilbage til gældende plan
          </button>
        )}
        <button class="knap knap-tekst knap-fare" type="button" onClick={kasser}>
          Kassér kladde
        </button>
      </div>

      <Statusliste status={f.status} />
      {valgtNavn && (
        <p class="meddelelse meddelelse-ok" style={{ position: 'sticky', top: '0.5rem', zIndex: 5 }}>
          {valgtNavn} er valgt. Tryk på den plads, {valgtNavn} skal bytte med. Tryk Esc for at fortryde valget.
        </p>
      )}
      <p class="skjult" aria-live="polite">
        {annonce}
      </p>
      <Lokaletegning
        lokale={plan.lokale}
        placering={plan.placering}
        navn={navn}
        problemer={f.borde}
        redigering={{
          valgt,
          laaste,
          onVaelg: vaelg,
          onByt: bytPladser,
          onSkiftLaas: (id) => {
            const laast = laaste.has(id);
            aendr(skiftLaas(kladde, id), laast ? `${navn(id)} er låst op.` : `${navn(id)} er låst på pladsen og flyttes ikke ved nyt forslag.`);
          },
        }}
      />
      <p class="hjaelp" style={{ marginTop: '1rem' }}>
        Lås en elev med låseknappen, hvis eleven skal blive på sin plads, når du trykker "Nyt forslag". Faste pladser for hele året
        sætter du under Elever.
      </p>
    </div>
  );
}
