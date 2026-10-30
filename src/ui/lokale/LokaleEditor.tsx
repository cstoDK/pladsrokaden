// Lokaler: vælg klassens lokale efter nummer, eller byg et nyt. Borde,
// tavle og mobilskab trækkes på plads med mus, finger eller piletaster.
// Lokalet huskes og kan bruges af alle klasser.

import { useEffect, useRef, useState } from 'preact/hooks';
import {
  type LokaleIndstillinger,
  MAKS_PLADSER_PR_BORD,
  SKABELONER,
  type SkabelonId,
  foreslaaIndstillinger,
  lavLokale,
  normaliserLokale,
  sugSammen,
  tilpasStoerrelse,
} from '../../core/lokale';
import { type Bord, type Klasse, type Lokale, type Vaeg, MOBILSKAB, antalPladser, bordBredde, bordHoejde, bordRaekker, forresteBorde, nyId } from '../../core/model';
import { belaegning } from '../../core/optimering';
import { opdater, useData } from '../../app/tilstand';
import { Tavle, pos } from '../plan/Lokaletegning';

const NYT = '__nyt__';

export function LokaleSkaerm(props: { klasse: Klasse; gemTekst: string; onGemt: () => void }) {
  const data = useData();
  const k = props.klasse;
  const [valg, setValg] = useState<string>(k.lokaleId ?? (data.lokaler[0]?.id ?? NYT));
  const eksisterende = data.lokaler.find((l) => l.id === valg) ?? null;
  const [kladde, setKladde] = useState<Lokale>(() => structuredClone(eksisterende ?? nytLokale('fire', k.elever.length)));
  const [skabelon, setSkabelon] = useState<SkabelonId>('fire');
  const brugere = data.klasser.filter((x) => x.lokaleId === valg && x.id !== k.id);

  function skift(id: string) {
    setValg(id);
    const l = data.lokaler.find((x) => x.id === id);
    setKladde(structuredClone(l ?? nytLokale(skabelon, k.elever.length)));
  }

  function gem() {
    const lokale = normaliserLokale({ ...kladde, navn: kladde.navn.trim() });
    opdater((d) => {
      const i = d.lokaler.findIndex((l) => l.id === lokale.id);
      if (i >= 0) d.lokaler[i] = lokale;
      else d.lokaler.push(lokale);
      for (const x of d.klasser) {
        if (x.id === k.id) x.lokaleId = lokale.id;
        // En kladde lavet til det gamle lokale passer ikke længere.
        if (x.lokaleId === lokale.id && x.kladde && x.kladde.plan.lokale.id === lokale.id) x.kladde = null;
      }
    });
    props.onGemt();
  }

  return (
    <div class="stak">
      <section class="kort" aria-labelledby="lokalevalg-titel">
        <h2 id="lokalevalg-titel">Hvilket lokale er {k.navn} i?</h2>
        <div class="raekke" style={{ alignItems: 'end' }}>
          {data.lokaler.length > 0 && (
            <div>
              <label for="lokalevalg">Lokale</label>
              <select id="lokalevalg" value={valg} onChange={(e) => skift(e.currentTarget.value)}>
                {data.lokaler.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.navn ? `Lokale ${l.navn}` : 'Lokale uden nummer'}
                  </option>
                ))}
                <option value={NYT}>Nyt lokale</option>
              </select>
            </div>
          )}
          <div style={{ flex: '0 1 12rem' }}>
            <label for="lokalenavn">Lokalenummer</label>
            <input
              id="lokalenavn"
              type="text"
              value={kladde.navn}
              placeholder="Fx 007"
              maxLength={20}
              autocomplete="off"
              onInput={(e) => setKladde({ ...kladde, navn: e.currentTarget.value })}
            />
          </div>
        </div>
        {brugere.length > 0 && (
          <p class="hjaelp">Lokalet bruges også af {brugere.map((x) => x.navn).join(', ')}. Ændringer gælder for alle.</p>
        )}
        {valg === NYT && (
          <Skabeloner
            valgt={skabelon}
            onVaelg={(s) => {
              setSkabelon(s);
              setKladde({ ...nytLokale(s, k.elever.length), id: kladde.id, navn: kladde.navn });
            }}
          />
        )}
      </section>

      <RumEditor
        key={kladde.id}
        lokale={kladde}
        antalElever={k.elever.length}
        onAendr={setKladde}
        nulstil={(ind) => setKladde({ ...lavLokale(ind, kladde.navn), id: kladde.id })}
        gemTekst={props.gemTekst}
        onGem={gem}
      />
    </div>
  );
}

