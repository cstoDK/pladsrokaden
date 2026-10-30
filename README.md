# Pladsrokaden

Faste bordplaner til klasselærere. Pladsrokaden laver en ny bordplan på et øjeblik og sørger for, at eleverne får nye sidemakkere, skiftes til at sidde forrest, og at kønnene blandes ved bordene. Lavet til klasselærere på hhx (Niels Brock), der laver nye planer hver 3. til 4. uge.

Appen er en ren statisk side. Alt kører i browseren, og elevdata forlader aldrig lærerens computer.

## Sådan bruges den

1. **Elever:** kopiér hele klasselisten fra Ludus eller Lectio, og indsæt den (Ctrl+V). Du kan også indsætte et skærmbillede eller skrive navnene. Ret navnene, og sæt køn med ét tryk.
2. **Lokale:** vælg en opstilling (borde à 2 eller grupper à 3, 4 eller 5) og hvor mange rækker der tæller som forrest.
3. **Første plan:** forslaget laves med det samme. Byt elever ved at trykke på to, eller træk dem. Tryk "Gem plan".

Derefter åbner appen på den gældende plan med "Lav ny plan". Planen kan udskrives (én A4-side), kopieres som tekst eller vises på tavlen. Prøv "Se en demoklasse" for at se det hele med opdigtede elever.

## Databeskyttelse

Skolen er dataansvarlig, og appen gør ingen tredjepart til databehandler af elevdata.

- **Ingen server:** ingen backend, database, login, analytics, cookies eller fejlrapportering.
- **Ingen netværkskald med elevdata:** alle biblioteker, skrifttypen og tekstgenkendelsen (Tesseract.js med dansk sprogpakke) leveres med appen. En streng Content-Security-Policy (`connect-src 'self'`) håndhæver det teknisk.
- **Lagring:** kun i browserens localStorage (nøglen `pladsrokaden.v1`) og i sikkerhedskopier (JSON), som læreren selv gemmer, fx på skolens OneDrive.
- **Dataminimering:** der gemmes kun fornavn (evt. med forbogstav i efternavnet ved dubletter), køn (P/D), bordplaner, "hold adskilt"-par og faste pladser. Rådata fra import kasseres med det samme. Der er ingen fritekstfelter om elever. Sikkerhedskopier indlæses strengt, så ukendte felter i en fil aldrig gemmes.
- **Let sletning:** "Slet klasse" under Elever og "Slet alt" i menuen.

Siden **"Sådan håndteres data"** i appen (menuen og sidefoden) beskriver datastrømmene præcist og kan udskrives til skolens databeskyttelsesrådgiver.

Om hosting: webserveren (fx GitHub Pages) ser, som alle webservere, den besøgendes IP-adresse, når filerne hentes. Den ser aldrig elevdata. Skolen kan også lægge appen på sin egen server (se nedenfor).

## Udvikling

Kræver Node.js 22.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

`npm run dev` og `npm run build` kopierer først Tesseract.js og den danske sprogpakke fra `node_modules` til `public/tesseract/` (`scripts/kopier-tesseract.mjs`). CSP'en sættes kun i det byggede site, fordi udviklingsserveren bruger inline-scripts. Brug `npm run build && npm run preview` for at afprøve med CSP.

### Opbygning

```
src/core/      Ren logik uden DOM, med tests
  model.ts       Datamodellen
  optimering.ts  Bordplanalgoritmen (simuleret udglødning)
  historik.ts    Historik: forrest, par, eneste af sit køn, elevstatistik
  forklaring.ts  Statusmærker og problemer pr. bord i almindeligt dansk
  import.ts      Udtræk af fornavne fra indsat tekst og tekstgenkendelse
  kladde.ts      Byt, lås, faste pladser
  lokale.ts      Skabeloner og opbygning af lokalet
  fil.ts         Sikkerhedskopi (streng indlæsning)
  demo.ts        Demoklasse med opdigtede elever
src/app/       Tilstand, lagring og handlinger
src/ui/        Preact-komponenter
docs/UX.md     UX-gennemgang
```

### Bordplanalgoritmen

Simuleret udglødning: 8 starter fra tilfældige fordelinger, hver med 20.000 forsøg på at bytte to elever (eller flytte en elev til en tom plads, når fordelingen stadig er jævn). Kun de to berørte borde regnes igen ved hvert forsøg, så 35 elever tager 30 til 90 ms. Låste elever flyttes aldrig. Den samlede straf er summen over bordene:

| Hensyn | Straf | Standardvægt |
|---|---|---|
| Retfærdig rotation forrest | pr. elev ved et forreste bord: vægt × antal tidligere gange forrest, plus ekstra hvis forrest i sidste plan | 50 og 200 |
| Nye relationer | pr. par ved samme bord: vægt × sum over tidligere planer, hvor parret sad sammen. Nyere planer vægter mere: 4 (sidste), 2,5, 1,5, derefter 1 | 10 |
| Kønsbalance | vægt × (antal drenge ved bordet − forventet ud fra klassens fordeling)² | 6 |
| Eneste af sit køn (bord med mindst 3) | pr. elev, plus ekstra hvis det også skete i sidste plan, plus for hver tidligere gang | 25, 250 og 25 |
| Hold adskilt | pr. par ved samme bord | 10⁹ |

Elever uden angivet køn tæller ikke med i kønsbalancen. Passer elevtallet ikke med pladserne, fordeles eleverne, så der højst er én elev i forskel ved bordene. Vægtene står i `STANDARDVAEGTE` i `src/core/optimering.ts`.

