# Phase 20: Area Scanner + REST API - Research

**Researched:** 2026-02-10
**Domain:** ARQ background job orchestration, FastAPI REST pagination, Excel export, and parcel scoring
**Confidence:** HIGH

## Summary

Phase 20 implements the complete area intelligence scan pipeline as an ARQ background job that orchestrates Phase 19's government API clients (BAG WFS, SRU, BRK, DSO) against Phase 18's spatial database. The scan discovers parcels within a gemeente bounding box, cross-references with BAG panden, queries bestemmingen via DSO, computes opportunity scores, and exposes results via REST endpoints with server-side filtering, sorting, pagination, and Excel export.

The codebase already has ARQ infrastructure (WorkerSettings, pdf_parsing_job), established service layer patterns (list_reports with offset/limit pagination, filtering, sorting), and all required database models (AreaScan, ScanResult, ParcelCache). Phase 19 delivered tested API clients with rate limiting, and Phase 18 provides PostGIS spatial queries with GIST-indexed geometry. This phase connects these building blocks through a scan orchestrator job that updates progress in the database, handles partial results on cancellation, and computes transparency-focused scores.

The scan must handle large result sets (2000+ parcels) with streaming results visible during execution, support user cancellation while preserving processed parcels, and provide score transparency via category labels (High/Medium/Low) with expandable per-factor breakdowns. Excel export uses openpyxl for write-only .xlsx generation, respecting active filters to export exactly what users see.

**Primary recommendation:** Use ARQ job with database-backed progress tracking (not Redis job.result()), implement scoring as a weighted sum with documented factors (has_pand, area_m2, bestemming, recent_vergunningen), paginate with standard offset/limit pattern matching existing reports endpoint, and export to Excel via openpyxl with filtered dataset and score transparency column.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scan lifecycle:**
- Show existing scan results when a gemeente was already scanned, with an option to re-scan
- Re-scan overwrites parcel data in-place on the same scan record (not a new record)
- Scans are per-organization (shared with all team members, avoids duplicate work)
- Show scan date on results, and after 30 days nudge the user to re-scan

**Partial results & error handling:**
- Results stream in during scan -- users can see parcels as they're processed (table grows live)
- Users can cancel a running scan -- parcels processed so far are kept as results
- Summary line for scan quality: "Scanned 4,832 parcels (23 failed)" -- no detailed failure report

**Scoring:**
- Score-based default sort (most promising parcels first)
- Score display: category label (High/Medium/Low) at a glance, expandable breakdown showing per-factor contribution
- Fixed scoring formula for all organizations (tunable per-org weights deferred to future phase)
- Internal documentation of scoring methodology for client-facing conversations

**Result defaults:**
- "No parcels match your filters" with a clear-all-filters reset button for empty states

**Export:**
- Excel (.xlsx) export, not CSV -- NL/BE real estate developers work in Excel
- Export respects active filters (exports what the user sees, not all results)

### Claude's Discretion

- Error tolerance strategy (retry policy, skip behavior for failed individual parcels)
- Scoring formula design based on available data factors (size, vacancy, zoning, permits)
- Filter application mode (live vs apply button) based on expected result set sizes
- Whether to include score column in Excel export

### Deferred Ideas (OUT OF SCOPE)

- Per-organization customizable score weights -- future phase if clients request it
- Automated downstream workflows (CRM integration, lead notifications, outreach) -- future phase
- PDF report export for stakeholder presentations -- future phase

</user_constraints>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ARQ | 0.27.0 | Async job queue with Redis | Already in use for PDF parsing, native asyncio support, simpler than Celery for async workloads |
| openpyxl | 3.1+ | Excel .xlsx write-only export | Fast write performance (3x faster than for large datasets), no read/modify overhead, widely used for Python Excel generation |
| FastAPI | 0.115.0+ | REST API framework | Already in use, built-in dependency injection, async-native |
| SQLAlchemy | 2.0.25+ | ORM with async support | Already in use, established patterns for offset/limit pagination and filtering |
| PostgreSQL + PostGIS | 16 + 3.5 | Spatial database | Already configured (Phase 18), GIST-indexed queries for bbox operations |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| httpx | 0.27+ | Async HTTP client | Already in use by API clients (Phase 19), reuse for government API calls |
| pyproj | 3.7+ | Coordinate transformation | Already in use (Phase 18), EPSG:28992 ↔ EPSG:4326 conversions |
| Redis | 5.0+ | ARQ job queue backend | Already configured, stores job metadata and enqueue state |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| openpyxl | xlsxwriter | xlsxwriter is 10% faster but openpyxl has better type hints and Pydantic integration for structured data export |
| openpyxl | CSV | User constraint: NL/BE real estate developers work in Excel, need formatted workbooks not raw CSV |
| ARQ | Celery | ARQ is simpler for asyncio workloads, already in use, Celery adds complexity for sync-only compatibility |
| Database progress | Redis job.result() | Database progress survives Redis restarts, enables polling without Redis dependency in API layer |
| fastapi-pagination library | Manual offset/limit | Codebase already has manual pattern (reports endpoint), avoid new dependency for established pattern |

