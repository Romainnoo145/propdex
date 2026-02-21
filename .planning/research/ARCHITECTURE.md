# Architecture Patterns

**Domain:** Premium data presentation layer — comparison views, mini-maps, tab layouts, map filter controls, scoring visualizations
**Researched:** 2026-02-21
**Confidence:** HIGH — based on direct codebase analysis of ~16K LOC TypeScript/React

---

## Existing Architecture Summary

Before documenting new patterns, here is the current structure this milestone integrates into.

### Persistent Map Lifecycle (Critical Constraint)

The MapLibre instance is initialized once in `_authenticated.tsx` (the layout route), placed in an always-mounted DOM node with CSS `display: none/block` toggling. It never unmounts. All child routes receive the map via `MapContext` (provides `mapRef` and `mapReady`).

This means:
- Only ONE real MapLibre instance exists per session
- Mini-maps in reports CANNOT be a second full MapLibre instance on the same page (browser WebGL context limit: ~8 total, but two concurrent full-feature instances causes measurable performance degradation and tile duplication)
- Static map images in reports must be tile snapshots, not live MapLibre instances

### Current Component Tree

```
routes/__root.tsx
  └── ThemeProvider + QueryClientProvider + AuthProvider
      └── _authenticated.tsx (layout)
          ├── SideRailNav (w-16, icon-only)
          ├── MapView (absolute inset-0, display:none when not /map — NEVER unmounts)
          ├── MapContext.Provider (exposes mapRef + mapReady)
          └── Outlet (child route content)
              ├── /map          → MapPage (MapShell + overlays + drawers + modals)
              ├── /resultaten   → ResultatenPage (filter bar + TanStack Table)
              ├── /rapporten    → RapportenPage (report list)
              ├── /rapport/:id  → ReportDetailPage (full-height scroll)
              └── /projecten    → ProjectenPage
```

### Data Flow Layers

```
Backend API
  → TanStack Query hooks (src/hooks/)
  → Route components (src/routes/_authenticated/)
  → Layout components (src/components/layout/)
  → Domain components (src/components/{property,results,reports,map}/)
  → Primitive components (src/components/primitives/)

Key hooks today:
  useReport(id)            → PropertyReportResponse (report detail)
  useReports(filters)      → ReportListResponse (paginated list)
  useScanResults(id, f)    → ScanResultsResponse (parcel grid)
  useParcelEnrichment(id)  → ParcelEnrichmentResponse (vergunningen)
  usePropertyLookup()      → PropertyReportResponse (live address lookup)
```

### Three-Tier Property Disclosure (Existing)

```
Map click → PropertyQuickCard (floating popup, minimal data, MapLibre Popup anchored)
          → PropertyDetailDrawer (right-side Drawer, full PropertyReportResponse)
          → PDFExportModal (modal overlay)
```

---

## Architecture for Each New Feature

### 1. Comparison Views

**Architectural decision: URL-first state, useQueries for parallel fetching, no new store**

Comparison state lives in TanStack Router URL search params. No global store, no context needed. URL makes comparisons bookmarkable.

```
URL: /vergelijken?ids=uuid1,uuid2,uuid3
```

**Parallel data fetching with useQueries (HIGH confidence — official TanStack Query v5 pattern):**

```typescript
// src/hooks/useComparison.ts  (NEW)
import { useQueries } from '@tanstack/react-query'
import { fetchReport } from '@/lib/api'
import { useAuth } from '@/lib/auth/useAuth'
import type { ReportDetailResponse } from '@/lib/types/report'

export function useComparisonReports(reportIds: string[]) {
  const { accessToken } = useAuth()
  return useQueries({
    queries: reportIds.map((id) => ({
      queryKey: ['report', id],            // reuses existing cache
      queryFn: () => fetchReport(id, accessToken),
      enabled: !!id && !!accessToken,
      staleTime: 5 * 60 * 1000,
    })),
  })
}
```

No new API endpoints. All data comes from the existing `GET /api/reports/{id}` endpoint. The `['report', id]` query key matches existing `useReport()` hooks — cache is shared automatically.

**Component structure (new directory):**

