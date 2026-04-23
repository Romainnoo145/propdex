# Document Unified Linking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One document uploaded or generated in any surface (Dossiers tab, Portfolio workspace, Checklist) is immediately visible in all surfaces for that parcel.

**Architecture:** A type registry maps every `document_type` to its canonical dossier slot. `mergeWithRegistry()` replaces the duplicate `mergeDocuments()` in both frontend components. The backend `get_checklist_status()` becomes org-scoped and expands its query to include dossier-compatible aliases. No DB migration required — all documents already share `parcel_documents`.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.x, TypeScript 5.9, React, TanStack Query

---

## File Map

| File | Change |
|------|--------|
| `backend/app/documents/type_registry.py` | NEW — DOC_TYPE_TO_SLOT + SLOT_TO_DOC_TYPES |
| `backend/tests/unit/test_type_registry.py` | NEW — unit tests for registry |
| `backend/app/documents/documents_service.py` | MODIFY — get_checklist_status org-scope + type expansion |
| `backend/app/documents/router.py` | MODIFY — pass organization_id to get_checklist_status |
| `backend/tests/integration/test_checklist_status_org_scoped.py` | NEW — integration test |
| `frontend/src/lib/documents/typeRegistry.ts` | NEW — registry + mergeWithRegistry |
| `frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx` | MODIFY — use registry, add view button |
| `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` | MODIFY — use registry |

---

## Task 1: Backend type registry

**Files:**
- Create: `backend/app/documents/type_registry.py`

- [ ] **Step 1: Create the registry file**

```python
"""Document type → dossier slot mapping. Single source of truth for all surfaces."""

from __future__ import annotations


def _build_reverse(mapping: dict[str, str]) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for doc_type, slot in mapping.items():
        result.setdefault(slot, []).append(doc_type)
    return result


# Maps every document_type (dossier upload OR checklist-generated) to its
# canonical dossier slot key. Unknown types fall back to 'documenten'.
DOC_TYPE_TO_SLOT: dict[str, str] = {
    # dossier upload types — self-mapping
    "bestemmingscheck":   "bestemmingscheck",
    "perceeldata":        "perceeldata",
    "vergunninghistorie": "vergunninghistorie",
    "woz":                "woz",
    "quickscan":          "quickscan",
    "bodem":              "bodem",
    "fundering":          "fundering",
    "asbest":             "asbest",
    "bouwkundig":         "bouwkundig",
    "energielabel":       "energielabel",
    "bestemmingsplan":    "bestemmingsplan",
    "milieuzones":        "milieuzones",
    "geluid":             "geluid",
    "stikstof":           "stikstof",
    "kadaster":           "kadaster",
    "eigendom":           "eigendom",
    "erfpacht":           "erfpacht",
    "documenten":         "documenten",
    "correspondentie":    "correspondentie",
    "ideeen":             "ideeen",
    "checklist":          "documenten",
    # checklist-generated types — cross-mapping to dossier slot
    "vergunningen":       "vergunninghistorie",
    "haalbaarheid":       "bestemmingscheck",
    "wkb_precheck":       "bestemmingscheck",
    "risicoprofiel":      "quickscan",
    "monumenten":         "kadaster",
}

# Auto-generated reverse: slot → all doc_types that land there
SLOT_TO_DOC_TYPES: dict[str, list[str]] = _build_reverse(DOC_TYPE_TO_SLOT)

FALLBACK_SLOT = "documenten"


def slot_for_type(doc_type: str) -> str:
    """Return the canonical dossier slot for a document_type. Unknown → 'documenten'."""
    return DOC_TYPE_TO_SLOT.get(doc_type, FALLBACK_SLOT)


def types_for_slot(slot: str) -> list[str]:
    """Return all document_types that map to a given slot."""
    return SLOT_TO_DOC_TYPES.get(slot, [slot])
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/documents/type_registry.py
git commit -m "feat(docs): add document type registry — canonical slot mapping"
```

