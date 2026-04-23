# M054 — Kosten-regelgeving: Welstand + Parkeer — Doc context

4 cascade-documenten voor M054. Gebruik bij planning van M054-slices.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## GEM-02 — Welstandsnota → `welstand_beperking` (S01/S02)

**Beschrijving:** Onder de Omgevingswet breder te begrijpen als welstandsbeleid / beleidsregels over het uiterlijk van bouwwerken / beeldkwaliteitsplan. Gemeente regelt welstand in het omgevingsplan; bij open normen voor uiterlijk moeten beleidsregels worden vastgesteld. Document hoeft niet meer "welstandsnota" te heten. Gemeentelijke adviescommissie voor omgevingskwaliteit heeft minimaal wettelijke adviesrol voor rijksmonumenten.

**Rol in Propdex:** Welstand-beperking per perceel: in welk regime valt het perceel (welstandsvrij / licht / regulier / streng) en welke criteria gelden voor het uiterlijk van bouwwerken? Bepaalt ontwerp-vrijheid en doorlooptijd (adviescommissie).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `welstandsgebied` | string | Naam/aanduiding van het gebied |
| `welstandsniveau` | enum | Welstandsvrij / beheer / behoud / bijzonder |
| `toetsregime` | enum | Sneltoets / regulier / uitgebreid / commissie-advies |
| `welstandsvrij` | bool | |
| `gebiedsgerichte_criteria` | string | Kernpunten criteria voor dit gebied |
| `objectgerichte_criteria` | string | Voor specifieke bouwtypes |
| `beeldkwaliteitsplan_verwijzing` | string | Indien apart document |
| `adviescommissie_verwijzing` | string | |

**Primaire bronnen:** CVDR voor geconsolideerde teksten en raadsbesluiten. Zoek ook op "beeldkwaliteitsplan", "beleidsregels uiterlijk bouwwerken", "omgevingskwaliteit", "ruimtelijke kwaliteit". Check of omgevingsplan of apart beleidsdocument actuele normen bevat.

**Business-regels:**
- Welstand-badge op perceel: niveau + toetsregime + kerncriterium voor dit gebied
- Ontwerprisico-signaal: streng regime of monumentenomgeving → langere doorlooptijd commissie-advies
- Welstandsvrij-gebieden expliciet markeren als positief voor doorlooptijd

**Edge cases:**
- Onder Omgevingswet: regels over uiterlijk (beleidsregels) en regels over plaatsing soms bij ander bestuursorgaan — twee documenten kunnen nodig zijn
- Naam varieert sterk: "welstandsnota", "beeldkwaliteitsplan", "omgevingskwaliteitsbeleid" — breed zoeken

---

## GEM-04 — Parkeerbeleid → `parkeerdruk` (S03/S04)

**Beschrijving:** Combinatie van parkeernormenbeleid, parkeerverordening en soms aanvullende beleidsregels of gebiedsnota's. Onder de Omgevingswet kunnen parkeernormen dynamisch aan het omgevingsplan worden gekoppeld. Moderne parkeerbeleidsstukken omvatten ook fietsparkeren, laadinfra, deelmobiliteit en maximum parkeerdruk.

**Rol in Propdex:** Twee use cases: (1) ontwikkelparkeren — hoeveel plaatsen moet een plan leveren? (2) reguleringsparkeren — betaald parkeren, vergunningstelsels, blauwe zones. Beide zijn relevant maar hebben verschillende documenten en databronnen.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `parkeerzone` | string | Naam/aanduiding zone |
| `autonorm` | float | Parkeerplaatsen per woning/100m² per functie |
| `fietsnorm` | float | Fietsparkeerplaatsen per woning/eenheid |
| `bezoekersaandeel` | float | % bezoekersparkeren |
| `rekenmethodiek` | string | CROW / eigen methodiek |
| `afwenteling_toegestaan` | bool | Mag op openbare ruimte worden afgewenteld |
| `max_parkeerdruk` | float | Maximum toegestane bezetting openbare ruimte |
| `deelmobiliteit_korting` | float | % reductie bij aantoonbaar deelmobiliteitaanbod |
| `laadinfrastructuur_eis` | string | Percentage laadpunten / voorziening |
| `parkeerverordening_verwijzing` | string | |

**Primaire bronnen:** CVDR voor normdocumenten ("nota parkeernormen", "beleidsregel parkeren", "parkeernota", "parkeerverordening"). Voor vergunning-/betaaldparkeergebieden aparte kaarten of open data.

**Business-regels:**
- Ontwikkelcheck: bij ingevoerd programma automatisch parkeernorm berekenen (auto + fiets) per zone
- Reguleringssignaal: betaald parkeren / vergunningzone in direct omgeving → lagere parkeerlast voor bewoners, maar hogere parkeerkosten bezoekers
- Deelmobiliteitkorting tonen als optie bij projecten met mobiliteitsplan

**Edge cases:**
- Ontwikkelparkeren en reguleringsparkeren zijn verschillende documenten — niet vermengen
- Fietsparkeren wordt nog niet overal expliciet genormeerd — "niet gevonden" vs. "niet van toepassing"

---

## GEM-12 — Duurzaamheidsbeleid → `duurzaamheid_kosten` (S05)

