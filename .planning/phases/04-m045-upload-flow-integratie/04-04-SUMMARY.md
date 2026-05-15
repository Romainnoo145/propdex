---
phase: 04-m045-upload-flow-integratie
plan: "04"
subsystem: frontend
tags: [react, typescript, modal, data-bronnen, upload, version-history, integration-wiring, INT-01, INT-02, INT-04]
dependency_graph:
  requires:
    - "04-01: UploadDocumentModal extended with initialGemeente, initialSourceKey, onSuccess props"
    - "04-02: VersionHistoryPanel extended with open/onClose/gemeenteCode modal-overlay mode"
  provides:
    - "DataSourceRow with onUpload + onViewVersions callback props"
    - "GemeenteDataSourcesPage with modal state + handleUploadSuccess + INT-04 probe trigger"
    - "Storybook play functions asserting callback invocations"
  affects:
    - "instellingen.data-bronnen.$gemeenteCode.tsx (complete integration wiring)"
    - "DataSourceRow.tsx (Link placeholder removed)"
    - "DataSourceRow.stories.tsx (fn() spies added to all 4 stories)"
tech_stack:
  added: []
  patterns:
    - "Hooks-before-early-returns: useState/useQueryClient/useRefreshDataSource placed before loading/error guards (React rules)"
    - "Page-level modal mount: single UploadDocumentModal + VersionHistoryPanel instance per route, driven by openUploadFor/openVersionsFor state"
    - "INT-04 double-flush: invalidateQueries + refreshMutation.mutate in handleUploadSuccess"
    - "GemeenteSummary→GemeenteEntry shape conversion inline at call site (provincie_code='' sentinel)"
key_files:
  created: []
  modified:
    - frontend/src/components/settings/data-bronnen/DataSourceRow.tsx
    - frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx
    - frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx
decisions:
  - "Hooks before early-returns: moved useQueryClient/useRefreshDataSource/useState before loading/error guards per React rules of hooks"
  - "GemeenteSummary→GemeenteEntry conversion at call site with provincie_code='' sentinel — UploadDocumentModal only uses code for entity_code, not provincie_code"
  - "handleUploadSuccess double-flush: invalidateQueries first (forces re-fetch of new status), then refreshMutation.mutate (INT-04 probe triggers Type A probe that flips status to live)"
  - "Upload + view_versions branches use dedicated button elements before the generic button fallback — enables callback wiring without touching the disabled/tooltip path"
  - "Link import from @tanstack/react-router removed from DataSourceRow.tsx — no longer needed after Link placeholder replaced"
metrics:
  duration: "~7min"
  completed: "2026-05-15"
  tasks_completed: 2
  files_modified: 3
---

# Phase 04 Plan 04: DataSourceRow Integration Wiring Summary

**End-to-end upload + version-history wiring from DataSourceRow actions to UploadDocumentModal + VersionHistoryPanel modals, with INT-04 probe trigger on upload success and Storybook callback assertions**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-15T08:08:24Z
- **Completed:** 2026-05-15T08:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

### Task 1: DataSourceRow — Add onUpload + onViewVersions props + replace Link placeholder
- Extended `Props` interface with `onUpload?: (sourceKey: string) => void` and `onViewVersions?: (sourceKey: string) => void`
- Updated `ActionButton` interface with same two optional props; destructured `sourceKey` in the function signature
- Replaced `<Link to="/instellingen/beleid-beheer">` upload placeholder with `<button onClick={() => onUpload?.(sourceKey)}>`
- Added dedicated `view_versions` enabled branch: `<button onClick={() => onViewVersions?.(sourceKey)}>` (before the generic disabled/refresh fallback)
- Removed unused `Link` import from `@tanstack/react-router`