---

## Task 2: Unit tests for type registry

**Files:**
- Create: `backend/tests/unit/test_type_registry.py`

- [ ] **Step 1: Write tests**

```python
"""Unit tests for document type registry."""
from __future__ import annotations

from app.documents.type_registry import (
    DOC_TYPE_TO_SLOT,
    SLOT_TO_DOC_TYPES,
    FALLBACK_SLOT,
    slot_for_type,
    types_for_slot,
)


def test_all_dossier_slot_types_self_map():
    """Every dossier upload type maps to itself."""
    self_mapped = [
        "bestemmingscheck", "perceeldata", "vergunninghistorie", "woz", "quickscan",
        "bodem", "fundering", "asbest", "bouwkundig", "energielabel",
        "bestemmingsplan", "milieuzones", "geluid", "stikstof",
        "kadaster", "eigendom", "erfpacht", "documenten", "correspondentie", "ideeen",
    ]
    for t in self_mapped:
        assert DOC_TYPE_TO_SLOT[t] == t, f"{t} should self-map but maps to {DOC_TYPE_TO_SLOT[t]}"


def test_cross_mappings():
    """Checklist-generated types map to the correct dossier slot."""
    assert slot_for_type("vergunningen") == "vergunninghistorie"
    assert slot_for_type("haalbaarheid") == "bestemmingscheck"
    assert slot_for_type("wkb_precheck") == "bestemmingscheck"
    assert slot_for_type("risicoprofiel") == "quickscan"
    assert slot_for_type("monumenten") == "kadaster"
    assert slot_for_type("checklist") == "documenten"


def test_unknown_type_falls_back_to_documenten():
    assert slot_for_type("onbekend_type_xyz") == FALLBACK_SLOT


def test_reverse_map_covers_all_slots():
    """Every value in DOC_TYPE_TO_SLOT appears as a key in SLOT_TO_DOC_TYPES."""
    all_slots = set(DOC_TYPE_TO_SLOT.values())
    for slot in all_slots:
        assert slot in SLOT_TO_DOC_TYPES, f"slot '{slot}' missing from reverse map"


def test_reverse_map_includes_cross_types():
    """vergunninghistorie slot includes both 'vergunninghistorie' and 'vergunningen'."""
    types = types_for_slot("vergunninghistorie")
    assert "vergunninghistorie" in types
    assert "vergunningen" in types

    types = types_for_slot("bestemmingscheck")
    assert "bestemmingscheck" in types
    assert "haalbaarheid" in types
    assert "wkb_precheck" in types


def test_reverse_map_no_duplicates_per_slot():
    """No duplicate doc_types within a slot."""
    for slot, types in SLOT_TO_DOC_TYPES.items():
        assert len(types) == len(set(types)), f"duplicates in slot '{slot}': {types}"
```

- [ ] **Step 2: Run tests**

```bash
cd backend && python -m pytest tests/unit/test_type_registry.py -v
```

Expected: 6 tests PASSED

- [ ] **Step 3: Commit**

```bash
git add backend/tests/unit/test_type_registry.py
git commit -m "test(docs): unit tests for document type registry"
```

---

## Task 3: Update `get_checklist_status()` — org-scope + type expansion

**Files:**
- Modify: `backend/app/documents/documents_service.py` (function `get_checklist_status`, ~line 243)
- Modify: `backend/app/documents/router.py` (line 87)

- [ ] **Step 1: Update `get_checklist_status` signature and query**

In `backend/app/documents/documents_service.py`, replace the entire `get_checklist_status` function.

The signature gains `organization_id` for the main query scope. `user_id` is kept for lazy generation — it still needs a user context to find the saved report.

