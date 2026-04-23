# M050 — Cascade Batch 1: Juridisch klimaat — Doc context

5 cascade-documenten voor M050. Gebruik bij planning van M050-slices.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## GEM-08 — Raadsinformatie → `politiek_klimaat` (S01/S02)

**Beschrijving:** Raadsinformatie is een bestuurlijke signalenlaag met agenda's, moties, amendementen, raadsvoorstellen, notulen, toezeggingen en college-informatie. Geen enkelvoudig document — samengesteld dataproduct bovenop officiële bronnen. Ontsluiting via Open Raadsinformatie (ORI) of lokale raadsinformatiesystemen.

**Rol in Propdex:** Politiek klimaatindicator per gemeente: welke stemmingen, moties en besluiten zijn er rond woningbouw, transformatie, parkeren, erfgoed en participatie? Laat zien of een gemeente bestuurlijk progressief of defensief is t.a.v. vastgoedontwikkeling.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `documenttype` | enum | Motie / amendement / raadsvoorstel / notulen / collegevoorstel |
| `vergaderdatum` | date | |
| `portefeuille` | string | Bijv. wonen, ruimtelijke ordening, duurzaamheid |
| `status_besluitvorming` | enum | Aangenomen / verworpen / aangehouden |
| `onderwerp` | string | |
| `projectlocatie` | string | Indien locatiegebonden |
| `motie_of_amendement` | bool | |
| `stemresultaat` | string | Indien beschikbaar |
| `raadsstuk_id` | string | |

**Primaire bronnen:** Open Raadsinformatie (ORI) waar beschikbaar; lokale RIS als fallback. Per gemeente `raadsinfo_connector_type` bijhouden.

**Business-regels:**
- Politiek klimaatindicator: "Gemeente X heeft afgelopen 2 jaar X moties aangenomen pro woningbouw / X bezwaren gehonoreerd"
- Signalering actieve projecten: combinatie onderwerp + portefeuille + lokale projectnaam
- Alerting: nieuwe motie/besluit dat een lopend project raakt

**Edge cases:**
- Dekking niet uniform — agenda's, bijlagen en besluitenlijsten kunnen verschillende ontsluitingspatronen hebben binnen één gemeente
- Niet alle stukken zijn openbaar — systeem moet onderscheid maken tussen openbaar en niet-openbaar

---

## GEM-09 — Leegstandsverordening → `leegstandsdruk` (S03)

**Beschrijving:** Specifiek instrument uit de Leegstandwet. Gemeenteraad kan categorieën gebouwen/gebieden aanwijzen waarvoor leegstand moet worden gemeld en waarover de gemeente met de eigenaar in overleg treedt. Het rijk werkt aan aanscherping (wetswijziging Raad van State april 2026): sterkere bevoegdheden om leegstand te beëindigen + leegstandsheffing — nog niet in werking.

**Rol in Propdex:** Leegstandsdruk-indicator: geeft aan of een gemeente actief op leegstand stuurt en welke categorieën objecten/gebieden onder meldplicht vallen. Relevant voor transformatiepotentieel inschatting: leegstandsregulering als signaal voor gebiedsdruk en bestuurlijke urgentie.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `leegstandverordening_aanwezig` | bool | |
| `categorie_gebouw` | string[] | Woningen / winkels / kantoren / gemengd |
| `werkingsgebied` | string | Wijk/buurt/gemeente-breed |
| `meldplicht_termijn` | int | In maanden |
| `gemeentelijk_overleg_verplicht` | bool | |
| `voordracht_gebruiker_mogelijk` | bool | |
| `tijdelijke_verhuur_route` | bool | |
| `wetswijziging_status` | string | "Wetswijziging in behandeling (april 2026)" |

**Primaire bronnen:** CVDR voor actuele verordening; rijkssignaal voor nationale wetswijzigingen (dossier in beweging per april 2026).

**Business-regels:**
- Leegstandsdruk-badge: "Gemeente heeft leegstandsverordening voor [categorieën]; meldplicht na X maanden"
- Transformatiekans-signaal: tijdelijke verhuurroute beschikbaar als overbrugging
- Altijd wetswijziging-status tonen

**Edge cases:**
- Niet elke gemeente heeft een leegstandsverordening — UI onderscheidt "geen regeling", "regeling aanwezig maar niet van toepassing op dit objecttype", "regeling van kracht"
- Focus verschilt per gemeente (woningen vs. winkels vs. kantoren)

