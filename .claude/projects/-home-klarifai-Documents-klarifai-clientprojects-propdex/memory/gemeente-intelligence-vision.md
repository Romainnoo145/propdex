---
name: Gemeente Intelligence — Vision & Data Sources
description: Complete overview of 12 gemeente-level data sources for the gemeente context panel, their API availability, integration status, and output data shapes. Research completed 2026-03-17.
type: project
---

## What we want to achieve

The gemeente context panel is the centerpiece of v18.0. It shows ALL municipality-level intelligence a vastgoedontwikkelaar needs — from demographics to subsidies to local regulations. This is what differentiates Propdex from every competitor: nobody else combines all these sources per gemeente in one view.

**Why:** The user explicitly stated that even "niet bruikbare" sources (welstandsnota, parkeernormen, omgevingsvisie) are what make the app valuable. Every source gets a slot, even if it's a placeholder today. "Mogelijkheden genoeg tegenwoordig" — AI parsing of PDFs, scraping, manual curation are all options for filling placeholders later.

**How to apply:** When planning any gemeente-related phase, check this memory + the research doc + the TypeScript types file. Don't skip sources just because they lack an API today.

## 12 Data Sources — Integration Status

### LIVE (already integrated)
1. **CBS Demografie** — CBS OData v4, 100% dekking. Backend: `cbs_odata.py`, `cbs_crime.py`
2. **Juridisch Klimaat** — Rechtspraak.nl, ~90% dekking. Backend: `jurisprudence_analysis.py`
3. **Meldingen/Bekendmakingen** — SRU + monitoring system

### STUB (API available, backend endpoint needed)
4. **Raadsinformatie** — Open Raadsinformatie ElasticSearch API (`api.openraadsinformatie.nl/v1/elastic/`), no auth, 77% dekking (265/342 gemeenten). Keywords: woonvisie, grondbeleid, woningbouw, speculatie, voorkeursrecht
5. **Huisvestingsverordening** — CVDR/lokaleregelgeving.overheid.nl, 100% dekking. Critical for splitsingsvergunningplicht, min m², kamerverhuurregels
6. **Subsidies** — RVO API (`rvo.nl/api/v1/opendata/subsidies`) national, Zuid-Holland REST API, CKAN per-gemeente. Key programs: SFT (€14k/woning optoppen/splitsen/transformatie), Woningbouwimpuls, VHF, ISDE
7. **STTR Vergunningsplicht** — DSO Toepasbare Regels API, API key needed, ~60% dekking. Answers "heb ik een vergunning nodig voor X in deze gemeente?"
8. **Erfgoed & Beschermd Stadsgezicht** — RCE WMS for stadsgezichten (100%), gemeentelijk erfgoed per-gemeente only

### PLACEHOLDER (no machine-readable source yet)
9. **Welstandsnota** — ~20% gedigitaliseerd, PDF + kaart. Future: AI PDF parsing
10. **Parkeernormen** — CROW referentie + gemeente PDFs. Future: AI extraction
11. **Omgevingsvisie/Woonvisie** — Verplicht gepubliceerd maar alleen PDF. Future: AI samenvatting, woningbouwdoelen extractie
12. **Verduurzaming** — Versnipperd in lokale regelgeving. Future: CVDR text mining

## Key files

- **TypeScript datamodel**: `frontend/src/lib/types/gemeente-intelligence.ts` — 12 secties met `_integration` flag (live/stub/placeholder)
- **Research document**: `docs/research/gemeente-intelligence-sources.md` — API endpoints, auth, dekking, velden per bron
- **Roadmap context**: v18.0 Phase 115 (GemeenteContextPanel) + Phase 116 (Gemeente Modals) consume this datamodel

## Subsidie-programma's voor vastgoedontwikkeling

| Programma | Bedrag | Relevant voor |
|-----------|--------|---------------|
| SFT | €14.000/woning | Optoppen, splitsen, transformatie |
| Realisatiestimulans | €7.000/betaalbare woning | Nieuwbouw, transformatie |
| Woningbouwimpuls | €1 mrd totaal | Betaalbare woningbouw |
| Volkshuisvestingsfonds | Per aanvraag | Splitsen, optoppen, verduurzaming |
| ISDE | ~€500M/jaar | Verduurzaming bestaande bouw |
