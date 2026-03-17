# Phase 85: Explorer UI - Research

**Researched:** 2026-03-09
**Domain:** Full-stack search UI (React + FastAPI) + AI rechtsgrond classification
**Confidence:** HIGH

## Summary

Phase 85 builds a standalone `/jurisprudentie` page with a filter-sidebar + results layout for searching cached court rulings across all gemeenten. The page queries the existing `ruling_cache` table (no live API calls) and adds a new AI rechtsgrond classification dimension (5 gouden gronden). The codebase already has all foundational pieces: TanStack Router file-based routing, TanStack Query with `useInfiniteQuery` patterns, the `ruling_cache` model with AI analysis JSONB, and the Claude analysis pipeline with prompt + schema validation.

The main technical work divides into three tracks: (1) backend explorer endpoint with multi-filter query + cursor pagination + filter count aggregation, (2) AI rechtsgrond classifier extending the existing prompt/schema/migration pipeline, and (3) frontend page with filter sidebar, infinite scroll results, and empty-state suggestions. No new dependencies are needed — everything uses existing TanStack Query v5, TanStack Router v1, Lucide icons, and the project's primitives library.

**Primary recommendation:** Build the backend explorer endpoint first (with rechtsgrond column migration), then the AI classifier backfill, then the frontend page. The backend is the critical path since the frontend depends on its filter counts and pagination API.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New `/jurisprudentie` route added to side rail (SideRailNav.tsx), between Rapporten and Instellingen
- Standalone page — not nested inside gemeente detail view
- Scale icon (lucide) for the nav item
- Filter sidebar left, results panel right (classic search pattern)
- Sidebar contains: Gemeente dropdown, Vergunningstype, Uitkomst, Rechtsgrond, Rechtbank-niveau, Tijdsperiode
- Each filter shows result count before applying (prevents empty-result frustration)
- Infinite scroll for results (useInfiniteQuery pattern)
- Queries ruling_cache table only (cached rulings from previously scanned gemeenten)
- Gemeente dropdown populated from distinct gemeenten in ruling_cache
- No live Rechtspraak API calls — fast, reliable, pre-analyzed data
- All rulings already have AI summaries from Phase 84 pipeline
- AI rechtsgrond classification: 5 categories (Procedurefout, Motiveringsgebrek, Gelijkheidsbeginsel, Disproportioneel, ETFAL/Ruimtelijke ordening)
- Store classifications in ruling_cache (new JSONB column or similar)
- Ruling cards show: ECLI, rechtbank, datum, gemeente, AI-samenvatting, vergunningstype + uitkomst badges, rechtsgrond tags, doorlooptijd, expand/collapse
- When results < 3: "Verbreed uw zoekopdracht" with actionable suggestions
- MVP mindset — must demonstrate strategic value to investors
- This is NOT a gemeente-scoped feature — cross-gemeente search tool

### Claude's Discretion
- Exact filter component implementation (select, checkbox, combobox)
- Backend query optimization and pagination strategy
- Ruling card typography and spacing
- How to handle the rechtsgrond classifier prompt engineering
- Mobile responsiveness approach for sidebar collapse

