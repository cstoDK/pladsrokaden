# UX-gennemgang af Pladsrokaden

Appen er designet og gennemgået mod principperne herunder. For hvert princip står der, hvor det er brugt, og hvad gennemgangen i fase 5 fandt og rettede.

## Nielsens 10 heuristikker

| Heuristik | Hvor i appen |
|---|---|
| 1. Synlig systemstatus | Kladden har banneret "Kladde. Ikke gemt endnu." Statusmærker over planen ("Ingen er forrest to gange i træk"). Fremskridt i procent under tekstgenkendelse. Optælling af elever, piger, drenge og manglende køn på kontrolskærmen. Sidefod: "Alt gemmes automatisk i denne browser." Beskeder nederst efter hver handling ("Planen for uge 44 er gemt"). |
| 2. Match med den virkelige verden | Lærerens ord: bord, plads, tavle, forrest, sidemakker, hold adskilt. Lokalet tegnes, som det ser ud, med tavlen øverst. Ugenumre efter dansk standard (ISO 8601). |
| 3. Brugerkontrol og frihed | Frem og tilbage overalt (efter brugerfeedback): startside med alle klasser (klik på "Pladsrokaden"), faner, der altid er synlige, trin, der kan klikkes, og browserens tilbage- og frem-knapper virker, fordi hver skærm har sin egen adresse. Statusmærker, der kan rettes, har et link derhen ("1 elev mangler køn ... Ret under Elever"). Fortryd overalt i stedet for bekræftelser: byt, lås og nyt forslag (knap og Ctrl+Z), fjern elev, slet plan, slet klasse, slet alt, kassér kladde, hent sikkerhedskopi. Esc annullerer et valg. Kladden er en kladde, indtil man trykker "Gem plan". |
| 4. Konsistens og standarder | Samme kontrolliste for elever i import og under Elever. Samme lokaletegning i forhåndsvisning, kladde, plan, historik, print og tavle. Én accentfarve kun til den primære handling. Ctrl+Z, Ctrl+V, Esc og Tab virker som forventet. |
| 5. Forebyg fejl | "Gem lokale" er slået fra, når der er for få pladser, og beskeden siger, hvor mange borde der mangler. Dubletnavne markeres, før man gemmer. "Hold adskilt" kan ikke brydes af algoritmen. En advarsel vises, når lokalet gør gentagne bordmakkere uundgåelige. Låste elever flyttes ikke ved "Nyt forslag". |
| 6. Genkendelse frem for hukommelse | Valgte elev vises i en bjælke med de mulige handlinger (Lås på pladsen, Annullér). Skabeloner vises som små tegninger. Forklaringer står ved bordet, de handler om. |
| 7. Fleksibilitet og effektivitet | Hurtige veje for øvede: Ctrl+V hvor som helst i importen, træk-og-slip, tastaturgenvejene L og Esc, "Kopiér som tekst". Begyndere kan klikke sig igennem uden at kende genvejene. |
| 8. Æstetisk og minimalistisk design | Lys, rolig baggrund, ingen dekoration, gradienter eller emojis. Låseknappen vises kun for den valgte elev (før: en knap ved alle 35 pladser). "Tilpas antal" er gemt bag en knap. |
| 9. Hjælp til at genkende og rette fejl | Fejlbeskeder siger, hvad man gør: "Der er 26 elever, men kun 24 pladser. Tilføj 1 bord under "Tilpas antal"." eller ""Ida" kan ikke skelnes fra en anden elev. Tilføj forbogstavet i efternavnet, fx "Ida H."". Fokus flyttes til feltet, der skal rettes. |
| 10. Hjælp og dokumentation | Korte hjælpetekster der, hvor de bruges (fx trinene til at kopiere fra Ludus/Lectio). Siden "Sådan håndteres data". Ingen manual nødvendig. |

## Steve Krug: "Don't Make Me Think"

- Hver skærm har én tydelig primær handling i accentfarven: "Opret din første klasse", "Gem elever og fortsæt", "Gem lokale og lav første plan", "Gem plan", "Lav ny plan".
- Knapper siger præcis, hvad der sker ("Gem 26 elever og fortsæt", ikke "OK").
- Appen gætter for læreren: fornavne findes automatisk i indsat tekst, antal borde foreslås ud fra elevtallet, første forslag laves med det samme, datoen er udfyldt.
- Selvforklarende tekster frem for instruktioner: "Tryk på to elever for at bytte dem, eller træk en elev hen på en anden plads."

