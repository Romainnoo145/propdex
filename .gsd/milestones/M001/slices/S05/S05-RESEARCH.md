# Phase 86: Trend & Statistics - Research

**Researched:** 2026-03-09
**Domain:** Time-series aggregation + CSS-only data visualization
**Confidence:** HIGH

## Summary

Phase 86 adds a rolling 12-month klimaat score trend and aggregated statistics bar to the existing juridisch klimaat system. The data infrastructure is already in place: `ruling_cache` has `datum_uitspraak`, `uitkomst`, `doorlooptijd_dagen`, and `vergunningstype` columns. The analysis trigger/poll endpoints already compute `juridisch_klimaat_score` and `vergunnings_succeskans` from the same data. This phase is purely about monthly bucketing on the backend and CSS-only visualization on the frontend.

The key constraint is **no chart library** -- the timeline must be CSS-only (flexbox bars, CSS grid, or similar). With 10-20 data points (months), this is straightforward. The requirement specifies graceful degradation with fewer than 3 data points, which means the component must handle sparse data without rendering misleading visualizations.

**Primary recommendation:** Add a single `/api/jurisprudence/trend/{gemeente_naam}` endpoint that returns monthly buckets with score + stats, and build two CSS-only frontend components (TrendTimeline + StatisticsBar) that integrate into JurisprudenceSection.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TREND-01 | Rolling 12-month juridisch klimaat score trend per gemeente | Backend: monthly bucketing query on ruling_cache grouped by date_trunc('month', datum_uitspraak). Frontend: CSS-only bar chart with 12 columns |
| TREND-02 | Aggregated statistics bar (totaal uitspraken, gemiddelde doorlooptijd, succespercentage) | Backend: already computed in trigger_ruling_analysis endpoint, extract to reusable function. Frontend: horizontal stat badges |
| TREND-03 | CSS-only timeline visualization, degrades gracefully with <3 data points | Frontend: flexbox bar chart with relative heights, conditional "onvoldoende data" message when months < 3 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SQLAlchemy 2.x | existing | Monthly aggregation via func.date_trunc | Already used throughout backend |
| FastAPI | existing | New trend endpoint | Already used for all jurisprudence endpoints |
| React + TanStack Query | existing | Data fetching + caching | Already used for all jurisprudence hooks |
| Tailwind CSS | existing | CSS-only visualization | Already used for all styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | existing | Icons for stats bar | Already imported in JurisprudenceSection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-only bars | recharts/vitest/chart.js | Explicitly excluded by TREND-03 requirement |
| New endpoint | Inline in existing rulings endpoint | Separate endpoint keeps responses focused and cacheable |

**Installation:**
No new dependencies needed.

## Architecture Patterns

### Backend: New Endpoint Structure

The trend endpoint lives alongside existing jurisprudence endpoints in `backend/app/api/endpoints/jurisprudence.py`.

```
backend/app/
├── api/endpoints/jurisprudence.py   # Add GET /trend/{gemeente_naam}
└── services/doorlooptijd.py         # Reuse existing aggregation patterns
```

### Frontend: Component Structure

```
frontend/src/
├── components/projects/
│   ├── JurisprudenceSection.tsx      # Integrate TrendTimeline + StatisticsBar
│   ├── JuridischKlimaatCard.tsx      # Existing -- keep as-is
│   ├── TrendTimeline.tsx             # NEW: CSS-only 12-month bar chart
│   └── StatisticsBar.tsx             # NEW: Aggregated stats row
├── hooks/
│   └── useJurisprudence.ts           # Add useTrendData hook
└── lib/
    └── api.ts                        # Add TrendResponse type + fetchTrend function
```

### Pattern 1: Monthly Bucketing Query

**What:** Group rulings by month using PostgreSQL `date_trunc`, compute per-month klimaat score
**When to use:** For the trend endpoint

```python
# Backend: Monthly aggregation using existing SQLAlchemy patterns
from sqlalchemy import func, case, cast, String

stmt = (
    select(
        func.to_char(
            func.to_date(RulingCache.datum_uitspraak, "YYYY-MM-DD"),
            "YYYY-MM"
        ).label("month"),
        func.count().label("total"),
        func.count(case((RulingCache.uitkomst == "toegewezen", 1))).label("toegewezen"),
        func.count(case((RulingCache.uitkomst == "afgewezen", 1))).label("afgewezen"),
        func.count(case((RulingCache.uitkomst == "gedeeltelijk", 1))).label("gedeeltelijk"),
        func.avg(RulingCache.doorlooptijd_dagen).label("avg_doorlooptijd"),
    )
    .where(
        (RulingCache.gemeente_query == gemeente_naam)
        | (RulingCache.extracted_gemeente == gemeente_naam),
        RulingCache.datum_uitspraak.isnot(None),
        RulingCache.datum_uitspraak >= twelve_months_ago,
    )
    .group_by(func.to_char(
        func.to_date(RulingCache.datum_uitspraak, "YYYY-MM-DD"),
        "YYYY-MM"
    ))
    .order_by("month")
)
```

