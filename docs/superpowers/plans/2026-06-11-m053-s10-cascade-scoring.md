# Cascade Scoring End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make woonvisie/omgevingsvisie cascade scores produced automatically by scans and by document add/update, via one shared compute service reused by the scan, the rescore job, and the backfill — with a score-parity gate before ship.

**Architecture:** Lift the proven compute from `backfill_cascade_scores.py` into a new `app/services/cascade_scoring.py` (load payloads once per gemeente; build parcel_data; apply `compute_score_v3` with payloads; batched gemeente recompute). Wire scan Phase 6, `rescore_parcels_for_document`, and the backfill to it. The document-add trigger already exists — we only make the job actually compute.

**Tech Stack:** FastAPI, SQLAlchemy 2.x async, PostGIS, ARQ, pytest. Validation: `cd backend && ruff check . && mypy .` (touched files) + pytest.

**Spec:** `docs/superpowers/specs/2026-06-11-cascade-scoring-end-to-end-design.md`
**Slice:** `M053/S10`. Commit prefix: `M053/S10: <what>`. Branch: `m053-s10-cascade-scoring` (created).

**Key reference facts (verified in code):**
- `compute_score_v3(parcel_data, neighborhood_metrics=None, custom_weights=None, project_type="onbepaald", cascade_payloads=None) -> ScoreV3Result`.
- `ScoreV3Result` fields: `.potentie_score`, `.risico_score`, `.overall`, `.category`, `.score_breakdown: dict[str, FactorResult]` (FactorResult is a dataclass → `dataclasses.asdict`).
- Standard write-back onto a scan_result's `flags` (identical in scan Phase 6 and backfill):
  ```python
  flags["scores"] = {"potentie": r.potentie_score, "risico": r.risico_score, "overall": r.overall}
  flags["score_breakdown"] = {name: asdict(f) for name, f in r.score_breakdown.items()}
  flags["score_model_version"] = "score-v3.0"
  flags["category"] = r.category
  sr.score = max(0.0, min(100.0, r.overall))
  sr.flags = flags
  ```
- `parcel_data` dict shape (from backfill, the canonical builder): keys `parcel_id, area_m2, perimeter_m, has_pand, bouwjaar, pand_status, bestemmingen, wijk_naam` from ParcelCache + `vacancy_signal, building_metrics, market_signals, bodem, bodemtype, funderingsrisico, energielabel, vergunningen, natura2000, overstromingsrisico, geluid, luchtkwaliteit, woz, rijksmonument` from existing `flags`.
- Payloads are gemeente-level: `extract_factor(parcel_id=DOCUMENT_SENTINEL)`; cached in `factor_extraction_cache` keyed by `policy_document_id + factor_id + SCHEMA_VERSION`. Factor ids: `"woonvisie_match"` (WoonvisiePayload), `"beleidsalignement"` (OmgevingsvisiePayload).
- `get_woonvisie_document` / `get_omgevingsvisie_document` live in `app/services/cascade_enrichment_service.py`.

---

## File Structure

| File | Responsibility | Tasks |
|---|---|---|
| `backend/app/services/cascade_scoring.py` | NEW shared service: load payloads, build parcel_data, apply score, gemeente recompute | 1,2,3 |
| `backend/app/jobs/area_scan.py` | Phase 6 uses the service (load once, build, apply) | 4 |
| `backend/app/jobs/rescore_cascade_job.py` | rescore job refreshes cache + calls gemeente recompute | 5 |
| `backend/app/tools/backfill_cascade_scores.py` | refactor to call the service | 6 |
| `backend/app/tools/verify_cascade_parity.py` | NEW parity gate (dry-run compare vs stored) | 7 |
| `backend/tests/services/test_cascade_scoring.py` | unit tests for the service | 1,2,3 |
| `backend/tests/regression/test_m053_s10_*.py` | scan + rescore regression guards | 4,5 |

---

### Task 1: `load_gemeente_cascade_payloads` in new service

**Files:**
- Create: `backend/app/services/cascade_scoring.py`
- Create test: `backend/tests/services/test_cascade_scoring.py`

- [ ] **Step 1: Read the backfill loaders** `app/tools/backfill_cascade_scores.py` (`_load_woonvisie_payload`, `_load_omgevingsvisie_payload`, ~lines 69-160) and `app/ai/factor_extraction_schemas.py` for `SCHEMA_VERSION`, and `app/ai/factors/woonvisie_match.py` / `app/ai/factors/beleidsalignement.py` for `WoonvisiePayload` / `OmgevingsvisiePayload`.

