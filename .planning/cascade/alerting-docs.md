# Geen scoring-pipeline — Feature/Alerting — Doc context

3 cascade-documenten die geen per-parcel scoring voeden maar als alerting-feature of context worden ingezet.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## LAND-03 — Nationale Woon- en Bouwagenda → puur context (geen scoring)

**Beschrijving:** De Nationale Woon- en Bouwagenda (2022) is het landelijke beleidskader voor 900.000 extra woningen tot en met 2030 (richting 100.000/jaar). Op basis van de Primos-prognose 2023 herijkt naar 981.000 woningen tot 2030 — dit is een behoeftecijfer, geen nieuw politiek doel.

**Rol in Propdex:** Nationale contextlaag — totale nieuwbouwdoelstelling, aandeel betaalbaar en sociaal, prioriteiten per segment/doelgroep. Verbindt landelijke doelen met regionale Woondeals en gemeentelijke woonvisies. Geen per-parcel scoring — te abstract voor directe perceel-impact. Dient als contextwidget en als behoeftebasis voor Ladder trede 1.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `nationaal_doel_woningen_2030` | int | 900.000 (beleidsdoel) |
| `woningbehoefte_2030_primos_2023` | int | 981.000 (behoeftecijfer) |
| `streef_aandeel_betaalbaar` | float | ~2/3 van de nieuwbouw |
| `streef_aandeel_sociaal` | float | ~30% sociale huur |
| `bouwproductie_doel_per_jaar` | int | ~100.000 woningen |
| `segmentdoelen` | object | Sociaal, middenhuur/betaalbaar, vrij, koop/huur |
| `doelgroepen` | string[] | Aandachtsgroepen, ouderen, starters, studenten |

**Primaire bronnen:** Nationale Woon- en Bouwagenda + Programma Woningbouw, Primos-prognose 2023, Rijksoverheid.

**Business-regels:**
- Contextwidget op regio/provincie/gemeentepagina: "Nationaal doel 900k / behoefte 981k; aandeel betaalbaar en sociaal"
- Alignment-score per project: past het woningprogramma bij de landelijke beleidsrichting?
- Ladder trede 1: nationale cijfers + Woondeals + woonvisies vormen samen de behoeftebasis

**Edge cases:**
- Verwarring 900k (beleidsdoel) vs. 981k (behoefte) — beide expliciet labelen
- Segmentdoelen per regio/gemeente zitten in Woondeals en woonvisies; landelijke agenda blijft globaal

---

## LAND-09 — Rijksbeleid monitoring → alerting-feature (geen scoring)

**Beschrijving:** Rijksbeleid rondom wonen, bouwen en de fysieke leefomgeving verandert continu via Kamerstukken, wetsvoorstellen, Kamerbrieven, rapporten en nieuwsberichten. Gepubliceerd via Rijksoverheid.nl, OfficiëleBekendmakingen.nl en het Open Data Portaal van de Tweede Kamer; real-time te volgen via RSS-feeds en APIs.

**Rol in Propdex:** "Beleid in beweging"-feed — zicht op relevante landelijke beleidswijzigingen die impact hebben op woningbouw, omgevingsrecht, energie, stikstof, etc. Helpt ontwikkelaars en investeerders beleidsrisico's en kansen te volgen (Wet versterking regie volkshuisvesting, stikstofregels, huurregulering, grondbeleid).

**Geen per-parcel scoring** — te abstract voor directe perceel-impact. Wel bruikbaar als contextblok in rapporten en als notificatie-trigger.