### Pattern 2: Klimaat Score Calculation (Reuse Existing Formula)

**What:** Score = `100 - (100 * afgewezen / total)` -- already used in `trigger_ruling_analysis` and `poll_ruling_analysis`
**When to use:** Per-month score computation

```python
# Extract from existing endpoint logic (jurisprudence.py lines 278, 360)
klimaat_score = round(100 - (100 * afgewezen / max(total, 1)))
succes_pct = round(100 * toegewezen / max(total, 1))
```

### Pattern 3: CSS-Only Bar Chart

**What:** Flexbox-based vertical bar chart with relative heights computed from data
**When to use:** For TREND-03 timeline visualization

```tsx
// CSS-only vertical bar chart -- no chart library
function TrendTimeline({ months }: { months: MonthBucket[] }) {
  if (months.length < 3) {
    return (
      <div className="text-xs text-grey-500 py-3 text-center">
        Onvoldoende data voor trendweergave (min. 3 maanden)
      </div>
    )
  }

  const maxTotal = Math.max(...months.map(m => m.total), 1)

  return (
    <div className="flex items-end gap-1 h-20">
      {months.map((m) => {
        const heightPct = (m.total / maxTotal) * 100
        // Color based on klimaat score: green (>70), amber (40-70), red (<40)
        const barColor = m.klimaat_score >= 70
          ? 'bg-green-400/60'
          : m.klimaat_score >= 40
            ? 'bg-amber-400/60'
            : 'bg-red-400/60'
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full rounded-t ${barColor} min-h-[2px]`}
              style={{ height: `${heightPct}%` }}
              title={`${m.month}: ${m.total} uitspraken, score ${m.klimaat_score}`}
            />
            <span className="text-[8px] text-grey-600 truncate w-full text-center">
              {m.month.slice(5)} {/* Show MM only */}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

### Pattern 4: Statistics Bar

**What:** Horizontal row of key metrics (total, avg doorlooptijd, success rate)
**When to use:** Aggregated overview alongside trend