- [ ] **Step 2: Write the failing test** at `backend/tests/services/test_cascade_scoring.py`:

```python
"""Unit tests for the shared cascade-scoring service (M053/S10)."""
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import SCHEMA_VERSION
from app.models.factor_extraction_cache import FactorExtractionCache
from app.models.organization import Organization
from app.models.policy_document import PolicyDocument
from app.services.cascade_scoring import load_gemeente_cascade_payloads


async def _seed_woonvisie(db: AsyncSession, org_id: uuid.UUID, gemeente_code: str) -> None:
    doc = PolicyDocument(
        organization_id=org_id,
        entity_type="gemeente",
        entity_code=gemeente_code,
        document_type="woonvisie",
        filename="koop-cvdr-woonvisie.pdf",
        content_type="application/pdf",
        file_data=b"%PDF-1.4 test",
        is_global=True,
        version_number=1,
    )
    db.add(doc)
    await db.flush()
    # Minimal valid WoonvisiePayload-shaped extraction. Read
    # app/ai/factors/woonvisie_match.py for the exact required fields and
    # fill a minimal valid instance; dump it to dict for extracted_payload.
    db.add(FactorExtractionCache(
        policy_document_id=doc.id,
        parcel_id="__DOCUMENT__",            # DOCUMENT_SENTINEL value — confirm in cascade_enrichment_service
        factor_id="woonvisie_match",
        schema_version=SCHEMA_VERSION,
        extracted_payload=_MINIMAL_WOONVISIE_DICT,   # define from the payload model
    ))
    await db.flush()


@pytest.mark.asyncio
async def test_load_payloads_returns_woonvisie_when_cached(test_db: AsyncSession):
    org = Organization(name=f"Org-{uuid.uuid4()}")
    test_db.add(org)
    await test_db.flush()
    await _seed_woonvisie(test_db, org.id, "GM0983")
    await test_db.commit()

    payloads = await load_gemeente_cascade_payloads(test_db, gemeente_code="GM0983", organization_id=org.id)
    assert "woonvisie_match" in payloads


@pytest.mark.asyncio
async def test_load_payloads_empty_when_no_document(test_db: AsyncSession):
    org = Organization(name=f"Org-{uuid.uuid4()}")
    test_db.add(org)
    await test_db.commit()
    payloads = await load_gemeente_cascade_payloads(test_db, gemeente_code="GM9999", organization_id=org.id)
    assert payloads == {}
```

> Before running: read `app/models/policy_document.py`, `app/models/factor_extraction_cache.py`, and `app/ai/factors/woonvisie_match.py` to (a) fill the real required constructor fields, (b) confirm the `DOCUMENT_SENTINEL` literal (grep `DOCUMENT_SENTINEL` in `cascade_enrichment_service.py`), and (c) define `_MINIMAL_WOONVISIE_DICT` as a valid dump of the payload model. Do NOT invent fields.

- [ ] **Step 3: Run the test, confirm it FAILS** (`load_gemeente_cascade_payloads` undefined):
`cd backend && python -m pytest tests/services/test_cascade_scoring.py -v`

- [ ] **Step 4: Implement** `backend/app/services/cascade_scoring.py`:

