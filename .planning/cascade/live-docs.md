# LIVE — Al actief, geen nieuwe scoring-pipeline nodig — Doc context

6 cascade-documenten die al via bestaande APIs werken. Ter referentie; geen bouw-actie nodig.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## LAND-01 — Omgevingswet & Bbl → `vergunning_succeskans`, `bestemmingswijziging` (LIVE via omgevingsplan)

**Beschrijving:** De Omgevingswet met de vier AMvB's (waaronder het Besluit bouwwerken leefomgeving, Bbl) vormen de landelijke ruggengraat voor alle bouw- en gebruiksactiviteiten. Het Bbl bevat de technische rijksregels voor bouwwerken op het gebied van veiligheid, gezondheid, bruikbaarheid en duurzaamheid. Vervangt het oude Bouwbesluit 2012.

**Rol in Propdex:** Juridisch minimumkader — aan welke technische eisen een project altijd moet voldoen. Rijkslaag in de cascade: regels die overal gelden en lokaal slechts aangescherpt mogen worden. Voedt Potentie- en Risicoscore met generieke risico's bij verbouw/transformatie (brand, constructie, toegankelijkheid, energieprestatiegap).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `activity_type` | enum | Technische bouwactiviteit / sloopactiviteit / gebruik / in stand houden |
| `permit_type` | enum | Vergunningplichtig / meldingsplichtig / vergunningvrij |
| `use_function` | enum | Wonen, kantoor, bijeenkomst, industrie, etc. |
| `building_phase` | enum | Nieuwbouw / verbouw / bestaande bouw |
| `topic` | string[] | Brand, constructie, gezondheid, energie, bruikbaarheid |
| `summary` | string | Compacte samenvatting relevante eisen |

**Primaire bronnen:** wetten.overheid.nl / BWB voor Omgevingswet, Bbl, Bal en Bkl. Ingest via BWB XML/REST-API, mutatiegedreven na Staatsblad-publicatie.

**Business-regels:**
- Rijksregels-widget op perceelpagina: per planvariant tonen welke rijksactiviteiten spelen en of ze vergunning- of meldingsplichtig zijn
- Minimumniveau-check: "Bbl-achterstand vermoed" bij bestaande bouw met vermoedelijke tekortkomingen
- Bouwfase-bewust: altijd expliciet welk Bbl-regime van toepassing is (nieuwbouw/verbouw/bestaand)

**Edge cases:**
- Overgangsrecht en bruidsschat (oude regels tijdelijk in omgevingsplannen) — onderscheid rijksregels vs. omgevingsplanregels
- Bbl-voorschriften zijn prestatie-eisen — niet presenteren alsof Propdex NEN-berekeningen uitvoert
- Samenloop met Bal/Bkl — markeren welke eisen uit welke AMvB komen

---

## GEM-06 — Vergunning-klimaat → `vergunning_succeskans` (LIVE via SRU bekendmakingen)

**Beschrijving:** Geen standaard juridisch document — een afgeleide index die de vergunningspraktijk van een gemeente samenvat op basis van procedure, kosten, vooroverleg, participatie-eisen en uitvoeringsprestatie. Formele bouwstenen: reguliere procedure 8 weken (+6 weken verlenging), uitgebreide procedure 6 maanden (+6 weken), conceptverzoek mogelijk, leges, VTH-verslagen en uitvoeringsprogramma's.

**Rol in Propdex:** "Vergunningservaring"-laag per gemeente: hoe soepel of zwaar is de vergunningspraktijk? Voedt `vergunning_succeskans` als praktische indicator naast de juridische kaders (GEM-07 jurisprudentie).

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `reguliere_procedure_standaard` | string | 8 weken + optioneel 6 weken |
| `uitgebreide_procedure_gevallen` | string[] | Wanneer uitgebreide procedure van toepassing |
| `conceptverzoek_beschikbaar` | bool | |
| `leges_conceptverzoek` | float | Indicatief bedrag |
| `leges_omgevingsvergunning` | string | Tarieventabel-verwijzing |
| `bopa_participatie_verplicht` | bool | Participatie verplicht bij BOPA |
| `omgevingstafel_aanwezig` | bool | |
| `vth_tijdigheid_signaal` | enum | Goed / matig / slecht (uit VTH-jaarverslag) |
| `vth_prioriteit_gebied` | string[] | Prioritaire handhavingsgebieden |
| `omgevingsdienst_betrokken` | bool | |