```
src/components/comparison/
  ComparisonView.tsx        — grid container, orchestrates 2-4 columns
  ComparisonColumn.tsx      — single property vertical stack (re-uses Section components)
  ComparisonHeader.tsx      — sticky top row: property names + close/swap buttons
  ComparisonMetricRow.tsx   — one labeled row spanning all columns side-by-side
  ComparisonEmptySlot.tsx   — placeholder for unfilled slots
```

**Layout:** Fixed-width CSS grid (`grid-cols-2`, `grid-cols-3`, `grid-cols-4`), horizontal scroll when columns overflow viewport. No resizable split pane library required. Each column has `overflow-y-auto` to scroll independently if content heights differ.

**Route:** New file `src/routes/_authenticated/vergelijken.tsx` — a dedicated page, not a modal state on `/rapporten`. Comparison is a primary feature, not an incidental overlay.

**Entry point from `/rapporten`:** Select checkboxes on report cards, click "Vergelijk" button → navigate to `/vergelijken?ids=...`.

**Key constraint on ComparisonColumn:** Do NOT embed `PropertyDetailDrawer` or `ReportDetailPage` inside a comparison column. Those are vertical-scroll documents designed for full-width. ComparisonColumn extracts the same data from `PropertyReportResponse` and renders horizontally-appropriate sub-components (metric cells, labeled rows).

---

### 2. Mini-Map in Reports

**Architectural decision: Static tile image (a simple `<img>` tag), not a second MapLibre instance**

The active MapLibre is in the layout parent and cannot be portaled into a report. A second full MapLibre instance is inadvisable for three reasons:

1. WebGL context pressure (browser limit ~8 contexts; each MapLibre instance uses one)
2. Tile fetch cost (mini-maps load all tile layers the same as the main map)
3. Theme sync complexity (mini-map MapLibre style would need to mirror ThemeContext)

The correct pattern: a static raster tile image URL constructed from the property's `map_data.center_wgs84` coordinates. This is a single HTTP request to a CDN tile server — no WebGL, no MapLibre initialization.

**Implementation:**

```typescript
// src/lib/staticMap.ts  (NEW)
// Tile coordinate math (Mercator)
function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}
function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  )
}

// Returns a PDOK/CARTO light tile URL for the given coordinates
export function buildStaticMapUrl(
  lng: number,
  lat: number,
  zoom: number = 16,
): string {
  const x = lngToTileX(lng, zoom)
  const y = latToTileY(lat, zoom)
  // CARTO light — same CDN used by MapView.tsx
  return `https://basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}@2x.png`
}
```

```typescript
// src/components/map/StaticMapImage.tsx  (NEW)
import { useTheme } from '@/lib/theme/useTheme'

interface StaticMapImageProps {
  lng: number
  lat: number
  zoom?: number
  className?: string
  alt?: string
}

