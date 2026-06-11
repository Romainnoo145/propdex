# Cascade Scoring End-to-End — Design

**Date:** 2026-06-11
**Slice:** M053/S10
**Status:** Approved (design) — pending spec review → implementation plan

## Problem

Cascade factors (`woonvisie_match`, `beleidsalignement`/omgevingsvisie) are supposed to be part of every parcel's score. Today, **only a manual backfill script** (`app/tools/backfill_cascade_scores.py`) actually computes them. The two automatic paths are broken:

1. **Scan path** (`app/jobs/area_scan.py` Phase 6) — the only runtime code that *computes* cascade factors into the score breakdown is `compute_score_v3(cascade_payloads=...)`. But the inline cascade fetch is dead: `parcel_data` (line ~923) never has `parcel_id` set, so `_parcel_id_str` (line ~953) is always `""`, the `if org_id and _parcel_id_str` guard never passes, `cascade_payloads` is always `{}`, and `score_woonvisie_match(None, ...)` yields a missing factor. **Scans produce no cascade scores.**

2. **Document add/update path** (`app/jobs/rescore_cascade_job.py::rescore_parcels_for_document` → `_process_parcel`) — already auto-triggered on document add (via `upload_enqueue.py`, `auto_ingest_job.py`, `document_summary.py`, `data_source_probe_orchestrator.py`). But `_process_parcel` only (a) refreshes the extraction cache, (b) re-weights the **existing** breakdown via `_rescore_from_breakdown`, and (c) stamps `cascade_rescored_at`. It does **not** recompute the `woonvisie_match`/`beleidsalignement` factor scores. So adding/updating a woonvisie does **not** change parcels' cascade scores.

The result: cascade scores exist on prod (Venlo, 55k) only because the backfill was run by hand on 2026-06-09. A fresh scan, or a real woonvisie update, would not produce/update them.

## Goal

Make cascade scoring work automatically end-to-end:
- **Scans** compute cascade scores inline → a scan yields complete scores.
- **Document add/update** recomputes cascade factor scores for the whole gemeente, automatically and immediately (background job; the trigger already exists). User decision 2026-06-11: "automatic, right away."
- **No duplicate scoring logic** — one shared compute path, three callers (scan, rescore job, backfill).

## Cost model (why this is affordable)

The AI *extraction* of a document is **document-level** (`extract_factor(parcel_id=DOCUMENT_SENTINEL)`) — run once per gemeente document and cached in `factor_extraction_cache`. The per-parcel work is pure computation (`compute_score_v3` matching the parcel against the cached payload) — **no AI call per parcel**. So recomputing a 55k-parcel gemeente = 1 cached payload read + 55k local score computations (minutes, background). The backfill already proves this ("zero-cost approach... without any Claude API calls").

## Approach: one shared cascade-compute service

Extract the backfill's proven core into a reusable service (proposed: `app/services/cascade_scoring.py`), with two clear units:

