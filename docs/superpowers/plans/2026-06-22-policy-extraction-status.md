# Policy Extraction Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the data-bronnen status pill and the AI-content cards (data-bronnen + report) reflect the **cascade extraction** — the single document read that already powers scoring — and stop the redundant `document_summary_job` that costs a second AI call and produced the broken `ai_summary`.

**Architecture:** A policy document is read for AI exactly once — by the cascade extraction (`extract_factor`), cached in `factor_extraction_cache` keyed by `(DOCUMENT_SENTINEL, policy_document_id, factor_id, SCHEMA_VERSION)`. We add a computed `extraction_status` + the extracted `extraction` payload to the policy-doc API, point the frontend pill and AI-content cards at it, and remove the `document_summary_job` enqueue. The legacy `ai_summary` column is left in place (nullable) but no longer written or read in the UI.

**Tech Stack:** FastAPI + SQLAlchemy 2.x (async) + Pydantic v2; React + TanStack Query + Tailwind; pytest (async, httpx ASGITransport); vitest.

## Global Constraints

- `SCHEMA_VERSION` lives in `app/ai/factor_extraction_schemas.py` (currently `6`). Always read it from there — never hardcode the integer.
- `DOCUMENT_SENTINEL = "__document__"` (`app/ai/factor_extraction_schemas.py:124`) is the `parcel_id` for document-level extraction-cache rows.
- Cascade source_key → factor_id map (the only docs that get extracted):
  `woonvisie→woonvisie_match`, `omgevingsvisie→beleidsalignement`, `huisvestingsverordening→splitsingsrisico`, `grondprijsbeleid→grondwaarde_fit`, `parkeerbeleid→parkeerdruk`.
- Multi-tenant: cascade policy docs are vendor-global (`is_global=true`); the extraction-cache query filters by `policy_document_id` (already org-safe via the doc).
- No new AI calls anywhere in this plan — we only READ the existing extraction cache.
- Backend transactions: direct `db.add()/flush()/commit()` (NOT `async with db.begin()`). Datetimes: `datetime.utcnow()`.
- Validation per change: `cd backend && uv run ruff check . && uv run mypy .`; `cd frontend && npm run check`.

---

## File Structure

**Backend (create):**
- `backend/app/policy_documents/extraction_status.py` — the `source_key→factor_id` map + `get_extraction_map()` service.
- `backend/tests/integration/test_policy_extraction_status.py` — tests for the service + endpoint fields.

**Backend (modify):**
- `backend/app/policy_documents/schemas.py` — add `extraction_status` + `extraction` to `PolicyDocumentResponse`.
- `backend/app/documents/bundle_schemas.py` — add the same to `PolicyDocumentRead`.
- `backend/app/policy_documents/router.py` — enrich both list endpoints (`/{entityType}/{entityCode}` and `/cascade/{gemeente_code}`) with extraction data.
- `backend/app/policy_documents/service.py` — repoint `get_summaries()` from `ai_summary` to the extraction payload.
- `backend/app/policy_documents/upload_enqueue.py` — drop the `document_summary_job` enqueue.
- `backend/app/jobs/auto_ingest_job.py` — drop the per-doc `document_summary_job` enqueue.

**Frontend (modify):**
- `frontend/src/hooks/usePolicyDocuments.ts` — add `extraction_status` + `extraction` to `PolicyDocument`; add an `Extraction` type.
- `frontend/src/components/configuratie/DocumentListItem.tsx` — pill reads `extraction_status`.
- `frontend/src/components/configuratie/DocumentSourceDetailView.tsx` + `AiSummaryCard.tsx` — render cascade `randvoorwaarden` from `extraction` instead of parsing `ai_summary`.
- `frontend/src/hooks/usePolicySummaries.ts` + `frontend/src/components/reports/components/PolicyInsightCard.tsx` — report "Gemeentelijk beleid" card renders cascade randvoorwaarden.

**Reuse (do not recreate):** `RandvoorwaardenSection` + `Randvoorwaarde` type (defined for `WoonvisiePopup.tsx`) for rendering randvoorwaarden lists.