---

## GEM-05 — Huisvestingsverordening → `splitsingsrisico` (S04)

**Beschrijving:** Harde regelbron onder de Huisvestingswet 2014. Gemeenten kunnen regels opnemen over huisvestingsvergunningen, urgentiecategorieën, woonruimtevoorraadvergunningen voor onttrekking/splitsing/omzetting/woningvorming en opkoopbescherming. Recente verordeningen bevatten ook koppelingen met betaalbare koop, middenhuur en specifieke werkingsgebieden.

**Rol in Propdex:** Splitsingsrisico en onttrekkingsrisico per perceel/pand. Bepaalt of een transformatie- of splitsingsplan een woonruimtevoorraadvergunning nodig heeft en of opkoopbescherming van toepassing is. Direct relevant voor investeringslogica en exit-strategie.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `huisvestingsvergunning_verplicht` | bool | |
| `urgentie_categorieen` | string[] | |
| `onttrekking_vergunning_verplicht` | bool | |
| `splitsing_vergunning_verplicht` | bool | |
| `omzetting_vergunning_verplicht` | bool | |
| `woningvorming_vergunning_verplicht` | bool | |
| `opkoopbescherming_werkingsgebied` | string | Buurt/wijk/gemeente |
| `woz_of_prijsgrens_opkoop` | float | |
| `uitzonderingen` | string[] | |
| `regionale_toepassing` | bool | Regionaal ingebed |

**Primaire bronnen:** CVDR (doorgaans goed geconsolideerd). Voor geografische componenten (buurten/wijken opkoopbescherming) ook bijlagen en kaartverwijzingen uitlezen.

**Business-regels:**
- Splitsingsrisico-badge: "In dit werkingsgebied geldt splitsingsvergunningplicht / opkoopbescherming tot WOZ €X"
- Transformatiecheck: bij onttrekking/omzetting automatisch vergunningplicht signaleren
- Score-effect: hogere regulatory burden → lager transformatiepotentieel

**Edge cases:**
- Enorme variatie tussen gemeenten — modulair parsen op functies: toewijzing / urgentie / woonruimtevoorraad / opkoopbescherming
- Soms regionaal ingebed (bijv. regio Amsterdam) — documentniveau altijd labelen

---

## LAND-04 — Woningwet & corporatieregels → `segment_fit` (S05)

**Beschrijving:** De Woningwet 2015 en het BTIV regelen het speelveld van woningcorporaties: scheiding DAEB/niet-DAEB, passend toewijzen, inkomens- en huurgrenzen, verkoopregels en toezicht. Bepaalt welke doelgroepen en segmenten onder DAEB vallen en welke ruimte er is voor middenhuur/niet-DAEB.

**Rol in Propdex:** Juridisch kader voor corporatie-samenwerking + segmentering. Bepaalt of een concept past binnen corporatie-afspraken (prestatieafspraken, volkshuisvestingsprogramma) en welke mix corporaties formeel kunnen leveren. Direct relevant voor projectsegmentering en financiële haalbaarheid.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `is_DAEB_segment` | bool | Per deelprogramma: sociale huur onder DAEB-grens |
| `DAEB_doelgroep_definitie` | string | Doelgroep + bijbehorende inkomens- en huurgrenzen |
| `DAEB_inkomensgrenzen` | float[] | Jaarlijks geïndexeerd, per huishoudgrootte |
| `inkomensgrenzen_passend_toewijzen` | float[] | 95% van toewijzingen onder aftoppingsgrens |
| `DAEB_huurgrens` | float | Max huurprijs sociale huur (bijv. ~€900 in 2025) |
| `liberalisatiegrens` | float | Bovengrens gereguleerde middenhuur (bijv. ~€1.184 in 2025) |
| `aftoppingsgrenzen` | float[] | Per huishoudgrootte, relevant voor passend toewijzen |
| `min_percentage_DAEB_toewijzing` | float | ~80–92,5% naar doelgroep |
| `passend_toewijzen_norm` | float | 95% onder aftoppingsgrens |
| `vrije_toewijzingsruimte` | float | 7,5% standaard, uitbreidbaar tot 15% via prestatieafspraken |
| `inkomensgrens_verkoop_onder_voorwaarden` | float | Max inkomen voor korting zonder waardedeling |

**Primaire bronnen:** Woningwet 2015 + BTIV/RTIV (wetten.overheid.nl), jaarlijkse indexeringsbrieven (Rijk/VTW/VRO), VolkshuisvestingNederland.nl.

