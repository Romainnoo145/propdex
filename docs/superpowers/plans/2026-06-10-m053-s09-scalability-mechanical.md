# Scalability Phase 2 / S09 — Mechanical Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Land the safe, behavior-preserving scalability fixes from the audit's Phase 2 that carry no schema/infra risk and need no product decision.

**Architecture:** Three independent refactors of existing backend job/AI code. Each is behavior-preserving (same outputs, fewer queries / non-blocking) except two trivially-correct bug fixes. Verified primarily through the existing test suite plus targeted assertions where the logic is extractable.

**Tech Stack:** FastAPI, SQLAlchemy 2.x async, asyncio, PostGIS, ARQ. Validation: `cd backend && ruff check . && mypy .` (touched files) + relevant pytest.

**Slice:** `M053/S09`. Commit prefix: `M053/S09: <what>`. Branch: `m053-s09-scalability-mechanical` (already created from main).

**Explicitly OUT of scope (deferred, do NOT touch here):**
- `area_scan.py` Phase 6 cascade dead-branch (`parcel_data` never gets `parcel_id`; `get_cascade_payloads` never runs). Latent correctness bug — needs an eng/product decision, separate work item.
- Real parallel cascade rescore (needs per-task sessions) — S11.
- Tile JSON-`null` `bestemmingen` filter — product decision (show/hide unknown-bestemming parcels) — needs user input.

---

## File Structure

| File | Change | Task |
|---|---|---|
| `backend/app/jobs/area_scan.py` | bulk-prefetch ParcelCache+perimeter per batch | 1 |
| `backend/app/jobs/rescore_cascade_job.py` | `dir()`→`locals()`; drop no-op semaphore | 2 |
| `backend/app/ai/factor_extractor.py` | `asyncio.to_thread(_pdf_to_text)` | 3 |

---

### Task 1: Eliminate per-parcel ParcelCache N+1 in area-scan Phase 6

**Problem:** In `area_scan.py` Phase 6, for every scan_result the loop issues `select(ParcelCache, ST_Perimeter(...)).where(ParcelCache.id == sr.parcel_id)` — one query per parcel (~2000 per wijk scan, 60k+ per full re-scan). Fix: prefetch all ParcelCache rows for the batch in one query, keyed by id, and look up from the dict. Behavior-preserving (identical `pc` + `perimeter_m` per parcel).

**Files:**
- Modify: `backend/app/jobs/area_scan.py` — the Phase 6 batch loop (~lines 906-925)

- [ ] **Step 1: Read the loop** (`area_scan.py` ~lines 905-1000) to confirm the exact structure. The relevant inner code is:

```python
                for batch_start in range(0, len(all_scan_results), v3_batch_size):
                    batch = all_scan_results[batch_start:batch_start + v3_batch_size]
                    for sr in batch:
                        flags = dict(sr.flags) if sr.flags else {}

                        pc_stmt = select(
                            ParcelCache,
                            func.ST_Perimeter(ParcelCache.geometry).label("perimeter_m"),
                        ).where(ParcelCache.id == sr.parcel_id)
                        pc_result = await session.execute(pc_stmt)
                        pc_row = pc_result.one_or_none()
                        pc = pc_row[0] if pc_row else None
                        perimeter_m = pc_row[1] if pc_row else None
                        ...
```

- [ ] **Step 2: Add a batch prefetch** immediately after `batch = all_scan_results[...]` and BEFORE the `for sr in batch:` loop:

```python
                    batch = all_scan_results[batch_start:batch_start + v3_batch_size]

                    # Bulk-prefetch ParcelCache + ST_Perimeter for the whole batch
                    # in ONE query instead of one query per parcel (was an N+1:
                    # ~2000 queries/wijk scan). Keyed by ParcelCache.id == sr.parcel_id.
                    batch_parcel_ids = [sr.parcel_id for sr in batch]
                    pc_prefetch_stmt = select(
                        ParcelCache,
                        func.ST_Perimeter(ParcelCache.geometry).label("perimeter_m"),
                    ).where(ParcelCache.id.in_(batch_parcel_ids))
                    pc_prefetch_result = await session.execute(pc_prefetch_stmt)
                    pc_by_id: dict = {row[0].id: row for row in pc_prefetch_result.all()}

                    for sr in batch:
                        flags = dict(sr.flags) if sr.flags else {}
```