---

## Phase 1 — Backend: extraction-status service

### Task 1: `source_key→factor` map + extraction-cache lookup service

**Files:**
- Create: `backend/app/policy_documents/extraction_status.py`
- Test: `backend/tests/integration/test_policy_extraction_status.py`

**Interfaces:**
- Produces:
  - `CASCADE_SOURCE_FACTORS: dict[str, str]` — source_key → factor_id.
  - `class ExtractionInfo(TypedDict)`: `{"status": str, "extraction": dict | None}` where status ∈ `{"parsed","pending","nvt"}`.
  - `async def get_extraction_map(db: AsyncSession, docs: list[tuple[uuid.UUID, str]]) -> dict[uuid.UUID, ExtractionInfo]` — input is `(doc_id, source_key)` pairs; returns one entry per doc_id.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/integration/test_policy_extraction_status.py
import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.policy_document import PolicyDocument
from app.policy_documents.extraction_status import get_extraction_map


def _doc(source_key: str, org_id: uuid.UUID, user_id: uuid.UUID) -> PolicyDocument:
    return PolicyDocument(
        entity_type="gemeente", entity_code="GM0983", source_key=source_key,
        filename=f"{source_key}.pdf", content_type="application/pdf",
        file_data=b"x", file_size=1, uploaded_by_user_id=user_id,
        organization_id=org_id, is_global=True, version_number=1, status="uploaded",
    )


@pytest.mark.asyncio
async def test_parsed_when_cache_has_payload(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-hit@example.com", org_name="Hit")
    doc = _doc("woonvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION,
        extracted_payload={"randvoorwaarden": [{"titel": "T", "samenvatting": "S"}]},
    ))
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "woonvisie")])
    assert result[doc.id]["status"] == "parsed"
    assert result[doc.id]["extraction"]["randvoorwaarden"][0]["titel"] == "T"


@pytest.mark.asyncio
async def test_pending_when_cascade_doc_without_cache(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-pending@example.com", org_name="Pend")
    doc = _doc("omgevingsvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "omgevingsvisie")])
    assert result[doc.id]["status"] == "pending"
    assert result[doc.id]["extraction"] is None


@pytest.mark.asyncio
async def test_nvt_when_not_a_cascade_source(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-nvt@example.com", org_name="Nvt")
    doc = _doc("welstandsnota", org.id, user.id)  # not in CASCADE_SOURCE_FACTORS
    test_db.add(doc)
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "welstandsnota")])
    assert result[doc.id]["status"] == "nvt"


@pytest.mark.asyncio
async def test_stale_schema_version_is_not_parsed(test_db: AsyncSession, create_test_user):
    user, org = await create_test_user(email="extract-stale@example.com", org_name="Stale")
    doc = _doc("woonvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION - 1,  # stale
        extracted_payload={"randvoorwaarden": []},
    ))
    await test_db.commit()

    result = await get_extraction_map(test_db, [(doc.id, "woonvisie")])
    assert result[doc.id]["status"] == "pending"  # current-schema row absent
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/integration/test_policy_extraction_status.py -q`
Expected: FAIL — `ModuleNotFoundError: app.policy_documents.extraction_status`.

- [ ] **Step 3: Write the service**

```python
# backend/app/policy_documents/extraction_status.py
"""Compute a document's extraction status from the cascade extraction cache.

The cascade extraction (extract_factor) reads a policy PDF once and caches the
typed payload in factor_extraction_cache, keyed by
(DOCUMENT_SENTINEL, policy_document_id, factor_id, SCHEMA_VERSION). This module
turns that into a per-document {status, extraction} for the API — no AI calls.
"""

import uuid
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache

# source_key -> factor_id. Only these source_keys are cascade-extracted; any
# other source_key has no extraction and reports status "nvt".
CASCADE_SOURCE_FACTORS: dict[str, str] = {
    "woonvisie": "woonvisie_match",
    "omgevingsvisie": "beleidsalignement",
    "huisvestingsverordening": "splitsingsrisico",
    "grondprijsbeleid": "grondwaarde_fit",
    "parkeerbeleid": "parkeerdruk",
}


