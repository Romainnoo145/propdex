---
phase: 07-factor-pinning-groep-pages-6-cards-per-page
plan: "05"
subsystem: ui
tags: [react, typescript, storybook, factor-pinning, pagination, aura-design, testing]

# Dependency graph
requires:
  - phase: 07-factor-pinning-groep-pages-6-cards-per-page/07-04
    provides: "FactorCard + GhostCard with pin-star, PotentieLayer + RisicoLayer refactored to group-paged layout"
  - phase: 07-factor-pinning-groep-pages-6-cards-per-page/07-03
    provides: "useFactorPins hook, buildPages, CARDS_PER_PAGE, FACTOR_BRON from factor-groups.ts"
provides:
  - "All 11 Phase 7 Storybook stories green (8 Potentie + 3 Risico)"
  - "CARDS_PER_PAGE dropped 6→4 with 2x2 grid; MAX_PINS_PER_CATEGORY dropped 6→4"
  - "Pin-star + score badge aligned in right-side flex cluster (items-center, no overlap)"
  - "Phase 7 story battery closure — Wave 0 stubs + Wave 1 foundations + Wave 2 refactor converge"
  - "Visual sign-off received — Phase 7 pinning UX confirmed in dev server"
affects:
  - "Phase 8 (Integration tests + Venlo E2E smoke) — full story + visual sign-off baseline"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ClickOpensPopup story selector: querySelectorAll('[role=button], button') after FactorCard uses div[role=button]"
    - "CARDS_PER_PAGE=4 with grid-cols-2 grid-rows-2 — 2x2 layout gives titles room in 620px panel"
    - "Pin-star + score badge: right-side flex cluster with items-center (not absolute-positioned independently)"

key-files:
  created: []
  modified:
    - "frontend/src/stories/parcel/PotentieLayer.stories.tsx"
    - "frontend/src/stories/parcel/RisicoLayer.stories.tsx"
    - "frontend/src/components/map/panels/parcel/FactorCard.tsx"
    - "frontend/src/lib/factor-groups.ts"

key-decisions:
  - "CARDS_PER_PAGE dropped 6→4 with 2x2 grid; MAX_PINS_PER_CATEGORY dropped 6→4: steady-state factor projection (M050-M057) shows 5 categories overflow at 4/page anyway; 4/page accepts overflow as normal pattern, gives titles room to breathe in 620px panel; 4 pinned still fits office-hours triage job"
  - "Score badge stays top-right next to pin star in flex cluster (items-center alignment). Earlier overlap due to absolute-positioned star + items-start; fix: collapse star+badge into right-side flex cluster"
  - "No 'bekijk meer →' hover CTA: only woonvisie_match is currently clickable; deferred to M049+ when all cards have factor-detail destinations"

requirements-completed: [TEST-07, UI-01, PIN-01, GROUP-02]

# Metrics
duration: ~35m (story fix + visual review cycle + post-approval tweaks)
completed: 2026-04-26
---

# Phase 07 Plan 05: Story Battery + Visual Sign-off Summary

**All 11 Phase 7 Storybook stories green; CARDS_PER_PAGE 6→4 (2x2 grid) + max-pins 6→4 post visual sign-off; pin-star/score badge overlap resolved; Phase 7 complete**

## Performance

- **Duration:** ~35 min (story fix + visual review cycle + post-approval tweaks)
- **Started:** 2026-04-26
- **Completed:** 2026-04-26
- **Tasks:** 2 (Task 1: full Storybook battery; Task 2: visual sign-off checkpoint — approved)
- **Files modified:** 4

## Accomplishments

- Fixed `ClickOpensPopup` story selector regression caused by Plan 04 FactorCard refactor (div[role=button] instead of native button) — uses `querySelectorAll('[role=button], button')` to find interactive cards
- All 11 Phase 7 Storybook stories green: 8 PotentieLayer + 3 RisicoLayer — Wave 0 stubs from Plan 01 converge against real Plan 04 components
- Post visual sign-off: CARDS_PER_PAGE dropped 6→4 with 2x2 grid layout across all affected files (PotentieLayer, RisicoLayer, factor-groups.ts, useFactorPins, backend router, stories)
- Post visual sign-off: pin-star + score badge overlap resolved — collapsed into right-side flex cluster with items-center alignment; pts badge aligns with card title row
- Visual sign-off received: user confirmed complete pinning UX in dev server (hover-star, optimistic pin/unpin, max guard, persistence, Risico tab, WoonvisiePopup coexistence)

## Task Commits

Each task was committed atomically:

