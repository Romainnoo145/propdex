# Phase 63: Venlo Data Completeness - Research

**Researched:** 2026-03-01
**Domain:** Data pipeline execution, CLI tooling, data validation
**Confidence:** HIGH

## Summary

Phase 63 is a data operations phase, not a feature development phase. The scan pipeline (Phase 62) and data models are already complete and battle-tested. The primary work is: (1) executing a full --force-all re-scan of all 21 Venlo wijken using the existing `run_gemeente_wijk_scans.py` CLI tool, (2) running the existing `backfill_parcel_addresses.py` tool to resolve addresses for parcels with buildings, (3) formalizing the `parcel_addressing.py` service (currently unstaged), and (4) building a reusable validation CLI tool that verifies bouwjaar population, address resolution, and opportunity score correctness.

The codebase already contains all the infrastructure needed. The scan pipeline (`area_scan_job`) handles BAG WFS retry, coverage tracking, address resolution, and scoring. The backfill tool handles address resolution for parcels that missed it. The `parcel_addressing.py` service exists but is unstaged. The main gap is a validation tool that can query the database post-scan and report on data quality metrics.

**Primary recommendation:** Build a single `validate_scan_data.py` CLI tool, stage and commit `parcel_addressing.py`, then run the scan and backfill tools sequentially, validating after each step.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Re-scan all 21 Venlo wijken with fresh scans using Phase 62 pipeline improvements
- Build a reusable CLI validation tool (not Venlo-specific)
- Include and formalize the parcel_addressing.py service in this phase
- Fix pipeline bugs within this phase if discovered during scanning

### Claude's Discretion
None specified -- all decisions were locked by user.

### Deferred Ideas (OUT OF SCOPE)
None specified.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | All 21 Venlo wijken appear in scan history with correct parcel counts | Existing `run_gemeente_wijk_scans.py --force-all` handles re-scan; validation tool verifies parcel counts |
| DATA-02 | Parcels with BAG buildings show bouwjaar populated (not null) | Scan pipeline already derives bouwjaar from BAG WFS `_derive_bag_attributes_for_parcel`; validation tool checks null rates |
| DATA-03 | Parcels with buildings show resolved Dutch address via PDOK reverse geocoding | Pipeline resolves addresses in Phase 5; `backfill_parcel_addresses.py` catches stragglers; validation tool verifies |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy 2.x | 2.x | Database queries in validation tool | Already used everywhere |
| asyncpg | - | PostgreSQL async driver | Already configured |
| httpx | - | HTTP client for PDOK APIs | Already used in all API clients |
| arq | - | Background job queue for scans | Already configured with Redis |
| argparse | stdlib | CLI argument parsing for tools | Pattern established in existing tools |
| shapely | - | Geometry operations | Already used in scan pipeline |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| aiolimiter | - | Rate limiting for PDOK API calls | Already configured in rate_limiter.py |
| geoalchemy2 | - | PostGIS geometry types | Already used in ParcelCache model |

### Alternatives Considered
None -- this phase uses exclusively existing stack. No new libraries needed.

## Architecture Patterns

### Existing Tool Pattern (FOLLOW THIS)
```
backend/app/tools/
    __init__.py
    backfill_parcel_addresses.py    # Existing: address backfill
    backfill_scan_building_metrics.py  # Existing: building metrics backfill
    backfill_scan_scores_v2.py      # Existing: score backfill
    run_gemeente_wijk_scans.py      # Existing: gemeente-wide scan runner
    validate_scan_data.py           # NEW: data quality validation
```

All existing tools follow the same pattern:
1. `argparse` for CLI arguments
2. `asyncio.run(main())` entry point
3. Direct `async_session_factory` database access
4. `SET app.current_tenant_id` for RLS
5. Rich console output with summary tables
6. Module-level `__main__` guard

