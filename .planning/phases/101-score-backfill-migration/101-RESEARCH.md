# Phase 101: Score Backfill & Migration - Research

**Researched:** 2026-03-11
**Domain:** Backend score re-computation, API schema migration, tile endpoint updates
**Confidence:** HIGH

## Summary

Phase 101 re-scores all existing parcels in completed scans using the v3.0 engine (built in Phase 100), updates the API endpoints to serve `potentie_score` and `risico_score` as first-class fields, and ensures backwards compatibility with v2.1 scan data.

The codebase already has a proven backfill pattern (`backfill_scan_scores_v2.py`) that paginates through scan_results, joins with parcel_cache, recomputes scores, and batch-updates. The v3.0 scoring logic is already integrated into the live scan pipeline (Phase 6 of `area_scan.py`). The backfill tool is essentially a standalone version of that Phase 6 logic.

**Critical gap discovered:** The API endpoints (`get_parcel_at_point`, scan results list) do NOT currently extract `potentie_score`/`risico_score` from `flags.scores`. The router only handles v2.1's `flags.factors` path. Even the `score_breakdown` extraction is broken for v3.0 data -- v3.0 stores breakdown in `flags.score_breakdown` (17 factor objects with `categorie` field), but the router looks for `flags.factors` (v2.1 5-factor flat dict). This means after backfill, the API would still return v2.1-shaped responses unless the router is updated.

**Primary recommendation:** Three-part plan: (1) backfill tool using existing pattern, (2) API endpoint updates to serve v3.0 fields, (3) tile proxy update to expose potentie/risico scores.

## Architecture Patterns

### Existing Backfill Pattern (from `backfill_scan_scores_v2.py`)
```
CLI tool → iterate organizations → paginate scan_results (batch 1000)
  → JOIN parcel_cache → compute score → batch UPDATE → commit per batch
```

Key elements:
- `async_session_factory` for standalone session (not FastAPI dependency)
- `SET app.current_tenant_id` for RLS
- Keyset pagination via `ScanResult.id > last_id`
- `bindparam` batch UPDATE for efficiency
- `--dry-run`, `--organization-id`, `--scan-id` CLI args
- Skip-unchanged optimization (compare before/after)

### v3.0 Score Data Shape in `scan_results.flags`
```json
{
  "scores": {
    "potentie": 62.5,
    "risico": 28.3,
    "overall": 34.2
  },
  "score_breakdown": {
    "vrije_grond": {
      "waarde": 0.72,
      "genormaliseerde_score": 0.72,
      "gewicht": 12,
      "bijdrage": 8.64,
      "categorie": "potentie",
      "toelichting_kort": "72% vrije grond",
      "toelichting_lang": "...",
      "data_bronnen": ["BAG", "Kadaster"],
      "missing": false
    }
  },
  "score_model_version": "score-v3.0",
  "category": "Hoog"
}
```

### v2.1 Score Data Shape in `scan_results.flags` (existing data)
```json
{
  "factors": {
    "vacancy": 0.8,
    "building_condition": 0.5,
    "zoning_potential": 0.7
  },
  "subscores": {
    "vacancy": 65,
    "buildability": 40
  },
  "score_model_version": "opportunity-score-v2.1",
  "category": "Medium"
}
```

### API Endpoint Score Extraction (NEEDS UPDATE)

The router at lines 1759-1772 currently does:
1. Look for `flags.factors` (v2.1) -> build `score_breakdown`
2. Else: dump all non-category keys as legacy breakdown

For v3.0, it should:
1. Check for `flags.score_breakdown` (v3.0 factor objects with `categorie`)
2. Extract `flags.scores.potentie` and `flags.scores.risico`
3. Fall through to existing v2.1 logic for old data

### Tile Proxy Pattern

Current tile SQL selects `sr.score` (single overall score) and `sr.flags->>'category'`. For v3.0 tiles, we need to add:
- `(sr.flags->'scores'->>'potentie')::float AS potentie_score`
- `(sr.flags->'scores'->>'risico')::float AS risico_score`

The frontend already has `potentie_score` and `risico_score` on `ScanResultDetail` type but they're never populated.

### Data Flow: parcel_data Assembly for compute_score_v3