export function StaticMapImage({ lng, lat, zoom = 16, className, alt }: StaticMapImageProps) {
  const { theme } = useTheme()
  const tileUrl = buildStaticMapUrl(lng, lat, zoom)
  // Light mode: CARTO light tiles; Dark mode: could use a dark variant
  // For simplicity, same CARTO light tile works for both — readable in both themes
  return (
    <div className={`relative overflow-hidden rounded-lg bg-grey-800 ${className ?? ''}`}>
      <img
        src={tileUrl}
        alt={alt ?? 'Locatie op kaart'}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {/* Center crosshair overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-4 h-4 rounded-full bg-amber-accent ring-2 ring-white/50" />
      </div>
    </div>
  )
}
```

**Integration into ReportDetailPage:** Place between the address header and the quick-facts MetricCard grid. Width 100%, height ~180px on desktop. The `map_data.center_wgs84` field already exists on `PropertyReportResponse` — no backend changes.

**Integration into ComparisonColumn:** Smaller variant (160×100px) in the column header, above the MetricCard cells.

**Why not `preserveDrawingBuffer: true` + `canvas.toDataURL()`:** This would require modifying `MapView.tsx` initialization (performance regression — GPU cannot clear frames), captures the current main map viewport (not the property location), and only works while the map is visible. Static tile URL is simpler, faster, and always correct.

---

### 3. Tab-Based Report Layout

**Architectural decision: Custom headless Tabs primitive, compound component pattern, no external library**

The codebase uses no headless UI library (no Radix, no Headless UI). The existing primitive components (`Button`, `Card`, `Badge`, `Input`, `Select`) are all custom. Tabs follow the same pattern.

**Headless compound component implementation (~80 lines):**

```typescript
// src/components/primitives/Tabs.tsx  (NEW)
import { createContext, useContext, useState } from 'react'

interface TabsContext {
  activeTab: string
  setActiveTab: (id: string) => void
}

const Context = createContext<TabsContext | null>(null)

function useTabs() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('Tab components must be used within <Tabs>')
  return ctx
}

// Compound components
export function Tabs({ defaultTab, children }: { defaultTab: string; children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultTab)
  return <Context.Provider value={{ activeTab, setActiveTab }}>{children}</Context.Provider>
}

export function TabList({ children }: { children: React.ReactNode }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-overlay/5 px-5">
      {children}
    </div>
  )
}

export function Tab({ id, children, badge }: { id: string; children: React.ReactNode; badge?: number }) {
  const { activeTab, setActiveTab } = useTabs()
  const isActive = activeTab === id
  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      onClick={() => setActiveTab(id)}
      className={`px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
        isActive
          ? 'border-amber-accent text-grey-100'
          : 'border-transparent text-grey-500 hover:text-grey-300'
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1.5 rounded-full bg-grey-800 px-1.5 py-0.5 text-[10px] tabular-nums">
          {badge}
        </span>
      )}
    </button>
  )
}

export function TabPanel({ id, children }: { id: string; children: React.ReactNode }) {
  const { activeTab } = useTabs()
  return (
    <div
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={id}
      className={activeTab === id ? 'block' : 'hidden'}  // CSS display:none — stays mounted
    >
      {children}
    </div>
  )
}
```

**Critical: use CSS `display: none` (Tailwind `hidden`), NOT conditional rendering.** Panels stay mounted. Unmounting on tab switch causes:
- Re-fetching lazy data (AI parsing status, enrichment data)
- Loss of scroll position within panels
- Flash when switching back to a previously visited tab

**Tab grouping for ReportDetailPage:**

| Tab | Content | Badge |
|-----|---------|-------|
| Gebouw | BAG building data + status | — |
| Kadaster | Parcel list + totals | parcel count |
| Bestemming | Zoning + bouwregels + planregels | plan count |
| Monument | Monument status + restrictions | — |
| AI Analyse | PDF upload or parsed plan | — |
| Bronnen | Data sources + confidence | source count |

**Integration into ReportDetailPage:**

The current layout renders sections in a `space-y-5` stack. Wrap in Tabs:
- Keep SignalBanner, MonumentAlert, MetricCards ABOVE the tab bar (always visible)
- Keep StaticMapImage ABOVE the tab bar (always visible)
- Sections slot directly into TabPanel without internal changes

This is a MODIFICATION, not a rewrite. The existing `GebouwSection`, `KadasterSection`, `BestemmingSection`, `MonumentSection`, `AIInterpretatieSection`, and `BronnenSection` components are unchanged — they simply get `<TabPanel>` wrappers around them.

**Keyboard navigation (ARIA compliance):**

```typescript
// In TabList: add onKeyDown handler
function handleKeyDown(e: React.KeyboardEvent) {
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
  const idx = tabs.indexOf(e.currentTarget as Element)
  if (e.key === 'ArrowRight') tabs[(idx + 1) % tabs.length]?.focus()
  if (e.key === 'ArrowLeft') tabs[(idx - 1 + tabs.length) % tabs.length]?.focus()
}
```

---

### 4. Map Filter Controls

**Architectural decision: Extend LayerToggle with collapsible filter panel, use MapLibre setFilter() for client-side filtering**

The existing `LayerToggle` is a pill bar at bottom-left. It already handles layer visibility via callbacks to `MapPage`. Map filters extend this pattern:

1. A "Filters" toggle button added to the pill bar
2. On click: `MapFilterPanel` expands above the bar (absolute position)
3. Filter state lives in `MapPage` (same pattern as `activeGemeente`, `activeScanId`)
4. `useEffect` in MapPage calls `map.setFilter()` when filter state changes

**No API calls for filter application.** Vector tiles already carry all filter-eligible properties (`score`, `pand_status`, `bestemming` type extracted from `bestemmingen` JSON). MapLibre's expression-based filtering is client-side — instant response, no network round-trip.

**New component:**

```typescript
// src/components/map/MapFilterPanel.tsx  (NEW)
interface MapFilters {
  scoreMin: number       // 0-100
  scoreMax: number       // 0-100
  bestemmingType?: string
  pandStatus?: string
  hasBuilding?: boolean
}

interface MapFilterPanelProps {
  isOpen: boolean
  filters: MapFilters
  onApply: (filters: MapFilters) => void
  onClose: () => void
}
```

**MapLibre setFilter() integration in MapPage:**

```typescript
// In map.tsx (MODIFIED)
const [mapFilters, setMapFilters] = useState<MapFilters>({
  scoreMin: 0,
  scoreMax: 100,
})

useEffect(() => {
  if (!mapReady || !mapRef.current) return
  const map = mapRef.current
  if (!map.getLayer('parcel-score-fill')) return

  const expressions: maplibregl.FilterSpecification[] = [
    ['has', 'score'],
    ['>=', ['get', 'score'], mapFilters.scoreMin],
    ['<=', ['get', 'score'], mapFilters.scoreMax],
  ]
  if (mapFilters.bestemmingType) {
    // bestemming stored as string in tile properties
    expressions.push(['==', ['get', 'bestemming_type'], mapFilters.bestemmingType])
  }
  if (mapFilters.pandStatus) {
    expressions.push(['==', ['get', 'pand_status'], mapFilters.pandStatus])
  }
  map.setFilter('parcel-score-fill', ['all', ...expressions])
  map.setFilter('parcel-score-outline', ['all', ...expressions])
}, [mapFilters, mapReady])
```

**Score range slider:** Two-thumb range slider using two overlapping `<input type="range">` elements. No library. A known CSS technique using z-index and pointer-events.

**LayerToggle modification:** Add a "Filters" pill that shows an active-count badge when filters are non-default:

```
[Kaart] [Satellite] | [Percelen] [Gemeenten] [Bestemmingsplan] [Wijken] [Potentie] | [Filters (2)]
```

The "2" badge counts the number of active non-default filter values.

---

### 5. Scoring Visualizations

**Architectural decision: Pure SVG primitives, no charting library, CSS variable tokens**

The codebase has no charting library. The existing score visualization in `ParcelDetailModal` is already done with div elements and inline widths — a reasonable pattern elevated to proper shared primitives.

**New primitive components:**

```
src/components/primitives/ScoreRing.tsx      — SVG radial arc gauge
src/components/primitives/ScoreBar.tsx       — horizontal bar (thin variant of existing pattern)
src/components/primitives/ScoreGauge.tsx     — composition: ring + numeric label + category badge
```

**ScoreRing implementation pattern (SVG stroke-dasharray technique):**

```typescript
// src/components/primitives/ScoreRing.tsx  (NEW)
interface ScoreRingProps {
  score: number       // 0-100
  size?: number       // viewBox size, default 80
  strokeWidth?: number
  className?: string
}

export function ScoreRing({ score, size = 80, strokeWidth = 7, className }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(Math.max(score, 0), 100) / 100) * circumference
  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`-rotate-90 ${className ?? ''}`}
      aria-hidden="true"
    >
      {/* Track */}
      <circle cx={cx} cy={cy} r={radius}
        fill="none"
        stroke="var(--color-grey-800)"
        strokeWidth={strokeWidth}
      />
      {/* Fill arc */}
      <circle cx={cx} cy={cy} r={radius}
        fill="none"
        stroke="var(--color-amber-accent)"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
      />
    </svg>
  )
}
```

**ScoreGauge composition:**

```typescript
// src/components/primitives/ScoreGauge.tsx  (NEW)
export function ScoreGauge({ score, category, size = 'md' }: ScoreGaugeProps) {
  const ringSize = size === 'sm' ? 48 : size === 'md' ? 72 : 96

  return (
    <div className="relative flex items-center justify-center">
      <ScoreRing score={score} size={ringSize} />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums text-grey-100">
          {Math.round(score)}
        </span>
        {category && (
          <span className="text-[10px] text-grey-500">{category}</span>
        )}
      </div>
    </div>
  )
}
```

**ScoreBar (elevates existing pattern):**

The existing inline bar in `ParcelDetailModal` lines 146-155 is exactly the component to extract. Props: `value`, `max`, `label`, `size`.

**Where scoring visualizations appear:**

| Location | Component | Variant |
|----------|-----------|---------|
| `ParcelDetailModal` | `ScoreGauge` | size="lg", replaces existing div circle |
| `InspectorPanel` (map click) | `ScoreGauge` | size="sm", in the Kanscore section |
| `ReportDetailPage` header | `ScoreGauge` (completeness) | size="md", in MetricCard area |
| `ComparisonColumn` header | `ScoreGauge` | size="sm" |
| Score factor breakdown | `ScoreBar` | replaces all inline bar divs |

---

### 6. Theme Polish

**Architectural decision: Extend existing CSS variable system only — no structural changes**

The theme system (`ThemeContext`, `html.light` class, CSS variables in `index.css`) is correct and complete. All new components must:

1. Use semantic grey scale tokens (`text-grey-100`, `bg-grey-950`, etc.) — NEVER hardcode colors
2. Use `--color-overlay` for subtle overlays instead of `white/[0.05]` or `black/[0.05]`
3. Use `--color-amber-accent` via Tailwind class `text-amber-accent` / `bg-amber-accent`
4. Use CSS variable `stroke="var(--color-amber-accent)"` in SVG elements (inline style for SVG)
5. NOT modify `html.light {}` CSS block unless adding a new token

**StaticMapImage theme handling:** CARTO light tiles (`basemaps.cartocdn.com/light_all/`) are readable in both themes — they are a grey/beige map that works on dark and light backgrounds. No theme-switching needed for the tile URL.

**MapLibre map style in `MapView.tsx`:** The hardcoded `#1a1a2e` background color is intentional (MapLibre styles are not CSS-theming-aware). Do not attempt to make MapLibre styles dynamic — this is a known architectural constraint.

