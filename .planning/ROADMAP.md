# Propdex -- Roadmap

## Milestones

- 🚧 **v4.0 UX Redesign** -- Phases 27-36 (active)
- ✅ **v3.1 Smart Area Intelligence** -- Phases 22-26 (shipped 2026-02-15)
- ✅ **v3.0 Spatial Foundation** -- Phases 18-21 (shipped 2026-02-11)
- ✅ **v2.0 Frontend** -- Phases 13-17 (shipped 2026-02-09)
- ✅ **v1.1 Production Hardening** -- Phases 6-12 (shipped 2026-02-08)
- ✅ **v1.0 Core Intelligence Engine** -- Phases 1-5 (shipped 2026-02-07)

---

## v4.0 UX Redesign (Phases 27-36)

**Goal:** Transform the frontend from a functional prototype into a polished, professional PropTech tool with a consistent "Industrial Amber" design system, restructured navigation, and smooth user flows.

**Started:** 2026-02-16
**Status:** Phase 27 complete, Phase 28 next

### Phase 27: Design System Foundation

**Goal:** Establish Industrial Amber design token system as single source of truth for all UI styling.

**Dependencies:** None (foundational)

**Requirements:**
- DS-01: Industrial Amber color palette consistency
- DS-02: Tailwind v4 @theme design tokens
- DS-05: Lucide-react icons

**Plans:** 3 plans

Plans:
- [x] 27-01-PLAN.md — Design tokens, fonts, cn() utility, ESLint enforcement
- [x] 27-02-PLAN.md — UI primitives (Button, Card, Badge, Input, Select)
- [x] 27-03-PLAN.md — Storybook setup, stories, visual verification

**Success Criteria:**
1. Developer can reference design tokens via Tailwind utilities (e.g., `bg-amber-accent`, `text-grey-800`) throughout codebase
2. UI primitives (button, card, badge, input, select) render with Industrial Amber styling in Storybook
3. Icons from lucide-react display consistently across all interface elements
4. Design token changes in `@theme` automatically propagate to all components without code changes
5. Zero hardcoded colors remain in component files (enforced via ESLint rule)

---

### Phase 28: Navigation Structure + Persistent MapView

**Goal:** Restructure navigation with icon sidebar and persistent MapView that never unmounts during route changes.

**Dependencies:** Phase 27 (requires design tokens)

**Requirements:**
- NAV-01: Icon sidebar navigation between views
- NAV-02: Map preserves camera position during navigation
- NAV-03: Inspector slide-over panel for parcel details

**Plans:** 2 plans

Plans:
- [ ] 28-01-PLAN.md — MapContext + persistent MapView hoist to layout
- [ ] 28-02-PLAN.md — SideRailNav update + InspectorPanel slide-over

**Success Criteria:**
1. User clicks sidebar icons to navigate between Kaart, Resultaten, and Projecten without map reload
2. Map camera position, zoom level, and selected parcel persist when switching views
3. User clicks parcel on map to open inspector slide-over panel while map remains visible
4. Inspector panel displays parcel details without blocking map interactions
5. Browser back/forward buttons navigate between views with map state preserved

---

### Phase 29: Silver Map Theme + Layout Shells

**Goal:** Apply silver/desaturated map styling and create reusable layout shell components.

**Dependencies:** Phase 28 (requires persistent MapView structure)

**Requirements:**
- DS-03: Silver/desaturated map base layer
- DS-04: Glassmorphism refinement for navigation chrome

**Success Criteria:**
1. Map base layer displays with desaturated silver aesthetic that provides neutral backdrop
2. Zoning overlays and parcel boundaries stand out clearly against silver map background
3. Navigation chrome (sidebar, inspector panel) uses glassmorphism while data areas use solid backgrounds
4. MapShell and ResultsShell layout wrappers provide consistent page structure
5. Visual hierarchy clearly distinguishes navigation controls from data content

---

### Phase 30: View Separation (Results Route)

**Goal:** Extract results view from monolithic map page into separate route while maintaining context.

**Dependencies:** Phase 29 (requires layout shells)

**Requirements:**
- NAV-04: Results view as separate route

**Success Criteria:**
1. User accesses results view via sidebar icon or "Toon Lijst" button from map
2. Results route displays scan data in dedicated page with full-width table
3. Clicking "Toon Kaart" button returns to map view with scan results preserved
4. URL reflects current view (e.g., `/kaart`, `/resultaten?scan_id=123`) for shareable links
5. Scan context (gemeente_code, scan_id) persists across view transitions

---

### Phase 31: Component Migration (Glassmorphism → Industrial Amber)

**Goal:** Migrate high-visibility components from glassmorphism to Industrial Amber design system.

**Dependencies:** Phase 27 (requires design tokens), Phase 28 (requires stable navigation)

**Requirements:**
- MIG-01: Glassmorphism components migrated to Industrial Amber
- MIG-02: Legacy glassmorphism CSS removed

