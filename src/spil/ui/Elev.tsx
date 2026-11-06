// Elevens side: skriv koden, tryk på din plads, vælg en figur. Her uden
// navne: eleven ser kun bordene. Siden er også en testside, hvor man kan
// sende et resultat, som et rigtigt spil ville gøre det.

import { useEffect, useRef, useState } from 'preact/hooks';
import { bordBredde, bordHoejde } from '../../core/model';
import { Tavle, pos } from '../../ui/plan/Lokaletegning';
import { FIGURER, findFigur } from '../figurer';
import { type Forbindelse, lokalForbindelse, normaliserKode, nytEnhedsId } from '../forbindelse';
import { type Kort, type PladsNoegle, kortSomLokale, pladsNoegle } from '../protokol';
import { brugLokal, serverForbindelse } from '../server';

interface Mig {
  enhed: string;
  kode: string;
  plads: PladsNoegle | null;
  figur: string | null;
}

const NOEGLE = 'spillepladen.elev.v1';

/** Spil, der kan sende point. De ligger ved siden af elevsiden og bruger klient.js. */
const SPIL = [{ navn: 'Counter-Norm', adresse: 'counter-norm.html', om: 'Samfundsfag, kapitel 2: socialisering og identitet' }];

function hentMig(): Mig | null {
  try {
    const m = JSON.parse(sessionStorage.getItem(NOEGLE) ?? 'null') as Mig | null;
    return m && typeof m.enhed === 'string' ? m : null;
  } catch {
    return null;
  }
}
function gemMig(m: Mig): void {
  try {
    sessionStorage.setItem(NOEGLE, JSON.stringify(m));
  } catch {
    // Ikke vigtigt: eleven skal bare vælge igen efter genindlæsning.
  }
}

export function Elev() {
  const [mig, setMig] = useState<Mig>(() => {
    const fraAdresse = normaliserKode(location.hash.replace('#', ''));
    const gemt = hentMig();
    if (gemt && (!fraAdresse || gemt.kode === fraAdresse)) return gemt;
    return { enhed: gemt?.enhed ?? nytEnhedsId(), kode: fraAdresse ?? '', plads: null, figur: null };
  });
  const [kort, setKort] = useState<{ kort: Kort; optagne: Set<string>; taget: Set<string> } | null>(null);
  const [kodeFelt, setKodeFelt] = useState(mig.kode);
  const [fejl, setFejl] = useState('');
  const [point, setPoint] = useState(7);
  const [sendt, setSendt] = useState('');
  const forb = useRef<Forbindelse | null>(null);

  useEffect(() => gemMig(mig), [mig]);

  useEffect(() => {
    if (!mig.kode) return;
    const f = brugLokal() ? lokalForbindelse(mig.kode) : serverForbindelse(mig.kode, 'elev');
    forb.current = f;
    const stop = f.paaBesked((b) => {
      if (b.t === 'kort') setKort({ kort: b.kort, optagne: new Set(b.optagne), taget: new Set(b.taget) });
    });
    f.send({ t: 'hvem' });
    // Spillepladen svarer måske ikke med det samme (fx hvis den åbnes efter eleven).
    const igen = setInterval(() => f.send({ t: 'hvem' }), 3000);
    return () => {
      clearInterval(igen);
      stop();
      f.luk();
    };
  }, [mig.kode]);

  // Når både plads og figur er valgt, meldes eleven på (også efter en genindlæsning).
  useEffect(() => {
    if (mig.plads && mig.figur && kort) forb.current?.send({ t: 'tilmeld', enhed: mig.enhed, plads: mig.plads, figur: mig.figur });
  }, [mig.plads, mig.figur, !!kort]);

  if (!mig.kode) {
    return (
      <main class="elev">
        <h1>Spillepladen</h1>
        <form
          class="elev-kode"
          onSubmit={(e) => {
            e.preventDefault();
            const k = normaliserKode(kodeFelt);
            if (!k) return setFejl('Koden er fire tegn, fx K7PM. Den står på tavlen.');
            setMig({ ...mig, kode: k });
          }}
        >
          <label for="kode">Koden fra tavlen</label>
          <input id="kode" value={kodeFelt} maxLength={6} autoComplete="off" autoCapitalize="characters" aria-invalid={!!fejl} aria-describedby={fejl ? 'kode-fejl' : undefined} onInput={(e) => setKodeFelt((e.currentTarget as HTMLInputElement).value)} />
          {fejl && <p id="kode-fejl" class="fejltekst">{fejl}</p>}
          <button class="knap knap-primaer knap-stor" type="submit">
            Gå videre
          </button>
        </form>
      </main>
    );
  }

  if (!kort) {
    return (
      <main class="elev">
        <h1>Spillepladen</h1>
        <p>Venter på tavlen med koden <b>{mig.kode}</b> ...</p>
        <button class="knap" type="button" onClick={() => setMig({ ...mig, kode: '' })}>
          Skriv en anden kode
        </button>
      </main>
    );
  }

  if (!mig.plads) {
    return (
      <main class="elev">
        <h1>Hvor sidder du?</h1>
        <p>Tryk på din plads. Tavlen er øverst, som i lokalet.</p>
        <Kortvisning kort={kort.kort} optagne={kort.optagne} taget={kort.taget} onVaelg={(p) => setMig({ ...mig, plads: p })} />
      </main>
    );
  }

  if (!mig.figur) {
    return (
      <main class="elev">
        <h1>Vælg din figur</h1>
        <ul class="figurer">
          {FIGURER.map((f) => (
            <li key={f.id}>
              <button type="button" class="figur-kort" onClick={() => setMig({ ...mig, figur: f.id })}>
                <span class="figur-prik" style={{ background: f.farve }} aria-hidden="true" />
                <b>{f.navn}</b>
                <span>{f.er}</span>
              </button>
            </li>
          ))}
        </ul>
        <button class="knap knap-tekst" type="button" onClick={() => setMig({ ...mig, plads: null })}>
          Jeg valgte den forkerte plads
        </button>
      </main>
    );
  }

  const figur = findFigur(mig.figur)!;
  const [bordId, nr] = mig.plads.split('#');
  const bordNr = kort.kort.borde.findIndex((b) => b.id === bordId) + 1;
  return (
    <main class="elev">
      <h1>Du er med</h1>
      <p class="elev-mig">
        <span class="figur-prik" style={{ background: figur.farve }} aria-hidden="true" />
        <span>
          <b>{figur.navn}</b> på bord {bordNr}, plads {Number(nr) + 1}. Se på tavlen, at din figur står ved dit navn.
        </span>
      </p>
      <div class="elev-knapper">
        <button class="knap" type="button" onClick={() => setMig({ ...mig, plads: null })}>
          Skift plads
        </button>
        <button class="knap" type="button" onClick={() => setMig({ ...mig, figur: null })}>
          Skift figur
        </button>
      </div>

      <section class="elev-spil" aria-labelledby="spil-titel">
        <h2 id="spil-titel">Spil</h2>
        <p>Dine point går til din gruppe på tavlen, når du er færdig.</p>
        <ul class="spil-liste">
          {SPIL.map((x) => (
            <li key={x.adresse}>
              <a class="knap knap-primaer knap-stor" href={x.adresse}>
                {x.navn}
              </a>
              <span>{x.om}</span>
            </li>
          ))}
        </ul>
      </section>

      <details class="elev-test">
        <summary>Afprøv uden et spil</summary>
        <p>Sådan sender et spil point til tavlen. Her vælger du selv, hvor mange af 10 mulige.</p>
        <label for="point">
          Point: <b>{point}</b> af 10
        </label>
        <input id="point" type="range" min={0} max={10} value={point} onInput={(e) => setPoint(Number((e.currentTarget as HTMLInputElement).value))} />
        <button
          class="knap knap-primaer knap-stor"
          type="button"
          onClick={() => {
            forb.current?.send({ t: 'resultat', id: `r${crypto.randomUUID().slice(0, 12)}`, enhed: mig.enhed, plads: mig.plads!, spil: 'Testspil', point, maks: 10 });
            setSendt(`${point} af 10 er sendt.`);
          }}
        >
          Send resultatet
        </button>
        <p role="status">{sendt}</p>
      </details>
    </main>
  );
}