### Task 2: Detail route + Storybook wiring + TEST-06 regression
**Detail route (`instellingen.data-bronnen.$gemeenteCode.tsx`):**
- Added `useState`, `useQueryClient`, `useRefreshDataSource` imports
- Added `UploadDocumentModal` + `VersionHistoryPanel` imports
- Moved all hooks (`useQueryClient`, `useRefreshDataSource`, `useState` for `openUploadFor`/`openVersionsFor`) before loading/error early returns (React hooks rules compliance)
- Implemented `handleUploadSuccess(sourceKey)`: invalidates `dataSourcesAdminKeys.gemeente(gemeenteCode)` cache + calls `refreshMutation.mutate` (INT-04 probe trigger)
- Built `gemeentenForModal: GemeenteEntry[]` from `gemeentenQuery.data` (shape conversion from `GemeenteSummary` with `provincie_code=''` sentinel)
- Derived `currentGemeenteEntry` for the active gemeente pre-selection
- Passed `onUpload` + `onViewVersions` callbacks to all three `DataSourceRow` render sites (cascade_uploads, open_apis, paid_integrations)
- Mounted `UploadDocumentModal` at page level with `open={openUploadFor !== null}`, `initialGemeente={currentGemeenteEntry}`, `initialSourceKey`, `onSuccess` triggering `handleUploadSuccess`
- Mounted `VersionHistoryPanel` in modal-overlay mode with `open={openVersionsFor !== null}`, `onClose`, `gemeenteCode` shorthand

**DataSourceRow.stories.tsx:**
- Updated import: `{ expect, fn, userEvent, within }` from `storybook/test`
- Added `onUpload: fn(), onViewVersions: fn()` to all 4 story `args`
- Updated `LiveWithActions` play: click `Bekijk versies` → assert `args.onViewVersions` called
- Updated `MissingPlaceholder` play: assert `uploadBtn.tagName === 'BUTTON'` (no longer Link anchor) + click → assert `args.onUpload` called

## Task Commits

Each task was committed atomically:

1. **Task 1: Add onUpload + onViewVersions props to DataSourceRow** - `6bbb37e5` (feat)
2. **Task 2: Wire modals in detail route + stories + TEST-06** - `35d37918` (feat)

## Files Created/Modified

- `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` — Props extended, Link removed, dedicated upload + view_versions branches added
- `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` — Full modal wiring, INT-04 probe trigger, hooks-before-returns structure
- `frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx` — fn() spies, callback click assertions, tagName check

## Verification Results

**INT-01 (Upload action wires modal):**
- `onUpload` prop in DataSourceRow interface + invocation: PASS
- `UploadDocumentModal` mounted in route with `open={openUploadFor !== null}`: PASS

**INT-02 (Bekijk versies wires modal):**
- `onViewVersions` prop in DataSourceRow interface + invocation: PASS
- `VersionHistoryPanel` mounted in route with `open={openVersionsFor !== null}`: PASS

**INT-04 (probe trigger on upload success):**
- `refreshMutation.mutate` in `handleUploadSuccess`: PASS
- `queryClient.invalidateQueries(dataSourcesAdminKeys.gemeente(gemeenteCode))` before probe: PASS

**TEST-06 (no regression on legacy paths):**
- `npm run check` shows 0 errors in modified files: PASS
- Pre-existing errors in verkenner.tsx, ReportSidebar.stories, SideRailNav.stories, and 60+ other unrelated files — out of scope, unchanged from before this plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Hooks before early returns**
- **Found during:** Task 2 implementation
- **Issue:** Plan's action placed `useQueryClient`, `useRefreshDataSource`, and `useState` calls after the loading/error early-return guards, which violates React's rules of hooks (hooks cannot be called conditionally)
- **Fix:** Moved all hook calls to before the two early returns, with comment explaining why
- **Files modified:** `instellingen.data-bronnen.$gemeenteCode.tsx`
- **Commit:** `35d37918`

## Issues Encountered

- Pre-existing TypeScript errors in 60+ unrelated files (verkenner.tsx, reports, projects, notifications, map panels) — none in files modified by this plan. These errors existed before this milestone and are out of scope per deviation rules.

## Self-Check: PASSED

Files exist:
- `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` — FOUND
- `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` — FOUND
- `frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx` — FOUND

Commits exist:
- `6bbb37e5` — feat(04-m045/04-04): add onUpload + onViewVersions props to DataSourceRow — FOUND
- `35d37918` — feat(04-m045/04-04): wire UploadDocumentModal + VersionHistoryPanel in detail route + update stories — FOUND