```python
"""Shared cascade-scoring service (M053/S10).

Single source of truth for computing woonvisie_match / beleidsalignement
cascade factors into scan_results. Used by the scan (area_scan Phase 6),
the document rescore job (rescore_parcels_for_document), and the manual
backfill tool — so the three can never drift.

Cost: the AI extraction is document-level (cached once per gemeente doc);
the per-parcel work is pure compute_score_v3 — no Claude call per parcel.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.factor_extraction_schemas import SCHEMA_VERSION
from app.ai.factors.beleidsalignement import OmgevingsvisiePayload
from app.ai.factors.woonvisie_match import WoonvisiePayload
from app.models.factor_extraction_cache import FactorExtractionCache
from app.services.cascade_enrichment_service import (
    get_omgevingsvisie_document,
    get_woonvisie_document,
)

logger = logging.getLogger(__name__)

# (factor_id, document loader, payload model) — drives load_gemeente_cascade_payloads.
_CASCADE_SOURCES = (
    ("woonvisie_match", get_woonvisie_document, WoonvisiePayload),
    ("beleidsalignement", get_omgevingsvisie_document, OmgevingsvisiePayload),
)


async def load_gemeente_cascade_payloads(
    session: AsyncSession,
    *,
    gemeente_code: str | None,
    organization_id,
) -> dict[str, Any]:
    """Load woonvisie + omgevingsvisie payloads for a gemeente from the
    extraction cache. Returns {factor_id: payload}; absent factors omitted.

    Reads from cache only (no Claude call). Gemeente-level documents produce
    one identical payload reused for every parcel.
    """
    payloads: dict[str, Any] = {}
    if not gemeente_code:
        return payloads

    for factor_id, get_doc, model in _CASCADE_SOURCES:
        try:
            doc = await get_doc(
                session, gemeente_code=gemeente_code, organization_id=organization_id
            )
            if doc is None:
                continue
            cached = (
                await session.execute(
                    select(FactorExtractionCache)
                    .where(
                        FactorExtractionCache.policy_document_id == doc.id,
                        FactorExtractionCache.factor_id == factor_id,
                        FactorExtractionCache.schema_version == SCHEMA_VERSION,
                    )
                    .limit(1)
                )
            ).scalar_one_or_none()
            if cached is None:
                logger.info(
                    "cascade_scoring: no cached %s at schema=%s for doc=%s",
                    factor_id, SCHEMA_VERSION, doc.id,
                )
                continue
            payloads[factor_id] = model.model_validate(cached.extracted_payload)
        except Exception:
            logger.exception(
                "cascade_scoring: failed loading %s for gemeente=%s", factor_id, gemeente_code
            )
    return payloads
```

> Confirm the `FactorExtractionCache` column names (`policy_document_id`, `factor_id`, `schema_version`, `extracted_payload`) by reading the model — they came from the backfill; adapt if different.

- [ ] **Step 5: Run the test, confirm PASS.** `cd backend && python -m pytest tests/services/test_cascade_scoring.py -v`

- [ ] **Step 6: Lint + commit.**
```bash
cd backend && ruff check app/services/cascade_scoring.py tests/services/test_cascade_scoring.py && mypy app/services/cascade_scoring.py
git add app/services/cascade_scoring.py tests/services/test_cascade_scoring.py
git commit -m "M053/S10: cascade_scoring service — load_gemeente_cascade_payloads

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `build_parcel_data` + `apply_cascade_score`

**Files:**
- Modify: `backend/app/services/cascade_scoring.py`
- Modify test: `backend/tests/services/test_cascade_scoring.py`

- [ ] **Step 1: Write failing tests** (append):

```python
from app.services.cascade_scoring import apply_cascade_score, build_parcel_data


def test_build_parcel_data_includes_parcel_id_and_flag_overlay():
    class _PC:
        parcel_id = "kad-123"
        area_m2 = 500.0
        has_pand = True
        bouwjaar = 1975
        pand_status = "in_gebruik"
        bestemmingen = None
    flags = {"vacancy_signal": "leeg", "building_metrics": {"x": 1}}
    pd = build_parcel_data(_PC(), flags, perimeter_m=90.0, wijk_naam="Centrum")
    assert pd["parcel_id"] == "kad-123"
    assert pd["area_m2"] == 500.0
    assert pd["perimeter_m"] == 90.0
    assert pd["wijk_naam"] == "Centrum"
    assert pd["vacancy_signal"] == "leeg"
    assert pd["building_metrics"] == {"x": 1}


def test_apply_cascade_score_writes_breakdown_and_score():
    # A minimal scan_result-like object with a v3.0 flags dict.
    class _SR:
        def __init__(self):
            self.score = 0.0
            self.flags = {"score_model_version": "score-v3.0"}
    sr = _SR()
    changed = apply_cascade_score(
        sr,
        parcel_data={"area_m2": 500.0, "has_pand": True},
        nbhd_metrics=None,
        cascade_payloads={},
    )
    assert changed is True
    assert "score_breakdown" in sr.flags
    assert sr.flags["score_model_version"] == "score-v3.0"
    assert 0.0 <= sr.score <= 100.0
```

- [ ] **Step 2: Run, confirm FAIL.** `cd backend && python -m pytest tests/services/test_cascade_scoring.py -v`

- [ ] **Step 3: Implement** (append to `cascade_scoring.py`):

```python
from dataclasses import asdict

from app.services.score_v3 import compute_score_v3

# parcel_data flag-overlay keys copied from existing flags (canonical list —
# matches area_scan Phase 6 and the backfill).
_FLAG_OVERLAY_KEYS = (
    "vacancy_signal", "market_signals", "bodem", "bodemtype",
    "funderingsrisico", "energielabel", "vergunningen", "natura2000",
    "overstromingsrisico", "geluid", "luchtkwaliteit", "woz", "rijksmonument",
)


