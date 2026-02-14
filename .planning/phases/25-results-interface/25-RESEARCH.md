# Phase 25: Results Interface - Research

**Researched:** 2026-02-15
**Domain:** React data tables, split-panel layouts, map-table bidirectional linking, on-demand enrichment
**Confidence:** HIGH

## Summary

Phase 25 transforms scan results from backend-only data into a functional user interface with sortable tables, multi-criteria filtering, map-table synchronization, and on-demand detail enrichment. The backend scan results API (Phase 23-24) already provides server-side filtering, sorting, and pagination support, making this a pure frontend implementation phase with zero new backend routes.

The core technical challenge is **bidirectional state synchronization** between table and map: clicking a parcel on the map must highlight the corresponding table row (and scroll to it), while clicking a table row must fly the map to that parcel's geometry. This requires shared selection state, MapLibre feature-state management, and smooth scroll coordination.

**Primary recommendation:** Use TanStack Table v8 (headless table library) with react-resizable-panels for split layout, native HTML `<details>/<summary>` for expandable sections in the detail modal, and React state for selection synchronization between map and table. Leverage existing backend filtering/sorting/pagination APIs to keep client-side complexity low.

**Critical insight:** The backend already does the heavy lifting (filtering, sorting, pagination, MVT tiles for map rendering). Frontend focuses on UX orchestration and state coordination, not data processing.

## Standard Stack

### Core (Already Present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component model + hooks | State management, effects for side-by-side sync |
| maplibre-gl | 5.17.0 | Map interactions | setFeatureState, queryRenderedFeatures, flyTo for linking |
| @tanstack/react-query | 5.90.20 | Server state + caching | Scan results fetching, polling, cache invalidation |
| Tailwind CSS | 4.1.18 | Utility styling | Layout grids, responsive design, glassmorphism |
| TypeScript | 5.9.3 | Type safety | Complex state shapes for table+map sync |

### New Dependencies Required
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-table | ^8.20.5 | Headless table logic | Industry standard for sortable/filterable tables, 48k+ GitHub stars, headless design matches existing patterns |
| react-resizable-panels | ^2.1.7 | Resizable split panels | 11k+ GitHub stars, TypeScript native, works with Tailwind, no extra styling dependencies |