1. **`load_gemeente_cascade_payloads(session, gemeente_code, organization_id) -> dict[str, payload]`** — fetch the woonvisie + omgevingsvisie payloads ONCE per gemeente from `factor_extraction_cache` (keyed by document + factor + `SCHEMA_VERSION`). Returns `{}` / partial when a document or its cached extraction is absent. (Generalizes the backfill's `_load_woonvisie_payload`/`_load_omgevingsvisie_payload`.)

2. **`recompute_scan_result_cascade(scan_result, parcel_cache, perimeter_m, wijk_naam, nbhd_metrics, cascade_payloads, *, custom_weights, balance) -> bool`** — build `parcel_data` from the scan_result + parcel_cache (the same fields Phase 6 builds), call `compute_score_v3(..., cascade_payloads=cascade_payloads)`, write the resulting breakdown + scores back onto the scan_result. Returns whether it changed. (Generalizes the backfill's per-parcel loop body.)

### Three callers

- **Scan** (`area_scan.py` Phase 6): the cascade payloads are gemeente-level (identical for every parcel — per-parcel matching happens *inside* `compute_score_v3`). So **delete the dead per-parcel `get_cascade_payloads` block entirely** (the `_parcel_id_str` guard and the per-parcel fetch) and instead call `load_gemeente_cascade_payloads` ONCE before the batch loop, passing the same result into the existing `compute_score_v3(..., cascade_payloads=...)` call for every parcel. This both fixes the dead branch and removes any N+1 by construction — payloads are loaded once, not per parcel.
- **Document rescore** (`rescore_cascade_job.py::_process_parcel`): replace the re-weight-only body with `recompute_scan_result_cascade` using freshly-loaded gemeente payloads. Load payloads once per job run (not per parcel). This makes document add/update actually recompute cascade scores. Keep the existing extraction-cache refresh (so the payload is fresh) before loading.
- **Backfill** (`backfill_cascade_scores.py`): refactor to call the shared service, so the manual tool and the automatic paths cannot drift.

## Data flow (after)

```
Add/update woonvisie doc → (existing enqueue) → rescore_parcels_for_document
    → refresh extraction cache → load_gemeente_cascade_payloads (once)
    → recompute_scan_result_cascade per parcel → scores updated. ✅ automatic

Scan area → Phase 6 → load_gemeente_cascade_payloads (once)
    → compute_score_v3(cascade_payloads=...) per parcel → complete scores. ✅

Manual backfill → load_gemeente_cascade_payloads + recompute_scan_result_cascade
    (same shared path; result unchanged, logic deduplicated).
```

## Safety: score-parity verification (hard requirement, in the plan)

This change makes scans/rescore produce cascade scores they currently omit — i.e. it **changes scores**. Because prod Venlo was already backfilled with the *same* `compute_score_v3` math, re-running the shared path on already-backfilled parcels must produce the **same** breakdown/scores. The plan MUST include a parity check: run the new shared compute against a sample of already-backfilled Venlo `scan_results` (read-only / dry-run) and assert the resulting `woonvisie_match` + `beleidsalignement` genormaliseerde_score and the overall score match the stored values within tolerance. Ship only after parity holds.

## Testing

- **Unit:** `load_gemeente_cascade_payloads` returns the cached payloads when present, `{}`/partial when a document or cached extraction is absent.
- **Unit:** `recompute_scan_result_cascade` on a v3.0 scan_result with a woonvisie payload yields a non-null `woonvisie_match` in the breakdown and a changed overall; on a non-v3.0 row it is a no-op.
- **Regression (the core bug):** a scanned parcel in a gemeente that has a woonvisie document ends up with a non-null `woonvisie_match` factor (today it is null). This fails before the fix, passes after.
- **Regression:** after a simulated document update + rescore job, an affected parcel's `woonvisie_match` reflects the new payload (not a stale/re-weighted old value).
- **Parity:** the sample parity check above, as an explicit verification step.

## Out of scope (deferred)

- Per-org scoring redesign (shared `scan_results` vs per-tenant) — separate Phase 3 item.
- Real parallelism in the rescore job (per-task sessions) — `_process_parcel` stays serial (documented in S09).
- Progress/status surfacing for the rescore job (user chose "automatic, right away", not the visible-progress option).
- Other Phase 2 scalability items (S11 tile/index/queue, query bounds) — separate slices.

## Risks

- **Score shifts:** mitigated by the parity check before ship. If parity reveals intentional differences (e.g. the dead path meant some parcels never got a factor that backfill added), surface them rather than silently shipping.
- **Rescore job cost at scale:** whole-gemeente recompute is minutes for 55k parcels; acceptable as a background job per the user decision. Larger gemeentes (Amsterdam ~80k) scale linearly; batching already exists in the rescore loop. The serial-session limitation (S09) bounds throughput but does not block correctness.
- **Extraction cache missing:** if a document's extraction isn't cached yet (first ingest), the rescore job already refreshes the cache before loading; the scan path loads whatever is cached and degrades gracefully (factor missing, as today).
