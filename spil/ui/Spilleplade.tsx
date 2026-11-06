// Spillepladen: klassens bordplan på projektoren, hvor netværksgrupperne er
// hold. Eleverne melder sig på deres plads med en figur fra deres eget spil,
// og pointene opdateres løbende. Læreren kan også give point med et klik.
//
// Navnene kommer fra Pladsrokaden i samme browser og forlader aldrig denne
// computer. Over forbindelsen sendes kun pladser, figurer og point.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { indlaes } from '../../app/lager';
import { lavDemo } from '../../core/demo';
import { type ElevId, type Klasse, nyId } from '../../core/model';
import { planGrupper } from '../../core/struktur';
import { Lokaletegning, gruppefarve } from '../../ui/plan/Lokaletegning';
import { findFigur, figurInitialer } from '../figurer';
import { type Forbindelse, lokalForbindelse, nyKode } from '../forbindelse';
import { type GruppePladser, type Stand, fortrydKlik, givKlik, modtagResultat, nulstil, nyRunde, stilling, tilmeld, tomStand } from '../pointtavle';
import { lavKort, pladsNoegle } from '../protokol';

const NOEGLE = 'spillepladen.v1';

interface Gemt {
  kode: string;
  klasseId: string;
  stand: Stand;
}

function hentGemt(): Gemt | null {
  try {
    const raa = localStorage.getItem(NOEGLE);
    if (!raa) return null;
    const g = JSON.parse(raa) as Gemt;
    return typeof g?.kode === 'string' && typeof g?.klasseId === 'string' && g.stand ? g : null;
  } catch {
    return null;
  }
}
function gem(g: Gemt): void {
  try {
    localStorage.setItem(NOEGLE, JSON.stringify(g));
  } catch {
    // Spillet virker stadig; det huskes bare ikke ved genindlæsning.
  }
}

/** Klasser med mindst én gemt plan. Uden nogen bruges demoklassen. */
function klasserMedPlan(): { klasser: Klasse[]; aktiv: string | null; demo: boolean } {
  const d = indlaes();
  const klasser = d.klasser.filter((k) => k.planer.length > 0);
  if (klasser.length > 0) return { klasser, aktiv: d.aktivKlasseId, demo: false };
  return { klasser: [lavDemo().klasse], aktiv: null, demo: true };
}