**Primaire bronnen:** IPLO-procedurepagina's, gemeentelijke legesverordeningen, VTH-jaarverslagen/uitvoeringsprogramma's, dienstverleningspagina's omgevingsvergunningen, open vergunningendatasets (bijv. Eindhoven).

**Nuance:** Onder de Omgevingswet geen "van rechtswege verleende vergunning" meer bij verlopen beslistermijn — "snelle gemeente" ≠ automatische verlening.

---

## GEM-07 — Jurisprudentie & AI-analyse → `juridisch_klimaat`, `vergunning_succeskans` (LIVE via Rechtspraak.nl)

**Beschrijving:** Geen gemeentelijk beleidsdocument — een krachtige afgeleide juridische signaleringslaag. Primaire bronnen: open data Rechtspraak.nl en uitspraken Raad van State. Rechtspraak-webservice in twee stappen: ECLI-index → uitspraakdocumenten. Dataset: 800.000+ uitspraken in open vorm, metadata van 3M+ uitspraken.

**Rol in Propdex:** Juridisch klimaatindicator per gemeente: hoe vaak sneuvelen plannen bij de rechter en waarom? Voedt `juridisch_klimaat` en `vergunning_succeskans` met jurisprudentiepatronen per gemeente, thema (woningbouw, parkeren, erfgoed, participatie) en uitkomst.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `ECLI` | string | |
| `instantie` | string | Rechtbank / RvS / ABRvS |
| `datum_uitspraak` | date | |
| `gemeente_naam` | string | |
| `projectnaam` | string | Indien benoemd |
| `rechtsvraag` | string | |
| `thema_tags` | string[] | Woningbouw, parkeren, erfgoed, participatie, Ladder, etc. |
| `uitkomst` | enum | Vernietigd / bevestigd / deels vernietigd |
| `belangrijkste_overweging` | string | AI-samenvatting |
| `precedentgewicht` | enum | Hoog / normaal / laag |

**Primaire bronnen:** Rechtspraak-open-datawebservice (bulk + machineverwerking), Raad van State zoekomgeving (bestuursrechtelijke verdieping).

**Nuance:** Niet alle uitspraken worden integraal gepubliceerd — communiceer dat dit een juridische signaalbron is, geen uitputtende database van alle procedures.

---

## GEM-13 — Beschermd erfgoed → `monument` (LIVE via RCE API)

**Beschrijving:** Geen verordening maar een object- en gebiedslaag. Per perceel tonen of sprake is van een rijksmonument, voorbeschermd monument, gemeentelijk monument, beschermd stads- of dorpsgezicht of andere lokaal beschermde erfgoedstatus. Rijksmonumenten en beschermde gezichten goed ontsloten nationaal; gemeentelijke monumenten sterk variabel per gemeente.

**Rol in Propdex:** Monument-factor: directe beschermingsstatus per perceel/pand. Onderscheid object (monument) en gebied (beschermd gezicht) is cruciaal — twee verschillende juridische regimes.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `erfgoed_status_type` | enum | Rijksmonument / gemeentelijk monument / voorbeschermd / beschermd gezicht |
| `beschermingsniveau` | enum | Rijks / provinciaal / gemeentelijk |
| `aanwijzende_overheid` | string | |
| `register_id` | string | RCE-registernummer of gemeentelijk nummer |
| `objectnaam` | string | |
| `aanwijzingsdatum` | date | |
| `voorbescherming` | bool | |
| `beschermd_gezicht` | bool | Perceel valt binnen beschermd gezicht |
| `bronregister` | string | "RCE", "gemeentelijk register", "onvolledig/onbekend" |
| `geometrie` | geometry | |