## Trinvis afsløring

- Første gang: tre trin (Elever, Lokale, Første plan) med en trinviser. Kun det aktuelle trin vises.
- Import: man vælger én af tre måder (faneblade), og kontrolskærmen kommer først, når der er navne.
- Lokalet: skabelon først. Detaljerne (antal borde, pladser, borde pr. række) ligger bag "Tilpas antal".
- Planen: låsning vises først, når man har valgt en elev.
- Efter guiden åbner appen direkte på den gældende plan. Elever, Lokale og Historik ligger i faneblade.

## Hicks lov (få valg ad gangen)

- Velkomst: to valg (opret klasse eller se demo).
- Fire skabeloner til lokalet i stedet for frie felter.
- Topbjælken: klassevælger, "Ny klasse" og "Menu". På mobil flyttes "Ny klasse" ind i menuen.
- Sjældne handlinger (sikkerhedskopi, slet alt) ligger i menuen.

## Gode standardvalg

Borde à 2 med 4 pr. række, 1 forreste række, dagens dato, antal borde ud fra elevtallet, indsæt liste som første importmåde, fletning ved hentning af sikkerhedskopi.

## Fortryd frem for bekræftelser

Der er ingen bekræftelsesdialoger i appen. Alle sletninger sker med det samme og viser en besked med "Fortryd" i 10 sekunder.

## Tilgængelighed (WCAG 2.2 AA)

Kontrolleret med axe-core (WCAG 2.0/2.1/2.2 A og AA samt best practice) på alle skærme i 1280 px og 375 px bredde, med tastatur alene og ved 320 px bredde (svarer til 400 % zoom).

- Fuld tastaturbetjening: "Spring til indhold", faneblade med piletaster, skabeloner som radiogruppe med piletaster, pladser vælges og byttes med Enter, L låser, Esc annullerer, Ctrl+Z fortryder.
- Synligt fokus: 3 px blå ramme på alt, der kan betjenes. Fokus flyttes til overskriften ved skift mellem trin og skærme, så man ikke mister sin plads. `scroll-padding` sørger for, at fokus ikke gemmer sig under klæbende bjælker (WCAG 2.4.11).
- Skærmlæsere: alle knapper og felter har etiketter ("Bord 3, plads 1: Ida, låst"). Handlinger annonceres i en live-region ("Lea og Noah har byttet plads"). Fejl er knyttet til felterne med `aria-describedby` og `aria-invalid`.
- Kontrast: al tekst og alle kontroller over AA (4,5:1 for tekst, 3:1 for kontroller).
- Trykflader: mindst 44 × 44 px.
- Reduceret bevægelse: appen har ingen animationer, og `prefers-reduced-motion` slår også overgange fra.
- Læsbar skrift: Atkinson Hyperlegible (self-hostet), 17 px grundstørrelse.

## Lokaler, netværksgrupper og makkerpar (tilføjet senere)

- **Direkte manipulation:** borde, tavle og mobilskab trækkes på plads med mus eller finger (Pointer Events) og kan flyttes med piletasterne. Ændringer kan fortrydes (knap og Ctrl+Z).
- **Genkendelse frem for hukommelse:** lokaler vælges efter nummer og huskes med indretningen. Netværksgrupper har hver sin farve og et nummer (G1, G2 ...), så farven ikke er den eneste markering; makkerpar er adskilt af en tydelig streg.
- **Forebyg fejl:** editoren advarer, når borde står oven i hinanden, når der er for få pladser, og når opstillingen tvinger en elev til at sidde alene.
- **Synlig status:** "Det kunne ikke undgås" samler problemerne bord for bord under lokalet, og gruppeoversigten står under bordplanen og på printets side 2.
- **Hele lokalet på én skærm:** lokalet skaleres til skærmens bredde og højde og må bruge hele bredden. Bordene tegnes lavere end de er brede (som rigtige borde), så navnene kan være større. Kun på telefoner ruller lokalet, fordi et helt lokale ikke kan vises læsbart dér.
- **Ens skriftstørrelse:** alle navne har samme størrelse (efter brugerfeedback: forskellige størrelser var forstyrrende). Størrelsen bestemmes af det længste navn.