class ExtractionInfo(TypedDict):
    status: str  # "parsed" | "pending" | "nvt"
    extraction: dict | None


async def get_extraction_map(
    db: AsyncSession,
    docs: list[tuple[uuid.UUID, str]],
) -> dict[uuid.UUID, ExtractionInfo]:
    """Return {doc_id: {status, extraction}} for the given (doc_id, source_key) pairs."""
    cascade_ids = [doc_id for doc_id, sk in docs if sk in CASCADE_SOURCE_FACTORS]

    cache: dict[uuid.UUID, dict] = {}
    if cascade_ids:
        rows = (
            await db.execute(
                select(
                    FactorExtractionCache.policy_document_id,
                    FactorExtractionCache.extracted_payload,
                ).where(
                    FactorExtractionCache.parcel_id == DOCUMENT_SENTINEL,
                    FactorExtractionCache.schema_version == SCHEMA_VERSION,
                    FactorExtractionCache.policy_document_id.in_(cascade_ids),
                )
            )
        ).all()
        for doc_id, payload in rows:
            if payload is not None:
                cache[doc_id] = payload

    out: dict[uuid.UUID, ExtractionInfo] = {}
    for doc_id, source_key in docs:
        if source_key not in CASCADE_SOURCE_FACTORS:
            out[doc_id] = {"status": "nvt", "extraction": None}
        elif doc_id in cache:
            out[doc_id] = {"status": "parsed", "extraction": cache[doc_id]}
        else:
            out[doc_id] = {"status": "pending", "extraction": None}
    return out
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/integration/test_policy_extraction_status.py -q`
Expected: PASS (4 passed).

- [ ] **Step 5: Lint + type-check**

Run: `cd backend && uv run ruff check app/policy_documents/extraction_status.py && uv run mypy app/policy_documents/extraction_status.py`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add backend/app/policy_documents/extraction_status.py backend/tests/integration/test_policy_extraction_status.py
git commit -m "feat(policy): extraction-status service from cascade cache"
```

---

### Task 2: Expose `extraction_status` + `extraction` on the policy-doc API

**Files:**
- Modify: `backend/app/policy_documents/schemas.py` (PolicyDocumentResponse)
- Modify: `backend/app/documents/bundle_schemas.py` (PolicyDocumentRead)
- Modify: `backend/app/policy_documents/router.py` (both list endpoints)
- Test: `backend/tests/integration/test_policy_extraction_status.py` (append endpoint test)

**Interfaces:**
- Consumes: `get_extraction_map` (Task 1).
- Produces: API responses carry `extraction_status: str` and `extraction: dict | None`.

- [ ] **Step 1: Write the failing endpoint test** (append to the Task-1 test file)

```python
from httpx import AsyncClient
from app.auth.jwt import create_access_token
from app.models.factor_extraction_cache import FactorExtractionCache  # already imported


@pytest.mark.asyncio
async def test_list_endpoint_includes_extraction_status(
    async_client: AsyncClient, test_db: AsyncSession, create_test_user
):
    user, org = await create_test_user(email="extract-api@example.com", org_name="Api")
    headers = {"Authorization": f"Bearer {create_access_token(str(user.id), str(org.id))}"}
    doc = _doc("woonvisie", org.id, user.id)
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION,
        extracted_payload={"randvoorwaarden": [{"titel": "T", "samenvatting": "S"}]},
    ))
    await test_db.commit()

    resp = await async_client.get("/api/policy-documents/gemeente/GM0983", headers=headers)
    assert resp.status_code == 200
    doc_json = next(d for d in resp.json()["documents"] if d["source_key"] == "woonvisie")
    assert doc_json["extraction_status"] == "parsed"
    assert doc_json["extraction"]["randvoorwaarden"][0]["titel"] == "T"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && uv run pytest tests/integration/test_policy_extraction_status.py::test_list_endpoint_includes_extraction_status -q`
Expected: FAIL — `KeyError: 'extraction_status'`.

- [ ] **Step 3: Add fields to the schemas**