Testene (`src/core/optimering.test.ts`) viser blandt andet: ingen gentagne makkere over 6 runder, retfærdig rotation forrest over 6 runder (ingen to gange i træk, højst én gangs forskel), ingen eneste af sit køn to gange i træk, "hold adskilt" overholdes altid, låste elever står fast, og en plan tager under et sekund.

Bemærk: hvis mange borde tæller som forrest (fx 3 af 6 grupper), kan gentagne bordmakkere ikke altid undgås, fordi de forreste borde skal fyldes med elever fra få borde bagved. Appen advarer om det, når lokalet sættes op.

### Import

`src/core/import.ts` finder fornavne i rodet tekst: tabulatorer og kolonner, overskrifter (Elev, Navn, Fornavn, Efternavn, Køn), "Efternavn, Fornavn", efternavne med versaler, navnepartikler (al-, de, van), og den smider klassekoder, numre, e-mails, datoer, CPR-lignende numre, menuord fra Ludus og Lectio samt udmeldte elever væk. HTML-tabeller fra udklipsholderen læses inaktivt. Tekst fra tekstgenkendelse renses for typiske fejl ("ldaTestesen" bliver til "Ida Testesen"). Kun fornavn, køn og højst to bogstaver af efternavnet (til dubletter) forlader modulet. Testene bruger realistiske, opdigtede eksempler.

### Forslag til køn

`src/core/koensgaet.ts` foreslår køn ud fra fornavnet med en kurateret navneliste i `src/core/navnedata.ts` (almindelige danske navne for årgangene i gymnasiet og navne, der er almindelige i de største indvandrergrupper). Navne, der bruges til begge køn (fx Kim, Robin, Alex, Isa, Nour), og ukendte navne gættes ikke. De markeres "Vælg køn" på kontrolskærmen. Et køn, læreren har valgt, eller som stod i den indsatte liste ("Ida P" eller en Køn-kolonne), overskrives aldrig. Listen kan udvides ved at tilføje navne i `navnedata.ts`. En test sikrer, at intet navn står som både pige- og drengenavn.

## Udgivelse

### GitHub Pages

1. Læg repoet på GitHub.
2. Gå til **Settings > Pages**, og vælg **Source: GitHub Actions**.
3. Gå til **Actions > Udgiv på GitHub Pages > Run workflow**.

Workflowet (`.github/workflows/pages.yml`) kører tests, bygger og udgiver. Det kører kun, når det startes manuelt. `.github/workflows/test.yml` kører tests ved hvert push og udgiver intet.

### Skolens egen server

`npm run build` giver mappen `dist/` med statiske filer. Kopiér mappen til en hvilken som helst webserver. Alle stier er relative, så appen virker i en undermappe. Serveren skal levere `.wasm.js`- og `.gz`-filer uændret (ingen ekstra komprimering af `dan.traineddata.gz`).

Skolen kan også sætte CSP'en som HTTP-header på serveren i stedet for (eller ud over) `<meta>`-tagget. Se `CSP` i `vite.config.ts`.

## Design og brugervenlighed

Appen er designet efter disse principper. Hele gennemgangen, og hvad der blev rettet, står i [docs/UX.md](docs/UX.md).

- **Nielsens 10 heuristikker:**
  - **Synlig status:** kladdebanner, statusmærker, fremskridt ved tekstgenkendelse, "Alt gemmes automatisk".
  - **Den virkelige verden:** bord, plads, tavle, forrest. Lokalet tegnes med tavlen øverst.
  - **Brugerkontrol:** fortryd overalt, Esc og Ctrl+Z.
  - **Konsistens:** samme lokaletegning og elevliste overalt, én accentfarve.
  - **Forebyg fejl:** "Gem lokale" er slået fra ved for få pladser, dubletter markeres, advarsel om lokaler med mange forreste borde.
  - **Genkendelse frem for hukommelse:** den valgte elev vises med de mulige handlinger.
  - **Effektivitet:** Ctrl+V hvor som helst, træk-og-slip, tastaturgenveje.
  - **Minimalisme:** ingen dekoration. Lås og detaljer vises først, når de skal bruges.
  - **Fejlbeskeder, der siger, hvad man gør:** "Tilføj 1 bord under "Tilpas antal"".
  - **Hjælp:** korte hjælpetekster på stedet og siden om data.
- **Steve Krug, "Don't Make Me Think":** én tydelig primær handling pr. skærm i accentfarven. Knapper siger præcis, hvad der sker ("Gem 26 elever og fortsæt"). Appen gætter for læreren (fornavne, antal borde, dato, første forslag).
- **Trinvis afsløring:** guide i tre trin, hvor kun det aktuelle vises. Importmåder som faneblade og kontrolskærm bagefter. "Tilpas antal" er skjult, og lås vises først, når en elev er valgt.
- **Hicks lov:** to valg på velkomstskærmen, fire skabeloner, sjældne handlinger i menuen.
- **Gode standardvalg:** borde à 2, 1 forreste række, dagens dato, antal borde ud fra elevtallet.
- **Fortryd frem for bekræftelser:** ingen bekræftelsesdialoger. Alle sletninger kan fortrydes i 10 sekunder.
- **Tilgængelighed (WCAG 2.2 AA):**
  - Kontrolleret med axe-core på alle skærme i to bredder, med tastatur alene og ved 320 px.
  - Fuld tastaturbetjening og synligt fokus.
  - Skærmlæseretiketter og live-annonceringer.
  - Trykflader på mindst 44 px.
  - Respekt for reduceret bevægelse.
  - Skrifttypen Atkinson Hyperlegible.

## Licenser for tredjepartskode

Preact (MIT), Tesseract.js og tesseract.js-core (Apache 2.0), dansk sprogpakke fra tessdata (Apache 2.0), Atkinson Hyperlegible (SIL Open Font License 1.1). Alt leveres med appen.