From area_scan.py Phase 6 (lines 910-936), the parcel_data dict is built from:
- ParcelCache columns: `area_m2`, `has_pand`, `bouwjaar`, `pand_status`, `bestemmingen`
- scan_results.flags: `vacancy_signal`, `building_metrics`, `market_signals`, `bodem`, `bodemtype`, `funderingsrisico`, `energielabel`, `vergunningen`, `natura2000`, `overstromingsrisico`, `geluid`, `luchtkwaliteit`, `woz`
- AreaScan: `neighborhood_metrics` (CBS wijk data)

The backfill tool must replicate this exact assembly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Score computation | Custom scorer | `compute_score_v3()` from `app.services.score_v3` | Already built and tested in Phase 100 |
| Batch pagination | Custom cursor | Keyset pagination via `ScanResult.id > last_id` | Proven pattern in existing backfill tool |
| CLI argument parsing | Manual argv | `argparse` with `_parse_uuid` helper | Matches existing tools |
| parcel_data assembly | New builder | Copy exact pattern from area_scan.py Phase 6 (lines 910-936) | Must match live pipeline exactly |

## Common Pitfalls

### Pitfall 1: Router score_breakdown extraction broken for v3.0
**What goes wrong:** Router looks for `flags.factors` (v2.1 key). v3.0 stores factors in `flags.score_breakdown`. Without router update, API returns garbled score_breakdown for v3.0 data.
**How to avoid:** Update both `_build_parcel_at_point_response()` and the scan results list endpoint to detect v3.0 format first (`flags.score_breakdown` with objects containing `categorie`), then fall through to v2.1.

### Pitfall 2: Missing neighborhood_metrics for old scans
**What goes wrong:** `compute_score_v3` needs `neighborhood_metrics` (CBS data stored on `AreaScan.neighborhood_metrics`). Old scans might have NULL metrics. The scoring engine handles this gracefully (missing data = neutral), but the backfill must load the AreaScan to get it.
**How to avoid:** Join through `scan_results.scan_id -> area_scans.id` to get `neighborhood_metrics`. Pass `None` if absent -- v3.0 engine handles it.

### Pitfall 3: N+1 query for ParcelCache in Phase 6 pattern
**What goes wrong:** The live area_scan.py Phase 6 does an individual `SELECT ParcelCache` per scan_result (line 911). This is O(n) queries. For backfill across thousands of parcels, this is slow.
**How to avoid:** Batch-load ParcelCache by parcel_id in the same query that loads ScanResults (JOIN), matching the existing `backfill_scan_scores_v2.py` pattern at line 86-88.

### Pitfall 4: Transaction pattern mismatch
**What goes wrong:** Using `async with db.begin()` causes "transaction already begun" error.
**How to avoid:** Use direct `db.add()/db.flush()/db.commit()` pattern per project conventions.

### Pitfall 5: Old v2.1 keys must be cleaned up
**What goes wrong:** v2.1 flags contain `factors`, `subscores` keys. v3.0 adds `scores`, `score_breakdown`. If not cleaned, the flags dict has conflicting data from both versions.
**How to avoid:** Pop old keys after v3.0 scoring, exactly as area_scan.py does at lines 956-957: `flags.pop("factors", None)` and `flags.pop("subscores", None)`.

### Pitfall 6: Frontend tile schema version bump
**What goes wrong:** Browser caches old tiles without potentie_score/risico_score fields.
**How to avoid:** Bump `TILE_SCHEMA_VERSION` in `frontend/src/lib/api.ts` (currently '13') to force cache invalidation.

## Code Examples