### Pattern 1: CLI Validation Tool
**What:** A standalone CLI script that queries the database post-scan and reports on data quality metrics
**When to use:** After running scans or backfills, to verify data completeness
**Example structure:**
```python
# Source: existing pattern from backfill_parcel_addresses.py
"""Validate scan data quality for a gemeente.

Usage:
    python -m app.tools.validate_scan_data --gemeente-code GM0983
    python -m app.tools.validate_scan_data --gemeente-code GM0983 --wijk-naam "Wijk 01 Venlo-Centrum"
"""

@dataclass(slots=True)
class WijkValidation:
    wijk_naam: str
    total_parcels: int
    parcels_with_buildings: int
    bouwjaar_populated: int
    bouwjaar_null: int
    addresses_resolved: int
    addresses_missing: int
    pand_status_populated: int
    # Computed
    bouwjaar_rate: float
    address_rate: float
    pand_status_rate: float

async def validate_wijk(...) -> WijkValidation:
    # Query ParcelCache + ScanResult for this wijk's scan
    # Count nulls vs populated for bouwjaar, address, pand_status
    # Return validation result

def _print_validation_report(results: list[WijkValidation]) -> None:
    # Summary table similar to _print_summary in run_gemeente_wijk_scans.py
```

### Pattern 2: Parcel Addressing Integration
**What:** The `parcel_addressing.py` service already exists as unstaged code. It needs to be committed and any imports verified.
**Current state:** The file exists at `backend/app/services/parcel_addressing.py` with two functions:
- `find_bag_building_lookup_point(parcel_geometry, client)` -- finds BAG building overlap point
- `reverse_geocode_rd_point(point_rd, client)` -- reverse geocodes via PDOK

**Already integrated:** The scan pipeline (`area_scan_job` in `backend/app/jobs/area_scan.py`) already imports from this service:
```python
from app.services.parcel_addressing import MIN_BUILDING_OVERLAP_M2, reverse_geocode_rd_point
```
And the backfill tool already imports both functions:
```python
from app.services.parcel_addressing import (
    find_bag_building_lookup_point,
    reverse_geocode_rd_point,
)
```

### Pattern 3: Score Validation Against pand_status
**What:** Verify that opportunity scores correctly reflect BAG pand_status values
**How scoring works (from parcel_scoring.py):**
- `in_gebruik` --> pand_status_signal = 4.0 (low), vacancy_guardrail caps at 66.0
- `buiten gebruik` --> pand_status_signal = 34.0 (high), vacancy_guardrail floors at 52.0
- `sloop/niet in gebruik` --> pand_status_signal = 37.0 (highest), vacancy_guardrail floors at 52.0
- no pand (has_pand=false) --> pand_status_signal = 40.0, vacancy_guardrail floors at 60.0
- unknown/empty status --> pand_status_signal = 10.0

**Validation approach:** Query parcels grouped by pand_status, compute average scores, verify ordering matches expected hierarchy.

### Anti-Patterns to Avoid
- **Running scans without ARQ worker:** The `run_gemeente_wijk_scans.py` tool enqueues jobs to ARQ. The ARQ worker must be running separately.
- **Running address backfill during scan:** The scan pipeline already resolves addresses in Phase 5. Backfill is for catching stragglers AFTER all scans complete.
- **Expecting 100% address resolution:** Empty parcels (has_pand=false) intentionally have no address. Only parcels with buildings should have addresses resolved.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gemeente-wide scan execution | Custom scan loop | `run_gemeente_wijk_scans.py --force-all` | Already handles queue, polling, force mode, summary |
| Address backfill | Custom address resolver | `backfill_parcel_addresses.py --gemeente-code GM0983` | Already handles pagination, BAG lookup, RLS |
| Scan status tracking | Custom progress tracking | Existing `_wait_for_scan` + `_print_summary` | Already polls and prints WijkOutcome table |
| Wijk bbox resolution | Custom WFS query | `wijk_service.get_wijken_in_gemeente` | Already fetches CBS gebiedsindelingen |
| BAG cross-reference | Custom building overlap | `_derive_bag_attributes_for_parcel` + `BagSpatialIndex` | STRtree spatial index already implemented |

**Key insight:** This phase is 80% execution and 20% tooling. The scan pipeline, backfill tools, and data models all exist. The only new code is the validation tool.

## Common Pitfalls

### Pitfall 1: ARQ Worker Not Running
**What goes wrong:** Scans get enqueued but never execute (stuck in "pending")
**Why it happens:** `run_gemeente_wijk_scans.py` enqueues to ARQ Redis queue; needs a running worker
**How to avoid:** Start the ARQ worker before running the scan tool
**Warning signs:** `_wait_for_scan` polling shows status=pending indefinitely