export function Spilleplade() {
  const data = useMemo(klasserMedPlan, []);
  const gemt = useMemo(hentGemt, []);
  const [klasseId, setKlasseId] = useState(() => {
    const ids = data.klasser.map((k) => k.id);
    if (gemt && ids.includes(gemt.klasseId)) return gemt.klasseId;
    return data.aktiv && ids.includes(data.aktiv) ? data.aktiv : ids[0]!;
  });
  const [kode, setKode] = useState(() => gemt?.kode ?? nyKode());
  const [stand, setStand] = useState<Stand>(() => (gemt && gemt.klasseId === klasseId ? gemt.stand : tomStand()));
  const [skjul, setSkjul] = useState(false);

  const klasse = data.klasser.find((k) => k.id === klasseId)!;
  const plan = klasse.planer.at(-1)!;
  const navne = useMemo(() => new Map(klasse.elever.map((e) => [e.id, e.navn])), [klasse]);
  const navn = (id: ElevId) => navne.get(id) ?? '';
  const grupper = useMemo(() => planGrupper(plan.lokale, plan.placering), [plan]);
  const gp: GruppePladser[] = useMemo(() => grupper.map((g) => ({ nr: g.nr, pladser: g.pladser.map((p) => pladsNoegle(p.bordId, p.plads)) })), [grupper]);
  const optagne = useMemo(() => new Set(gp.flatMap((g) => g.pladser)), [gp]);
  const kort = useMemo(() => lavKort(plan.lokale), [plan]);

  useEffect(() => gem({ kode, klasseId, stand }), [kode, klasseId, stand]);

  // Forbindelsen. Beskeder behandles mod den nyeste stand via setStand(fn).
  const forb = useRef<Forbindelse | null>(null);
  const standRef = useRef(stand);
  standRef.current = stand;
  const sendKort = () => forb.current?.send({ t: 'kort', kort, optagne: [...optagne], taget: Object.keys(standRef.current.deltagere) });
  useEffect(() => {
    const f = lokalForbindelse(kode);
    forb.current = f;
    const stop = f.paaBesked((b) => {
      if (b.t === 'hvem') sendKort();
      else if (b.t === 'tilmeld') {
        setStand((s) => tilmeld(s, { plads: b.plads, figur: b.figur, enhed: b.enhed }, optagne));
        setTimeout(sendKort, 0);
      } else if (b.t === 'resultat') setStand((s) => modtagResultat(s, b));
    });
    sendKort();
    return () => {
      stop();
      f.luk();
      forb.current = null;
    };
  }, [kode, kort, optagne]);

  // Lokalet fylder sin spalte i bredden og må højst være så højt som skærmen.
  const lokaleRamme = useRef<HTMLDivElement>(null);
  const [plads, setPlads] = useState({ b: 900, h: 700 });
  useEffect(() => {
    const el = lokaleRamme.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const tjek = () => setPlads({ b: el.clientWidth, h: window.innerHeight - el.getBoundingClientRect().top - 24 });
    const ro = new ResizeObserver(tjek);
    ro.observe(el);
    window.addEventListener('resize', tjek);
    tjek();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', tjek);
    };
  }, []);
  const u = Math.max(40, Math.floor(Math.min(plads.b / plan.lokale.bredde, Math.max(plads.h, 400) / plan.lokale.hoejde)));

  const st = stilling(gp, stand);
  const maks = Math.max(1, ...st.map((x) => x.total));
  const medIAlt = Object.keys(stand.deltagere).length;

  function skiftKlasse(id: string) {
    setKlasseId(id);
    setStand(tomStand());
    setKode(nyKode());
  }

  const figurPaa = (bordId: string, plads: number) => {
    const d = stand.deltagere[pladsNoegle(bordId, plads)];
    const f = d && findFigur(d.figur);
    if (!f) return null;
    const harSpillet = stand.aktuel.some((r) => r.plads === d.plads);
    return (
      <span class={`figur-maerke${harSpillet ? ' spillet' : ''}`} style={{ background: f.farve }} title={f.navn}>
        {figurInitialer(f)}
        <span class="skjult">: {f.navn}{harSpillet ? ', har spillet' : ''}</span>
      </span>
    );
  };

  const elevAdresse = `elev.html#${kode}`;

  return (
    <div class="spil">
      <header class="spil-top">
        <div class="spil-titel">
          <h1>Spillepladen</h1>
          {data.klasser.length > 1 ? (
            <label class="spil-klasse">
              <span class="skjult">Klasse</span>
              <select value={klasseId} onChange={(e) => skiftKlasse((e.currentTarget as HTMLSelectElement).value)}>
                {data.klasser.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.navn}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span class="spil-klasse">{klasse.navn}</span>
          )}
        </div>
        <div class="spil-kode" aria-label={`Koden til spillet er ${kode.split('').join(' ')}`}>
          <span>Kode</span>
          <b>{kode}</b>
        </div>
        <p class="spil-med">
          <b>{medIAlt}</b> af {optagne.size} elever er med
        </p>
      </header>

      {data.demo && (
        <p class="spil-note">
          Demoklasse med opdigtede elever. Gem en plan i <a href="../">Pladsrokaden</a> i denne browser, så står din egen klasse her.
        </p>
      )}

      <div class="spil-flade">
        <section class="spil-lokale" aria-label="Lokalet">
          <div ref={lokaleRamme}>
            <Lokaletegning lokale={plan.lokale} placering={plan.placering} navn={navn} klasse="stor" maal={{ u, skrift: 40, enhed: 'px' }} overskrift="Spillepladen" pladsTillaeg={figurPaa} />
          </div>
        </section>

        <section class="spil-stilling" aria-labelledby="stilling-titel">
          <div class="stilling-hoved">
            <h2 id="stilling-titel">{skjul ? 'Stillingen er skjult' : 'Stillingen'}</h2>
            <span class="runde">Runde {stand.runder.length + 1}</span>
          </div>
          <ol class="stilling-liste">
            {(skjul ? [...st].sort((a, b) => a.nr - b.nr) : st).map((x) => {
              const g = grupper.find((y) => y.nr === x.nr)!;
              return (
                <li key={x.nr} class="hold" style={{ '--farve': gruppefarve(x.nr) }}>
                  <span class="hold-plads" aria-hidden={skjul}>{skjul ? '' : `${x.plads}.`}</span>
                  <div class="hold-midt">
                    <div class="hold-navn">
                      <b>Gruppe {x.nr}</b>
                      <span class="skjult">: {g.par.flat().map(navn).join(', ')}</span>
                    </div>
                    <div class="hold-bar" aria-hidden="true">
                      <i style={{ width: skjul ? '0%' : `${(x.total / maks) * 100}%` }} />
                    </div>
                    <span class="hold-status">
                      {x.med === 0 ? 'Ingen er med endnu' : `${x.spillet} af ${x.med} har spillet`}
                    </span>
                  </div>
                  <b class="hold-point">{skjul ? '?' : x.total}</b>
                  <div class="hold-klik" role="group" aria-label={`Giv gruppe ${x.nr} point`}>
                    {[10, 25].map((p) => (
                      <button key={p} type="button" class="knap" onClick={() => setStand((s) => givKlik(s, { id: nyId(), gruppe: x.nr, point: p }))}>
                        +{p}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
          <div class="stilling-knapper">
            <button type="button" class="knap" aria-pressed={skjul} onClick={() => setSkjul((v) => !v)}>
              {skjul ? 'Vis stillingen' : 'Skjul stillingen'}
            </button>
            <button type="button" class="knap" disabled={stand.aktuel.length === 0} onClick={() => setStand((s) => nyRunde(s, gp))}>
              Ny runde
            </button>
            <button type="button" class="knap" disabled={stand.klik.length === 0} onClick={() => setStand(fortrydKlik)}>
              Fortryd klik
            </button>
            <button type="button" class="knap knap-tekst" onClick={() => setStand(nulstil)}>
              Start forfra
            </button>
          </div>
          <p class="spil-hjaelp">
            Hver runde giver op til 100 point: gennemsnittet for gruppens elever i procent af det, spillet kan give. Elever, der er med, men ikke har
            spillet, tæller som 0. <a href={elevAdresse} target="_blank" rel="noopener">Åbn testsiden som elev</a>.
          </p>
        </section>
      </div>
    </div>
  );
}

