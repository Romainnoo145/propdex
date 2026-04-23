# Design: Unified Document Linking

**Date:** 2026-04-23  
**Scope:** M048 — cross-surface document unification  
**Status:** Approved

## Problem

Documents uploaded or generated in any surface (Dossiers tab, Checklist, Portfolio workspace) are not visible in the other surfaces. Three parallel implementations exist with identical logic but no shared foundation:

- `BronnenLayer.tsx` — `buildPages()` + `mergeDocuments()`
- `FavoriteParcelWorkspaceView.tsx` — same functions, duplicated
- `S8VergunningChecklist.tsx` — separate `get_checklist_status()` endpoint, user-scoped, only queries checklist doc types

Root cause: `document_type` values don't align across surfaces. Checklist generates `vergunningen`, dossier slot expects `vergunninghistorie`. `mergeDocuments()` matches by exact equality only. Checklist status is user-scoped, not org-scoped.

All documents already live in one table (`parcel_documents`). This is purely a routing and matching problem.

## Architecture

```
parcel_documents table
        │
        ├── useParcelDocuments()          [org-scoped, returns all types]
        │         │
        │         └── mergeWithRegistry() [maps any type → canonical slot]
        │                   │
        │             DOC_TYPE_TO_SLOT    [single source of truth]
        │                   │
        │         ┌─────────┴──────────┐
        │    BronnenLayer    FavoriteParcelWorkspaceView
        │    (Dossiers tab)  (Portfolio workspace)
        │
        └── get_checklist_status()        [org-scoped after fix]
                  │                       [uses SLOT_TO_DOC_TYPES for expansion]
                  │
            S8VergunningChecklist
```

No DB migration. No new endpoints. No schema changes.

## Type Registry

Single source of truth: every `document_type` maps to exactly one canonical dossier slot.

### Frontend — `frontend/src/lib/documents/typeRegistry.ts`

```ts
export const DOC_TYPE_TO_SLOT: Record<string, string> = {
  // dossier upload types (self-mapping)
  bestemmingscheck:   'bestemmingscheck',
  perceeldata:        'perceeldata',
  vergunninghistorie: 'vergunninghistorie',
  woz:                'woz',
  quickscan:          'quickscan',
  bodem:              'bodem',
  fundering:          'fundering',
  asbest:             'asbest',
  bouwkundig:         'bouwkundig',
  energielabel:       'energielabel',
  bestemmingsplan:    'bestemmingsplan',
  milieuzones:        'milieuzones',
  geluid:             'geluid',
  stikstof:           'stikstof',
  kadaster:           'kadaster',
  eigendom:           'eigendom',
  erfpacht:           'erfpacht',
  documenten:         'documenten',
  correspondentie:    'correspondentie',
  ideeen:             'ideeen',
  checklist:          'documenten',

  // checklist-generated types (cross-mapping to dossier slot)
  vergunningen:       'vergunninghistorie',
  haalbaarheid:       'bestemmingscheck',
  wkb_precheck:       'bestemmingscheck',
  risicoprofiel:      'quickscan',
  monumenten:         'kadaster',
  bodemloket:         'bodem',
}

// Auto-generated reverse map: slot → all doc_types that land there
export const SLOT_TO_DOC_TYPES: Record<string, string[]> = buildReverseMap(DOC_TYPE_TO_SLOT)

// Replaces mergeDocuments() in BronnenLayer and FavoriteParcelWorkspaceView
export function mergeWithRegistry(
  pages: DossierPage[],
  docs: ParcelDocumentMeta[]
): DossierPage[]
```

### Backend — `backend/app/documents/type_registry.py`

Python mirror of the same mapping. Used by `get_checklist_status()`.

```python
DOC_TYPE_TO_SLOT: dict[str, str] = {
    # identical to frontend registry — keep in sync
    "vergunningen": "vergunninghistorie",
    "haalbaarheid": "bestemmingscheck",
    # ... all types from frontend registry
}

# Auto-generated
SLOT_TO_DOC_TYPES: dict[str, list[str]] = build_reverse_map(DOC_TYPE_TO_SLOT)
```

Both files must stay in sync. Document type changes always require updating both. This is acceptable because type additions are rare and always require code changes elsewhere anyway.

## Frontend Changes

### `mergeWithRegistry()` replaces `mergeDocuments()`

Both `BronnenLayer.tsx` and `FavoriteParcelWorkspaceView.tsx` import `mergeWithRegistry` from the registry module. Their local `mergeDocuments()` functions are deleted.

`buildPages()` stays component-specific — each takes different data shapes (`parcel` vs `favorite`). Only the merge step is unified.

### View button added to dossier card document list

Current buttons per document in a slot: download + delete.  
After fix: **view (eye icon → PDFViewerModal)** + download + delete.

Matches the checklist UX. `PDFViewerModal` is already used in `S8VergunningChecklist` — import and reuse the same component. Applies to both `BronnenLayer` and `FavoriteParcelWorkspaceView`.

Implementation: same pattern as checklist's `handleView()` — fetch authenticated URL, pass to `PDFViewerModal` state.

### `S8VergunningChecklist.tsx`

No UI changes. Backend fix (below) makes the existing view/download buttons work for dossier-uploaded docs automatically.

## Backend Changes

### `documents_service.py` — `get_checklist_status()` fix

**Change 1 — Scope: user → org**

```python
# Before
ParcelDocument.uploaded_by_user_id == user_id,

# After
ParcelDocument.organization_id == organization_id,
```

Colleagues in the same org see each other's checklist documents. Matches `list_documents()` semantics.

**Change 2 — Type expansion via registry**

```python
from app.documents.type_registry import SLOT_TO_DOC_TYPES

# For each checklist item, query all doc_types that map to its slot
# e.g. vergunningen slot → query ['vergunningen', 'vergunninghistorie']
expanded_types = set()
for checklist_type in CHECKLIST_DOC_CONFIGS:
    slot = DOC_TYPE_TO_SLOT.get(checklist_type, checklist_type)
    expanded_types.update(SLOT_TO_DOC_TYPES.get(slot, [checklist_type]))

query = query.where(ParcelDocument.document_type.in_(expanded_types))
```

When a user uploads `vergunninghistorie` in the dossier, it satisfies the `vergunningen` checklist item.

**What does NOT change:**
- `list_documents()` — already org-scoped, no changes needed
- `store_document()` — unchanged
- DB schema — no migration
- All existing endpoints — no changes

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/lib/documents/typeRegistry.ts` | NEW — registry + `mergeWithRegistry()` |
| `frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx` | Use `mergeWithRegistry`, add view-button |
| `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` | Use `mergeWithRegistry`, add view-button |
| `frontend/src/components/reports/sections/S8VergunningChecklist.tsx` | No changes |
| `backend/app/documents/type_registry.py` | NEW — Python mirror of registry |
| `backend/app/documents/documents_service.py` | Org-scope + type expansion in `get_checklist_status()` |

## Success Criteria

1. A checklist-generated PDF (`vergunningen`, `haalbaarheid`, etc.) appears in the correct dossier slot in both Dossiers tab and Portfolio workspace
2. A file uploaded via the Dossiers tab appears in the checklist status for the matching item
3. A file uploaded via Portfolio workspace appears in the Dossiers tab and checklist
4. View button opens PDFViewerModal for any document in a dossier slot
5. Upload history visible per slot (multiple docs, newest first)
6. Download button works for all doc types including checklist-generated
7. `get_checklist_status()` returns org-scoped results — colleague-uploaded docs are visible