**Te extraheren / monitoren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `type_document` | enum | Kamerstuk / wetsvoorstel / Kamerbrief / rapport / nieuwsbericht |
| `onderwerp_thema` | string[] | Wonen, volkshuisvesting, omgevingswet, stikstof, huur, energie, grondbeleid |
| `datum_publicatie` | date | |
| `status` | enum | Nieuw / aangenomen / in behandeling / consultatie |
| `relevantie_score` | float | Op basis van trefwoorden (wonen, volkshuisvesting, omgevingswet, stikstof) |
| `impact_type` | enum | Informatief / beleidswijziging concreet / aankondiging / consultatie |
| `ruimtebeperkend_of_gevend` | enum | Op basis van AI-analyse: meer regulering vs. meer versoepeling |

**Primaire bronnen:**
- Rijksoverheid RSS-feeds "Alle Kamerstukken" + per ministerie (BZK, VRO, IenW, EZK)
- OfficiëleBekendmakingen RSS (Kamerstukken, Staatsblad, Staatscourant)
- Tweede Kamer Open Data Portaal (OData/SyncFeed) voor wetsvoorstellen, moties, amendementen

**Business-regels:**
- "Beleid in beweging"-feed op Propdex-landingspagina: meest recente + meest relevante beleidswijzigingen
- Contextblok in rapporten: "Er lopen X relevante wetsvoorstellen over huurregulering / stikstof / volkshuisvesting"
- Alerts voor gebruikers wanneer beleidswijziging direct raakt aan hun projecten

**Edge cases:**
- Hoog volume RSS-ruis — sterk filteren op relevante thema's; geen overload voor gebruikers
- Veel stukken zijn voorgenomen beleid (consultatie/voorstel) — duidelijk onderscheid "voorgesteld" vs. "in werking"
- Afhankelijkheid van Tweede Kamer Open Data API + RSS-endpoints — RSS (Rijksoverheid/Officiële bekendmakingen) als fallback

---

## GEM-16 — Nieuws & beleidsmonitoring → alerting-feature (geen scoring)

**Beschrijving:** Gemeentelijke nieuws- en besluitenstromen als officiële eerste laag, gevolgd door journalistieke media. Gemeenten publiceren nieuwsberichten, collegebesluiten, raadsstukken en themapagina's op eigen sites; sommige met nette RSS-feeds (bijv. Amsterdam met geoRSS/GeoJSON voor locatiegebonden pagina's). Geen scoring — te contextgebonden en kort-cyclisch voor per-parcel factor.

**Rol in Propdex:** Alerting-feature: signaleert nieuwe gemeentelijke besluiten, collegeberichten of nieuwsitems die een specifiek project of gebied raken. Onderscheidt officiële publicaties van journalistieke bronnen.

**Te extraheren / monitoren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `bron_type` | enum | Officieel-gemeente / collegebesluit / raadsstuk / media |
| `publicatiedatum` | date | |
| `thema` | string[] | Wonen, vergunning, erfgoed, duurzaamheid, etc. |
| `locatie` | string | Adres of gebiedsnaam indien benoemd |
| `beleidsfase` | enum | Voornemen / besluit / uitvoering / bezwaar |
| `betrokken_project` | bool | Koppelbaar aan known project in Propdex |
| `officieel_of_mediaal` | enum | Officieel / journalistiek |
| `samenvatting` | string | AI-samenvatting |

**Primaire bronnen:** Gemeentelijke nieuwspagina's + RSS-feeds + collegebesluiten + raadsinformatie (eerste laag). Lokale media en sectorpublicaties als tweede laag voor sentiment en politieke context.

**Business-regels:**
- Gebruiker ziet in één oogopslag of signaal uit officiële bron of journalistieke bron komt
- Locatiegekoppelde alerts: nieuw collegebesluit dat adres/perceel raakt → notificatie
- Feed op gemeente-/wijkpagina: meest recente relevante officiële berichten

**Edge cases:**
- Zonder strikte scheiding officieel/mediaal wordt monitorlaag luidruchtig en analytisch zwak — scheiding zit in datamodel, niet alleen in interface
- Gemeenten zonder goede RSS-feeds vereisen scraping — hogere onderhoudslast, lager vertrouwen in volledigheid