---

## Component Boundaries Map

### New Components (create from scratch)

| Component | Location | Responsibility | Dependencies |
|-----------|----------|----------------|-------------|
| `ComparisonView` | `src/components/comparison/` | Grid layout, column orchestration | `useComparisonReports`, `ComparisonColumn` |
| `ComparisonColumn` | `src/components/comparison/` | Single property vertical stack | Existing Section components |
| `ComparisonHeader` | `src/components/comparison/` | Sticky row: names, close, swap | TanStack Router search params |
| `ComparisonMetricRow` | `src/components/comparison/` | Labeled row spanning columns | none |
| `ComparisonEmptySlot` | `src/components/comparison/` | Placeholder for unfilled slots | none |
| `StaticMapImage` | `src/components/map/` | Static tile image for reports | `buildStaticMapUrl` utility, `useTheme` |
| `MapFilterPanel` | `src/components/map/` | Score/status/bestemming filter UI | callback to MapPage |
| `Tabs` | `src/components/primitives/` | Headless tab compound component | React context |
| `TabList` | `src/components/primitives/Tabs.tsx` | Tab button container | Tabs context |
| `Tab` | `src/components/primitives/Tabs.tsx` | Individual tab button | Tabs context |
| `TabPanel` | `src/components/primitives/Tabs.tsx` | Tab content container (stays mounted) | Tabs context |
| `ScoreRing` | `src/components/primitives/` | SVG radial arc gauge | none |
| `ScoreBar` | `src/components/primitives/` | Horizontal factor bar | none |
| `ScoreGauge` | `src/components/primitives/` | Ring + label + category badge | `ScoreRing`, `Badge` |
| `useComparisonReports` | `src/hooks/` | Parallel TanStack Query for N reports | `useQueries`, `useAuth`, `fetchReport` |
| `vergelijken.tsx` | `src/routes/_authenticated/` | Comparison route | `ComparisonView`, `useComparisonReports` |
| `buildStaticMapUrl` | `src/lib/staticMap.ts` | Tile URL math utility | none |