**Business-regels:**
- Segment-check per plan: bepaal of programma DAEB-geschikt is (passend toewijzen + doelgroep)
- Alignment corporatie-opgave: toon hoeveel vrije ruimte (7,5–15%) er nog is voor hogere inkomens
- Regellijn vs. middenhuur: welk deel valt tussen DAEB-huurgrens en liberalisatiegrens

**Edge cases:**
- Jaarlijkse indexatie maakt grenzen jaar-afhankelijk — altijd jaar/datum tonen bij grenzen
- DAEB/niet-DAEB-scheiding (administratief vs. juridisch gesplitst) is te complex om volledig te reconstrueren — Propdex geeft typering, geen definitieve classificatie
- Middenhuur loopt deels via andere wetgeving (Huisvestingswet, Wet betaalbare huur) — consistent combineren

---

## LAND-05 — Asbest & sloopregels → verfijnt asbest kostencalc (S05)

**Beschrijving:** Asbest- en sloopregels regelen hoe en onder welke voorwaarden asbest moet worden geïnventariseerd en verwijderd bij sloop- en renovatiewerkzaamheden, en welke meld‑ en certificatieplichten daarbij gelden. Hoofdstuk 7 van het Bbl bundelt de regels voor asbestverwijdering uit bouwwerken (sloopmelding, inventarisatieplicht, uitvoering door gecertificeerde bedrijven, risicoklassen). Het Asbestverwijderingsbesluit vult aan voor andere objecten. Certificatieschema's SC‑530 (procescertificaat asbestverwijdering) en SC‑540 (asbestinventarisatie) van Ascert bepalen hoe gecertificeerde bedrijven moeten werken.

**Rol in Propdex:** Bepaalt of bij een pand (op basis van bouwjaar en gebruiksfunctie) relevante asbestrisico's bestaan en welke kosten, termijnen en processtappen gelden bij sloop/renovatie. Risicoscore-component + cashflow/timing-impact: sloopmelding, inventarisatie, sanering en vrijgave beïnvloeden projectplanning.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `bouwjaar_risico_asbest` | bool | Pand vóór 1994 → asbesttoepassing mogelijk |
| `functierisico` | enum | Hogere kans bij scholen, industrie, utiliteit |
| `risico_score_asbest` | enum laag/midden/hoog | UI-indicator |
| `sloopmelding_verplicht` | bool | Standaard 28 dagen voor start (uitz. 5 werkdagen) |
| `asbestinventarisatieplicht` | bool | Art. 7.9 Bbl |
| `risicoklasse` | enum 1/2/2A | Bepaald via inventarisatie + SMART‑ns model |
| `gecertificeerd_bedrijf_verplicht` | bool | Klasse 2/2A → SC‑530 verplicht |
| `melding_termijn_dagen` | int | Standaard 28, uitzonderingen mogelijk |
| `eindbeoordeling_verplicht` | bool | Klasse 2/2A binnenruimten, LAVS-vastlegging (art. 7.12 Bbl per 1-1-2026) |
| `verwachte_doorlooptijd_sanering` | string | Indicatieve bandbreedte in dagen/weken |
| `SC_530_verplicht` | bool | Saneringsbedrijf-certificaat |
| `SC_540_verplicht` | bool | Inventarisatiebedrijf-certificaat |

**Primaire bronnen:** Bbl hoofdstuk 7, Asbestverwijderingsbesluit, Arbeidsomstandighedenbesluit, Ascert SC-530/SC-540.

**Business-regels:**
- Asbest-risico-badge op perceel: bouwjaar < 1994 → toon indicatief saneringskostenspectrum (€/m²)
- Bij scenario sloop/ingrijpende renovatie: automatisch inventarisatieplicht + processtappen tonen
- Risicoscore-component "Asbest & sloop": hoger bij complex gebouw + hoge kansinschatting
- Asbest mag aanwezig blijven bij normaal gebruik → geen showstopper, wel markeren bij ingrepen

**Edge cases:**
- Risicoklasse is specialistisch (SMART‑ns model) — Propdex toont verwachtingsindicator, geen definitieve classificatie
- Samenspel Bbl + Asbestverwijderingsbesluit + Arbobesluit + Bal — UI moet scope helder afbakenen
- Regelgeving wijzigt regelmatig (bijv. LAVS-wijziging 1-1-2026)
