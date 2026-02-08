# Project Research Summary

**Project:** Propdex v2.0 Frontend (Map-First React SPA)
**Domain:** Dutch Property Intelligence Platform (PropTech)
**Researched:** 2026-02-08
**Confidence:** HIGH

## Executive Summary

Propdex v2.0 adds a map-first React frontend to the production-ready v1.1 backend (275 tests, full multi-tenant API). Research confirms that map-first property platforms follow a specific architectural pattern: the map IS the interface, with floating search and overlay panels rather than traditional dashboards. The recommended stack prioritizes performance (MapLibre GL JS with PDOK vector tiles, Vite 7, pnpm), type safety (React 19 + TypeScript strict mode, TanStack Router), and security (HttpOnly cookies for refresh tokens, access tokens in memory only).

The critical architectural decisions must be made in Phase 1: memory leak prevention patterns (MapLibre's Worker class leaks require explicit cleanup), imperative map state management (avoid useState for map instances), and z-index layering strategy. Phase 2 establishes security architecture (JWT storage) that's painful to change later. Phase 3 determines data rendering strategy (coordinate projection handling, GeoJSON vs vector tiles, clustering thresholds). These foundational choices prevent rewrites that would otherwise be required after encountering performance walls at 1000+ features or security vulnerabilities from localStorage token storage.

Key risks are well-documented with mitigation strategies: Dutch coordinate system mismatches (RD New vs WGS84 — solve in backend conversion), MapLibre memory leaks in React SPAs (solve with proper cleanup patterns), and PDOK API integration complexity (solve by proxying through existing backend rather than direct browser calls). The backend's existing multi-source aggregation, caching, and multi-tenant architecture provide a strong foundation — the frontend should leverage these rather than duplicating logic.

## Key Findings

### Recommended Stack

**Verdict:** Modern, performance-oriented stack aligned with 2026 best practices.

The research recommends React 19 + Vite 7 + TypeScript strict mode as the foundation, with pnpm for 50% faster installs and monorepo readiness. MapLibre GL JS 4.x via react-map-gl v8's MapLibre-specific endpoint provides 60fps vector rendering with Dutch government PDOK tiles. TanStack Query v5 handles server state (caching, background updates), while TanStack Router provides type-safe routing with compile-time validation — both superior to alternatives for SPA-only architecture. Tailwind v4's zero-config Vite plugin delivers 100x faster incremental builds compared to v3.

**Core technologies:**
- **React 19 + Vite 7**: Sub-second HMR, native ESM, 100x faster builds than Webpack — 2026 standard after CRA deprecation
- **MapLibre GL JS 4.x**: Open-source WebGL renderer, 60fps vector tiles, 100% feature parity with Mapbox GL v2, no usage limits
- **TypeScript strict mode**: Non-negotiable for production (catches 70% of runtime bugs at compile time, required since React 19 removed propTypes)
- **TanStack Query v5**: Server state management with caching/invalidation, handles 80% of SPA state needs
- **TanStack Router**: Type-safe routing in SPA mode (React Router v7's type safety only works in framework mode)
- **Tailwind v4**: Zero-config, 5x faster builds than v3, automatic content detection
- **pnpm**: 50% faster installs than npm, prevents phantom dependencies, monorepo-ready

**Critical version notes:**
- MapLibre v4.1-4.7.1 have Worker class memory leaks (fixed in later versions — verify latest)
- React-map-gl v8.x required for MapLibre separation (`react-map-gl/maplibre` import)
- PDOK BAG API migration deadline: July 15, 2026 (old endpoints will break)

### Expected Features

**Map-first pattern:** Industry standard established by Google Maps, Regrid, Transect. Map fills viewport, sidebar overlays (collapsible), floating search, no dashboard landing page.

**Must have (table stakes):**
- Full-page interactive map with PDOK aerial/topographic tiles — users expect map IS the app
- Floating search bar with autocomplete (PDOK Locatieserver via backend) — Google Maps pattern
- Click property → instant info panel — core interaction, backend aggregator ready
- Parcel boundaries overlay — real estate users need exact property lines (kadaster)
- Layer toggles (satellite vs topo, boundaries on/off) — standard map controls
- Saved reports list — users expect to revisit researched properties (backend `/reports` ready)
- PDF export — professional deliverable (backend WeasyPrint ready)
- Mobile-responsive (bottom sheet pattern for panels) — 30%+ mobile traffic expected
- Auth flow (login/logout with JWT) — backend ready with refresh token rotation

**Should have (competitive differentiators):**
- Project folders — group properties by pipeline (backend `project_id` field exists)
- AI zoning summary — already implemented in backend (Claude parsing), just display with confidence indicators
- Freshness indicators — "Data from 2 days ago" per source, builds trust (backend tracks timestamps)
- Monument badge — instant visual indicator (backend RCE API ready)
- Force refresh button — power user feature (backend `force_refresh=true` param)
- Report search — find by address/project/date (backend `GET /reports?q=` ready)

**Defer to v2.1+:**
- WOZ waarde display — new API integration required (no public API found, municipalities only)
- Energielabel badge — RVO EP-Online API needs verification (key required, endpoint unclear)
- Measure tool — nice-to-have (MapLibre draw plugin)
- Neighborhood context (POIs, transit) — requires new OSM/Google Places integration

### Architecture Approach

**Pattern:** Fan-out/fan-in data aggregation with API-first + AI fallback. Backend already implements this (v1.1 complete), frontend consumes aggregated results.

The architecture prioritizes frontend simplicity by leveraging the production-ready backend. The backend handles parallel API calls (BAG, PDOK, Kadaster, RuimtelijkePlannen) with asyncio.gather, cache-aside pattern with Redis (source-specific TTLs), multi-tenant row-level security (organization_id filters), and async job queue for LLM parsing (ARQ workers). Frontend should proxy all data requests through backend endpoints rather than calling PDOK directly (solves CORS, leverages existing cache, respects rate limits).

**Major components:**
1. **MapLibre GL Map (imperative)** — state managed by MapLibre, not React (avoid useState for map instances to prevent infinite re-render loops)
2. **TanStack Query client** — server state layer, calls backend `/properties/lookup`, `/reports`, auto-caching with 5-min stale time
3. **Auth Context (memory + httpOnly)** — access token in React Context, refresh token in httpOnly cookie, no localStorage (XSS protection)
4. **Floating search with debouncing** — 300ms debounce, min 3 characters, backend proxy to PDOK Locatieserver
5. **Property detail panel** — floating (desktop) or bottom sheet (mobile), progressive disclosure (summary → expandable sections)
6. **Sidebar (collapsible)** — Rapporten list, Projecten grouping, Instellingen

**Critical architectural decisions:**
- **Memory management:** MapLibre's Worker class leaks require explicit cleanup in useEffect (map.remove() + event handler removal)
- **Coordinate projection:** Backend converts RD New (EPSG:28992) to WGS84 (EPSG:4326) before returning GeoJSON — frontend never handles RD
- **Performance threshold:** GeoJSON clustering required beyond 1,000 features, vector tiles preferred for parcel boundaries (10-50x smaller payload)
- **Security:** JWT access token in memory (React state), refresh token in httpOnly cookie (backend sets), never localStorage (XSS vulnerability)

### Critical Pitfalls

Research identified 13 pitfalls (6 critical, 4 moderate, 3 minor) with phase-specific warnings.

**Top 5 critical pitfalls to address:**

1. **MapLibre memory leaks in React SPAs** — Memory grows continuously on route changes. Worker class and AbortController objects persist after component unmount. **Mitigation:** Always call `map.remove()` in useEffect cleanup, remove event handlers explicitly before removal, establish pattern in Phase 1 (foundational).

2. **JWT in localStorage = XSS account takeover** — localStorage is JavaScript-readable, any XSS vulnerability steals tokens across all organizations. **Mitigation:** Access token in memory (React Context), refresh token in httpOnly cookie (backend sets), never localStorage. Must decide in Phase 2 (architectural).

3. **Coordinate projection mismatch (RD New vs WGS84)** — Dutch Kadaster uses EPSG:28992, MapLibre expects EPSG:4326. Displaying RD coordinates causes features to render 200km+ from actual location. **Mitigation:** Backend converts RD→WGS84 using pyproj before returning GeoJSON, frontend never handles projection. Critical for Phase 3 (data integration).

4. **Too many GeoJSON features (no clustering)** — 1,000+ polygons cause exponential performance degradation, 10,000+ freeze map for 10-30s. Amsterdam has 200,000+ parcels. **Mitigation:** Enable clustering for point features, use vector tiles for polygons, viewport-based loading. Decide in Phase 3 (architectural).

5. **React state triggers infinite map re-renders** — Storing map state (center, zoom) in useState causes loops: map movement → setState → re-render → map resets → fires event → setState. **Mitigation:** Let MapLibre manage state imperatively via refs, only sync to React when needed (debounced URL persistence). Establish in Phase 1 (foundational).

**Additional phase-specific warnings:**
- **Phase 4:** Search autocomplete must debounce (300ms) or risk PDOK rate limiting
- **Phase 5:** Touch events conflict on mobile (panel scroll vs map pan) — use cooperative gestures or event.stopPropagation
- **Phase 8:** Vite env vars baked into build (requires rebuild per environment unless using runtime config)

## Implications for Roadmap

Based on research, suggested 5-phase structure with foundation-first ordering:

### Phase 1: Map Foundation & Layout
**Rationale:** Foundational architectural decisions (memory management, state patterns, z-index layering) are hard to change later. MapLibre cleanup patterns and imperative state management must be established before building features on top.

**Delivers:**
- Full-page MapLibre map with PDOK aerial/topographic tiles
- Layer toggle (satellite vs topo)
- Proper memory cleanup patterns (map.remove() + event handler removal)
- Z-index scale for floating elements
- Imperative map state management (refs, not useState)

**Addresses:**
- STACK.md: React 19 + Vite 7 + MapLibre setup
- FEATURES.md: Full-page map, layer toggles (table stakes)
- PITFALLS.md: Critical #1 (memory leaks), Critical #6 (React state), Moderate #7 (z-index)

**Avoids:** Memory leak accumulation, infinite re-render loops, z-index chaos that becomes unmanageable

**Research flag:** LOW — MapLibre + React patterns well-documented, establish and enforce cleanup patterns

### Phase 2: Authentication & Security
**Rationale:** Security architecture (JWT storage strategy) requires backend coordination and is painful to change after features are built on top. HttpOnly cookies for refresh tokens must be decided before implementing protected routes.

**Delivers:**
- Login/logout flow
- Auth context (access token in memory, refresh token in httpOnly cookie)
- Silent token refresh on page reload
- Protected route wrapper
- CORS configuration verification (development proxy vs production)

**Addresses:**
- STACK.md: JWT storage pattern (memory + httpOnly)
- FEATURES.md: Login/logout (table stakes)
- PITFALLS.md: Critical #2 (JWT security), Minor #12 (CORS mismatch)

**Uses:** Backend `/auth/login`, `/auth/refresh` (already implemented in v1.1)

**Avoids:** XSS account takeover via localStorage, CORS failures in production

**Research flag:** LOW — JWT patterns well-established, verify backend CORS_ORIGINS includes frontend domain

### Phase 3: Property Data & Map Interactions
**Rationale:** Data rendering strategy (GeoJSON vs vector tiles, clustering) is architectural. Coordinate projection handling must be in backend to prevent 200km+ rendering errors. Performance decisions made here determine scalability to 10,000+ features.

**Delivers:**
- Floating search bar (manual address entry initially)
- Address autocomplete with debouncing (PDOK Locatieserver via backend)
- Click map → fetch property data → open detail panel
- GeoJSON rendering with clustering (points) or vector tiles (polygons)
- Backend RD→WGS84 coordinate conversion verification
- Loading states, error handling (toasts)

**Addresses:**
- FEATURES.md: Search, autocomplete, click-to-info (table stakes)
- ARCHITECTURE.md: Fan-out/fan-in aggregation via backend
- PITFALLS.md: Critical #3 (projection), Critical #4 (clustering), Critical #5 (PDOK CORS), Moderate #9 (debouncing)

**Uses:** Backend `/properties/lookup` (already aggregates BAG/PDOK/Kadaster/RCE data)

**Implements:** PropertyIntelligenceOrchestrator results display, cache-aware fetching

**Avoids:** Coordinate rendering errors, performance walls at 1000+ features, PDOK rate limiting

**Research flag:** MEDIUM — Vector tile endpoints need verification (PDOK cadastral OGC API), clustering thresholds need real-world testing

### Phase 4: Property Details & Reports
**Rationale:** With data flowing from backend, now build the property detail UI with progressive disclosure. Saved reports leverage existing backend CRUD endpoints.

**Delivers:**
- Property detail panel (floating desktop, bottom sheet mobile)
- Progressive disclosure (summary → expandable sections for kadaster/zoning/monument)
- Data source indicators (API vs AI-parsed, confidence scores)
- Freshness indicators (per-source timestamps)
- PDF export button (backend WeasyPrint)
- Save report button
- Sidebar with saved reports list
- Report search (backend `/reports?q=`)

**Addresses:**
- FEATURES.md: PDF export, saved reports, freshness indicators (table stakes + differentiators)
- PITFALLS.md: Moderate #8 (resize handling), Moderate #10 (touch conflicts)

**Uses:** Backend `/reports` CRUD, `/reports/{id}/pdf` export

**Avoids:** Map resize bugs when panels open/close, mobile touch conflicts between scrolling and panning

**Research flag:** LOW — Backend reports API complete (275 tests), UI patterns standard

### Phase 5: Projects & Polish
**Rationale:** Project folders add workflow value for real estate developers tracking pipelines. Polish features (force refresh, monument badges) leverage existing backend capabilities without new integrations.

**Delivers:**
- Project folders (group reports by project_id)
- Project CRUD (create, rename, delete)
- Filter reports by project in sidebar
- Force refresh button (invalidate cache)
- Monument badge on property cards
- AI zoning summary display with confidence
- Mobile responsive refinements
- Performance monitoring

**Addresses:**
- FEATURES.md: Project folders, force refresh, monument badge (differentiators)
- ARCHITECTURE.md: Multi-tenant project grouping

**Uses:** Backend `project_id` field on reports, `force_refresh=true` param, RCE monument data

**Avoids:** Feature bloat (defer WOZ/energielabel to v2.1)

**Research flag:** LOW — Backend data model supports projects, UI patterns straightforward

### Phase Ordering Rationale

- **Foundation-first:** Phase 1 establishes patterns that prevent technical debt (memory management, state architecture)
- **Security-second:** Phase 2 JWT architecture must be decided before building features that depend on auth
- **Data-third:** Phase 3 data rendering strategy determines scalability (can't add clustering/vector tiles retroactively without refactor)
- **Features-fourth:** Phase 4 builds core workflow once data flow is proven
- **Value-fifth:** Phase 5 adds differentiators that leverage existing backend without new integrations

**Dependency chain:**
```
Phase 1 (Map) → Phase 2 (Auth) → Phase 3 (Data) → Phase 4 (Details) → Phase 5 (Projects)
         ↓              ↓               ↓                ↓                    ↓
    Memory &      JWT storage    GeoJSON/tiles    Reports CRUD        Project folders
   state patterns   architecture   performance      display             organization
```

**Pitfall prevention mapping:**
- Phase 1 prevents: Memory leaks, re-render loops, z-index chaos
- Phase 2 prevents: XSS token theft, CORS failures
- Phase 3 prevents: Coordinate errors, performance walls, rate limiting
- Phase 4 prevents: Resize bugs, touch conflicts
- Phase 5 prevents: (polish phase, no architectural pitfalls)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 3:** PDOK cadastral vector tiles endpoint verification (OGC API Tiles format unclear), clustering threshold testing with real Dutch parcel data
- **Phase 4:** Bottom sheet library evaluation (react-spring-bottom-sheet vs custom), mobile gesture testing on real devices

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** MapLibre + React patterns well-documented (official docs + GitHub issues)
- **Phase 2:** JWT security patterns established (WorkOS/Descope authoritative)
- **Phase 5:** Backend data model complete, UI patterns straightforward

**Future integrations requiring research (v2.1+):**
- WOZ waarde API: No public API found (municipalities only), needs Kadaster data licensing investigation
- Energielabel API: RVO EP-Online requires API key, endpoint structure unclear

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | React 19 + Vite 7 + MapLibre 4.x all stable with official docs, 2026 best practices verified |
| Features | HIGH | Map-first patterns confirmed across Google Maps/Regrid/Transect, table stakes well-defined |
| Architecture | HIGH | Backend v1.1 complete (275 tests), fan-out/fan-in proven pattern, multi-tenant security established |
| Pitfalls | HIGH | MapLibre memory leaks + JWT security + coordinate projection all well-documented with mitigation strategies |

**Overall confidence:** HIGH

Research is comprehensive with authoritative sources. The backend foundation (v1.1 complete) significantly de-risks the project — frontend is "just" a consumption layer with map visualization. The recommended stack is proven (React 19 stable, MapLibre 4.x stable, PDOK APIs operational), and critical pitfalls have documented mitigations.

### Gaps to Address

**MEDIUM confidence areas requiring phase-specific validation:**

1. **PDOK vector tile endpoints:** OGC API Tiles spec is flexible, exact collection IDs and tile URL templates need verification in Phase 3. Mitigation: Test `/collections` endpoint, inspect `links` for MVT URLs.

2. **Clustering thresholds:** Research indicates 1,000 features as slowdown point, but needs real-world testing with Dutch parcel density (Amsterdam: 200,000+ parcels). Mitigation: Performance profiling in Phase 3 with actual Kadaster data.

3. **MapLibre v4.x memory leak status:** Issues documented for v4.1-4.7.1, need to verify fixed in latest version. Mitigation: Test cleanup pattern effectiveness in Phase 1, monitor memory usage in dev.

**LOW confidence areas deferred to v2.1+:**

1. **WOZ waarde access:** No public API found, Kadaster WOZ API Bevragen is municipalities only. Needs commercial licensing investigation or wait for government API expansion.

2. **Energielabel API structure:** RVO EP-Online mentioned but integration unclear. Need to request API key during v2.1 planning, test realtime vs batch-only access.

**Validation strategy:**
- Phase 3 research task: Verify PDOK vector tile endpoints
- Phase 1 monitoring: Track memory usage during development with cleanup patterns
- v2.1 research: WOZ/energielabel API access investigation

## Sources

### Primary (HIGH confidence)
- Official documentation: Vite, React 19, MapLibre GL JS, TanStack Query v5, TanStack Router, Tailwind v4, TypeScript
- PDOK government APIs: Luchtfoto RGB, Kadastrale Kaart OGC API, Vector Tiles documentation
- MapLibre GitHub issues: Memory leak #4811, Worker cleanup #3733, GeoJSON performance #6154, #4364
- Security guides: WorkOS, Descope, JWT storage best practices (multiple authoritative sources)

### Secondary (MEDIUM confidence)
- Map-first UI patterns: Multiple sources (Eleken, BricXlabs, MapUIPatterns.com, UXPin) with consistent recommendations
- Competitor analysis: Regrid, Transect, ParcelQuest feature sets and patterns
- Dutch coordinate systems: EPSG.io, Kadaster GDAL documentation, TU Delft wiki
- Performance thresholds: MapLibre performance guide (official), MDPI research paper (50,000 feature analysis)

### Tertiary (LOW confidence — needs validation)
- PDOK rate limits: Undocumented, needs testing or PDOK support contact
- BAG API CORS after July 2026: Migration notice found, but new API CORS behavior needs browser testing
- WOZ API access: Confirmed municipalities only, but commercial licensing path unclear

### Context from Backend (v1.1)
- 275 tests passing (104 unit + 171 integration)
- Multi-tenant security with app_role + RLS policies enforced
- API clients for BAG, PDOK, DSO, RCE with caching and rate limiting
- Property aggregator with asyncio.gather parallel fetching
- AI parsing with Claude via ARQ workers
- PDF export with WeasyPrint
- JWT auth with refresh token rotation

---

**Research completed:** 2026-02-08
**Ready for roadmap:** Yes

**Next steps for orchestrator:**
1. Use phase structure as roadmap foundation
2. Expand each phase into requirements (user stories, acceptance criteria)
3. Flag Phase 3 for PDOK vector tile endpoint verification
4. Note v2.1 research needs (WOZ/energielabel APIs)
