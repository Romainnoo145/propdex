# Feature Research

**Domain:** Premium Data Presentation for Property Intelligence Platform (Dutch PropTech)
**Researched:** 2026-02-21
**Confidence:** HIGH (TanStack Table official docs + codebase analysis) / MEDIUM (PropTech UX patterns via web research) / MEDIUM (scoring visualization patterns)

---

## Context: What Already Exists (Do Not Re-Build)

This is a data presentation overhaul milestone. The following are already shipped:

**Scan results table (ResultsTable.tsx):**
- TanStack Table v8 with manual sort + pagination (50/page)
- Multi-sort (Shift+click, up to 3 columns)
- Checkbox selection + bulk CSV export
- Score badge (amber glow: High/Medium/Low)
- Columns: select, perceelcode, adres, oppervlak, bestemming, bouwjaar, score
- Sticky thead, hover highlight, auto-scroll to selected row
- Mobile card list branch (ParcelCard) below 768px

**Filter panel (ResultsFilterPanel.tsx):**
- Score category pills (Hoog/Midden/Laag)
- Bestemming dropdown, status dropdown
- Area range (min/max m2, 500ms debounce)
- Clear all button, active count display
- URL-synchronized (filters preserved in URL params)

**Property detail drawer (ParcelDetailModal.tsx):**
- Score breakdown: 5 factors (pand_status_signal, building_age, zoning_value, footprint_size, underutilization)
- Factor labels in Dutch, max-points per factor (for progress bar scaling)
- Tier 2 enrichment on open (vergunningen via SRU)
- Change monitoring / bekendmakingen feed

**Report page (ReportDetailPage.tsx):**
- Max-width 4xl centered layout
- Signal banner (actionable BAG status, amber/grey severity)
- Monument alert (amber bordered card)
- 4-column quick-facts grid (MetricCard)
- Sections: Gebouw, Kadaster, Bestemming, Monument, AI Interpretatie / PDF Upload, Bronnen
- "Bekijk op kaart" navigation button

**Map:**
- CBS gemeente/wijk boundaries
- Kadaster parcels + bestemmingsplan zones
- Scan result markers with score-based color
- InspectorPanel slide-over

**Theme:**
- Dark mode default, `html.light` toggle
- CSS variables: `--color-overlay`, grey scale 100–950 semantic
- Amber accent (`--color-amber-accent`) as brand signal color

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the target users (Dutch projectontwikkelaars) will expect from a premium data platform. Missing these makes the product feel prototype-quality.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Column visibility toggle (show/hide columns) | Standard in every enterprise data tool (Airtable, Notion, CRE platforms) | LOW | TanStack Table has `column.toggleVisibility()` + `getToggleVisibilityHandler()` — HIGH confidence from official docs |
| Density control (compact / regular / relaxed rows) | Users scanning 500+ parcels need to control information density | LOW | CSS row height variants: 40px / 48px / 56px — pattern from pencilandpaper.io research |
| Column pinning / freeze (lock score + address columns) | When horizontal scrolling more columns, key identifiers must stay visible | MEDIUM | TanStack Table `columnPinning` feature with sticky CSS — well-documented, some edge cases with virtualization |
| Save/restore filter state (localStorage) | Returning users expect their last filter config to persist | LOW | Theme system already uses localStorage (`propdex-theme`) — same pattern for filter state |
| Score factor breakdown visible in table row detail | Users need to understand WHY a parcel scored high before clicking to full report | LOW | Factor labels + FACTOR_MAX already exist in ParcelDetailModal — expose in drawer expansion |
| Inline "generate report" action from table row | The click-to-report action must be one step, not buried | LOW | `useGenerateReportFromParcel` hook already exists in ParcelDetailModal |
| Clear visual score scale legend | Users need to know what 0-100 means in context | LOW | Currently missing — amber badge alone is not self-explanatory |
| Sortable by all numeric columns | Area, bouwjaar, score — all should be sortable | LOW | Already implemented for score/area/bouwjaar; perceelcode and bestemming correctly non-sortable |
| Responsive table → card fallback | Mobile users still need to access results | LOW | Already implemented (ParcelCard branch) |