### Deferred Ideas (OUT OF SCOPE)
- Bruikbaarheid/Propdex Score — hybrid relevance score with project-context coupling
- Argument Builder — AI generates concept-onderbouwing from selected rulings
- Geo-Jurisprudentie Mapping — court ruling markers on map
- Beslisboom-Trend — Phase 86 (Trend & Statistics)
- Live Rechtspraak API search — expand beyond cached data
- Opslaan/exporteren — save rulings to collection or export
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXPL-01 | Two-tab layout: Overzicht (chronological feed) and Explorer (multi-filter search) | CONTEXT.md evolved this: standalone `/jurisprudentie` page is the Explorer. Existing JurisprudenceSection in GemeenteDetailView remains as the "Overzicht" feed. No tabs needed — they're separate routes. |
| EXPL-02 | Filter sidebar with scope, vergunningstype, uitkomst, tijdsperiode | Backend explorer endpoint with multi-filter WHERE clauses + GROUP BY aggregation for counts. CONTEXT.md expanded filters to include Gemeente, Rechtsgrond, Rechtbank-niveau. |
| EXPL-03 | Filter counts shown before applying — prevents empty result frustration | Backend returns facet counts alongside results. Single query with conditional aggregation or parallel count queries. |
| EXPL-04 | Pagination via useInfiniteQuery for large result sets | Existing `useInfiniteQuery` pattern in `useNotifications.ts` — cursor-based with `has_more` flag from backend. |
| EXPL-05 | "Verbreed uw zoekopdracht" suggestions when results < 3 | Frontend logic: when result count < 3, compute which filter removal adds most results (using facet counts), generate Dutch suggestion strings. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Query | ^5.90.20 | Data fetching, infinite scroll, caching | Already in project, `useInfiniteQuery` used in useNotifications |
| TanStack Router | ^1.158.4 | File-based routing for `/jurisprudentie` | Already in project, all routes use `createFileRoute` |
| FastAPI | existing | Backend explorer endpoint | Already in project |
| SQLAlchemy 2.x | existing | Multi-filter query with aggregation | Already in project, `Mapped` + `mapped_column` |
| Alembic | existing | Add `rechtsgronden` column to ruling_cache | Already in project, 26 migrations |
| Anthropic SDK | existing | Rechtsgrond classification prompt | Already in project via `create_claude_client()` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Lucide React | ^0.564.0 | Scale icon for nav, filter icons | Already in project |
| clsx | ^2.1.1 | Conditional class composition | Already in project |
| sonner | ^2.0.7 | Toast notifications for errors | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<select>` for filters | Headless UI Combobox | Over-engineering for MVP; native selects match existing primitives (Select component) |
| Cursor pagination | Offset pagination | Cursor is better for infinite scroll but offset is simpler; offset is fine for ruling_cache (< 10K rows per deployment) |
| Separate facet count endpoint | Inline facets in main query | Separate endpoint adds latency; inline CTE/subquery is faster |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
├── app/api/endpoints/jurisprudence.py  # Add /explorer endpoint + /explorer/facets
├── app/ai/prompts.py                   # Add RECHTSGROND_CLASSIFY_PROMPT
├── app/ai/schemas.py                   # Add RechtsgrondClassification model
├── app/models/ruling_cache.py          # Add rechtsgronden JSONB column
├── alembic/versions/xxx_add_rechtsgronden.py  # Migration

frontend/
├── src/routes/_authenticated/jurisprudentie.tsx  # New route page
├── src/hooks/useExplorer.ts             # useInfiniteQuery + facet hooks
├── src/components/jurisprudentie/       # New component directory
│   ├── ExplorerFilterSidebar.tsx        # Filter sidebar with counts
│   ├── RulingCard.tsx                   # Ruling result card (expand/collapse)
│   └── BroadenSuggestion.tsx            # Empty-state suggestions
├── src/components/layout/SideRailNav.tsx  # Add Scale icon nav item
```

