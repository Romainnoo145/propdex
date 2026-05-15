---
phase: 04-m045-upload-flow-integratie
plan: "01"
subsystem: frontend
tags: [modal, upload, backwards-compatible, props-extension]
dependency_graph:
  requires: []
  provides: [UploadDocumentModal-extended-props]
  affects: [instellingen.data-bronnen.$gemeenteCode.tsx]
tech_stack:
  added: []
  patterns: [optional-props-extension, controlled-useEffect-initialisation]
key_files:
  created: []
  modified:
    - frontend/src/components/settings/beleid/UploadDocumentModal.tsx
decisions:
  - "Props are optional (undefined-default) — existing InstellingenBeleidPage call site passes only {open, onClose, gemeenten} and continues to work unchanged"
  - "Initialisation useEffect fires when open+initialGemeente/initialSourceKey provided — fires AFTER ESC-handler to follow existing code order"
  - "onSuccess receives doc.id (the PolicyDocument UUID), invoked before onClose() so caller can trigger probe/cache-invalidation before modal disappears"
metrics:
  duration: "1m 15s"
  completed: "2026-05-15"
  tasks_completed: 1
  files_modified: 1
---

# Phase 4 Plan 01: UploadDocumentModal Props Extension Summary

Extended `UploadDocumentModal` with three optional props enabling it to be driven from the data-bronnen detail route with gemeente + source_key pre-selected, while remaining fully backwards-compatible with the existing InstellingenBeleidPage call site.

## What Was Built

**UploadDocumentModal** (`frontend/src/components/settings/beleid/UploadDocumentModal.tsx`):
- Added `initialGemeente?: GemeenteEntry` — sets `niveau='gemeente'` and `entityCode=initialGemeente.code` when modal opens
- Added `initialSourceKey?: string` — pre-selects the documenttype dropdown when modal opens
- Added `onSuccess?: (versionId: string) => void` — invoked with `doc.id` after toast and before `onClose()` in the submit success path
- New `useEffect` placed after the ESC-key handler, fires on `[open, initialGemeente, initialSourceKey]` change

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend UploadDocumentModal props + initialise effect + onSuccess wiring | 14c5554c | UploadDocumentModal.tsx |

## Verification Results

- `initialGemeente` present in interface, destructuring, and useEffect: PASS
- `initialSourceKey` present in interface, destructuring, and useEffect: PASS
- `onSuccess?.(doc.id)` present before `onClose()` in handleSubmit: PASS
- Existing call site in InstellingenBeleidPage passes only `{open, onClose, gemeenten}`: PASS
- File remains under 300 lines (249 lines): PASS
- No new TypeScript errors from UploadDocumentModal: PASS

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- File exists: `frontend/src/components/settings/beleid/UploadDocumentModal.tsx` (249 lines)
- Commit exists: `14c5554c` — feat(04-m045/04-01): extend UploadDocumentModal