### Modified Components (extend, not rewrite)

| Component | Change | Scope |
|-----------|--------|-------|
| `ReportDetailPage.tsx` | Wrap sections in Tabs; add StaticMapImage above tabs; add ScoreGauge to MetricCard area | MODIFY — sections unchanged |
| `ParcelDetailModal.tsx` | Replace inline score circle with ScoreGauge; replace factor bars with ScoreBar | MODIFY — other content unchanged |
| `LayerToggle.tsx` | Add "Filters" pill + open/close state; render MapFilterPanel | MODIFY — existing toggles unchanged |
| `InspectorPanel.tsx` | Add ScoreGauge in Kanscore section; add ScoreBar for factor breakdown | MODIFY — other content unchanged |
| `map.tsx` | Add `mapFilters` state; `useEffect` for `map.setFilter()`; pass MapFilterPanel props | MODIFY — add state + effect only |
| `SideRailNav.tsx` | Add `/vergelijken` link if comparison is a primary destination | OPTIONAL MODIFY |
| `rapporten.tsx` (route) | Add report selection checkboxes + "Vergelijk" button to navigate to `/vergelijken` | MODIFY — add selection state |

### Unchanged Components (consume as-is)

| Component | Why Unchanged |
|-----------|---------------|
| `MapView.tsx` | Map lifecycle must not change |
| `_authenticated.tsx` | MapContext + layout structure unchanged |
| `MapContext.tsx` | Mini-maps use static images, not this context |
| `GebouwSection`, `KadasterSection`, `BestemmingSection`, `MonumentSection`, `AIInterpretatieSection`, `BronnenSection` | Slot into TabPanel without modification |
| All TanStack Query hooks (except `useComparisonReports` new) | Already correct |
| `ResultsFilterPanel.tsx` | Map filters are separate from results table filters |
| `ParcelScoreLayer.tsx` | `setFilter` called on the layer ID from outside, no internal change |
| `ThemeContext.tsx` | Theme system is complete |

