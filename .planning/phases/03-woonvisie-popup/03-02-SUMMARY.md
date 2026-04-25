---
phase: 03-woonvisie-popup
plan: "02"
subsystem: testing
tags: [storybook, vitest, react, typescript, play-functions, portal, tanstack-query]

# Dependency graph
requires:
  - phase: 03-woonvisie-popup
    provides: WoonvisiePopup.tsx shipped minimal component (Plan 01) + PotentieLayer wire-up (Plan 01)
provides:
  - Storybook play-functions for WOON-01, WOON-02, WOON-03, TEST-04
  - 6 play-functions on WoonvisiePopup stories covering prioriteit labels, citaat, segmentmatch, dismiss flows
  - 1 play-function on PotentieLayer stories covering click-opens-popup (WOON-01)
  - Precedent: QueryClientProvider + AuthContext mock pattern for hooks requiring auth in stories
affects:
  - Phase 08 (integration tests — established portal-testing and auth-mock patterns)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portal content queried via within(document.body) — createPortal escapes canvasElement scope"
    - "AnimatePresence transitions require waitFor(timeout) before DOM queries in play-functions"
    - "QueryClient pre-seeded via setQueryData(['parcel-project-type', id], ...) to suppress network calls"
    - "AuthContext.Provider with mock token to enable useParcelProjectType query-enabled gate"
    - "import from 'storybook/test' (no @ prefix) — Storybook 10 path"

key-files:
  created:
    - frontend/src/stories/parcel/PotentieLayer.stories.tsx
  modified:
    - frontend/src/stories/parcel/WoonvisiePopup.stories.tsx

key-decisions:
  - "EscDismisses story uses close button (aria-label=Sluiten) not Escape key — WoonvisiePopup.tsx has no keydown listener; documented as follow-up gap"
  - "PotentieLayer ClickOpensPopup navigates to page 2 first — woonvisie_match is card 10, CARDS_PER_PAGE=9 puts it on page 2"
  - "waitFor(timeout=2000) used for AnimatePresence 200ms transition before WOONVISIE button becomes available"
  - "woonvisieButton found via textContent.includes('WOONVISIE') fallback — role heuristics don't traverse TruncatedText <p> wrapper"

patterns-established:
  - "Storybook play-function for hook-dependent component: provide QueryClient + AuthContext.Provider, pre-seed cache, disable network"
  - "Page-navigation-before-card pattern: when CARDS_PER_PAGE < card count, click Volgende Pagina + waitFor before asserting card"

requirements-completed:
  - WOON-01
  - WOON-02
  - WOON-03
  - TEST-04

# Metrics
duration: 20min
completed: 2026-04-25
---

# Phase 03 Plan 02: Woonvisie Popup Test Coverage Summary

**6 Storybook play-functions added to WoonvisiePopup.stories.tsx + 1 new PotentieLayer.stories.tsx with WOON-01 click-test — all 15 parcel-story tests green in browser-mode vitest**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-25T17:35:00Z
- **Completed:** 2026-04-25T17:39:55Z
- **Tasks:** 3 (2 code + 1 phase gate)
- **Files modified:** 2

## Accomplishments

- Added 6 play-functions to `WoonvisiePopup.stories.tsx` covering the full minimal-DOM assertion matrix: prioriteit labels (Groeigebied/Herstructurering/Neutraal), plain `<p>` citaat text, single inline `<p>` segmentmatch sentence, fallback Gemeente-breed title + low-confidence note, close button dismiss, backdrop click dismiss
- Created `PotentieLayer.stories.tsx` with mock ScanResultItem + woonvisie_match data, QueryClientProvider (pre-seeded), AuthContext mock — `ClickOpensPopup` play-function navigates to page 2 then clicks WOONVISIE button and asserts popup opens with Blerick + Groeigebied
- Full parcel-stories suite (3 files, 15 tests): all green, no regression in Phase-2 ScoreBreakdownModal tests

## Play-Function Coverage Detail

| Story | Assertions |
|-------|-----------|
| BlerickGroeiMatch | wijk title "Blerick", label "Groeigebied", citaat /Blerick blijft/, segmentmatch /Jouw project past volledig/ |
| VenloCentrumMismatch | label "Neutraal", mismatch sentence /valt buiten/, negative: no border-l-4, no bg-emerald-100 |
| TegelenHerstructurering | label "Herstructurering", citaat /verouderd woningbestand uit de jaren/ |
| GeenMatchFallback | "Gemeente-breed" title, /geen wijk-specifieke tekst/, algemeen citaat, no segmentmatch, /Extractie-zekerheid laag/ |
| EscDismisses | Sluiten button click closes popup (see ESC gap below) |
| ClickOutsideDismisses | backdrop div click closes popup |
| PotentieLayer.ClickOpensPopup | navigate page, click WOONVISIE button, assert Blerick + Groeigebied in popup |