**Beschrijving:** Zelden één document — een familie van themastukken. Sterkste vaste kern: warmteprogramma/transitievisie warmte, aangevuld met klimaatadaptatieprogramma's, uitvoeringsagenda's klimaat, circulaire of energieprogramma's. Onder de Omgevingswet wordt het warmteprogramma de expliciete opvolger van de transitievisie warmte; gemeenten moeten uiterlijk eind 2027 een eerste warmteprogramma vaststellen.

**Rol in Propdex:** Duurzaamheidskosten-context per perceel/wijk: welke warmteoptie is kansrijk (warmtenet, all-electric, hybride), wanneer is de wijk aan de beurt, en welke aanvullende duurzaamheidseisen stelt de gemeente boven Bbl? Voedt de financiële module (verduurzamingsinvestering).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `document_type` | enum | Warmteprogramma / TVW / klimaatplan / duurzaamheidsagenda |
| `klimaatdoeljaar` | int | |
| `wijkgerichte_warmteroute` | string | Per wijk/buurt de geplande warmteoptie |
| `warmteoptie_voorkeur` | enum | Warmtenet / all-electric / hybride / onbekend |
| `aardgasvrij_tijdpad` | string | Planning per wijk |
| `klimaatadaptatie_prioriteiten` | string[] | Hitte, wateroverlast, droogte, overstroming |
| `uitvoeringsagenda_maatregelen` | string[] | Concrete gemeentelijke maatregelen |
| `circulair_bouwen_eis` | bool | Gemeente stelt circulaire bouw als eis |
| `gebiedsdekking` | string | Wijk/gemeente-breed |

**Primaire bronnen:** CVDR + gemeentelijke sites. Zoek op "warmteprogramma", "transitievisie warmte", "klimaatplan", "duurzaamheidsagenda", "uitvoeringsagenda klimaat", "circulair".

**Business-regels:**
- Warmteroute-badge per wijk: "Deze wijk is gepland voor warmtenet in [jaar] / all-electric / nog onbekend"
- Duurzaamheidskosten-inschatting: warmtenet-aansluiting vs. all-electric installatie als kostenvariabele in businesscase
- Extra gemeentelijke eisen boven Bbl signaleren (bijv. circulair bouwen verplicht)

**Edge cases:**
- Als één bron behandelen maakt het onbruikbaar vaag — minimaal warmte-/energielaag en klimaatadaptatie-laag scheiden
- TVW → warmteprogramma overgang: gemeenten in transitie kunnen beide hebben of nog geen van beide — status expliciet tonen
- Wijkplanning is indicatief en kan schuiven; altijd datum vaststellingsbesluit tonen

---

## LAND-07 — BENG & energieprestatie → `beng_kosten` (S05, gecombineerd)

**Beschrijving:** Sinds 1 januari 2021 moeten alle vergunningsaanvragen voor nieuwbouw voldoen aan de eisen voor Bijna Energieneutrale Gebouwen (BENG). Drie indicatoren: (1) maximale energiebehoefte (kWh/m².jr), (2) maximaal primair fossiel energiegebruik (kWh/m².jr), (3) minimaal aandeel hernieuwbare energie (%), berekend via NTA 8800. BENG heeft de oude EPC vervangen en is gekoppeld aan het energielabel (EP‑1/2/3) en TOjuli (oververhitting).

**Rol in Propdex:** Per nieuwbouw- of ingrijpende renovatiecase de minimale energieprestatie-eisen tonen en de verduurzamingsopgave schatten voor bestaande panden: hoeveel maatregelen nodig om naar een toekomstbestendig niveau te komen. Voedt de financiële module (kostenraming verduurzaming).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `BENG1_max` | float | Max energiebehoefte (kWh/m².jr) per gebouwtype |
| `BENG2_max` | float | Max primair fossiel energiegebruik (kWh/m².jr) per gebouwtype |
| `BENG3_min` | float | Min aandeel hernieuwbare energie (%) per gebouwtype |
| `TOjuli_max` | float | Grenswaarde oververhittingsrisico woningen |
| `EP1_waarde` | float | Pand-specifiek uit EP-Online |
| `EP2_waarde` | float | Pand-specifiek uit EP-Online |
| `EP3_waarde` | float | Pand-specifiek uit EP-Online |
| `labelklasse` | enum | A++++ t/m G |
| `voldoet_aan_beng` | bool | Voor nieuwbouwobjecten |
| `bouwfase` | enum | Nieuwbouw / ingrijpende renovatie / bestaande bouw |

**Primaire bronnen:** RVO BENG-pagina's (grenswaarden per gebouwtype), IPLO "Energiezuinigheid: regels bij nieuwbouw", NTA 8800 (methodereferentie), EP-Online webservice.

**Business-regels:**
- Nieuwbouwscenario's: toon of EP1/EP2/EP3 voldoen aan BENG1/2/3 + hoeveel headroom
- Verduurzamingsopgave bestaande bouw: EP-Online label → inschatting maatregelen richting BENG-niveau → financiële module
- Oververhittingsrisico: TOjuli-signaal voor bepaalde woningtypen/oriëntaties

**Edge cases:**
- BENG-eisen gelden alleen voor nieuwbouw/aanvragen vanaf 2021 — bestaande bouw heeft andere kaders (Standaard/Paris Proof), onderscheid duidelijk maken in UI
- Volledig doorrekenen NTA 8800 is gecertificeerde specialistentaak — Propdex leest/toetst EP-indicatoren, vervangt geen gecertificeerde berekeningen
- Grenswaarden kunnen worden aangescherpt (volgende stap verwacht ~2030) — jaargang van gehanteerde normen altijd tonen