### Differentiators (Competitive Advantage)

Features that elevate Propdex above generic real estate search tools. These target the decision-making workflow of projectontwikkelaars specifically.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Score breakdown bar chart in drawer (factor contribution) | Makes scoring transparent — users trust scores they can understand; competitors show a single number | MEDIUM | Horizontal stacked bar or waterfall chart using Recharts (already available as dep or easy add) — factor data already exists |
| Property comparison view (side-by-side, up to 4 parcels) | Projectontwikkelaars compare shortlisted parcels before committing; forces selection workflow | HIGH | Requires: checkbox selection (done) → comparison panel → side-by-side layout. No existing competitor in NL market has this UX |
| Map layer toggle panel (interactive, per-layer controls) | Users want to turn off bestemmingsplan zones when looking at physical reality | MEDIUM | Existing map has multiple layers but no user-facing toggle UI; pattern: floating panel with toggle switches per layer |
| Inline mini-map in report page | Keeps spatial context visible without navigating away; standard in premium PropTech (Reonomy-style) | MEDIUM | Use existing map infrastructure, constrained to a 300px card; Mapbox/Leaflet component extract |
| Insight cards with Dutch developer-language reasoning | "Dit perceel is geschikt voor transformatie omdat..." — contextual summaries, not raw data | MEDIUM | STATUS_EXPLANATIONS pattern already exists (ReportDetailPage) — extend to parcel drawer and expand vocabulary |
| Score trend indicator (change since last scan) | Parcels gaining/losing score over time surfaces dynamics | HIGH | Requires historical score data storage (new backend); defer unless change monitoring data can be repurposed |
| Saved scan comparison (compare two scan runs) | Municipality re-scanned after zoning change — compare what improved | HIGH | Requires backend diff logic; v6+ feature |
| Table column reordering (drag to reorder) | Power user feature for building personal workflows | HIGH | TanStack Table supports `columnOrder` state but drag-and-drop requires dnd-kit or similar; high complexity for moderate value |
| Heatmap overlay on results table (conditional formatting) | Color-code table cells by value range (area, bouwjaar) — like Excel conditional formatting | MEDIUM | CSS class calculation per cell, no charting library needed; high visual impact |
| Print/PDF-optimized report layout | Users share reports with clients; browser print CSS often breaks | MEDIUM | `@media print` CSS overrides; separate route or print button triggering `window.print()` |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time score updates while browsing | Feels dynamic and responsive | Re-scores mid-session confuse users mid-comparison; scan is a point-in-time snapshot | Show "gescand op [datum]" clearly; add manual re-scan trigger |
| Fully custom column formulas / user-defined scoring | Power users want to weight factors differently | Complexity explosion; support burden; undermines Propdex's core value proposition (curated intelligence) | Offer preset filter profiles ("focus op transformatie", "focus op sloop") |
| Infinite scroll instead of pagination | Feels modern, less clicking | Breaks "I was on page 3" mental model; makes bulk selection harder; browser memory issues at 500+ rows | Keep pagination with jump-to-page input |
| Side-by-side map + table in one view | Everything visible at once | Reduces both map and table to unusable sizes below 1400px; forces layout compromises | Keep current two-panel split (table left, map right) which works well |
| Drag-to-draw map area selection | Spatially define scan area by drawing | Requires significant map interaction library work; municipality is the correct granularity for Dutch kadaster data | Keep gemeente/wijk dropdown selection (matches cadastral data model) |
| Per-user custom color themes | User personalization | Conflicts with semantic CSS variable system; creates unpredictable color combinations on data badges | Offer light/dark toggle (already done); keep amber as brand signal color |

---

## Feature Dependencies

