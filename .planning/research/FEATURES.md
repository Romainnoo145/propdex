# Feature Landscape: Map-First Property Intelligence Platform

**Domain:** PropTech / Dutch property intelligence for real estate developers
**Researched:** 2026-02-08
**Confidence:** MEDIUM (verified with multiple sources, specific Dutch context is LOW)

## Executive Summary

Map-first property platforms prioritize spatial interaction over traditional dashboard navigation. The map IS the interface — users pan, zoom, click properties, and receive contextual information via floating panels. Key patterns: (1) minimal chrome, maximum map real estate, (2) floating search integrated in map view, (3) bottom sheets/slide-up panels for property details on mobile, (4) sidebar for saved items/projects (not primary navigation), (5) layer toggles for data overlays.

This research categorizes features for Propdex v2.0 frontend, building on the production-ready v1.1 backend (275 tests, full multi-tenant API with kadaster, zoning, monuments, AI parsing, PDF export).

---

## Table Stakes

Features users expect from a map-first property intelligence platform. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Backend Ready | Notes |
|---------|--------------|------------|---------------|-------|
| **Full-page interactive map** | Industry standard (Google Maps, Regrid, ParcelQuest) — map IS the app | Medium | N/A | MapLibre with PDOK aerial/topo tiles |
| **Floating search bar** | Google Maps pattern — search integrated in map view, not sidebar | Low | YES (`/property/lookup`) | PDOK autocomplete via BAG API |
| **Address autocomplete** | Dutch platforms expect zipcode + housenumber or street suggestions | Medium | YES (backend has PDOK) | Must handle "1011 AB 1" and "Dam 1, Amsterdam" |
| **Click property → instant info** | Core interaction — click map feature, see details immediately | Medium | YES (aggregator ready) | Floating panel with PropertyReportResponse |
| **Parcel boundaries overlay** | Real estate users need to see exact property lines (kadaster) | High | NO (needs layer data) | Requires kadaster parcel WFS/vector tiles |
| **Layer toggles** | Satellite vs topographic, boundaries on/off — standard map controls | Low | N/A | MapLibre layer visibility controls |
| **Saved reports list** | Users expect to revisit properties they've researched | Low | YES (`/reports` CRUD) | Sidebar "Rapporten" tab |
| **PDF export** | Professional deliverable for sharing with partners/banks | Low | YES (WeasyPrint) | Download button in detail panel |
| **Mobile-responsive map** | 30%+ users on mobile/tablet — map must work on small screens | High | N/A | Bottom sheet pattern (Google Maps style) |
| **Login/logout** | Multi-user platform requires auth | Low | YES (JWT + refresh) | Modal or /login route |
| **Loading states** | API calls take 2-10s; users need feedback | Low | N/A | Skeleton screens, spinners |
| **Error handling** | Failed API calls, no data found, rate limits — must communicate clearly | Medium | Backend returns 4xx/5xx | Toast notifications + inline messages |

### Why These Are Table Stakes