function nytLokale(s: SkabelonId, antal: number): Lokale {
  return lavLokale(foreslaaIndstillinger(s, antal));
}

function Skabeloner(props: { valgt: SkabelonId; onVaelg: (s: SkabelonId) => void }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <p id="skabelon-titel" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
        Start med en opstilling, og træk så bordene på plads
      </p>
      <div class="skabeloner" role="radiogroup" aria-labelledby="skabelon-titel">
        {SKABELONER.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            class="skabelon"
            aria-checked={props.valgt === s.id}
            tabIndex={props.valgt === s.id ? 0 : -1}
            onClick={() => props.onVaelg(s.id)}
            onKeyDown={(e) => {
              const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const j = (i + d + SKABELONER.length) % SKABELONER.length;
              props.onVaelg(SKABELONER[j]!.id);
              (e.currentTarget.parentElement?.children[j] as HTMLElement | undefined)?.focus();
            }}
          >
            <Mini id={s.id} />
            <span class="skabelon-navn">{s.navn}</span>
            <span class="skabelon-beskrivelse">{s.beskrivelse}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Mini(props: { id: SkabelonId }) {
  const pladser = props.id === 'raekker' ? 6 : props.id === 'fire' ? 4 : 2;
  const borde = props.id === 'raekker' ? 1 : props.id === 'fire' ? 2 : 3;
  return (
    <span class="mini-rum" aria-hidden="true">
      {[0, 1].map((r) => (
        <span key={r} class="mini-raekke">
          {Array.from({ length: borde }, (_, b) => (
            <span key={b} class="mini-bord">
              {Array.from({ length: pladser }, (_, i) => (
                <span key={i} />
              ))}
            </span>
          ))}
        </span>
      ))}
    </span>
  );
}

// ----------------------------------------------------------------------

type Valgt = { type: 'bord'; id: string } | { type: 'skab' } | { type: 'tavle' } | null;

const VAEGNAVN: Record<Vaeg, string> = { top: 'Øverst', bund: 'Nederst', venstre: 'Venstre', hoejre: 'Højre' };

function RumEditor(props: {
  lokale: Lokale;
  antalElever: number;
  onAendr: (l: Lokale) => void;
  nulstil: (ind: LokaleIndstillinger) => void;
  gemTekst: string;
  onGem: () => void;
}) {
  const l = props.lokale;
  const [valgt, setValgt] = useState<Valgt>(null);
  const [stak, setStak] = useState<Lokale[]>([]);
  const [annonce, setAnnonce] = useState('');
  const [bredde, setBredde] = useState(800);
  const ramme = useRef<HTMLDivElement>(null);
  const traek = useRef<{ x0: number; y0: number; start: Lokale; flyttet: boolean } | null>(null);
  const seneste = useRef({ l, stak });
  seneste.current = { l, stak };
  const valgtRef = useRef<Valgt>(null);
  valgtRef.current = valgt;

  useEffect(() => {
    const el = ramme.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBredde(el.clientWidth));
    ro.observe(el);
    setBredde(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ved = (e: KeyboardEvent) => {
      const mål = e.target as HTMLElement;
      if (mål.tagName === 'INPUT' || mål.tagName === 'SELECT' || mål.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        fortryd();
      }
    };
    document.addEventListener('keydown', ved);
    return () => document.removeEventListener('keydown', ved);
  }, []);

  // Hele lokalet skal kunne ses uden at rulle.
  const hoejde = Math.max(320, window.innerHeight - 160);
  let u = Math.max(24, Math.floor(Math.min(80, (bredde - 6) / l.bredde, hoejde / l.hoejde)));
  // På telefoner skal bordene være store nok til en finger; der ruller lokalet i stedet.
  if (bredde < 700) u = Math.max(u, 74);

  /** Gemmer en ændring, der kan fortrydes. */
  function aendr(ny: Lokale, besked?: string, foer: Lokale = l) {
    tilpasStoerrelse(ny);
    setStak((s) => [...s.slice(-49), foer]);
    props.onAendr(ny);
    if (besked) setAnnonce(besked);
  }

  function fortryd() {
    const { stak } = seneste.current;
    const forrige = stak[stak.length - 1];
    if (!forrige) return;
    setStak(stak.slice(0, -1));
    props.onAendr(forrige);
    setAnnonce('Sidste ændring er fortrudt.');
  }

  function medKopi(fn: (k: Lokale) => void, besked?: string) {
    const k = structuredClone(l);
    fn(k);
    aendr(k, besked);
  }

  function flyt(v: Valgt, dx: number, dy: number, k: Lokale) {
    if (!v) return;
    const snap = (x: number) => Math.max(0, Math.round(x * 2) / 2);
    if (v.type === 'bord') {
      const b = k.borde.find((x) => x.id === v.id);
      if (b) {
        b.x = snap(b.x + dx);
        b.y = snap(b.y + dy);
      }
    } else if (v.type === 'skab' && k.mobilskab) {
      k.mobilskab.x = snap(k.mobilskab.x + dx);
      k.mobilskab.y = snap(k.mobilskab.y + dy);
    } else if (v.type === 'tavle') {
      const langs = k.tavle.vaeg === 'top' || k.tavle.vaeg === 'bund' ? dx : dy;
      const max = (k.tavle.vaeg === 'top' || k.tavle.vaeg === 'bund' ? k.bredde : k.hoejde) - k.tavle.laengde / 2;
      k.tavle.midte = Math.min(max, Math.max(k.tavle.laengde / 2, Math.round((k.tavle.midte + langs) * 2) / 2));
    }
  }

  function navnPaa(v: Valgt): string {
    if (!v) return '';
    if (v.type === 'skab') return 'Mobilskabet';
    if (v.type === 'tavle') return 'Tavlen';
    return `Bord ${l.borde.findIndex((b) => b.id === v.id) + 1}`;
  }

  // Træk med mus eller finger (Pointer Events).
  function startTraek(e: PointerEvent, v: Valgt) {
    if (e.button !== 0) return;
    // Forhindrer, at browseren markerer tekst eller starter sit eget træk (som afbryder vores).
    e.preventDefault();
    (e.currentTarget as HTMLElement).focus();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    traek.current = { x0: e.clientX, y0: e.clientY, start: structuredClone(l), flyttet: false };
    valgtRef.current = v;
    setValgt(v);
  }
  function under(e: PointerEvent, v: Valgt) {
    const t = traek.current;
    if (!t) return;
    const dx = (e.clientX - t.x0) / u;
    const dy = (e.clientY - t.y0) / u;
    if (!t.flyttet && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) < 4) return;
    t.flyttet = true;
    const k = structuredClone(t.start);
    flyt(v, dx, dy, k);
    props.onAendr(k);
  }
  function slutTraek() {
    const t = traek.current;
    traek.current = null;
    if (!t?.flyttet) return;
    const ny = structuredClone(seneste.current.l);
    const v = valgtRef.current;
    if (v?.type === 'bord' && sugSammen(ny, v.id)) {
      aendr(ny, 'Bordet står nu sammen med nabobordet.', t.start);
    } else aendr(ny, undefined, t.start);
  }

  function tast(e: KeyboardEvent, v: Valgt) {
    const trin = e.shiftKey ? 2 : 0.5;
    const d: Record<string, [number, number]> = { ArrowLeft: [-trin, 0], ArrowRight: [trin, 0], ArrowUp: [0, -trin], ArrowDown: [0, trin] };
    const r = d[e.key];
    if (r) {
      e.preventDefault();
      setValgt(v);
      medKopi((k) => flyt(v, r[0], r[1], k), `${navnPaa(v)} er flyttet.`);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && v?.type === 'bord') {
      e.preventDefault();
      sletBord(v.id);
    }
  }

  function tilfoejBord() {
    const pladser = valgtBord?.pladser ?? l.borde[l.borde.length - 1]?.pladser ?? 4;
    const nederst = Math.max(1, ...l.borde.map((b) => b.y + bordHoejde(b) + 1));
    const nyt: Bord = { id: nyId(), x: 1, y: nederst, pladser, lodret: false };
    medKopi((k) => k.borde.push(nyt), `Et bord med ${pladser} pladser er tilføjet nederst.`);
    setValgt({ type: 'bord', id: nyt.id });
  }

  function sletBord(id: string) {
    const nr = l.borde.findIndex((b) => b.id === id) + 1;
    medKopi((k) => (k.borde = k.borde.filter((b) => b.id !== id)), `Bord ${nr} er slettet. Tryk Fortryd for at få det tilbage.`);
    setValgt(null);
  }

  const valgtBord = valgt?.type === 'bord' ? l.borde.find((b) => b.id === valgt.id) : undefined;
  const forrest = forresteBorde(l);
  const pladser = antalPladser(l);
  const mangler = props.antalElever - pladser;
  const raekker = bordRaekker(l);
  const alene = mangler <= 0 && belaegning(raekker.map((r) => r.reduce((sum, b) => sum + b.pladser, 0)), props.antalElever).includes(1);
  const overlap = overlapper(l);
  const [tilpas, setTilpas] = useState(false);

  return (
    <section class="kort" aria-labelledby="rum-titel">
      <h2 id="rum-titel">Indret lokalet</h2>
      <div class="meddelelse meddelelse-ok">
        <strong>Tag fat i et bord, tavlen eller mobilskabet med musen (eller fingeren), og træk det på plads.</strong> Slipper du et bord
        tæt på enden af et andet, sættes de sammen, så de danner én række. Tryk på et bord for at ændre antal pladser eller dreje det.
        Med tastaturet: vælg med Tab, og flyt med piletasterne.
      </div>
      <div class="vaerktoejer">
        <button class="knap" type="button" onClick={tilfoejBord}>
          Tilføj bord
        </button>
        {!l.mobilskab && (
          <button class="knap" type="button" onClick={() => medKopi((k) => (k.mobilskab = { x: 1, y: 0.5 }), 'Mobilskabet er tilføjet øverst til venstre.')}>
            Tilføj mobilskab
          </button>
        )}
        <button class="knap" type="button" onClick={fortryd} disabled={stak.length === 0} aria-keyshortcuts="Control+Z">
          Fortryd
        </button>
        <span class="afstand" />
        <button class="knap knap-tekst" type="button" aria-expanded={tilpas} onClick={() => setTilpas(!tilpas)}>
          {tilpas ? 'Skjul' : 'Byg forfra'}
        </button>
      </div>
      {tilpas && (
        <ByggForfra
          antalElever={props.antalElever}
          onByg={(ind) => {
            setStak((s) => [...s, l]);
            props.nulstil(ind);
            setValgt(null);
            setAnnonce('Lokalet er bygget forfra. Tryk Fortryd for at gå tilbage.');
          }}
        />
      )}

      <div class="lokale editor fuld" ref={ramme}>
        <div class="rum" style={{ '--u': `${u}px`, width: `${l.bredde * u}px`, height: `${l.hoejde * u}px` }}>
          <button
            type="button"
            class={`flytbar tavle-flyt${valgt?.type === 'tavle' ? ' valgt' : ''}`}
            style={tavleStil(l)}
            aria-label={`Tavlen, ${VAEGNAVN[l.tavle.vaeg].toLowerCase()}. Flyt langs væggen med piletasterne.`}
            onPointerDown={(e) => startTraek(e, { type: 'tavle' })}
            onPointerMove={(e) => under(e, { type: 'tavle' })}
            onPointerUp={slutTraek}
                onPointerCancel={slutTraek}
            onKeyDown={(e) => tast(e, { type: 'tavle' })}
            onClick={() => setValgt({ type: 'tavle' })}
          />
          <Tavle lokale={l} />
          {l.borde.map((b, i) => {
            const v: Valgt = { type: 'bord', id: b.id };
            const erValgt = valgt?.type === 'bord' && valgt.id === b.id;
            return (
              <button
                key={b.id}
                type="button"
                class={`flytbar bord${b.lodret ? ' lodret' : ''}${forrest.has(b.id) ? ' forrest' : ''}${erValgt ? ' valgt' : ''}`}
                style={pos(b.x, b.y, bordBredde(b), bordHoejde(b))}
                aria-label={`Bord ${i + 1}, ${b.pladser} pladser${b.lodret ? ', lodret' : ''}${forrest.has(b.id) ? ', forrest' : ''}. Flyt med piletasterne, slet med Delete.`}
                aria-pressed={erValgt}
                onPointerDown={(e) => startTraek(e, v)}
                onPointerMove={(e) => under(e, v)}
                onPointerUp={slutTraek}
                onPointerCancel={slutTraek}
                onKeyDown={(e) => tast(e, v)}
                onClick={() => setValgt(v)}
              >
                <span class="bord-nr">{i + 1}</span>
                {Array.from({ length: b.pladser }, (_, p) => (
                  <span key={p} class="plads" />
                ))}
              </button>
            );
          })}
          {l.mobilskab && (
            <button
              type="button"
              class={`flytbar mobilskab${valgt?.type === 'skab' ? ' valgt' : ''}`}
              style={pos(l.mobilskab.x, l.mobilskab.y, MOBILSKAB.bredde, MOBILSKAB.hoejde)}
              aria-label="Mobilskab. Flyt med piletasterne."
              onPointerDown={(e) => startTraek(e, { type: 'skab' })}
              onPointerMove={(e) => under(e, { type: 'skab' })}
              onPointerUp={slutTraek}
                onPointerCancel={slutTraek}
              onKeyDown={(e) => tast(e, { type: 'skab' })}
              onClick={() => setValgt({ type: 'skab' })}
            >
              Mobilskab
            </button>
          )}
        </div>
      </div>
      <p class="skjult" aria-live="polite">
        {annonce}
      </p>

      {valgtBord && (
        <BordPanel
          bord={valgtBord}
          nr={l.borde.indexOf(valgtBord) + 1}
          erForrest={forrest.has(valgtBord.id)}
          onAendr={(fn, besked) => medKopi((k) => fn(k.borde.find((x) => x.id === valgtBord.id)!), besked)}
          onSlet={() => sletBord(valgtBord.id)}
        />
      )}
      {valgt?.type === 'tavle' && (
        <div class="panel" role="group" aria-label="Tavlen">
          <h3>Tavlen</h3>
          <div class="raekke">
            <span>Væg:</span>
            {(Object.keys(VAEGNAVN) as Vaeg[]).map((v) => (
              <button
                key={v}
                type="button"
                class="knap"
                aria-pressed={l.tavle.vaeg === v}
                onClick={() =>
                  medKopi((k) => {
                    k.tavle.vaeg = v;
                    k.tavle.midte = v === 'top' || v === 'bund' ? k.bredde / 2 : k.hoejde / 2;
                  }, `Tavlen står nu ${VAEGNAVN[v].toLowerCase()}.`)
                }
              >
                {VAEGNAVN[v]}
              </button>
            ))}
          </div>
          <Taeller label="Længde" vaerdi={l.tavle.laengde} min={2} max={20} onSaet={(v) => medKopi((k) => (k.tavle.laengde = v))} />
        </div>
      )}
      {valgt?.type === 'skab' && (
        <div class="panel" role="group" aria-label="Mobilskab">
          <h3>Mobilskab</h3>
          <button
            class="knap knap-fare"
            type="button"
            onClick={() => {
              medKopi((k) => (k.mobilskab = null), 'Mobilskabet er fjernet.');
              setValgt(null);
            }}
          >
            Fjern mobilskab
          </button>
        </div>
      )}

      <div aria-live="polite" style={{ marginTop: '1rem' }}>
        {mangler > 0 ? (
          <p class="meddelelse meddelelse-fejl" style={{ margin: 0 }}>
            Der er {props.antalElever} elever, men kun {pladser} pladser. Tilføj et bord, eller giv bordene flere pladser.
          </p>
        ) : (
          <p class="daempet" style={{ margin: 0 }}>
            {props.antalElever} elever og {pladser} pladser.
            {pladser > props.antalElever && ' De tomme pladser kommer i enden af bordene, og ingen sidder alene.'}
          </p>
        )}
        {alene && (
          <p class="meddelelse meddelelse-bemaerk" style={{ margin: '0.75rem 0 0' }}>
            Med denne opstilling må én elev sidde alene. Giv ét bord en plads mere, eller sæt to borde sammen, så kan alle sidde sammen med nogen.
          </p>
        )}
        {overlap && (
          <p class="meddelelse meddelelse-bemaerk" style={{ margin: '0.75rem 0 0' }}>
            To borde står oven i hinanden. Træk dem fra hinanden.
          </p>
        )}
      </div>

      <div class="handlingsbar fast">
        <button class="knap knap-primaer knap-stor" type="button" disabled={mangler > 0} onClick={props.onGem}>
          {props.gemTekst}
        </button>
      </div>
    </section>
  );
}

function BordPanel(props: { bord: Bord; nr: number; erForrest: boolean; onAendr: (fn: (b: Bord) => void, besked?: string) => void; onSlet: () => void }) {
  const b = props.bord;
  const forrestValg = b.forrest === undefined ? 'auto' : b.forrest ? 'ja' : 'nej';
  return (
    <div class="panel" role="group" aria-label={`Bord ${props.nr}`}>
      <h3>Bord {props.nr}</h3>
      <div class="raekke" style={{ alignItems: 'end' }}>
        <Taeller label="Pladser" vaerdi={b.pladser} min={1} max={MAKS_PLADSER_PR_BORD} onSaet={(v) => props.onAendr((x) => (x.pladser = v), `Bord ${props.nr} har nu ${v} pladser.`)} />
        <button class="knap" type="button" onClick={() => props.onAendr((x) => (x.lodret = !x.lodret), `Bord ${props.nr} er drejet.`)}>
          Drej bordet
        </button>
        <div>
          <label for={`forrest-${b.id}`}>Tæller som forrest</label>
          <select
            id={`forrest-${b.id}`}
            value={forrestValg}
            onChange={(e) => {
              const v = e.currentTarget.value;
              props.onAendr((x) => {
                if (v === 'auto') delete x.forrest;
                else x.forrest = v === 'ja';
              });
            }}
          >
            <option value="auto">{b.forrest === undefined ? `Automatisk (${props.erForrest ? 'ja' : 'nej'})` : 'Automatisk'}</option>
            <option value="ja">Ja</option>
            <option value="nej">Nej</option>
          </select>
        </div>
        <button class="knap knap-tekst knap-fare" type="button" onClick={props.onSlet}>
          Slet bord
        </button>
      </div>
    </div>
  );
}

function ByggForfra(props: { antalElever: number; onByg: (ind: LokaleIndstillinger) => void }) {
  const [ind, setInd] = useState<LokaleIndstillinger>(foreslaaIndstillinger('fire', props.antalElever));
  return (
    <div class="panel">
      <h3>Byg lokalet forfra</h3>
      <div class="raekke">
        {SKABELONER.map((s) => (
          <button key={s.id} type="button" class="knap" onClick={() => setInd(foreslaaIndstillinger(s.id, props.antalElever))}>
            {s.navn}
          </button>
        ))}
      </div>
      <div class="taellere">
        <Taeller label="Antal borde" vaerdi={ind.antalBorde} min={1} max={40} onSaet={(v) => setInd({ ...ind, antalBorde: v })} />
        <Taeller label="Pladser pr. bord" vaerdi={ind.pladserPrBord} min={1} max={MAKS_PLADSER_PR_BORD} onSaet={(v) => setInd({ ...ind, pladserPrBord: v })} />
        <Taeller label="Borde pr. række" vaerdi={ind.bordePrRaekke} min={1} max={Math.max(1, ind.antalBorde)} onSaet={(v) => setInd({ ...ind, bordePrRaekke: v })} />
      </div>
      <label class="afkryds">
        <input type="checkbox" checked={!!ind.toOgTo} onChange={(e) => setInd({ ...ind, toOgTo: e.currentTarget.checked })} />
        Sæt bordene sammen to og to
      </label>
      <button class="knap" type="button" onClick={() => props.onByg(ind)}>
        Byg {ind.antalBorde} borde med {ind.pladserPrBord} pladser
      </button>
    </div>
  );
}

let taellerNr = 0;
function Taeller(props: { label: string; vaerdi: number; min: number; max: number; onSaet: (v: number) => void }) {
  const [id] = useState(() => `taeller-${++taellerNr}`);
  const klem = (v: number) => Math.min(props.max, Math.max(props.min, v));
  return (
    <div>
      <label for={id}>{props.label}</label>
      <div class="taeller">
        <button class="knap" type="button" aria-label={`Færre: ${props.label}`} disabled={props.vaerdi <= props.min} onClick={() => props.onSaet(klem(props.vaerdi - 1))}>
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={props.min}
          max={props.max}
          value={props.vaerdi}
          onChange={(e) => {
            const v = Number(e.currentTarget.value);
            if (Number.isFinite(v)) props.onSaet(klem(Math.round(v)));
          }}
        />
        <button class="knap" type="button" aria-label={`Flere: ${props.label}`} disabled={props.vaerdi >= props.max} onClick={() => props.onSaet(klem(props.vaerdi + 1))}>
          +
        </button>
      </div>
    </div>
  );
}

function tavleStil(l: Lokale) {
  const t = l.tavle;
  const vandret = t.vaeg === 'top' || t.vaeg === 'bund';
  const start = t.midte - t.laengde / 2;
  return vandret
    ? pos(start, t.vaeg === 'top' ? 0 : l.hoejde - 1, t.laengde, 1)
    : pos(t.vaeg === 'venstre' ? 0 : l.bredde - 1, start, 1, t.laengde);
}

function overlapper(l: Lokale): boolean {
  const b = l.borde;
  for (let i = 0; i < b.length; i++) {
    for (let j = i + 1; j < b.length; j++) {
      const p = b[i]!;
      const q = b[j]!;
      if (p.x < q.x + bordBredde(q) && q.x < p.x + bordBredde(p) && p.y < q.y + bordHoejde(q) && q.y < p.y + bordHoejde(p)) return true;
    }
  }
  return false;
}
