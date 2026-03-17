# Gemeente Intelligence — Databronnen Research

> Research uitgevoerd 2026-03-17. Basis voor gemeente panel datamodel.

## Bronnen per integratiestatus

### LIVE (al geïntegreerd)

| Bron | API | Dekking | Backend file |
|------|-----|---------|-------------|
| CBS Demografie | CBS OData v4 | 100% | `cbs_odata.py`, `cbs_crime.py` |
| Jurisprudentie | Rechtspraak.nl | ~90% | `jurisprudence_analysis.py` |
| Rijksmonumenten | RCE REST + SPARQL | 100% | `rce_monuments.py`, `rce_linked_data.py` |
| Energielabels | EP-Online | 100% | `ep_online.py` |
| Bekendmakingen | SRU + monitoring | per project | `sru_bekendmakingen.py` |

### STUB (API beschikbaar, integratie mogelijk)

| Bron | API Endpoint | Auth | Dekking | Key velden |
|------|-------------|------|---------|------------|
| **Open Raadsinformatie** | `api.openraadsinformatie.nl/v1/elastic/` | Geen | 77% (265/342) | titel, type, datum, status, tekst, gemeente |
| **Verordeningen (CVDR)** | `lokaleregelgeving.overheid.nl` | Geen | 100% | naam, type, datum, artikelen |
| **STTR Toepasbare Regels** | `service.omgevingswet.overheid.nl/publiek/toepasbare-regels/api/` | API key (DSO portal) | ~60% | activiteit, vergunningsplicht, voorwaarden |
| **RVO Subsidies** | `rvo.nl/api/v1/opendata/subsidies` | Geen | Nationaal | naam, status, (geen per-gemeente filter) |
| **Zuid-Holland Subsidies** | `subsidieregister.zuid-holland.nl/api/` | Geen | Alleen ZH | naam, bedrag, ontvanger, project |
| **Gemeentelijke subsidies** | data.overheid.nl CKAN | Geen | 150+ gem. | Wisselend per gemeente |
| **Beschermde stadsgezichten** | RCE WMS | Geen | 100% | naam, type, datum_aanwijzing |

### PLACEHOLDER (geen machine-readable bron)

| Bron | Huidige status | Toekomst |
|------|---------------|----------|
| **Welstandsnota** | ~20% gedigitaliseerd, PDF + kaart | AI PDF parsing, gemeente scraping |
| **Parkeernormen** | CROW referentie + gemeente PDFs | AI extraction uit Nota Parkeernormen |
| **Omgevingsvisie** | Verplicht gepubliceerd, alleen PDF | AI samenvatting uit PDF |
| **Woonvisie** | Per gemeente PDF | AI extraction woningbouwdoelen |
| **Gemeentelijk erfgoed** | Per gemeente register, geen centrale API | Scraping per gemeente |
| **Verduurzamingsverordening** | Versnipperd in lokale regelgeving | CVDR text mining |

## Relevante subsidie-programma's voor vastgoedontwikkeling

| Programma | Scope | Bedrag | Relevant voor |
|-----------|-------|--------|---------------|
| **SFT** (Stimuleringsregeling Flex- en Transformatiewoningen) | Nationaal | €14.000/woning | Optoppen, splitsen, transformatie |
| **Realisatiestimulans** | Nationaal | €7.000/betaalbare woning | Nieuwbouw, transformatie |
| **Woningbouwimpuls** | Nationaal | €1 mrd totaal | Betaalbare woningbouw |
| **Volkshuisvestingsfonds** | Nationaal | Per aanvraag | Splitsen, optoppen, verduurzaming |
| **ISDE** | Nationaal | ~€500M/jaar | Verduurzaming bestaande bouw |

## Raadsinformatie — relevante zoektermen

Voor vastgoedontwikkelaars meest relevante document types + keywords:
- **Woonvisie** — woningbouwdoelstellingen, doelgroepen
- **Grondbeleid** — voorkeursrecht, grondexploitatie, anti-speculatie
- **Bestemmingsplanwijziging** — herbestemming, verdichting
- **Woningbouwprogramma** — aantallen, mix sociaal/vrije sector
- **Prestatieafspraken** — afspraken gemeente-corporaties-ontwikkelaars
- **Moties** — speculatie, betaalbaarheid, verduurzaming

## Datamodel

Volledig TypeScript datamodel: `frontend/src/lib/types/gemeente-intelligence.ts`

12 secties in `GemeenteIntelligence`:
- 3x LIVE (cbs, juridisch, meldingen)
- 5x STUB (raadsinformatie, huisvestingsverordening, subsidies, sttr, erfgoed)
- 4x PLACEHOLDER (welstandsnota, parkeernormen, visie, verduurzaming)