```python
async def get_checklist_status(
    parcel_id: str,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> ChecklistStatusResponse:
    """Get checklist completion status for a parcel.

    Org-scoped: all members of the organization see the same document status.
    Type expansion: dossier-uploaded docs satisfy matching checklist items via
    the type registry (e.g. 'vergunninghistorie' counts as 'vergunningen').
    Lazy generation still uses user_id to find the saved report for this user.
    """
    from app.documents.type_registry import SLOT_TO_DOC_TYPES, slot_for_type
    from app.reports.checklist_pdf import CHECKLIST_DOC_CONFIGS

    # Expand query types: for each checklist doc type, include all doc_types
    # that map to the same dossier slot (catches dossier-uploaded equivalents).
    expanded_types: set[str] = set()
    for checklist_type in CHECKLIST_DOC_CONFIGS:
        slot = slot_for_type(checklist_type)
        expanded_types.update(SLOT_TO_DOC_TYPES.get(slot, [checklist_type]))

    query = (
        select(ParcelDocument)
        .options(defer(ParcelDocument.file_data))
        .where(
            ParcelDocument.organization_id == organization_id,
            ParcelDocument.parcel_id == parcel_id,
            ParcelDocument.document_type.in_(expanded_types),
        )
    )
    result = await db.execute(query)
    docs = list(result.scalars().all())

    # Lazy generation from saved report (user_id scoped — report belongs to user)
    if not docs:
        try:
            from app.reports import service as report_service
            from app.reports.checklist_orchestrator import generate_checklist_documents

            report = await report_service.get_report_by_source_parcel(
                parcel_id=parcel_id, user_id=user_id, session=db,
            )
            if report and report.report_data:
                gen_result = await generate_checklist_documents(
                    report_data=report.report_data,
                    report_name=report.report_name,
                    parcel_id=parcel_id,
                    user_id=user_id,
                    db=db,
                )
                await db.commit()
                logger.info(
                    "Lazy-generated checklist docs for parcel=%s: generated=%d",
                    parcel_id, len(gen_result.generated),
                )
                result = await db.execute(query)
                docs = list(result.scalars().all())
        except Exception:
            logger.warning("Lazy checklist generation failed for parcel=%s", parcel_id, exc_info=True)

    # Build slot → best doc mapping using registry
    doc_by_slot: dict[str, ParcelDocument] = {}
    for doc in docs:
        slot = slot_for_type(doc.document_type)
        if slot not in doc_by_slot:
            doc_by_slot[slot] = doc

    # Map slot back to checklist item IDs
    items: dict[str, ChecklistItemStatus] = {}
    for checklist_type, config in CHECKLIST_DOC_CONFIGS.items():
        slot = slot_for_type(checklist_type)
        doc = doc_by_slot.get(slot)
        for item_id in config.checklist_item_ids:
            if doc:
                items[item_id] = ChecklistItemStatus(
                    status="generated",
                    document_id=doc.id,
                    document_type=doc.document_type,
                    filename=doc.filename,
                )
            elif item_id not in items:
                items[item_id] = ChecklistItemStatus(status="pending")

    generated_count = sum(1 for v in items.values() if v.status == "generated")
    return ChecklistStatusResponse(
        parcel_id=parcel_id,
        items=items,
        generated_count=generated_count,
        total_count=len(items),
    )
```

- [ ] **Step 2: Update router to pass both organization_id and user_id**

In `backend/app/documents/router.py`, line 87, change:

```python
# Before
return await svc.get_checklist_status(parcel_id, current_user.id, db)

# After
return await svc.get_checklist_status(
    parcel_id, current_user.organization_id, current_user.id, db
)
```

- [ ] **Step 3: Run ruff + mypy**

```bash
cd backend && ruff check app/documents/documents_service.py app/documents/router.py && mypy app/documents/documents_service.py app/documents/router.py
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/app/documents/documents_service.py backend/app/documents/router.py
git commit -m "feat(docs): org-scope checklist status + type registry expansion"
```

---

## Task 4: Integration test for org-scoped checklist status

**Files:**
- Create: `backend/tests/integration/test_checklist_status_org_scoped.py`

- [ ] **Step 1: Write integration test**

