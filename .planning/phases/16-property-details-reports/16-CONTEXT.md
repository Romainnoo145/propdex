# Phase 16: Property Details & Reports - Context

**Gathered:** 2026-02-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the report management UI layer: a proper SaaS app shell with side-rail navigation, three-tier property viewing flow (quick-card → full drawer → modal), report save/search/browse in the sidebar, PDF export, freshness indicators, and data source badges. This is a major architectural evolution from the current floating-panel approach to a structured Linear/Framer-style application layout.

**Scope:** Side-rail nav, drawer-based property details, report CRUD UI, PDF export UI, freshness display, source attribution. The backend already has all report/PDF/freshness endpoints.

**Not in scope:** Project CRUD (Phase 17), Instellingen functionality (Phase 17), Dashboard page content (Phase 17). Tab shells for Projecten and Instellingen are created but left as placeholders.

</domain>

<decisions>
## Implementation Decisions

### App Shell Architecture (Three-Tier)

**This is the biggest decision — replaces the current floating-panel approach.**

- **Side-rail navigation** (left, thin, icon-based): Dashboard, Map, Projecten, Instellingen. Always visible, fixed anchor.
- **Quick-card** (Tier 1): Small floating card when clicking a parcel on the map. Shows only essentials: adres, bouwjaar, status. Has "Bekijk volledige details" button.
- **Full drawer** (Tier 2): Slides in from the right, full-height (top to bottom). Contains all Eigendomsinformatie in tabs. Map stays visible on the left with optional blur/dark overlay.
- **Modal** (Tier 3): Large centered modal only for specific documents (PDF viewer). Overlays everything.

**Navigation behavior:**
- Map-bound views (property analysis): Stay on map, use drawer — developer needs spatial context while reading data
- Non-map views (Dashboard, Projecten): Full page redirect, map disappears

**Visual hierarchy:**
| Element | Position | Behavior |
|---------|----------|----------|
| Navigation | Left (thin) | Always present (fixed) |
| Search/Filters | Top center | Floating, minimalistic |
| Eigendoms-info | Right (full-height drawer) | Slides in/out |
| Documents | Central modal | Only for PDF viewing |

### Report Sidebar (Inside Side-Rail "Rapporten" Tab)

- **Togglable sidebar**: Hidden by default, opens when clicking side-rail icon
- **Three tabs**: Rapporten, Projecten, Instellingen (all created, Projecten and Instellingen are placeholder shells for Phase 17)
- **Rich cards** for saved reports: Address, icon, date, freshness badge, bestemming summary
- **Grouped by project**: Accordion-style collapsible sections per project
  - Project header: Name + report count (e.g., "Marktplein (3)")
  - "Losse rapporten" section for unsaved-to-project reports
  - Click report → map flyTo + drawer opens
- **Status dots** on report cards: Gray (ok), Amber (stale), Blue (new info available)

### Save/Export Flow

- **Explicit save**: User clicks "Opslaan" / bookmark icon in the drawer header — not auto-save
- **"Recent bekeken" list**: Sidebar shows last ~10 viewed properties (auto, not saved). Self-overwriting. Can be promoted to saved via explicit save.
- **Save prompts project assignment**: "Sla op in project..." button triggers project selection
- **PDF export from drawer**: Export button in the Tier 2 drawer header, opens small dropdown or Tier 3 modal to select what to include (only Kadaster, include zoning maps, full analysis)
- **Background PDF generation**: Toast notification on export click, user can continue working. "Download Ready" badge/notification when complete.
- **"Update alle bronnen"** button at bottom of Bronnen section for global refresh

### Freshness & Source Badges

- **"Trust but Verify" approach** — Management by Exception
- **Subtle timestamps per section**: Small gray text (text-xs): "Bron: Kadaster • 8 feb 2026, 22:40"
- **Amber warning only when stale**: Small exclamation icon next to section title. Hover/click reveals: "Deze data is 3 dagen oud. [Update nu]"
- **No green badges**: Fresh data is the default, no need to confirm it visually
- **Per-source freshness thresholds**:
  - Kadaster (eigendom): 7 days
  - Bestemmingsplan (zoning): 30 days
  - Monument/Erfgoed: 180 days
  - Bouwregels (BAG): 30 days
- **Per-section force refresh**: "Update nu" re-fetches only the stale section, not the whole report
  - Optimistic UI: Old data stays visible with semi-transparent overlay + spinner
  - Dependency tracker: If source A update affects source B, both refresh
- **Source name per section** (not just consolidated): "Bron: Kadaster • datum" under each section
  - Optional tooltip on hover: "Directe koppeling met BRK. Verversingsinterval: 7 dagen."

### Search & Filtering (Saved Reports)

- **Cmd+K style fuzzy search bar** in sidebar — one smart field, not a form
- **Searchable fields**: Address, project name, bestemming type, tags/labels
- **Grouped results while typing**: Results grouped by "Projecten" and "Adressen"
- **Filter icon** next to search bar: Expands quick toggles (Alleen Monumenten, Alleen Open Projecten, Bestemming dropdown)
- **Empty state**: Minimalist 3-step onboarding guide (Ontdek → Analyseer → Organiseer) with icons, semi-transparent cards (opacity-70), disappears after first save

### Claude's Discretion

- Side-rail icon choices and hover labels
- Exact drawer width (40-50% of screen suggested by user)
- Quick-card positioning relative to clicked parcel
- Blur vs dark overlay intensity on map when drawer is open
- Loading skeleton designs
- Exact spacing and typography within drawer
- Transition animations (slide-in speed, easing)
- How "Recent bekeken" items are visually distinguished from saved reports

</decisions>

<specifics>
## Specific Ideas

- "Denk aan Linear, Framer, of Airbnb" — the app shell should feel like a real SaaS product, not pop-overs stacked on a map
- The drawer should be a full-height "Drawer" component (top to bottom), not a floating box — "geeft rust en ruimte"
- "Vastgoedontwikkelaars denken in projecten, niet in losse adressen" — project grouping in sidebar is opinionated, not optional
- Empty state should be "extreem minimalistisch en functioneel" — three visual cards that explain the core loop
- Source attribution per section positions Propdex as "aggregator, not data owner" — juridisch en psychologisch slim
- "De Nederlandse markt is krap. Ontwikkelaars doen veel exploratory lookups" — explicit save prevents dashboard pollution
- PDF export should feel "Pro": background generation, don't block the UI, "Download Ready" notification

</specifics>

<deferred>
## Deferred Ideas

- **Bulk PDF export** from Projects page (select multiple properties → "Generate Project Bundle") — Phase 17 or later
- **Tags/labels on reports** (e.g., "Hot", "Afgekeurd", "Horeca") — Phase 17 or backlog
- **Dashboard page content** — Phase 17
- **Instellingen page content** — Phase 17
- **Projecten CRUD** (create, rename, delete projects) — Phase 17
- **"New info available" blue dot** (proactive monitoring for bestemmingsplan changes) — post-v2.0

</deferred>

---

*Phase: 16-property-details-reports*
*Context gathered: 2026-02-08*