---

## Data Flow Changes

### Comparison Flow

```
User selects reports in /rapporten
  → selects 2-4 checkboxes, clicks "Vergelijk"
  → navigate({ to: '/vergelijken', search: { ids: ['uuid1', 'uuid2'].join(',') } })

vergelijken.tsx
  → reads search.ids, splits by ','
  → useComparisonReports([uuid1, uuid2])
    → useQueries — runs N queries in parallel
    → hits existing ['report', id] cache entries (likely cached from /rapporten)
  → ComparisonView receives N QueryResult objects
    → ComparisonColumn per result
      → renders Section data side-by-side using MetricCard/Row primitives
```

**No new API endpoints required.** The existing `GET /api/reports/{id}` serves all comparison data.

### Map Filter Flow

```
User clicks "Filters" in LayerToggle
  → MapFilterPanel expands (React state in LayerToggle or MapPage)
  → User drags score range to 60-100, selects "Wonen" bestemming
  → Clicks "Toepassen"
  → onApply(filters) callback fires
  → MapPage.setMapFilters({ scoreMin: 60, scoreMax: 100, bestemmingType: 'Wonen' })
  → useEffect fires (mapFilters dependency changed)
    → mapRef.current.setFilter('parcel-score-fill', ['all', ...expressions])
    → MapLibre re-renders fill layer with client-side filter
    → No API call — vector tiles already loaded, filter is client-side expression evaluation
```

**No new API endpoints.** MapLibre vector tile properties already include `score`, `pand_status`, and bestemming type.

### Static Mini-Map Flow

```
ReportDetailPage receives data.map_data.center_wgs84 = [5.2913, 52.1326]
  → <StaticMapImage lng={5.2913} lat={52.1326} zoom={16} />
    → buildStaticMapUrl(5.2913, 52.1326, 16)
    → returns 'https://basemaps.cartocdn.com/light_all/16/33867/21752@2x.png'
    → <img src={...} loading="lazy" />
    → browser fetches single PNG tile from CARTO CDN (no MapLibre, no WebGL)
```

**No API call to backend.** Tile URL is a pure function of coordinates.

---

## Build Order (Dependency-Ordered)

### Phase A: Primitives (no dependencies — build first)

All Phase A components have zero external dependencies. They can be built and tested in complete isolation.

1. `src/components/primitives/ScoreRing.tsx` — SVG math, CSS variables
2. `src/components/primitives/ScoreBar.tsx` — trivial div with width
3. `src/components/primitives/ScoreGauge.tsx` — composes ScoreRing + Badge
4. `src/components/primitives/Tabs.tsx` — React context + compound pattern
5. `src/lib/staticMap.ts` — pure URL math utility

**Gate:** Run `npm run check` after each. No new dependencies needed.