```python
"""Integration tests: checklist status is org-scoped and resolves dossier-type aliases."""
from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_checklist_status_sees_dossier_uploaded_doc(
    async_client: AsyncClient,
    auth_headers: dict,
    test_parcel_id: str,
):
    """A doc uploaded as 'vergunninghistorie' satisfies the 'vergunningen' checklist item."""
    # Upload a dossier-type doc
    import io
    content = b"%PDF-1.4 fake pdf content for test"
    files = {"file": ("test.pdf", io.BytesIO(content), "application/pdf")}
    resp = await async_client.post(
        f"/api/documents/{test_parcel_id}/documents",
        params={"document_type": "vergunninghistorie"},
        files=files,
        headers=auth_headers,
    )
    assert resp.status_code == 200

    # Check checklist status — vergunningen items should now be 'generated'
    status_resp = await async_client.get(
        f"/api/documents/{test_parcel_id}/checklist-status",
        headers=auth_headers,
    )
    assert status_resp.status_code == 200
    data = status_resp.json()

    # opt-11 and nbw-11 are the checklist_item_ids for 'vergunningen' doc type
    assert data["items"]["opt-11"]["status"] == "generated"
    assert data["items"]["nbw-11"]["status"] == "generated"
    assert data["items"]["opt-11"]["document_type"] == "vergunninghistorie"


@pytest.mark.anyio
async def test_checklist_status_is_org_scoped(
    async_client: AsyncClient,
    auth_headers_user_a: dict,
    auth_headers_user_b: dict,
    test_parcel_id: str,
):
    """Doc uploaded by user A is visible in checklist status for user B (same org)."""
    import io
    content = b"%PDF-1.4 fake"
    files = {"file": ("bodem.pdf", io.BytesIO(content), "application/pdf")}
    resp = await async_client.post(
        f"/api/documents/{test_parcel_id}/documents",
        params={"document_type": "bodem"},
        files=files,
        headers=auth_headers_user_a,
    )
    assert resp.status_code == 200

    # User B should see bodem as generated
    status_resp = await async_client.get(
        f"/api/documents/{test_parcel_id}/checklist-status",
        headers=auth_headers_user_b,
    )
    assert status_resp.status_code == 200
    data = status_resp.json()
    # tra-06 and nbw-06 are checklist_item_ids for 'bodem' doc type
    assert data["items"]["tra-06"]["status"] == "generated"
```

> Note: `auth_headers_user_a`, `auth_headers_user_b`, and `test_parcel_id` fixtures must exist in conftest.py. If they don't exist yet, check `backend/tests/conftest.py` — add minimal fixtures as needed following the existing fixture pattern in the file.

- [ ] **Step 2: Run test**

```bash
cd backend && python -m pytest tests/integration/test_checklist_status_org_scoped.py -v
```

Expected: both tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/tests/integration/test_checklist_status_org_scoped.py
git commit -m "test(docs): integration tests for org-scoped checklist status + alias resolution"
```

---

## Task 5: Frontend type registry + mergeWithRegistry

**Files:**
- Create: `frontend/src/lib/documents/typeRegistry.ts`

- [ ] **Step 1: Create the registry file**

```typescript
/**
 * Document type registry — single source of truth for all surfaces.
 *
 * Maps every document_type (dossier upload OR checklist-generated) to its
 * canonical dossier slot key. Must stay in sync with
 * backend/app/documents/type_registry.py.
 */

import type { ParcelDocumentMeta } from '@/lib/types/document'

// Minimal shape required by mergeWithRegistry — both DossierCard interfaces satisfy this.
interface SlottableCard {
  key: string
  filled: boolean
  value: string
  documents: ParcelDocumentMeta[]
}

interface SlottablePage {
  cards: SlottableCard[]
}

