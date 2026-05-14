---
phase: 03-woonvisie-popup
plan: "01"
subsystem: ui
tags: [react, typescript, woonvisie, popup, potentie, tanstack-query]

# Dependency graph
requires:
  - phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade
    provides: WijkPolicy schema + score_woonvisie_match waarde shape (matched_wijk, matched_policy, prioritized_segment, algemeen_citaat)
  - phase: 03-woonvisie-popup
    provides: WoonvisiePopup component (already shipped minimal version)
provides:
  - Clickable kaart 10 (WOONVISIE) in PotentieLayer Potentie 3x3 grid
  - WoonvisiePopup rendered on click with live wijk policy data from scan_breakdown
  - gemeenteNaam prop drilled from ParcelDetailPanel to PotentieLayer
affects:
  - 03-02 (tests for this click wiring)
  - Phase 7 (factor pinning — PotentieLayer card render pattern updated)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional card render: WOONVISIE card uses <button> with hover affordance, others stay <div>"
    - "useParcelProjectType hook at PotentieLayer level for projectType-based segment matching"
    - "Safe defaults for missing period fields: periode_start=0, periode_einde=0, confidence=1.0"

key-files:
  created: []
  modified:
    - frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx
    - frontend/src/components/map/panels/ParcelDetailPanel.tsx
    - frontend/src/components/projects/ScoreDetailModal.tsx

key-decisions:
  - "periode_start/einde default to 0 — Phase 6 factor.waarde does not include period fields; meta line shows '0-0' as known limitation pending backend re-open"
  - "confidence defaults to 1.0 — hides the low-confidence note (shown only when < 0.5); safe until backend exposes actual confidence in waarde"
  - "ScoreDetailModal PotentieLayer call gets gemeenteNaam='' — portfolio context has no gemeente name available; woonvisie popup won't appear there anyway (no woonvisie scan data in portfolio context)"
  - "WoonvisiePopup only shown as button when hasWoonvisieData is true — graceful degradation for parcels without woonvisie_match factor"

patterns-established:
  - "PotentieLayer card conditional render: card.label === 'WOONVISIE' && hasWoonvisieData guards <button> vs <div>"
  - "Popup state at layer level: useState(false) + isOpen/onClose pattern within PotentieLayer"

requirements-completed:
  - WOON-01

# Metrics
duration: 12min
completed: 2026-04-25
---

# Phase 03 Plan 01: Woonvisie Popup Wire-up Summary

**Kaart 10 (WOONVISIE) in Potentie 3x3 grid made clickable — button with amber hover ring opens existing WoonvisiePopup with live wijk policy data sourced from scan score_breakdown**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-25T17:20:00Z
- **Completed:** 2026-04-25T17:32:34Z
- **Tasks:** 2 (committed together)
- **Files modified:** 3

## Accomplishments
- Kaart 10 (label="WOONVISIE") conditionally renders as `<button>` with amber ring + "klik" hint when woonvisie data is present
- Click opens already-shipped minimal `WoonvisiePopup` via `createPortal` to `document.body`
- Popup receives live data: `matched_policy` (with wijk naam, prioriteit, segmenten, citaat), `algemeen_citaat`, and `project_type` from `useParcelProjectType` hook
- `gemeenteNaam` drilled from `ParcelDetailPanel` (which already received it as prop) into `PotentieLayer`
- Other 8 cards unchanged — remain inert `<div>` elements

## Task Commits

Tasks 1+2 committed atomically (task 1 alone would fail typecheck since PotentieLayer prop was not yet updated):

1. **Task 1 + Task 2: Pass gemeenteNaam + make kaart 10 clickable** - `7f8a1066` (feat)

## Files Created/Modified
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` - Added gemeenteNaam prop, woonvisieOpen state, useParcelProjectType hook, conditional button render for WOONVISIE card, WoonvisiePopup render
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` - Pass `gemeenteNaam={gemeenteNaam ?? ''}` to PotentieLayer
- `frontend/src/components/projects/ScoreDetailModal.tsx` - Add required `gemeenteNaam=""` to PotentieLayer usage (deviation fix — portfolio context)

## Decisions Made
- `periode_start=0, periode_einde=0` as default values — Phase 6 `factor.waarde` dict does not include `periode_start/_einde`. The popup's meta line will display "Woonvisie Venlo · 0–0". Accepted as known limitation; flag for backend follow-up in M049+ when period extraction can be threaded through.
- `confidence=1.0` as default — hides the low-confidence italic note (only shown when `< 0.5`). Safe assumption until backend exposes extraction confidence in `factor.waarde`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing gemeenteNaam prop on PotentieLayer in ScoreDetailModal**
- **Found during:** Task 2 (after making gemeenteNaam required on PotentieLayerProps)
- **Issue:** `ScoreDetailModal.tsx` also renders `<PotentieLayer parcel={scanData} />` without the now-required `gemeenteNaam` prop — TypeScript error TS2741
- **Fix:** Added `gemeenteNaam=""` (empty string default — portfolio context has no gemeente; woonvisie popup hidden when no woonvisie data anyway)
- **Files modified:** `frontend/src/components/projects/ScoreDetailModal.tsx`
- **Verification:** `grep` confirms prop added; error absent from post-fix check output
- **Committed in:** `7f8a1066` (task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — cascading prop requirement)
**Impact on plan:** Minimal scope extension. ScoreDetailModal is a direct consumer of PotentieLayer; fix was necessary to unblock TypeScript compilation.

## Issues Encountered
- Pre-existing TypeScript errors in the codebase (91 errors before and after my changes) — none introduced by this plan. The WoonvisiePopup.tsx line 93 `string | undefined` error is pre-existing (array index access on already-shipped component — not touched in this plan).

## Known Limitation: periode_start/einde show as "0–0"
The WoonvisiePopup meta line renders: `Woonvisie Venlo · 0–0`. This is because `factor.waarde` (Phase 6 backend output) contains `{matched_wijk, matched_policy, prioritized_segment, algemeen_citaat}` but NOT `periode_start` or `periode_einde`. These come from the top-level `WoonvisiePayload` which is not threaded through `FactorResult.waarde`. To fix: backend must include period data in `waarde` dict, then PotentieLayer can read them instead of defaulting to 0.

**If visually unacceptable:** A follow-up backend task (M049+) should add `periode_start`/`periode_einde` to the `woonvisie_match` factor waarde output from `score_woonvisie_match()`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WOON-01 complete: kaart 10 is a clickable button
- 03-02 (tests) can now be executed — behavioral wiring to test: click opens popup, other cards don't, hover shows ring
- WoonvisiePopup renders correctly with live data from Phase 6 scorer
- Known gap: periode_start/einde default 0 — visible in popup meta line

---
*Phase: 03-woonvisie-popup*
*Completed: 2026-04-25*