### Phase B: Map Enhancements (depends on Phase A primitives)

6. `src/components/map/StaticMapImage.tsx` — uses `buildStaticMapUrl` + `useTheme`
7. `src/components/map/MapFilterPanel.tsx` — uses Tabs (optional), local filter state
8. Modify `src/components/map/LayerToggle.tsx` — add Filters pill + MapFilterPanel
9. Modify `src/routes/_authenticated/map.tsx` — add `mapFilters` state + `setFilter` effect

**Gate:** Verify map filter works on a scan with parcel score layer active.

### Phase C: Report Enhancements (depends on Phase A primitives + Phase B StaticMapImage)

10. Modify `src/components/reports/ReportDetailPage.tsx` — add Tabs wrapper + StaticMapImage + ScoreGauge
11. Modify `src/components/results/ParcelDetailModal.tsx` — swap to ScoreGauge + ScoreBar
12. Modify `src/components/layout/InspectorPanel.tsx` — richer score display with ScoreGauge

**Gate:** Open an existing report and verify tabs, mini-map renders, score ring animates.

### Phase D: Comparison Feature (depends on Phase A + Phase C being validated)

13. `src/hooks/useComparison.ts` — parallel query hook
14. `src/components/comparison/ComparisonMetricRow.tsx` — base layout primitive
15. `src/components/comparison/ComparisonEmptySlot.tsx` — placeholder
16. `src/components/comparison/ComparisonColumn.tsx` — single property column
17. `src/components/comparison/ComparisonHeader.tsx` — sticky header row
18. `src/components/comparison/ComparisonView.tsx` — grid container
19. `src/routes/_authenticated/vergelijken.tsx` — comparison route
20. Modify `src/routes/_authenticated/rapporten.tsx` — add selection + "Vergelijk" button
21. Optionally modify `src/components/layout/SideRailNav.tsx` — add comparison nav icon

**Gate:** Select 2 reports from /rapporten, click Vergelijk, see side-by-side view.

### Phase E: Theme Polish (can run in parallel with any Phase)

- Audit all new components for hardcoded colors
- Verify dark mode and light mode rendering for each new component
- Spot-check `html.light` CSS variables apply correctly to ScoreRing SVG (uses CSS variables inline)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Second Full MapLibre Instance for Mini-Maps
**What goes wrong:** Instantiating `new maplibregl.Map()` inside `ReportDetailPage` or `ComparisonColumn` for property location display.
**Why it happens:** Seems natural — mini-map looks like a map, so use MapLibre.
**Consequences:** WebGL context pressure (~8 browser limit), tile fetch cost duplicated, theme sync required, MapLibre initialization delay visible to user.
**Prevention:** Static tile `<img>` via `StaticMapImage` component. `map_data.center_wgs84` provides the coordinates.

### Anti-Pattern 2: Prop-Drilling mapRef Into Report Components
**What goes wrong:** Passing `mapRef` from `MapContext` down into `ReportDetailPage` or `ComparisonColumn` to enable "fly to location" or to render a mini-map using the main map instance.
**Why it happens:** `mapRef` is accessible — seems convenient.
**Consequences:** Report components become tightly coupled to map state. They break in routes where the map is hidden (e.g., `/rapporten`). "Bekijk op kaart" navigation belongs at the route level via `navigate()`.
**Prevention:** Never import `useMapContext` inside report or comparison components. Navigation to map is via `navigate({ to: '/map', search: { ... } })`.

### Anti-Pattern 3: Conditionally Rendering TabPanel Children
**What goes wrong:** `{activeTab === 'bestemming' && <BestemmingSection />}` — rendering only the active panel's content.
**Why it happens:** Feels natural to only mount what's visible.
**Consequences:** Re-mounting triggers re-fetching lazy sections (AI parsing, enrichment). Scroll position lost. Flash on tab return.
**Prevention:** All `TabPanel` children stay mounted. Use Tailwind `hidden` class (`display: none`) on inactive panels — content is in the DOM but not painted.

### Anti-Pattern 4: Comparison State in React Context or Zustand
**What goes wrong:** Creating a `ComparisonContext` or store to hold selected report IDs.
**Why it happens:** Feels like "shared state needs a store".
**Consequences:** Selected IDs are lost on refresh; comparison is not bookmarkable; adds global state machinery.
**Prevention:** URL search params are the state: `/vergelijken?ids=uuid1,uuid2`. TanStack Router `useSearch()` provides the IDs. Shareable, bookmarkable, zero-store.