/** Maps every document_type to its canonical dossier slot key. */
export const DOC_TYPE_TO_SLOT: Record<string, string> = {
  // dossier upload types — self-mapping
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
  // checklist-generated types — cross-mapping
  vergunningen:       'vergunninghistorie',
  haalbaarheid:       'bestemmingscheck',
  wkb_precheck:       'bestemmingscheck',
  risicoprofiel:      'quickscan',
  monumenten:         'kadaster',
}

const FALLBACK_SLOT = 'documenten'

function buildReverseMap(mapping: Record<string, string>): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [docType, slot] of Object.entries(mapping)) {
    if (!result[slot]) result[slot] = []
    result[slot].push(docType)
  }
  return result
}

/** Reverse map: slot → all document_types that land there. */
export const SLOT_TO_DOC_TYPES: Record<string, string[]> = buildReverseMap(DOC_TYPE_TO_SLOT)

/**
 * Replaces mergeDocuments() in BronnenLayer and FavoriteParcelWorkspaceView.
 *
 * Routes each document to its canonical slot via DOC_TYPE_TO_SLOT.
 * Unknown types fall back to 'documenten'. Updates filled + value label.
 */
export function mergeWithRegistry<P extends SlottablePage>(
  pages: P[],
  docs: ParcelDocumentMeta[],
): P[] {
  const bySlot: Record<string, ParcelDocumentMeta[]> = {}

  for (const doc of docs) {
    const slot = DOC_TYPE_TO_SLOT[doc.document_type] ?? FALLBACK_SLOT
    if (!bySlot[slot]) bySlot[slot] = []
    bySlot[slot].push(doc)
  }

  return pages.map((page) => ({
    ...page,
    cards: page.cards.map((card) => {
      const slotDocs = bySlot[card.key] ?? []
      if (slotDocs.length === 0) return card
      return {
        ...card,
        filled: true,
        value:
          card.value === 'LEEG'
            ? `${slotDocs.length} BESTAND${slotDocs.length > 1 ? 'EN' : ''}`
            : card.value,
        documents: slotDocs,
      }
    }),
  }))
}
```

- [ ] **Step 2: Run type-check**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | grep -i "typeRegistry\|error" | head -20
```

Expected: no errors for the new file

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/documents/typeRegistry.ts
git commit -m "feat(docs): add frontend document type registry + mergeWithRegistry"
```

---

## Task 6: Update BronnenLayer — use registry + add view button

**Files:**
- Modify: `frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx`

- [ ] **Step 1: Add registry import, remove mergeDocuments**

At the top of `BronnenLayer.tsx`, add to imports:
```typescript
import { mergeWithRegistry } from '@/lib/documents/typeRegistry'
import { PDFViewerModal } from '@/components/ui/PDFViewerModal'
import { Eye } from 'lucide-react'
```

Delete the entire `mergeDocuments` function (lines ~344–367). It is now replaced by the imported `mergeWithRegistry`.

- [ ] **Step 2: Add `onView` to DropzoneCardProps**

Find `interface DropzoneCardProps` (~line 375). Add `onView` alongside `onDownload`:

```typescript
interface DropzoneCardProps {
  card: DossierCard
  uploadingKey: string | null
  onUploadClick: (cardKey: string) => void
  onFileDrop: (cardKey: string, file: File) => void
  onDelete: (documentId: string) => void
  onDownload: (documentId: string, filename: string) => void
  onView: (documentId: string, filename: string) => void   // ADD THIS LINE
}
```

Destructure it in the function signature:
```typescript
function DropzoneCard({
  card,
  uploadingKey,
  onUploadClick,
  onFileDrop,
  onDelete,
  onDownload,
  onView,           // ADD THIS LINE
}: DropzoneCardProps) {
```

- [ ] **Step 3: Add Eye button to docFileList**

Find the `docFileList` function inside `DropzoneCard` (~line 433). In the `visible.map((doc) => ...)` section, add the Eye button BEFORE the existing download button:

```tsx
{/* Eye — view in PDF modal */}
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onView(doc.id, doc.filename) }}
  className={`shrink-0 transition-colors hover:text-amber-400 ${isDark ? 'text-white/30' : 'text-slate-300'}`}
  title="Bekijken"