## Task Commits

1. **Task 1: Add play-functions to WoonvisiePopup.stories.tsx** - `97a07d53` (test)
2. **Task 2: Create PotentieLayer.stories.tsx** - `b88b63c6` (feat)
3. **Task 3: Phase gate** — no commit (no file changes; run-only verification)

## Files Created/Modified

- `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` — Added `import { expect, within, userEvent } from 'storybook/test'` + 6 play-functions on existing stories + 2 new dismiss stories (EscDismisses + ClickOutsideDismisses)
- `frontend/src/stories/parcel/PotentieLayer.stories.tsx` — New file: 2 stories (Default visual + ClickOpensPopup play-function), QueryClientProvider + AuthContext mock

## Decisions Made

- **EscDismisses uses Sluiten button, not Escape key:** WoonvisiePopup.tsx has no `keydown` listener for Escape. The plan specified: "If this play-function fails because the popup doesn't respond to ESC, mark it as a known-gap." The story was renamed "Close button dismisses popup" and asserts `button[aria-label=Sluiten]` click instead. Documented as follow-up (see Known Gaps below).
- **Page navigation required for WOONVISIE card:** `CARDS_PER_PAGE=9` and `woonvisie_match` is the 10th card — visible only on page 2. Play-function clicks "Volgende pagina" button first before searching for WOONVISIE.
- **waitFor for AnimatePresence:** After page navigation, the 200ms AnimatePresence transition causes the new card to not be immediately available. Used `waitFor({ timeout: 2000 })` to poll until the WOONVISIE button appears.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESC dismiss story switched to Sluiten button click**
- **Found during:** Task 1 (EscDismisses story)
- **Issue:** `WoonvisiePopup.tsx` has no keydown listener for Escape — only backdrop `onClick` dismisses. The plan anticipated this gap and specified the mitigation explicitly.
- **Fix:** Story renamed to "Close button dismisses popup", asserts `getByRole('button', { name: /sluiten/i })` click instead of `userEvent.keyboard('{Escape}')`. Behavior confirmed: close button calls `onClose` correctly.
- **Files modified:** `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx`
- **Committed in:** `97a07d53`

**2. [Rule 1 - Bug] PotentieLayer: navigate to page 2 before searching WOONVISIE button**
- **Found during:** Task 2 (ClickOpensPopup initial test run — button not found)
- **Issue:** The plan assumed WOONVISIE was directly findable; it's on page 2 due to pagination. First test run returned `null` for the button.
- **Fix:** Added click on "Volgende pagina" + `waitFor` before button search. Tests green after fix.
- **Files modified:** `frontend/src/stories/parcel/PotentieLayer.stories.tsx`
- **Committed in:** `b88b63c6`

---

**Total deviations:** 2 auto-fixed (2 × Rule 1 — behavior gaps discovered during test authoring)
**Impact on plan:** Both auto-fixes necessary to make assertions match actual shipped behavior. No scope creep. The plan explicitly anticipated the ESC gap.

## Known Gaps (Follow-up Todos)

**1. ESC keydown not wired in WoonvisiePopup.tsx**
- The popup has no `useEffect` + `keydown` listener for `Escape`. Only the backdrop `onClick` and the `Sluiten` button call `onClose`.
- Follow-up: Add `useEffect(() => { const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [onClose])` to `WoonvisiePopup.tsx`.
- Once added, the `EscDismisses` story can be updated to use `userEvent.keyboard('{Escape}')`.

## Test Counts

| Suite | Before Plan 02 | After Plan 02 |
|-------|---------------|---------------|
| ScoreBreakdownModal | 5 | 5 (no change) |
| WoonvisiePopup | 0 play-functions | 8 tests (6 stories with play + 2 new dismiss stories) |
| PotentieLayer | does not exist | 2 tests (1 visual + 1 play-function) |
| **Total parcel suite** | **5** | **15** |

## Issues Encountered

- Pre-existing TypeScript errors in the codebase (91 errors confirmed in 03-01-SUMMARY, unchanged) — none introduced by this plan. `pnpm run check` exits 2 due to pre-existing errors only; no new errors in files touched by this plan.
- `SideRailNav.stories.tsx` and `ReportSidebar.stories.tsx` have `TS2741: is_superuser missing` errors pre-existing — not introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WOON-01, WOON-02, WOON-03, TEST-04 all covered by play-functions
- Phase 03 (woonvisie-popup) is fully complete — all 2 plans done
- Phase 08 (integration tests) can reference the QueryClientProvider + AuthContext mock pattern established here

---
*Phase: 03-woonvisie-popup*
*Completed: 2026-04-25*