### Backfill Tool Core Loop (adapted from v2.1 backfill + Phase 6 assembly)
```python
# Source: backend/app/tools/backfill_scan_scores_v2.py + backend/app/jobs/area_scan.py
async def _backfill_org(org_id, *, scan_id, batch_size, dry_run):
    async with async_session_factory() as session:
        await session.execute(text(f"SET app.current_tenant_id = '{org_id}'"))

        last_id = None
        while True:
            stmt = (
                select(ScanResult, ParcelCache)
                .join(ParcelCache, ParcelCache.id == ScanResult.parcel_id)
                .where(ScanResult.organization_id == org_id)
                .order_by(ScanResult.id)
                .limit(batch_size)
            )
            if last_id:
                stmt = stmt.where(ScanResult.id > last_id)

            rows = (await session.execute(stmt)).all()
            if not rows:
                break

            # Load neighborhood_metrics for unique scan_ids in batch
            scan_ids = {sr.scan_id for sr, _ in rows}
            nbhd_map = await _load_neighborhood_metrics(session, scan_ids)

            for sr, pc in rows:
                flags = dict(sr.flags) if sr.flags else {}
                parcel_data = _build_parcel_data(pc, flags)
                nbhd = nbhd_map.get(sr.scan_id)

                v3 = compute_score_v3(parcel_data, nbhd)
                overall_clamped = max(0.0, min(100.0, v3.overall))

                # Merge v3.0 data into flags
                flags["scores"] = {"potentie": v3.potentie_score, "risico": v3.risico_score, "overall": v3.overall}
                flags["score_breakdown"] = {name: asdict(factor) for name, factor in v3.score_breakdown.items()}
                flags["score_model_version"] = "score-v3.0"
                flags["category"] = v3.category
                flags.pop("factors", None)
                flags.pop("subscores", None)

                sr.score = overall_clamped
                sr.flags = flags
                session.add(sr)

            await session.flush()
            await session.commit()
            last_id = rows[-1][0].id
```

### Router v3.0 score extraction
```python
# Add to _build_parcel_at_point_response and results list endpoint
# Source: must be added to backend/app/scans/router.py

# Check v3.0 format first
v3_breakdown = scan_flags.get("score_breakdown")
if isinstance(v3_breakdown, dict):
    first_val = next(iter(v3_breakdown.values()), None)
    if isinstance(first_val, dict) and "categorie" in first_val:
        score_breakdown = v3_breakdown
        v3_scores = scan_flags.get("scores")
        if isinstance(v3_scores, dict):
            potentie_score = v3_scores.get("potentie")
            risico_score = v3_scores.get("risico")
```

### Tile proxy v3.0 columns
```sql
-- Add to tile_proxy.py MVT query
(sr.flags->'scores'->>'potentie')::float AS potentie_score,
(sr.flags->'scores'->>'risico')::float AS risico_score,
```

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BF-01 | Backfill tool re-scores all parcels in all completed scans with v3.0 engine | Existing backfill pattern in backfill_scan_scores_v2.py, v3.0 engine in score_v3.py, data assembly pattern in area_scan.py Phase 6 |
| BF-02 | Tile endpoints serve potentie_score + risico_score | tile_proxy.py needs 2 new JSONB extractions from flags.scores |
| BF-03 | Old v2.1 score_breakdown gracefully handled (backwards compatible) | Router needs v3.0 detection before v2.1 fallback, frontend already has isScoreV3() + v2.1 fallback cards |
| BF-04 | API endpoints serve potentie_score + risico_score fields | Schema needs 2 new optional fields, router needs v3.0 extraction logic |

## Key Files to Modify

| File | Change | Reason |
|------|--------|--------|
| `backend/app/tools/backfill_scan_scores_v3.py` | **NEW** | CLI backfill tool modeled on v2.1 backfill |
| `backend/app/scans/router.py` | Update score extraction in 2 places | Serve v3.0 score_breakdown + potentie/risico scores |
| `backend/app/scans/schemas.py` | Add `potentie_score`, `risico_score` fields | API contract for frontend |
| `backend/app/services/tile_proxy.py` | Add potentie/risico JSONB extractions to MVT query | Tile layer data |
| `frontend/src/lib/api.ts` | Bump `TILE_SCHEMA_VERSION` | Force browser cache refresh |

## Open Questions

None -- all components are well-understood from existing codebase patterns.

## Sources

### Primary (HIGH confidence)
- `backend/app/tools/backfill_scan_scores_v2.py` -- existing backfill pattern
- `backend/app/services/score_v3.py` -- v3.0 engine (Phase 100)
- `backend/app/jobs/area_scan.py` -- Phase 6 scoring integration
- `backend/app/services/tile_proxy.py` -- current tile SQL
- `backend/app/scans/router.py` -- current score extraction logic
- `frontend/src/lib/score.ts` -- v3.0/v2.1 detection utilities

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all components exist in codebase, no new dependencies
- Architecture: HIGH - direct adaptation of existing patterns
- Pitfalls: HIGH - identified from reading actual code paths

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable internal codebase)
