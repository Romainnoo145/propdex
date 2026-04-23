# M057 — Energie + Mobiliteit — Doc context

2 cascade-documenten voor M057. Gebruik bij planning van M057-slices.

Index: `.planning/CASCADE-DOCUMENT-MAPPING.md`

---

## PROV-07 — Energietransitie / RES → `energie_context` (S01/S02)

**Beschrijving:** Nederland is opgedeeld in 30 energieregio's die samen een Regionale Energiestrategie (RES) opstellen voor grootschalige duurzame elektriciteitsopwek op land en de warmtetransitie in de gebouwde omgeving. RES 1.0 bod: gezamenlijk ~55 TWh duurzame elektriciteit op land in 2030. Schetsen ook contouren van de Regionale Structuur Warmte (RSW).

**Rol in Propdex:** Per perceel/regio: in welke RES-regio het ligt, welke duurzame opwek gepland is in de omgeving, en hoe de regionale warmtestrategie eruitziet. Context voor woningbouw en renovatie: of een wijk op termijn van het gas af gaat, welke warmteopties kansrijk zijn, en of nabijheid van wind/zon ruimtelijke of acceptatie-impact heeft.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `RES_regio_naam` | string | |
| `RES_regio_id` | string | Gekoppeld aan 30 energieregio's |
| `RES1_0_bod_TWh_2030` | float | Bod duurzame elektriciteit op land per regio |
| `verdeling_wind_vs_zon` | object | MW/TWh per type, indien beschikbaar |
| `RSW_warmtebronnen` | string[] | Geothermie, restwarmte, aquathermie, biomassa |
| `warmte_kansgebieden` | bool | Perceel in collectief warmtesysteem-kansgebied |
| `warmtestrategie_hoofdrichting` | enum | Warmtenetten / all-electric / hybride |
| `TVW_status_gemeente` | bool | Transitievisie Warmte vastgesteld door gemeente |
| `in_wind_zon_zoekgebied` | bool | Ruimtelijke/acceptatie-impact |

**Primaire bronnen:** RES-portaal + regio-sites (RES 1.0/2.0 documenten + kaarten), kaart "RES regio's op de kaart", PBL Monitor RES 1.0 en RES-dataportaal.

**Business-regels:**
- RES-badge op perceel/gemeentepagina: "Ligt in RES-regio X; bod Y TWh; warmtestrategie: restwarmte/warmtenetten vs. all-electric"
- Rapportblok "Regionale energietransitie (RES)": RES-regio + bod + wind/zon-zoekgebieden in nabijheid + hoofdrichting warmtetransitie
- Score-effect: positief waar warmtestrategie aansluit op projectconcept; aandachtspunt bij overlap met grootschalige opweklocaties

**Edge cases:**
- RES-documenten zijn beleidsafspraken, geen juridisch bindende regels — planologische binding loopt via omgevingsplannen en -verordeningen
- RES-dataportaal is theoretisch en dateert uit RES 1.0 — feitelijke uitvoering per regio kan afwijken, bevestig via regionale bronnen
- Warmtetransitie is primair gemeentelijke verantwoordelijkheid (TVW, warmteprogramma's) — RES alleen als regionale contextlaag, niet als exacte wijk-planning

---

## PROV-08 — Mobiliteitsbeleid (prov.) → `mobiliteit_waardering` (S03/S04)

**Beschrijving:** Provincies zijn verantwoordelijk voor regionaal mobiliteitsbeleid: provinciale wegen, regionaal OV, fietsnetwerken en regie op mobiliteit rond stedelijke gebieden. In provinciale mobiliteitsplannen/PVVP's beschrijven zij hoe mobiliteit, woningbouw en economie worden verbonden, bijv. verstedelijking rond OV-knooppunten en versterking van hoofdnetwerken.

**Rol in Propdex:** Per perceel/gemeente inzicht in bereikbaarheid en mobiliteitsontwikkelingen die waarde en haalbaarheid van woningbouw beïnvloeden: geplande OV-knooppuntontwikkeling, nieuwe infrastructuur, mobiliteitshubs, fietssnelwegen. Context voor parkeernormen, deelmobiliteit en knooppuntgerichte verstedelijking.

**Te extraheren velden:**

| Veld | Type | Beschrijving |
|---|---|---|
| `OV_knooppunt_classificatie` | enum | Hoofdstation / regionaal knooppunt / HOV-halte / mobiliteitshub |
| `woningbouw_kansgebied_knooppunt` | bool | Binnen invloedssfeer knooppunt (bijv. 0–300m / 300–1200m) |
| `geplande_infra_projecten` | string[] | Nieuwe/verbeterde OV-lijnen, stations, provinciale wegen |
| `beleidsspeerpunten` | string[] | Bijv. "knooppuntontwikkeling", "fiets first", "duurzame logistiek" |
| `corridors` | string[] | Hoofdstructuren waar provincie investeringen concentreert |
| `NDW_intensiteit_hoofdweg` | float | Gemiddelde verkeersintensiteit nabijste hoofdweg (via NDW open data) |
| `NDW_congestie_indicator` | enum | Laag / gemiddeld / hoog |

**Primaire bronnen:** Provinciale mobiliteitsplannen/PVVP's (bijv. Gelderland, Noord-Brabant, Zuid-Holland), programma's OV-knooppunten + monitors (bijv. Noord-Holland), NDW (Nationaal Dataportaal Wegverkeer) voor open verkeersdata.

**Business-regels:**
- Mobiliteitsbadge op perceelpagina: "Binnen X meter van OV-knooppunt Y (classificatie); provincie stuurt hier op knooppuntverstedelijking" + bereikbaarheidsscore via NDW-data
- Rapportsectie "Regionale mobiliteitscontext": nabijheid OV-knooppunten, geplande investeringen, relatie met woningbouw-/knopenagenda
- Score-effect: hogere potentie bij knooppuntversterkingsgebieden (meer steun, lagere parkeernormen); extra risico bij ernstige congestie en beperkte ontsluiting

**Edge cases:**
- Mobiliteitsplannen zijn strategisch — concrete doorwerking op perceelniveau loopt via omgevingsverordening en gemeentelijke omgevingsplannen
- NDW-data is rijk maar complex — eenvoudige, robuuste indicatorset kiezen (intensiteit/snelheid nabijste hoofdweg), geen pseudo-precisie
- OV-knooppuntprogramma's en woningbouwambities kunnen snel wijzigen — datum/versie van gebruikte programma's en monitors altijd tonen