**Success Criteria:**
1. Drawer, Modal, and SideRailNav components render with Industrial Amber styling
2. ReportSidebar and PropertyCard use design tokens instead of hardcoded glassmorphism colors
3. Visual consistency achieved across all high-visibility UI components
4. Legacy glassmorphism CSS classes removed from codebase
5. No visual regressions in component functionality after migration

---

### Phase 32: Feedback Systems

**Goal:** Implement comprehensive user feedback for loading, error, empty, and success states.

**Dependencies:** Phase 31 (requires visual system stability)

**Requirements:**
- FB-01: Loading spinners and skeleton screens
- FB-02: Empty states with guidance
- FB-03: Error states with recovery actions
- FB-04: Toast notifications for success confirmations
- FB-05: Step-based progress indicator for multi-step operations
- FB-06: Real-time scan progress details

**Success Criteria:**
1. User sees skeleton screens while data loads, never blank white screens
2. Empty states display helpful guidance ("No scans yet. Click a wijk to start scanning.")
3. Errors show clear recovery actions ("Scan failed. [Retry] [Modify Search]")
4. Toast notifications confirm successful actions ("Project saved", "Filters applied")
5. Multi-step scan displays progress stepper showing current step and remaining steps
6. Real-time progress messages update during scan ("Fetching kadaster...", "Analyzing 247 parcels...")

---

### Phase 33: Data Table Polish

**Goal:** Enhance data table with list-map sync, multi-select, advanced filters, and persistent state.

**Dependencies:** Phase 31 (requires migrated components)

**Requirements:**
- DT-01: Multi-criteria sorting and filtering
- DT-02: List-map sync (bidirectional highlighting)
- DT-03: Multi-select and bulk actions
- DT-04: Persistent filter state
- DT-05: Advanced filter panel with category groups
- SCAN-01: Minimal-click scan-to-results flow
- SCAN-02: Clear scan state indication

**Success Criteria:**
1. Hovering table row highlights corresponding parcel on map, and hovering map parcel highlights table row
2. User selects multiple parcels via checkboxes and performs bulk export or "Add to Project"
3. Applied filters persist when navigating away from results and returning
4. Advanced filter panel groups filters by category (location, area, zoning, score)
5. Scan completes with automatic navigation to results view, preserving map context
6. Scan state clearly indicated throughout flow (selecting wijk → fetching → analyzing → complete)

---

### Phase 34: Mobile Responsiveness

**Goal:** Adapt desktop UX for mobile/tablet field use with read-only mode.

**Dependencies:** Phase 31 (requires stable visual system)

**Requirements:**
- MOB-01: Mobile view-only mode (map, projects, scan results)
- MOB-02: Table-to-card layout transformation on mobile
- MOB-03: 44px minimum touch targets

**Success Criteria:**
1. User browses map, views projects, and reads scan results on mobile device
2. Data tables transform to card layout on screens below 768px width
3. All interactive elements have minimum 44px touch targets for comfortable tapping
4. Inspector panel transforms to bottom sheet on mobile for easier reach
5. Edit and scan features gracefully disabled on mobile with explanation ("Use desktop for full analysis")

---

### Phase 35: Settings Page

**Goal:** Add user preferences page for account, notifications, appearance, and data management.

**Dependencies:** Phase 31 (requires migrated components)

**Requirements:**
- SET-01: Settings page accessible via sidebar
- SET-02: Account settings management (name, email, password)
- SET-03: Notification preferences configuration
- SET-04: Appearance settings (theme, map style)

**Success Criteria:**
1. User accesses settings page via sidebar icon
2. User updates account details (name, email) and changes password
3. User configures notification preferences (email alerts for change monitoring)
4. User adjusts appearance settings (theme selection, map style preferences)
5. Settings changes persist across sessions and sync across devices

---

### Phase 36: Polish + Performance

**Goal:** Optimize performance, remove legacy code, and document design system.

**Dependencies:** All previous phases (final cleanup)

**Requirements:** None (polish phase)

**Success Criteria:**
1. Animations run at 60fps on desktop and 30fps minimum on mid-range mobile
2. Glassmorphism effects disabled on mobile to improve performance
3. Bundle size reduced by removing unused dependencies and legacy CSS
4. Storybook documentation complete for all UI primitives and layout shells
5. Lighthouse performance score above 90 for all main routes

---

## Progress

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 27 | Design System Foundation | DS-01, DS-02, DS-05 | ✓ Complete (2026-02-16) |
| 28 | Navigation + Persistent MapView | NAV-01, NAV-02, NAV-03 | Pending |
| 29 | Silver Map Theme + Layout Shells | DS-03, DS-04 | Pending |
| 30 | View Separation | NAV-04 | Pending |
| 31 | Component Migration | MIG-01, MIG-02 | Pending |
| 32 | Feedback Systems | FB-01, FB-02, FB-03, FB-04, FB-05, FB-06 | Pending |
| 33 | Data Table Polish | DT-01, DT-02, DT-03, DT-04, DT-05, SCAN-01, SCAN-02 | Pending |
| 34 | Mobile Responsiveness | MOB-01, MOB-02, MOB-03 | Pending |
| 35 | Settings Page | SET-01, SET-02, SET-03, SET-04 | Pending |
| 36 | Polish + Performance | — | Pending |

