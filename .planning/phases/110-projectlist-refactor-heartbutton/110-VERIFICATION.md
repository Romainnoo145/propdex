---
phase: 110-projectlist-refactor-heartbutton
verified: 2026-03-16T18:00:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 110: ProjectList Refactor + Heart Button Verification Report

**Phase Goal:** Users can heart a parcel from the detail panel to add it to their portfolio; the Projecten page is split into maintainable sub-components before v17 features are added
**Verified:** 2026-03-16T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ProjectList.tsx is no longer 1867 lines — orchestrator is under 300 lines | VERIFIED | `ProjectList.tsx` = 6 lines (thin re-export); `ProjectenPage.tsx` = 220 lines |
| 2 | Each extracted sub-component is under 300 lines | VERIFIED | ProvincieView=233, GemeenteView=200, WijkView=279, WijkScanList=139, WorkspaceHeader=108, ProjectIcons=119, useProjectenWorkspace=285, useMunicipalityResolver=190 |
| 3 | TypeScript compiles without errors after extraction | VERIFIED | `npx tsc --noEmit` exits clean (zero output) |
| 4 | Heart button appears next to the close button on the parcel detail panel | VERIFIED | `ParcelDetailPanel.tsx` line 111: `headerActions={<HeartButton parcel={parcel} />}` passed to `ParcelPanelShell` |
| 5 | Clicking the heart button toggles favorite state immediately (optimistic update) and persists server-side | VERIFIED | `useToggleFavorite` implements `onMutate` optimistic cache update + `onSettled` invalidation; POST/DELETE via `apiFetch` |
| 6 | Heart button reflects correct filled/unfilled state when the same parcel is reopened | VERIFIED | `useParcelFavorites` query with `staleTime: 5min`, `enabled: !!accessToken`; comparison against server-returned `FavoriteResponse[]` |
| 7 | Unfavoriting via heart button removes the favorite server-side (DELETE endpoint) | VERIFIED | `useFavorites.ts` line 69: `apiFetch<null>(\`${FAVORITES_BASE}/${encodeURIComponent(parcel.parcel_code)}\`, { method: 'DELETE' })` |
| 8 | ProjectenPage renders ProvincieView or GemeenteView conditionally (no regressions) | VERIFIED | `ProjectenPage.tsx` lines 8-9 import both; lines 92-130 conditionally render based on `ws.hasGemeenteDetail` |

**Score:** 8/8 truths verified

---

## Required Artifacts

### Plan 01 — Refactor Sub-Components

| Artifact | Lines | Min Required | Status | Details |
|----------|-------|--------------|--------|---------|
| `frontend/src/components/projects/ProjectList.tsx` | 6 | 3 | VERIFIED | Thin re-export: `export { default } from './ProjectenPage'` |
| `frontend/src/components/projects/ProjectenPage.tsx` | 220 | 100 | VERIFIED | Orchestrator with hooks + view dispatch |
| `frontend/src/components/projects/ProvincieView.tsx` | 233 | 80 | VERIFIED | Province selector + gemeente card grid |
| `frontend/src/components/projects/GemeenteView.tsx` | 200 | 80 | VERIFIED | Gemeente detail workspace |
| `frontend/src/components/projects/WijkView.tsx` | 279 | 100 | VERIFIED | UnlinkedGemeenteWorkspace exported |
| `frontend/src/components/projects/ProjectIcons.tsx` | 119 | 30 | VERIFIED | 12 SVG icon helpers |
| `frontend/src/components/projects/WijkScanList.tsx` | 139 | — | VERIFIED | Extra file (kept WijkView under 300 lines) |
| `frontend/src/components/projects/WorkspaceHeader.tsx` | 108 | — | VERIFIED | Extra file (kept GemeenteView under 300 lines) |
| `frontend/src/components/projects/useProjectenWorkspace.ts` | 285 | — | VERIFIED | All hooks/state extracted from monolith |
| `frontend/src/components/projects/useMunicipalityResolver.ts` | 190 | — | VERIFIED | Municipality resolution logic |

### Plan 02 — Heart Button