## Fundet og rettet i gennemgangen

| Fund | Rettelse |
|---|---|
| Låseknapper ved hver plads var 30 til 36 px brede og gav 70 tabulatorstop. | Lås vises kun for den valgte elev i en bjælke, med genvejstasten L. Låste elever har et ikon. |
| Overskrifter sprang fra h1 til h3 ved bordene. | Skjult h2 "Bordplan" over bordene. |
| Bordene var landemærker, som gik igen i tavlevisningen. | Bordene er grupper (`role="group"`) i stedet for regioner. |
| Lokalet kunne rulles på mobil, men ikke nås med tastaturet. | Rullerammen er en region med etiket og kan få fokus. |
| Fokus forsvandt, når en knap forsvandt (fx "Gem elever" eller "Lav ny plan"). | Fokus flyttes til den nye skærms overskrift. |
| Ved 320 px var siden 5 px for bred (lang klassenavn i topbjælken). | Klassevælgeren kan krympe; "Ny klasse" ligger i menuen på mobil. |
| "Fjern" lå for tæt på kønsknapperne på mobil. | Mere luft mellem rækkerne. |
| En plan dateret tilbage i tiden kom sidst i historikken. | Planerne sorteres efter dato. |
| En klasse uden elever viste en fejl, når man prøvede at lave en plan. | Tom tilstand: "2.c har ingen elever endnu" med knappen "Tilføj elever". |
| Ingen viste, at data gemmes automatisk. | Sidefod: "Alt gemmes automatisk i denne browser. Intet sendes nogen steder hen." |

## Designtjekliste (visuelt hierarki)

Lavet ud fra Refactoring UI (Wathan og Schoger), Gestalts nærhedsprincip og
WCAG 2.2 (2.5.8 Target Size Minimum). Gennemgået på planskærmen ved 1280×650
(en bærbar med 150 % skalering) og 1920×960.

| # | Punkt | Hvad vi gjorde |
|---|-------|----------------|
| 1 | Indhold før værktøjer: lokalet er det vigtigste og skal fylde mest | Toppen fylder ca. 130 px mindre; lokalet starter højere oppe |
| 2 | Én primær handling pr. skærm | Kun "Gem plan" / "Lav ny plan" er blå og store; resten er sekundære; "Kassér kladde" er et link |
| 3 | Nedton det sekundære | Statusmærker, beskeder og påmindelser er mindre og lettere |
| 4 | Nærhed: det der hører sammen, står sammen | Kladde-mærke og hjælpetekst står ved overskriften i stedet for i et eget gult banner; "Flyt borde" står i samme række som deleknapperne |
| 5 | Fast afstandsskala | Afstande mellem blokke er 12 px; inde i grupper 6 til 8 px |
| 6 | Få skriftstørrelser i en klar rækkefølge | 13, 14, 15, 16, 19, 22 px; h2 var større end h1 og er rettet |
| 7 | Navne i lokalet er læsbare | Mindst 13 px og altid inde i pladsen; hellere rulle lidt end ulæselig tekst |
| 8 | Trykflader | 36 px med mus, 44 px på berøringsskærme (mindstekrav er 24 px) |
| 9 | Kontrast og konsistens | axe: ingen fejl på 26 skærme |

### Anden runde: ro i layoutet

Tjeklisten ovenfor gjorde toppen mindre, men siden føltes stadig urolig ved
normal zoom. Årsagerne og rettelserne:

- **Ingen marginer.** Indholdet gik næsten fra kant til kant. Nu står alt i én
  centreret spalte på 960 px med brede marginer (op til 6 rem), også i
  topbjælken, så øjet har et fast sted at starte.
- **To menuer oven på hinanden.** Under opsætningen er trinene (Elever, Lokale,
  Første plan) nu den eneste navigation; fanerne kommer først, når den første
  plan er gemt.
- **For meget fed skrift.** Knapper, faner og feltnavne er halvfede (600) i
  stedet for fede; trinene er ikke længere understregede.
- **Mere luft.** Større afstand mellem kort og omkring overskrifter.
- **Lokalet som et stort billede.** Teksten står i den smalle spalte, men
  lokalet må gå ud over den (op til 1240 px), så navnene stadig er mindst 13 px.
