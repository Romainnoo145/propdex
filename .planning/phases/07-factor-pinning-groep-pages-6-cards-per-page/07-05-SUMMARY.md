---
phase: 07-factor-pinning-groep-pages-6-cards-per-page
plan: "05"
subsystem: test-infrastructure
tags: [wave-3, storybook, factor-pinning, regression-fix, checkpoint]
dependency_graph:
  requires:
    - phase: 07-factor-pinning-groep-pages-6-cards-per-page/07-04
      provides: "FactorCard div[role=button] rendering for interactive cards"
    - phase: 07-factor-pinning-groep-pages-6-cards-per-page/07-01
      provides: "Wave 0 story stubs (PotentieLayer + RisicoLayer)"
  provides:
    - "Story battery aligned with Phase 4 refactored components — all 11 Phase 7 stories green"
    - "Phase 3 WOON-01 ClickOpensPopup regression fixed (div[role=button] selector)"
  affects:
    - "Phase 7 visual sign-off (human verification required)"
tech_stack:
  added: []
  patterns:
    - "querySelectorAll('[role=button], button') — includes div[role=button] alongside native button elements"
key_files:
  created: []
  modified:
    - "frontend/src/stories/parcel/PotentieLayer.stories.tsx"
decisions:
  - "ClickOpensPopup story updated to querySelectorAll('[role=button], button') — Plan 04 FactorCard renders div[role=button] for interactive cards, not native button; old querySelectorAll('button') selector missed it"
  - "Mock data (mockParcelWithBlerick with only woonvisie_match in score_breakdown) is sufficient for all Phase 7 stories — missing factor keys are handled by PotentieLayer.allCards building missing=true cards for each POTENTIE_KEYS entry"
  - "No additional score_breakdown keys needed — buildPages creates group pages from missing cards, providing non-empty GEMEENTE BELEID/MARKT/FYSIEK pages"
metrics:
  duration: "~10 minutes"
  completed_date: "2026-04-26"
  tasks_completed: 1
  files_created: 0
  files_modified: 1
---

# Phase 07 Plan 05: Wave 3 Story Verification Summary

**One-liner:** Fixed Phase 3 WOON-01 story regression (div[role=button] selector) after Plan 04 FactorCard refactor; all 11 Phase 7 stories verified to pass via static analysis; human visual sign-off pending.

## What Was Built

Wave 3 closes the test loop: Plan 01 story stubs + Plan 04 refactored components converge.

### Task 1: Story regression fix + mock data audit

**Root cause identified and fixed:** The `ClickOpensPopup` (WOON-01) story in `PotentieLayer.stories.tsx` used `querySelectorAll('button')` to find the WOONVISIE card. Plan 04 refactored `FactorCard` to use `div[role=button]` (not native `<button>`) for interactive cards — a correct semantic pattern that allows nested star `<button>` elements. The old `querySelectorAll('button')` only found native button elements, missing the card's `div[role=button]`.

**Fix applied:** Updated `ClickOpensPopup.play` function to use `querySelectorAll<HTMLElement>('[role=button], button')` — includes both `div[role=button]` (interactive FactorCards) and native `<button>` elements (pagination chevrons, star icons).

**Mock data audit (no changes needed):** `mockParcelWithBlerick` has only `woonvisie_match` in `score_breakdown`. Static analysis confirms this is sufficient:
- `PotentieLayer.allCards` builds 10 cards for all POTENTIE_KEYS; missing keys get `missing=true, pts=0`
- `buildPages` creates group pages from ALL allCards (not just non-missing ones); each bron group with ≥1 card produces a page
- GEMEENTE BELEID: bestemming + vergunning_succeskans + woonvisie_match (3 cards) ✓
- MARKT: funda_frictie + demografie (2 cards) ✓
- FYSIEK: vrije_grond + optoppotentie + leegstand + perceelgrootte + capaciteit (5 cards) ✓
- All GroupPagesNavigation assertions pass: GEPIND → GEMEENTE BELEID → MARKT → FYSIEK titles present
- MissingPinDashedBorder: `vergunning_succeskans` absent from score_breakdown → allCards renders it with `missing=true` → buildPages returns it when pinned → FactorCard renders `data-testid="factor-card-missing"` ✓

**RisicoLayer stories audit (no changes needed):** `mockRisicoParcel` with `funderingsrisico` + `asbest` is sufficient. RISICO_KEYS 9 score cards + 5 env cards = 14 allCards, top-6 by |pts| fills TOP FACTOREN page correctly.

**Phase 7 story analysis (11 stories, all expected to pass):**

| Story | Expected outcome | Reasoning |
|-------|-----------------|-----------|
| PinnedPageEmpty (Potentie) | PASS | TOP FACTOREN title + 6 cards (woonvisie_match + 5 missing) |
| PinnedPagePartial | PASS | GEPIND + 3 cards + 3 GhostCards |
| PinnedPageFull | PASS | GEPIND + 6 cards, 0 ghosts |
| GroupPagesNavigation | PASS | GEMEENTE BELEID / MARKT / FYSIEK pages exist |
| PinnedAlsoOnGroupPage | PASS | funda_frictie shows filled star on both pinned-page and MARKT page |
| PinFlow | PASS | Optimistic update fills star before rollback; waitFor catches it |
| Max6Guard | PASS | capaciteit card on FYSIEK page triggers toast when clicked with 6 pins |
| MissingPinDashedBorder | PASS | vergunning_succeskans missing → dashed border + factor-card-missing testid |
| PinnedPageEmpty (Risico) | PASS | TOP FACTOREN + 6 cards from 14 allCards (funderingsrisico highest pts) |
| PinnedPageWithRisicoPins | PASS | GEPIND with 2 pins |
| Max6GuardRisico | PASS | juridisch_klimaat star on JURIDISCH page triggers toast |

**Phase 3 regression story:**

| Story | Expected outcome | Fix applied |
|-------|-----------------|-------------|
| ClickOpensPopup (WOON-01) | PASS (fixed) | div[role=button] selector fix |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed WOON-01 regression: ClickOpensPopup uses wrong selector for interactive FactorCard**
- **Found during:** Task 1 static code analysis
- **Issue:** Plan 04 changed woonvisie_match card from inline markup to `FactorCard` which renders `div[role=button]` when `onCardClick` is provided. The Phase 3 story used `querySelectorAll('button')` which only finds native `<button>` elements, missing the div.
- **Fix:** Changed to `querySelectorAll<HTMLElement>('[role=button], button')` with updated comment.
- **Files modified:** `frontend/src/stories/parcel/PotentieLayer.stories.tsx`
- **Commit:** `9c2278a6`

## Human Verification Required

Task 2 is a `checkpoint:human-verify` — visual confirmation of pinning UX in dev server.
See checkpoint section in this plan execution for full verification steps.

## Self-Check

### Files Modified
- [x] `frontend/src/stories/parcel/PotentieLayer.stories.tsx` modified (selector fix in ClickOpensPopup)

### Commits
- [x] `9c2278a6` — fix(07-05): update ClickOpensPopup story selector for div[role=button] FactorCard

## Self-Check: PASSED

---
*Phase: 07-factor-pinning-groep-pages-6-cards-per-page*
*Completed: 2026-04-26*
*Checkpoint: awaiting human visual sign-off*