```tsx
function StatisticsBar({ stats }: { stats: TrendStats }) {
  return (
    <div className="flex items-center gap-4 text-xs">
      <div className="flex flex-col">
        <span className="text-grey-500">Totaal</span>
        <span className="font-bold text-grey-100 tabular-nums">{stats.total_rulings}</span>
      </div>
      <div className="w-px h-6 bg-overlay/10" />
      <div className="flex flex-col">
        <span className="text-grey-500">Gem. doorlooptijd</span>
        <span className="font-bold text-grey-100 tabular-nums">
          {stats.avg_doorlooptijd != null ? `${stats.avg_doorlooptijd} dgn` : '--'}
        </span>
      </div>
      <div className="w-px h-6 bg-overlay/10" />
      <div className="flex flex-col">
        <span className="text-grey-500">Succespercentage</span>
        <span className="font-bold text-grey-100 tabular-nums">{stats.succes_pct}%</span>
      </div>
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Chart libraries:** Do NOT add recharts, chart.js, d3, or any visualization library -- TREND-03 explicitly requires CSS-only
- **Recalculating in frontend:** Do monthly bucketing in SQL, not JavaScript -- let PostgreSQL handle date operations
- **Hardcoding 12 months:** Return whatever months have data; let frontend handle gaps (empty months between data points)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Monthly date bucketing | Python date loops | PostgreSQL `to_char(to_date(...))` | SQL handles date parsing/grouping more efficiently |
| Klimaat score formula | New formula | Reuse existing `100 - (100 * afgewezen / total)` | Consistency with existing analyze endpoint |
| Response caching | Custom cache logic | TanStack Query `staleTime` | Already used for all jurisprudence hooks |

## Common Pitfalls

### Pitfall 1: datum_uitspraak Format Inconsistency
**What goes wrong:** `datum_uitspraak` is stored as VARCHAR, not DATE. Values may be ISO dates ("2024-03-15"), datetime strings ("2024-03-15T00:00:00"), or partial dates.
**Why it happens:** Data comes from Rechtspraak API with variable formatting.
**How to avoid:** Use `to_date(datum_uitspraak, 'YYYY-MM-DD')` in SQL, which handles truncation of timestamp suffixes. Use `NULLIF` or filter out NULL/empty values before date parsing.
**Warning signs:** SQL errors on `to_date` with unexpected input formats.

### Pitfall 2: Division by Zero in Score Calculations
**What goes wrong:** Months with 0 rulings cause division by zero.
**Why it happens:** Not all months have rulings for a given gemeente.
**How to avoid:** Use `max(total, 1)` as divisor (already done in existing code at line 278). Don't return months with 0 rulings from the query.
**Warning signs:** NaN or Infinity in frontend display.

### Pitfall 3: Sparse Data Rendering
**What goes wrong:** A gemeente with rulings in only 2 of 12 months shows a misleading "trend" with 2 bars.
**Why it happens:** Small municipalities may have very few omgevingsrecht rulings.
**How to avoid:** TREND-03 requires graceful degradation with <3 data points. Show explicit "onvoldoende data" message. The 3-month minimum is already a pattern from doorlooptijd (min sample size 3).
**Warning signs:** User sees a "trend" from 1-2 data points.

### Pitfall 4: Timezone-Naive Date Comparison
**What goes wrong:** "12 months ago" calculation differs between Python and PostgreSQL.
**Why it happens:** Project uses `datetime.utcnow()` (naive UTC) per MEMORY.md.
**How to avoid:** Compute `twelve_months_ago` as a simple string `(datetime.utcnow() - timedelta(days=365)).strftime("%Y-%m-%d")` and use string comparison against `datum_uitspraak` VARCHAR. This matches the existing pattern in `_periode_to_date()`.
**Warning signs:** Off-by-one month at month boundaries.

## Code Examples

### Backend: Trend Endpoint Response Shape

```python
# GET /api/jurisprudence/trend/{gemeente_naam}
{
    "gemeente_naam": "Venlo",
    "months": [
        {
            "month": "2025-04",
            "total": 5,
            "toegewezen": 2,
            "afgewezen": 2,
            "gedeeltelijk": 1,
            "klimaat_score": 60,
            "avg_doorlooptijd": 245
        },
        # ... up to 12 months
    ],
    "summary": {
        "total_rulings": 42,
        "avg_doorlooptijd": 198,
        "succes_pct": 45,
        "months_with_data": 9
    }
}
```

### Frontend: Hook Pattern

```typescript
// Follows existing useGemeenteRulingsFeed pattern
export function useTrendData(gemeenteNaam: string) {
    const { accessToken } = useAuth()
    return useQuery<TrendResponse, Error>({
        queryKey: ['jurisprudence', 'trend', gemeenteNaam],
        queryFn: () => fetchTrendData(gemeenteNaam, accessToken),
        enabled: !!accessToken && gemeenteNaam.length > 0,
        staleTime: 10 * 60_000, // 10 min -- trend data is slow-changing
    })
}
```

### Frontend: Integration Point in JurisprudenceSection

The trend and statistics components integrate into `JurisprudenceSection.tsx` between the `JuridischKlimaatCard` and the ruling feed list. The JuridischKlimaatCard already shows win/loss + doorlooptijd; the new components add the temporal dimension.

```tsx
// Inside JurisprudenceSection, after JuridischKlimaatCard:
{trendData && (
    <>
        <StatisticsBar stats={trendData.summary} />
        <TrendTimeline months={trendData.months} />
    </>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No trend data | Static klimaat_score from analyze endpoint | Phase 84 | Score exists but no temporal dimension |
| Manual search | Auto-populated feed per gemeente | Phase 83 | Data is already cached and geo-filtered |

## Open Questions

1. **Fill empty months in the response?**
   - What we know: Some months may have zero rulings for a gemeente
   - What's unclear: Should the API return all 12 months with zero-filled gaps, or only months that have data?
   - Recommendation: Return only months with data. Let frontend decide whether to show gaps or interpolate. Simpler backend, more flexible frontend.

2. **Include trend in existing feed response or separate endpoint?**
   - What we know: Feed endpoint already returns win_loss + doorlooptijd
   - What's unclear: Adding monthly bucketing to the feed query would increase response size
   - Recommendation: Separate endpoint (`/trend/{gemeente_naam}`). Monthly aggregation is a different query concern. Frontend can fetch in parallel.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `backend/app/api/endpoints/jurisprudence.py` -- existing endpoint patterns, score formula, query filters
- Codebase inspection: `backend/app/models/ruling_cache.py` -- data model, available columns
- Codebase inspection: `backend/app/services/doorlooptijd.py` -- aggregation patterns, min sample size
- Codebase inspection: `frontend/src/components/projects/JuridischKlimaatCard.tsx` -- existing UI patterns
- Codebase inspection: `frontend/src/hooks/useJurisprudence.ts` -- hook patterns, staleTime conventions

### Secondary (MEDIUM confidence)
- PostgreSQL `to_char`/`to_date` functions are standard and well-documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all patterns established in phases 82-85
- Architecture: HIGH - directly extends existing endpoint + component patterns
- Pitfalls: HIGH - datum_uitspraak format and sparse data are known issues from prior phases

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no external dependencies, all internal patterns)