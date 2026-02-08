# Propdex — Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-08)

**Core Value:** Address -> Property Intelligence Report
**Current Focus:** v2.0 Frontend

---

## Current Position

**Milestone:** v2.0 Frontend
**Phase:** 15 — Property Data & Map Interactions
**Plan:** 4 of 5
**Status:** In progress

**Last activity:** 2026-02-08 — Completed 15-04-PLAN.md (Property Detail Panel & Geometry Layer)

**Progress:** ██████████████████░░ 46/47 plans (98%)

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

---

## Session Continuity

**Last Session:** 2026-02-08 13:20 UTC — Completed 15-04-PLAN.md
**Stopped At:** Phase 15 plan 04 complete, ready for plan 05
**Resume File:** None

---

*Last updated: 2026-02-08 (Phase 15 Plan 04 complete)*