```
[Score Factor Breakdown Chart]
    └──requires──> [Factor data in ParcelDetailModal] (ALREADY EXISTS)
    └──requires──> [Chart library (Recharts)] (needs install if not present)

[Property Comparison View]
    └──requires──> [Checkbox selection] (ALREADY EXISTS)
    └──requires──> [Comparison state management] (new: max 4 parcels in local state)
    └──requires──> [Comparison panel UI] (new: slide-over or full-page)

[Column Visibility Toggle]
    └──requires──> [TanStack column visibility API] (available, needs wiring)
    └──enhances──> [Column Pinning] (visibility + pinning work together)

[Save Filter State]
    └──requires──> [localStorage pattern] (already used for theme)
    └──enhances──> [All filter controls] (persists existing filter state)

[Mini-Map in Report]
    └──requires──> [Map component extraction] (refactor from full map page)
    └──requires──> [Parcel centroid coordinates] (already in ScanResultItem)

[Map Layer Toggle Panel]
    └──requires──> [Layer reference access] (map component must expose layer refs)
    └──conflicts──> [Mini-Map in Report] (different map instance — no conflict)

[Insight Cards (Dutch reasoning)]
    └──requires──> [STATUS_EXPLANATIONS pattern] (ALREADY EXISTS — extend it)
    └──enhances──> [Score Factor Breakdown] (pair factor scores with text explanations)

[Heatmap Column Formatting]
    └──requires──> [Column visibility] (must know which columns are visible)
    └──requires──> [Value range per column] (min/max from dataset — compute on data load)

[Score Trend Indicator]
    └──requires──> [Historical score storage] (NEW backend model — high dependency risk)
    └──conflicts──> [MVP scope] (defer to v6+)
```

### Dependency Notes

- **Score factor breakdown requires Recharts:** Recharts is the pragmatic choice given the existing stack (React + Tailwind). Apache ECharts has better gauge/radial support but adds ~500KB. Horizontal bar chart for factor contribution does not need a charting library at all — CSS progress bars (already used in MetricCard) are sufficient and render faster. Use CSS-native bars first, add Recharts only if waterfall/radar chart is desired.
- **Comparison view requires careful state design:** Comparison state must live above the table component (in the route/page level) to survive filter changes. Max 4 parcels is the industry standard (CoStar, Reonomy) — beyond 4, readability collapses.
- **Mini-map extraction is a medium refactor:** The map is currently rendered as a full-page component. Extracting a reusable `<ParcelMiniMap>` component that accepts `[lat, lng]` + `zoom` requires isolating the map initialization from route-level state. Plan for ~2-3 hours of refactoring work.
- **Filter persistence does NOT require backend:** localStorage is sufficient. The existing URL-sync already handles session navigation. localStorage adds cross-session persistence.

---

## MVP Definition

This milestone is a **presentation overhaul**, not a feature addition milestone. The goal is to transform functional into premium. Prioritize visual and UX polish over new data capabilities.

### Launch With (v6 Phase 1 — Table Overhaul)

- [ ] Column visibility toggle panel — immediately makes table feel enterprise-grade
- [ ] Density control (compact/regular/relaxed) — directly impacts information density at scale
- [ ] Column pinning (address + score sticky left) — fixes usability when adding more columns
- [ ] Save filter state to localStorage — removes friction on return visits
- [ ] Score factor breakdown bars in drawer — makes scoring transparent (highest user trust impact)
- [ ] Heatmap column formatting (area, bouwjaar conditional color) — premium visual signal with low implementation cost

### Add After Validation (v6 Phase 2 — Report + Map Polish)

- [ ] Mini-map in report page — when users confirm they want spatial context in reports
- [ ] Insight cards expansion (more Dutch developer reasoning) — extend STATUS_EXPLANATIONS to cover more scenarios
- [ ] Map layer toggle panel — when users report confusion about overlapping map layers
- [ ] Score legend / scale explanation — add to table header or filter panel

### Future Consideration (v7+)

