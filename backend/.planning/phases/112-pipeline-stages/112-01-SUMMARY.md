---
phase: 112-pipeline-stages
plan: "01"
subsystem: frontend
tags: [pipeline, favorites, optimistic-update, popover, modal]
dependency_graph:
  requires: []
  provides: [pipeline-stage-mutation, stage-selector-popover, afgerond-modal]
  affects: [FavoritedParcelCard, useFavorites]
tech_stack:
  added: []
  patterns: [optimistic-mutation, createPortal, outside-click-detection, TanStack-Query-PATCH]
key_files:
  created:
    - frontend/src/components/projects/PipelineStageSelector.tsx
    - frontend/src/components/projects/AfgerondModal.tsx
  modified:
    - frontend/src/hooks/useFavorites.ts
    - frontend/src/components/projects/PipelineStagePill.tsx
    - frontend/src/components/projects/FavoritedParcelCard.tsx
decisions:
  - useUpdatePipelineStage does NOT invalidate portfolio queries — portfolio has no pipeline data
  - PipelineStagePill renders as <button> only when onClick prop is provided (backward compat)
  - STAGE_STYLES exported as named export for reuse in PipelineStageSelector
  - AfgerondModal uses createPortal(content, document.body) for z-index safety (same pattern as EigendomModal)
  - Optimistic update clears afgerond_reden/notitie when changing away from Afgerond stage
  - PipelineStageSelector wraps in relative div inside FavoritedParcelCard so top-full positioning works
metrics:
  duration: 8min
  completed: "2026-03-16"
  tasks_completed: 2
  files_changed: 5
---

# Phase 112 Plan 01: Pipeline Stage Selector Summary

**One-liner:** Interactive pipeline stage popover + Afgerond modal with optimistic TanStack Query PATCH mutation wired into FavoritedParcelCard.

## What Was Built

Users can now click a pipeline stage pill on any FavoritedParcelCard to change the stage inline. The system provides:

1. **`useUpdatePipelineStage` hook** — PATCH `/api/parcels/favorites/{parcelId}/pipeline` with optimistic cache update. On error, rolls back to previous snapshot and shows toast. Only invalidates `['favorites']` (not portfolio).

2. **`PipelineStagePill` (updated)** — Accepts optional `onClick` prop (renders as `<button>` with hover opacity). Accepts `afgerondReden` prop — shows sub-label `<span>` below pill when stage is Afgerond. Exports `STAGE_STYLES` as named export.

3. **`PipelineStageSelector`** — Floating popover (absolute top-full right-0). Lists 5 stages with Lucide `Check` icon on current stage. Outside-click dismissal via `useEffect` + `mousedown` listener on ref. Non-Afgerond clicks call mutation + close; Afgerond click delegates to `onAfgerond` callback.

4. **`AfgerondModal`** — Portal-based modal (`createPortal` to `document.body`, z-[100]). Gekocht/Afgewezen radio-style selection cards (amber highlight when selected). Optional notitie textarea (max 500 chars). Confirm disabled until reden selected. On confirm: calls mutation with stage=Afgerond + reden + notitie.

5. **`FavoritedParcelCard` (updated)** — Adds `selectorOpen`/`afgerondOpen` state. Wraps pill in relative div. Renders selector conditionally. AfgerondModal rendered at end of component (portal ignores DOM position). Uses `favorite.parcel_id` (Kadaster string) as parcelId.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useUpdatePipelineStage + PipelineStagePill + PipelineStageSelector + AfgerondModal | a75f72a | 4 files |
| 2 | Wire FavoritedParcelCard | d564752 | 1 file |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `frontend/src/hooks/useFavorites.ts` — exports `useUpdatePipelineStage`
- [x] `frontend/src/components/projects/PipelineStageSelector.tsx` — created
- [x] `frontend/src/components/projects/AfgerondModal.tsx` — created
- [x] `frontend/src/components/projects/PipelineStagePill.tsx` — updated with onClick, STAGE_STYLES export
- [x] `frontend/src/components/projects/FavoritedParcelCard.tsx` — updated with selector + modal
- [x] TypeScript: zero errors (`npx tsc --noEmit`)
- [x] Commits: a75f72a, d564752

## Self-Check: PASSED