In `backend/app/policy_documents/schemas.py`, add to `PolicyDocumentResponse` (after `ai_summary`):

```python
    ai_summary: str | None = None
    extraction_status: str = "nvt"  # parsed | pending | nvt (from cascade cache)
    extraction: dict | None = None  # latest cascade extracted_payload, or None
```

In `backend/app/documents/bundle_schemas.py`, add to `PolicyDocumentRead` (after `ai_summary`):

```python
    ai_summary: str | None = None
    extraction_status: str = "nvt"
    extraction: dict | None = None
```

- [ ] **Step 4: Enrich the two list endpoints in `router.py`**

Find the list endpoint that returns `PolicyDocumentListResponse` (the `/{entity_type}/{entity_code}` handler, around `list_policy_documents`). After the documents are loaded and before building the response, enrich them:

```python
    from app.policy_documents.extraction_status import get_extraction_map

    ext = await get_extraction_map(db, [(d.id, d.source_key) for d in documents])
    responses: list[PolicyDocumentResponse] = []
    for d in documents:
        dto = PolicyDocumentResponse.model_validate(d)
        info = ext[d.id]
        dto.extraction_status = info["status"]
        dto.extraction = info["extraction"]
        responses.append(dto)
    return PolicyDocumentListResponse(documents=responses, total=len(responses))
```

In `get_gemeente_cascade` (the `/cascade/{gemeente_code}` raw-SQL handler), after `rows` are fetched:

```python
    from app.policy_documents.extraction_status import get_extraction_map

    ext = await get_extraction_map(db, [(row["id"], row["source_key"]) for row in rows])
    grouped = CascadePolicyDocs()
    for row in rows:
        dto = PolicyDocumentRead.model_validate(dict(row))
        info = ext[row["id"]]
        dto.extraction_status = info["status"]
        dto.extraction = info["extraction"]
        getattr(grouped, row["entity_type"]).append(dto)
    return grouped
```

- [ ] **Step 5: Run the endpoint test + the full policy suite**

Run: `cd backend && uv run pytest tests/integration/test_policy_extraction_status.py tests/integration/test_m045_policy_documents_defaults.py -q`
Expected: PASS.

- [ ] **Step 6: Lint/type-check + commit**

```bash
cd backend && uv run ruff check app/policy_documents app/documents/bundle_schemas.py && uv run mypy app/policy_documents/router.py
git add backend/app/policy_documents/schemas.py backend/app/documents/bundle_schemas.py backend/app/policy_documents/router.py backend/tests/integration/test_policy_extraction_status.py
git commit -m "feat(policy): surface extraction_status + extraction on list/cascade endpoints"
```

---

## Phase 2 — Backend: stop the redundant summary job

### Task 3: Drop the `document_summary_job` enqueue

**Files:**
- Modify: `backend/app/policy_documents/upload_enqueue.py:37`
- Modify: `backend/app/jobs/auto_ingest_job.py` (per-doc summary enqueue)
- Test: `backend/tests/integration/test_policy_extraction_status.py` (append)

**Interfaces:** none new. After this, no path enqueues `document_summary_job`; `policy_documents.status` stays `uploaded` (the pill no longer reads it).

- [ ] **Step 1: Write the failing test** (the enqueue must NOT happen)

```python
from unittest.mock import AsyncMock
from app.policy_documents.upload_enqueue import enqueue_post_upload_jobs  # adjust to real fn name


@pytest.mark.asyncio
async def test_upload_does_not_enqueue_summary_job():
    pool = AsyncMock()
    await enqueue_post_upload_jobs(arq_pool=pool, document_id=uuid.uuid4(), content_type="application/pdf")
    enqueued = [c.args[0] for c in pool.enqueue_job.await_args_list]
    assert "document_summary_job" not in enqueued
```

