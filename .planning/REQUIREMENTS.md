# Requirements: Propdex v11.0 — Open Data Intelligence

**Defined:** 2026-03-06
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities
**Milestone Goal:** Enrich property intelligence with CBS neighborhood statistics, Rechtspraak court ruling precedents, and AI-powered legal risk analysis for quantified go/no-go context.

## v11.0 Requirements

### CBS Buurtstatistieken

- [x] **CBS-01**: Area scan results display neighborhood metrics (WOZ, stedelijkheid, demographics) in a dedicated card on the project/wijk detail view
- [x] **CBS-02**: CBS OData client uses v4 API with correct endpoint (`datasets.cbs.nl/odata/v1/CBS`), filter syntax (`startswith()` for region lookup), and year-aware dataset selection via `CBS_DATASET_ID` setting
- [x] **CBS-03**: CBS client follows established government API patterns (rate limiter, retry_with_backoff, timeout, proper error handling via GovernmentAPIError)

### Rechtspraak Jurisprudentie

- [ ] **RECHT-01**: User can search court rulings by keyword with omgevingsrecht domain filter
- [ ] **RECHT-02**: User can read full court ruling documents inline with court name and date
- [ ] **RECHT-03**: Search defaults to gemeente context when viewing a project/wijk
- [x] **RECHT-04**: Rechtspraak client follows established patterns (correct base.py imports, ECLI format validation, rate limiter registration, lxml XML parsing with XXE protection)

### AI Juridisch Klimaat

- [ ] **AI-01**: Each court ruling displays an AI-generated summary with risk indication (bezwaargrond, uitkomst, relevantie voor vastgoed)
- [ ] **AI-02**: Gemeente/wijk shows aggregated juridisch klimaat score based on recent court rulings
- [ ] **AI-03**: Vergunnings-succeskans percentage displayed based on historical precedent outcomes in the area
- [ ] **AI-04**: AI analysis runs as ARQ background job with polling pattern (existing parsing_job model, no blocking HTTP)

## v9.0 Requirements (Complete)

Previous milestone — Risk Intelligence. All 10 requirements complete.

- [x] **WKB-01**: Gevolgklasse classification — Phase 67
- [x] **WKB-02**: Asbest risk indicator — Phase 67
- [x] **WKB-03**: Verbouwing exclusion — Phase 67
- [x] **WKB-04**: Rijksmonument exclusion — Phase 67
- [x] **BODEM-01**: Bodemloket query — Phase 68
- [x] **BODEM-02**: Bodemkwaliteit report section — Phase 68
- [x] **BODEM-03**: Absent data handling — Phase 68
- [x] **DOSSIER-01**: Startdossier PDF generation — Phase 69
- [x] **DOSSIER-02**: Dossier content sections — Phase 69
- [x] **DOSSIER-03**: Legal disclaimer — Phase 69

## Future Requirements

Deferred to v12.0+ — potential future directions.

- **PIPE-01**: Lead pipeline stages: Nieuw → Onderzoek → Contact → Onderhandeling → Afgewezen/Gekocht
- **API-01**: B2B API for large borgingspartijen (Woningborg, Kiwa)
- **DASH-01**: Professional dashboard with lead tracking and conversion metrics
- **ARCH-01**: Historisch funderings- & asbestrisico profiel via Archieven.nl OAI-PMH

## Out of Scope

| Feature | Reason |
|---------|--------|
| Archieven.nl historical building dossiers | Complex OAI-PMH protocol, uncertain data coverage, defer to v12.0 |
| Tweede Kamer wetgevingsdata | Too indirect for property-level intelligence |
| Open Archieven genealogie | Not relevant for B2B PropTech |
| Full-text search of court rulings | Rechtspraak API only supports metadata/title search, not full-text |
| Automated vergunningaanvraag | Omgevingsloket monopoly (Art. 16.1) — never build |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CBS-01 | Phase 75 | Complete |
| CBS-02 | Phase 75 | Complete |
| CBS-03 | Phase 75 | Complete |
| RECHT-01 | Phase 76 | Pending |
| RECHT-02 | Phase 76 | Pending |
| RECHT-03 | Phase 76 | Pending |
| RECHT-04 | Phase 76 | Complete |
| AI-01 | Phase 77 | Pending |
| AI-02 | Phase 77 | Pending |
| AI-03 | Phase 77 | Pending |
| AI-04 | Phase 77 | Pending |

**Coverage:**
- v11.0 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 — traceability complete after roadmap creation*
