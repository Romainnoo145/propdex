---
phase: 07-factor-pinning-groep-pages-6-cards-per-page
plan: "04"
subsystem: ui
tags: [react, typescript, factor-pinning, pagination, tanstack-query, aura-design]

# Dependency graph
requires:
  - phase: 07-factor-pinning-groep-pages-6-cards-per-page/07-03
    provides: "useFactorPins, buildPages, FACTOR_BRON, CARDS_PER_PAGE from factor-groups.ts"
  - phase: 07-factor-pinning-groep-pages-6-cards-per-page/07-02
    provides: "Backend factor_pins REST API for useFactorPins hook"
provides:
  - "Shared FactorCard + GhostCard components with pin-star UI (UI-01, PIN-01)"
  - "PotentieLayer refactored: 6-cards/page, pinned synth-page, group pages, useFactorPins('potentie')"
  - "RisicoLayer refactored: 6-cards/page, pinned synth-page, group pages, useFactorPins('risico'), tone='negative'"
  - "bodemtype→'fysiek' added to FACTOR_BRON (forward-compat env card)"
affects:
  - "07-05 (Storybook stories — now have real FactorCard/GhostCard data-testid targets)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FactorCard with group-hover opacity for pin-star: opacity-0 group-hover:opacity-100 transition-opacity duration-150"
    - "buildPages() called with pins.map(p => ({id, factor_key, position})) — minimal PinLike contract"
    - "Page bounds guard: useEffect(() => { if (page >= pages.length) setPage(...) }, [pages.length, page])"
    - "deriveEnvCards returns PageCard[] with inline label→factor_key keyMap — forward-compat"

key-files:
  created:
    - "frontend/src/components/map/panels/parcel/FactorCard.tsx"
  modified:
    - "frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx"
    - "frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx"
    - "frontend/src/lib/factor-groups.ts"

key-decisions:
  - "bodemtype added to FACTOR_BRON as UI-only forward-compat entry (maps to 'fysiek') — not in backend FACTOR_REGISTRY"
  - "FactorCard uses div[role=button] not native button for card-body — keeps nested Star button semantically clean"
  - "BRON_LABEL import removed from PotentieLayer — it's consumed by buildPages internally, no direct usage in layer"
  - "envCards label→factor_key map is inline in deriveEnvCards — avoids exporting a separate constant that would need sync with enrichment labels"

# Metrics
duration: 6min
completed: 2026-04-26
---

# Phase 7 Plan 04: Layer Refactor (Wave 2) Summary

**Shared FactorCard + GhostCard with pin-star UI extracted; PotentieLayer + RisicoLayer refactored to 6-cards/page using buildPages + useFactorPins; WoonvisiePopup integration preserved; RisicoCard inline component deleted**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-26T15:05:36Z
- **Completed:** 2026-04-26T15:11:48Z
- **Tasks:** 3
- **Files modified:** 4 (1 new + 2 refactored + 1 extended)

## Accomplishments

- Created `FactorCard.tsx` with `tone='positive'|'negative'`, pin-star UI (`data-testid="pin-star-filled"` / `data-testid="pin-star-button"`), missing state (`data-testid="factor-card-missing"` + dashed border), and `GhostCard` with "Pin een factor" affordance
- Refactored `PotentieLayer.tsx`: removed local `CARDS_PER_PAGE=9`, imports `CARDS_PER_PAGE` from `@/lib/factor-groups`, calls `useFactorPins('potentie')`, builds `PageCard[]` with `factor_key + bron`, uses `buildPages()`, renders page title + `grid-cols-3 grid-rows-2` grid with `FactorCard`/`GhostCard`; WoonvisiePopup integration preserved on `woonvisie_match` card click
- Refactored `RisicoLayer.tsx`: same pattern as Potentie, `tone="negative"`, `useFactorPins('risico')`, `deriveEnvCards` returns `PageCard[]` with `factor_key + bron` mapping; inline `RisicoCard` component deleted
- Added `bodemtype: 'fysiek'` to `FACTOR_BRON` in `factor-groups.ts` as a UI-only forward-compat entry for the BODEMTYPE environmental card

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared FactorCard.tsx component** - `62f5baf5` (feat)
2. **Task 2: Refactor PotentieLayer.tsx** - `e51d1ac4` (feat)
3. **Task 3: Refactor RisicoLayer.tsx** - `d6ed8117` (feat)

## Files Created/Modified

- `frontend/src/components/map/panels/parcel/FactorCard.tsx` — NEW: shared card component with pin-star, tone variants, missing state, GhostCard
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` — refactored from 9-card flat to 6-card group-paged with pinned synth-page
- `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx` — refactored from 9-card flat, removed RisicoCard, added env card bron mapping
- `frontend/src/lib/factor-groups.ts` — extended with `bodemtype: 'fysiek'`

## Decisions Made

- `bodemtype` added to FACTOR_BRON as UI-only entry (maps to `'fysiek'`): the BODEMTYPE env card comes from funderingsrisico enrichment, not backend FACTOR_REGISTRY; forward-compat addition per plan instructions
- BRON_LABEL not directly imported in layer files — consumed internally by `buildPages()`, no direct usage needed
- `deriveEnvCards` label→factor_key mapping is inline `keyMap` constant inside the function — avoids a separate exported constant that must be kept in sync with the env enrichment labels

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in unrelated files (verkenner.tsx, DataCatalog.tsx, stories layout files, WijkMapPanel, etc.) — predated this plan, excluded from scope per deviation rules
- `BRON_LABEL` was initially imported in PotentieLayer but removed before commit since it is not directly referenced (only used by `buildPages` internally) — clean import

## User Setup Required

None - purely frontend refactor.

## Next Phase Readiness

- Plan 05 (Storybook stories) can now pass: `data-testid="pin-star-filled"`, `data-testid="pin-star-button"`, `data-testid="factor-card-missing"`, `data-testid="factor-card"` are all wired up on real components
- PotentieLayer.stories.tsx Phase 7 stories (`PinnedPageEmpty`, `PinnedPagePartial`, `PinnedPageFull`, etc.) now have real targets to assert against
- RisicoLayer.stories.tsx (`PinnedPageEmpty`, `PinnedPageWithRisicoPins`, `Max6GuardRisico`) also ready

---
*Phase: 07-factor-pinning-groep-pages-6-cards-per-page*
*Completed: 2026-04-26*