> NOTE during execution: open `upload_enqueue.py` first and match the real function name/signature; adjust the import and call above to match before running.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && uv run pytest tests/integration/test_policy_extraction_status.py::test_upload_does_not_enqueue_summary_job -q`
Expected: FAIL — the job is still enqueued.

- [ ] **Step 3: Remove the enqueue**

In `backend/app/policy_documents/upload_enqueue.py`, delete the `await arq_pool.enqueue_job("document_summary_job", str(document_id))` block (and its surrounding try/except + log lines that exist only for it). Update the module docstring line that says "document_summary_job: PDF only, always enqueued".

In `backend/app/jobs/auto_ingest_job.py`, remove the per-stored-doc `enqueue_job("document_summary_job", ...)` loop/line and its docstring mention.

Leave `app/jobs/document_summary.py` and its worker registration in place (dead but harmless; removing the worker wiring is out of scope and risks the worker import graph).

- [ ] **Step 4: Run the test + the auto-ingest tests**

Run: `cd backend && uv run pytest tests/integration/test_policy_extraction_status.py::test_upload_does_not_enqueue_summary_job backend/tests -k "auto_ingest" -q`
Expected: PASS (and no auto-ingest test asserts the summary enqueue; if one does, update it to assert it is NOT enqueued).

- [ ] **Step 5: Commit**

```bash
git add backend/app/policy_documents/upload_enqueue.py backend/app/jobs/auto_ingest_job.py backend/tests/integration/test_policy_extraction_status.py
git commit -m "perf(policy): stop the redundant document_summary_job (read doc once via cascade)"
```

---

## Phase 3 — Backend: report card reads the extraction

### Task 4: Repoint `get_summaries` to cascade randvoorwaarden

**Files:**
- Modify: `backend/app/policy_documents/service.py` (`get_summaries`)
- Modify: `backend/app/policy_documents/schemas.py` (`PolicySummariesResponse`)
- Test: `backend/tests/integration/test_m045_policy_summaries_cascade.py` (extend)

**Interfaces:**
- Produces: `get_summaries()` returns `dict[source_key, list[Randvoorwaarde-dict]]` (was `dict[source_key, str]`). `PolicySummariesResponse.summaries` type changes to `dict[str, list[dict]]`.

> Rationale: the report "Gemeentelijk beleid" card should show the real extracted randvoorwaarden (titel + samenvatting), not the dead `ai_summary`. The extraction cache row per doc holds `randvoorwaarden`.

- [ ] **Step 1: Write the failing test** (append to the cascade-summaries test file)

```python
@pytest.mark.asyncio
async def test_get_summaries_returns_randvoorwaarden_from_extraction(
    test_db: AsyncSession, monkeypatch: pytest.MonkeyPatch
):
    from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL, SCHEMA_VERSION
    from app.models.factor_extraction_cache import FactorExtractionCache

    user, vendor_org = await _make_vendor_user(test_db, email="rv@summaries.example")
    monkeypatch.setattr(settings, "VENDOR_ORG_ID", vendor_org.id)
    doc = _make_policy_doc(
        entity_type="gemeente", entity_code="GM0983", source_key="woonvisie",
        version_number=1, is_global=True, user_id=user.id, org_id=vendor_org.id, ai_summary=None,
    )
    test_db.add(doc)
    await test_db.flush()
    test_db.add(FactorExtractionCache(
        parcel_id=DOCUMENT_SENTINEL, policy_document_id=doc.id,
        factor_id="woonvisie_match", schema_version=SCHEMA_VERSION,
        extracted_payload={"randvoorwaarden": [{"titel": "Sociaal 30%", "samenvatting": "Min 30% sociaal."}]},
    ))
    await test_db.commit()

    result = await get_summaries("gemeente", "GM0983", vendor_org.id, test_db)
    assert result["woonvisie"][0]["titel"] == "Sociaal 30%"
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && uv run pytest tests/integration/test_m045_policy_summaries_cascade.py::test_get_summaries_returns_randvoorwaarden_from_extraction -q`
Expected: FAIL (returns `ai_summary` strings, not randvoorwaarden).

- [ ] **Step 3: Rewrite `get_summaries`**

Replace the `ai_summary`-based body so it: (a) selects the latest doc id per source_key (keep the existing cascade/DISTINCT-ON query but select `id, source_key, entity_type`), (b) calls `get_extraction_map(db, [(id, source_key), ...])`, (c) returns `{source_key: extraction["randvoorwaarden"]}` for docs whose `status == "parsed"` and whose payload has a non-empty `randvoorwaarden` list, applying the same gemeente>provincie>landelijk precedence already in the function. Drop the `ai_summary NOT LIKE '{"error":%'` filter (no longer reads ai_summary). Change the return type to `dict[str, list[dict]]`.

Update `PolicySummariesResponse.summaries` to `dict[str, list[dict]]` and `get_policy_summaries` router handler return accordingly.

- [ ] **Step 4: Run the summaries suite**

Run: `cd backend && uv run pytest tests/integration/test_m045_policy_summaries_cascade.py -q`
Expected: PASS. The two error-payload tests added in PR #17 become obsolete (no ai_summary read) — delete those two tests in this step, since their premise no longer exists.

- [ ] **Step 5: Lint/type-check + commit**

```bash
cd backend && uv run ruff check app/policy_documents/service.py && uv run mypy app/policy_documents/service.py
git add backend/app/policy_documents/service.py backend/app/policy_documents/schemas.py backend/app/policy_documents/router.py backend/tests/integration/test_m045_policy_summaries_cascade.py
git commit -m "feat(report): policy summaries return cascade randvoorwaarden, not ai_summary"
```

---

## Phase 4 — Frontend: pill + cards on extraction

### Task 5: `PolicyDocument` type + pill reads `extraction_status`

**Files:**
- Modify: `frontend/src/hooks/usePolicyDocuments.ts`
- Modify: `frontend/src/components/configuratie/DocumentListItem.tsx`

**Interfaces:**
- Produces: `PolicyDocument.extraction_status: string`, `PolicyDocument.extraction: Extraction | null`, `interface Extraction { randvoorwaarden?: Randvoorwaarde[]; algemeen_citaat?: string }`.

- [ ] **Step 1: Add types** in `usePolicyDocuments.ts`

```ts
import type { Randvoorwaarde } from '@/components/map/panels/parcel/WoonvisiePopup' // adjust to real export path during execution

