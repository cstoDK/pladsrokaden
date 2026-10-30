// Elever-fanen: ret navne og køn (gemmes med det samme), tilføj elever,
// "hold adskilt"-par, faste pladser og sletning af klassen.

import { useState } from 'preact/hooks';
import { findDubletter, normaliserHold, rydNavn } from '../../core/import';
import { sammenlign } from '../../core/sammenlign';
import { Hent } from '../import/Import';
import { type Udtraek } from '../../core/import';
import { gyldigeLaase } from '../../core/kladde';
import { foreslaaKoen } from '../../core/koensgaet';
import { type ElevId, type Klasse, type Lokale, bordNummer, forresteBorde, nyId } from '../../core/model';
import { medFortryd, opdaterKlasse } from '../../app/tilstand';
import { Import } from '../import/Import';

export function EleverFane(props: { klasse: Klasse; lokale: Lokale | null }) {
  const k = props.klasse;
  const [tilfoejer, setTilfoejer] = useState(false);
  const [sammenligner, setSammenligner] = useState(false);

  if (sammenligner) {
    return (
      <div class="smal">
        <h1>Opdatér {k.navn} fra klasseliste</h1>
        <OpdaterFraListe klasse={k} onFaerdig={() => setSammenligner(false)} />
      </div>
    );
  }

  if (tilfoejer) {
    return (
      <div class="smal">
        <h1>Tilføj elever til {k.navn}</h1>
        <Import
          gemTekst={(n) => `Tilføj ${n} ${n === 1 ? 'elev' : 'elever'}`}
          onAnnuller={() => setTilfoejer(false)}
          onGem={(r) => {
            opdaterKlasse(k.id, (x) => {
              x.elever.push(...r.map((e) => ({ id: nyId(), navn: e.navn, koen: e.koen, ...(e.hold ? { hold: e.hold } : {}) })));
              x.kladde = null;
            });
            setTilfoejer(false);
          }}
        />
      </div>
    );
  }

  return (
    <div class="smal stak">
      <Elevliste klasse={k} onTilfoej={() => setTilfoejer(true)} onSammenlign={() => setSammenligner(true)} />
      <HoldAdskilt klasse={k} />
      <FastePladser klasse={k} lokale={props.lokale} />
      <section class="kort" aria-labelledby="slet-titel">
        <h2 id="slet-titel">Slet klassen</h2>
        <p class="daempet">Sletter klassens elever, lokale og alle planer fra denne computer. Du kan fortryde i 10 sekunder bagefter.</p>
        <button
          class="knap knap-fare"
          type="button"
          onClick={() =>
            medFortryd(`${k.navn} er slettet.`, (d) => {
              d.klasser = d.klasser.filter((x) => x.id !== k.id);
              d.aktivKlasseId = d.klasser[0]?.id ?? null;
            })
          }
        >
          Slet klasse {k.navn}
        </button>
      </section>
    </div>
  );
}