def build_parcel_data(
    parcel_cache: Any,
    flags: dict[str, Any],
    *,
    perimeter_m: float | None,
    wijk_naam: str | None,
) -> dict[str, Any]:
    """Build the compute_score_v3 input dict from a ParcelCache row + existing flags."""
    pd: dict[str, Any] = {
        "parcel_id": str(parcel_cache.parcel_id),
        "area_m2": parcel_cache.area_m2,
        "perimeter_m": float(perimeter_m) if perimeter_m is not None else None,
        "has_pand": parcel_cache.has_pand,
        "bouwjaar": parcel_cache.bouwjaar,
        "pand_status": parcel_cache.pand_status,
        "bestemmingen": parcel_cache.bestemmingen,
        "wijk_naam": wijk_naam,
        "building_metrics": flags.get("building_metrics", {}),
    }
    for key in _FLAG_OVERLAY_KEYS:
        pd[key] = flags.get(key)
    return pd


def apply_cascade_score(
    scan_result: Any,
    *,
    parcel_data: dict[str, Any],
    nbhd_metrics: dict[str, Any] | None,
    cascade_payloads: dict[str, Any],
    custom_weights: dict[str, Any] | None = None,
    project_type: str = "onbepaald",
) -> bool:
    """Compute v3.0 (with cascade payloads) and write breakdown + scores onto
    scan_result.flags / scan_result.score. Returns True if applied."""
    result = compute_score_v3(
        parcel_data,
        nbhd_metrics,
        custom_weights=custom_weights,
        project_type=project_type,
        cascade_payloads=cascade_payloads,
    )
    flags = dict(scan_result.flags) if scan_result.flags else {}
    flags["scores"] = {
        "potentie": result.potentie_score,
        "risico": result.risico_score,
        "overall": result.overall,
    }
    flags["score_breakdown"] = {
        name: asdict(factor) for name, factor in result.score_breakdown.items()
    }
    flags["score_model_version"] = "score-v3.0"
    flags["category"] = result.category
    flags.pop("factors", None)
    flags.pop("subscores", None)
    scan_result.flags = flags
    scan_result.score = max(0.0, min(100.0, result.overall))
    return True
```

> Note: `apply_cascade_score` signature must match the calls used in Tasks 4-6. The test calls it with keyword args; keep `scan_result` positional and the rest keyword-only as shown.

- [ ] **Step 4: Run, confirm PASS.**

- [ ] **Step 5: Lint + commit.**
```bash
cd backend && ruff check app/services/cascade_scoring.py tests/services/test_cascade_scoring.py && mypy app/services/cascade_scoring.py
git add app/services/cascade_scoring.py tests/services/test_cascade_scoring.py
git commit -m "M053/S10: cascade_scoring service — build_parcel_data + apply_cascade_score

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `recompute_gemeente_cascade` (batched gemeente recompute)

**Files:**
- Modify: `backend/app/services/cascade_scoring.py`
- Modify test: `backend/tests/services/test_cascade_scoring.py`

- [ ] **Step 1: Read the backfill loop** `app/tools/backfill_cascade_scores.py::_backfill_gemeente` (~lines 180-290) — the JOIN (`ScanResult` + `ParcelCache` + `AreaScan.wijk_naam` + `ST_Perimeter`), the `nbhd_map` load, keyset pagination by `ScanResult.id`, batch flush/commit.

- [ ] **Step 2: Write a failing integration test** (append). It seeds: org, AreaScan with `neighborhood_metrics`, a ParcelCache, a v3.0 ScanResult, and a cached woonvisie payload; then calls `recompute_gemeente_cascade` and asserts the ScanResult now has a non-null `woonvisie_match` in `flags["score_breakdown"]`.

```python
@pytest.mark.asyncio
async def test_recompute_gemeente_adds_woonvisie_factor(test_db: AsyncSession):
    from app.services.cascade_scoring import recompute_gemeente_cascade
    # ... seed org + woonvisie doc + cached payload (reuse _seed_woonvisie),
    # AreaScan(gemeente_code, neighborhood_metrics={...}), ParcelCache(gemeente_code,
    # parcel_id, geometry, area_m2, ...), ScanResult(scan_id, parcel_id,
    # flags={"score_model_version": "score-v3.0", "score_breakdown": {...minimal...}}).
    # Read the three models for required fields before constructing.
    processed, updated = await recompute_gemeente_cascade(
        test_db, gemeente_code="GM0983", organization_id=org.id, batch_size=100, dry_run=False
    )
    assert processed >= 1
    # reload the scan_result; assert "woonvisie_match" in flags["score_breakdown"]
    # and the factor's genormaliseerde_score is not None.
```