**Primaire bronnen:** RCE (rijksmonumenten + rijksbeschermde gezichten), aanvullend gemeentelijke monumentenregisters, erfgoedkaarten of open datasets per gemeente (bijv. Amsterdam kernregistratie monumenten).

**Nuance:** Geen landelijk compleet register voor gemeentelijke monumenten — altijd bronlabel + betrouwbaarheidslabel tonen.

---

## GEM-15 — Bekendmakingen monitoring → `juridisch_klimaat` (LIVE via SRU)

**Beschrijving:** Officiële publicatie- en vergunningsmonitor. Gemeenten publiceren beschikkingen, kennisgevingen en besluiten via hun publicatieblad; bereikbaar via Officiële Bekendmakingen en Berichten over uw Buurt. Zoekservice/webservice en bulk-uitlevering beschikbaar. Statusvelden: aangevraagd, verleend, geweigerd, vergunningvrij, ingetrokken, buiten behandeling, verlenging beslistermijn.

**Rol in Propdex:** Vergunningsmonitor per locatie: tijdlijn van aanvraag → verlenging → besluit per adres/perceel. Voedt `juridisch_klimaat` zijdelings door vergunningsactiviteit in omgeving te signaleren.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `publicatie_id` | string | |
| `publicatiedatum` | date | |
| `besluitdatum` | date | Indien beschikbaar |
| `bevoegd_gezag` | string | |
| `publicatie_type` | enum | Aanvraag / verlenging / besluit / intrekking |
| `zaaktype` | string | Omgevingsvergunning / sloopmelding / etc. |
| `status` | enum | Aangevraagd / verleend / geweigerd / ingetrokken |
| `adres` | string | |
| `geometrie` | geometry | |
| `bronblad` | string | Naam gemeentelijk publicatieblad |

**Primaire bronnen:** KOOP-zoekdienst (landelijke schaal), bulk-uitlevering voor historisch volledig beeld, lokale vergunningsdatasets per gemeente.

**Nuance:** Eén zaak kan in meerdere bekendmakingen terugkomen — dedupliceren en gebeurtenissen ketenen, niet elk bericht als los feit behandelen.

---

## LAND-06 — RVO subsidies → subsidie-context (LIVE als dossier-referentie)

**Beschrijving:** RVO beheert de nationale subsidie- en financieringsregelingen voor woningbouw, verduurzaming en energietransitie. Belangrijkste regelingen voor vastgoed: ISDE (isolatiemaatregelen particulieren), SVOH (sociale huur verduurzaming), Woningbouwimpuls (gemeenten/woningbouw), SAH (stimulering aankoop huurwoningen), Investeringssubsidie duurzame energie en energiebesparing.

**Rol in Propdex:** Rijksniveau van de subsidie-stack. Al live als dossier-referentie — geen nieuwe scoring-pipeline nodig. Wordt gecombineerd met GEM-10 (gemeentelijk) en PROV-04 (provinciaal) voor volledig subsidieoverzicht per project.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `regeling_naam` | string | ISDE / SVOH / Woningbouwimpuls / SAH / etc. |
| `doelgroep` | string[] | Particulieren / corporaties / gemeenten / marktpartijen |
| `objecttype` | string[] | Koopwoning / huurwoning / nieuwbouw |
| `maatregelenlijst` | string[] | Isolatie, warmtepomp, zonnepanelen, etc. |
| `max_bedrag` | float | |
| `subsidieplafond` | float | |
| `status` | enum | Open / gesloten / uitgeput |
| `aanvraagroute` | string | RVO.nl direct / via gemeente / via corporatie |

**Primaire bronnen:** RVO.nl subsidiepagina's, Rijksoverheid.nl subsidieoverzichten. Jaarlijkse update openstellingen en budgetten.

**Nuance:** RVO-regelingen zijn politiek gevoelig en kunnen snel wijzigen (budget uitgeput, regeling aangepast). Altijd status + datum tonen.