1. **Task 1: Run full Storybook suite + fix story flakes** - `9c2278a6` (fix)
2. **Task 2: Visual sign-off checkpoint — approved, post-approval tweaks applied**
   - `2d21fb43` — fix(07-05): align pts badge with title + remove star/score overlap
   - `c99d2b9a` — fix(07-05): drop CARDS_PER_PAGE 6→4 + max-pins 6→4 + 2x2 grid

**Plan metadata (pre-checkpoint):** `db0aa4f9` (docs: complete Wave 3 story verification plan)

## Files Created/Modified

- `frontend/src/stories/parcel/PotentieLayer.stories.tsx` — fixed ClickOpensPopup selector for div[role=button] FactorCard
- `frontend/src/stories/parcel/RisicoLayer.stories.tsx` — story battery aligned with refactored RisicoLayer
- `frontend/src/components/map/panels/parcel/FactorCard.tsx` — pin-star + score badge collapsed into items-center right-side flex cluster
- `frontend/src/lib/factor-groups.ts` — CARDS_PER_PAGE 6→4, MAX_PINS_PER_CATEGORY 6→4

## Decisions Made

- **CARDS_PER_PAGE 6→4 (2x2 grid):** Steady-state factor projection for M050-M057 cascade batches shows 5 categories will overflow 4/page anyway — overflow becomes the normal pattern, not an edge case. 4/page gives factor titles room to breathe in the 620px panel. 4 pinned factors still covers the office-hours triage job (top factors at a glance).
- **Score badge alignment:** Earlier implementation used absolute positioning for the pin star independently of the score badge (items-start baseline), causing visual overlap. Fix collapses both into a single right-side flex cluster with items-center — semantically cleaner and visually correct.
- **No "bekijk meer →" hover CTA:** At present only `woonvisie_match` has a factor-detail popup destination. Adding a hover CTA to cards without destinations creates broken affordances. Deferred to M049+ when cascade batches (M050-M057) land and all cards can route somewhere meaningful.
- **Score-position-bottom exploration explicitly declined:** Score badge stays top-right. Earlier overlap was a layout bug, not a design signal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ClickOpensPopup story selector regression**
- **Found during:** Task 1 (full Storybook suite run)
- **Issue:** Plan 04 refactored FactorCard from native `<button>` to `div[role=button]` for card-body (keeps nested Star button semantically clean). The pre-existing ClickOpensPopup story used a selector that only matched native `<button>` elements — story failed because it could no longer find the woonvisie_match card-body.
- **Fix:** Updated selector to `querySelectorAll('[role=button], button')` to capture both div[role=button] card bodies and native button elements.
- **Files modified:** `frontend/src/stories/parcel/PotentieLayer.stories.tsx`
- **Verification:** Story passes in full Storybook suite run.
- **Committed in:** `9c2278a6` (fix task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix — Plan 04 changed the interactive element type without updating the story contract. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in unrelated files (verkenner.tsx, DataCatalog.tsx, WijkMapPanel, etc.) — predated this plan, excluded from scope per deviation rules.
- Score-position-bottom + hover-CTA explorations attempted during visual review, both explicitly declined by user.

## User Setup Required

None - purely frontend changes.

## Visual Sign-off

User approved visual sign-off checkpoint (Task 2) for the complete Phase 7 pinning UX:
- Potentie tab: page 0 TOP FACTOREN → group pages (GEMEENTE BELEID, MARKT, FYSIEK, KLIMAAT)
- Pin/unpin via hover-star with optimistic updates
- Max guard fires toast (updated to 4 pins limit post-approval)
- Persistence across hard refresh (backend-backed)
- Risico tab independent pin budget
- WoonvisiePopup still opens on card-body click (not star click)

Post-approval tweaks: badge alignment fix + CARDS_PER_PAGE 6→4.

## Next Phase Readiness

- Phase 7 complete: full story battery green + visual sign-off + post-approval UX tweaks shipped
- Phase 8 (Integration tests + Venlo E2E smoke) can start: pinning backend + frontend confirmed working; story test baseline established
- Deferred: drag-reorder UX for pinned cards (M049+), "bekijk meer →" hover CTA (M049+ when all cards have destinations)

## Self-Check: PASSED

- `9c2278a6` exists in git log
- `2d21fb43` exists in git log
- `c99d2b9a` exists in git log
- `frontend/src/stories/parcel/PotentieLayer.stories.tsx` modified
- `frontend/src/stories/parcel/RisicoLayer.stories.tsx` modified
- `frontend/src/components/map/panels/parcel/FactorCard.tsx` modified
- `frontend/src/lib/factor-groups.ts` modified

---
*Phase: 07-factor-pinning-groep-pages-6-cards-per-page*
*Completed: 2026-04-26*