> This test needs real geometry for `ST_Perimeter`; use a small WKT polygon via `func.ST_GeomFromText('POLYGON((...))', 28992)` matching how other tests seed ParcelCache.geometry (grep tests for `ST_GeomFromText` / `ParcelCache(` to copy the pattern). If seeding PostGIS geometry in a unit test is too heavy, mark this test `@pytest.mark.integration` and keep it in `tests/integration/`.

- [ ] **Step 3: Run, confirm FAIL.**

- [ ] **Step 4: Implement** `recompute_gemeente_cascade` (append). Port `_backfill_gemeente` but: take an external `session`, use `load_gemeente_cascade_payloads` + `build_parcel_data` + `apply_cascade_score`, support an optional `parcel_ids` filter, return `(processed, updated)`:

```python
from sqlalchemy import func

from app.models.area_scan import AreaScan
from app.models.parcel_cache import ParcelCache
from app.models.scan_result import ScanResult


async def recompute_gemeente_cascade(
    session: AsyncSession,
    *,
    gemeente_code: str,
    organization_id,
    batch_size: int = 500,
    dry_run: bool = False,
    custom_weights: dict[str, Any] | None = None,
) -> tuple[int, int]:
    """Recompute cascade scores for all v3.0 scan_results in a gemeente.

    Loads cascade payloads once, then keyset-paginates scan_results joined to
    ParcelCache + AreaScan, applying compute_score_v3 per parcel. Returns
    (processed, updated). Caller owns the transaction boundary unless dry_run.
    """
    cascade_payloads = await load_gemeente_cascade_payloads(
        session, gemeente_code=gemeente_code, organization_id=organization_id
    )

    processed = 0
    updated = 0
    last_id = None
    while True:
        stmt = (
            select(
                ScanResult,
                ParcelCache,
                AreaScan.wijk_naam,
                func.ST_Perimeter(ParcelCache.geometry).label("perimeter_m"),
                AreaScan.neighborhood_metrics,
            )
            .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
            .join(AreaScan, AreaScan.id == ScanResult.scan_id)
            .where(ParcelCache.gemeente_code == gemeente_code)
            .order_by(ScanResult.id)
            .limit(batch_size)
        )
        if last_id is not None:
            stmt = stmt.where(ScanResult.id > last_id)
        rows = (await session.execute(stmt)).all()
        if not rows:
            break

        for sr, pc, wijk_naam, perimeter_m, nbhd in rows:
            processed += 1
            flags = sr.flags or {}
            if flags.get("score_model_version") != "score-v3.0":
                continue
            parcel_data = build_parcel_data(pc, flags, perimeter_m=perimeter_m, wijk_naam=wijk_naam)
            if not dry_run:
                apply_cascade_score(
                    sr,
                    parcel_data=parcel_data,
                    nbhd_metrics=nbhd,
                    cascade_payloads=cascade_payloads,
                    custom_weights=custom_weights,
                )
                session.add(sr)
            updated += 1

        last_id = rows[-1][0].id
        if not dry_run:
            await session.flush()
    return processed, updated
```

> The backfill commits per batch and sets `SET app.current_tenant_id`. Here the CALLER owns the transaction (the rescore job and backfill each commit). Do NOT commit inside this function — flush only. The tenant GUC is set by the caller's session setup.

- [ ] **Step 5: Run, confirm PASS.**

- [ ] **Step 6: Lint + commit.**
```bash
cd backend && ruff check app/services/cascade_scoring.py tests/services/test_cascade_scoring.py && mypy app/services/cascade_scoring.py
git add app/services/cascade_scoring.py tests/services/test_cascade_scoring.py
git commit -m "M053/S10: cascade_scoring service — recompute_gemeente_cascade

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire scan Phase 6 to the service (fix the dead branch)

**Files:**
- Modify: `backend/app/jobs/area_scan.py` (Phase 6 loop, ~lines 905-1005)
- Create test: `backend/tests/regression/test_m053_s10_scan_computes_cascade.py`

- [ ] **Step 1: Read** `area_scan.py` Phase 6 (905-1005) — the batch loop, the dead `if org_id and _parcel_id_str:` cascade block (~948-974), the `compute_score_v3(... cascade_payloads=cascade_payloads)` call, and the write-back.

- [ ] **Step 2: Write the regression test** `tests/regression/test_m053_s10_scan_computes_cascade.py` — a drift-detection test that the dead per-parcel `get_cascade_payloads` block is gone and the gemeente-level load is used:

```python
"""REGRESSION — M053/S10: scan Phase 6 computes cascade via gemeente payload load.

Before the fix, parcel_data never had parcel_id set, so the per-parcel
get_cascade_payloads block never ran and scans produced no cascade scores.
After: the scan loads cascade payloads ONCE per gemeente and feeds them to
compute_score_v3 for every parcel.

Drift-detection: the dead per-parcel cascade fetch must NOT return; the
gemeente-level load_gemeente_cascade_payloads must be called once.
"""
import inspect

