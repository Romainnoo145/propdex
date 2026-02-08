---
phase: 13-map-foundation-layout
plan: 01
subsystem: ui
tags: [vite, react, typescript, tailwind, maplibre-gl, eslint, pdok]

# Dependency graph
requires:
  - phase: 01-05 (backend complete)
    provides: Backend API on port 8000
provides:
  - Vite dev server on port 9300 with /api proxy
  - React 19 + TypeScript strict mode configuration
  - Tailwind v4 with z-index CSS scale
  - PDOK tile URL constants for MapLibre
  - ESLint 9 flat config
affects: [13-02, 13-03, 13-04, 14-*, 15-*, 16-*, 17-*]

# Tech tracking
tech-stack:
  added: [react@19, react-dom@19, maplibre-gl@5, tailwindcss@4, @tailwindcss/vite@4, vite@7, typescript@5.9, eslint@9, typescript-eslint@8]
  patterns: [CSS custom properties for z-index, CSS variables for brand colors, @ alias for src imports]

key-files:
  created:
    - frontend/vite.config.ts
    - frontend/tsconfig.json
    - frontend/tsconfig.app.json
    - frontend/tsconfig.node.json
    - frontend/eslint.config.js
    - frontend/src/styles/index.css
    - frontend/src/lib/pdok.ts
    - frontend/src/App.tsx
    - frontend/src/main.tsx
    - frontend/package.json
  modified: []

key-decisions:
  - "React 19: Latest stable React with concurrent features"
  - "Tailwind v4: New Vite plugin architecture, @import syntax"
  - "ESLint 9: Flat config system with typescript-eslint"
  - "Port 9300: User preference from MEMORY.md"
  - "Z-index scale: Steps of 100 for flexibility (0, 10, 100, 200, ...)"
  - "CSS variables for brand colors: NEVER hardcode colors in components"

patterns-established:
  - "TypeScript strict mode with noUncheckedIndexedAccess enabled"
  - "pnpm run check: Combined typecheck + lint for CI/pre-commit"
  - "@ alias for absolute imports from src/"
  - "Z-index CSS custom properties (--z-map-canvas, --z-modal, etc.)"
  - "PDOK constants in src/lib/pdok.ts with documentation"

# Metrics
duration: 5min
completed: 2026-02-08
---

# Phase 13 Plan 01: Scaffold Frontend Summary

**Vite 7 + React 19 + TypeScript strict + Tailwind v4 frontend with MapLibre GL JS, ESLint 9, z-index CSS scale, and PDOK tile constants**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-08T10:24:58Z
- **Completed:** 2026-02-08T10:29:23Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Vite dev server on port 9300 with /api proxy to backend:8000
- React 19 with TypeScript strict mode (all safety flags enabled)
- Tailwind v4 with @import syntax and CSS custom properties
- Z-index scale (0-2000) and brand color CSS variables
- PDOK tile URL constants for MapLibre (aerial + topo layers)
- ESLint 9 flat config with typescript-eslint and react-hooks rules

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Vite + React + TypeScript project and install dependencies** - `8b2ace4` (feat)
2. **Task 2: Configure Vite, TypeScript, ESLint, Tailwind, z-index scale, and PDOK constants** - `2ef6d1a` (feat)

## Files Created/Modified

**Created:**
- `frontend/vite.config.ts` - Vite config with React plugin, Tailwind v4, port 9300, /api proxy, @ alias
- `frontend/tsconfig.json` - Project references root
- `frontend/tsconfig.app.json` - TypeScript strict mode with noUncheckedIndexedAccess
- `frontend/tsconfig.node.json` - TypeScript strict mode for Vite config
- `frontend/eslint.config.js` - ESLint 9 flat config with react-hooks rules
- `frontend/src/styles/index.css` - Tailwind v4 @import, z-index scale, brand colors
- `frontend/src/lib/pdok.ts` - PDOK tile URLs, attribution, default center/zoom
- `frontend/src/App.tsx` - Minimal placeholder component
- `frontend/src/main.tsx` - React root with StrictMode
- `frontend/package.json` - Dependencies and scripts (dev, build, check, lint, typecheck)
- `frontend/index.html` - HTML entry point with "Propdex" title

## Decisions Made

