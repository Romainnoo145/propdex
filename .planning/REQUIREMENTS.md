# Requirements: Propdex v15.0 Aura

**Defined:** 2026-03-10
**Core Value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities.

## v15.0 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Design System

- [x] **DS-01**: Aura design tokens defined as CSS variables: Morning Mist (#F2F6F3) canvas, Pure Glass (white/60 + blur) surfaces, Deep Obsidian (#0E1111) primary, Warm Amber (#F9A826) accent, Sage Mint (#D1E2D8) secondary, Vitality Green (#22C55E) status, Ink (#1A1C1E) text
- [x] **DS-02**: Satoshi font loaded and applied globally with sizing scale (Display 32px Bold, KPI 24px Semi-bold, Labels 11px All-caps +5% tracking)
- [x] **DS-03**: Glass component primitives: GlassPanel (backdrop-blur-xl + bg-white/60 + border-white/40), BentoPod (rounded-3xl, solid translucent bg-white/40 without blur), PillBadge (rounded-full)
- [x] **DS-04**: Micro-interaction system: hover scale-105 with glow, fly-up/slide-in animations, smooth transitions
- [x] **DS-05**: Dark mode removed entirely -- light-only Aura theme replaces Industrial Amber
- [x] **DS-06**: Performance fallback: prefers-reduced-motion disables blur, will-change:transform on floating panels, blur only on 3 key surfaces (SideRailNav, search bar, bottom sheet containers)

### Layout & Navigation

- [x] **NAV-01**: Viewport-locked layout -- map fills 100% screen, all UI floats on z-50 with 16px margin from edges
- [x] **NAV-02**: Floating SideRailNav (left, 80px wide, rounded-[40px], glass): Propdex logo top, functional icons middle (Kaart/Resultaten/Jurisprudentie), settings + notifications + profile bottom, tooltips on hover
- [x] **NAV-03**: Search pill (top-left, rounded-full, glass) with PDOK address autocomplete
- [x] **NAV-04**: Filter/Toggle dock (top-center) with chip-style dropdowns for gemeente/perceel toggle and layer controls (Kaart/Satellite, Gemeenten/Percelen/Bestemmingsplan)

### Parcel Detail

- [x] **PRC-01**: Floating right detail panel (glass) with satellite crop hero image, score badge overlay in corner, address header
- [x] **PRC-02**: Primary stats bento grid (4 pods): oppervlakte, bouwjaar, status, gemeente -- icon + value, no scroll
- [x] **PRC-03**: Bestemming as wide horizontal status bar with soft color fill
- [x] **PRC-04**: Kansen & aandachtspunten as horizontal pill/tag cloud instead of text list
- [x] **PRC-05**: Click-through layers for deeper data: clicking a bento pod opens a detail layer replacing the current view (17+ sections accessible without scroll)
- [x] **PRC-06**: Vergunningen as accordion-style bento pod (shows count, expands on click)
- [x] **PRC-07**: "Genereer Rapport" as primary action button pinned at bottom of panel

### Parcel Aerial Crop API

- [x] **API-01**: Backend endpoint that returns a cropped PDOK aerial image centered on a parcel geometry for use as hero image in detail panel

### Wijk View

- [ ] **WIJK-01**: Bottom Bento Sheet (30-40% screen height) with fly-up animation on wijk click, drag handle, rounded-t-[48px]
- [ ] **WIJK-02**: 4-column bento layout: Wijk Identity (name + score) | Bestemming distribution bar | Stats 2x2 grid (oppervlakte, bouwjaar avg, leegstand count, vergunningen) | Kansen glow-cards
- [ ] **WIJK-03**: Selected wijk gets outer glow on map in active status color
- [ ] **WIJK-04**: Click-through from wijk pods to deeper data (no scroll within sheet)

### Gemeente View

- [ ] **GEM-01**: Gemeente-level map shows wijk boundaries with luminous white borders on click
- [ ] **GEM-02**: Gemeente context accessible without bottom sheet -- focus on map with wijk boundaries as entry point

### Results Table

- [ ] **RES-01**: /resultaten route gets Aura visual treatment: glass container, bento-styled filter bar, Satoshi font, rounded elements
- [ ] **RES-02**: Table maintains existing functionality (TanStack Table sorting, filtering, bulk export) with new styling

### Jurisprudentie

- [ ] **JUR-01**: Wizard flow redesigned in Aura style: glass panels, bento step indicators, Satoshi font
- [ ] **JUR-02**: Explorer redesigned with glass containers, bento result cards, pill filters

### Meldingen

- [ ] **MELD-01**: Meldingen feed redesigned with bento cards, glass container, pill action-state badges
- [ ] **MELD-02**: Gemeente filter and infinite scroll preserved with new Aura styling

### Reports

- [ ] **RPT-01**: Report detail page redesigned as bento layout with click-through sections replacing scrollable list

### Settings

- [ ] **SET-01**: Settings page updated with Aura glass/bento styling on existing sections (account, password, notifications, appearance)

## Future Requirements

### Physical Risk Extensions (deferred from v14.0)

- **KLIM-01**: Drought/subsidence risk from Klimaateffectatlas
- **FUND-04**: Foundation risk aggregated at wijk level

### Deferred from v12.0

- **SCORE-01**: LocationScoreService 0-10 investeerbaarheid per wijk

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile responsiveness | Desktop-only for this milestone -- mobile in future |
| Dark mode | Aura is light-only by design |
| PDF rapport redesign | PDF template is separate from frontend views |
| New data sources | This milestone is frontend-only (except aerial crop API) |
| Backend API changes | Only new endpoint is aerial crop -- all other APIs unchanged |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 91 | Complete |
| DS-02 | Phase 91 | Complete |
| DS-03 | Phase 91 | Complete |
| DS-04 | Phase 91 | Complete |
| DS-05 | Phase 91 | Complete |
| DS-06 | Phase 91 | Complete |
| NAV-01 | Phase 92 | Complete |
| NAV-02 | Phase 92 | Complete |
| NAV-03 | Phase 92 | Complete |
| NAV-04 | Phase 92 | Complete |
| PRC-01 | Phase 93 | Complete |
| PRC-02 | Phase 93 | Complete |
| PRC-03 | Phase 93 | Complete |
| PRC-04 | Phase 93 | Complete |
| PRC-05 | Phase 93 | Complete |
| PRC-06 | Phase 93 | Complete |
| PRC-07 | Phase 93 | Complete |
| API-01 | Phase 93 | Complete |
| WIJK-01 | Phase 94 | Pending |
| WIJK-02 | Phase 94 | Pending |
| WIJK-03 | Phase 94 | Pending |
| WIJK-04 | Phase 94 | Pending |
| GEM-01 | Phase 94 | Pending |
| GEM-02 | Phase 94 | Pending |
| RES-01 | Phase 95 | Pending |
| RES-02 | Phase 95 | Pending |
| JUR-01 | Phase 96 | Pending |
| JUR-02 | Phase 96 | Pending |
| MELD-01 | Phase 96 | Pending |
| MELD-02 | Phase 96 | Pending |
| RPT-01 | Phase 107 | Complete (rebuilt as Due Diligence Dashboard) |
| SET-01 | Phase 97 | Pending |

**Coverage:**
- v15.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

## v16.0 Requirements

Requirements for the Score Intelligence milestone (Phases 99-101).

### Scan Pipeline Enrichment (Phase 99)

- [ ] **SCAN-01**: Energielabel (EP-Online) fetched per VBO ID and stored in scan_results.flags during wijk scan
- [ ] **SCAN-02**: WOZ waarde (Waardeloket) fetched per nummeraanduiding ID and stored in scan_results.flags during wijk scan
- [ ] **SCAN-03**: Vergunningen (SRU Bekendmakingen) fetched per unique postcode and stored in scan_results.flags during wijk scan
- [x] **SCAN-04**: Bodem/bodemtype (Bodemloket + BRO Bodemkaart) fetched per coordinate and stored in scan_results.flags during wijk scan
- [x] **SCAN-05**: Funderingsrisico (PDOK WFS) fetched per unique postcode and stored in scan_results.flags during wijk scan
- [x] **SCAN-06**: All enrichment data accessible via existing parcel endpoints without additional on-demand API calls (flags-first lookup with fallback)
- [x] **SCAN-07**: Scan duration remains reasonable with batch deduplication, concurrency control, and parallel API fetching

### Score v3.0 Engine (Phase 100)

- [x] **SCORE-V3-01**: `potentie_score` (0-100) computed from 8 weighted factors: vrije grond (12), bestemming (12), perceelgrootte (12), vergunningssucceskans (13), optoppotentie (10), leegstand (8), demografie (8), Funda-frictie (5)
- [x] **SCORE-V3-02**: `risico_score` (0-100) computed from 9 weighted factors: funderingsrisico (15), bestemmingswijziging (8), juridisch klimaat (8), constructieve staat (7), bodem (7), asbest (6), criminaliteit (6), monument (5), max hoogte bereikt (5)
- [x] **SCORE-V3-03**: `overall` score = potentie - risico, stored in scan_results.score column (0-100 clamped) for tile proxy compat
- [x] **SCORE-V3-04**: `score_breakdown` per factor includes: waarde, genormaliseerde_score, gewicht, bijdrage, categorie, toelichting_kort, toelichting_lang, data_bronnen
- [x] **SCORE-V3-05**: Missing data handled: neutral score default, -10% penalty for critical risk factors, weight redistribution when >20% factors missing
- [x] **SCORE-V3-06**: Template-based narratieven (no AI calls) — deterministic, instant text generation per factor

### Score Backfill & Migration (Phase 101)

- [x] **BF-01**: Backfill tool re-scores all parcels in all completed scans using `compute_score_v3()`
- [x] **BF-02**: Tile endpoints serve `potentie_score` + `risico_score` via JSONB extraction from `flags.scores`
- [x] **BF-03**: Old v2.1 `score_breakdown` gracefully handled with v3.0-first detection and v2.1 fallback
- [x] **BF-04**: API endpoints (`ParcelAtPointResponse`) include `potentie_score` + `risico_score` fields

### v16.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAN-01 | Phase 99 | Pending |
| SCAN-02 | Phase 99 | Pending |
| SCAN-03 | Phase 99 | Pending |
| SCAN-04 | Phase 99 | Complete |
| SCAN-05 | Phase 99 | Complete |
| SCAN-06 | Phase 99 | Complete |
| SCAN-07 | Phase 99 | Complete |
| SCORE-V3-01 | Phase 100 | Complete |
| SCORE-V3-02 | Phase 100 | Complete |
| SCORE-V3-03 | Phase 100 | Complete |
| SCORE-V3-04 | Phase 100 | Complete |
| SCORE-V3-05 | Phase 100 | Complete |
| SCORE-V3-06 | Phase 100 | Complete |
| BF-01 | Phase 101 | Complete |
| BF-02 | Phase 101 | Complete |
| BF-03 | Phase 101 | Complete |
| BF-04 | Phase 101 | Complete |

**v16.0 Coverage:**
- Phase 99 requirements: 7 total
- Phase 100 requirements: 6 total
- Phase 101 requirements: 4 total
- Mapped to phases: 17
- Unmapped: 0

## v17.0 Requirements

Requirements for feature phases (103-106).

### Locatie Due Diligence Dossier (Phase 104)

- [x] **DD-01**: "Genereer Rapport" reads parcel data from scan_results.flags (pre-cached enrichment) — zero external API calls except BRK on-demand
- [x] **DD-02**: Report data structured by vergunning-relevance sections: Locatiegegevens, Kadaster & Eigendom, Bestemmingsplan & Bouwmogelijkheden, Risicoprofiel (bodem/fundering/asbest/geluid/lucht/natura2000/overstroming), Potentie & Risico Scores met narratieven, Vergunningen & Precedenten, Bronvermelding
- [x] **DD-03**: Each report section includes metadata: databron naam, datum opgehaald, betrouwbaarheidsindicatie
- [x] **DD-04**: PDF export generates professional A4 "Locatie Due Diligence Dossier" with cover page, table of contents, numbered sections, and footer with generation date + Propdex branding
- [x] **DD-05**: PDF includes potentie_score + risico_score with per-factor breakdown table and toelichting_lang narratieven as "Analyse" chapter
- [x] **DD-06**: Existing Rapporten tab, wijk folder auto-assignment, and rapport CRUD operations continue to work unchanged
- [x] **DD-07**: Report data schema (PropertyReportResponse) extended with all enrichment fields so saved reports contain the full dossier

### v17.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DD-01 | Phase 104 | Complete |
| DD-02 | Phase 104 | Complete |
| DD-03 | Phase 104 | Complete |
| DD-04 | Phase 104 | Complete |
| DD-05 | Phase 104 | Complete |
| DD-06 | Phase 104 | Complete |
| DD-07 | Phase 104 | Complete |

**v17.0 Coverage:**
- Phase 104 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

### Due Diligence Dashboard (Phase 107)

- [x] **DD107-01**: 7-item section nav (vertical, left-side) with URL-synced active state (?section= param), Framer Motion layoutId animated selection indicator, browser back/forward support
- [x] **DD107-02**: Each of 7 sections renders data from PropertyReportResponse with data completeness badge (complete/partial/empty), graceful null handling for old reports
- [x] **DD107-03**: Per-section notes textarea saved via PATCH /api/reports/{id}/notes as JSON string within existing notes field — zero backend changes, plain-text migration for pre-107 notes
- [x] **DD107-04**: Per-section document upload zone using Phase 106 useUploadDocument/useParcelDocuments hooks, linked to section-specific document_type keys, disabled when sourceParcelId is null
- [x] **DD107-05**: PDF export button in section footer triggers full due diligence PDF download via existing useExportPDF mutation (Phase 104 template)
- [x] **DD107-06**: Dashboard renders at existing /rapport/$id route — ReportDetailPage replaced, route wrapper updated, back button preserved
- [x] **DD107-07**: 300-line file limit enforced: 7 section files + shared components in sections/ and components/ subdirectories

### v17.0 Phase 107 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DD107-01 | Phase 107 | Complete |
| DD107-02 | Phase 107 | Complete |
| DD107-03 | Phase 107 | Complete |
| DD107-04 | Phase 107 | Complete |
| DD107-05 | Phase 107 | Complete |
| DD107-06 | Phase 107 | Complete |
| DD107-07 | Phase 107 | Complete |

**Phase 107 Coverage:**
- Requirements: 7 total
- Mapped to plans: 7
- Unmapped: 0

## v18.0 Requirements

### Score Customization (Phase 108)

- [x] **SC-01**: 4 environmental risk factors (natura2000, overstromingsrisico, geluid, luchtkwaliteit) scored in score_v3_factors.py with FactorResult pattern, narratieven, and proper normalization
- [x] **SC-02**: _RISICO_MAX updated to 87 (13 risico factors), DEFAULT_WEIGHTS exported as single source of truth
- [x] **SC-03**: Overall formula changed from `potentie - risico` to `potentie × (1 - risico_discount)` with 50% max discount cap, default 70/30 balance
- [x] **SC-04**: Per-organization score_weights JSONB column on organizations table with Alembic migration
- [x] **SC-05**: GET/PUT /api/users/org/score-weights endpoints with validation (min 3 active per category, weights 0-10)
- [x] **SC-06**: Background ARQ re-score job (weights-only from stored genormaliseerde_score, no re-computation) with impact summary
- [x] **SC-07**: compute_score_v3 accepts optional custom_weights parameter for per-org weight overrides on new scans
- [x] **SC-08**: /instellingen/score sub-route with preset cards (4 presets), potentie/risico balance slider, factor tables (toggle + weight 1-10), tab nav
- [x] **SC-09**: Save button triggers async re-score with progress indicator and impact preview (X up, Y down, avg delta)
- [x] **SC-10**: Subtle "Custom profiel" badge in ParcelDetailPanel when org uses non-default weights, derived at read time

### v18.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SC-01 | Phase 108 | Complete |
| SC-02 | Phase 108 | Complete |
| SC-03 | Phase 108 | Complete |
| SC-04 | Phase 108 | Complete |
| SC-05 | Phase 108 | Complete |
| SC-06 | Phase 108 | Complete |
| SC-07 | Phase 108 | Complete |
| SC-08 | Phase 108 | Complete |
| SC-09 | Phase 108 | Complete |
| SC-10 | Phase 108 | Complete |

**v18.0 Coverage:**
- Phase 108 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements updated: 2026-03-14*