### Anti-Pattern 5: Calling `map.setFilter()` Outside useEffect
**What goes wrong:** Calling `mapRef.current?.setFilter(...)` directly in event handlers or during render.
**Why it happens:** Seems simpler than wiring through state and effect.
**Consequences:** Stale `mapReady` check missed; may call on unmounted map; React violates its own render model.
**Prevention:** Follow the established pattern from `map.tsx`: state change → `useEffect` detects it → imperative MapLibre call inside the effect with `if (!mapReady || !mapRef.current) return` guard.

### Anti-Pattern 6: Adding a Charting Library for Score Visualization
**What goes wrong:** Adding `recharts`, `chart.js`, `victory`, or similar to render score rings and bars.
**Why it happens:** Score ring "looks complex", charting libraries seem to solve it.
**Consequences:** Bundle size increase (recharts alone is ~200KB); inconsistent styling with Industrial Amber design; opacity/color control fights the library's own theme system.
**Prevention:** Native SVG with `stroke-dasharray` / `stroke-dashoffset` is ~40 lines and fully controllable with CSS variables. See `ScoreRing.tsx` pattern above.

---

## Scalability Considerations

| Concern | Current Scale | New Features Impact | Mitigation |
|---------|--------------|--------------------|-----------:|
| WebGL contexts | 1 main map | 0 added (static images in reports) | Correct — `StaticMapImage` is `<img>` not MapLibre |
| TanStack Query cache | ~10 query keys | +N keys for comparison (same keys, shared cache) | No issue — `['report', id]` cache reused |
| Bundle size | ~16K LOC | +8 new components, 0 new npm packages | No new dependencies required |
| Map filter re-render | N/A today | `setFilter` is imperative — no React re-render of map | Filter state change triggers `useEffect` only |
| Tab switch performance | N/A today | Panels stay mounted — O(1) CSS class change | `hidden` class is browser-native, no React overhead |
| Comparison query count | N/A today | Max 4 parallel queries (4 reports) | `useQueries` batches; existing cache likely hot |
| Tile CDN requests for mini-maps | 0 today | 1 PNG per report view (cached by browser) | Standard browser tile cache; CDN handles scale |

---

## Sources

- Direct codebase analysis (HIGH confidence):
  - `src/routes/_authenticated.tsx` — MapView lifecycle, MapContext
  - `src/components/map/MapView.tsx` — MapLibre initialization, CARTO tile constants
  - `src/lib/MapContext.tsx` — mapRef + mapReady interface
  - `src/components/reports/ReportDetailPage.tsx` — section structure, PropertyReportResponse shape
  - `src/components/results/ParcelDetailModal.tsx` — score visualization baseline
  - `src/components/map/LayerToggle.tsx` — existing filter control pattern
  - `src/components/map/ParcelScoreLayer.tsx` — setFilter integration point
  - `src/components/layout/InspectorPanel.tsx` — score bar pattern
  - `src/lib/types/property.ts` — `map_data.center_wgs84` confirmed on PropertyReportResponse
  - `frontend/package.json` — no charting library installed; confirms zero new deps approach
- [MapLibre GL JS WebGL Context Limit Discussion](https://github.com/maplibre/maplibre-gl-js/discussions/3065) (MEDIUM confidence — community, browser-level hardware constraint)
- [MapLibre Filter Within a Layer Example](https://maplibre.org/maplibre-gl-js/docs/examples/filter-within-a-layer/) (HIGH confidence — official MapLibre documentation)
- [TanStack Query v5 Parallel Queries — Official Docs](https://tanstack.com/query/v5/docs/framework/react/guides/parallel-queries) (HIGH confidence — official docs)
- [Headless Component Pattern — Martin Fowler](https://martinfowler.com/articles/headless-component.html) (HIGH confidence — foundational pattern, aligns with existing codebase approach)
- [SVG Gauge stroke-dasharray pattern](https://veerasundar.com/blog/building-a-radial-gauge-with-svg-and-react-part-1) (MEDIUM confidence — standard SVG stroke technique, confirmed by MDN SVG specification)
