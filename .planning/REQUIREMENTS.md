# Requirements: Propdex

**Defined:** 2026-02-16
**Core Value:** Area -> Opportunity Intelligence — scan any Dutch municipality and instantly find development opportunities

## v4.0 Requirements

Requirements for v4.0 UX Redesign. Each maps to roadmap phases.

### Design System

- [ ] **DS-01**: User sees consistent Industrial Amber color palette (mustard accent on grey/white base) across all UI components
- [ ] **DS-02**: UI components use Tailwind v4 @theme design token system (CSS variables) as single source of truth
- [ ] **DS-03**: Map base layer displays silver/desaturated style for professional data overlay contrast
- [ ] **DS-04**: Navigation chrome uses glassmorphism effect while data areas use solid backgrounds for readability
- [ ] **DS-05**: UI uses lucide-react icons consistently throughout the interface

### Navigation

- [ ] **NAV-01**: User navigates between Kaart, Resultaten, and Projecten via icon sidebar
- [ ] **NAV-02**: Map remains loaded and preserves camera position during navigation between views
- [ ] **NAV-03**: User can view parcel details in inspector slide-over panel while map stays visible
- [ ] **NAV-04**: Results view exists as separate route accessible via sidebar and "Toon Lijst" button on map

### Feedback

- [ ] **FB-01**: User sees loading spinners and skeleton screens during data fetching operations
- [ ] **FB-02**: User sees empty states with guidance when no data exists (first scan, no results, no projects)
- [ ] **FB-03**: User sees error states with recovery actions (retry, modify search) when operations fail
- [ ] **FB-04**: User receives toast notifications confirming successful actions
- [ ] **FB-05**: User sees step-based progress indicator during multi-step scan operations
- [ ] **FB-06**: User sees real-time scan progress details ("Fetching kadaster...", "Analyzing 247 parcels...")

### Data Table

- [ ] **DT-01**: User can sort and filter parcel results by multiple criteria simultaneously
- [ ] **DT-02**: Hovering a table row highlights corresponding parcel on map, and vice versa
- [ ] **DT-03**: User can select multiple parcels and perform bulk actions (export CSV, add to project)
- [ ] **DT-04**: Filter state persists when navigating between views
- [ ] **DT-05**: User sees advanced filter panel with category groups (location, area, zoning, score)

### Scan Flow

- [ ] **SCAN-01**: Scan-to-results flow completes with minimal clicks while maintaining map context
- [ ] **SCAN-02**: Scan state is clearly indicated throughout the flow (selecting, fetching, analyzing, complete)

### Settings

- [ ] **SET-01**: User can access settings page via sidebar navigation
- [ ] **SET-02**: User can manage account settings (name, email, password)
- [ ] **SET-03**: User can configure notification preferences
- [ ] **SET-04**: User can adjust appearance settings (theme, map style preferences)

### Mobile

- [ ] **MOB-01**: User can view map, projects, and scan results on mobile in read-only mode
- [ ] **MOB-02**: Data tables transform to card layout on mobile screens
- [ ] **MOB-03**: Touch targets are minimum 44px across all interactive elements

### Migration

- [ ] **MIG-01**: All existing glassmorphism components migrated to Industrial Amber design system
- [ ] **MIG-02**: Legacy glassmorphism CSS removed after migration

## Future Requirements (v4.1+)

### Advanced Interactions

- **ADV-01**: User can draw spatial filter area on map to define search region
- **ADV-02**: User sees contextual help tooltips for zoning codes, scores, and technical terms

### Enhancements

- **ENH-01**: Project organization with folders, tags, and enhanced search
- **ENH-02**: Dark theme toggle in appearance settings

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full mobile editing/scanning | Complex map interactions don't work on phones; desktop is primary workflow |
| Auto-refreshing data tables | Disorienting when rows shift during reading; use manual refresh banner |
| Nested modal patterns | Use slide-over panels to maintain parent context |
| AI-driven filtering | Adds unpredictability; clean logical filters more appropriate for professional tool |
| Infinite scroll in tables | Use pagination with configurable page size (25/50/100) |
| Toast notifications for errors | Critical errors need acknowledgment; use banners/modals for errors requiring action |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DS-01 | Phase 27 | Pending |
| DS-02 | Phase 27 | Pending |
| DS-03 | Phase 29 | Pending |
| DS-04 | Phase 29 | Pending |
| DS-05 | Phase 27 | Pending |
| NAV-01 | Phase 28 | Pending |
| NAV-02 | Phase 28 | Pending |
| NAV-03 | Phase 28 | Pending |
| NAV-04 | Phase 30 | Pending |
| FB-01 | Phase 32 | Pending |
| FB-02 | Phase 32 | Pending |
| FB-03 | Phase 32 | Pending |
| FB-04 | Phase 32 | Pending |
| FB-05 | Phase 32 | Pending |
| FB-06 | Phase 32 | Pending |
| DT-01 | Phase 33 | Pending |
| DT-02 | Phase 33 | Pending |
| DT-03 | Phase 33 | Pending |
| DT-04 | Phase 33 | Pending |
| DT-05 | Phase 33 | Pending |
| SCAN-01 | Phase 33 | Pending |
| SCAN-02 | Phase 33 | Pending |
| SET-01 | Phase 35 | Pending |
| SET-02 | Phase 35 | Pending |
| SET-03 | Phase 35 | Pending |
| SET-04 | Phase 35 | Pending |
| MOB-01 | Phase 34 | Pending |
| MOB-02 | Phase 34 | Pending |
| MOB-03 | Phase 34 | Pending |
| MIG-01 | Phase 31 | Pending |
| MIG-02 | Phase 31 | Pending |

**Coverage:**
- v4.0 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0

**Validation:** 100% requirement coverage achieved ✓

---
*Requirements defined: 2026-02-16*
*Last updated: 2026-02-16 after roadmap creation*
