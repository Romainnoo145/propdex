# Phase 66: Results Table Noise Reduction - Research

**Researched:** 2026-03-02
**Domain:** Full-stack filter preset (FastAPI query param + SQLAlchemy + React state toggle)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Score threshold approach** — hide parcels below a score cutoff (exact cutoff: Claude's discretion)
- **Null-score parcels hidden by default** — treated as noise
- **Filter is applied server-side** — API returns fewer results when filter is active
- **Default sort: score descending** — applied server-side so page 1 always shows top opportunities
- **Sort reset: score desc on page navigation/reload** — user can change, but sort is not persisted across navigations
- **Null-score parcels always sort to the bottom** regardless of sort direction
- **Toggle switch in table UI** — labeled, ON by default
- **Toggle label: "Top kansen (N verborgen)"** — count of hidden parcels shown in label
- **Toggle resets to ON (filtered) when opening results** — no persistence per scan
- **Auto-disable when filter would result in 0 visible rows** — with notice "Filter uitgeschakeld — geen percelen boven drempel"
- **Count display: "23 van 87 percelen"** — filtered_count + total_count both from server
- **Map always shows all parcels** regardless of table filter state — complete independence

### Claude's Discretion

- Exact score cutoff value (analyze data distribution for natural break)
- Toggle placement within existing results table layout
- Sort reset behavior when toggling filter on/off
- In-progress scan handling (filter during scoring or wait until complete)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RES-01 | Default results view shows parcels pre-filtered to likely development opportunities (residential zoning, no recent permits, has vacant land or old buildings), not all parcels from the scan | Server-side `min_score` query param + `exclude_null_scores` flag in `list_scan_results`; score threshold determines "likely opportunity" proxy |
| RES-02 | Results sorted by opportunity score descending by default, so highest-value parcels appear at top without user interaction | `sort_by=score&sort_order=desc` already the default in `list_results` endpoint; null-score parcels need SQLAlchemy `nulls_last()` applied |
</phase_requirements>

---

## Summary

Phase 66 adds a default filter preset to the results table so users see genuine development opportunities by default, not the full undifferentiated parcel list. The work spans three tiers: (1) backend — a new `min_score` query parameter and `exclude_null_scores` flag in the `list_scan_results` service function, (2) backend response — expose `filtered_count` + `total_count` in `ScanResultsResponse`, and (3) frontend — a toggle switch in `ResultsFilterPanel` that controls this filter and shows hidden-parcel count.

All sorting and filtering is already server-side. The existing `list_scan_results` service returns a `(rows, total)` tuple; adding a second count (pre-filter total) requires a separate count query. The toggle state lives in React component state, initialized to ON, and is not persisted between views — this matches the lock in CONTEXT.md.

**Primary recommendation:** Add `min_score: float | None` and `exclude_null_scores: bool = False` to `list_scan_results`, compute both `filtered_total` and `unfiltered_total` in the service, expose `total_unfiltered: int` in `ScanResultsResponse`, and render the toggle in `ResultsFilterPanel`. No new dependencies required.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy 2.x | 2.0.45 | ORM queries with `nulls_last()` | Already in project; `nulls_last` available in this version |
| FastAPI | Current | Query param for `min_score` / `exclude_null_scores` | Already used for all filter params |
| TanStack React Query | v5 | Cache invalidation when toggle changes filters | Already used for `useScanResults` |
| React useState | — | Toggle state — no URL persistence required | Matches CONTEXT.md: toggle resets on mount |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sqlalchemy.nulls_last` | 2.0.45 | Push null-score rows to bottom regardless of sort direction | Used in `list_scan_results` sort application |
| Lucide React `ToggleLeft`/`ToggleRight` | Current | Toggle icon in filter panel | Matches project icon library |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side filter (decided) | Client-side filter in TanStack Table | Client-side would not give accurate counts and would confuse pagination |
| `min_score` query param | `score_category=High` filter | `score_category` only hits 3 buckets; `min_score` gives continuous cutoff control |
| Toggle resets to ON on mount | URL-persisted toggle state | CONTEXT.md explicitly locks "no persistence per scan" |

**Installation:** No new packages required.

---

## Architecture Patterns

### How the Existing Code Works

The `list_results` endpoint in `backend/app/scans/router.py` (line 1829) delegates to `service.list_scan_results()`. That service function builds a SQLAlchemy query, applies filters, runs a count query, then applies sort + pagination. It returns `(rows, total)`. The `total` becomes `ScanResultsResponse.total`. The router also reads `scan.parcels_total` for `ScanResultsResponse.parcels_total` (the pre-qualification count).

**Current count semantics:**
- `parcels_total` = raw BAG parcel count before scoring (from `AreaScan.parcels_total`)
- `total` = count of `ScanResult` rows matching current filters (already filtered by score_category etc.)

**New count needed:**
- `total_unfiltered` = count of `ScanResult` rows ignoring the `min_score` / `exclude_null_scores` filter

### Pattern 1: Adding `min_score` + `exclude_null_scores` to `list_scan_results`

**What:** Two new optional parameters on the service function. When `exclude_null_scores=True`, add `ScanResult.score.is_not(None)` to the base query. When `min_score` is set, add `ScanResult.score >= min_score`. Count query runs twice: once with these filters (filtered total), once without (unfiltered total for showing hidden count).

**When to use:** When the toggle is ON (default state from frontend).

**Example:**

```python
# backend/app/scans/service.py — list_scan_results signature extension
async def list_scan_results(
    ...
    min_score: float | None = None,
    exclude_null_scores: bool = False,
) -> tuple[list[tuple], int, int]:  # rows, filtered_total, unfiltered_total
    ...
    # Unfiltered count (for "N hidden" display)
    unfiltered_count_query = select(func.count()).select_from(base_query.subquery())
    unfiltered_total = (await session.execute(unfiltered_count_query)).scalar() or 0

    # Apply score threshold filter
    if exclude_null_scores:
        query = query.where(ScanResult.score.is_not(None))
    if min_score is not None:
        query = query.where(ScanResult.score >= min_score)

    # Filtered count
    count_query = select(func.count()).select_from(query.subquery())
    filtered_total = (await session.execute(count_query)).scalar() or 0
    ...
    return rows, filtered_total, unfiltered_total
```

### Pattern 2: `nulls_last` for sort — SQLAlchemy 2.x

**What:** PostgreSQL sorts NULLs last by default on DESC sorts but first on ASC sorts. To make null-score parcels always go to the bottom regardless of direction, wrap sort expressions.

**Example:**

```python
# Source: SQLAlchemy 2.0 docs + verified with sqlalchemy 2.0.45 in this project
from sqlalchemy import nulls_last, nulls_first, desc, asc

# Always nulls at bottom:
if sort_order == "desc":
    query = query.order_by(nulls_last(desc(sort_field)))
else:
    query = query.order_by(nulls_last(asc(sort_field)))
```

Note: `nulls_last` is confirmed available in SQLAlchemy 2.0.45 (tested in project environment).

### Pattern 3: Toggle in `ResultsFilterPanel` + count propagation

**What:** `ResultsLayout` owns the `filters` state. It needs a new `filterMode: 'top' | 'all'` toggle (or a simple `showOnlyTop: boolean`). When ON: pass `min_score=<cutoff>` and `exclude_null_scores=true` in the API filters. The toggle label reads the `total_unfiltered - filtered_total` delta from the response.

**Count propagation challenge:** `ResultsTable` currently calls `onTotalChange(data.total)`. The `ResultsLayout` shows no count independently — count display is inside `ResultsTable`'s own header section. The toggle + count display should live in `ResultsFilterPanel`, which receives `total` from `ResultsLayout.onTotalChange`. Need to also propagate `total_unfiltered` from the response so the filter panel can compute `hidden = total_unfiltered - total`.

**Implementation approach:**
1. Add `total_unfiltered: int` to `ScanResultsResponse` (backend schema)
2. Add `total_unfiltered: number` to `ScanResultsResponse` TypeScript interface in `frontend/src/lib/types/scan.ts`
3. In `ResultsTable`, call `onTotalUnfilteredChange?.(data.total_unfiltered)` alongside existing `onTotalChange`
4. `ResultsLayout` passes `totalUnfiltered` to `ResultsFilterPanel`
5. `ResultsFilterPanel` renders the toggle with `hiddenCount = totalUnfiltered - total`

### Pattern 4: Auto-disable on empty filtered result set

**What:** When the filtered result count is 0, automatically set the toggle to OFF and show a Dutch notice. This must happen after the first API response with the filter enabled, not before.

**Implementation:**

```tsx
// In ResultsTable or ResultsLayout — after data loads:
useEffect(() => {
  if (showOnlyTop && data?.total === 0 && (data?.total_unfiltered ?? 0) > 0) {
    setShowOnlyTop(false)
    // show toast or inline notice
  }
}, [data?.total, data?.total_unfiltered, showOnlyTop])
```

### Pattern 5: Map independence

**What:** The map tile endpoint (`GET /{scan_id}/tiles/{z}/{x}/{y}.pbf`) is completely separate from the results endpoint. It always renders all parcels regardless of filter state. No changes needed to map or tile code.

### Anti-Patterns to Avoid

- **Storing toggle in URL state**: CONTEXT.md locks "no persistence per scan" — keep it as React state, not a URL param.
- **Adding `min_score` to `ScanResultsFilters` type without a corresponding API param**: The TypeScript type must match the new backend query param exactly.
- **Running the unfiltered count after applying score filters**: The unfiltered count query must branch off `base_query` before the score threshold is applied.
- **Using `score_category` filter instead of `min_score`**: `score_category` is a user-facing filter in the panel that should remain independent. The default preset filter is a separate concern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Null-last sort | Custom SQL text with `NULLS LAST` | `sqlalchemy.nulls_last()` | Built into SQLAlchemy 2.x, type-safe |
| Two-count query | Single count with conditional logic | Separate subqueries off `base_query` | Cleaner separation of filtered vs unfiltered semantics |
| Toggle persistence | localStorage or URL param | React `useState` (not persisted) | CONTEXT.md locks no-persistence |

---

## Common Pitfalls

### Pitfall 1: Count query ordering

**What goes wrong:** Running the unfiltered count query after `score` filters are already applied means you always get `hidden = 0`.
**Why it happens:** The filter conditions are added to `query` in-place; the count subquery wraps the already-filtered query.
**How to avoid:** Branch off `base_query` (before score threshold is applied) for the unfiltered count.
**Warning signs:** `total_unfiltered == total` always.

### Pitfall 2: `nulls_last` on subscore sorts

**What goes wrong:** When the user sorts by `buildability_subscore` or `vacancy_subscore`, those are computed expressions (`_buildability_subscore_expr()` / `_vacancy_subscore_expr()`). Applying `nulls_last()` to them is the same pattern — just wrap the expression.
**How to avoid:** Apply `nulls_last()` uniformly in the sort map, not just on the `score` field.
**Warning signs:** Null-score parcels appear at top when sorting ASC by subscore.

### Pitfall 3: Toggle initializes ON before first API response

**What goes wrong:** Toggle is ON, first render shows loading skeleton, then data arrives with 0 results — causes flash of empty state before auto-disable kicks in.
**How to avoid:** Only trigger auto-disable after `!isLoading && data !== undefined`. Use `useEffect` dependency on `data?.total`.

### Pitfall 4: `ScanResultsFilters` type drift

**What goes wrong:** Adding `min_score` and `exclude_null_scores` only to the backend without updating the TypeScript `ScanResultsFilters` interface causes TypeScript type errors in the API call layer.
**How to avoid:** Update `frontend/src/lib/types/scan.ts` `ScanResultsFilters` interface and `frontend/src/lib/api.ts` `fetchScanResults` param serialization in one task.

### Pitfall 5: Return type change in `list_scan_results`

**What goes wrong:** `list_scan_results` currently returns `tuple[list[tuple], int]`. Changing to `tuple[list[tuple], int, int]` (filtered_total, unfiltered_total) breaks the call site in `router.py`.
**How to avoid:** Update both the service function return type annotation and the router destructuring in the same change. The router currently does `rows, total = await service.list_scan_results(...)`.

---

## Code Examples

### Backend — extended service signature

```python
# backend/app/scans/service.py
async def list_scan_results(
    scan_id: uuid.UUID,
    organization_id: uuid.UUID,
    has_pand: bool | None,
    search: str | None,
    bestemming_type: str | None,
    min_area_m2: float | None,
    max_area_m2: float | None,
    score_category: str | None,
    sort_by: str,
    sort_order: str,
    offset: int,
    limit: int,
    session: AsyncSession,
    pand_status: str | None = None,
    min_score: float | None = None,        # NEW
    exclude_null_scores: bool = False,     # NEW
) -> tuple[list[tuple], int, int]:        # rows, filtered_total, unfiltered_total
```

### Backend — unfiltered count branch

```python
# Run unfiltered count before applying score threshold
unfiltered_count_q = select(func.count()).select_from(query.subquery())
unfiltered_total = (await session.execute(unfiltered_count_q)).scalar() or 0

# Apply score threshold filters
if exclude_null_scores:
    query = query.where(ScanResult.score.is_not(None))
if min_score is not None:
    query = query.where(ScanResult.score >= min_score)
```

### Backend — nulls_last sort

```python
from sqlalchemy import nulls_last, asc, desc

sort_field = sort_field_map.get(sort_by, ScanResult.score)
if sort_order == "desc":
    query = query.order_by(nulls_last(desc(sort_field)))
else:
    query = query.order_by(nulls_last(asc(sort_field)))
```

### Backend — updated router call site

```python
# backend/app/scans/router.py — list_results endpoint
rows, total, total_unfiltered = await service.list_scan_results(
    ...
    min_score=min_score,
    exclude_null_scores=exclude_null_scores,
)

return ScanResultsResponse(
    ...
    total=total,
    total_unfiltered=total_unfiltered,
    ...
)
```

### Backend — schema extension

```python
# backend/app/scans/schemas.py — ScanResultsResponse
class ScanResultsResponse(BaseModel):
    ...
    total: int = Field(description="Filtered result count (before pagination)")
    total_unfiltered: int = Field(
        description="Total results ignoring score threshold filter (for hidden-count display)",
        ge=0,
    )
```

### Frontend — toggle state in ResultsLayout

```tsx
// frontend/src/components/results/ResultsLayout.tsx
const [showOnlyTop, setShowOnlyTop] = useState(true)  // ON by default, no URL persistence
const [totalUnfiltered, setTotalUnfiltered] = useState(0)

// Build filters passed to ResultsTable
const tableFilters: ScanResultsFilters = {
  ...filters,
  ...(showOnlyTop ? { min_score: SCORE_CUTOFF, exclude_null_scores: true } : {}),
}
```

### Frontend — ScanResultsFilters extension

```typescript
// frontend/src/lib/types/scan.ts
export interface ScanResultsFilters {
  ...
  min_score?: number          // NEW — server-side score threshold filter
  exclude_null_scores?: boolean  // NEW — exclude null-score rows from results
}

export interface ScanResultsResponse {
  ...
  total_unfiltered: number    // NEW — count before score threshold filter
}
```

### Frontend — toggle label with hidden count

```tsx
// In ResultsFilterPanel
const hiddenCount = totalUnfiltered - total
const toggleLabel = showOnlyTop
  ? `Top kansen${hiddenCount > 0 ? ` (${hiddenCount.toLocaleString('nl-NL')} verborgen)` : ''}`
  : 'Alle percelen'
```

### Frontend — auto-disable on zero results

```tsx
useEffect(() => {
  if (!isLoading && showOnlyTop && data?.total === 0 && (data?.total_unfiltered ?? 0) > 0) {
    setShowOnlyTop(false)
    toast.info('Filter uitgeschakeld — geen percelen boven drempel', { duration: 3000 })
  }
}, [isLoading, data?.total, data?.total_unfiltered, showOnlyTop])
```

---

## Score Cutoff Recommendation (Claude's Discretion)

Based on the scoring model (confidence: HIGH from source code analysis):

**Score distribution facts from `parcel_scoring.py`:**
- Category boundaries: `High >= 62`, `Medium >= 38`, `Low < 38`
- `QUALIFICATION_THRESHOLD = 40.0` — the minimum score for a parcel to appear in scan results at all (set in `parcel_scoring.py`)
- Null scores: Parcels with null scores are those where scoring was skipped or data was insufficient

**Recommended cutoff: 40** (matching `QUALIFICATION_THRESHOLD`)

Rationale: The backend already only stores parcels with scores >= 40 (via `QUALIFICATION_THRESHOLD`). This means null-score parcels are the primary noise, and the filter should primarily `exclude_null_scores=True`. Setting `min_score=40` as the threshold is redundant with the existing qualification threshold but makes the intent explicit and future-proof.

**Alternative if distribution data shows clustering:** After examining Venlo data, if parcels cluster at >= 50 as the natural break above the noise floor, use `min_score=50`. The toggle label makes this transparent to users.

**For Phase 66 planning purposes, use `min_score=40` and `exclude_null_scores=True` as the default preset.** This is the lowest sensible cutoff and will surface all qualified parcels while hiding unscored noise.

---

## Implementation Scope — All Files to Modify

| File | Change |
|------|--------|
| `backend/app/scans/service.py` | Add `min_score`, `exclude_null_scores` params; unfiltered count branch; `nulls_last` sort; return 3-tuple |
| `backend/app/scans/schemas.py` | Add `total_unfiltered: int` to `ScanResultsResponse` |
| `backend/app/scans/router.py` | Add `min_score`, `exclude_null_scores` query params; destructure 3-tuple; pass to response |
| `frontend/src/lib/types/scan.ts` | Add `min_score?`, `exclude_null_scores?` to `ScanResultsFilters`; add `total_unfiltered: number` to `ScanResultsResponse` |
| `frontend/src/lib/api.ts` | Serialize `min_score` + `exclude_null_scores` in `fetchScanResults` |
| `frontend/src/components/results/ResultsLayout.tsx` | Add `showOnlyTop` state; pass `min_score`/`exclude_null_scores` in filters; propagate `totalUnfiltered` |
| `frontend/src/components/results/ResultsFilterPanel.tsx` | Add toggle switch; show label with hidden count; receive `totalUnfiltered` prop |
| `frontend/src/components/results/ResultsTable.tsx` | Add `onTotalUnfilteredChange?` callback; call it when `data.total_unfiltered` changes |
| `frontend/src/hooks/useScans.ts` | No change needed — `useScanResults` passes filters through, cache key already includes filters |

**Files NOT modified:**
- Map/tile code — map stays independent (locked decision)
- `ResultsTable` mobile branch — same filters apply; toggle UX is in `ResultsFilterPanel` above
- Scoring model — phase only changes how results are surfaced, not how they are computed

---

## Open Questions

1. **Count query performance with two subqueries**
   - What we know: The existing single count query runs fast enough for 50-page scans
   - What's unclear: Whether adding a second count (unfiltered) will noticeably slow the endpoint under 108K parcel scans
   - Recommendation: Both count queries use the same base filters (organization_id, scan_id) so they're similarly selective. Proceed without optimization; add index if slow.

2. **In-progress scan handling**
   - What we know: CONTEXT.md marks this as Claude's discretion
   - What's unclear: Whether to show the toggle while a scan is still scoring (some parcels have null scores temporarily)
   - Recommendation: Show toggle only when `scan.status === 'completed'`. While scan is running, disable the toggle (show as greyed-out, all parcels visible) to avoid confusing behavior where hidden count changes mid-scan.

---

## Sources

### Primary (HIGH confidence)

- `backend/app/scans/service.py` — `list_scan_results` function, current signature and count pattern (lines 352-471), directly read
- `backend/app/scans/schemas.py` — `ScanResultsResponse` schema, directly read
- `backend/app/scans/router.py` — `list_results` endpoint implementation (lines 1829-2026), directly read
- `backend/app/services/parcel_scoring.py` — `QUALIFICATION_THRESHOLD = 40.0`, category boundaries, directly read
- `frontend/src/components/results/ResultsLayout.tsx` — `filters` state and table wiring, directly read
- `frontend/src/components/results/ResultsFilterPanel.tsx` — existing filter UI pattern, directly read
- `frontend/src/components/results/ResultsTable.tsx` — `onTotalChange` callback and `data.total`, directly read
- `frontend/src/lib/types/scan.ts` — `ScanResultsFilters` and `ScanResultsResponse` interfaces, directly read
- SQLAlchemy 2.0.45 — `nulls_last` and `nulls_first` confirmed available (verified in project environment)

### Secondary (MEDIUM confidence)

- `frontend/src/hooks/useScans.ts` — `useScanResults` query key includes `filters`, so toggle change automatically triggers re-fetch

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — read all relevant source files directly; no speculation
- Pitfalls: HIGH — derived from direct code inspection of existing patterns

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable codebase, no fast-moving dependencies)