**Why TanStack Table:**
- Headless (bring your own UI) — fits glassmorphism design pattern
- Built-in server-side pagination/sorting/filtering support
- Scales to 100k+ rows with virtualization (not needed for typical 500-5000 parcel scans)
- Same ecosystem as React Query (consistency)
- Source: [TanStack Table Documentation](https://tanstack.com/table/latest/docs/introduction), [Contentful Guide](https://www.contentful.com/blog/tanstack-table-react-table/)

**Why react-resizable-panels:**
- Minimal API (Panel, PanelGroup, PanelResizeHandle)
- Built-in keyboard accessibility (ARIA properties)
- Works with Tailwind (no style override conflicts except flex properties)
- Persists layout via defaultLayout prop (localStorage integration straightforward)
- Source: [GitHub - bvaughn/react-resizable-panels](https://github.com/bvaughn/react-resizable-panels)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | AG Grid | AG Grid is overkill (enterprise features, complex API, large bundle). TanStack Table is lightweight and headless. |
| TanStack Table | Custom table logic | Don't hand-roll — sorting/filtering/pagination has edge cases (empty states, type coercion, null handling) |
| react-resizable-panels | CSS resize property | CSS resize has poor UX (no keyboard support, ugly handle, no persist state) |
| react-resizable-panels | react-split-pane | Unmaintained (last update 2020), TypeScript types incomplete |
| Custom accordion | Headless UI/Radix | Native `<details>/<summary>` is faster, accessible by default, zero dependencies for simple cases |

**Installation:**
```bash
npm install @tanstack/react-table@^8.20.5 react-resizable-panels@^2.1.7
```

## Architecture Patterns

### Recommended Component Structure
```
frontend/src/components/
├── results/
│   ├── ResultsLayout.tsx              # NEW: PanelGroup orchestrator (table + map)
│   ├── ResultsTable.tsx               # NEW: TanStack Table with sorting/filtering/pagination
│   ├── ResultsFilterPanel.tsx         # NEW: Filter controls (bestemming, area range, score)
│   ├── ParcelDetailModal.tsx          # NEW: Modal with expandable source cards
│   └── ParcelEnrichmentCard.tsx       # NEW: On-demand Tier 2 data (vergunningen)
├── map/
│   ├── MapView.tsx                    # EXISTING: Base MapLibre setup
│   ├── ParcelScoreLayer.tsx           # EXISTING: Score-colored MVT tiles (already uses setFeatureState for hover)
│   └── ScanAreaHighlightLayer.tsx     # EXISTING: Bbox highlight from Phase 23
└── ui/
    ├── Modal.tsx                      # EXISTING: Glassmorphism modal with focus trap
    └── Drawer.tsx                     # EXISTING: Not used in Phase 25 (modal preferred for detail view)
```

### Pattern 1: Split-Panel Layout with Resizable Divider
**What:** Horizontal split panel with results table on left, map on right, draggable divider
**When to use:** Desktop view (>=1024px), for side-by-side comparison workflow
**Example:**
```typescript
// Source: react-resizable-panels basic pattern
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

function ResultsLayout() {
  return (
    <PanelGroup direction="horizontal">
      <Panel defaultSize={45} minSize={30} maxSize={70}>
        <ResultsTable />
      </Panel>
      <PanelResizeHandle className="w-1 bg-white/10 hover:bg-white/20" />
      <Panel defaultSize={55} minSize={30}>
        <MapView />
      </Panel>
    </PanelGroup>
  )
}
```

### Pattern 2: TanStack Table with Server-Side Filtering
**What:** Headless table with column definitions, server-side sort/filter, controlled pagination
**When to use:** For scan results display (all table views in this phase)
**How it works:**
1. Define columns with `columnHelper.accessor()` for type-safe data binding
2. Use `getCoreRowModel()` for client-side row processing
3. Set `manualPagination: true`, `manualSorting: true`, `manualFiltering: true` to delegate to backend
4. Wire `onSortingChange`, `onPaginationChange` to update React Query filters
5. React Query re-fetches with new filters, TanStack Table re-renders

**Example:**
```typescript
// Source: TanStack Table server-side pattern + backend API at /api/scans/{scanId}/results
import { useReactTable, getCoreRowModel, ColumnDef } from '@tanstack/react-table'
import { useScanResults } from '@/hooks/useScans'

const columns: ColumnDef<ScanResultItem>[] = [
  { accessorKey: 'parcel_code', header: 'Parcel Code', enableSorting: true },
  { accessorKey: 'address', header: 'Address', enableSorting: true },
  { accessorKey: 'area_m2', header: 'Area (m²)', enableSorting: true },
  { accessorKey: 'score', header: 'Score', enableSorting: true },
]

function ResultsTable({ scanId }: { scanId: string }) {
  const [sorting, setSorting] = useState([{ id: 'score', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  // React Query hook fetches from backend with filters
  const { data, isLoading } = useScanResults(scanId, {
    sort_by: sorting[0]?.id,
    sort_order: sorting[0]?.desc ? 'desc' : 'asc',
    offset: pagination.pageIndex * pagination.pageSize,
    limit: pagination.pageSize,
  })

  const table = useReactTable({
    data: data?.results ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.ceil((data?.total ?? 0) / pagination.pageSize),
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  return <table>...</table>
}
```

### Pattern 3: Bidirectional Map-Table Linking
**What:** Click parcel on map → highlight table row, click table row → fly map to parcel
**When to use:** Results interface where users switch between map and list views
**How it works:**
1. Shared selection state: `const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null)`
2. Map click handler: `queryRenderedFeatures()` → extract parcel_id → `setSelectedParcelId()`
3. Table row click: `setSelectedParcelId()` → trigger map `flyTo()` + `setFeatureState()`
4. Table auto-scroll: `useEffect` watches `selectedParcelId`, calls `rowElement.scrollIntoView()`

**Example:**
```typescript
// Source: MapLibre click events + TanStack Table row selection
// Map component
function MapView({ selectedParcelId, onParcelClick }) {
  useEffect(() => {
    if (!map) return

    map.on('click', 'parcel-score-fill', (e) => {
      const feature = e.features?.[0]
      if (feature?.properties?.parcel_id) {
        onParcelClick(feature.properties.parcel_id)
      }
    })
  }, [map, onParcelClick])

  // Highlight selected parcel on map
  useEffect(() => {
    if (!map || !selectedParcelId) return

    // Clear previous selection
    map.removeFeatureState({ source: 'parcel-scores' })

    // Set new selection
    map.setFeatureState(
      { source: 'parcel-scores', id: selectedParcelId },
      { selected: true }
    )

    // Fly to parcel (requires querying geometry from data)
    const parcel = data?.results.find(p => p.parcel_id === selectedParcelId)
    if (parcel?.geometry) {
      map.flyTo({ center: parcel.geometry.coordinates, zoom: 16 })
    }
  }, [map, selectedParcelId])
}

// Table component
function ResultsTable({ data, selectedParcelId, onRowClick }) {
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map())

  // Auto-scroll to selected row
  useEffect(() => {
    if (selectedParcelId) {
      const rowElement = rowRefs.current.get(selectedParcelId)
      rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedParcelId])

  return (
    <tbody>
      {data.results.map(row => (
        <tr
          key={row.parcel_id}
          ref={el => el && rowRefs.current.set(row.parcel_id, el)}
          onClick={() => onRowClick(row.parcel_id)}
          className={selectedParcelId === row.parcel_id ? 'bg-blue-500/20' : ''}
        >
          ...
        </tr>
      ))}
    </tbody>
  )
}
```

### Pattern 4: On-Demand Tier 2 Enrichment in Modal
**What:** Parcel detail modal fetches vergunningen (SRU Bekendmakingen) on open, shows loading skeleton
**When to use:** User clicks row/parcel to open detail view (LIST-03 requirement)
**How it works:**
1. Modal opens with Tier 1 data (already cached from scan results)
2. React Query hook triggers on modal open: `useParcelEnrichment(parcelId, { enabled: isModalOpen })`
3. Backend endpoint: `GET /api/parcels/{parcelId}/enrich` → calls SRU API, caches in `enrichment_data` JSONB
4. Loading state shows skeleton, success shows expandable cards with vergunningen

**Backend endpoint pattern (NEW in Plan 25-05):**
```python
# backend/app/parcels/router.py (new router)
@router.get("/{parcel_id}/enrich")
async def enrich_parcel(parcel_id: uuid.UUID, ...):
    """
    On-demand Tier 2 enrichment for parcel detail modal.
    Fetches vergunningen via SRU Bekendmakingen API, caches in enrichment_data.
    """
    parcel = await get_parcel_by_id(parcel_id, organization_id, db)

    # Check if enrichment is fresh (< 7 days old)
    if parcel.enriched_at and (datetime.utcnow() - parcel.enriched_at).days < 7:
        return parcel.enrichment_data

    # Fetch fresh data from SRU
    vergunningen = await sru_client.query_by_postcode(parcel.postcode, httpx_client)

    # Update cache
    parcel.enrichment_data = {"vergunningen": vergunningen}
    parcel.enriched_at = datetime.utcnow()
    await db.commit()

    return parcel.enrichment_data
```

**Frontend pattern:**
```typescript
// Source: TanStack Query enabled pattern + Modal pattern
function ParcelDetailModal({ parcelId, isOpen, onClose }) {
  const { data: tierOneData } = useScanResults(scanId, ...)
  const { data: tierTwoData, isLoading } = useParcelEnrichment(parcelId, {
    enabled: isOpen && !!parcelId,
    staleTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div>
        {/* Tier 1 data - always available */}
        <h2>{tierOneData.address}</h2>
        <p>Area: {tierOneData.area_m2} m²</p>

        {/* Tier 2 data - on-demand */}
        {isLoading ? (
          <div className="animate-pulse bg-white/10 h-20 rounded" />
        ) : (
          <details>
            <summary>Vergunningen ({tierTwoData.vergunningen.length})</summary>
            <ul>
              {tierTwoData.vergunningen.map(v => (
                <li key={v.identifier}>{v.title}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </Modal>
  )
}
```

### Anti-Patterns to Avoid
- **Client-side filtering on large datasets:** Backend already filters — don't re-filter 5000 rows in React
- **Storing full geometry in table state:** Geometry is large — reference by parcel_id, fetch from cache when needed
- **Custom sort logic:** TanStack Table + backend API handles it — don't reimplement
- **Complex accordion libraries:** Native `<details>/<summary>` is accessible by default and performant
- **Virtualizing under 1000 rows:** Unnecessary complexity — TanStack Table handles 5000 rows fine without virtualization

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sortable table headers | Custom click handlers + sort state | TanStack Table `getSortedRowModel` | Multi-column sort, sort direction, type coercion, null handling edge cases |
| Pagination controls | Custom prev/next buttons + offset math | TanStack Table `getPaginationRowModel` | Page count calculation, boundary checks, keyboard nav |
| Resizable divider | Custom mousedown/mousemove handlers | react-resizable-panels | Keyboard accessibility, touch support, layout persistence, edge case handling |
| Filter query builders | Custom input → query string logic | Backend query params + TanStack Query | URL sync, debouncing, multiple filter types (boolean, range, enum) |
| Map feature highlighting | Manual DOM manipulation | MapLibre `setFeatureState` | GPU-accelerated, proper cleanup, supports hover + selected states simultaneously |

**Key insight:** The scan results API already provides filtering, sorting, pagination, and score-colored MVT tiles. Frontend orchestrates UX, doesn't reprocess data.

## Common Pitfalls

### Pitfall 1: Selection State Out of Sync Between Map and Table
**What goes wrong:** User clicks parcel on map, table doesn't highlight. User clicks table row, map doesn't fly to parcel.
**Why it happens:** Selection state managed separately in map component and table component, no shared state.
**How to avoid:** Lift selection state to parent component (`ResultsLayout`), pass as prop to both map and table.
**Warning signs:** `useState` for `selectedParcelId` appears in both `MapView.tsx` and `ResultsTable.tsx`.

### Pitfall 2: Map flyTo Causes Infinite Loop with Selection Effect
**What goes wrong:** Selecting parcel triggers `flyTo()`, which triggers map move event, which triggers re-render, which triggers `flyTo()` again.
**Why it happens:** `useEffect` dependencies include map center/zoom which change during `flyTo()`.
**How to avoid:** Track selection change separately from map viewport state. Use `useEffect` with only `[selectedParcelId]` dependency, not viewport coords.
**Warning signs:** Map animates infinitely when clicking row, browser freezes.

### Pitfall 3: Fetching Enrichment Data Before Modal Opens
**What goes wrong:** Enrichment endpoint called for all rows when results load, causing 100+ SRU API calls.
**Why it happens:** React Query hook enabled globally instead of conditionally on modal open.
**How to avoid:** Use `enabled: isModalOpen && !!parcelId` in `useQuery` options. Only fetch when modal is visible.
**Warning signs:** Network tab shows 50+ requests to `/api/parcels/{id}/enrich` on page load.

### Pitfall 4: Re-Rendering Table on Every Map Pan/Zoom
**What goes wrong:** Table re-renders 60 times per second during map pan, causing jank.
**Why it happens:** Map viewport state stored in parent component, passed to table as prop, triggers re-render on every frame.
**How to avoid:** Decouple map viewport state from table rendering. Use `React.memo()` on table component, only re-render when `data` changes.
**Warning signs:** Scrolling table is laggy when map is visible, React DevTools profiler shows constant re-renders.

### Pitfall 5: Server-Side Sorting Not Reflected in UI
**What goes wrong:** User clicks column header, data doesn't re-sort.
**Why it happens:** TanStack Table configured with `manualSorting: true` but `onSortingChange` doesn't update React Query filters.
**How to avoid:** Wire `onSortingChange` to update filters, trigger React Query refetch. Ensure `sort_by` and `sort_order` params sent to backend.
**Warning signs:** Clicking sort icon changes UI arrow direction but data order stays same.

## Code Examples

Verified patterns from official sources and existing codebase:

### Score Badge Component (reuse for table cells)
```typescript
// Pattern from existing ParcelScoreLayer.tsx color scale
function ScoreBadge({ score, category }: { score: number | null; category: string | null }) {
  if (score === null) return <span className="text-white/50">N/A</span>

  const colorClass =
    category === 'High' ? 'bg-green-500/20 text-green-400' :
    category === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-red-500/20 text-red-400'

  return (
    <span className={`px-2 py-1 rounded text-sm font-medium ${colorClass}`}>
      {score.toFixed(0)}
    </span>
  )
}
```

### Filter Panel with Range Inputs
```typescript
// Source: Backend filter params from router.py list_results endpoint
function ResultsFilterPanel({ filters, onChange }) {
  return (
    <div className="space-y-4 p-4 bg-black/40 rounded-lg">
      {/* Boolean filter */}
      <label>
        <input
          type="checkbox"
          checked={filters.has_pand === false}
          onChange={(e) => onChange({ ...filters, has_pand: e.target.checked ? false : undefined })}
        />
        Vacant land only
      </label>

      {/* Range filter */}
      <label>
        Min area (m²)
        <input
          type="number"
          value={filters.min_area_m2 ?? ''}
          onChange={(e) => onChange({ ...filters, min_area_m2: Number(e.target.value) })}
          className="w-full px-3 py-2 bg-black/40 rounded"
        />
      </label>

      {/* Enum filter */}
      <label>
        Score category
        <select
          value={filters.score_category ?? ''}
          onChange={(e) => onChange({ ...filters, score_category: e.target.value || undefined })}
          className="w-full px-3 py-2 bg-black/40 rounded"
        >
          <option value="">All</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </label>
    </div>
  )
}
```

### Native Details/Summary for Expandable Cards
```html
<!-- Source: Native HTML pattern for accessibility -->
<details className="bg-black/20 rounded-lg p-4">
  <summary className="cursor-pointer font-medium text-white/90 hover:text-white">
    Vergunningen (3)
  </summary>
  <ul className="mt-4 space-y-2">
    <li className="text-white/70">Omgevingsvergunning - Hoofdstraat 42</li>
    <li className="text-white/70">Sloopvergunning - 2024-03-15</li>
  </ul>
</details>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side filtering/sorting | Server-side with query params | v3.0 scan API (2026) | Scales to 50k+ parcels, no client-side performance issues |
| Custom table libraries | Headless tables (TanStack) | ~2023 | Bring your own UI, fits glassmorphism design |
| ARIA accordions | Native `<details>/<summary>` | 2024+ | Zero JS, accessible by default, better performance |
| CSS Grid layouts | react-resizable-panels | 2025+ | Keyboard accessible, touch support, persist state |
| Redux for table state | React Query + useState | TanStack ecosystem | Server state in React Query, UI state in local useState |

**Deprecated/outdated:**
- react-table v7 (replaced by TanStack Table v8 in 2022)
- react-split-pane (unmaintained since 2020, use react-resizable-panels)
- Custom sort/filter logic (backend APIs handle this now)

## Open Questions

1. **Should we virtualize the table for scans with 10k+ parcels?**
   - What we know: Backend limits to 50k max features, typical wijk scans are 500-5000 parcels
   - What's unclear: Will users ever scan entire gemeente (50k parcels)?
   - Recommendation: Start without virtualization (TanStack Table handles 5k rows fine). Add @tanstack/react-virtual only if performance issues reported. Mark as Phase 26+ enhancement.

2. **Should panel sizes persist across page reloads?**
   - What we know: react-resizable-panels supports `defaultLayout` prop
   - What's unclear: User preference — some users prefer stable layout, others want fresh start
   - Recommendation: Use localStorage to persist. Add "Reset Layout" button in filter panel for users who want to restore defaults.

3. **How to handle missing geometry in table row → map flyTo?**
   - What we know: ScanResultItem has `parcel_id` but not geometry (geometry served via MVT tiles)
   - What's unclear: Best pattern to fetch geometry for flyTo
   - Recommendation: Add geometry bbox to ScanResultItem response (small overhead, ~50 bytes per row). Alternative: Query MVT tile for feature, but complex and unreliable.

4. **Should bestemming filter be multi-select or single-select?**
   - What we know: Parcels can have multiple bestemmingen (dubbele bestemming)
   - What's unclear: UX — show parcels matching ANY selected type (OR) vs ALL selected types (AND)?
   - Recommendation: Start with single-select dropdown (simpler UX, matches backend `bestemming_type` string param). Upgrade to multi-select in Phase 26 if users request it.

## Sources

### Primary (HIGH confidence)
- [TanStack Table v8 Documentation](https://tanstack.com/table/latest/docs/introduction) - Core concepts, server-side patterns
- [react-resizable-panels GitHub](https://github.com/bvaughn/react-resizable-panels) - Installation, API reference, accessibility features
- [MapLibre GL JS Map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/) - setFeatureState, queryRenderedFeatures, flyTo methods
- Backend codebase: `/backend/app/scans/router.py` list_results endpoint - Filter params, sort fields, pagination
- Backend codebase: `/backend/app/scans/schemas.py` ScanResultItem - Response shape, available fields
- Frontend codebase: `/frontend/src/hooks/useScans.ts` - Existing React Query patterns for scans

### Secondary (MEDIUM confidence)
- [Contentful TanStack Table Guide](https://www.contentful.com/blog/tanstack-table-react-table/) - Best practices, server-side sorting/filtering
- [Syncfusion: React Table Performance](https://www.syncfusion.com/blogs/post/render-large-datasets-in-react) - Virtualization thresholds, performance pitfalls
- [WebAIM: Disclosures and Accordions](https://webaim.org/techniques/disclosures/) - Accessibility comparison of native vs custom
- [Material React Table State Management](https://www.material-react-table.com/docs/guides/state-management) - Row selection patterns, state lifting
- [MapLibre Examples: Polygon Click](https://maplibre.org/maplibre-gl-js/docs/examples/show-polygon-information-on-click/) - Click event handling pattern

### Tertiary (LOW confidence)
- Web search results on React table performance (general guidance, needs verification with actual dataset sizes)
- Community discussions on map-table linking (patterns need adaptation to MapLibre + TanStack combo)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack Table and react-resizable-panels verified via official docs, widely adopted
- Architecture: HIGH - Patterns based on official examples + existing codebase structure from Phases 22-24
- Backend API: HIGH - Directly read from implemented router.py, schemas match TypeScript types
- Map-table sync: MEDIUM - Pattern is conceptually sound but needs integration testing for edge cases
- Pitfalls: MEDIUM - Based on common issues reported in docs + web searches, not project-specific

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days — stable libraries, no fast-moving changes expected)