export interface Extraction {
  randvoorwaarden?: Randvoorwaarde[]
  algemeen_citaat?: string
  [k: string]: unknown
}
```
And add to `interface PolicyDocument`:
```ts
  extraction_status: string
  extraction: Extraction | null
```

- [ ] **Step 2: Pill reads `extraction_status`**

In `DocumentListItem.tsx`, change the status-map labels and the call site (line ~176) from `statusPill(doc.status)` to `statusPill(doc.extraction_status)`. Update the `statusPill` map keys to:
```ts
  parsed:  { label: 'Geparsed',  className: '<keep existing green classes>' },
  pending: { label: 'In wachtrij', className: '<keep existing amber/neutral classes>' },
  nvt:     { label: 'Geen extractie', className: '<keep existing neutral classes>' },
```
Keep the existing fallback `entry` for unknown values.

- [ ] **Step 3: Type-check + lint**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json && npx eslint src/hooks/usePolicyDocuments.ts src/components/configuratie/DocumentListItem.tsx`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/usePolicyDocuments.ts frontend/src/components/configuratie/DocumentListItem.tsx
git commit -m "feat(data-bronnen): status pill reflects cascade extraction_status"
```

---

### Task 6: data-bronnen AI card → cascade randvoorwaarden

**Files:**
- Modify: `frontend/src/components/configuratie/DocumentSourceDetailView.tsx`
- Modify: `frontend/src/components/configuratie/AiSummaryCard.tsx` (or replace its usage)

**Interfaces:** consumes `PolicyDocument.extraction` (Task 5).

- [ ] **Step 1: Render randvoorwaarden when present**

In `DocumentSourceDetailView.tsx`, replace the `parseAiSummary(doc.ai_summary)` lookup (lines ~66-79) with: pick the latest doc whose `extraction?.randvoorwaarden?.length`. If found, render `RandvoorwaardenSection` (reuse, same import as `WoonvisiePopup`) inside a `SectionInsightCard kicker="Beleid-extractie"`; if none, render nothing (no broken/legacy card). Remove the `AiSummaryCard` + `parseAiSummary` import if now unused.

- [ ] **Step 2: Type-check + lint**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json && npx eslint src/components/configuratie/DocumentSourceDetailView.tsx`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/configuratie/DocumentSourceDetailView.tsx frontend/src/components/configuratie/AiSummaryCard.tsx
git commit -m "feat(data-bronnen): show cascade randvoorwaarden instead of legacy ai_summary"
```

---

### Task 7: report "Gemeentelijk beleid" card → randvoorwaarden

**Files:**
- Modify: `frontend/src/hooks/usePolicySummaries.ts` (response type `dict[str, Randvoorwaarde[]]`)
- Modify: `frontend/src/components/reports/components/PolicyInsightCard.tsx`

**Interfaces:** consumes the new `get_summaries` shape (Task 4): `summaries: Record<string, Randvoorwaarde[]>`.

- [ ] **Step 1: Update the hook types** in `usePolicySummaries.ts`

Change `PolicySummariesResponse.summaries` to `Record<string, Randvoorwaarde[]>`, and `getSummariesForSection` to map to `{ sourceKey, label, randvoorwaarden }` and filter on `randvoorwaarden.length > 0`.

- [ ] **Step 2: Render in `PolicyInsightCard.tsx`**

Replace the single-string `insight.summary` rendering with `RandvoorwaardenSection` (reuse) given `insight.randvoorwaarden`. Keep the "Gemeentelijk beleid — {label}" header. Drop `MAX_CHARS`/expand logic (randvoorwaarden have their own layout).

- [ ] **Step 3: Type-check + lint + the report tests**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json && npx eslint src/hooks/usePolicySummaries.ts src/components/reports/components/PolicyInsightCard.tsx`
Expected: 0 errors. Update any report test that asserted the old string-summary shape.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/usePolicySummaries.ts frontend/src/components/reports/components/PolicyInsightCard.tsx
git commit -m "feat(report): Gemeentelijk beleid card renders cascade randvoorwaarden"
```

---

## Phase 5 — Verify end-to-end

### Task 8: Live verification against the Hauzer demo

- [ ] **Step 1: Full validation**

Run: `cd backend && uv run ruff check . && uv run pytest tests/integration/test_policy_extraction_status.py tests/integration/test_m045_policy_summaries_cascade.py -q`
Run: `cd frontend && npm run check`
Expected: all green.

- [ ] **Step 2: Browser check (dev server)**

Start backend + frontend, log in as `info@hauzer.nl`, and verify:
1. Data-bronnen → a gemeente with woonvisie/omgevingsvisie: pill shows **Geparsed** (not Fout), and the detail view shows the randvoorwaarden.
2. Report (`bekijk rapport`) → Bestemming/Analyse sections: "Gemeentelijk beleid" shows randvoorwaarden, no error text.

- [ ] **Step 3: Confirm no second AI read**

Grep the codebase: `grep -rn "document_summary_job" backend/app/policy_documents backend/app/jobs/auto_ingest_job.py` returns no `enqueue_job` call.

---

## Self-Review notes

- **Spec coverage:** pill→extraction (Task 5), stop redundant read (Task 3), data-bronnen card→cascade (Task 6), report card→cascade (Task 4+7). ✅
- **Type consistency:** `get_extraction_map` returns `ExtractionInfo` everywhere; `extraction_status`/`extraction` names identical across backend schemas + frontend type; `get_summaries` new shape `dict[str, list[dict]]` matched by `usePolicySummaries` + `PolicyInsightCard`.
- **Deferred / out of scope:** removing `app/jobs/document_summary.py` + its worker registration (dead code, safe to leave); a backfill that sets `policy_documents.status` (not needed — pill no longer reads `status`); agent_tools.py `ai_summary` read (low-value; can be repointed to extraction in a follow-up).
- **Prod note:** extraction cache already populated for Venlo (`beleidsalignement`, `woonvisie_match` at schema v6) → pill turns Geparsed immediately; freshly-uploaded cascade docs show **In wachtrij** until the next scan extracts them.