from app.jobs import area_scan


def test_scan_uses_gemeente_payload_load_not_dead_per_parcel_fetch():
    src = inspect.getsource(area_scan)
    assert "load_gemeente_cascade_payloads" in src, (
        "scan Phase 6 must load cascade payloads once per gemeente (M053/S10)"
    )
    # The dead guard keyed on an always-empty parcel_id must be gone.
    assert "_parcel_id_str" not in src, (
        "the dead per-parcel cascade branch (_parcel_id_str) must be removed"
    )
```

- [ ] **Step 3: Run, confirm FAIL** (`load_gemeente_cascade_payloads` not yet referenced; `_parcel_id_str` still present).

- [ ] **Step 4: Implement.** In Phase 6:
  1. Before the `for batch_start ...` loop (right after `nbhd_metrics = scan.neighborhood_metrics or {}`), load payloads once:
     ```python
     from app.services.cascade_scoring import load_gemeente_cascade_payloads
     cascade_payloads = await load_gemeente_cascade_payloads(
         session, gemeente_code=scan.gemeente_code, organization_id=org_id
     )
     ```
     (Place the import at top-of-file with the other imports, not inline, per codebase style.)
  2. DELETE the dead per-parcel cascade block entirely (the `cascade_payloads: dict = {}` init, the `_parcel_id_str = ...` line, and the `if org_id is not None and _parcel_id_str: try: cascade_payloads = await get_cascade_payloads(...)` block).
  3. The existing `compute_score_v3(parcel_data, nbhd_metrics, project_type="onbepaald", cascade_payloads=cascade_payloads)` now uses the gemeente-level `cascade_payloads` (same variable name, loaded once). The write-back stays as-is.
  4. If `get_cascade_payloads` import in `area_scan.py` becomes unused, remove it (grep first).

- [ ] **Step 5: Run the regression test + scan suite.**
```bash
cd backend && python -m pytest tests/regression/test_m053_s10_scan_computes_cascade.py -v
python -m pytest tests/ -k "area_scan or scoring or score_v3 or scan" -q 2>&1 | tail -8
```
Expected: new test PASS; scan suite unchanged (classify any failure pre-existing vs introduced — the 3 `test_score_v3.py` failures are known pre-existing).

- [ ] **Step 6: Lint + commit.**
```bash
cd backend && ruff check app/jobs/area_scan.py tests/regression/test_m053_s10_scan_computes_cascade.py && mypy app/jobs/area_scan.py
git add app/jobs/area_scan.py tests/regression/test_m053_s10_scan_computes_cascade.py
git commit -m "M053/S10: scan Phase 6 computes cascade via gemeente payload load (fix dead branch)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Make `rescore_parcels_for_document` actually recompute

**Files:**
- Modify: `backend/app/jobs/rescore_cascade_job.py` (`rescore_parcels_for_document`, and retire/replace `_process_parcel`)
- Create test: `backend/tests/regression/test_m053_s10_doc_rescore_recomputes.py`

- [ ] **Step 1: Read** `rescore_cascade_job.py` `rescore_parcels_for_document` (~150-235) and `_process_parcel` (~59-128). Note it currently (a) gets affected parcel_ids, (b) per-parcel `_process_parcel` which refreshes cache + re-weights. We replace the re-weight with a real recompute, while KEEPING a cache refresh so the new document's payload is extracted before recompute.

- [ ] **Step 2: Write the regression test** `tests/regression/test_m053_s10_doc_rescore_recomputes.py` — drift-detection that the job now calls `recompute_gemeente_cascade` (real compute) rather than `_rescore_from_breakdown` (re-weight):