function Elevliste(props: { klasse: Klasse; onTilfoej: () => void; onSammenlign: () => void }) {
  const k = props.klasse;
  const dubletter = findDubletter(k.elever.map((e) => e.navn));
  const piger = k.elever.filter((e) => e.koen === 'P').length;
  const drenge = k.elever.filter((e) => e.koen === 'D').length;

  function fjern(id: ElevId) {
    const e = k.elever.find((x) => x.id === id)!;
    medFortryd(`${e.navn} er fjernet fra ${k.navn}.`, (d) => {
      const x = d.klasser.find((y) => y.id === k.id);
      if (!x) return;
      x.elever = x.elever.filter((y) => y.id !== id);
      x.holdAdskilt = x.holdAdskilt.filter(([a, b]) => a !== id && b !== id);
      x.faste = x.faste.filter((l) => l.elevId !== id);
      x.kladde = null;
    });
  }

  return (
    <section class="kort" aria-labelledby="elever-titel">
      <div class="raekke" style={{ marginBottom: '0.5rem' }}>
        <h1 id="elever-titel" style={{ margin: 0, marginRight: 'auto' }}>
          Elever i {k.navn}
        </h1>
        <button class="knap" type="button" onClick={props.onSammenlign}>
          Opdatér fra klasseliste
        </button>
        <button class="knap knap-primaer" type="button" onClick={props.onTilfoej}>
          Tilføj elever
        </button>
      </div>
      <p class="opsummering">
        <span>
          <strong>{k.elever.length}</strong> elever
        </span>
        <span>
          <strong>{piger}</strong> piger
        </span>
        <span>
          <strong>{drenge}</strong> drenge
        </span>
        {k.elever.length - piger - drenge > 0 && (
          <span>
            <strong>{k.elever.length - piger - drenge}</strong> mangler køn
          </span>
        )}
      </p>
      <p class="hjaelp">
        Ændringer gemmes med det samme. P er pige, D er dreng. GF er grundforløbsholdet; det bruges til at blande eleverne på tværs
        af holdene. "Opdatér fra klasseliste" sætter GF-hold for alle på én gang og viser forskelle mellem listen og klassen.
      </p>
      {k.elever.length - piger - drenge > 0 && (
        <p>
          <button
            class="knap"
            type="button"
            onClick={() => {
              const r = foreslaaKoen(k.elever);
              const tekst =
                (r.gaettet > 0 ? `Køn er sat ud fra navnet ved ${r.gaettet}.` : 'Intet køn kunne afgøres ud fra navnene.') +
                (r.tvivl.length > 0 ? ` Vælg selv ved ${r.tvivl.join(', ')}.` : '');
              medFortryd(tekst, (d) => {
                const x = d.klasser.find((y) => y.id === k.id);
                if (x) x.elever = foreslaaKoen(x.elever).raekker;
              });
            }}
          >
            Foreslå køn ud fra navnene
          </button>
        </p>
      )}
      <ol class="kontrolliste med-hold">
        {k.elever.map((e, i) => {
          const dublet = dubletter.has(i);
          return (
            <li key={e.id}>
              <span class="nr" aria-hidden="true">
                {i + 1}
              </span>
              <input
                key={e.navn}
                type="text"
                defaultValue={e.navn}
                aria-label={`Navn, elev ${i + 1}`}
                aria-invalid={dublet}
                aria-describedby={dublet ? `d-${e.id}` : undefined}
                autocomplete="off"
                spellcheck={false}
                onChange={(ev) => {
                  const v = rydNavn(ev.currentTarget.value);
                  if (!v) {
                    ev.currentTarget.value = e.navn;
                    return;
                  }
                  ev.currentTarget.value = v;
                  opdaterKlasse(k.id, (x) => {
                    const y = x.elever.find((z) => z.id === e.id);
                    if (y) y.navn = v;
                  });
                }}
              />
              <span class="koenvalg" role="group" aria-label={`Køn for ${e.navn}`}>
                {(['P', 'D'] as const).map((kn) => (
                  <button
                    key={kn}
                    type="button"
                    aria-pressed={e.koen === kn}
                    aria-label={kn === 'P' ? 'Pige' : 'Dreng'}
                    title={kn === 'P' ? 'Pige' : 'Dreng'}
                    onClick={() =>
                      opdaterKlasse(k.id, (x) => {
                        const y = x.elever.find((z) => z.id === e.id);
                        if (y) y.koen = y.koen === kn ? null : kn;
                      })
                    }
                  >
                    {kn}
                  </button>
                ))}
              </span>
              <input
                key={`gf-${e.hold ?? ''}`}
                type="text"
                class="hold-felt"
                defaultValue={e.hold ?? ''}
                placeholder="GF"
                maxLength={6}
                aria-label={`GF-hold for ${e.navn}`}
                autocomplete="off"
                onChange={(ev) => {
                  const raa = ev.currentTarget.value.trim();
                  const hold = raa ? normaliserHold(raa) ?? normaliserHold(`GF${raa}`) : undefined;
                  ev.currentTarget.value = hold ?? '';
                  opdaterKlasse(k.id, (x) => {
                    const y = x.elever.find((z) => z.id === e.id);
                    if (!y) return;
                    if (hold) y.hold = hold;
                    else delete y.hold;
                  });
                }}
              />
              <button type="button" class="knap knap-tekst fjern" aria-label={`Fjern ${e.navn}`} onClick={() => fjern(e.id)}>
                Fjern
              </button>
              {dublet && (
                <p class="feltfejl" id={`d-${e.id}`}>
                  Navnet kan ikke skelnes fra en anden elev. Tilføj forbogstav i efternavnet.
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function HoldAdskilt(props: { klasse: Klasse }) {
  const k = props.klasse;
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [fejl, setFejl] = useState<string | null>(null);
  const navn = (id: string) => k.elever.find((e) => e.id === id)?.navn ?? '';

  function tilfoej() {
    if (!a || !b) return setFejl('Vælg to elever.');
    if (a === b) return setFejl('Vælg to forskellige elever.');
    if (k.holdAdskilt.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return setFejl('De to er allerede på listen.');
    setFejl(null);
    opdaterKlasse(k.id, (x) => void x.holdAdskilt.push([a, b]));
    setA('');
    setB('');
  }

  return (
    <section class="kort" aria-labelledby="adskilt-titel">
      <h2 id="adskilt-titel">Hold adskilt</h2>
      <p class="daempet">Elever, der aldrig skal sidde ved samme bord.</p>
      {k.holdAdskilt.length > 0 && (
        <ul class="parliste">
          {k.holdAdskilt.map(([x, y]) => (
            <li key={`${x}|${y}`}>
              <span>
                {navn(x)} og {navn(y)}
              </span>
              <button
                class="knap knap-tekst"
                type="button"
                aria-label={`Fjern ${navn(x)} og ${navn(y)} fra listen`}
                onClick={() =>
                  medFortryd(`${navn(x)} og ${navn(y)} må igen sidde sammen.`, (d) => {
                    const kl = d.klasser.find((z) => z.id === k.id);
                    if (kl) kl.holdAdskilt = kl.holdAdskilt.filter(([p, q]) => !(p === x && q === y));
                  })
                }
              >
                Fjern
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="vaelg-to">
        <ElevVaelger id="adskilt-a" label="Elev" vaerdi={a} onVaelg={setA} klasse={k} />
        <ElevVaelger id="adskilt-b" label="Skal holdes adskilt fra" vaerdi={b} onVaelg={setB} klasse={k} />
        <button class="knap" type="button" onClick={tilfoej}>
          Tilføj
        </button>
      </div>
      {fejl && (
        <p class="feltfejl" role="alert">
          {fejl}
        </p>
      )}
    </section>
  );
}

function FastePladser(props: { klasse: Klasse; lokale: Lokale | null }) {
  const k = props.klasse;
  const [elev, setElev] = useState('');
  const [plads, setPlads] = useState('');
  const [fejl, setFejl] = useState<string | null>(null);
  const lokale = props.lokale;
  if (!lokale) return null;
  const forrest = forresteBorde(lokale);
  const faste = gyldigeLaase(k.faste, lokale, k.elever);
  const optaget = new Set(faste.map((l) => `${l.bordId}#${l.plads}`));
  const navn = (id: string) => k.elever.find((e) => e.id === id)?.navn ?? '';
  const pladsTekst = (bordId: string, p: number) => `Bord ${bordNummer(lokale, bordId)}, plads ${p + 1}`;

  function tilfoej() {
    if (!elev || !plads) return setFejl('Vælg en elev og en plads.');
    const [bordId, p] = plads.split('#') as [string, string];
    setFejl(null);
    opdaterKlasse(k.id, (x) => {
      x.faste = x.faste.filter((l) => l.elevId !== elev);
      x.faste.push({ elevId: elev, bordId, plads: Number(p) });
    });
    setElev('');
    setPlads('');
  }

  return (
    <section class="kort" aria-labelledby="faste-titel">
      <h2 id="faste-titel">Faste pladser</h2>
      <p class="daempet">
        Til elever, der altid skal sidde et bestemt sted. Eleven bliver på pladsen i alle nye planer. Begrundelsen skal ikke skrives
        her.
      </p>
      {faste.length > 0 && (
        <ul class="parliste">
          {faste.map((l) => (
            <li key={l.elevId}>
              <span>
                {navn(l.elevId)}: {pladsTekst(l.bordId, l.plads)}
              </span>
              <button
                class="knap knap-tekst"
                type="button"
                aria-label={`Fjern fast plads for ${navn(l.elevId)}`}
                onClick={() =>
                  medFortryd(`${navn(l.elevId)} har ikke længere fast plads.`, (d) => {
                    const kl = d.klasser.find((z) => z.id === k.id);
                    if (kl) kl.faste = kl.faste.filter((f) => f.elevId !== l.elevId);
                  })
                }
              >
                Fjern
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="vaelg-to">
        <ElevVaelger id="fast-elev" label="Elev" vaerdi={elev} onVaelg={setElev} klasse={k} />
        <div>
          <label for="fast-plads">Plads</label>
          <select id="fast-plads" value={plads} onChange={(e) => setPlads(e.currentTarget.value)}>
            <option value="">Vælg plads</option>
            {lokale.borde.flatMap((b) =>
              Array.from({ length: b.pladser }, (_, p) => {
                const v = `${b.id}#${p}`;
                return (
                  <option key={v} value={v} disabled={optaget.has(v)}>
                    {pladsTekst(b.id, p)}
                    {forrest.has(b.id) ? ' (forrest)' : ''}
                  </option>
                );
              }),
            )}
          </select>
        </div>
        <button class="knap" type="button" onClick={tilfoej}>
          Tilføj
        </button>
      </div>
      {fejl && (
        <p class="feltfejl" role="alert">
          {fejl}
        </p>
      )}
    </section>
  );
}

function ElevVaelger(props: { id: string; label: string; vaerdi: string; onVaelg: (v: string) => void; klasse: Klasse }) {
  return (
    <div>
      <label for={props.id}>{props.label}</label>
      <select id={props.id} value={props.vaerdi} onChange={(e) => props.onVaelg(e.currentTarget.value)}>
        <option value="">Vælg elev</option>
        {[...props.klasse.elever]
          .sort((x, y) => x.navn.localeCompare(y.navn, 'da'))
          .map((e) => (
            <option key={e.id} value={e.id}>
              {e.navn}
            </option>
          ))}
      </select>
    </div>
  );
}

/**
 * Opdatér fra klasseliste: læreren indsætter listen igen (fx med GF-hold),
 * og appen viser, hvem der findes begge steder, kun på listen og kun i
 * klassen. Intet ændres, før læreren trykker "Gem ændringer".
 */
function OpdaterFraListe(props: { klasse: Klasse; onFaerdig: () => void }) {
  const k = props.klasse;
  const [udtraek, setUdtraek] = useState<Udtraek | null>(null);
  const [tilfoej, setTilfoej] = useState<Set<number>>(new Set());
  const [fjern, setFjern] = useState<Set<string>>(new Set());

  if (!udtraek) {
    return (
      <Hent
        titel="Indsæt den nyeste klasseliste"
        tekst="Kopiér klasselisten fra Ludus eller Lectio med kolonnen GF-Klasse, eller tag et skærmbillede. Appen sammenligner listen med klassen. Intet ændres, før du har set forskellene."
        onUdtraek={setUdtraek}
        onTilbage={props.onFaerdig}
        tilbageTekst="Annullér"
      />
    );
  }

  const r = sammenlign(k.elever, udtraek.elever);
  const navn = (id: string) => k.elever.find((e) => e.id === id)?.navn ?? '';
  const nyeHold = r.begge.filter((m) => m.hold && k.elever.find((e) => e.id === m.elevId)?.hold !== m.hold).length;
  const nyeKoen = r.begge.filter((m) => m.koen && !k.elever.find((e) => e.id === m.elevId)?.koen).length;
  const skift = <T,>(saet: Set<T>, v: T) => {
    const ny = new Set(saet);
    if (ny.has(v)) ny.delete(v);
    else ny.add(v);
    return ny;
  };

  function gem() {
    medFortryd('Klassen er opdateret fra klasselisten.', (d) => {
      const x = d.klasser.find((y) => y.id === k.id);
      if (!x) return;
      for (const m of r.begge) {
        const e = x.elever.find((y) => y.id === m.elevId);
        if (!e) continue;
        if (m.hold) e.hold = m.hold;
        if (m.koen && !e.koen) e.koen = m.koen;
      }
      for (const i of tilfoej) {
        const n = r.kunPaaListen[i]!;
        x.elever.push({ id: nyId(), navn: n.navn, koen: n.koen, ...(n.hold ? { hold: n.hold } : {}) });
      }
      if (fjern.size > 0) {
        x.elever = x.elever.filter((e) => !fjern.has(e.id));
        x.holdAdskilt = x.holdAdskilt.filter(([a, b]) => !fjern.has(a) && !fjern.has(b));
        x.faste = x.faste.filter((l) => !fjern.has(l.elevId));
      }
      if (tilfoej.size > 0 || fjern.size > 0) x.kladde = null;
    });
    props.onFaerdig();
  }

  const ingenForskelle = r.kunPaaListen.length === 0 && r.kunIKlassen.length === 0;
  return (
    <section class="kort" aria-labelledby="sammenlign-titel">
      <h2 id="sammenlign-titel">Sammenligning</h2>
      <p class={`meddelelse ${ingenForskelle ? 'meddelelse-ok' : 'meddelelse-bemaerk'}`} role="status">
        {r.begge.length} af {k.elever.length} elever i klassen står på listen.
        {nyeHold > 0 && ` GF-hold bliver sat for ${nyeHold}.`}
        {nyeKoen > 0 && ` Køn bliver sat for ${nyeKoen}, der manglede det.`}
        {ingenForskelle
          ? ' Listen og klassen stemmer overens.'
          : ' Ingen bliver tilføjet eller fjernet, medmindre du sætter flueben herunder.'}
      </p>

      {r.kunPaaListen.length > 0 && (
        <>
          <h3>På listen, men ikke i klassen</h3>
          <p class="hjaelp">De bliver ikke tilføjet, medmindre du sætter flueben. Gør det kun, hvis det er nye elever.</p>
          <ul class="parliste">
            {r.kunPaaListen.map((n, i) => (
              <li key={i}>
                <label class="afkryds" style={{ margin: 0, flex: 1 }}>
                  <input type="checkbox" checked={tilfoej.has(i)} onChange={() => setTilfoej(skift(tilfoej, i))} />
                  Tilføj {n.navn}
                  {n.hold ? ` (${n.hold})` : ''}
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {r.kunIKlassen.length > 0 && (
        <>
          <h3>I klassen, men ikke på listen</h3>
          <p class="hjaelp">
            De bliver i klassen og beholder deres GF-hold (eller et tomt), medmindre du sætter flueben. Er listen ældre end klassen,
            eller er navnet stavet anderledes, skal du ikke gøre noget. Sæt kun flueben, hvis eleven er stoppet.
          </p>
          <ul class="parliste">
            {r.kunIKlassen.map((id) => (
              <li key={id}>
                <label class="afkryds" style={{ margin: 0, flex: 1 }}>
                  <input type="checkbox" checked={fjern.has(id)} onChange={() => setFjern(skift(fjern, id))} />
                  Fjern {navn(id)} fra klassen
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <div class="handlingsbar fast">
        <button class="knap knap-primaer knap-stor" type="button" onClick={gem}>
          Gem ændringer
        </button>
        <button class="knap knap-tekst" type="button" onClick={props.onFaerdig}>
          Annullér
        </button>
      </div>
    </section>
  );
}