- [ ] **Step 3: Replace the per-parcel query** with a dict lookup. Replace:

```python
                        pc_stmt = select(
                            ParcelCache,
                            func.ST_Perimeter(ParcelCache.geometry).label("perimeter_m"),
                        ).where(ParcelCache.id == sr.parcel_id)
                        pc_result = await session.execute(pc_stmt)
                        pc_row = pc_result.one_or_none()
                        pc = pc_row[0] if pc_row else None
                        perimeter_m = pc_row[1] if pc_row else None
```

with:

```python
                        pc_row = pc_by_id.get(sr.parcel_id)
                        pc = pc_row[0] if pc_row else None
                        perimeter_m = pc_row[1] if pc_row else None
```

The downstream `parcel_data` construction is unchanged.

- [ ] **Step 4: Verify imports** — `select`, `func`, `ParcelCache` are already imported (the original query uses them). Confirm with `grep -n "func\b\|ParcelCache\|^from sqlalchemy import" app/jobs/area_scan.py | head`.

- [ ] **Step 5: Import + behavior check.** Run:
  - `python -c "import app.jobs.area_scan"` (must not raise)
  - `python -m pytest tests/ -k "area_scan or scoring or score_v3 or scan" -q` — report the summary. The scoring pipeline output must be unchanged. Note (don't fix) any pre-existing failures.

- [ ] **Step 6: Lint + commit:**
```bash
ruff check app/jobs/area_scan.py
mypy app/jobs/area_scan.py
git add app/jobs/area_scan.py
git commit -m "M053/S09: bulk-prefetch ParcelCache in scan Phase 6 (kill N+1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
mypy: ignore pre-existing errors elsewhere; only new errors in this file matter.

**Note on testing:** this is a behavior-preserving refactor deep inside a large job; there is no clean unit-test seam for query-count. Verification is: identical `pc_by_id` mapping semantics (id → (pc, perimeter)) + existing scan/scoring tests still green. State this honestly in the report.

---

### Task 2: Fix rescore_cascade_job observability bug + drop no-op semaphore

**Files:**
- Modify: `backend/app/jobs/rescore_cascade_job.py` (~lines 195-226)

Two no-behavior-change fixes in `rescore_parcels_for_document`:
(a) `"affected_parcel_count": len(parcel_ids) if "parcel_ids" in dir() else 0` — `dir()` lists object attributes, never local variables, so the count is ALWAYS logged as 0. Use `locals()`.
(b) The `sem = asyncio.Semaphore(RESCORE_CONCURRENCY)` is passed to `_process_parcel` which `await`s serially in a `for` loop sharing ONE session — the semaphore provides zero concurrency and is a misleading abstraction. Remove it and document that processing is serial-by-design (shared session); real parallelism (per-task sessions) is deferred to a later slice.

- [ ] **Step 1: Read** `rescore_cascade_job.py` lines 60-95 (`_process_parcel` signature + `async with sem:` body) and lines 190-235 (the loop + event_entry).

- [ ] **Step 2: Fix the observability bug.** Replace:
```python
        "affected_parcel_count": len(parcel_ids) if "parcel_ids" in dir() else 0,
```
with:
```python
        "affected_parcel_count": len(parcel_ids) if "parcel_ids" in locals() else 0,
```

- [ ] **Step 3: Remove the no-op semaphore.**
  - In `_process_parcel`, remove the `sem: asyncio.Semaphore,` parameter and replace the `async with sem:` wrapper with a direct body (de-indent its contents by one level). Add a one-line comment at the top of the function body:
    ```python
        # NOTE (M053/S09): parcels are processed serially because all calls share
        # one AsyncSession (concurrent use of a single session is unsafe). Real
        # parallelism requires a session-per-task refactor — deferred.
    ```
  - In `rescore_parcels_for_document`, remove `sem = asyncio.Semaphore(RESCORE_CONCURRENCY)` and update the call from `await _process_parcel(session, parcel_id_str, doc, sem)` to `await _process_parcel(session, parcel_id_str, doc)`.
  - If `RESCORE_CONCURRENCY` and `import asyncio` become unused after this, remove them ONLY if nothing else in the file uses them (grep first: `grep -n "asyncio\|RESCORE_CONCURRENCY" app/jobs/rescore_cascade_job.py`). If `asyncio` is used elsewhere (e.g. `asyncio.run`), keep the import.

- [ ] **Step 4: Verify.**
  - `python -c "import app.jobs.rescore_cascade_job"` (must not raise)
  - `python -m pytest tests/ -k "rescore or cascade" -q` — report summary; note pre-existing failures, don't fix.

- [ ] **Step 5: Lint + commit:**
```bash
ruff check app/jobs/rescore_cascade_job.py
mypy app/jobs/rescore_cascade_job.py
git add app/jobs/rescore_cascade_job.py
git commit -m "M053/S09: fix rescore event-log count (dir->locals) + drop no-op semaphore

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Run PyMuPDF text extraction off the event loop

**Problem:** `factor_extractor.py` `_pdf_to_text` (sync, CPU-heavy PyMuPDF) is called directly inside `async def extract_factor_live` for oversized PDFs, blocking the worker event loop during parse. Fix: `await asyncio.to_thread(_pdf_to_text, file_data)`. Behavior-preserving (same text).

**Files:**
- Modify: `backend/app/ai/factor_extractor.py` (the `_pdf_to_text(file_data)` call site, ~line 120)

- [ ] **Step 1: Read** `factor_extractor.py` around the call site. The current line is:
```python
        text = _pdf_to_text(file_data) if is_pdf else file_data.decode("utf-8", errors="replace")
```

- [ ] **Step 2: Wrap the sync PDF parse in a thread.** Replace that line with:
```python
        text = (
            await asyncio.to_thread(_pdf_to_text, file_data)
            if is_pdf
            else file_data.decode("utf-8", errors="replace")
        )
```
This keeps the non-PDF branch synchronous (cheap `.decode()`), only offloading the CPU-heavy `_pdf_to_text`.

- [ ] **Step 3: Ensure `import asyncio` is present** at the top of `factor_extractor.py`. Run `grep -n "^import asyncio" app/ai/factor_extractor.py`; if absent, add it with the other stdlib imports.

- [ ] **Step 4: Verify.**
  - `python -c "import app.ai.factor_extractor"` (must not raise)
  - `python -m pytest tests/ -k "factor_extract or extractor or cascade or woonvisie" -q` — report summary; note pre-existing failures, don't fix.

- [ ] **Step 5: Lint + commit:**
```bash
ruff check app/ai/factor_extractor.py
mypy app/ai/factor_extractor.py
git add app/ai/factor_extractor.py
git commit -m "M053/S09: run PyMuPDF text extraction off the event loop

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Slice validation

- [ ] **Step 1:** `cd backend && ruff check app/jobs/area_scan.py app/jobs/rescore_cascade_job.py app/ai/factor_extractor.py` → expect clean.
- [ ] **Step 2:** `python -c "import app.main"` → must import cleanly (catches any broken import across the 3 files).
- [ ] **Step 3:** Run the combined touched-area suite: `python -m pytest tests/ -k "area_scan or scoring or score_v3 or rescore or cascade or extractor or scan" -q` → report the summary; classify any failure as pre-existing (with evidence) or introduced.
- [ ] **Step 4:** Use `superpowers:verification-before-completion`: confirm each of the 3 fixes maps to a committed change + green import/test, before claiming done.

---

## Self-Review

**Coverage:** N+1 prefetch (T1), dir()→locals() + semaphore (T2), async PDF (T3), validation (T4). All three in-scope safe fixes covered. The three deferred items are explicitly listed as out-of-scope with reasons.

**Placeholders:** none — every code step shows exact before/after.

**Type consistency:** `pc_by_id` is `dict[id → Row]`; `pc_row` keeps the same `(pc, perimeter_m)` tuple shape the original `.one_or_none()` returned, so downstream `pc_row[0]`/`pc_row[1]` access is unchanged.

**Honesty note:** T1/T3 are behavior-preserving refactors with no clean TDD seam (deep in jobs); they are verified by existing suites + reasoning, not new red-green tests. T2's `dir()`→`locals()` is a real correctness fix but also lacks an easy unit seam (inline in a job). This is stated in each task rather than papered over with brittle tests.
