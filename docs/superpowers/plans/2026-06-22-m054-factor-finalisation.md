# M054 Factor Finalisation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One coordinated M054 factor-set finalisation — remove `grondwaarde_fit` (weak/non-differentiating), wire up `parkeerdruk` extraction (proven valuable), and warm `woondeal` — then a single prod re-score.

**Architecture:** Phase A (this plan's Tasks 1–5) is reversible code: a full `grondwaarde_fit` removal with a potentie-weight rebalance back to 100, plus the parkeerdruk extraction-infra (an `extract_factor` text-path param, the `pymupdf` dep, and a `reextract_parkeernormen` tool). Phase B/C (the prod runbook at the end) is the controller-executed deploy + paid data-build + one `backfill_cascade_scores` re-score of 55k Venlo parcels.

**Tech Stack:** Python 3.11 (prod) / 3.14 (local), FastAPI, SQLAlchemy async, Pydantic v2, Anthropic via OpenRouter; React + TS, vitest; Railway (api/worker), Vercel (frontend); uv for deps.

## Global Constraints

- `grondwaarde_fit` must leave the registry **29 → 28 factors** (potentie 11 → 10). Two regression guards pin the count and MUST move in lockstep: `backend/tests/regression/test_score_v3_registry_29_factors.py` and `backend/tests/regression/test_woondeal_is_context_only.py`.
- **Potentie category must still sum to exactly 100** after removal. Rebalance = reverse the M054/S01 core trims: `bestemming 9→11`, `leegstand 6→7`, `perceelgrootte 9→11`, `demografie 7→8`, `vergunning_succeskans 11→13`. (New core 78 + woonvisie 12 + beleidsalignement 10 = 100.) The per-projecttype sum-guard `_verify_registry_sum_guard` must still pass.
- Force the text-layer extraction path with `max_pdf_doc_bytes=1` (native-PDF extraction returns empty `{}` on Sonnet via OpenRouter). `extract_factor_live` already accepts `max_pdf_doc_bytes` (default 30 MB); only `extract_factor` needs the param + forward.
- Extraction model = `anthropic/claude-sonnet-4.5` (Haiku returns empty). Parkeer extraction ≈ $0.60.
- Backend validation per change: from `backend/`, `ruff check .` (on touched files) + `mypy` on touched files + the named tests.
- Frontend validation per change: from `frontend/`, `npm run check` (0 errors) + named vitest.
- Commit prefix `M054/S07: <wat>`.
- **git add ONLY the files each task touches.** Untracked `.polly/` + `roadmap_documentatie_propdex.md` exist — NEVER `git add .`.
- Line numbers in the removal map below are point-in-time and SHIFT as edits land. Match by the symbol, not the line number; after each removal task, run the repo-wide grep in its final step to prove zero stragglers.

---

### Task 1: Backend — remove grondwaarde_fit from the scoring core + rebalance + guards

**Files:**
- Modify: `backend/app/services/score_v3.py` (FACTOR_REGISTRY entry, import, `CASCADE_GATED_FACTORS`, verdict-gated wiring block, rebalance comments)
- Modify: `backend/app/services/score_v3_factors.py` (`score_grondwaarde_fit` fn, its import, its module constants)
- Modify: `backend/tests/regression/test_score_v3_registry_29_factors.py` (29→28, drop key, rename count test, delete the "present" canary)
- Modify: `backend/tests/regression/test_woondeal_is_context_only.py` (`== 29` → `== 28`)

**Interfaces:**
- Produces: `FACTOR_REGISTRY` with 28 entries, potentie summing to 100, no `grondwaarde_fit`. `compute_score_v3` no longer references grondwaarde.

- [ ] **Step 1: Make the regression guards the failing test (RED)**

Edit `test_score_v3_registry_29_factors.py`:
- Drop `"grondwaarde_fit",` from `KNOWN_29_FACTOR_KEYS` (the potentie block); change its comment `# Potentie (11)` → `# Potentie (10)`.
- Rename `test_registry_count_is_29` → `test_registry_count_is_28`; change `assert len(FACTOR_REGISTRY) == 29` → `== 28` and the message text.
- Delete the canary test `test_grondwaarde_fit_present_as_potentie` entirely.
- Update the module docstring count `29` → `28` and drop the `grondwaarde_fit added in M054/S01` line.

Edit `test_woondeal_is_context_only.py`: change `assert len(FACTOR_REGISTRY) == 29` → `== 28` (and the `test_registry_count_still_29` name → `_28`).

- [ ] **Step 2: Run guards to verify they now FAIL (registry still has grondwaarde = 29)**

Run: `cd backend && python -m pytest tests/regression/test_score_v3_registry_29_factors.py tests/regression/test_woondeal_is_context_only.py -q`
Expected: FAIL — count is still 29 and KNOWN set mismatches (extra `grondwaarde_fit`).

- [ ] **Step 3: Remove grondwaarde from `score_v3.py`**

Delete, in `backend/app/services/score_v3.py`:
- the `"grondwaarde_fit": FactorRegistryEntry(...)` registry entry (and its `# --- M054/S01 grondwaarde_fit ...` marker comment);
- `"grondwaarde_fit",` from the `CASCADE_GATED_FACTORS` frozenset;
- `score_grondwaarde_fit,` from the `from app.services.score_v3_factors import (...)` block;
- the entire verdict-gated wiring block (`# Cascade factor: grondwaarde_fit ...` through `breakdown["grondwaarde_fit"] = _gf_result`);
- the grondwaarde line in the `CASCADE_GATED_FACTORS` docstring comment.

Apply the **rebalance** in the FACTOR_REGISTRY potentie entries:
- `bestemming`: `default_weight=9` → `11`
- `leegstand`: `default_weight=6` → `7`
- `perceelgrootte`: `default_weight=9` → `11`
- `demografie`: `default_weight=7` → `8`
- `vergunning_succeskans`: `default_weight=11` → `13`

Update the M054/S01 rebalance comment (the block stating "grondwaarde_fit (8) freed from no-override potentie factors ...") to read that M054/S07 removed grondwaarde_fit and restored those 5 core weights; potentie cascades are now woonvisie 12 + beleidsalignement 10.

- [ ] **Step 4: Remove `score_grondwaarde_fit` from `score_v3_factors.py`**

Delete: the `def score_grondwaarde_fit(...)` function in full; the `from app.ai.factors.grondwaarde_fit import GrondprijzenPayload` import (in the TYPE_CHECKING block); the module constants used only by it (`_PRIJSGRONDSLAG_PREF`, `_GRONDWAARDE_CONTEXT_DAMPING`).

- [ ] **Step 5: Run guards + sum-guard to verify GREEN**

Run: `cd backend && python -m pytest tests/regression/test_score_v3_registry_29_factors.py tests/regression/test_woondeal_is_context_only.py -q && python -c "from app.services.score_v3 import FACTOR_REGISTRY as R; p=sum(e.default_weight for e in R.values() if e.category=='potentie'); print('potentie sum', p, 'count', len(R)); assert p==100 and len(R)==28"`
Expected: tests pass; prints `potentie sum 100 count 28`. (The `_verify_registry_sum_guard` runs at import — a non-100 sum raises there.)

- [ ] **Step 6: ruff + mypy on touched files**

Run: `cd backend && ruff check app/services/score_v3.py app/services/score_v3_factors.py && mypy app/services/score_v3.py app/services/score_v3_factors.py`
Expected: clean (mypy may surface only pre-existing baseline lines unrelated to grondwaarde).

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/score_v3.py backend/app/services/score_v3_factors.py backend/tests/regression/test_score_v3_registry_29_factors.py backend/tests/regression/test_woondeal_is_context_only.py
git commit -m "M054/S07: remove grondwaarde_fit from scoring core + potentie rebalance (29→28)"
```

---

### Task 2: Backend — remove grondwaarde plumbing, files, and tests

**Files:**
- Modify: `backend/app/services/cascade_enrichment_service.py` (import, `get_grondprijs_document`, enrichment block)
- Modify: `backend/app/services/cascade_scoring.py` (2 imports, `_CASCADE_SOURCES` entry)
- Modify: `backend/app/policy_documents/extraction_status.py` (`CASCADE_SOURCE_FACTORS` entry)
- Modify: `backend/app/policy_documents/data_source_keys.py` (`grondprijsbeleid` entry)
- Delete: `backend/app/ai/factors/grondwaarde_fit.py`, `backend/app/tools/seed_grondprijzen_venlo.py`
- Delete: the grondwaarde-specific unit tests — `backend/tests/unit/test_compute_score_v3_grondwaarde_fit.py`, `test_grondwaarde_fit_schema.py`, `test_score_grondwaarde_fit.py`, `test_registry_grondwaarde_fit_rebalance.py` (verify each exists first; delete those that do)
- Modify: `backend/tests/test_score_v3.py` (drop grondwaarde from the expected-keys set + count 29→28), `backend/tests/integration/test_m045_policy_summaries_cascade.py` (drop the grondwaarde line)

**Interfaces:**
- Consumes: Task 1's grondwaarde-free registry.
- Produces: no backend module imports `grondwaarde_fit` / `GrondprijzenPayload` / `GRONDPRIJS_FACTOR_DEF` / `get_grondprijs_document`.

- [ ] **Step 1: Remove all plumbing references**

In `cascade_enrichment_service.py`: delete the `from app.ai.factors.grondwaarde_fit import GRONDPRIJS_FACTOR_DEF` import, the `get_grondprijs_document(...)` function, and the `# grondwaarde_fit (grondprijzenbrief) — M054/S01` try-block in `get_cascade_payloads`.
In `cascade_scoring.py`: delete `from app.ai.factors.grondwaarde_fit import GrondprijzenPayload`, the `get_grondprijs_document,` name from the `cascade_enrichment_service` import, and the `("grondwaarde_fit", get_grondprijs_document, GrondprijzenPayload),` line in `_CASCADE_SOURCES`.
In `extraction_status.py`: delete `"grondprijsbeleid": "grondwaarde_fit",` from `CASCADE_SOURCE_FACTORS`.
In `data_source_keys.py`: delete the `DataSourceKeyEntry(key="grondprijsbeleid", ...)` entry.

- [ ] **Step 2: Delete the factor file, seed tool, and grondwaarde unit tests**

```bash
cd backend
git rm app/ai/factors/grondwaarde_fit.py app/tools/seed_grondprijzen_venlo.py
for f in test_compute_score_v3_grondwaarde_fit test_grondwaarde_fit_schema test_score_grondwaarde_fit test_registry_grondwaarde_fit_rebalance; do
  [ -f "tests/unit/$f.py" ] && git rm "tests/unit/$f.py"
done
```

- [ ] **Step 3: Fix the broad backend tests**

In `tests/test_score_v3.py`: drop `"grondwaarde_fit",` from the expected potentie-keys set, update its `# Potentie (11)` comment → `(10)`, and any `== 29` → `== 28`.
In `tests/integration/test_m045_policy_summaries_cascade.py`: delete the `grondwaarde_fit` line (the test setup that seeds it).

- [ ] **Step 4: Prove zero backend stragglers**

Run: `cd backend && grep -rn "grondwaarde_fit\|GrondprijzenPayload\|GRONDPRIJS_FACTOR_DEF\|get_grondprijs_document\|score_grondwaarde_fit\|grondprijsbeleid" app tests || echo "CLEAN"`
Expected: `CLEAN` (no matches).

- [ ] **Step 5: Run the affected backend suites + ruff/mypy**

Run: `cd backend && ruff check app tests 2>&1 | grep -i grond || echo "no grond ruff errors" ; python -m pytest tests/unit tests/regression tests/integration/test_m045_policy_summaries_cascade.py -q 2>&1 | tail -8`
Expected: no grond references; suites green (collection no longer errors on deleted imports).

- [ ] **Step 6: Commit**

```bash
git add -A backend/app backend/tests
git commit -m "M054/S07: remove grondwaarde_fit plumbing, factor file, seed tool + tests"
```

---

### Task 3: Frontend — remove grondwaarde_fit

**Files:**
- Delete: `frontend/src/components/map/panels/parcel/GrondprijsPopup.tsx`, `frontend/src/components/map/panels/parcel/__tests__/GrondprijsPopup.test.tsx`, `frontend/src/stories/parcel/GrondprijsPopup.stories.tsx`
- Modify: `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` (FACTOR_LABELS entry, POTENTIE_KEYS, the `case 'grondwaarde_fit'` block in `formatFactorValue`, the `GrondwaardeFitWaarde` interface, `GRONDPRIJS_ACTIVE_VERDICTS`, the `grondprijsFactor`/`grondprijsWaarde`/`hasGrondprijsData` block, the cardClick guard line, the `<GrondprijsPopup ...>` render block, the `GrondprijsPopup` import)
- Modify: `frontend/src/lib/factor-groups.ts` (grondwaarde_fit FACTOR_BRON line), `frontend/src/lib/constants/dataSourceKeys.ts` (grondprijsbeleid entry), `frontend/src/components/map/panels/parcel/lib/factor-detail.ts` (drop from `CASCADE_FACTOR_KEYS`, comment five→four), `frontend/src/components/map/panels/parcel/FactorDetailDrawer.tsx` (comment + import list)
- Modify: coverage/list tests — `.../layers/__tests__/PotentieLayer.factor-coverage.test.tsx` (KNOWN_11→10, drop key, delete the 4 grondwaarde test cases), `.../layers/__tests__/RisicoLayer.factor-coverage.test.tsx` (KNOWN_29→28, drop key, slice(11)→slice(10), count 29→28), `.../lib/__tests__/factor-list.test.ts` (drop from liveKeys), `.../lib/__tests__/factor-detail.test.ts` (five→four, size 5→4)
- Modify (if present — grep first): `frontend/src/stories/parcel/PotentieLayer.stories.tsx`, `ParcelDetailPanelRedesign.stories.tsx` (mock grondwaarde_fit lines), `frontend/src/components/configuratie/sourceGuidance.ts` (grondprijsbeleid entry), `frontend/src/components/map/panels/parcel/lib/factor-icons.ts` (grondwaarde_fit icon line)

**Interfaces:**
- Consumes: backend now omits grondwaarde from `score_breakdown`.
- Produces: no frontend module references grondwaarde_fit / GrondprijsPopup / grondprijsbeleid.

- [ ] **Step 1: Delete the three GrondprijsPopup files**

```bash
cd frontend
git rm src/components/map/panels/parcel/GrondprijsPopup.tsx \
       src/components/map/panels/parcel/__tests__/GrondprijsPopup.test.tsx \
       src/stories/parcel/GrondprijsPopup.stories.tsx
```

- [ ] **Step 2: Strip all remaining references**

Edit the files in the **Files** list above, removing every `grondwaarde_fit` / `GrondprijsPopup` / `grondprijsbeleid` / `GrondwaardeFitWaarde` / `GRONDPRIJS_*` reference (the removal map in `docs/superpowers/plans/` companion notes the exact symbols). Update the coverage-test counts (`11→10`, `29→28`, `slice(11)→slice(10)`, `CASCADE_FACTOR_KEYS.size 5→4`) and the "five cascade keys"→"four" copy. Match by symbol; some line numbers will have shifted.

- [ ] **Step 3: Prove zero frontend stragglers**

Run: `cd frontend && grep -rn "grondwaarde_fit\|GrondprijsPopup\|grondprijsbeleid\|GrondwaardeFit\|GRONDPRIJS" src || echo "CLEAN"`
Expected: `CLEAN`.

- [ ] **Step 4: Typecheck + the touched vitest suites**

Run: `cd frontend && npm run check 2>&1 | grep -iE "error" | grep -iv warning || echo "0 errors"; npm run vitest -- factor-coverage factor-list factor-detail 2>&1 | tail -8`
Expected: 0 type errors; the coverage/list/detail suites pass with the new counts (10 potentie / 28 total / 4 cascade keys).

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "M054/S07: remove grondwaarde_fit from frontend (GrondprijsPopup + Potentie wiring + tests)"
```

---

### Task 4: Backend — add `max_pdf_doc_bytes` to `extract_factor`

**Files:**
- Modify: `backend/app/services/factor_extraction_service.py` (`extract_factor` signature + forward to `extract_factor_live`)
- Test: `backend/tests/unit/test_extract_factor_max_pdf_doc_bytes.py`

**Interfaces:**
- Consumes: `extract_factor_live(..., max_pdf_doc_bytes: int = _MAX_PDF_DOC_BYTES)` — already exists in `backend/app/ai/factor_extractor.py`.
- Produces: `extract_factor(db, *, factor_def, parcel_id, policy_document, claude_client=None, force_refresh=False, max_pdf_doc_bytes: int | None = None)` — forwards the value to `extract_factor_live` only when not None.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/unit/test_extract_factor_max_pdf_doc_bytes.py
import inspect

from app.services.factor_extraction_service import extract_factor


def test_extract_factor_accepts_max_pdf_doc_bytes():
    params = inspect.signature(extract_factor).parameters
    assert "max_pdf_doc_bytes" in params
    assert params["max_pdf_doc_bytes"].default is None
```

- [ ] **Step 2: Run it (RED)**

Run: `cd backend && python -m pytest tests/unit/test_extract_factor_max_pdf_doc_bytes.py -q`
Expected: FAIL — `max_pdf_doc_bytes` not in signature.

- [ ] **Step 3: Add the param + forward it**

In `backend/app/services/factor_extraction_service.py`, add `max_pdf_doc_bytes: int | None = None,` to the `extract_factor` signature (after `force_refresh: bool = False,`). At the `extract_factor_live(...)` call site, forward conditionally:

```python
    live_kwargs: dict[str, Any] = (
        {} if max_pdf_doc_bytes is None else {"max_pdf_doc_bytes": max_pdf_doc_bytes}
    )
    result = await extract_factor_live(
        factor_def=factor_def,
        parcel_id=parcel_id,
        policy_document=policy_document,
        claude_client=claude_client,
        **live_kwargs,
    )
```

(Ensure `Any` is imported from `typing` in that module — it almost certainly already is; if not, add it.)

- [ ] **Step 4: Run it (GREEN) + ruff/mypy**

Run: `cd backend && python -m pytest tests/unit/test_extract_factor_max_pdf_doc_bytes.py -q && ruff check app/services/factor_extraction_service.py && mypy app/services/factor_extraction_service.py`
Expected: pass; ruff/mypy clean on the file.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/factor_extraction_service.py backend/tests/unit/test_extract_factor_max_pdf_doc_bytes.py
git commit -m "M054/S07: extract_factor forwards max_pdf_doc_bytes (force text-layer path)"
```

---

### Task 5: Backend — add `pymupdf` dep + `reextract_parkeernormen` tool

**Files:**
- Modify: `backend/pyproject.toml` (add `pymupdf` to `dependencies`), regenerate `backend/uv.lock`
- Create: `backend/app/tools/reextract_parkeernormen.py`

**Interfaces:**
- Consumes: `PARKEERNORMEN_FACTOR_DEF` (`app/ai/factors/parkeerdruk.py`, factor_id `"parkeerdruk"`), `extract_factor` with `max_pdf_doc_bytes` (Task 4), source_key `"parkeerbeleid"`.

- [ ] **Step 1: Add `pymupdf` to dependencies + lock**

In `backend/pyproject.toml`, add `"pymupdf>=1.24.0",` to the `dependencies` list (alphabetical-ish; the text-path `fitz` import in `app/ai/factor_extractor.py` needs it). Then:

```bash
cd backend && uv lock
```
Expected: `uv.lock` updates to include pymupdf with no resolution errors.

- [ ] **Step 2: Create the re-extraction tool** (clone of `reextract_omgevingsvisie.py`)

```python
# backend/app/tools/reextract_parkeernormen.py
"""One-off: force a live re-extraction of the Venlo Nota parkeernormen at the current
SCHEMA_VERSION (M054/S07 — populates the parkeerdruk cache). Forces the text-layer path
(max_pdf_doc_bytes=1) because native-PDF extraction returns empty on Sonnet via OpenRouter.

Usage:
    python -m app.tools.reextract_parkeernormen [--gemeente GM0983]
"""

import argparse
import asyncio

from sqlalchemy import or_, select

from app.ai.factor_extraction_schemas import DOCUMENT_SENTINEL
from app.ai.factors.parkeerdruk import PARKEERNORMEN_FACTOR_DEF
from app.core.config import settings
from app.core.database import async_session_factory
from app.models.policy_document import PolicyDocument
from app.services.factor_extraction_service import extract_factor


async def main(gemeente: str, model: str | None) -> None:
    if model:
        settings.AI_MODEL = model
        print(f"Using model override: {model}")
    async with async_session_factory() as db:
        stmt = (
            select(PolicyDocument)
            .where(
                PolicyDocument.entity_type == "gemeente",
                PolicyDocument.entity_code == gemeente,
                PolicyDocument.source_key == "parkeerbeleid",
                or_(PolicyDocument.is_global.is_(True), PolicyDocument.file_data.isnot(None)),
                PolicyDocument.file_data.isnot(None),
            )
            .order_by(PolicyDocument.version_number.desc(), PolicyDocument.created_at.desc())
            .limit(1)
        )
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if doc is None:
            print(f"No parkeerbeleid document found for gemeente={gemeente}")
            return

        print(f"Re-extracting parkeernormen doc={doc.id} (force_refresh, text-path, live)…")
        result = await extract_factor(
            db,
            factor_def=PARKEERNORMEN_FACTOR_DEF,
            parcel_id=DOCUMENT_SENTINEL,
            policy_document=doc,
            force_refresh=True,
            max_pdf_doc_bytes=1,
        )
        p = result.payload
        print(f"Done. confidence={p.confidence}")
        # Print a couple of identifying fields without assuming the full shape:
        for field in ("normbanden", "randvoorwaarden"):
            val = getattr(p, field, None)
            if val is not None:
                print(f"  {field}={len(val)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--gemeente", default="GM0983")
    parser.add_argument("--model", default="anthropic/claude-sonnet-4.5")
    args = parser.parse_args()
    asyncio.run(main(args.gemeente, args.model))
```

(Before committing, open `app/ai/factors/parkeerdruk.py` and confirm the `ParkeernormenPayload` field names used in the print loop — adjust `("normbanden", "randvoorwaarden")` to real field names if they differ; the print is cosmetic, so a missing field just won't print.)

- [ ] **Step 3: Verify imports resolve (no live call)**

Run: `cd backend && python -m app.tools.reextract_parkeernormen --help && ruff check app/tools/reextract_parkeernormen.py && mypy app/tools/reextract_parkeernormen.py`
Expected: argparse help prints (imports resolve); ruff/mypy clean.

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/uv.lock backend/app/tools/reextract_parkeernormen.py
git commit -m "M054/S07: add pymupdf dep + reextract_parkeernormen tool (text-path)"
```

---

## Phase B/C — Prod runbook (controller-executed, NOT subagents)

These steps are paid and/or overwrite prod scores. Execute sequentially with a checkpoint before the re-score. The user has authorised the deploy-via-push, the factor removal, the 55k re-score, and the ~$0.60 parkeer extraction.

- [ ] **B1 — Merge + deploy.** Merge `m054-s07-factor-finalisation` → `main` (`--no-ff`). Run the full local gate (`backend` ruff + the regression/unit suites; `frontend` `npm run check` + the coverage suites). Then **`git push origin main`** → Railway auto-deploys `api` + Vercel auto-deploys frontend. Worker (it imports the cascade services): `railway up backend --path-as-root --service worker --ci`, then confirm the ARQ heartbeat in worker logs. Verify api healthy (`railway status` Online, no Deploy-failed).
- [ ] **B2 — Point tools at prod DB.** `export DATABASE_URL=postgresql+asyncpg://postgres:<pw>@gondola.proxy.rlwy.net:39031/railway` (PostGIS public proxy; not Railway ssh).
- [ ] **B3 — Upload + seed the source docs to prod.**
  - **Woondeal:** in the prod data-bronnen UI (now showing the provincie slot after deploy), upload the Woondeal Limburg PDF under **Limburg (PV31)** → `source_key=woondeals` (superadmin).
  - **Parkeernormen:** `python -m app.tools.seed_parkeernormen_venlo --pdf "/home/klarifai/Documents/Propdex/487381-2026-Bijl01-Nota-Parkeernormen-Venlo-2026.pdf"` (seeds `GM0983` / `parkeerbeleid`).
- [ ] **B4 — Warm the caches (paid extractions).**
  - `python -m app.tools.reextract_parkeernormen` (≈$0.60, sonnet-4.5, text-path).
  - `python -m app.tools.reextract_woondeal --provincie PV31` (woondeal context cache).
  - Confirm each printed a non-empty payload (parkeer: normbanden > 0; woondeal: Venlo opgave 1.745).
- [ ] **B5 — CHECKPOINT.** Report payload results to the user before the re-score (last reversible point).
- [ ] **B6 — One re-score of Venlo.** `python -m app.tools.backfill_cascade_scores --gemeente GM0983`. This reads the cache, re-scores the ~55k scan_results with parkeerdruk now populated + grondwaarde removed + potentie rebalanced. (Single pass — do NOT run per-factor.)
- [ ] **B7 — Bump tiles + redeploy frontend.** In `frontend/src/lib/api.ts`, `TILE_SCHEMA_VERSION = '16'` → `'17'`; commit (`M054/S07: bump TILE_SCHEMA_VERSION 16→17 (parkeerdruk live, grondwaarde out)`) + push (Vercel).
- [ ] **B8 — Verify on prod.** Spot-check Venlo parcels: `parkeerdruk` present in `score_breakdown` with verdict variation across gebieden (centrum vs schil vs buitengebied); `woondeal` context renders in the gemeente panel + parcel card; `grondwaarde_fit` absent from every breakdown and from the registry; map shows parkeerdruk differentiation. Report final state + update memory/ledger.

---

## Self-Review

**Spec coverage (handoff):**
- (1) grondwaarde_fit full removal + registry 29→28 + rebalance + guards → Tasks 1–3. ✓
- (2) parkeerdruk build: `max_pdf_doc_bytes` param → Task 4; `pymupdf` dep + `reextract_parkeernormen` → Task 5; seed (exists) + extract + re-score → B3/B4/B6. ✓ Gotchas covered: text-path via `max_pdf_doc_bytes=1` (Task 5 tool + B4), pymupdf in deps (Task 5), sonnet-4.5 model default (Task 5 tool). ✓
- (3) woondeal warmed in the same batch → B3 (upload) + B4 (reextract). ✓
- One coordinated re-score + tiles bump + deploy → B1/B6/B7. ✓

**Placeholder scan:** Removal tasks intentionally use "remove every reference to <symbol> + grep-clean" rather than enumerating shifting line numbers — each ends with a concrete grep gate proving zero stragglers. The one "verify field names" note in Task 5 names the file to check and states the fallback (cosmetic print). No TBD/TODO.

**Type/consistency:** `max_pdf_doc_bytes: int | None = None` consistent across Task 4 (added) and Task 5 (used as `=1`). Rebalance arithmetic verified: new potentie core 13+11+11+7+4+11+8+13 = 78, +12+10 = 100. Counts consistent: registry 28, potentie 10, cascade-keys 4, KNOWN_29→28 everywhere. `extract_factor_live` already has the param (no second-site change).