```python
"""REGRESSION — M053/S10: document rescore recomputes cascade, not just re-weights.

Before, rescore_parcels_for_document only refreshed the cache + re-weighted the
existing breakdown, so a woonvisie update did NOT change cascade scores. After,
it recomputes via the shared service.
"""
import inspect

from app.jobs import rescore_cascade_job


def test_doc_rescore_uses_recompute_service():
    src = inspect.getsource(rescore_cascade_job.rescore_parcels_for_document)
    assert "recompute_gemeente_cascade" in src, (
        "rescore_parcels_for_document must recompute via the shared service (M053/S10)"
    )
```

- [ ] **Step 3: Run, confirm FAIL.**

- [ ] **Step 4: Implement.** Rewrite `rescore_parcels_for_document` body so it:
  1. Loads the document (existing), derives `gemeente_code = doc.entity_code`, `org_id = doc.organization_id`.
  2. **Refreshes the extraction cache once** for the document so the (possibly new) payload is extracted before recompute. Reuse `get_cascade_payloads(session, parcel_id=<DOCUMENT_SENTINEL or any>, gemeente_code=gemeente_code, organization_id=org_id)` ONCE (it triggers `extract_factor`, cache-aware). Read `cascade_enrichment_service.py` for the sentinel constant; pass it (not a real parcel) so the extraction is the gemeente-level one.
  3. Calls `recompute_gemeente_cascade(session, gemeente_code=gemeente_code, organization_id=org_id, batch_size=BATCH or 500, dry_run=False)`.
  4. `await session.commit()` once at the end (the service flushes per batch; the job owns the commit). Keep the existing event-log entry (and the `locals()` fix from S09) — set `affected_parcel_count` from the `processed` return.
  5. Delete `_process_parcel` and the now-unused `_rescore_from_breakdown` import IF nothing else in the file uses them (grep — note `_rescore_from_breakdown` may be imported from `rescore_weights`; only remove the import if unused here).

- [ ] **Step 5: Run the regression test + rescore suite.**
```bash
cd backend && python -m pytest tests/regression/test_m053_s10_doc_rescore_recomputes.py -v
python -m pytest tests/ -k "rescore or cascade" -q 2>&1 | tail -10
```
Expected: new test PASS; classify other failures pre-existing vs introduced.

- [ ] **Step 6: Lint + commit.**
```bash
cd backend && ruff check app/jobs/rescore_cascade_job.py tests/regression/test_m053_s10_doc_rescore_recomputes.py && mypy app/jobs/rescore_cascade_job.py
git add app/jobs/rescore_cascade_job.py tests/regression/test_m053_s10_doc_rescore_recomputes.py
git commit -m "M053/S10: document rescore recomputes cascade via shared service

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Refactor the backfill to call the service

**Files:**
- Modify: `backend/app/tools/backfill_cascade_scores.py`

- [ ] **Step 1: Read** the full backfill. Identify `_backfill_gemeente` (the loop now duplicated by `recompute_gemeente_cascade`) and the per-gemeente driver `_run`.

- [ ] **Step 2: Replace** `_backfill_gemeente`'s body with a call to `recompute_gemeente_cascade` (open a session, `SET app.current_tenant_id`, call the service, commit). Keep the CLI args (`--gemeente`, `--dry-run`, `--organization-id`, `--batch-size`) and the dry-run semantics (pass `dry_run` through). The `_load_woonvisie_payload`/`_load_omgevingsvisie_payload` helpers become redundant (the service loads payloads) — delete them and their imports if unused.

- [ ] **Step 3: Verify the tool still runs (no DB needed for `--help`):**
```bash
cd backend && python -m app.tools.backfill_cascade_scores --help
python -c "import app.tools.backfill_cascade_scores"
```
Expected: help prints; import clean.

- [ ] **Step 4: Lint + commit.**
```bash
cd backend && ruff check app/tools/backfill_cascade_scores.py && mypy app/tools/backfill_cascade_scores.py
git add app/tools/backfill_cascade_scores.py
git commit -m "M053/S10: backfill_cascade_scores reuses shared recompute service

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Score-parity verification gate

**Files:**
- Create: `backend/app/tools/verify_cascade_parity.py`

- [ ] **Step 1: Implement** a read-only parity checker. For a gemeente, sample N scan_results that ALREADY have a non-null `woonvisie_match`/`beleidsalignement` in `flags["score_breakdown"]` (i.e. backfilled), recompute each via the shared service IN MEMORY (do NOT write), and compare the recomputed `woonvisie_match.genormaliseerde_score`, `beleidsalignement.genormaliseerde_score`, and overall `score` against the stored values within a tolerance (e.g. abs diff <= 0.5). Print a summary: sampled, matched, mismatched (with the worst diffs). Exit non-zero if any mismatch beyond tolerance.

