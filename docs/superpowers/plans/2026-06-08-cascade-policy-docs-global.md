# Cascade Policy Documents Global — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make gemeente-level cascade policy documents (woonvisie, omgevingsvisie) visible across organizations by honoring the existing `is_global` vendor-global pattern in the cascade scoring loader — fixing `woonvisie_match` being `missing:true` for all 63,817 parcels in the Hauzer demo.

**Architecture:** The codebase already treats published gemeente policy docs as vendor-global: `cascade_service.py` and `policy_documents/service.py` read them with `WHERE is_global = true` (no org filter), and uploads set `is_global=true`. Two readers diverged — `cascade_enrichment_service.py` (runtime scoring) and `backfill_cascade_scores.py` (re-score tool) filter purely by `organization_id == org_id`. We align them to `(is_global = true OR organization_id = org_id)`, flip the two existing seed-created docs to global via an Alembic data migration (scoped by `source_key` for tenant safety), fix the seed tool to create global, then re-run the backfill so `woonvisie_match` populates.

**Tech Stack:** Python 3.14, FastAPI, SQLAlchemy 2.x (async), Alembic, pytest (async httpx), PostgreSQL/PostGIS.

---

## Root Cause (already verified — do not re-investigate)

- `woonvisie` PolicyDocument is owned by org **Klarifai** (`c1015564`), `is_global=false`.
- `omgevingsvisie` PolicyDocument is owned by org **Hauzer Vastgoed** (`ec424ee5`), `is_global=false`.
- The M053 backfill ran under the **Hauzer** org. The loaders filter `organization_id == org_id` with no `is_global` fallback → the Klarifai-owned woonvisie is invisible → `_cascade.get("woonvisie_match")` is `None` → `score_woonvisie_match(None, ...)` returns `missing=True` for every parcel.
- The omgevingsvisie is Hauzer-owned, so it matches the org filter and `beleidsalignement` works.
- The v4 `woonvisie_match` extraction cache row exists and is valid (4 wijk_policies, confidence 0.75) — **no re-extraction is needed.**

## Multi-Tenant Safety Constraint (load-bearing)

Globalizing means cross-org visibility. This is correct ONLY for genuinely public published policy docs. The migration MUST be scoped by `source_key` (`woonvisie`, `omgevingsvisie`) so no org-private upload is ever flipped to global. The loader change keeps `OR organization_id = org_id` so an org's own upload (an override) still resolves and is preferred over the vendor global.

## File Structure

- **Modify** `backend/app/services/cascade_enrichment_service.py` — `get_woonvisie_document` + `get_omgevingsvisie_document`: org filter → `(is_global OR org)`, prefer org override in ordering.
- **Modify** `backend/app/tools/backfill_cascade_scores.py` — `_load_woonvisie_payload` + `_load_omgevingsvisie_payload`: reuse the two service functions for doc lookup (DRY) instead of duplicating the org-only query.
- **Modify** `backend/app/tools/seed_omgevingsvisie_venlo.py:94` — create with `is_global=True`.
- **Create** `backend/alembic/versions/<rev>_m053_s02_globalize_policy_docs.py` — data migration setting `is_global=true` for public cascade source_keys.
- **Create/Modify** `backend/tests/integration/test_cascade_enrichment_service.py` — add cross-org global visibility test + tenant-leak regression test.

---

### Task 1: Failing tests for `is_global` cross-org visibility + tenant-leak guard