**Full-page map:** Every modern PropTech platform (Regrid, Transect, ParcelQuest) uses map-first design. Not having this = feels outdated. Source: [Map UI Design Best Practices](https://www.eleken.co/blog-posts/map-ui-design)

**Floating search:** Google Maps established this pattern — search bar floats over map, doesn't consume sidebar space. Controls are stationary widgets at absolute positions. Source: [Google Maps Controls](https://developers.google.com/maps/documentation/javascript/controls)

**Address autocomplete:** Dutch users type "1011 AB 1" or "Dam 1" and expect instant suggestions. PDOK Locatieserver is the standard (supports BAG, kadaster). Source: [PDOK Locatieserver API](https://github.com/PDOK/locatieserver/wiki/API-Locatieserver)

**Parcel boundaries:** Real estate developers MUST see exact property lines to assess plot size, shape, neighbors. Every property platform has this. Source: [Regrid Property App](https://regrid.com/property-app)

**Mobile bottom sheets:** On small screens, full-screen panels block the map. Bottom sheets (Google Maps pattern) allow dragging up for details while keeping map visible. Source: [Bottom Sheet UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/)

**PDF export:** Real estate professionals need deliverables for banks, partners, stakeholders. This is non-negotiable. Already built in backend.

---

## Differentiators

Features that set Propdex apart from competitors. Not expected, but high-value when present.

| Feature | Value Proposition | Complexity | Backend Ready | Notes |
|---------|-------------------|------------|---------------|-------|
| **Project folders** | Group related properties (e.g., "Kerkprojecten Q1 2026") — organize pipeline | Low | YES (`project_id` in reports) | Sidebar "Projecten" tab with create/edit |
| **WOZ waarde display** | Free government data (WOZ = municipal property valuation) — instant value estimate | Medium | NO | New API integration (WOZ Waardeloket?) |
| **Energielabel badge** | Free via RVO/Kadaster — shows A-G energy rating on property card | Medium | NO | New API integration (EP-Online) |
| **AI zoning summary** | Most platforms show raw zoning codes; Propdex translates to plain Dutch | Low | YES (Claude parsing) | Already in backend, just display |
| **Freshness indicators** | "Data from 2 days ago" vs "Data from 6 months ago" — trust signal | Low | YES (per-source timestamps) | Show age per data source |
| **Monument badge** | Instant visual indicator if property is rijksmonument/gemeentelijk monument | Low | YES (RCE API) | Icon on property card |
| **Report search** | Find saved reports by address, project, date — not just browsing | Low | YES (`GET /reports?q=`) | Search box in sidebar |
| **Force refresh button** | "Refresh all data" for stale reports — power user feature | Low | YES (`force_refresh=true`) | Icon button in detail panel |
| **Parallel data loading** | Fetch kadaster + zoning + monuments simultaneously (not sequential) | N/A | YES (asyncio.gather) | Already implemented, just fast UX |
| **Background AI parsing** | Zoning analysis doesn't block — shows progress, updates when ready | N/A | YES (ARQ worker) | Polling UI for AI status |
| **Multi-source confidence** | "Kadaster: verified, Zoning: AI-parsed (85% confidence)" — transparency | Low | YES (confidence scores) | Color-coded badges |
| **Map measure tool** | Measure distances/areas directly on map — useful for plot analysis | Medium | N/A | MapLibre draw plugin |
| **Neighborhood context** | Show nearby schools, transit, POIs — helps evaluate location | High | NO | Requires OSM/Google Places API |

### Why These Differentiate

**Project folders:** Most property platforms are search-focused, not project-focused. Real estate developers work in portfolios (e.g., "Q1 church acquisitions"). Organizing by project = workflow match. Source: [Real Estate Project Management](https://www.smartsuite.com/blog/real-estate-project-management-software)

**WOZ waarde + Energielabel:** Free Dutch government data that competitors might not surface prominently. WOZ gives instant value estimate, energielabel shows renovation needs (F/G labels = expensive upgrades). These are table stakes for Dutch buyers but differentiators if shown upfront.

**AI zoning summary:** Bestemmingsplannen are dense PDFs. Most platforms dump raw text. Propdex uses Claude to extract "permitted: residential up to 4 stories, parking: 1.2 spots/unit." This is the killer feature — already built in backend. Source: Already implemented in v1.0

**Freshness indicators:** Property data goes stale. Showing "Kadaster: updated 2 days ago" vs "Zoning: updated 6 months ago" builds trust. Most platforms don't expose data age. Source: Backend already tracks per-source timestamps

**Background AI parsing:** Zoning analysis takes 10-30s (Claude API). Most tools block or fail. Propdex shows "Analyzing bestemmingsplan... 60%" and lets users explore other data. This is a UX win from technical architecture. Source: Already implemented with ARQ worker

---

## Anti-Features

Features to explicitly NOT build in v2.0. Common mistakes in PropTech, or out of scope for this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Dashboard landing page** | Map-first means NO dashboard — map IS the landing page | Full-page map loads immediately on `/` |
| **Top navigation bar** | Wastes vertical space; conflicts with map-first philosophy | Left sidebar only (collapsible on mobile) |
| **Inline map in dashboard** | "Dashboard with embedded map widget" is the wrong pattern | Map fills viewport; sidebar overlays on left |
| **Multi-step property lookup** | "Step 1: Search, Step 2: Select, Step 3: View" — too many clicks | One-step: search → click suggestion → panel opens |
| **Modal dialogs for property details** | Blocks the map; forces choice between map and data | Floating panel (desktop) or bottom sheet (mobile) |
| **Separate "saved reports" page** | Breaking out of map view = context loss | Sidebar panel with list; clicking report pans map + opens panel |
| **Auto-refresh on every map move** | Loading spinner every time user pans = annoying | Only fetch on explicit click or search |
| **Overly detailed initial view** | Showing all data fields at once = overwhelming | Progressive disclosure: summary first, expand for details |
| **Complex filters in main UI** | "Filter by zoning, monument status, WOZ range..." — clutters map-first UX | Defer to v3.0; v2.0 = search + click only |
| **3D building visualization** | Cool but distracting; not core value (due diligence data) | Future feature, not MVP |
| **Heatmaps / data layers** | "Show WOZ heatmap, zoning heatmap" — analysis paralysis | Keep it simple: parcel boundaries + property details only |
| **Social features** | Comments, sharing, collaboration — premature for single-client MVP | Defer until multi-org SaaS validated |
| **Mobile app** | Separate native app = 2x maintenance, unclear value vs web | Mobile-responsive web app is sufficient |
| **Infinite scroll reports list** | Endless scrolling = hard to find older reports | Pagination or virtual scroll with search/filter |

### Why These Are Anti-Features

**Dashboard landing page:** The single biggest mistake in map-first apps is defaulting to a dashboard with "View Map" button. Users came for the map. Source: [Map UI Patterns - Task Oriented](https://mapuipatterns.com/task-oriented/)

**Top navigation bar:** Vertical space is precious on maps. Top nav bars (Home, About, Contact) waste 60-80px. Left sidebar is sufficient. Source: [Map UI Design Best Practices](https://www.eleken.co/blog-posts/map-ui-design)

**Modal dialogs:** Modals force "close this to see the map" — breaks flow. Floating panels (desktop) or bottom sheets (mobile) keep map visible. Source: [Bottom Sheets UX](https://www.nngroup.com/articles/bottom-sheet/)

**Auto-refresh on pan/zoom:** Loading data on every map movement = "laggy interactions degrade UX quickly." Only fetch on user intent (click, search). Source: [Map UI Design Patterns](https://bricxlabs.com/blogs/map-ui-design-patterns-examples)

**Complex filters upfront:** Filter UIs (sliders, checkboxes, dropdowns) are powerful but cluttered. For v2.0, simple search + click is enough. Add filters in v3.0 once base workflow proven. Source: [Filter UI Best Practices](https://www.uxpin.com/studio/blog/filter-ui-and-ux/)

**3D buildings:** Looks impressive but distracts from core value (due diligence data). Real estate developers need zoning rules and monument status, not 3D flyovers. Defer to future "marketing features" phase.

---

## Feature Dependencies

```
Core Dependencies:
MapLibre + PDOK tiles
    ├─→ Floating search (autocomplete)
    ├─→ Click property → detail panel
    └─→ Layer toggles (boundaries, satellite/topo)

Detail Panel
    ├─→ PropertyReportResponse from backend (/property/lookup)
    ├─→ PDF export button (backend WeasyPrint)
    ├─→ Save report (POST /reports)
    └─→ Force refresh (force_refresh=true)

Sidebar Tabs
    ├─→ Rapporten (GET /reports, search)
    ├─→ Projecten (group by project_id)
    └─→ Instellingen (user profile, logout)

Auth Flow
    ├─→ Login modal/page (POST /auth/login)
    ├─→ JWT storage (localStorage or httpOnly cookie)
    └─→ Refresh token rotation (POST /auth/refresh)

New Integrations (not in v1.1 backend):
    ├─→ WOZ waarde API
    ├─→ Energielabel API (EP-Online)
    └─→ Kadaster parcel boundaries (WFS or vector tiles)
```

### Critical Path

1. **MapLibre setup** — everything depends on this
2. **Floating search + autocomplete** — primary entry point
3. **Click property → fetch data → detail panel** — core workflow
4. **Sidebar: Rapporten list** — accessing saved work
5. **Auth flow** — multi-user requirement

---

## MVP Recommendation (v2.0)

Prioritize features that prove the map-first workflow with minimal new backend work.

### Phase 1: Map Foundation
1. Full-page MapLibre map with PDOK aerial/topographic tiles
2. Layer toggle (satellite vs topo)
3. Floating search bar (no autocomplete yet — manual address entry)
4. Click map → fetch property data (mock with hardcoded addresses initially)

**Why first:** Proves the map-first UI works. No backend changes needed (can mock data).

### Phase 2: Property Intelligence
1. Address autocomplete (PDOK Locatieserver suggest API)
2. Floating detail panel with PropertyReportResponse from `/property/lookup`
3. PDF export button (download from `/reports/{id}/pdf`)
4. Save report button (POST `/reports`)

**Why second:** Core workflow = search → view → save. Backend already supports this.

### Phase 3: Saved Work
1. Sidebar with "Rapporten" tab showing saved reports list
2. Search saved reports (query backend `/reports?q=`)
3. Click saved report → pan map + open detail panel
4. Project folders (group reports by `project_id`)

**Why third:** Users need to access past work. This is table stakes but not blocking MVP.

### Phase 4: Polish
1. Loading states (skeleton screens, spinners)
2. Error handling (toasts for API failures)
3. Mobile-responsive layout (bottom sheet for detail panel)
4. Auth flow (login modal, logout)

**Why fourth:** UX polish after core workflow proven.

### Defer to v2.1+
- **WOZ waarde** — new API integration (not in v1.1 backend)
- **Energielabel** — new API integration
- **Kadaster parcel boundaries** — complex (WFS parsing or vector tile service)
- **Monument badges** — data exists in backend but needs visual design
- **Freshness indicators** — polish feature
- **Force refresh button** — power user feature
- **Measure tool** — nice-to-have

---

## Mobile-Specific Patterns

**Challenge:** Maps are hard on small screens — "fat finger syndrome" and limited screen real estate.

| Pattern | Desktop | Mobile | Source |
|---------|---------|--------|--------|
| **Detail panel** | Floating panel (300-400px wide, right side) | Bottom sheet (slides up from bottom) | [Bottom Sheet UX](https://www.nngroup.com/articles/bottom-sheet/) |
| **Search bar** | Top-left, 400px wide | Full-width at top, collapsible | [Mobile Map Patterns](https://mapuipatterns.com/mobile-map/) |
| **Sidebar** | Always visible (250px, left edge) | Hidden by default, hamburger menu | [Mobile Navigation UX](https://www.designstudiouiux.com/blog/mobile-navigation-ux/) |
| **Layer toggle** | Icon buttons (top-right) | Bottom tab bar or slide-up menu | [Map UI Patterns](https://bricxlabs.com/blogs/map-ui-design-patterns-examples) |
| **Touch targets** | 24-32px clickable areas | 44-48px minimum (iOS guideline) | [Mobile UX Best Practices](https://webdesignedindia.medium.com/10-mobile-ux-design-trends-2026-231783d97d28) |
| **Map controls** | Zoom +/- buttons optional | Must include zoom buttons (pinch unreliable) | [Mobile Map UX](https://www.interaction-design.org/literature/article/getting-lost-and-found-maps-and-the-mobile-user-experience) |

### Key Mobile Considerations

1. **Bottom sheet > Modal:** Google Maps uses bottom sheet — lets users drag up for details while keeping map visible. This is THE pattern for mobile map apps.

2. **Thumb zone:** Place frequent actions in the bottom half of screen (reachable by thumb). Top corners are hard to reach one-handed.

3. **Clustering:** If showing multiple properties, cluster nearby markers when zoomed out. Reveal individual pins when zoomed in.

4. **Performance:** Lazy load map tiles, debounce API calls, compress images. "Slow map loads degrade UX quickly."

5. **Gestures:** Two-finger pan to avoid conflicts with page scroll (or use `touch-action: none` on map container).

---

## Comparison with Competitors

| Feature | Google Maps | Regrid | Transect | Propdex v2.0 |
|---------|-------------|--------|----------|--------------|
| **Map-first UI** | YES (industry standard) | YES | YES | YES (planned) |
| **Floating search** | YES | YES | NO (sidebar) | YES (planned) |
| **Parcel boundaries** | NO | YES (core feature) | YES | YES (planned) |
| **Property details panel** | YES (bottom sheet) | YES (sidebar) | YES (modal) | YES (floating/bottom sheet) |
| **Layer toggles** | YES (satellite, traffic, etc.) | YES (parcels, buildings, zoning) | YES (environmental layers) | YES (aerial/topo, boundaries) |
| **PDF export** | NO | YES (property reports) | YES (site reports) | YES (already built) |
| **AI document parsing** | NO | NO | NO | YES (differentiator) |
| **WOZ waarde** | NO | NO (US platform) | NO (US platform) | YES (planned) |
| **Energielabel** | NO | NO | NO | YES (planned) |
| **Mobile app** | YES (native) | YES (native) | YES (web responsive) | NO (web responsive only) |

### Insights

- **Map-first is table stakes:** All three competitors use full-page maps.
- **Floating search is common:** Google Maps and Regrid use it; Transect uses sidebar (less common).
- **Parcel boundaries are expected:** Regrid and Transect both show cadastral/parcel data — this is non-negotiable for property platforms.
- **AI parsing is unique:** None of the competitors advertise AI document parsing for zoning (this is Propdex's differentiator).
- **Dutch data is niche:** WOZ and energielabel are Netherlands-specific — no direct competitor offering.

---

## Information Hierarchy for Property Detail Panel

Based on real estate platform research, here's the recommended information hierarchy for the property detail panel:

### Level 1: Above the Fold (Always Visible)
```
┌─────────────────────────────────────┐
│ [Address]                      [X]  │ ← Close button
│ Street 123, 1234 AB Amsterdam       │
│                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                     │
│ 🏛️ Rijksmonument                   │ ← Monument badge (if applicable)
│ 📊 WOZ: €450,000 (2025)            │ ← WOZ waarde
│ ⚡ Energielabel: C                  │ ← Energy rating
│                                     │
│ [Download PDF]  [Save Report]       │ ← Primary actions
│                                     │
└─────────────────────────────────────┘
```

### Level 2: Expandable Sections (Click to Reveal)
```
▼ Kadaster Data
  - Eigenaar: [Redacted per AVG]
  - Oppervlakte: 350 m²
  - Kadastraal nr: ASD01-K-1234
  - Laatste transactie: 2022-03-15

▼ Zoning Summary (AI-Parsed)
  - Permitted: Residential, max 4 stories
  - Parking: 1.2 spots per unit required
  - Max building coverage: 60%
  - Confidence: 85% (AI-parsed)

▼ Monument Restrictions
  - Status: Rijksmonument (national)
  - Restrictions: Facade changes require permit
  - Subsidies: Eligible for restoration grants

▼ Data Freshness
  - Kadaster: 2 days ago ✓
  - Zoning: 3 months ago ⚠
  - Monument: 1 week ago ✓
```

**Rationale:**
- **Most important first:** Address, monument status, value estimate — these drive go/no-go decisions.
- **Actions upfront:** Download and save are primary CTAs — don't bury them.
- **Progressive disclosure:** Full kadaster data and zoning details are important but not first-glance. Expand on demand.
- **Transparency:** Data freshness builds trust — show it, but don't clutter the initial view.

Source: [Real Estate App Information Hierarchy](https://cieden.com/how-to-design-a-powerful-real-estate-platform-complete-guide)

---

## Search UX Patterns

### Search Behavior on Maps

| Pattern | When to Use | Propdex Application | Source |
|---------|-------------|---------------------|--------|
| **Floating search (top)** | Primary search action, always accessible | YES — main entry point | [Google Maps Controls](https://developers.google.com/maps/documentation/javascript/controls) |
| **Sidebar search** | Secondary filter/refinement of map view | NO — avoid sidebar search in v2.0 | [Map UI Patterns](https://www.uxpin.com/studio/blog/map-ui/) |
| **Autocomplete dropdown** | <10 results, instant suggestions | YES — PDOK Locatieserver | [Places Search Box](https://developers.google.com/maps/documentation/javascript/examples/places-searchbox) |
| **Search result highlighting** | Text match highlighting in suggestions | YES — PDOK API supports highlighting | [PDOK API](https://github.com/PDOK/locatieserver/wiki/API-Locatieserver) |
| **Recent searches** | Frequent repeated searches | NO — defer to v2.1 | N/A |
| **"Search this area" button** | Large map movements, crowded results | NO — single-property focus, not multi-result | [Search This Area Pattern](https://mapuipatterns.com/search-this-area/) |

### Autocomplete Behavior

**Trigger:** User types in search bar
**Response time:** <200ms (PDOK suggest API is fast)
**Results shown:** 5-8 suggestions (more = choice paralysis)
**What happens on select:**
1. Map pans to selected address
2. Zoom to appropriate level (18-19 for parcels)
3. Fetch property data (`/property/lookup`)
4. Open detail panel with results

**Dutch-specific pattern:** Users may type:
- Full address: "Dam 1, Amsterdam"
- Zipcode + number: "1011 AB 1"
- Street name: "Damstraat" (returns multiple)

PDOK Locatieserver handles all three. Highlight matched text in suggestions.

---

## Saved Reports vs Saved Searches

**Key decision:** Propdex saves REPORTS (specific properties researched), not SEARCHES (query criteria).

| Feature | Saved Reports (Propdex) | Saved Searches (Common Alternative) |
|---------|--------------------------|-------------------------------------|
| **What's saved** | "Dam 1, Amsterdam — Report from 2026-02-08" | "Churches in Amsterdam, max €2M" |
| **Use case** | Revisit specific properties in pipeline | Monitor market for new opportunities |
| **Notifications** | None (static data) | Alert when new matches found |
| **Propdex fit** | YES — matches workflow (research specific opportunities) | NO — requires market monitoring (v3.0+) |

**Why reports, not searches:**
- Real estate developers work with specific opportunities ("we're looking at this church")
- The backend already supports report CRUD (save, list, search, delete)
- Saved searches require alert infrastructure (out of scope for v2.0)

**Exception:** Search within saved reports (query by address, project, date) is useful and supported by backend (`GET /reports?q=`).

Source: [Real Estate App Features](https://realogixs.com/top-features-every-real-estate-mobile-app-must-have-in-2026)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **Map-first patterns** | HIGH | Google Maps, Regrid, Transect all use map-first; well-documented patterns |
| **Floating search** | HIGH | Google Maps established this; official docs + UI kits confirm |
| **Bottom sheet (mobile)** | HIGH | Nielsen Norman Group + Material Design guidelines |
| **Layer toggles** | HIGH | Standard across all map platforms |
| **Dutch PDOK integration** | MEDIUM | PDOK docs exist, but implementation examples sparse |
| **WOZ waarde API** | LOW | No clear API found; needs deeper research |
| **Energielabel API** | LOW | EP-Online mentioned, but integration unclear |
| **Kadaster parcel boundaries** | LOW | Kadaster offers WFS, but vector tile approach uncertain |
| **Project folders UX** | MEDIUM | Real estate PM software shows patterns, but map integration unclear |

---

## Open Questions for Phase-Specific Research

### Phase 1: Map Setup
- [ ] PDOK tile URL format and attribution requirements
- [ ] MapLibre basemap styling for Netherlands context (hide irrelevant POIs)
- [ ] Default map center and zoom for Netherlands-wide view

### Phase 2: Parcel Boundaries
- [ ] Kadaster WFS endpoint for parcel boundaries
- [ ] Vector tiles vs GeoJSON — performance implications
- [ ] Parcel boundary click detection (tolerance, multi-polygon handling)

### Phase 3: New APIs
- [ ] WOZ waarde API — endpoint, auth, rate limits
- [ ] Energielabel API (EP-Online) — access method, data schema
- [ ] Both may require accounts/API keys (investigate)

### Phase 4: Mobile UX
- [ ] Bottom sheet library (react-spring-bottom-sheet vs custom)
- [ ] Gesture conflicts (map pan vs page scroll)
- [ ] iOS Safari viewport height issues (100vh problem)

---

## Sources

### Map-First UI Patterns
- [Map UI Design: Best Practices](https://www.eleken.co/blog-posts/map-ui-design)
- [5 Map UI Design Patterns That Elevate UX](https://bricxlabs.com/blogs/map-ui-design-patterns-examples)
- [Map UI Patterns](https://mapuipatterns.com/)
- [Map UI – The Most Popular Layouts and Design Tips](https://www.uxpin.com/studio/blog/map-ui/)

### Competitor Platforms
- [Transect Environmental Due Diligence](https://www.transect.com/industries/transect-environmental-due-diligence-for-real-estate-development)
- [Regrid Property App](https://regrid.com/property-app)
- [Regrid Parcel Data Updates](https://regrid.com/blog/february-2026-parcel-data-update)
- [ParcelQuest GIS Features](https://www.parcelquest.com/features/gis/)
- [OnX Backcountry Basemap Redesign](https://www.onxmaps.com/backcountry/blog/basemap-redesign)

### Google Maps Patterns
- [Google Maps Controls](https://developers.google.com/maps/documentation/javascript/controls)
- [Places Search Box](https://developers.google.com/maps/documentation/javascript/examples/places-searchbox)
- [Search This Area Pattern](https://mapuipatterns.com/search-this-area/)
- [Analyzing Google Maps UX/UI](https://medium.com/@jaybreezys/analyzing-google-maps-based-on-ux-ui-functionality-41ea06202b0a)

### Mobile UX
- [Bottom Sheets: Definition and UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/)
- [How to Design Bottom Sheets for Optimized UX](https://blog.logrocket.com/ux-design/bottom-sheets-optimized-ux/)
- [Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)
- [Mobile Map UX Patterns](https://mapuipatterns.com/mobile-map/)
- [Getting Lost and Found – Maps and Mobile UX](https://www.interaction-design.org/literature/article/getting-lost-and-found-maps-and-the-mobile-user-experience)

### Real Estate Platform Features
- [How to Design a Powerful Real Estate Platform 2026](https://cieden.com/how-to-design-a-powerful-real-estate-platform-complete-guide)
- [Top Features Every Real Estate Mobile App Must Have](https://realogixs.com/top-features-every-real-estate-mobile-app-must-have-in-2026)
- [Real Estate App Development Guide](https://ascendixtech.com/real-estate-app-development-guide/)
- [Best Real Estate Project Management Software 2026](https://www.smartsuite.com/blog/real-estate-project-management-software)

### Dutch Data Sources
- [PDOK Locatieserver API](https://github.com/PDOK/locatieserver/wiki/API-Locatieserver)
- [Dutch Address Autocomplete with Alpine.js](https://vanrossum.dev/27-dutch-address-autocomplete-with-alpinejs)
- [Kadaster About Us](https://www.kadaster.nl/about-us)
- [Public Services on the Map (PDOK)](https://www.ogc.org/blog-article/public-services-on-the-map-a-decade-of-success/)

### Anti-Patterns and UX Mistakes
- [Map UI Patterns: Task Oriented](https://mapuipatterns.com/task-oriented/)
- [User Interface Anti-Patterns](https://ui-patterns.com/blog/User-Interface-AntiPatterns)
- [Anti-Patterns of User Experience Design](https://www.ics.com/blog/anti-patterns-user-experience-design)
- [Avoiding UX Anti-Patterns](https://www.door3.com/blog/avoiding-anti-patterns-with-ux-design)

### Layer Toggles and Controls
- [Map Layer Toggle Controls Best Practices](https://www.eleken.co/blog-posts/map-ui-design)
- [11 Innovative Methods for Multi-Layered Map Design](https://www.maplibrary.org/1560/innovative-methods-for-multi-layered-map-design/)

---

**Next Steps:** Use this feature landscape to inform requirements definition and UI wireframing. Priority: prove map-first workflow with minimal new backend work (use existing v1.1 APIs). Defer WOZ, energielabel, and parcel boundaries to later phases if they require significant integration effort.