| Artifact | Lines | Min Required | Status | Details |
|----------|-------|--------------|--------|---------|
| `frontend/src/lib/types/portfolio.ts` | 75 | 20 | VERIFIED | PipelineStage, FavoriteResponse, PortfolioWijkGroup, PortfolioGemeenteGroup, PortfolioResponse |
| `frontend/src/hooks/useFavorites.ts` | 137 | 40 | VERIFIED | useParcelFavorites + useToggleFavorite with optimistic update |
| `frontend/src/components/map/panels/parcel/HeartButton.tsx` | 44 | 20 | VERIFIED | Heart toggle, filled amber when favorited, parcel_code guard |
| `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx` | 93 | — | VERIFIED | `headerActions?: ReactNode` prop added at line 12 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ProjectList.tsx` | `ProjectenPage.tsx` | re-export default | WIRED | Line 6: `export { default } from './ProjectenPage'` |
| `ProjectenPage.tsx` | `ProvincieView.tsx` | conditional render import | WIRED | Line 8: `import { ProvincieView } from './ProvincieView'`; rendered at line 113 |
| `ProjectenPage.tsx` | `GemeenteView.tsx` | conditional render import | WIRED | Line 9: `import { GemeenteView } from './GemeenteView'`; rendered at line 92 |
| `HeartButton.tsx` | `useFavorites.ts` | useParcelFavorites + useToggleFavorite | WIRED | Line 3: `import { useParcelFavorites, useToggleFavorite } from '@/hooks/useFavorites'`; both called at lines 20-21 |
| `useFavorites.ts` | `/api/parcels/favorites` | apiFetch POST/DELETE | WIRED | FAVORITES_BASE = '/api/parcels/favorites'; used at lines 34, 69, 76 |
| `ParcelDetailPanel.tsx` | `HeartButton.tsx` | headerActions prop on ParcelPanelShell | WIRED | Line 7 import; line 111: `headerActions={<HeartButton parcel={parcel} />}` |
| `useFavorites.ts` | `portfolio.ts` | FavoriteResponse type import | WIRED | Line 16: `import type { FavoriteResponse } from '@/lib/types/portfolio'` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BACK-05 | Plan 01 | ProjectList.tsx refactored from 1867 lines into sub-components before new features | SATISFIED | ProjectList.tsx = 6 lines (re-export); 9 sub-components created, all under 300 lines; tsc passes clean |
| FAV-01 | Plan 02 | User can click heart button on parcel detail panel to favorite/unfavorite a parcel (server-side, org-scoped) | SATISFIED | HeartButton uses useToggleFavorite with POST/DELETE to /api/parcels/favorites; optimistic update + rollback on error |
| FAV-02 | Plan 02 | Heart button positioned next to close button, close button aligned with panel title | SATISFIED | ParcelPanelShell flex container: `{headerActions}` renders left of close button in `absolute top-3 right-3` div |

No orphaned requirements found — all 3 IDs from plan frontmatter are present in REQUIREMENTS.md and marked complete.

---

## Anti-Patterns Found

No blockers detected. Scanned key files:

- No `TODO/FIXME/PLACEHOLDER` comments in modified files
- No empty handlers (`return null` guarded appropriately — `if (!parcel.parcel_code) return null` is a valid guard, not a stub)
- No console.log-only implementations
- No static return replacing DB query

One informational note: `useProjectenWorkspace.ts` is 285 lines (under the 300-line limit but close). Not a blocker.

---

## Human Verification Required

### 1. Heart Button Visual State

**Test:** Open a parcel detail panel. Verify the heart button appears to the left of the close (X) button in the top-right corner of the panel hero area.
**Expected:** Two circular buttons visible — heart (unfilled) on the left, X on the right, both matching the glass-dark style.
**Why human:** Visual positioning and Aura CSS variable `fill-aura-amber` rendering cannot be verified programmatically.

### 2. Optimistic Toggle Behavior

**Test:** Click the heart button. Verify it fills amber immediately, before any network round-trip.
**Expected:** Instant visual feedback (amber fill), no loading flicker. If API fails, heart reverts and toast appears.
**Why human:** Animation timing and optimistic state feel require browser observation.

### 3. Projecten Page — No Regressions

**Test:** Navigate to the Projecten page with a gemeente-linked project. Verify province selector, gemeente card grid, gemeente detail workspace, and wijk scan list all render and interact identically to pre-refactor behavior.
**Expected:** No missing UI elements, no broken interactions, no console errors.
**Why human:** Pure mechanical refactor — regression risk is low but visual equivalence requires a browser check.

---

## Commits Verified

| Commit | Message | Status |
|--------|---------|--------|
| `4d0ebd0` | refactor(110-01): extract ProjectList.tsx monolith into sub-components | FOUND |
| `a2f873e` | feat(110-02): Portfolio types + useFavorites hook | FOUND |
| `0f81cbf` | feat(110-02): HeartButton component + ParcelPanelShell header slot | FOUND |

---

## Summary

Phase 110 goal is fully achieved. Both sub-goals are independently verified:

**Sub-goal 1 (BACK-05):** The 1867-line `ProjectList.tsx` monolith has been mechanically extracted into 10 focused files (9 created + 1 thinned). Every file is under 300 lines. The original import path works unchanged via a 6-line re-export. TypeScript compiles clean.

**Sub-goal 2 (FAV-01, FAV-02):** The heart button is wired end-to-end — `HeartButton` calls `useToggleFavorite` which calls `apiFetch` against `/api/parcels/favorites` with the correct Kadaster `parcel_code` identifier. Optimistic update (onMutate/onError/onSettled pattern) is fully implemented. The button is passed via `headerActions` prop into `ParcelPanelShell` where it renders left of the close button. State is server-backed via `useParcelFavorites` list query.

---

_Verified: 2026-03-16T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