### Pitfall 2: PDOK Rate Limiting on Bulk Operations
**What goes wrong:** 429 or connection errors when reverse geocoding thousands of parcels
**Why it happens:** 21 wijken * ~500 parcels = ~10,000+ reverse geocode calls
**How to avoid:** Rate limiters are already configured (`pdok_locatieserver_limiter`: 3 concurrent, 2000/hour). The `REVERSE_GEOCODE_CONCURRENCY = 10` semaphore in area_scan_job limits concurrent calls. Total run time for 21 wijken will be significant (30-60+ minutes).
**Warning signs:** Error logs showing PDOK reverse geocode failures, low address_resolution_ratio

### Pitfall 3: CBS Gebiedsindelingen Year
**What goes wrong:** Wrong number of wijken returned
**Why it happens:** `wijk_service.py` hardcodes CBS 2024 dataset. The code comment says: "use 2024, NOT 2026 -- 2026 has incomplete wijk data"
**How to avoid:** Don't change the CBS year. 2024 dataset is correct for Venlo's 21 wijken.
**Warning signs:** Fewer or more than 21 wijken returned

### Pitfall 4: RLS Tenant Isolation in Tools
**What goes wrong:** Queries return no results or RLS blocks access
**Why it happens:** CLI tools bypass FastAPI middleware that sets `app.current_tenant_id`
**How to avoid:** Tools must manually execute `SET app.current_tenant_id = '{org_id}'` before queries. This pattern is already in `backfill_parcel_addresses.py` line 74.
**Warning signs:** Empty result sets in validation queries

### Pitfall 5: Confusing gemeente_code Formats
**What goes wrong:** CLI tools use `GM0983` but database stores `0983` (or vice versa)
**Why it happens:** CBS uses `GM` prefix, PDOK doesn't always
**How to avoid:** `wijk_service.py` strips GM prefix: `gemeente_code.replace("GM", "")`. The AreaScan model stores whatever is passed. Check if scan data stores with or without prefix.
**Warning signs:** Validation queries returning 0 scans for Venlo

### Pitfall 6: Address Resolution for Empty Parcels
**What goes wrong:** Validation tool reports low address rate
**Why it happens:** Empty parcels (has_pand=false) intentionally have no address. Building-only address resolution is by design.
**How to avoid:** Calculate address resolution rate only for parcels with has_pand=true, matching the existing `address_resolution_ratio` on AreaScan.
**Warning signs:** Low address rates when including all parcels in denominator

## Code Examples

### Validation Query: Bouwjaar Population Rate
```python
# Source: derived from existing ParcelCache model + scan_result join pattern
stmt = (
    select(
        AreaScan.wijk_naam,
        func.count(ParcelCache.id).label("total"),
        func.count().filter(ParcelCache.has_pand.is_(True)).label("with_buildings"),
        func.count().filter(
            ParcelCache.has_pand.is_(True),
            ParcelCache.bouwjaar.is_not(None),
        ).label("bouwjaar_populated"),
        func.count().filter(
            ParcelCache.has_pand.is_(True),
            ParcelCache.address.is_not(None),
        ).label("address_resolved"),
        func.count().filter(
            ParcelCache.has_pand.is_(True),
            ParcelCache.pand_status.is_not(None),
        ).label("pand_status_populated"),
    )
    .join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
    .join(AreaScan, AreaScan.id == ScanResult.scan_id)
    .where(
        AreaScan.organization_id == org_id,
        AreaScan.gemeente_code == gemeente_code,
        AreaScan.status.in_(["completed", "completed_with_warnings"]),
    )
    .group_by(AreaScan.wijk_naam)
)
```

### Validation Query: Score vs pand_status Consistency
```python
# Verify in_gebruik parcels score lower than leeg/buiten_gebruik
stmt = (
    select(
        ParcelCache.pand_status,
        func.avg(ScanResult.score).label("avg_score"),
        func.count(ScanResult.id).label("count"),
    )
    .join(ScanResult, ScanResult.parcel_id == ParcelCache.id)
    .join(AreaScan, AreaScan.id == ScanResult.scan_id)
    .where(
        AreaScan.organization_id == org_id,
        AreaScan.gemeente_code == gemeente_code,
        ParcelCache.pand_status.is_not(None),
    )
    .group_by(ParcelCache.pand_status)
    .order_by(func.avg(ScanResult.score).desc())
)
```