**React 19 choice:**
- Latest stable React with concurrent features and improved error handling
- React 19.2.0 installed from Vite template

**Tailwind v4 architecture:**
- New Vite plugin (@tailwindcss/vite) instead of PostCSS
- @import "tailwindcss" syntax instead of @tailwind directives
- Simpler setup, faster builds

**ESLint 9 flat config:**
- New flat config system (not legacy .eslintrc)
- typescript-eslint@8 with recommended rules
- react-hooks plugin for Hook usage validation

**Port 9300:**
- User preference from MEMORY.md (avoiding default 3000)
- Matches user's development workflow

**Z-index CSS custom properties:**
- Centralized z-index management (prevents stacking conflicts)
- Steps of 100 for flexibility (can insert values between layers)
- Semantic naming (--z-map-canvas, --z-modal, --z-toast)

**Brand colors as CSS variables:**
- NEVER hardcode colors in components (use var(--color-primary))
- Single source of truth for theming
- Easy to change brand colors without touching component code

**TypeScript strict mode:**
- All strict flags enabled (strict, noImplicitAny, strictNullChecks, etc.)
- noUncheckedIndexedAccess prevents array access bugs
- noImplicitReturns catches missing return statements

## Deviations from Plan

**1. [Rule 3 - Blocking] Fixed ESLint peer dependency mismatch**
- **Found during:** Task 1 (Installing dev dependencies)
- **Issue:** @eslint/js@10 was installed with eslint@9, causing peer dependency warning
- **Fix:** Downgraded @eslint/js to version 9 to match eslint@9
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** No peer dependency warnings after fix
- **Committed in:** 8b2ace4 (Task 1 commit)

**2. [Rule 3 - Blocking] Recreated frontend directory with correct template**
- **Found during:** Task 1 (After initial scaffold)
- **Issue:** First `pnpm create vite` command created vanilla TypeScript template instead of React TypeScript
- **Fix:** Removed frontend directory and ran command again with explicit --template flag
- **Files modified:** All frontend files (fresh scaffold)
- **Verification:** React 19 present in package.json, App.tsx uses JSX
- **Committed in:** 8b2ace4 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to unblock task completion. No scope creep.

## Issues Encountered

**Issue 1: Vite template selection**
- First scaffold created wrong template (vanilla TS instead of React TS)
- Root cause: pnpm create vite needs explicit --template flag after directory name
- Resolution: Removed directory, rescaffolded with correct syntax
- Time cost: ~1 minute

**Issue 2: ESLint version compatibility**
- @eslint/js@10 has peer dependency on eslint@10, but ecosystem (typescript-eslint, react-hooks) only supports eslint@9
- Resolution: Downgraded @eslint/js to version 9 for ecosystem compatibility
- Trade-off: Using ESLint 9 instead of 10, but entire ecosystem supports it

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for next phase:**
- Vite dev server starts on port 9300
- TypeScript strict mode passes (pnpm run check exits 0)
- ESLint passes with zero errors
- Tailwind v4 configured and ready for utility classes
- PDOK tile URL constants available for MapLibre setup
- Z-index CSS scale ready for component layering
- /api proxy ready to forward requests to backend:8000

**No blockers or concerns.**

All success criteria met:
- [x] Frontend project exists at frontend/ with all dependencies installed
- [x] pnpm run check passes (TypeScript strict + ESLint)
- [x] pnpm dev starts Vite server on port 9300
- [x] Z-index CSS custom properties defined (--z-map-canvas through --z-toast)
- [x] PDOK tile URL constants defined and typed (PDOK_AERIAL_TILES, PDOK_TOPO_TILES, etc.)
- [x] Backend proxy configured for /api routes (proxy to localhost:8000)

## Self-Check: PASSED

All created files verified:
- frontend/vite.config.ts
- frontend/tsconfig.json
- frontend/tsconfig.app.json
- frontend/tsconfig.node.json
- frontend/eslint.config.js
- frontend/src/styles/index.css
- frontend/src/lib/pdok.ts
- frontend/src/App.tsx
- frontend/src/main.tsx
- frontend/package.json
- frontend/index.html

All commits verified:
- 8b2ace4 (Task 1)
- 2ef6d1a (Task 2)

---
*Phase: 13-map-foundation-layout*
*Completed: 2026-02-08*