**Total:** 10 phases, 31 requirements
**Coverage:** 31/31 requirements mapped (100%)

---

## Phases

<details>
<summary>✅ v3.1 Smart Area Intelligence (Phases 22-26) -- SHIPPED 2026-02-15</summary>

- [x] Phase 22: Bestemmingsplan Base Layer (3/3 plans) -- WMS raster tiles, SVBP2012 colors, GetFeatureInfo popup, legend
- [x] Phase 23: Working Scan Pipeline (4/4 plans) -- BAG WFS pagination, WMS enrichment, CBS bbox, scoring fixes
- [x] Phase 24: Wijk-Based Area Selection (4/4 plans) -- CBS wijk WFS, gemeente context, click-to-scan, viewport button
- [x] Phase 25: Results Interface (5/5 plans) -- Split-panel, TanStack Table, filters, map-table linking, detail modal
- [x] Phase 26: Change Monitoring (6/6 plans) -- Hierarchical projects, SRU+PLU detection, ARQ cron, notification UI

**22 plans, 16 requirements, 97 commits, ~27,200 LOC (13,756 Python + 13,444 TypeScript)**
**Archive:** `.planning/milestones/v3.1-ROADMAP.md`

</details>

<details>
<summary>✅ v3.0 Spatial Foundation (Phases 18-21) -- SHIPPED 2026-02-11</summary>

- [x] Phase 18: Spatial Foundation (4/4 plans) -- PostGIS, parcel cache, spatial queries, RLS
- [x] Phase 19: Government API Clients (5/5 plans) -- BAG WFS, SRU Bekendmakingen, BRK Bevragen, rate limiting
- [x] Phase 20: Area Scanner + REST API (6/6 plans) -- Scan pipeline, ARQ job, scoring, Excel export
- [x] Phase 21: Map Visualization (5/5 plans) -- CBS gemeente layer, vector tiles, MVT endpoint, scan progress overlay

**20 plans, 14 requirements, PostGIS + government API clients + scan pipeline + map visualization**
**Archive:** `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Frontend (Phases 13-17) -- SHIPPED 2026-02-09</summary>

- [x] Phase 13: Map Foundation & Layout (3/3 plans) -- React/Vite scaffold, full-page MapLibre map, layer toggle
- [x] Phase 14: Authentication & Security (5/5 plans) -- JWT httpOnly cookies, silent refresh, protected routes
- [x] Phase 15: Property Data & Map Interactions (5/5 plans) -- Address search, property lookup, parcel boundaries
- [x] Phase 16: Property Details & Reports (7/7 plans) -- Three-tier disclosure, report sidebar, PDF export
- [x] Phase 17: Projects & Polish (4/4 plans) -- Project CRUD, responsive drawer, force refresh, report detail page

**24 plans, 9 requirements, 8,804 LOC TypeScript/React**
**Archive:** `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Production Hardening (Phases 6-12) -- SHIPPED 2026-02-08</summary>

- [x] Phase 6: Security & Configuration (3/3 plans) -- RLS enforcement, config consolidation, per-org freshness
- [x] Phase 7: Test Infrastructure & Auth Testing (2/2 plans) -- test framework, 51 auth tests, Phase 1 verification
- [x] Phase 8: Data Pipeline Testing (2/2 plans) -- 55 API client + 20 cache manager tests
- [x] Phase 9: Intelligence Testing (3/3 plans) -- 43 aggregator + 14 AI + 9 integration + 3 ARQ tests
- [x] Phase 10: Report & Multi-Tenant Testing (3/3 plans) -- 15 report CRUD + 9 PDF + 9 multi-tenant tests
- [x] Phase 11: Coverage Gap Closure (4/4 plans) -- 42 tests closing audit-identified gaps
- [x] Phase 12: Phase Documentation & Verification (2/2 plans) -- retroactive VERIFICATION.md for all phases

**19 plans, 15 requirements, 275 tests, 15,947 LOC Python**
**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.0 Core Intelligence Engine (Phases 1-5) -- SHIPPED 2026-02-07</summary>

- [x] Phase 1: Foundation & Authentication (3/3 plans) -- JWT auth, multi-tenant RLS, email verification, Google OAuth, rate limiting
- [x] Phase 2: Core Data Pipeline (3/3 plans) -- httpx client, JSONB cache, BAG/PDOK APIs, property aggregator
- [x] Phase 3: Zoning & Monument Intelligence (4/4 plans) -- DSO zoning, RCE monuments, spatial intersection, PropertyReportResponse
- [x] Phase 4: AI Document Parsing (4/4 plans) -- Claude PDF parsing, ARQ worker, job polling, upload fallback
- [x] Phase 5: Report Management (3/3 plans) -- Save/list/search, project folders, PDF export, freshness detection

**17 plans, 14 requirements, 8,281 LOC Python**
**Archive:** `.planning/milestones/v1.0-ROADMAP.md`

</details>

---

*Last updated: 2026-02-16 (Phase 27 complete)*