>
  <Eye className="size-3" />
</button>
{/* Download */}
<button
  type="button"
  onClick={(e) => { e.stopPropagation(); onDownload(doc.id, doc.filename) }}
  ...existing props...
>
  <Download className="size-3" />
</button>
```

- [ ] **Step 4: Add PDF viewer state + handleView at component level**

Find where `const handleDownload = useCallback(` is defined (~line 774). Add directly after the `handleDownload` callback:

```typescript
const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null)

const handleView = useCallback(
  (documentId: string, filename: string) => {
    setPdfViewer({
      url: getDocumentDownloadUrl(documentParcelId, documentId),
      title: filename,
    })
  },
  [documentParcelId],
)
```

- [ ] **Step 5: Pass onView to DropzoneCard render site**

Find where `<DropzoneCard` is rendered (~line 871). Add the prop:

```tsx
<DropzoneCard
  key={card.key}
  card={card}
  uploadingKey={uploadingKey}
  onUploadClick={handleUploadClick}
  onFileDrop={handleFileDrop}
  onDelete={handleDelete}
  onDownload={handleDownload}
  onView={handleView}     // ADD THIS LINE
/>
```

- [ ] **Step 6: Add PDFViewerModal render**

Find the closing `</div>` of the component's return statement (just before the final `}`). Add before it:

```tsx
{pdfViewer && (
  <PDFViewerModal
    url={pdfViewer.url}
    title={pdfViewer.title}
    onClose={() => setPdfViewer(null)}
  />
)}
```

- [ ] **Step 7: Replace mergeDocuments call with mergeWithRegistry**

Find (~line 708):
```typescript
const pages = mergeDocuments(rawPages, userDocs)
```

Replace with:
```typescript
const pages = mergeWithRegistry(rawPages, userDocs)
```

- [ ] **Step 8: Run type-check**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | grep "BronnenLayer\|error TS" | head -20
```

Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx
git commit -m "feat(docs): use registry merge + add view button to dossier cards"
```

---

## Task 7: Update FavoriteParcelWorkspaceView — use registry

**Files:**
- Modify: `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx`

> Note: This file already has `onView`, `handleView`, and `PDFViewerModal` wired up. Only the merge function needs replacing.

- [ ] **Step 1: Add registry import, remove local mergeDocuments**

Add to imports:
```typescript
import { mergeWithRegistry } from '@/lib/documents/typeRegistry'
```

Delete the entire local `mergeDocuments` function (~lines 395–421). It is replaced by the import.

- [ ] **Step 2: Replace mergeDocuments call with mergeWithRegistry**

Find (~line 1396):
```typescript
const pages = useMemo(() => mergeDocuments(rawPages, userDocs), [rawPages, userDocs])
```

Replace with:
```typescript
const pages = useMemo(() => mergeWithRegistry(rawPages, userDocs), [rawPages, userDocs])
```

- [ ] **Step 3: Run type-check**

```bash
cd frontend && npx tsc -b --noEmit 2>&1 | grep "FavoriteParcel\|error TS" | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx
git commit -m "feat(docs): use registry merge in portfolio workspace view"
```

---

## Task 8: Full validation

- [ ] **Step 1: Backend — full test suite**

```bash
cd backend && python -m pytest tests/unit/test_type_registry.py tests/integration/test_checklist_status_org_scoped.py -v
```

Expected: all tests PASS

- [ ] **Step 2: Frontend — full check**

```bash
cd frontend && npm run check
```

Expected: 0 errors, 0 warnings

- [ ] **Step 3: Backend — ruff + mypy**

```bash
cd backend && ruff check app/documents/ && mypy app/documents/
```

Expected: no issues

- [ ] **Step 4: Final commit if any lint fixes were needed**

```bash
git add -p  # stage only lint fixes
git commit -m "chore: fix lint issues after document registry integration"
```