/** Lokalet uden navne. Pladser med en elev kan vælges; pladser, en anden har valgt, er markeret. */
function Kortvisning(props: { kort: Kort; optagne: Set<string>; taget: Set<string>; onVaelg: (p: PladsNoegle) => void }) {
  const l = kortSomLokale(props.kort);
  const u = Math.max(40, Math.min(72, Math.floor((Math.min(window.innerWidth, 900) - 32) / l.bredde)));
  return (
    <div class="lokale elev-kort">
      <div class="rum" style={{ '--u': `${u}px`, width: `${u * l.bredde}px`, height: `${u * l.hoejde}px` }}>
        <Tavle lokale={l} />
        {l.borde.map((b, bi) => (
          <div key={b.id} class={`bord${b.lodret ? ' lodret' : ''}`} style={pos(b.x, b.y, bordBredde(b), bordHoejde(b))} role="group" aria-label={`Bord ${bi + 1}`}>
            <span class="bord-nr" aria-hidden="true">
              {bi + 1}
            </span>
            {Array.from({ length: b.pladser }, (_, i) => {
              const p = pladsNoegle(b.id, i);
              const kan = props.optagne.has(p);
              const taget = props.taget.has(p);
              return (
                <div key={i} class={`plads${kan ? '' : ' tom'}`}>
                  <button
                    type="button"
                    class={`plads-knap elev-plads${taget ? ' taget' : ''}`}
                    disabled={!kan}
                    aria-label={`Bord ${bi + 1}, plads ${i + 1}${kan ? (taget ? ', valgt af en anden' : '') : ', tom plads'}`}
                    onClick={() => props.onVaelg(p)}
                  >
                    {kan ? i + 1 : ''}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p class="spil-hjaelp" style={{ maxWidth: `${u * l.bredde}px` }}>
        Pladser med en prik er valgt af en anden. Er det din, så vælg den alligevel: tavlen viser, hvem der sidder hvor.
      </p>
    </div>
  );
}