**Installation:**
```bash
# openpyxl only (other deps already installed)
pip install "openpyxl>=3.1.0"
```

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── jobs/
│   ├── worker.py              # ARQ WorkerSettings (add area_scan_job)
│   ├── pdf_parsing.py          # Existing PDF job
│   └── area_scan.py            # NEW: Scan orchestrator job
├── services/
│   ├── area_scanner.py         # NEW: Scan orchestration service
│   ├── parcel_scoring.py       # NEW: Score calculation + transparency
│   ├── excel_exporter.py       # NEW: Excel export service
│   └── spatial_helpers.py      # Existing (Phase 18)
├── scans/                      # NEW module
│   ├── router.py               # REST endpoints (trigger, poll, list, export)
│   ├── service.py              # CRUD for AreaScan + ScanResult
│   └── schemas.py              # Request/response models
├── models/
│   ├── area_scan.py            # Existing (Phase 18)
│   ├── scan_result.py          # Existing (Phase 18)
│   └── parcel_cache.py         # Existing (Phase 18)
└── government_apis/            # Existing (Phase 19)
    ├── bag_wfs.py              # BAG WFS client
    ├── sru_bekendmakingen.py   # SRU client
    ├── brk_bevragen.py         # BRK client
    └── dso_spatial_plans.py    # DSO client
```

### Pattern 1: ARQ Job with Database-Backed Progress Tracking

**What:** Store progress in AreaScan table, not Redis job.result(), to survive Redis restarts and enable polling without Redis dependency in API layer

**When to use:** All long-running background jobs where progress visibility is critical

**Example:**
```python
# Source: Existing pdf_parsing_job pattern in app/jobs/pdf_parsing.py
# Adapted for area scan with progress updates

from arq import ArqRedis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

async def area_scan_job(
    ctx: dict,
    scan_id: str,
    organization_id: str,
) -> dict:
    """
    Background job: Scan gemeente for development opportunities.

    Updates AreaScan record in database for progress tracking.
    Parcels stream into ScanResult as they're processed.

    Args:
        ctx: ARQ context (contains redis connection)
        scan_id: UUID of AreaScan record
        organization_id: Tenant UUID as string

    Returns:
        dict with scan_id and status for ARQ result storage
    """
    # Create database session (worker runs outside FastAPI)
    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession)

    scan_uuid = uuid.UUID(scan_id)
    org_id = uuid.UUID(organization_id)

    try:
        async with session_factory() as session:
            # Update scan status to "running"
            scan = await session.get(AreaScan, scan_uuid)
            if not scan:
                return {"scan_id": scan_id, "status": "error", "error": "Scan not found"}

            scan.status = "running"
            scan.started_at = datetime.utcnow()
            scan.current_phase = "fetching_parcels"
            session.add(scan)
            await session.flush()
            await session.commit()

            # Phase 1: Fetch parcels from PDOK WFS
            from app.government_apis.bag_wfs import bag_wfs_client

            parcels = []
            async for page in bag_wfs_client.get_panden_in_bbox(
                scan.bbox_minx, scan.bbox_miny, scan.bbox_maxx, scan.bbox_maxy
            ):
                parcels.extend(page)

                # Update progress after each page
                scan.parcels_total = len(parcels)
                scan.progress_pct = 30  # Fetching is ~30% of total work
                session.add(scan)
                await session.flush()
                await session.commit()

            # Phase 2: Cross-reference with BAG, query DSO
            scan.current_phase = "cross_referencing_bag"
            session.add(scan)
            await session.commit()

            failed_count = 0
            for idx, parcel_data in enumerate(parcels):
                try:
                    # Create/update ParcelCache
                    parcel = await upsert_parcel_cache(parcel_data, org_id, session)

                    # Compute score
                    score = compute_opportunity_score(parcel)

                    # Create ScanResult link
                    result = ScanResult(
                        scan_id=scan_uuid,
                        parcel_id=parcel.id,
                        organization_id=org_id,
                        score=score,
                    )
                    session.add(result)

                    # Update progress every 10 parcels
                    if idx % 10 == 0:
                        scan.parcels_processed = idx + 1
                        scan.progress_pct = 30 + int((idx + 1) / len(parcels) * 70)
                        session.add(scan)
                        await session.flush()
                        await session.commit()

                except Exception as e:
                    logger.warning(f"Failed to process parcel {idx}: {e}")
                    failed_count += 1
                    # Skip failed parcel, continue processing

            # Mark scan complete
            scan.status = "completed"
            scan.completed_at = datetime.utcnow()
            scan.progress_pct = 100
            scan.parcels_processed = len(parcels)
            scan.parcels_failed = failed_count  # NEW field for error summary
            session.add(scan)
            await session.commit()

            return {"scan_id": scan_id, "status": "completed"}

    except asyncio.CancelledError:
        # User cancelled scan - commit parcels processed so far
        async with session_factory() as session:
            scan = await session.get(AreaScan, scan_uuid)
            if scan:
                scan.status = "cancelled"
                scan.completed_at = datetime.utcnow()
                scan.error_message = "Scan cancelled by user"
                session.add(scan)
                await session.commit()
        return {"scan_id": scan_id, "status": "cancelled"}

    except Exception as e:
        # Unexpected error - mark as failed
        async with session_factory() as session:
            scan = await session.get(AreaScan, scan_uuid)
            if scan:
                scan.status = "failed"
                scan.error_message = str(e)
                session.add(scan)
                await session.commit()
        return {"scan_id": scan_id, "status": "failed", "error": str(e)}

    finally:
        await engine.dispose()
