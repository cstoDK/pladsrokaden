// "Sådan håndteres data": en kort, præcis beskrivelse af datastrømmene,
// som kan gives til skolens databeskyttelsesrådgiver.

import { useEffect } from 'preact/hooks';

export function DataSide(props: { onTilbage: () => void }) {
  useEffect(() => {
    document.body.classList.add('data-aaben');
    return () => document.body.classList.remove('data-aaben');
  }, []);
  return (
    <article class="smal dataside">
      <p>
        <button class="knap knap-tekst" type="button" onClick={props.onTilbage}>
          Tilbage
        </button>
        <button class="knap knap-tekst" type="button" onClick={() => window.print()}>
          Udskriv siden
        </button>
      </p>
      <h1>Sådan håndteres data</h1>
      <p class="ingress">
        Pladsrokaden kører helt i din browser. Elevdata gemmes kun på din egen computer og i de sikkerhedskopier, du selv gemmer.
        Intet sendes til nogen server. Skolen er dataansvarlig, og ingen tredjepart behandler elevdata for skolen.
      </p>

      <h2>Hvilke oplysninger gemmes</h2>
      <ul>
        <li>Klassens navn (fx 2.c).</li>
        <li>Elevernes fornavn. Har to elever samme fornavn, tilføjes forbogstavet i efternavnet (fx "Ida H.").</li>
        <li>
          Køn som P (pige) eller D (dreng). Det bruges kun til at blande bordene. Appen foreslår køn ud fra fornavnet med en
          navneliste, der følger med appen, og læreren retter forslaget. Navne, der bruges til begge køn, eller som ikke står på
          listen, gættes ikke.
        </li>
        <li>
          Grundforløbshold i kort form (fx GF02), hvis listen har det. Det bruges kun til at blande eleverne på tværs af holdene.
        </li>
        <li>Lokaler: lokalenummer (fx 007) og indretning, dvs. bordenes placering, tavlen og mobilskabet.</li>
        <li>Bordplanerne med dato. Netværksgrupper og makkerpar gemmes ikke for sig; de følger af, hvor eleverne sidder.</li>
        <li>Par af elever, der skal holdes adskilt, og elever med fast plads. Der gemmes ingen begrundelse.</li>
        <li>Tidspunktet for den seneste sikkerhedskopi.</li>
      </ul>

      <h2>Hvad gemmes aldrig</h2>
      <ul>
        <li>
          Efternavne og mellemnavne (ud over et forbogstav ved dubletter), elevnumre, kursistnumre, CPR-numre, fødselsdatoer, e-mails,
          adresser og valgfag eller sprog.
        </li>
        <li>Indsat tekst og skærmbilleder fra Ludus, Lectio eller andre systemer.</li>
        <li>Fritekst om elever. Der findes ingen felter til noter eller begrundelser.</li>
      </ul>

      <h2>Datastrømme</h2>
      <ol>
        <li>
          <strong>Indsat klasseliste.</strong> Teksten behandles i browserens hukommelse. Fornavnene trækkes ud, og resten smides væk med
          det samme. Teksten gemmes ikke og sendes ikke nogen steder hen.
        </li>
        <li>
          <strong>Skærmbillede.</strong> Billedet læses af tekstgenkendelse (Tesseract), som kører i browseren på din computer.
          Programmet og den danske sprogpakke hentes fra samme sted som resten af appen. Billedet sendes aldrig nogen steder hen og
          gemmes ikke. Det vises kun, mens det bliver læst.
        </li>
        <li>
          <strong>Lagring.</strong> Oplysningerne gemmes i browserens lokale lager (localStorage) på denne computer, under nøglen
          "pladsrokaden.v1". De kan kun ses fra samme browser og brugerprofil. Appen bruger ingen cookies.
        </li>
        <li>
          <strong>Sikkerhedskopi.</strong> "Gem sikkerhedskopi" laver en fil (JSON) på din computer. Du bestemmer selv, hvor den
          gemmes, fx på skolens OneDrive. Sådan flyttes data også mellem computere: med "Hent sikkerhedskopi". Når en fil hentes,
          bruges kun de oplysninger, der er nævnt ovenfor. Alt andet i filen ignoreres.
        </li>
        <li>
          <strong>Deling med kolleger.</strong> Sker kun, når du selv udskriver, gemmer som PDF eller kopierer planen som tekst og
          deler den via skolens egne kanaler (fx Ludus eller Teams). "Vis på tavlen" viser planen i fuldskærm på din egen skærm.
        </li>
      </ol>

      <h2>Netværk</h2>
      <p>
        Når siden åbnes, henter browseren appens filer (program, skrifttype og tekstgenkendelse) fra den webserver, appen ligger på.
        Det er de eneste netværkskald, og de indeholder ingen elevdata. Appen har ingen server, database, login, statistik,
        fejlrapportering eller indhold fra andre websteder.
      </p>
      <p>
        Det håndhæves teknisk af en sikkerhedspolitik (Content-Security-Policy) i siden. Den forbyder browseren at sende data til
        andre steder end appens egen adresse, og appen sender heller ikke data dertil.
      </p>
      <p>
        Webserveren (fx GitHub Pages) kan, som alle webservere, se den besøgendes IP-adresse og browsertype, når filerne hentes. Den
        ser aldrig elevdata. Skolen kan også lægge appen på sin egen server.
      </p>

      <h2>Sletning</h2>
      <ul>
        <li>
          <strong>Slet en klasse:</strong> fanen Elever, nederst.
        </li>
        <li>
          <strong>Slet alt:</strong> Menu øverst til højre, "Slet alt".
        </li>
        <li>
          Begge kan fortrydes i 10 sekunder. Derefter er oplysningerne væk fra denne computer. Sikkerhedskopier slettes ved at slette
          filen.
        </li>
        <li>Oplysningerne slettes også, hvis browserens data for siden ryddes.</li>
        <li>Slet klassen, når du ikke længere er klassens lærer, eller når klassen er færdig.</li>
      </ul>

      <h2>Sikkerhed</h2>
      <p>
        Alle, der kan bruge din computer med din brugerprofil, kan åbne appen og se klassernes planer. Brug derfor din egen,
        låste brugerkonto, og gem sikkerhedskopier et sted, kun du og skolen har adgang til.
      </p>

      <h2>Sådan kan det kontrolleres</h2>
      <p>
        Åbn browserens udviklerværktøjer (F12), fanen "Netværk", og brug appen. Der kommer ingen kald ud over appens egne filer.
        Sikkerhedspolitikken kan ses i sidens kildekode (Ctrl+U) i linjen "Content-Security-Policy". Kildekoden er åben og kan
        gennemgås.
      </p>

      <h2>Programmer, appen bruger</h2>
      <p>
        Preact (MIT-licens), Tesseract.js og dansk sprogpakke (Apache 2.0) og skrifttypen Atkinson Hyperlegible (SIL Open Font
        License). Alle leveres med appen. Intet hentes fra andre websteder.
      </p>
    </article>
  );
}
