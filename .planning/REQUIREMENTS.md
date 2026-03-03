# Requirements: Propdex v9.0 — Risk Intelligence

**Defined:** 2026-03-01
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities
**Milestone Goal:** Add comprehensive risk assessment capabilities — Wkb classification, soil contamination data, and automated risicobeoordeling dossier generation.

## v9.0 Requirements

Requirements for risk intelligence — Wkb classification, bodem data, and dossier generation for kwaliteitsborger intake.

### Wkb Intelligence

- [x] **WKB-01**: User can see gevolgklasse classification (1/2/3) for any property in the report, labeled as "indicatief"
- [x] **WKB-02**: User can see asbest risk indicator based on bouwjaar (hoog: 1963-1993, middel: pre-1963, geen: post-1993) in the report
- [x] **WKB-03**: Verbouwing projects are flagged with "Wkb niet van toepassing" notice (Dec 2024 ministerial ruling)
- [x] **WKB-04**: Wkb classification excludes rijksmonumenten (monument status from existing RCE data)

### Bodemkwaliteit

- [x] **BODEM-01**: System queries Bodemloket for soil contamination data at parcel coordinates
- [x] **BODEM-02**: Property report includes "Bodemkwaliteit" section showing contamination status and WBB dossier references
- [x] **BODEM-03**: Absent Bodemloket data displayed as "geen gegevens beschikbaar" (never "schone grond")

### Risicobeoordeling Dossier

- [x] **DOSSIER-01**: User can generate a "Risicobeoordeling Startdossier" PDF for any property
- [x] **DOSSIER-02**: Dossier includes: perceelgegevens, bouwjaar, bodemkwaliteit, bestemmingsplan, monumentstatus, energielabel, Wkb classificatie
- [x] **DOSSIER-03**: Dossier includes legal disclaimer (data is indicatief, assembled from public sources)

## v8.0 Requirements (Complete)

Previous milestone — Client Demo Readiness. Tracked in `.planning/ROADMAP.md` phases 62-66.

- [x] **SCAN-01**: BAG WFS retry on failure
- [x] **SCAN-02**: BAG coverage ratio validation
- [x] **SCAN-03**: Force-all backfill mode
- [ ] **DATA-01-03**: Venlo data completeness (Phase 63)
- [x] **MAP-01-03**: Map visualization polish (Phase 64)
- [ ] **RPT-01-04**: Report polish (Phase 65)
- [ ] **RES-01-02**: Results table noise reduction (Phase 66)

## Future Requirements

Deferred to v10.0+ — potential future directions.

- **PIPE-01**: Lead pipeline stages: Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht
- **API-01**: B2B API for large borgingspartijen (Woningborg, Kiwa)
- **DASH-01**: Professional dashboard with lead tracking and conversion metrics

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WKB-01 | Phase 67 | Complete |
| WKB-02 | Phase 67 | Complete |
| WKB-03 | Phase 67 | Complete |
| WKB-04 | Phase 67 | Complete |
| BODEM-01 | Phase 68 | Complete |
| BODEM-02 | Phase 68 | Complete |
| BODEM-03 | Phase 68 | Complete |
| DOSSIER-01 | Phase 69 | Complete |
| DOSSIER-02 | Phase 69 | Complete |
| DOSSIER-03 | Phase 69 | Complete |

**Coverage:**
- v9.0 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-03 — Phases 70-71 dropped (professional directory/lead capture not needed for B2B users). v9.0 scoped to Phases 67-69.*
