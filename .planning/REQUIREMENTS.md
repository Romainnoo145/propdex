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
| RPT-01 | Phase 97 | Pending |
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
- [ ] **SCAN-06**: All enrichment data accessible via existing parcel endpoints without additional on-demand API calls (flags-first lookup with fallback)
- [x] **SCAN-07**: Scan duration remains reasonable with batch deduplication, concurrency control, and parallel API fetching

### v16.0 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCAN-01 | Phase 99 | Pending |
| SCAN-02 | Phase 99 | Pending |
| SCAN-03 | Phase 99 | Pending |
| SCAN-04 | Phase 99 | Complete |
| SCAN-05 | Phase 99 | Complete |
| SCAN-06 | Phase 99 | Pending |
| SCAN-07 | Phase 99 | Complete |

**v16.0 Coverage:**
- Phase 99 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements updated: 2026-03-11*