- [ ] Property comparison view — high complexity, high value; validate user demand first via "compare" button usage tracking
- [ ] Print/PDF-optimized report layout — when enterprise sales require client-deliverable reports
- [ ] Score trend indicator — requires historical score model (backend investment)
- [ ] Table column reordering (drag) — power user feature; validate need before building

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Column visibility toggle | HIGH | LOW | P1 |
| Score factor breakdown bars | HIGH | LOW | P1 |
| Density control | HIGH | LOW | P1 |
| Save filter state (localStorage) | HIGH | LOW | P1 |
| Column pinning (sticky) | MEDIUM | LOW | P1 |
| Heatmap column formatting | MEDIUM | LOW | P1 |
| Score legend / scale | MEDIUM | LOW | P1 |
| Mini-map in report page | HIGH | MEDIUM | P2 |
| Insight card expansion | HIGH | MEDIUM | P2 |
| Map layer toggle panel | MEDIUM | MEDIUM | P2 |
| Property comparison view | HIGH | HIGH | P2 |
| Print/PDF report layout | MEDIUM | MEDIUM | P2 |
| Score trend indicator | HIGH | HIGH | P3 |
| Table column reordering | LOW | HIGH | P3 |
| Saved scan comparison | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone to feel premium
- P2: High value, scoped to phase 2 of this milestone
- P3: Defer to next milestone — too high cost or requires new backend

---

## Competitor Feature Analysis

| Feature | PropStream (US) | Reonomy/Altus (US/global) | CoStar (US/global) | Propdex Approach |
|---------|-----------------|---------------------------|--------------------|------------------|
| Results table | List + map toggle, basic sort | Sortable list with 100+ data points | Full-featured data grid | Extend existing TanStack table with visibility/pinning |
| Column management | Fixed columns | Limited customization | Column show/hide, saved views | Column visibility + pinning + density control |
| Score visualization | Color-coded flags | Single score number | Investment metrics | Factor breakdown bars + amber badge system |
| Filter persistence | Session-only | Account-level | Account-level saved searches | localStorage (session-agnostic, no backend cost) |
| Property comparison | Comps sidebar | Not standard in web UI | Side-by-side comp tool | Side-by-side drawer (up to 4 parcels) |
| Map layer control | Layer menu | Toggle overlays | Full layer control panel | Floating toggle panel on existing map |
| Report mini-map | No | No | Property location map | Inline map card in report page |
| Dutch language / NL data | No | No | No | Full Dutch UX + Dutch data sources |

**Key differentiation:** No NL PropTech tool (Funda Zakelijk, Brainbay, DataLand) offers the combination of score transparency + comparison + map context in a single cohesive product. The opportunity is to establish a premium UX benchmark in the NL market before any competitor builds to this standard.

---

## Sources

- [TanStack Table Column Visibility Guide](https://tanstack.dev/table/latest/docs/guide/column-visibility) — HIGH confidence, official docs
- [TanStack Table Column Pinning Guide](https://tanstack.com/table/v8/docs/guide/column-pinning) — HIGH confidence, official docs
- [TanStack Table Column Pinning Sticky Example](https://tanstack.com/table/latest/docs/framework/react/examples/column-pinning-sticky) — HIGH confidence, official docs
- [Pencil & Paper Enterprise Data Table UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables) — MEDIUM confidence, reputable UX research
- [LogRocket Best React Chart Libraries 2025](https://blog.logrocket.com/best-react-chart-libraries-2025/) — MEDIUM confidence, verified with official library sites
- [Reonomy Web Application](https://www.reonomy.com/solutions/web-application/) — MEDIUM confidence (marketing page, limited UX detail)
- [Dealpath Real Estate Dashboards](https://www.dealpath.com/blog/real-estate-dashboards/) — MEDIUM confidence, industry blog
- [PropStream Features](https://www.propstream.com/propstream-features) — MEDIUM confidence, competitor product page
- [Map UI Patterns — Attribute Filter](https://mapuipatterns.com/attribute-filter/) — MEDIUM confidence, UX pattern library
- [HouseCanary AI in Real Estate](https://www.housecanary.com/blog/ai-in-real-estate) — LOW confidence (US market, not directly comparable)
- Codebase analysis of `ResultsTable.tsx`, `ResultsFilterPanel.tsx`, `ParcelDetailModal.tsx`, `ReportDetailPage.tsx` — HIGH confidence, direct source

---
*Feature research for: Premium Data Presentation Overhaul — Propdex v6*
*Researched: 2026-02-21*