```

**Key points:**
- Create new database session for worker (runs outside FastAPI request context)
- Update AreaScan.progress_pct, current_phase, parcels_processed after each batch
- Commit progress updates to make visible during execution (user constraint: streaming results)
- Handle asyncio.CancelledError for user cancellation (user constraint: keep partial results)
- No retry logic - user decision from pdf_parsing_job (max_tries=1 in WorkerSettings)

### Pattern 2: ARQ Job Cancellation via abort()

**What:** Enable job cancellation by setting allow_abort_jobs=True in WorkerSettings, call job.abort() from API endpoint

**When to use:** When users need to cancel long-running scans

**Example:**
```python
# Source: https://arq-docs.helpmanual.io/ and GitHub issues #246, #449
# WorkerSettings configuration

class WorkerSettings:
    """ARQ worker configuration."""

    functions = [pdf_parsing_job, area_scan_job]
    redis_settings = get_redis_settings()
    max_jobs = 5
    job_timeout = 3600  # 1 hour for large scans
    max_tries = 1
    allow_abort_jobs = True  # Enable job.abort() from API
    health_check_interval = 30

# API endpoint for cancellation
@router.post("/scans/{scan_id}/cancel")
async def cancel_scan(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    redis: ArqRedis = Depends(get_redis_pool),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running scan, keeping parcels processed so far."""
    # Verify scan ownership
    scan = await db.get(AreaScan, scan_id)
    if not scan or scan.organization_id != organization_id:
        raise HTTPException(404, "Scan not found")

    if scan.status != "running":
        raise HTTPException(400, "Scan is not running")

    # Abort ARQ job (raises CancelledError in worker)
    from arq.jobs import Job
    job = Job(scan.job_id, redis)
    await job.abort()

    # Status update happens in job's CancelledError handler
    return {"message": "Scan cancelled"}
```

**Key points:**
- `allow_abort_jobs=True` required in WorkerSettings for abort() to work
- Cancellation raises `asyncio.CancelledError` in running job
- Job must handle CancelledError to commit partial results (user constraint)
- Store job_id in AreaScan.job_id when enqueueing for later abort reference

### Pattern 3: Offset/Limit Pagination with Filtering and Sorting

**What:** Manual offset/limit pagination matching existing reports endpoint pattern, with server-side filters and sort

**When to use:** All list endpoints with 50+ items, especially scan results (2000+ parcels)

**Example:**
```python
# Source: Existing pattern in app/reports/service.py:list_reports()
# Adapted for scan results

async def list_scan_results(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID,
    has_pand: bool | None,
    bestemming_type: str | None,  # e.g., "Wonen"
    min_area_m2: float | None,
    max_area_m2: float | None,
    sort_by: str = "score",  # "score", "area_m2", "address"
    sort_order: str = "desc",
    offset: int = 0,
    limit: int = 50,
    session: AsyncSession,
) -> tuple[list[ScanResult], int]:
    """
    List scan results with filtering, sorting, and pagination.

    Returns:
        tuple: (list of ScanResult with joined ParcelCache, total count)
    """
    # Base query with join to ParcelCache for filtering/sorting
    query = (
        select(ScanResult, ParcelCache)
        .join(ParcelCache, ScanResult.parcel_id == ParcelCache.id)
        .where(
            ScanResult.scan_id == scan_id,
            ScanResult.organization_id == organization_id,
        )
    )

    # Apply optional filters
    if has_pand is not None:
        query = query.where(ParcelCache.has_pand == has_pand)

    if bestemming_type is not None:
        # JSONB array contains filter (dubbele bestemming support)
        query = query.where(
            func.jsonb_path_exists(
                ParcelCache.bestemmingen,
                f'$[*] ? (@.type == "{bestemming_type}")'
            )
        )

    if min_area_m2 is not None:
        query = query.where(ParcelCache.area_m2 >= min_area_m2)

    if max_area_m2 is not None:
        query = query.where(ParcelCache.area_m2 <= max_area_m2)

    # Count total before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    # Apply sorting
    sort_field_map = {
        "score": ScanResult.score,
        "area_m2": ParcelCache.area_m2,
        "address": ParcelCache.address,
    }
    sort_field = sort_field_map.get(sort_by, ScanResult.score)

    if sort_order == "asc":
        query = query.order_by(asc(sort_field))
    else:
        query = query.order_by(desc(sort_field))

    # Apply pagination
    query = query.offset(offset).limit(limit)

    result = await session.execute(query)
    rows = result.all()

    return rows, total
```

**Key points:**
- Count total BEFORE applying offset/limit (user needs total for pagination UI)
- Join to ParcelCache for filtering/sorting on parcel attributes
- Use JSONB path queries for bestemming array filtering (dubbele bestemming support)
- Sort by score DESC as default (user constraint: most promising first)
- Standard limit=50, enforce max limit (e.g., 100) like reports endpoint

### Pattern 4: Weighted Scoring with Transparency

**What:** Compute opportunity score as weighted sum of factors, store per-factor contributions in ScanResult.flags for transparency

**When to use:** All parcels during scan processing

**Example:**
```python
# NEW service: app/services/parcel_scoring.py
# Based on real estate site selection research from web search

from dataclasses import dataclass
from typing import Literal

@dataclass
class ScoreBreakdown:
    """Transparent score breakdown for client-facing conversations."""
    total_score: float  # 0-100
    category: Literal["High", "Medium", "Low"]
    factors: dict[str, float]  # Factor name -> contribution (0-100)

# Scoring weights (fixed for all orgs, documented for transparency)
WEIGHTS = {
    "vacant_land": 30,      # No existing building = development ready
    "size_optimal": 25,     # 500-2000 m² ideal for residential
    "zoning_residential": 25,  # "Wonen" bestemming
    "recent_permits": 20,   # Activity signals market interest
}

def compute_opportunity_score(parcel: ParcelCache) -> ScoreBreakdown:
    """
    Compute parcel development opportunity score with transparency.

    Scoring factors (fixed formula, client-facing documentation):
    - Vacant land (30%): No existing pand = easier development
    - Size optimal (25%): 500-2000 m² ideal for residential projects
    - Zoning residential (25%): "Wonen" bestemming = approved use
    - Recent permits (20%): Activity in last 3 years signals market interest

    Args:
        parcel: ParcelCache with enrichment_data populated

    Returns:
        ScoreBreakdown with total, category, and per-factor contributions
    """
    factors = {}

    # Factor 1: Vacant land (has_pand = False)
    if not parcel.has_pand:
        factors["vacant_land"] = WEIGHTS["vacant_land"]
    else:
        factors["vacant_land"] = 0

    # Factor 2: Size optimal (500-2000 m²)
    if parcel.area_m2 is not None:
        if 500 <= parcel.area_m2 <= 2000:
            factors["size_optimal"] = WEIGHTS["size_optimal"]
        elif 300 <= parcel.area_m2 < 500 or 2000 < parcel.area_m2 <= 3000:
            factors["size_optimal"] = WEIGHTS["size_optimal"] * 0.6  # Suboptimal
        else:
            factors["size_optimal"] = WEIGHTS["size_optimal"] * 0.2  # Poor fit
    else:
        factors["size_optimal"] = 0

    # Factor 3: Zoning residential (bestemmingen contains "Wonen")
    has_wonen = False
    if parcel.bestemmingen:
        for bestemming in parcel.bestemmingen:
            if bestemming.get("type") == "Wonen":
                has_wonen = True
                break

    if has_wonen:
        factors["zoning_residential"] = WEIGHTS["zoning_residential"]
    else:
        factors["zoning_residential"] = 0

    # Factor 4: Recent permits (enrichment_data.vergunningen in last 3 years)
    recent_permits = 0
    if parcel.enrichment_data and "vergunningen" in parcel.enrichment_data:
        from datetime import datetime, timedelta
        three_years_ago = datetime.utcnow() - timedelta(days=3*365)

        for verg in parcel.enrichment_data["vergunningen"]:
            verg_date = verg.get("publicatiedatum")
            if verg_date and datetime.fromisoformat(verg_date) > three_years_ago:
                recent_permits += 1

    if recent_permits >= 3:
        factors["recent_permits"] = WEIGHTS["recent_permits"]
    elif recent_permits >= 1:
        factors["recent_permits"] = WEIGHTS["recent_permits"] * 0.5
    else:
        factors["recent_permits"] = 0

    # Compute total
    total_score = sum(factors.values())

    # Categorize (High/Medium/Low thresholds)
    if total_score >= 70:
        category = "High"
    elif total_score >= 40:
        category = "Medium"
    else:
        category = "Low"

    return ScoreBreakdown(
        total_score=total_score,
        category=category,
        factors=factors,
    )
```

**Key points:**
- Fixed weights (user constraint: no per-org tuning in this phase)
- Four factors based on real estate site selection research (vacant, size, zoning, permits)
- Per-factor contributions stored in ScanResult.flags JSONB for transparency
- Category thresholds: High ≥70, Medium ≥40, Low <40
- Internal documentation for client-facing conversations (user constraint: #1 client question)

### Pattern 5: Excel Export via openpyxl

**What:** Export filtered scan results to .xlsx with score transparency column

**When to use:** All export endpoints where users need Excel workbooks (not CSV)

**Example:**
```python
# NEW service: app/services/excel_exporter.py
# Based on openpyxl documentation and NL/BE developer requirements

from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

async def export_scan_results_to_excel(
    results: list[tuple[ScanResult, ParcelCache]],
    scan: AreaScan,
    filters_applied: dict,
) -> BytesIO:
    """
    Export scan results to Excel .xlsx with score transparency.

    User constraint: Excel not CSV (NL/BE developers work in Excel)
    User constraint: Export respects active filters (export what user sees)

    Args:
        results: Filtered scan results (already paginated, sorted)
        scan: AreaScan metadata for header
        filters_applied: Dict of active filters for documentation

    Returns:
        BytesIO: Excel workbook bytes ready for download
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Scan Results"

    # Header row with formatting
    headers = [
        "Adres", "Gemeente", "Oppervlakte (m²)", "Bestemming",
        "Bebouwd", "Score", "Categorie"
    ]
    ws.append(headers)

    # Style header row
    header_fill = PatternFill(start_color="366092", end_color="366092", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    # Metadata rows (scan info, filters)
    ws.insert_rows(1, amount=3)
    ws["A1"] = f"Scan: {scan.gemeente_naam}"
    ws["A2"] = f"Datum: {scan.created_at.strftime('%Y-%m-%d')}"
    ws["A3"] = f"Filters: {_format_filters(filters_applied)}"

    # Data rows
    for scan_result, parcel in results:
        # Parse score breakdown from flags
        score_breakdown = scan_result.flags or {}

        # Format bestemmingen array
        bestemmingen_str = ", ".join(
            b.get("type", "Onbekend") for b in (parcel.bestemmingen or [])
        )

        ws.append([
            parcel.address or "Onbekend",
            parcel.gemeente_code or "",
            parcel.area_m2 or 0,
            bestemmingen_str,
            "Ja" if parcel.has_pand else "Nee",
            f"{scan_result.score:.1f}" if scan_result.score else "0.0",
            score_breakdown.get("category", "Low"),
        ])

    # Auto-size columns
    for column in ws.columns:
        max_length = 0
        column = [cell for cell in column]
        for cell in column:
            if cell.value:
                max_length = max(max_length, len(str(cell.value)))
        ws.column_dimensions[column[0].column_letter].width = max_length + 2

    # Save to BytesIO
    excel_buffer = BytesIO()
    wb.save(excel_buffer)
    excel_buffer.seek(0)

    return excel_buffer

def _format_filters(filters: dict) -> str:
    """Format active filters for Excel header."""
    if not filters:
        return "Geen filters"

    parts = []
    if filters.get("has_pand") is not None:
        parts.append(f"Bebouwd={'Ja' if filters['has_pand'] else 'Nee'}")
    if filters.get("bestemming_type"):
        parts.append(f"Bestemming={filters['bestemming_type']}")
    if filters.get("min_area_m2"):
        parts.append(f"Min oppervlakte={filters['min_area_m2']}m²")
    if filters.get("max_area_m2"):
        parts.append(f"Max oppervlakte={filters['max_area_m2']}m²")

    return ", ".join(parts) if parts else "Geen filters"
```

**Key points:**
- openpyxl for write-only .xlsx generation (3x faster than read/modify for large datasets)
- Include score transparency: score value + category column (user constraint)
- Document active filters in header rows (user constraint: export what user sees)
- Dutch column names and formatting (NL/BE developers)
- Auto-size columns for readability
- Return BytesIO for FastAPI StreamingResponse

### Anti-Patterns to Avoid

- **Storing partial results in Redis job.result()**: Redis restarts lose progress, use database (AreaScan table) for durability
- **Synchronous Excel generation in request handler**: 2000+ rows blocks response, use background job or streaming response
- **Querying BRK during scan**: BRK is Tier 3 (never store), only query on-demand for qualified leads, not bulk scan
- **Single commit after all parcels processed**: Users can't see progress (user constraint: streaming results), commit after each batch
- **Retrying failed parcels**: User decision: skip and continue, no auto-retry (max_tries=1), surface failed count in summary

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue with progress | Custom Redis queue + polling loop | ARQ with database progress | Already in use, handles worker lifecycle, cancellation, result storage |
| Excel file generation | Manual XML/ZIP manipulation | openpyxl | Handles OOXML format, cell styling, formulas, auto-sizing — mature library with 10+ years development |
| Weighted scoring | Ad-hoc score computation in SQL | Dedicated scoring service with weights | Needs transparency for client conversations (user constraint), centralized formula for consistency |
| Bounding box queries | Application-layer geometry checks | PostGIS ST_MakeEnvelope + GIST | 10-100x faster via spatial index (established in Phase 18) |
| Pagination + filtering | Load all, filter in Python | SQLAlchemy offset/limit + WHERE | Memory efficient for 2000+ results, index-optimized queries |

**Key insight:** ARQ + database progress + openpyxl solves the "long-running scan with streaming results and Excel export" pattern without custom infrastructure. The codebase already has ARQ (pdf_parsing_job), pagination patterns (reports endpoint), and scoring needs client transparency (not just a number). Excel export is a domain requirement (not a technical choice) because NL/BE real estate developers collaborate in Excel, not CSV.

## Common Pitfalls

### Pitfall 1: Redis-Only Progress Tracking

**What goes wrong:** Storing progress in Redis (job.result()) loses state on Redis restart, blocks API polling without Redis dependency

**Why it happens:** ARQ documentation emphasizes job.result() for simple cases, but long-running scans need durable progress

**How to avoid:** Store progress in AreaScan table (progress_pct, current_phase, parcels_processed), update after each batch, poll via database query

**Warning signs:** API endpoints import arq.jobs.Job, Redis dependency in routers, progress lost after Redis restart

### Pitfall 2: Blocking Excel Generation

**What goes wrong:** Generating Excel synchronously in request handler blocks for 5-10 seconds on 2000+ rows, causes timeout

**Why it happens:** openpyxl is fast (3x faster than alternatives) but still CPU-bound, 2000 rows with styling takes ~5 seconds

**How to avoid:** Use FastAPI StreamingResponse with generator pattern, or enqueue as separate ARQ job (if file > 5MB)

**Warning signs:** Request timeouts on export, high CPU during export endpoint, blocking other requests

### Pitfall 3: Score Opacity

**What goes wrong:** Storing only final score (0-100) without per-factor contributions blocks client transparency (user constraint: #1 question)

**Why it happens:** Simple schema design (score: float), forgetting user needs to explain to their clients

**How to avoid:** Store score breakdown in ScanResult.flags JSONB ({"vacant_land": 30, "size_optimal": 15, ...}), expose in API response, include in Excel export

**Warning signs:** "How is score calculated?" client questions, inability to show why parcel scored high/low

### Pitfall 4: Scan Duplication

**What goes wrong:** Starting new scan for already-scanned gemeente creates duplicate data, wastes API quota

**Why it happens:** No check for existing scan before enqueueing job

**How to avoid:** Query AreaScan by (organization_id, gemeente_code) before triggering, show existing results with "Re-scan" option (user constraint)

**Warning signs:** Multiple AreaScan records for same gemeente, duplicate ScanResult parcels, confused users seeing multiple scan dates

### Pitfall 5: All-or-Nothing Error Handling

**What goes wrong:** One parcel failure aborts entire scan, user loses all progress

**Why it happens:** Not catching exceptions inside parcel processing loop

**How to avoid:** Try/catch inside loop, log failure, increment failed_count, continue processing (user constraint: "4,832 parcels (23 failed)")

**Warning signs:** Scans fail completely on single parcel error, no partial results, no error count in summary

## Code Examples

Verified patterns from official sources and codebase:

### Enqueuing ARQ Job from FastAPI Endpoint

```python
# Source: app/jobs/pdf_parsing.py pattern + ARQ docs
# Adapted for area scan

from arq import create_pool
from arq.connections import RedisSettings

@router.post("/scans", response_model=ScanResponse, status_code=201)
async def trigger_scan(
    request: Request,
    scan_request: ScanCreateRequest,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Trigger area scan for a gemeente.

    Checks for existing scan (user constraint: show existing results).
    Creates AreaScan record with status="pending", enqueues ARQ job.
    """
    # Check for existing scan
    existing = await db.execute(
        select(AreaScan).where(
            AreaScan.organization_id == organization_id,
            AreaScan.gemeente_code == scan_request.gemeente_code,
        ).order_by(AreaScan.created_at.desc())
    )
    existing_scan = existing.scalar_one_or_none()

    if existing_scan:
        # Return existing scan with re-scan option
        days_old = (datetime.utcnow() - existing_scan.created_at).days
        return ScanResponse(
            scan_id=existing_scan.id,
            status="existing",
            gemeente_naam=existing_scan.gemeente_naam,
            scan_date=existing_scan.created_at,
            needs_rescan=days_old > 30,
            message=f"Scan already exists ({days_old} days old)",
        )

    # Fetch gemeente bbox from CBS WFS
    bbox = await get_gemeente_bbox(scan_request.gemeente_code)

    # Create AreaScan record
    scan = AreaScan(
        organization_id=organization_id,
        gemeente_code=scan_request.gemeente_code,
        gemeente_naam=scan_request.gemeente_naam,
        bbox_minx=bbox["minx"],
        bbox_miny=bbox["miny"],
        bbox_maxx=bbox["maxx"],
        bbox_maxy=bbox["maxy"],
        status="pending",
    )
    db.add(scan)
    await db.flush()
    await db.commit()

    # Enqueue ARQ job
    redis = await create_pool(RedisSettings(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
    ))

    job = await redis.enqueue_job(
        "area_scan_job",
        str(scan.id),
        str(organization_id),
    )

    # Store job_id for later abort reference
    scan.job_id = job.job_id
    db.add(scan)
    await db.commit()

    return ScanResponse(
        scan_id=scan.id,
        status="pending",
        gemeente_naam=scan.gemeente_naam,
        message="Scan queued",
    )
```

### Polling Scan Progress

```python
# Source: Existing pattern (no Redis dependency, database-only)

@router.get("/scans/{scan_id}", response_model=ScanStatusResponse)
async def get_scan_status(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Poll scan progress (no Redis dependency, database-backed).
    """
    scan = await db.get(AreaScan, scan_id)

    if not scan or scan.organization_id != organization_id:
        raise HTTPException(404, "Scan not found")

    # Count results processed so far
    result_count = await db.scalar(
        select(func.count(ScanResult.id)).where(ScanResult.scan_id == scan_id)
    )

    return ScanStatusResponse(
        scan_id=scan.id,
        status=scan.status,
        progress_pct=scan.progress_pct,
        current_phase=scan.current_phase,
        parcels_total=scan.parcels_total,
        parcels_processed=scan.parcels_processed,
        parcels_failed=getattr(scan, "parcels_failed", 0),
        results_count=result_count,
        started_at=scan.started_at,
        completed_at=scan.completed_at,
    )
```

### Fetching CBS Gemeente Bounding Box

```python
# Source: CBS gebiedsindelingen WFS 2026 (from web search)
# https://service.pdok.nl/cbs/gebiedsindelingen/2026/wfs/v1_0

import httpx
from lxml import etree

async def get_gemeente_bbox(gemeente_code: str) -> dict:
    """
    Fetch gemeente bounding box from CBS gebiedsindelingen WFS 2026.

    Args:
        gemeente_code: CBS gemeentecode (e.g., "0363" for Amsterdam)

    Returns:
        dict with minx, miny, maxx, maxy in EPSG:28992
    """
    wfs_url = "https://service.pdok.nl/cbs/gebiedsindelingen/2026/wfs/v1_0"

    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "gemeenten",
        "outputFormat": "application/gml+xml; version=3.2",
        "filter": f"""
            <Filter>
                <PropertyIsEqualTo>
                    <PropertyName>gemeentecode</PropertyName>
                    <Literal>{gemeente_code}</Literal>
                </PropertyIsEqualTo>
            </Filter>
        """,
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(wfs_url, params=params)
        response.raise_for_status()

    # Parse GML response
    tree = etree.fromstring(response.content)

    # Extract boundedBy envelope
    envelope = tree.find(".//{http://www.opengis.net/gml/3.2}Envelope")
    if envelope is None:
        raise ValueError(f"Gemeente {gemeente_code} not found")

    lower_corner = envelope.find("{http://www.opengis.net/gml/3.2}lowerCorner").text
    upper_corner = envelope.find("{http://www.opengis.net/gml/3.2}upperCorner").text

    minx, miny = map(float, lower_corner.split())
    maxx, maxy = map(float, upper_corner.split())

    return {
        "minx": minx,
        "miny": miny,
        "maxx": maxx,
        "maxy": maxy,
    }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSV export | Excel .xlsx export | 2025+ (openpyxl maturity) | Better formatting, multi-sheet support, formula support for real estate workflows |
| Celery for async jobs | ARQ for asyncio-native jobs | 2020+ | Simpler config for async Python, no dual async/sync bridge needed |
| Redis job.result() progress | Database-backed progress | 2024+ | Survives Redis restarts, no Redis dependency in API polling |
| fastapi-pagination library | Manual offset/limit | 2024 (codebase) | Fewer dependencies, established pattern in reports endpoint |
| Generic property scoring | Domain-specific transparency | 2024+ (user requirement) | Real estate developers need to explain scores to clients, not just see numbers |

**Deprecated/outdated:**
- **xlwt/xlrd**: Python 2 libraries for .xls (Excel 97-2003), replaced by openpyxl for .xlsx (Excel 2007+)
- **Celery with asyncio workers**: Complex setup, ARQ is simpler and native async
- **CSV for collaborative workflows**: Real estate teams work in Excel with formatting, formulas, multiple sheets

## Open Questions

1. **Scan size limit enforcement**
   - What we know: User requirement is 10,000 parcel limit (SCAN-06)
   - What's unclear: Where to enforce (frontend validation, API pre-check, or ARQ job rejection)?
   - Recommendation: Enforce at API pre-check (count parcels via WFS resultType=hits before enqueueing), fail fast with clear error

2. **Score breakdown storage format**
   - What we know: Need per-factor contributions for transparency
   - What's unclear: JSONB format in ScanResult.flags (flat dict vs nested?)
   - Recommendation: Flat dict `{"vacant_land": 30, "size_optimal": 15, ...}` for simple API exposure and Excel export

3. **Re-scan behavior**
   - What we know: Re-scan overwrites in-place (user constraint)
   - What's unclear: Delete existing ScanResult rows first, or upsert on conflict?
   - Recommendation: Delete ScanResult rows WHERE scan_id = X, then insert new (simpler than upsert, scan_id + parcel_id is unique)

4. **Filter live vs apply button**
   - What we know: User constraint says "Claude's Discretion based on expected result set sizes"
   - What's unclear: Threshold for live vs apply button? (e.g., <500 = live, ≥500 = apply button)
   - Recommendation: Start with live filters (immediate results), add apply button only if performance issues surface (database indexes should handle 2000 parcels efficiently)

5. **Score column in Excel export**
   - What we know: User constraint says "Claude's Discretion"
   - What's unclear: Include numeric score + category, or just category?
   - Recommendation: Include both (numeric for sorting in Excel, category for quick visual scan)

## Sources

### Primary (HIGH confidence)

- **ARQ 0.27.0 official documentation** (https://arq-docs.helpmanual.io/) - Job patterns, cancellation, progress tracking
- **openpyxl official docs** (https://openpyxl.readthedocs.io/en/stable/) - Excel generation, performance benchmarks
- **CBS gebiedsindelingen WFS 2026** (https://www.pdok.nl/ogc-webservices/-/article/cbs-gebiedsindelingen) - Gemeente boundary API
- **Propdex codebase** - Existing patterns: pdf_parsing_job (ARQ), list_reports (pagination), ParcelCache/AreaScan/ScanResult models

### Secondary (MEDIUM confidence)

- [fastapi-pagination library](https://uriyyo-fastapi-pagination.netlify.app/) - Pagination patterns (verified with existing codebase pattern)
- [openpyxl vs xlsxwriter benchmark](https://medium.com/@mass-software-solutions/optimizing-excel-report-generation-from-openpyxl-to-xlsmerge-processing-52-columns-200k-rows-5b5a03ecbcd4) - Performance comparison
- [Real estate site selection factors](https://blog.simoncre.com/insights/site-selection-what-are-the-key-factors-when-identifying-a-development-site) - Scoring methodology
- [Property scoring formulas](https://www.areadevelopment.com/corporate-site-selection-factors/q3-2025/scoring-the-site.shtml) - Weighted scoring patterns

### Tertiary (LOW confidence)

- ARQ GitHub issues #246, #449, #405 - Cancellation patterns (verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - ARQ, openpyxl, FastAPI, SQLAlchemy already in use or verified via official docs
- Architecture: HIGH - Patterns verified in existing codebase (pdf_parsing_job, list_reports, spatial queries)
- Pitfalls: MEDIUM - Based on common mistakes in background job systems, Excel generation, and codebase patterns
- Scoring methodology: MEDIUM - Based on real estate research but not domain-expert validated

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - stable stack, established patterns)