### Running the Scan (Operational)
```bash
# 1. Ensure ARQ worker is running (separate terminal)
cd backend && python -m arq app.jobs.worker.WorkerSettings

# 2. Run all 21 Venlo wijken with --force-all
python -m app.tools.run_gemeente_wijk_scans \
    --gemeente-code GM0983 \
    --gemeente-naam Venlo \
    --force-all

# 3. After all scans complete, run address backfill for stragglers
python -m app.tools.backfill_parcel_addresses \
    --gemeente-code GM0983

# 4. Validate data quality
python -m app.tools.validate_scan_data \
    --gemeente-code GM0983
```

### Existing Summary Table Pattern (follow this for validation output)
```python
# Source: run_gemeente_wijk_scans.py lines 346-371
def _print_summary(outcomes: list[WijkOutcome]) -> None:
    print("\n" + "=" * 80)
    print("SCAN SUMMARY")
    print("=" * 80)
    print(f"{'Wijk':<30} {'Status':<25} {'Parcels':>8} {'Coverage':>10} {'Addresses':>10}")
    print("-" * 80)
    for o in outcomes:
        # ... format each wijk
    print("=" * 80)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Silent BAG WFS failure | Retry with backoff + abort on fail | Phase 62 (v8.0) | Scans now produce reliable data |
| No coverage validation | coverage_ratio + address_resolution_ratio tracked | Phase 62 (v8.0) | completed_with_warnings status when thresholds breached |
| Manual re-scan | --force-all mode in run_gemeente_wijk_scans.py | Phase 62 (v8.0) | Clean-slate rescan deletes old ScanResult rows |
| Centroid-based address | BAG building overlap address via parcel_addressing.py | Pre-phase 63 | Avoids assigning neighbor's address to empty parcel |

## Open Questions

1. **Venlo gemeente_code storage format**
   - What we know: CLI tool takes `GM0983`, wijk_service strips to `0983`, but AreaScan stores whatever `gemeente_code` is passed from scan creation
   - What's unclear: Whether existing Venlo scans use `GM0983` or `0983` in the database
   - Recommendation: Check database before building validation queries. The validation tool should handle both formats.

2. **Expected parcel counts per wijk**
   - What we know: Success criteria say "parcel counts matching expected Venlo density"
   - What's unclear: What the expected density is (varies by wijk - urban wijken have more parcels)
   - Recommendation: Use the scan's `parcels_total` field and validate it's non-zero. Don't hardcode expected counts -- instead flag suspiciously low counts (< 50) or zero-parcel scans.

3. **Backfill tool scope: only scanned parcels or all parcels?**
   - What we know: `backfill_parcel_addresses.py` has `--only-scanned-parcels` flag and `--gemeente-code` filter
   - What's unclear: Whether to use `--only-scanned-parcels` or leave it off
   - Recommendation: Use `--gemeente-code GM0983 --only-scanned-parcels --scan-status completed` for targeted backfill of only parcels from completed Venlo scans.

## Sources

### Primary (HIGH confidence)
- `backend/app/jobs/area_scan.py` -- full scan pipeline implementation (1009 lines)
- `backend/app/tools/run_gemeente_wijk_scans.py` -- gemeente scan runner (376 lines)
- `backend/app/tools/backfill_parcel_addresses.py` -- address backfill tool (341 lines)
- `backend/app/services/parcel_addressing.py` -- BAG building overlap + PDOK reverse geocode (102 lines)
- `backend/app/services/parcel_scoring.py` -- opportunity scoring with pand_status (729 lines)
- `backend/app/models/area_scan.py` -- AreaScan model with coverage tracking (89 lines)
- `backend/app/models/parcel_cache.py` -- ParcelCache with bouwjaar, pand_status, address (95 lines)
- `backend/app/services/wijk_service.py` -- CBS wijk WFS client (75 lines)
- `backend/app/government_apis/bag_wfs.py` -- BAG WFS with pagination + retry (196 lines)
- `backend/app/government_apis/pdok_locatieserver.py` -- PDOK reverse geocode with distance fallback (217 lines)

### Secondary (MEDIUM confidence)
- `backend/app/government_apis/rate_limiter.py` -- rate limits (max_concurrent=3, max_per_hour=2000 for locatieserver)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- existing tools/patterns fully documented, only one new tool to build
- Pitfalls: HIGH -- all pitfalls derived from actual code analysis, rate limits verified from source
- Data model: HIGH -- all models read directly, fields verified

**Research date:** 2026-03-01
**Valid until:** 2026-03-31 (stable codebase, no external API changes expected)
