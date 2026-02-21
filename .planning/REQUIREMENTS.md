# Requirements: Propdex v5.1 — Data Presentation Overhaul

**Defined:** 2026-02-21
**Core Value:** Area -> Opportunity Intelligence — card-based drill-down navigation from gemeente to wijk to results

## v5.1 Requirements

Card-based drill-down navigation replacing the current flat list approach. Users navigate: Gemeente cards -> Wijk cards -> Results table.

### Navigation

- [ ] **NAV-01**: Projecten page shows gemeente cards in a responsive grid (3 columns desktop, 2 tablet, 1 mobile)
- [ ] **NAV-02**: Clicking a gemeente card navigates to that gemeente's wijk cards in the same grid layout
- [ ] **NAV-03**: Clicking a wijk card navigates to the results table filtered on that wijk's scan data
- [ ] **NAV-04**: Breadcrumb navigation shows current drill-down path (Projecten > Gemeente > Wijk) with back navigation
- [ ] **NAV-05**: URL state reflects current navigation level (deep-linkable)

### Cards

- [ ] **CARD-01**: Gemeente card displays the actual gemeente boundary shape as an SVG silhouette
- [ ] **CARD-02**: Gemeente card displays the gemeente name prominently
- [ ] **CARD-03**: Gemeente card displays a notification badge when unread change records exist for that gemeente
- [ ] **CARD-04**: Wijk card displays the wijk boundary shape as an SVG silhouette
- [ ] **CARD-05**: Wijk card displays the wijk name prominently
- [ ] **CARD-06**: Wijk card displays a notification badge when unread change records exist for that specific wijk
- [ ] **CARD-07**: Card grid is responsive and maintains visual consistency across breakpoints

### Theme

- [ ] **THEME-01**: Dark mode and light mode are visually consistent — no hardcoded color classes bypass CSS variables
- [ ] **THEME-02**: All amber/accent color usage goes through `--color-amber-accent` CSS variable (no Tailwind amber-* classes)
- [ ] **THEME-03**: Theme toggle works reliably and persists across sessions via localStorage

## v5.2+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Table Enhancements

- **TABLE-01**: Column visibility toggle (show/hide columns)
- **TABLE-02**: Density control (compact/regular/relaxed rows)
- **TABLE-03**: Column pinning (sticky address + score columns)
- **TABLE-04**: Save/restore filter state to localStorage

### Comparison & Report

- **COMP-01**: Property comparison view (side-by-side, up to 4 parcels)
- **REPORT-01**: Property report visual hierarchy redesign
- **REPORT-02**: Mini-map with parcel boundary in report page
- **REPORT-03**: Tab/card section layout for report page

### Map

- **MAP-01**: Direct filter controls on the map (bestemming type, score range)
- **MAP-02**: Map layer toggle panel

## Out of Scope

| Feature | Reason |
|---------|--------|
| Score trend indicator | Requires historical score storage (new backend model) |
| Table column reordering (drag) | High complexity, low value for current user base |
| Saved scan comparison (diff two runs) | Requires backend diff logic |
| Property comparison view | Deferred to v5.2 — validate user demand first |
| Report redesign | Deferred to v5.2 — focus on navigation first |
| Map filtering | Deferred to v5.2 — current filter panel sufficient |
| Print/PDF optimized layout | Enterprise feature — defer until sales require it |

## Traceability

Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | — | Pending |
| NAV-02 | — | Pending |
| NAV-03 | — | Pending |
| NAV-04 | — | Pending |
| NAV-05 | — | Pending |
| CARD-01 | — | Pending |
| CARD-02 | — | Pending |
| CARD-03 | — | Pending |
| CARD-04 | — | Pending |
| CARD-05 | — | Pending |
| CARD-06 | — | Pending |
| CARD-07 | — | Pending |
| THEME-01 | — | Pending |
| THEME-02 | — | Pending |
| THEME-03 | — | Pending |

**Coverage:**
- v5.1 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after initial definition*
