---
phase: 04-m045-upload-flow-integratie
plan: 02
subsystem: ui
tags: [react, typescript, tailwind, modal, version-history, data-bronnen]

# Dependency graph
requires:
  - phase: 03-data-bronnen-ux
    provides: DataSourceRow with onViewVersions callback hook-up point
provides:
  - VersionHistoryPanel with open/onClose/gemeenteCode optional props for modal-overlay mounting
  - ModalShell inner component for data-bronnen detail route usage
  - VersionRows extracted inner component (no JSX duplication)
affects:
  - instellingen.data-bronnen.$gemeenteCode.tsx (next plan — mounts VersionHistoryPanel in modal mode)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional modal-overlay pattern: add open?/onClose?/shorthand? props to existing panel component; early-return null when open=false; conditionally wrap in ModalShell when onClose present"
    - "Inner component extraction to avoid JSX duplication across inline and modal render paths"

key-files:
  created: []
  modified:
    - frontend/src/components/settings/beleid/VersionHistoryPanel.tsx

key-decisions:
  - "resolvedEntityType/resolvedEntityCode derived from gemeenteCode shorthand before hook call — shorthand sets entityType='gemeente' implicitly for all Type-A cascade documents"
  - "VersionRows extracted as inner component (not duplicated JSX) — loading/error states wrap with ModalShell when onClose present, success state shares VersionRows between both render branches"
  - "open===false early-return placed AFTER all hook calls to satisfy React hooks rule (hooks must not be conditional)"
  - "AdminPolicyVersionRow type imported from existing policy-admin.ts — no local interface duplication"

patterns-established:
  - "Modal-overlay retrofit pattern: add open?/onClose?/gemeenteCode? to existing inline panel; hooks always run; early-return null only after hooks"

requirements-completed:
  - INT-02

# Metrics
duration: 9min
completed: 2026-05-15
---

# Phase 04 Plan 02: VersionHistoryPanel Modal Overlay Mode Summary

**VersionHistoryPanel extended with open/onClose/gemeenteCode optional props enabling modal-overlay mounting from data-bronnen hub, with ModalShell + VersionRows inner components eliminating JSX duplication**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-15T07:57:55Z
- **Completed:** 2026-05-15T08:06:52Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extended `Props` interface with three new optional props (`open?`, `onClose?`, `gemeenteCode?`) while keeping all six original required props intact (backwards-compatible)
- Derived `resolvedEntityType`/`resolvedEntityCode` from `gemeenteCode` shorthand so data-bronnen callers don't need to pass redundant `entityType='gemeente'` + `entityCode`
- Added `open === false` early return (after hook calls) so modal mode respects closed state
- Extracted `VersionRows` inner component shared by both inline and modal render branches — no JSX duplication
- Added `ModalShell` inner component wrapping overlay backdrop + close button header for modal mode
- Loading and error states also wrapped in `ModalShell` when `onClose` is present

## Task Commits

Each task was committed atomically:

1. **Task 1: Add optional modal-overlay mode to VersionHistoryPanel** - `d7879dce` (feat)

**Plan metadata:** _(see final commit below)_

## Files Created/Modified
- `frontend/src/components/settings/beleid/VersionHistoryPanel.tsx` - Added modal-overlay mode with open/onClose/gemeenteCode props; extracted VersionRows + ModalShell inner components; 109 lines → 208 lines

## Decisions Made
- `resolvedEntityType`/`resolvedEntityCode` derived before hook calls so query fires with correct entity context even in modal mode
- `open === false` guard placed after all hook calls (React hooks rules — cannot conditionally invoke hooks)
- `AdminPolicyVersionRow` imported from existing `policy-admin.ts` type file rather than redefining a local `Version` interface
- `ModalShell` kept as file-local component (not exported) — single consumer, no need for shared component extraction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `verkenner.tsx` and two Storybook story files (`ReportSidebar.stories.tsx`, `SideRailNav.stories.tsx`) — none in `VersionHistoryPanel.tsx`. These are out of scope (pre-existing, not caused by this task's changes). Logged for awareness; not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `VersionHistoryPanel` ready for modal-overlay usage in `instellingen.data-bronnen.$gemeenteCode.tsx` (Plan 04-03 or equivalent)
- Call pattern: `<VersionHistoryPanel open={openVersionsFor !== null} onClose={() => setOpenVersionsFor(null)} gemeenteCode={gemeenteCode} sourceKey={openVersionsFor ?? ''} latestVersionNumber={1} onView={noop} onDownload={noop} />`
- Existing `InstellingenBeleidPage` usage unchanged — no migration needed

---
*Phase: 04-m045-upload-flow-integratie*
*Completed: 2026-05-15*
