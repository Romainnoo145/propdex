# Propdex — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core Value:** Address -> Property Intelligence Report
**Current Focus:** v2.0 Frontend

---

## Current Position

**Milestone:** v2.0 Frontend
**Phase:** 16 — Property Details Reports
**Plan:** 6 of 7
**Status:** In progress

**Last activity:** 2026-02-09 — Completed 16-06-PLAN.md (Freshness Indicators & Source Badges)

**Progress:** ████████████████████ 52/54 plans (96%)

---

## Performance Metrics

**v1.1 Shipped:** 2026-02-08
- 7 phases, 19 plans, 15 requirements
- 275 tests, 15,947 LOC Python

**v1.0 Shipped:** 2026-02-07
- 5 phases, 17 plans, 14 requirements
- 8,281 LOC Python

---

## Accumulated Context

### Key Decisions

See `.planning/PROJECT.md` Key Decisions table.

**Recent decisions (Phase 15-01):**
- snake_case TypeScript types: Match backend JSON exactly without camelCase transformation
- GeoJSONGeometry type alias: Avoid ESLint namespace warning, no external dependency
- 300ms debounce with 3+ char minimum: Balance responsive UX with 60/minute rate limit
- Cache by nummeraanduiding_id: Instant loading on navigation, reduced API calls

**Phase 15-02 decisions:**
- PDOK kadastrale kaart vector tiles (MVT format) for parcel boundaries: Performance in dense urban areas
- Minzoom 14 for parcel layer: Prevent cluttering at city scale, only show at street level
- Blue tint (bg-blue-500/30) for overlay toggle vs white for base layer: Visual distinction between base layers and overlays
- Lazy-load pattern for parcel source: Add only when first toggled, reduces initial map load
- Dual layer approach: Line layer (visible) + fill layer (interaction target) for future click handling

**Phase 15-03 decisions:**
- No aria-* attributes or role="combobox": Keep implementation simple with basic semantic HTML
- Focus always stays on input: Dropdown items not focusable, highlighted state is visual only
- "Geen resultaten" only when not loading: Prevents flash during debounce/loading period

**Phase 15-04 decisions:**
- No external accordion/disclosure library: Simple controlled state, avoid Headless UI dependency
- max-height transition for sections: CSS-only animation, smooth and performant
- Desktop right sidebar, mobile bottom sheet: Maximizes map visibility on mobile
- Touch event stopPropagation on panel: Prevents map panning when scrolling panel content

**Phase 16-01 decisions:**
- cmdk + sonner + react-focus-lock: Three new dependencies for command palette, toasts, and focus management
- Simplified animation pattern: Avoid setState in useEffect to satisfy ESLint rule, use CSS transitions directly
- Glassmorphism styling: bg-black/40 backdrop-blur-xl border-white/15 matching existing design system
- Drawer/Modal patterns: Reusable primitives with FocusLock, useEscapeKey, backdrop click-to-close, 3 size options

**Phase 16-02 decisions:**
- Side-rail width 64px (w-16): Icon-only navigation, standard touch target size (48px + padding)
- Z-index 250 (between sidebar 200 and property-panel 300): Side-rail should be above map controls but below property panels
- Hide side-rail on mobile (md:flex): Thin icon-only rail isn't mobile-friendly, saves screen space
- Glassmorphism design (bg-black/30 backdrop-blur-xl): Consistent with Phase 15 map controls, allows map to show through
- Default route redirects to /map (not /dashboard): Map is the primary interface, dashboard has no content yet

**Phase 16-03 decisions:**
- Tier state machine over boolean flags: Single enum (ViewTier = 'none' | 'quick' | 'drawer') prevents invalid states
- QuickCard bottom-center positioning: Desktop centered at 6rem from bottom, mobile full width
- Drawer close returns to QuickCard: Keeps geometry visible, user can review summary
- Duplicated section content functions: PropertyDetailPanel is legacy reference, new components independent

**Phase 16-04 decisions:**
- 5-minute stale time for report lists: Reports don't change frequently
- 10-minute stale time for city list: Very stable data
- Lazy initialization for localStorage: Avoids setState in useEffect ESLint warning
- Raw fetch for non-JSON responses: deleteReport (204 No Content), exportReportPDF (Blob)
- useSaveReport invalidates all report lists: Filters may vary across cached queries
- useRefreshReport invalidates both specific report and all lists: Completeness score may change

**Phase 16-06 decisions:**
- Trust but Verify freshness: Fresh data shows nothing, only stale data gets amber warning
- Freshness thresholds: Kadaster 7 days, Bestemming 30 days, Monument 180 days (based on update frequency)
- Hover-reveal tooltip: Amber icon with "Update nu" button on hover
- Per-section refresh: Independent refresh per section via onRefreshSection callback reduces API load

**Phase 15-05 decisions:**
- Direct PDOK Locatieserver calls from frontend: No backend proxy needed, PDOK is public, faster autocomplete
- Two-step PDOK flow (suggest → lookup): Extract postcode/huisnummer from suggestion ID
- Replace vector tiles with WMS raster: Vector tile endpoint broken, WMS is stable and documented
- Demo data with verified Venlo addresses: Real BAG/Kadaster/RCE data enables frontend dev without backend
- Parcel click/highlight deferred: Not possible with WMS raster tiles, requires vector features (Phase 17)

**Phase 14 decisions:**
- httpOnly cookies for refresh tokens: Prevents XSS attacks
- secure=False in development: Allows HTTP on localhost
- path=/api/auth for cookies: Limits scope to auth endpoints
- TanStack Router file-based routing: Type-safe with auto-generated route tree
- RouterContext pattern: Inject auth state into router for beforeLoad guards
- _authenticated layout route: DRY protected route pattern
- cookieDomainRewrite in Vite proxy: Enables httpOnly cookies in dev
- /api/auth proxy rewrite: Frontend calls /api/auth, proxy rewrites to /auth for backend
- In-memory access token: React state only, never localStorage
- Demo login button: Development-only bypass for testing UI

**Phase 13 decisions:**
- React 19, Tailwind v4, ESLint 9, TypeScript strict
- Z-index CSS scale, CSS variables for brand colors
- useRef for MapLibre, map.remove() cleanup
- ESRI World Imagery satellite, CartoDB Positron kaart
- Glassmorphism UI controls

### Active TODOs

- [ ] Frontend integration (this milestone)
- [ ] Fix backend register endpoint 500 error (discovered during Phase 14 verification)
- [ ] Production deployment: Create app_role
- [ ] Test Claude API with real bestemmingsplan PDFs
- [ ] BAG API key aanvragen (gratis)
- [ ] DSO API key aanvragen (gratis)

### Blockers

(None)

### Known Issues

- Backend register endpoint returns 500 (needs investigation)
- Backend auth router uses /auth prefix (not /api/auth like other routers) — Vite proxy rewrite compensates
- SET LOCAL asyncpg parameter binding fixed (use f-string with validated UUID)
- Kadaster eigendomsdata requires paid API (deferred to post-v2.0)
- Monument restrictions are generic boilerplate (not property-specific)
- Parcel click/highlight not possible with WMS raster tiles (requires vector features or WFS, deferred to Phase 17)
- Mobile navigation: Side-rail hidden on mobile, no replacement navigation exists yet (deferred to future phase)

---

## Session Continuity

**Last Session:** 2026-02-09 — Completed 16-06-PLAN.md
**Stopped At:** Phase 16 plan 6 of 7 complete
**Resume File:** None

---

*Last updated: 2026-02-09 (Phase 16 in progress — 6/7 plans complete)*
