// Historik: tidligere planer og en oversigt pr. elev.

import { useMemo, useState } from 'preact/hooks';
import { planTitel } from '../../core/dato';
import { elevStatistik } from '../../core/historik';
import { type Klasse } from '../../core/model';
import { medFortryd } from '../../app/tilstand';
import { DelKnapper } from '../plan/Deling';
import { Lokaletegning } from '../plan/Lokaletegning';

export function HistorikFane(props: { klasse: Klasse }) {
  const k = props.klasse;
  const [aaben, setAaben] = useState<string | null>(null);
  const navn = useMemo(() => {
    const m = new Map(k.elever.map((e) => [e.id, e.navn]));
    return (id: string) => m.get(id) ?? 'Tidligere elev';
  }, [k.elever]);
  const statistik = useMemo(
    () => elevStatistik(k.elever, k.planer).sort((a, b) => navn(a.elevId).localeCompare(navn(b.elevId), 'da')),
    [k.elever, k.planer, navn],
  );
  const planer = [...k.planer].reverse();

  return (
    <div class="stak">
      <section class="kort" aria-labelledby="planer-titel">
        <h1 id="planer-titel">Tidligere planer</h1>
        {planer.length === 0 && <p class="daempet">Der er ingen gemte planer endnu.</p>}
        <ul class="planliste">
          {planer.map((p, i) => (
            <li key={p.id}>
              <div class="planliste-raekke">
                <span class="planliste-titel">
                  {planTitel(p.dato)}
                  {i === 0 && <span class="maerke">Gældende</span>}
                </span>
                <button class="knap" type="button" aria-expanded={aaben === p.id} onClick={() => setAaben(aaben === p.id ? null : p.id)}>
                  {aaben === p.id ? 'Skjul' : 'Vis'}
                </button>
                {i === 0 && (
                  <button
                    class="knap knap-tekst knap-fare"
                    type="button"
                    onClick={() =>
                      medFortryd(`Planen for ${planTitel(p.dato).toLowerCase()} er slettet.`, (d) => {
                        const x = d.klasser.find((y) => y.id === k.id);
                        if (x) x.planer = x.planer.filter((y) => y.id !== p.id);
                      })
                    }
                  >
                    Slet seneste plan
                  </button>
                )}
              </div>
              {aaben === p.id && (
                <div class="planliste-indhold">
                  <DelKnapper klasse={k} plan={p} />
                  <Lokaletegning lokale={p.lokale} placering={p.placering} navn={navn} overskrift={`Bordplan, ${planTitel(p.dato)}`} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {k.planer.length > 0 && (
        <section class="kort" aria-labelledby="elev-titel">
          <h2 id="elev-titel">Oversigt pr. elev</h2>
          <p class="daempet">
            Tallene tæller alle {k.planer.length} gemte planer. "Mangler at sidde med" er antal klassekammerater, eleven endnu ikke har
            siddet ved bord med.
          </p>
          <div class="tabel-ramme">
            <table class="tabel">
              <thead>
                <tr>
                  <th scope="col">Elev</th>
                  <th scope="col">Gange forrest</th>
                  <th scope="col">Gange eneste af sit køn ved bordet</th>
                  <th scope="col">Mangler at sidde med</th>
                </tr>
              </thead>
              <tbody>
                {statistik.map((s) => (
                  <tr key={s.elevId}>
                    <th scope="row">{navn(s.elevId)}</th>
                    <td>{s.gangeForrest}</td>
                    <td>{s.gangeAlene}</td>
                    <td>{s.ikkeMoedt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
