// Valg af lokale: skabelon først, så evt. tilpasning af antal. Lokalet
// vises med det samme, så læreren kan se resultatet.

import { useState } from 'preact/hooks';
import { genbrugBordIder } from '../../core/kladde';
import {
  type LokaleIndstillinger,
  MAKS_BORDE,
  MAKS_PLADSER_PR_BORD,
  SKABELONER,
  type SkabelonId,
  foreslaaIndstillinger,
  indstillingerFraLokale,
  lavLokale,
} from '../../core/lokale';
import { type Klasse, type Lokale, antalPladser } from '../../core/model';
import { Lokaletegning } from '../plan/Lokaletegning';

interface Props {
  klasse: Klasse;
  gemTekst: string;
  onGem: (lokale: Lokale) => void;
}

function skabelonFor(ind: LokaleIndstillinger): SkabelonId | null {
  return SKABELONER.find((s) => s.pladserPrBord === ind.pladserPrBord)?.id ?? null;
}

export function LokaleEditor(props: Props) {
  const n = props.klasse.elever.length;
  const [ind, setInd] = useState<LokaleIndstillinger>(() =>
    props.klasse.lokale ? indstillingerFraLokale(props.klasse.lokale) : foreslaaIndstillinger('par', n),
  );
  const [tilpas, setTilpas] = useState(false);
  const valgt = skabelonFor(ind);

  // Forhåndsvisningen bygges med faste id'er, så den ikke blinker.
  const lokale = lavLokale(ind);
  const raekker = Math.ceil(lokale.borde.length / Math.max(1, Math.min(ind.bordePrRaekke, lokale.borde.length)));
  const pladser = antalPladser(lokale);
  const mangler = n - pladser;
  const forresteBorde = lokale.borde.filter((b) => b.raekke < lokale.forresteRaekker).length;

  function vaelgSkabelon(id: SkabelonId) {
    setInd((gammel) => ({ ...foreslaaIndstillinger(id, n), forresteRaekker: gammel.forresteRaekker }));
  }

  function saet(felt: keyof LokaleIndstillinger, v: number) {
    setInd((g) => ({ ...g, [felt]: v }));
  }

  return (
    <div class="stak">
      <section class="kort" aria-labelledby="skabelon-titel">
        <h2 id="skabelon-titel">Hvordan står bordene?</h2>
        <div class="skabeloner" role="radiogroup" aria-labelledby="skabelon-titel">
          {SKABELONER.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              class="skabelon"
              aria-checked={valgt === s.id}
              tabIndex={valgt === s.id || (valgt === null && i === 0) ? 0 : -1}
              onClick={() => vaelgSkabelon(s.id)}
              onKeyDown={(e) => {
                const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                const j = (i + d + SKABELONER.length) % SKABELONER.length;
                vaelgSkabelon(SKABELONER[j]!.id);
                ((e.currentTarget.parentElement?.children[j]) as HTMLElement | undefined)?.focus();
              }}
            >
              <Mini pladser={s.pladserPrBord} />
              <span class="skabelon-navn">{s.navn}</span>
              <span class="skabelon-beskrivelse">{s.beskrivelse}</span>
            </button>
          ))}
        </div>

        <p style={{ marginBottom: '0.5rem' }}>
          <strong>
            {ind.antalBorde} borde med {ind.pladserPrBord} {ind.pladserPrBord === 1 ? 'plads' : 'pladser'}, {Math.min(ind.bordePrRaekke, ind.antalBorde)} pr. række
          </strong>
        </p>
        <button class="knap knap-tekst" type="button" aria-expanded={tilpas} aria-controls="tilpas" onClick={() => setTilpas(!tilpas)}>
          {tilpas ? 'Skjul tilpasning' : 'Tilpas antal'}
        </button>
        {tilpas && (
          <div id="tilpas" class="taellere">
            <Taeller id="antal-borde" label="Antal borde" vaerdi={ind.antalBorde} min={1} max={MAKS_BORDE} onSaet={(v) => saet('antalBorde', v)} />
            <Taeller id="pladser" label="Pladser pr. bord" vaerdi={ind.pladserPrBord} min={1} max={MAKS_PLADSER_PR_BORD} onSaet={(v) => saet('pladserPrBord', v)} />
            <Taeller id="pr-raekke" label="Borde pr. række" vaerdi={ind.bordePrRaekke} min={1} max={Math.max(1, ind.antalBorde)} onSaet={(v) => saet('bordePrRaekke', v)} />
          </div>
        )}

        <div style={{ marginTop: '1rem' }}>
          <label for="forreste">Hvor mange rækker tæller som forrest?</label>
          <p class="hjaelp" id="forreste-hjaelp">
            Eleverne skiftes til at sidde forrest. Rækkerne nærmest tavlen er markeret med blåt.
          </p>
          <select
            id="forreste"
            aria-describedby="forreste-hjaelp"
            value={String(lokale.forresteRaekker)}
            onChange={(e) => saet('forresteRaekker', Number(e.currentTarget.value))}
          >
            {Array.from({ length: Math.max(1, raekker - 1) }, (_, i) => i + 1).map((r) => (
              <option key={r} value={r}>
                {r} {r === 1 ? 'række' : 'rækker'}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section class="kort" aria-labelledby="forhaand-titel">
        <h2 id="forhaand-titel">Sådan ser lokalet ud</h2>
        <Lokaletegning lokale={lokale} kunForm />
        <div aria-live="polite" style={{ marginTop: '1rem' }}>
          {mangler > 0 ? (
            <p class="meddelelse meddelelse-fejl" style={{ margin: 0 }}>
              Der er {n} elever, men kun {pladser} pladser. Tilføj {Math.ceil(mangler / ind.pladserPrBord)}{' '}
              {Math.ceil(mangler / ind.pladserPrBord) === 1 ? 'bord' : 'borde'} under "Tilpas antal".
            </p>
          ) : (
            <p class="daempet" style={{ margin: 0 }}>
              {n} elever og {pladser} pladser.
              {pladser > n && ` ${pladser - n} ${pladser - n === 1 ? 'plads' : 'pladser'} bliver tomme. Eleverne fordeles jævnt, så der højst er én elev i forskel ved bordene.`}
            </p>
          )}
          {ind.pladserPrBord >= 3 && lokale.borde.length - forresteBorde < ind.pladserPrBord && (
            <p class="meddelelse meddelelse-bemaerk" style={{ margin: '0.75rem 0 0' }}>
              Mange borde tæller som forrest. Så kan det ikke altid undgås, at nogle sidder sammen med en fra sidst, fordi de forreste borde skal fyldes med elever fra de få borde bagved.
            </p>
          )}
        </div>
        <div class="handlingsbar">
          <button
            class="knap knap-primaer knap-stor"
            type="button"
            disabled={mangler > 0}
            onClick={() => props.onGem(genbrugBordIder(lavLokale(ind), props.klasse.lokale))}
          >
            {props.gemTekst}
          </button>
        </div>
      </section>
    </div>
  );
}

function Taeller(props: { id: string; label: string; vaerdi: number; min: number; max: number; onSaet: (v: number) => void }) {
  const klem = (v: number) => Math.min(props.max, Math.max(props.min, v));
  return (
    <div>
      <label for={props.id}>{props.label}</label>
      <div class="taeller">
        <button class="knap" type="button" aria-label={`Færre: ${props.label}`} disabled={props.vaerdi <= props.min} onClick={() => props.onSaet(klem(props.vaerdi - 1))}>
          −
        </button>
        <input
          id={props.id}
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

function Mini(props: { pladser: number }) {
  return (
    <span class="mini-bord" aria-hidden="true">
      {[0, 1].map((b) => (
        <div key={b}>
          {Array.from({ length: props.pladser }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      ))}
    </span>
  );
}