```python
"""Parity gate (M053/S10): the new shared cascade compute must reproduce the
stored (backfilled) scores. Read-only; writes nothing. Exits non-zero on drift.

Usage: python -m app.tools.verify_cascade_parity --gemeente GM0983 --sample 200
"""
# Build parcel_data via build_parcel_data, recompute via apply_cascade_score on a
# throwaway object (or compute_score_v3 directly with the loaded payloads), and
# diff against stored flags["score_breakdown"]["woonvisie_match"]["genormaliseerde_score"]
# etc. Reuse load_gemeente_cascade_payloads + build_parcel_data from the service.
```

> Write the full implementation following the backfill's JOIN/query pattern (ScanResult+ParcelCache+AreaScan+ST_Perimeter+neighborhood_metrics) but read-only. Define the tolerance as a module constant `PARITY_TOLERANCE = 0.5`. Use `load_gemeente_cascade_payloads` and `build_parcel_data` so it tests the real path.

- [ ] **Step 2: Verify it imports + helps.**
```bash
cd backend && python -c "import app.tools.verify_cascade_parity" && python -m app.tools.verify_cascade_parity --help
```

- [ ] **Step 3: Run parity against available data (if the local DB has backfilled Venlo).**
```bash
cd backend && python -m app.tools.verify_cascade_parity --gemeente GM0983 --sample 200
```
- If the local DB has backfilled Venlo `scan_results`: run it; it MUST report all sampled rows within tolerance. Capture the output.
- If the local DB does NOT have that data: report that this gate must be run against prod (via the PostGIS public proxy noted in project memory) BEFORE deploying S10. Do not claim parity verified if it didn't run — say explicitly it's a pending pre-deploy manual gate.

- [ ] **Step 4: Lint + commit.**
```bash
cd backend && ruff check app/tools/verify_cascade_parity.py && mypy app/tools/verify_cascade_parity.py
git add app/tools/verify_cascade_parity.py
git commit -m "M053/S10: cascade score-parity verification gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Slice validation + verification-before-completion

- [ ] **Step 1:** `cd backend && ruff check app/services/cascade_scoring.py app/jobs/area_scan.py app/jobs/rescore_cascade_job.py app/tools/backfill_cascade_scores.py app/tools/verify_cascade_parity.py` → clean.
- [ ] **Step 2:** `python -c "import app.main"` → imports cleanly. Also `python -c "import app.jobs.worker"` (the worker registers the rescore job).
- [ ] **Step 3:** `python -m pytest tests/services/test_cascade_scoring.py tests/regression/test_m053_s10_*.py -v` → all pass.
- [ ] **Step 4:** Broader sweep: `python -m pytest tests/ -k "area_scan or scoring or score_v3 or rescore or cascade or scan" -q 2>&1 | tail -12` → classify every failure as pre-existing (with evidence) or introduced.
- [ ] **Step 5:** Use `superpowers:verification-before-completion`: confirm each spec requirement maps to a committed change + green test, and state the parity-gate status explicitly (ran-and-passed, or pending-prod-run). Do not claim cascade scoring "works end-to-end" on prod until the parity gate has been run against backfilled data.

---

## Self-Review

**Spec coverage:** shared service (T1-3), scan wiring (T4), document-rescore real recompute (T5), backfill dedup (T6), parity gate (T7), validation (T8). All spec sections covered. The "automatic, right away" decision is satisfied because the document-add trigger already exists and T5 makes the job compute.

**Placeholders:** test bodies in T1/T3/T7 intentionally defer the exact seed-field values to "read the model first" because the model constructors (PolicyDocument, FactorExtractionCache, ParcelCache geometry) have many required fields not worth hardcoding wrongly — each is marked with the specific file to read and what to fill. The production code steps are fully concrete. This is a deliberate, bounded instruction, not a vague placeholder.

**Type consistency:** `apply_cascade_score(scan_result, *, parcel_data, nbhd_metrics, cascade_payloads, custom_weights=None, project_type=...)` — same keyword signature used in T2 test, T3 `recompute_gemeente_cascade`, and T7 parity. `load_gemeente_cascade_payloads(session, *, gemeente_code, organization_id)` — same in T1, T3, T4, T7. `recompute_gemeente_cascade(session, *, gemeente_code, organization_id, batch_size, dry_run, custom_weights)` — same in T3, T5, T6. `ScoreV3Result` fields (`.potentie_score/.risico_score/.overall/.category/.score_breakdown`) used consistently.