**Files:**
- Test: `backend/tests/integration/test_cascade_enrichment_service.py` (append two tests)

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/integration/test_cascade_enrichment_service.py`:

```python
@pytest.mark.asyncio
async def test_get_woonvisie_document_finds_global_doc_from_other_org(
    test_db, create_test_user
):
    """A vendor-global woonvisie owned by org A must resolve when queried as org B.

    Encodes the cascade vendor-global pattern: published gemeente policy docs are
    shared across orgs via is_global=true (matches cascade_service.py behavior).
    """
    from app.models.policy_document import PolicyDocument
    from app.services import cascade_enrichment_service

    vendor_user, vendor_org = await create_test_user(
        email="vendor@example.com", org_name="Vendor Org"
    )
    _other_user, other_org = await create_test_user(
        email="other@example.com", org_name="Other Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=vendor_org.id,   # owned by vendor org
        is_global=True,                  # ...but shared
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="venlo-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=vendor_user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    # Queried as a DIFFERENT org — must still find the global doc.
    found = await cascade_enrichment_service.get_woonvisie_document(
        test_db, gemeente_code="GM0983", organization_id=other_org.id
    )
    assert found is not None
    assert found.id == doc.id


@pytest.mark.asyncio
async def test_get_woonvisie_document_does_not_leak_org_private_doc(
    test_db, create_test_user
):
    """An org-private (is_global=false) doc owned by org A must NOT resolve for org B.

    Tenant boundary: only globals + the caller's own docs are visible.
    """
    from app.models.policy_document import PolicyDocument
    from app.services import cascade_enrichment_service

    owner_user, owner_org = await create_test_user(
        email="owner@example.com", org_name="Owner Org"
    )
    _other_user, other_org = await create_test_user(
        email="reader@example.com", org_name="Reader Org"
    )

    doc = PolicyDocument(
        id=uuid.uuid4(),
        organization_id=owner_org.id,
        is_global=False,                 # org-private
        entity_type="gemeente",
        entity_code="GM0983",
        source_key="woonvisie",
        filename="private-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4\n%fake\n%%EOF",
        file_size=22,
        uploaded_by_user_id=owner_user.id,
    )
    test_db.add(doc)
    await test_db.commit()

    found = await cascade_enrichment_service.get_woonvisie_document(
        test_db, gemeente_code="GM0983", organization_id=other_org.id
    )
    assert found is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/integration/test_cascade_enrichment_service.py::test_get_woonvisie_document_finds_global_doc_from_other_org tests/integration/test_cascade_enrichment_service.py::test_get_woonvisie_document_does_not_leak_org_private_doc -v`
Expected: the `finds_global` test FAILS (`found is None` — current code filters org-only); the `does_not_leak` test PASSES (current org-only filter already excludes it). The leak test is a guard that must stay green after Task 2.

- [ ] **Step 3: Commit the tests**

```bash
git add backend/tests/integration/test_cascade_enrichment_service.py
git commit -m "M053/S02: failing tests — cascade loader honors is_global + tenant-leak guard"
```

---

### Task 2: Loader honors `is_global` in `cascade_enrichment_service.py`

**Files:**
- Modify: `backend/app/services/cascade_enrichment_service.py` (`get_woonvisie_document` ~37-50, `get_omgevingsvisie_document` ~60-73)

- [ ] **Step 1: Add the `or_` import**

At the top of `backend/app/services/cascade_enrichment_service.py`, change:

```python
from sqlalchemy import select
```
to:
```python
from sqlalchemy import or_, select
```

- [ ] **Step 2: Update `get_woonvisie_document` WHERE + ORDER BY**

Replace the `stmt` in `get_woonvisie_document`:

```python
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "woonvisie",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        # Prefer an org-specific override (is_global=false) over the vendor global,
        # then newest version. is_global ASC puts False (0) before True (1).
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
```

- [ ] **Step 3: Update `get_omgevingsvisie_document` WHERE + ORDER BY**

Replace the `stmt` in `get_omgevingsvisie_document` (identical pattern, `source_key == "omgevingsvisie"`):

```python
    stmt = (
        select(PolicyDocument)
        .where(
            PolicyDocument.entity_type == "gemeente",
            PolicyDocument.entity_code == gemeente_code,
            PolicyDocument.source_key == "omgevingsvisie",
            or_(
                PolicyDocument.is_global.is_(True),
                PolicyDocument.organization_id == organization_id,
            ),
            PolicyDocument.file_data.isnot(None),
        )
        .order_by(
            PolicyDocument.is_global.asc(),
            PolicyDocument.version_number.desc(),
            PolicyDocument.created_at.desc(),
        )
        .limit(1)
    )
```

- [ ] **Step 4: Run the Task 1 tests + existing cascade tests**

Run: `cd backend && python -m pytest tests/integration/test_cascade_enrichment_service.py -v`
Expected: all PASS (both new tests green, existing `test_woonvisie_uses_document_sentinel` still green — org-owned docs still match via the OR branch).

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/cascade_enrichment_service.py
git commit -m "M053/S02: cascade loader honors is_global (vendor-global policy docs)"
```

---

### Task 3: DRY the backfill loaders to reuse the service functions

**Files:**
- Modify: `backend/app/tools/backfill_cascade_scores.py` (`_load_woonvisie_payload` ~66-122, `_load_omgevingsvisie_payload` ~124-178)

The backfill must also see globals, or re-running it won't find the woonvisie. Reuse the now-fixed service functions for doc lookup instead of duplicating the org-only query; keep the cache read.

- [ ] **Step 1: Import the service helpers**

Near the top imports of `backend/app/tools/backfill_cascade_scores.py`, add:

```python
from app.services.cascade_enrichment_service import (
    get_omgevingsvisie_document,
    get_woonvisie_document,
)
```

- [ ] **Step 2: Replace the doc-lookup block in `_load_woonvisie_payload`**

Replace the inline `doc_stmt = select(PolicyDocument).where(... organization_id == org_id ...)` and its `doc = (await session.execute(doc_stmt)).scalar_one_or_none()` with:

```python
        doc = await get_woonvisie_document(
            session, gemeente_code=gemeente_code, organization_id=org_id
        )
        if doc is None:
            logger.error("No woonvisie document found for gemeente=%s org=%s", gemeente_code, org_id)
            return None
```

Leave the `cache_stmt` block (FactorExtractionCache read at `SCHEMA_VERSION`) unchanged.

- [ ] **Step 3: Replace the doc-lookup block in `_load_omgevingsvisie_payload`**

Replace the inline `doc_stmt`/`doc` block (the `source_key == "omgevingsvisie"` one) with:

```python
        doc = await get_omgevingsvisie_document(
            session, gemeente_code=gemeente_code, organization_id=org_id
        )
        if doc is None:
            logger.info("No omgevingsvisie document found for gemeente=%s org=%s", gemeente_code, org_id)
            return None
```

Leave the omgevingsvisie `cache_stmt` block unchanged. Remove the now-unused `PolicyDocument` import only if nothing else in the file uses it (check first — `get_affected`-style code may; if unsure, leave the import).

- [ ] **Step 4: Run the backfill unit tests**

Run: `cd backend && python -m pytest tests/unit/test_backfill_cascade_scores.py -v`
Expected: PASS. If a test stubbed the old inline query via `PolicyDocument`, update it to patch `get_woonvisie_document`/`get_omgevingsvisie_document` instead, then re-run.

- [ ] **Step 5: Commit**

```bash
git add backend/app/tools/backfill_cascade_scores.py backend/tests/unit/test_backfill_cascade_scores.py
git commit -m "M053/S02: backfill reuses cascade doc-lookup helpers (DRY, honors is_global)"
```

---

### Task 4: Alembic data migration — globalize public cascade policy docs

**Files:**
- Create: `backend/alembic/versions/<rev>_m053_s02_globalize_policy_docs.py`

- [ ] **Step 1: Generate the revision (auto down_revision off current head)**

Run: `cd backend && alembic revision -m "m053_s02 globalize public cascade policy docs"`
Expected: creates a new file in `alembic/versions/` with `down_revision = "20260603_m052_s04_disp"`. Note the generated filename/revision id.

- [ ] **Step 2: Fill in `upgrade`/`downgrade`**

Replace the body of the generated migration:

```python
"""m053_s02 globalize public cascade policy docs

Published gemeente policy documents (woonvisie, omgevingsvisie) are vendor-global
by design — shared across orgs like every other reader in policy_documents/service.py
and cascade_service.py already assumes. Seed tools created them is_global=false,
which hid the woonvisie from the Hauzer demo org. Scope: ONLY these public source_keys,
never arbitrary org uploads (tenant safety).
"""
from alembic import op

# revision identifiers — keep the values Alembic generated.
revision = "<GENERATED>"
down_revision = "20260603_m052_s04_disp"
branch_labels = None
depends_on = None

_PUBLIC_SOURCE_KEYS = ("woonvisie", "omgevingsvisie")


def upgrade() -> None:
    op.execute(
        """
        UPDATE policy_documents
        SET is_global = true
        WHERE source_key IN ('woonvisie', 'omgevingsvisie')
          AND is_global = false
        """
    )


def downgrade() -> None:
    # Best-effort revert. Both seed docs were is_global=false pre-migration.
    op.execute(
        """
        UPDATE policy_documents
        SET is_global = false
        WHERE source_key IN ('woonvisie', 'omgevingsvisie')
        """
    )
```

(Keep the `revision`/`down_revision` strings Alembic generated; only `down_revision` should equal the prior head.)

- [ ] **Step 3: Apply the migration**

Run: `cd backend && alembic upgrade head`
Expected: no error; `alembic current` shows the new revision.

- [ ] **Step 4: Verify both docs are now global**

Run:
```bash
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d propdex -tA \
  -c "SELECT source_key, is_global FROM policy_documents ORDER BY source_key;"
```
Expected: `omgevingsvisie|t` and `woonvisie|t`.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/
git commit -m "M053/S02: data migration — globalize public cascade policy docs"
```

---

### Task 5: Fix the seed tool to create vendor-global

**Files:**
- Modify: `backend/app/tools/seed_omgevingsvisie_venlo.py:94`

- [ ] **Step 1: Flip the hardcoded flag**

In `backend/app/tools/seed_omgevingsvisie_venlo.py`, change the PolicyDocument construction:

```python
            is_global=False,
```
to:
```python
            is_global=True,  # vendor-global: gemeente policy docs are shared across orgs
```

Also update the existence-check query at lines ~72-74 so re-seeding finds the now-global doc regardless of org — change `PolicyDocument.organization_id == org_id` in that `select` to:

```python
                    or_(
                        PolicyDocument.is_global.is_(True),
                        PolicyDocument.organization_id == org_id,
                    ),
```
and add `from sqlalchemy import or_` if not already imported.

- [ ] **Step 2: Verify it imports / lints**

Run: `cd backend && python -c "import app.tools.seed_omgevingsvisie_venlo" && ruff check app/tools/seed_omgevingsvisie_venlo.py`
Expected: no import error, no lint error.

- [ ] **Step 3: Commit**

```bash
git add backend/app/tools/seed_omgevingsvisie_venlo.py
git commit -m "M053/S02: seed omgevingsvisie as vendor-global (is_global=true)"
```

---

### Task 6: Re-run the cascade backfill + verify `woonvisie_match` populates

**Files:** none (data operation + verification)

- [ ] **Step 1: Dry-run the backfill under the Hauzer org**

Run:
```bash
cd backend && python -m app.tools.backfill_cascade_scores \
  --gemeente GM0983 --organization-id ec424ee5-c670-4066-9183-b600aec41377 --dry-run
```
Expected: logs show a woonvisie payload loaded (no "No woonvisie document found"); no DB writes.

- [ ] **Step 2: Run the backfill for real**

Run:
```bash
cd backend && python -m app.tools.backfill_cascade_scores \
  --gemeente GM0983 --organization-id ec424ee5-c670-4066-9183-b600aec41377
```
Expected: completes; logs an updated-parcel count near 63,817.

- [ ] **Step 3: Verify `woonvisie_match` is no longer missing for all parcels**

Run:
```bash
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d propdex -tA -c "
SELECT
  count(*) FILTER (WHERE flags->'score_breakdown'->'woonvisie_match'->>'missing' = 'false') AS not_missing,
  count(*) FILTER (WHERE flags->'score_breakdown'->'woonvisie_match'->'waarde'->'matched_policy' IS NOT NULL) AS matched_a_wijk,
  count(*) AS total
FROM scan_results;"
```
Expected: `not_missing` ≈ 63,817 (woonvisie now scored everywhere), `matched_a_wijk` > 0 (Velden + Hout-Blerick substring-match; Kazerne Kwartier/Binnenstad still miss — that's the separate wijk-naam todo, out of scope here).

- [ ] **Step 4: Confirm `beleidsalignement` did not regress**

Run:
```bash
PGPASSWORD=postgres psql -h localhost -p 5434 -U postgres -d propdex -tA -c "
SELECT flags->'score_breakdown'->'beleidsalignement'->'waarde'->>'matched_gebied' AS g, count(*)
FROM scan_results GROUP BY 1 ORDER BY 2 DESC LIMIT 6;"
```
Expected: still ~32k matched across Stedelijke woongebieden / Belfeld / Velden / Arcen / Lomm (unchanged from pre-fix).

---

### Task 7: Full validation + regression guard sweep

**Files:** none (validation)

- [ ] **Step 1: Run the cascade + scoring test suites**

Run:
```bash
cd backend && python -m pytest \
  tests/integration/test_cascade_enrichment_service.py \
  tests/integration/test_woonvisie_match.py \
  tests/regression/test_woonvisie_unchanged.py \
  tests/unit/test_backfill_cascade_scores.py \
  tests/unit/test_score_woonvisie_match_fallback.py \
  tests/unit/test_score_beleidsalignement.py -v
```
Expected: all PASS. If `test_woonvisie_unchanged.py` (regression) fails, STOP — the loader change altered scoring values it asserts are frozen; reconcile before proceeding.

- [ ] **Step 2: Backend lint + type-check**

Run: `cd backend && ruff check . && mypy app/services/cascade_enrichment_service.py app/tools/backfill_cascade_scores.py app/tools/seed_omgevingsvisie_venlo.py`
Expected: no errors.

- [ ] **Step 3: Commit any test fixups**

```bash
git add -A && git commit -m "M053/S02: validation — cascade global-policy tests + lint green"
```

---

## Out of Scope (separate todos)

- **Wijk-naam matching weakness** (`.planning/todos/pending/2026-06-02-woonvisie-wijk-matching-refinement.md`): "Kazerne Kwartier"/"Binnenstad" don't substring-match CBS wijk strings. Fixing this (alias/fuzzy/geocode) is a distinct slice; this plan only makes the doc visible.
- **Ownership normalization**: the omgevingsvisie stays Hauzer-owned (now global). Reassigning vendor docs to the Klarifai org is cosmetic and not required for correctness.
- **Frontend weight preset**: `beleidsalignement` is absent from `scoreWeights.ts` presets (not user-tunable, omitted from tile `cb` payload). Separate frontend fix.

## Prod Deploy Note

Tasks 4–6 must run on prod too: `alembic upgrade head` (migration) then re-run the cascade backfill under the prod demo org. Per project memory, Railway does not auto-deploy from push.
