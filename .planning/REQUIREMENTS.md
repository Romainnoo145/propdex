# Requirements: Propdex v17.0 Projecten Portfolio

**Defined:** 2026-03-15
**Core Value:** Area -> Opportunity Intelligence -- scan any Dutch municipality and instantly find development opportunities

## v17.0 Requirements

Requirements for Projecten Portfolio milestone. Each maps to roadmap phases.

### Favorites

- [ ] **FAV-01**: User can click heart button on parcel detail panel to favorite/unfavorite a parcel (server-side, org-scoped)
- [ ] **FAV-02**: Heart button positioned next to close button, close button aligned with panel title
- [ ] **FAV-03**: Favorited parcels show a distinct marker/color on map tiles
- [ ] **FAV-04**: Wijk and gemeente cards show favorite count badge ("3 parcelen opgeslagen")

### Portfolio Navigation

- [ ] **PORT-01**: Projecten page is full-page layout (standard width, Aura styling, not bento)
- [ ] **PORT-02**: Provincie level shows image cards for all 12 Dutch provinces
- [ ] **PORT-03**: Clicking a provincie shows gemeente cards within that provincie (SVG silhouettes)
- [ ] **PORT-04**: Clicking a gemeente shows wijk cards within that gemeente (SVG silhouettes)
- [ ] **PORT-05**: Clicking a wijk shows favorited parcel cards (address + score, clean format)
- [ ] **PORT-06**: Ghost button at bottom of each level to open detail view
- [ ] **PORT-07**: Breadcrumb navigation (Projecten → Limburg → Venlo → Wijk 01)
- [ ] **PORT-08**: Only show provincies/gemeenten/wijken that contain favorited parcels

### Pipeline

- [ ] **PIPE-01**: Each favorited parcel has a pipeline stage: Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond
- [ ] **PIPE-02**: User can change pipeline stage via pill/dropdown selector on parcel card
- [ ] **PIPE-03**: Default stage is "Gesignaleerd" when parcel is favorited
- [ ] **PIPE-04**: User can filter parcel list by pipeline stage across all wijken
- [ ] **PIPE-05**: Afgerond stage captures reason: Gekocht or Afgewezen (with optional note)

### Backend Infrastructure

- [x] **BACK-01**: ParcelFavorite model (org_id, user_id, parcel_id as Kadaster string, wijk_code, gemeente_code, pipeline_stage, created_at)
- [x] **BACK-02**: Favorites CRUD API endpoints (POST/GET/DELETE) with multi-tenant isolation
- [x] **BACK-03**: Pipeline stage update endpoint (PATCH)
- [x] **BACK-04**: Bulk portfolio endpoint: list all favorites grouped by gemeente/wijk with counts
- [ ] **BACK-05**: ProjectList.tsx refactored from 1867 lines into sub-components before new features

## Pending from Previous Milestones

### Scan Pipeline Enrichment (v16.0, Phase 99) — Incomplete

- [ ] **SCAN-01**: Energielabel (EP-Online) fetched per VBO ID and stored in scan_results.flags during wijk scan
- [ ] **SCAN-02**: WOZ waarde (Waardeloket) fetched per nummeraanduiding ID and stored in scan_results.flags during wijk scan
- [ ] **SCAN-03**: Vergunningen (SRU Bekendmakingen) fetched per unique postcode and stored in scan_results.flags during wijk scan

### Aura Reskin Batch (v15.0, Phases 94-96) — Backlog

- [ ] **WIJK-01**: Bottom Bento Sheet (30-40% screen height) with fly-up animation on wijk click
- [ ] **WIJK-02**: 4-column bento layout: Wijk Identity | Bestemming bar | Stats grid | Kansen glow-cards
- [ ] **WIJK-03**: Selected wijk gets outer glow on map
- [ ] **WIJK-04**: Click-through from wijk pods to deeper data
- [ ] **GEM-01**: Gemeente-level map shows wijk boundaries with luminous white borders
- [ ] **GEM-02**: Gemeente context accessible without bottom sheet
- [ ] **RES-01**: /resultaten route gets Aura visual treatment
- [ ] **RES-02**: Table maintains existing functionality with new styling
- [ ] **JUR-01**: Wizard flow redesigned in Aura style
- [ ] **JUR-02**: Explorer redesigned with glass containers
- [ ] **MELD-01**: Meldingen feed redesigned with bento cards
- [ ] **MELD-02**: Gemeente filter and infinite scroll preserved with new Aura styling

## v18.0 Requirements (Deferred)

### Workspace

- **WORK-01**: Per-parcel project workspace with expanded dossier view and completeness tracking
- **WORK-02**: Dossier action links: where to request missing documents (Kadaster, EP-Online, gemeente)
- **WORK-03**: Outreach template generation: brief naar eigenaar, principeverzoek gemeente (DOCX download)

### Multi-Parcel

- **MULTI-01**: Select multiple favorited parcels in a wijk and group as one deal/project
- **MULTI-02**: Deal card in portfolio view aggregating grouped parcels

### Advanced

- **ADV-01**: Map pipeline overlay: color parcels by pipeline stage on map tiles
- **ADV-02**: Go/no-go dashboard with decision scoring
- **ADV-03**: Email sending for outreach templates (not just download)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kanban drag-and-drop board | Over-engineering for this persona; pill selector is sufficient |
| Custom pipeline stages per org | 5 universal stages cover Dutch acquisition workflow; custom is v19+ |
| CRM contact management | Different product domain -- Propdex is intelligence, not CRM |
| Automated email sending | AVG/GDPR risks, deliverability complexity -- defer to dedicated milestone |
| BRK owner data in templates | AVG violation + Kadaster ToS breach -- templates use placeholders only |
| Real-time collaboration | Shared favorites, live co-editing -- future multi-user feature |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BACK-01 | Phase 109 | Complete |
| BACK-02 | Phase 109 | Complete |
| BACK-03 | Phase 109 | Complete |
| BACK-04 | Phase 109 | Complete |
| BACK-05 | Phase 110 | Pending |
| FAV-01 | Phase 110 | Pending |
| FAV-02 | Phase 110 | Pending |
| FAV-03 | Phase 113 | Pending |
| FAV-04 | Phase 111 | Pending |
| PORT-01 | Phase 111 | Pending |
| PORT-02 | Phase 111 | Pending |
| PORT-03 | Phase 111 | Pending |
| PORT-04 | Phase 111 | Pending |
| PORT-05 | Phase 111 | Pending |
| PORT-06 | Phase 111 | Pending |
| PORT-07 | Phase 111 | Pending |
| PORT-08 | Phase 111 | Pending |
| PIPE-01 | Phase 112 | Pending |
| PIPE-02 | Phase 112 | Pending |
| PIPE-03 | Phase 112 | Pending |
| PIPE-04 | Phase 112 | Pending |
| PIPE-05 | Phase 112 | Pending |

**Coverage:**
- v17.0 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 -- traceability filled (all 22 requirements mapped to phases 109-113)*