### Pattern 1: Backend Explorer Endpoint with Faceted Counts
**What:** Single endpoint returning paginated results + facet counts for all filter dimensions
**When to use:** When filters need to show counts before user applies them
**Example:**
```python
# GET /api/jurisprudence/explorer?gemeente=Venlo&uitkomst=toegewezen&offset=0&limit=20
# Response:
{
    "results": [...],
    "total_count": 47,
    "has_more": true,
    "facets": {
        "gemeente": [{"value": "Venlo", "count": 23}, {"value": "Utrecht", "count": 15}, ...],
        "vergunningstype": [{"value": "nieuwbouw", "count": 12}, ...],
        "uitkomst": [{"value": "toegewezen", "count": 20}, ...],
        "rechtsgrond": [{"value": "procedurefout", "count": 8}, ...],
        "rechtbank_niveau": [{"value": "Rechtbank", "count": 30}, ...],
    }
}
```
**Key insight:** Facet counts are computed from the FULL dataset with all OTHER filters applied (except the facet's own dimension). This lets users see "if I change this filter, how many results?" without empty-state frustration.

### Pattern 2: TanStack Router File-Based Route
**What:** New file `frontend/src/routes/_authenticated/jurisprudentie.tsx` auto-registers as route
**When to use:** Standard for all authenticated pages in this project
**Example:**
```typescript
// Source: existing pattern from rapporten.tsx
export const Route = createFileRoute('/_authenticated/jurisprudentie')({
    validateSearch: (search: Record<string, unknown>) => ({
        gemeente: typeof search.gemeente === 'string' ? search.gemeente : undefined,
        vergunningstype: typeof search.vergunningstype === 'string' ? search.vergunningstype : undefined,
        // ... other filters as URL search params
    }),
    component: JurisprudentiePage,
})
```
After creating the file, run `npx @tanstack/router-cli generate` (or the dev server does it automatically) to update `routeTree.gen.ts`.

### Pattern 3: useInfiniteQuery for Pagination
**What:** Cursor/offset-based infinite scroll using existing project pattern
**When to use:** For the main results list
**Example:**
```typescript
// Source: existing pattern from useNotifications.ts
const PAGE_SIZE = 20

return useInfiniteQuery<ExplorerResponse, Error>({
    queryKey: ['explorer', filters],
    queryFn: ({ pageParam = 0 }) =>
        fetchExplorerResults(accessToken, filters, PAGE_SIZE, pageParam as number),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
        if (lastPage.has_more) {
            return (lastPageParam as number) + PAGE_SIZE
        }
        return undefined
    },
    enabled: !!accessToken,
    staleTime: 5 * 60_000,
})
```

### Pattern 4: Rechtsgrond AI Classification (Backfill)
**What:** Extend existing AI analysis pipeline to add rechtsgrond classification
**When to use:** One-time backfill of already-analyzed rulings + inclusion in future analysis runs
**Design choices:**
- Option A: Extend `JURIDISCH_ANALYSE_PROMPT_V2` to include rechtsgrond in same call → simple, no extra API cost
- Option B: Separate classification prompt for backfill → allows re-running without full re-analysis
- **Recommendation: Option A** for new rulings (extend prompt + schema), plus a lightweight backfill job that runs the classifier on already-analyzed rulings with full_text

### Anti-Patterns to Avoid
- **Fetching facets in separate round-trips per dimension:** Causes waterfall of 6 API calls. Use single endpoint with CTE or parallel subqueries.
- **Storing filter state in React state only:** Filters should be URL search params so the page is shareable/bookmarkable. TanStack Router's `validateSearch` handles this.
- **Loading all rulings client-side for filtering:** Even with < 10K rulings, JSON transfer + client memory is wasteful. Keep filtering server-side.
- **Re-analyzing all rulings for rechtsgrond:** Rulings that already have `ai_analysis` just need the rechtsgrond classification added — don't re-run the full analysis prompt.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Infinite scroll intersection | Custom scroll listener | `useInfiniteQuery` + IntersectionObserver (3-line hook) | Scroll listeners are brittle, IO is efficient |
| URL search param sync | Custom useSearchParams | TanStack Router `validateSearch` + `useSearch` | Already integrated, type-safe |
| Filter debouncing | Custom setTimeout | None needed — filters are discrete selections, not text input | Don't add complexity where it's not needed |
| Pagination offset tracking | Custom state | `useInfiniteQuery` handles `pageParam` automatically | Built-in page tracking |

**Key insight:** This phase is mostly plumbing existing patterns together. The novel work is the rechtsgrond classifier prompt and the faceted count query. Everything else follows established project patterns.

## Common Pitfalls

### Pitfall 1: Facet counts that don't account for cross-filter interaction
**What goes wrong:** Showing total counts per filter value instead of counts-given-other-active-filters. User selects "Venlo" + "nieuwbouw" and sees "toegewezen: 150" but after applying gets 3 results.
**Why it happens:** Facet counts are computed without applying other dimension's filters.
**How to avoid:** For each facet dimension, compute counts with ALL other filters applied EXCEPT that dimension's own filter. This is the standard "cross-faceted count" pattern.
**Warning signs:** Filter counts that don't decrease as more filters are added.

### Pitfall 2: routeTree.gen.ts not updated after adding new route file
**What goes wrong:** New `/jurisprudentie` route returns 404 in development.
**Why it happens:** TanStack Router code-generates the route tree. If the dev server isn't running, the file isn't auto-generated.
**How to avoid:** Either run `npm run dev` (which watches for new route files) or manually run `npx @tanstack/router-cli generate`.
**Warning signs:** Route file exists but navigation doesn't work.

### Pitfall 3: rechtsgronden column migration on ruling_cache (org-agnostic table)
**What goes wrong:** Migration tries to add NOT NULL column to populated table.
**Why it happens:** ruling_cache already has data from Phases 82-84.
**How to avoid:** Use `nullable=True` for the new `rechtsgronden` JSONB column. Backfill via AI job after migration.
**Warning signs:** Migration fails with "column cannot be null" on existing rows.

### Pitfall 4: Infinite scroll triggering too many requests
**What goes wrong:** Scroll event fires multiple fetches simultaneously.
**Why it happens:** IntersectionObserver fires while previous page is still loading.
**How to avoid:** Guard the fetch trigger with `hasNextPage && !isFetchingNextPage` from `useInfiniteQuery`.
**Warning signs:** Duplicate page requests in network tab.

### Pitfall 5: SideRailNav link order
**What goes wrong:** New nav item appears in wrong position or breaks existing layout.
**Why it happens:** Items are manually ordered in the `navItems` array and standalone JSX blocks.
**How to avoid:** Add Jurisprudentie as a standalone `<Link>` block between the Rapporten link and the bottom Settings section, matching the existing pattern (not in the `navItems` array, which only has Kaart + Projecten).
**Warning signs:** Layout shift or items appearing in unexpected order.

### Pitfall 6: AI rechtsgrond classifier returning inconsistent categories
**What goes wrong:** Claude returns "Procedureel gebrek" instead of "Procedurefout", breaking filter matching.
**Why it happens:** LLM output variance — exact string matching is fragile.
**How to avoid:** Use a Literal type in the Pydantic schema with exact enum values. Add the 5 exact strings to the prompt with descriptions. Validate on parse.
**Warning signs:** Facet counts showing many variations of the same category.

## Code Examples

### Backend: Explorer endpoint with faceted counts
```python
# Pattern for computing cross-faceted counts using SQLAlchemy
from sqlalchemy import func, case, select, and_

async def get_explorer_results(
    db: AsyncSession,
    filters: ExplorerFilters,
    limit: int = 20,
    offset: int = 0,
):
    # Base query with all filters
    base_where = build_where_clauses(filters)

    # Main results query
    results_stmt = (
        select(RulingCache)
        .where(*base_where)
        .order_by(RulingCache.datum_uitspraak.desc())
        .offset(offset)
        .limit(limit + 1)  # +1 to detect has_more
    )

    # Facet count queries — each excludes its own dimension's filter
    facet_queries = {}
    for dimension in ['gemeente', 'vergunningstype', 'uitkomst', 'rechtsgrond']:
        other_filters = build_where_clauses(filters, exclude_dimension=dimension)
        col = getattr(RulingCache, dimension_to_column(dimension))
        facet_stmt = (
            select(col, func.count())
            .where(*other_filters)
            .where(col.isnot(None))
            .group_by(col)
            .order_by(func.count().desc())
        )
        facet_queries[dimension] = facet_stmt
```

### Backend: Rechtsgrond classification schema extension
```python
# Add to app/ai/schemas.py
class RulingAnalysis(BaseModel):
    # ... existing fields ...
    rechtsgronden: list[Literal[
        "procedurefout",
        "motiveringsgebrek",
        "gelijkheidsbeginsel",
        "disproportioneel",
        "etfal_ruimtelijke_ordening",
    ]] = Field(
        default_factory=list,
        description="Applicable legal grounds (1+ per ruling)",
    )
```

### Frontend: Intersection observer for infinite scroll trigger
```typescript
// Simple IO hook for triggering next page fetch
function useIntersectionTrigger(
    ref: React.RefObject<HTMLElement>,
    callback: () => void,
    enabled: boolean,
) {
    useEffect(() => {
        if (!enabled || !ref.current) return
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) callback() },
            { rootMargin: '200px' },
        )
        observer.observe(ref.current)
        return () => observer.disconnect()
    }, [ref, callback, enabled])
}
```

### Frontend: Broaden-search suggestion logic
```typescript
// When results < 3, suggest removing the most restrictive filter
function computeBroadenSuggestions(
    activeFilters: Record<string, string>,
    facets: Record<string, FacetItem[]>,
): BroadenSuggestion[] {
    return Object.entries(activeFilters)
        .filter(([_, value]) => !!value)
        .map(([dimension, value]) => {
            // Find total count if this filter were removed
            const totalWithout = facets[dimension]
                ?.reduce((sum, f) => sum + f.count, 0) ?? 0
            return {
                dimension,
                currentValue: value,
                additionalResults: totalWithout,
                message: `Verwijder filter '${value}' voor ${totalWithout} meer resultaten`,
            }
        })
        .filter(s => s.additionalResults > 0)
        .sort((a, b) => b.additionalResults - a.additionalResults)
}
```

### Database: Migration for rechtsgronden column
```python
# Alembic migration
def upgrade():
    op.add_column(
        'ruling_cache',
        sa.Column('rechtsgronden', JSONB, nullable=True),
    )
    op.create_index(
        'ix_ruling_cache_rechtsgronden',
        'ruling_cache',
        ['rechtsgronden'],
        postgresql_using='gin',
    )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useQuery` + manual page tracking | `useInfiniteQuery` built-in | TanStack Query v5 | Auto page param management, simpler code |
| Manual URL param parsing | TanStack Router `validateSearch` | Already in project | Type-safe search params, automatic serialization |
| Separate AI analysis + rechtsgrond | Combined prompt with all fields | This phase | Single API call, lower cost, consistent results |

## Open Questions

1. **Rechtsgrond backfill strategy for existing analyzed rulings**
   - What we know: ~hundreds of rulings already have `ai_analysis` JSONB from Phase 84 but no rechtsgrond field
   - What's unclear: Whether to re-analyze with the extended prompt (costly) or run a lightweight classifier-only prompt on existing full_text
   - Recommendation: Lightweight backfill job that reads `full_text` and classifies rechtsgrond only (separate prompt, lower token cost). For NEW rulings going forward, extend the main analysis prompt.

2. **Rechtbank-niveau filter dimension**
   - What we know: `instantie` column stores court name ("Rechtbank Limburg", "Raad van State", etc.)
   - What's unclear: Exact taxonomy for grouping (Rechtbank vs Gerechtshof vs Raad van State vs ABRvS)
   - Recommendation: Parse from `court_code` or `instantie` — group into 3 levels: Rechtbank, Gerechtshof, Raad van State. Derive at query time, no new column needed.

3. **Tijdsperiode filter UX**
   - What we know: `datum_uitspraak` is a string column (`YYYY-MM-DD` format)
   - What's unclear: Whether to use preset ranges ("Afgelopen jaar", "Afgelopen 3 jaar") or custom date picker
   - Recommendation: Preset ranges for MVP (Afgelopen jaar / 3 jaar / 5 jaar / Alles). Simpler UX, no date picker dependency. Store as `period` search param.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/app/models/ruling_cache.py`, `backend/app/api/endpoints/jurisprudence.py`, `backend/app/ai/claude_client.py`, `backend/app/ai/prompts.py`, `backend/app/ai/schemas.py`
- Codebase inspection: `frontend/src/hooks/useJurisprudence.ts`, `frontend/src/hooks/useNotifications.ts` (useInfiniteQuery pattern)
- Codebase inspection: `frontend/src/routes/_authenticated/rapporten.tsx` (route + page pattern)
- Codebase inspection: `frontend/src/components/layout/SideRailNav.tsx` (nav structure)
- Codebase inspection: `frontend/src/components/projects/JurisprudenceSection.tsx` (ruling card UI)

### Secondary (MEDIUM confidence)
- TanStack Query v5 `useInfiniteQuery` API — verified via codebase usage in `useNotifications.ts`
- TanStack Router file-based routing — verified via codebase `routeTree.gen.ts` auto-generation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, patterns verified in codebase
- Architecture: HIGH - follows established project patterns (routes, hooks, endpoints, migrations)
- Pitfalls: HIGH - identified from direct codebase inspection of existing patterns
- AI rechtsgrond classifier: MEDIUM - prompt engineering is inherently iterative, but schema validation pattern is proven

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable — no external dependency changes expected)