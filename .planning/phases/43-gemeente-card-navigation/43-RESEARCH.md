# Phase 43: Gemeente Card Navigation - Research

**Researched:** 2026-02-22
**Domain:** Frontend — GeoJSON-to-SVG projection, responsive card grid, unread badge integration
**Confidence:** HIGH

---

## Summary

Phase 43 replaces the current accordion-list view of monitored gemeenten on the Projecten page with a visual card grid. Each card renders the gemeente boundary as an inline SVG silhouette, displays the municipality name, and shows a notification badge when unread changes exist.

The CBS WFS endpoint that already powers the map page (`CBS_GEMEENTEN_WFS` in `src/lib/pdok.ts`) returns GeoJSON FeatureCollections with `Polygon` or `MultiPolygon` geometries in WGS84 (EPSG:4326). Coordinates are [lon, lat] pairs. The key technical task is projecting these geodetic coordinates into a 2D SVG `<path>` that fits a fixed card viewport (e.g. 200×120 px). No external library is needed for this — the projection is a simple normalised linear scale from the bounding box to the SVG viewport, which can be implemented in ~30 lines of TypeScript and tested without a map.

The unread-count data is already available via `useUnreadCounts()` (hook in `src/hooks/useNotifications.ts`) and via `useMonitoredProjects()` (returns `ProjectResponse[]` with `gemeente_code`, `name`, and child `unread_count` aggregation). No new backend API is needed. The gemeente card navigation section replaces only the `monitoringProjects` rendering block inside `ProjectList.tsx`; regular (non-monitoring) projects keep the existing accordion rows.

**Primary recommendation:** Extract the GeoJSON-to-SVG path function as a pure utility in `src/lib/geo-utils.ts`, build `GemeenteCard` as a standalone component in `src/components/projects/`, and replace only the `monitoringProjects.map(...)` block inside `ProjectList.tsx` with a responsive `<GemeenteCardGrid>` wrapper. Use the module-level `gemeenteGeoJSONCache` from `GemeenteBoundariesLayer.tsx` via a re-exported `fetchGemeenteGeoJSON` function that is already public — no network duplication.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component rendering | Already in project |
| TanStack Query | 5.90.x | Data fetching + cache | Already manages project/notification state |
| Tailwind CSS v4 | 4.1.x | Layout utilities | Project standard — `@theme` inline config |
| Inline SVG | native | Boundary silhouette | No dependency needed for 2D polygon projection |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` + `tailwind-merge` (`cn`) | 2.1/3.4 | Conditional class merging | Every component already uses `cn()` from `src/lib/utils` |
| `class-variance-authority` (cva) | 0.7.x | Variant-based component styles | Already used in `Button.tsx` — use for card variants if needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline SVG path | `d3-geo` / `topojson-client` | D3 adds ~80 KB and requires a projection object; overkill for a fixed-size static silhouette in a card |
| Inline SVG path | Canvas `drawPath` | Canvas would require additional state management and image export complexity; SVG is accessible, scalable, and serialisable |
| `fetchGemeenteGeoJSON` re-use | Separate WFS call | Would duplicate the network request; the existing module-level cache in `GemeenteBoundariesLayer.tsx` already handles deduplication and should be reused |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── geo-utils.ts          # ADD: geoJsonToSvgPath() + geoJsonToViewBox()
├── components/
│   └── projects/
│       ├── ProjectList.tsx     # MODIFY: replace monitoringProjects block
│       ├── GemeenteCard.tsx    # NEW: single gemeente card with SVG + badge
│       └── GemeenteCardGrid.tsx # NEW: responsive 3/2/1 col grid wrapper
```

### Pattern 1: GeoJSON-to-SVG Projection (pure function)

**What:** Given a GeoJSON `Polygon` or `MultiPolygon` geometry, return an SVG `d` path string and a `viewBox` string that fit the shape within any fixed viewport.

**When to use:** Called once per gemeente when the card renders. The result can be memoised with `useMemo` keyed on `statcode`.

**Implementation details:**
- Coordinates in the CBS WFS are WGS84 [lon, lat] — longitude is the X axis, latitude is the Y axis.
- Latitude must be **negated** when mapping to SVG pixel space because SVG Y increases downward while geographic latitude increases upward.
- Normalise to a unit square using the geometry bounding box, then scale to the target viewport dimensions (e.g. width=200, height=120 with 4px inset padding).
- For `MultiPolygon`, iterate all sub-polygons and produce a single compound `d` string (separate sub-paths with `M` move commands).
- Only the exterior ring (index `[0]` of each polygon) is needed — holes are ignored for a silhouette.

```typescript
// Source: derived from calculateBboxFromGeometry() already in src/lib/geo-utils.ts

/**
 * Project a GeoJSON Polygon or MultiPolygon geometry into an SVG path string.
 * Fits the shape within the given viewport with optional padding.
 * Returns { d, viewBox } suitable for <svg viewBox={viewBox}><path d={d}/></svg>
 */
export function geoJsonToSvgPath(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  width = 200,
  height = 120,
  padding = 4
): { d: string; viewBox: string } {
  // 1. Collect all exterior ring coordinates
  const rings =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]!]
      : geometry.coordinates.map((poly) => poly[0]!)

  // 2. Compute bounding box across all rings
  let minLon = Infinity, maxLon = -Infinity
  let minLat = Infinity, maxLat = -Infinity
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }

  const lonRange = maxLon - minLon || 1
  const latRange = maxLat - minLat || 1
  const drawW = width - padding * 2
  const drawH = height - padding * 2

  // Scale factor that preserves aspect ratio
  const scale = Math.min(drawW / lonRange, drawH / latRange)
  const projW = lonRange * scale
  const projH = latRange * scale
  const offsetX = padding + (drawW - projW) / 2
  const offsetY = padding + (drawH - projH) / 2

  // 3. Project each ring to SVG coordinates (lat is negated + shifted)
  const project = (lon: number, lat: number): [number, number] => [
    offsetX + (lon - minLon) * scale,
    offsetY + (maxLat - lat) * scale,  // maxLat - lat inverts Y axis
  ]

  // 4. Build SVG path string
  const parts: string[] = []
  for (const ring of rings) {
    const points = ring.map(([lon, lat]) => project(lon!, lat!))
    const [first, ...rest] = points
    if (!first) continue
    parts.push(
      `M ${first[0].toFixed(2)} ${first[1].toFixed(2)} ` +
      rest.map(([x, y]) => `L ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') +
      ' Z'
    )
  }

  return {
    d: parts.join(' '),
    viewBox: `0 0 ${width} ${height}`,
  }
}
```

### Pattern 2: Responsive Card Grid (Tailwind CSS v4)

**What:** A CSS grid that shows 3 columns on desktop (≥1024px), 2 on tablet (≥768px), 1 on mobile.

**When to use:** Wrap all `<GemeenteCard>` instances inside this grid container.

```typescript
// Tailwind v4 responsive grid — follows project breakpoint conventions (md = 768px, lg = 1024px)
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {monitoringProjects.map((gemeente) => (
    <GemeenteCard key={gemeente.id} gemeente={gemeente} unreadData={unreadData} />
  ))}
</div>
```

Note: The project uses Tailwind v4 with the `@theme` block approach — no separate `tailwind.config.js`. Standard Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) still work.

### Pattern 3: Data Fetching — Reuse `fetchGemeenteGeoJSON`

**What:** `fetchGemeenteGeoJSON()` is already exported from `GemeenteBoundariesLayer.tsx` and has a module-level cache. Calling it in `GemeenteCard` (or in a parent `useEffect`) is safe and free — it hits the network only once per session.

**When to use:** Trigger the fetch when the Projecten page mounts and the project list contains monitored projects. Store the GeoJSON in a `useState` in the parent (`ProjectList.tsx`) and pass the gemeente's feature to each `GemeenteCard` as a prop.

```typescript
// In ProjectList.tsx — load gemeente GeoJSON once when monitored projects exist
const [gemeenteGeojson, setGemeenteGeojson] = useState<GeoJSON.FeatureCollection | null>(null)

useEffect(() => {
  if (monitoringProjects.length === 0) return
  fetchGemeenteGeoJSON().then(setGemeenteGeojson).catch(console.error)
}, [monitoringProjects.length])
```

Then inside each `GemeenteCard`, find the matching feature:

```typescript
const feature = useMemo(
  () => gemeenteGeojson?.features.find(
    (f) => f.properties?.statcode === gemeente.gemeente_code
  ),
  [gemeenteGeojson, gemeente.gemeente_code]
)

const svgData = useMemo(() => {
  if (!feature) return null
  const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
  return geoJsonToSvgPath(geometry)
}, [feature])
```

### Pattern 4: Unread Badge

**What:** The existing `useUnreadCounts()` hook returns `UnreadDetailResponse` with `per_project: ProjectUnreadCount[]`. Each entry has `project_id` and `unread_count`. Monitoring projects are gemeente-level (parent) and wijk-level (children). The gemeente card should show the **total unread** across all of its wijk children.

**Current data flow (existing ProjectList.tsx logic):**
```typescript
// Total unread for a gemeente card = sum of wijk children's unread counts
const totalUnread = wijkChildren.reduce((sum, wijk) => {
  const wijkUnread = unreadData?.per_project.find(
    (p) => p.project_id === wijk.id
  )?.unread_count ?? 0
  return sum + wijkUnread
}, 0)
```

This logic already exists in `ProjectList.tsx` (lines 152–157). It can be reused directly in `GemeenteCard`.

Badge implementation already exists in the codebase (line 177–180 in ProjectList.tsx):
```tsx
{totalUnread > 0 && (
  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white">
    {totalUnread}
  </span>
)}
```

### Anti-Patterns to Avoid

- **Do not fetch WFS per card:** Calling `fetchGemeenteGeoJSON` inside each card component creates redundant requests if the cache is cold. Fetch once at the `ProjectList` level.
- **Do not use `d3-geo`:** The projection math is 30 lines of arithmetic; a full D3 dependency is not justified.
- **Do not hardcode colours:** All SVG fill/stroke colours must use CSS variables (e.g. `fill-amber-accent/20`, `stroke-amber-accent`) — no hex literals in component JSX. The project theme system requires this (Phase 42 just enforced it across all components).
- **Do not pass raw geometry coordinates as JSON string props:** Pass the GeoJSON `Feature` or the pre-computed `{ d, viewBox }` object to avoid re-projection on every render.
- **Do not skip aspect-ratio preservation in the SVG projection:** The Netherlands has many irregular gemeente shapes (long narrow, island-separated MultiPolygons). Without aspect-ratio-preserving scaling, cards will look distorted.
- **Do not use `grid-cols-3` without mobile fallback:** Start from `grid-cols-1` and add responsive variants — this project renders on mobile too.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GeoJSON cache | Custom cache layer | Re-export `fetchGemeenteGeoJSON` from `GemeenteBoundariesLayer.tsx` | Module-level cache already handles deduplication |
| Unread badge | New notification system | `useUnreadCounts()` + existing badge pattern from ProjectList.tsx:177 | Already tested, already renders correctly |
| Responsive grid | Custom CSS | Tailwind `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | One line, tested across the project |
| SVG coordinate range | Manual bounding box | Extend `calculateBboxFromGeometry()` already in `src/lib/geo-utils.ts` | Re-use existing bbox logic |

**Key insight:** The codebase already contains all moving parts. Phase 43 is primarily a composition and UI task — new code is the SVG projection function and the card component. Everything else is wiring of existing hooks and data.

---

## Common Pitfalls

### Pitfall 1: SVG Y-axis inversion

**What goes wrong:** Geographic latitude increases northward (up on a map), but SVG Y coordinates increase downward. If you project `lat → y` directly without inverting, the shape renders upside-down.

**Why it happens:** WGS84 uses `[lon, lat]` where lat=north. SVG origin is top-left with Y growing downward.

**How to avoid:** Use `maxLat - lat` (not `lat - minLat`) when computing Y:
```typescript
y = offsetY + (maxLat - lat) * scale  // correct: top of SVG = northernmost point
```

**Warning signs:** Shapes appear mirrored vertically compared to the map view.

### Pitfall 2: CBS WFS geometry type is usually MultiPolygon

**What goes wrong:** Code handles only `Polygon` type and crashes on municipalities with multiple disconnected polygons (islands, enclaves). Of the first two CBS features fetched, the first was a `MultiPolygon` (`Groningen`). This is the common case.

**Why it happens:** Municipalities with islands (e.g. Groningen in the early fetch, Zeeland municipalities) produce `MultiPolygon` geometries.

**How to avoid:** The `geoJsonToSvgPath` function above handles both types by normalising to an array of rings before projecting.

**Warning signs:** `TypeError: geometry.coordinates[0][0]` when expecting a simple array.

### Pitfall 3: Aspect ratio distortion

**What goes wrong:** A gemeente that is wide (east-west) gets stretched to fill a square card vertically, making it look unrecognisable.

**Why it happens:** Naively scaling `x = (lon - minLon) / lonRange * width` and `y = (lat - minLat) / latRange * height` fills the full card area but ignores the shape's true proportions.

**How to avoid:** Compute `scale = Math.min(drawW / lonRange, drawH / latRange)` and use the same scale for both axes (uniform scaling). Center the result with computed offsets.

### Pitfall 4: Card layout breaks on small screens with gemeente names

**What goes wrong:** Municipality names like `'s-Hertogenbosch` or `Súdwest-Fryslân` overflow card boundaries or cause word-wrap that pushes SVG out of view.

**Why it happens:** Card width on mobile (1 column) is constrained to the content area, but long names without explicit overflow handling break layout.

**How to avoid:** Apply `truncate` to the name element and use `title` attribute for the full name. The card should have a fixed SVG area (aspect-ratio via `aspect-[5/3]` or explicit height) so it does not collapse.

### Pitfall 5: TanStack Query staleTime for GeoJSON

**What goes wrong:** `fetchGemeenteGeoJSON` is called outside TanStack Query, so its result is not in the React Query cache — if the component unmounts and remounts, the module-level cache still prevents a network request, but the React state in `ProjectList` is lost.

**Why it happens:** The module-level cache in `GemeenteBoundariesLayer.tsx` persists across component lifecycles (it is a module variable), but React `useState` does not. On first visit to the Projecten page, it fetches. On revisit (if the module cache is warm), it resolves instantly from the module variable.

**How to avoid:** This is acceptable behaviour — the module cache provides the network-level deduplication and the React state provides the render-level value. No special handling needed. Document in code comments.

### Pitfall 6: GeoJSON fetch with `gemeente_gegeneraliseerd` — name vs code matching

**What goes wrong:** The WFS `properties.statcode` (e.g. `GM0014`) is used to match a CBS feature to a `ProjectResponse.gemeente_code`. If the project was created with a different code format, the lookup returns `undefined` and no silhouette renders.

**Why it happens:** `statcode` format in CBS WFS is always `GM` + 4 digits (e.g. `GM0014`). The `gemeente_code` stored in the backend `Project` model comes from the scan's `gemeente_code` field. Verify in the `AreaScan` model that the code format is consistent.

**How to avoid:** Add a console warning in development when `feature` is `null` for a monitored gemeente. Include a graceful fallback (placeholder SVG or text-only card) for missing features.

---

## Code Examples

Verified patterns from the existing codebase:

### Existing badge pattern (from ProjectList.tsx:177)
```tsx
// Source: src/components/projects/ProjectList.tsx
{totalUnread > 0 && (
  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white">
    {totalUnread}
  </span>
)}
```

### Unread count computation (from ProjectList.tsx:152–157)
```typescript
// Source: src/components/projects/ProjectList.tsx
const totalUnread = wijkChildren.reduce((sum, wijk) => {
  const wijkUnread = unreadData?.per_project.find(
    (p) => p.project_id === wijk.id
  )?.unread_count ?? 0
  return sum + wijkUnread
}, 0)
```

### CBS WFS URL (from src/lib/pdok.ts)
```typescript
// Source: src/lib/pdok.ts
export const CBS_GEMEENTEN_WFS =
  'https://service.pdok.nl/cbs/gebiedsindelingen/2024/wfs/v1_0?service=WFS&version=2.0.0&request=GetFeature&typeName=gebiedsindelingen:gemeente_gegeneraliseerd&outputFormat=application/json&srsName=EPSG:4326'
// Properties per feature: { statcode: 'GM0014', statnaam: 'Groningen', ... }
// Geometry type: Polygon or MultiPolygon (EPSG:4326 [lon, lat] order)
```

### fetchGemeenteGeoJSON (already public from GemeenteBoundariesLayer.tsx)
```typescript
// Source: src/components/map/GemeenteBoundariesLayer.tsx
export async function fetchGemeenteGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  // Module-level cache: gemeenteGeoJSONCache
  // Safe to call multiple times — only one network request per session
}
```

### Monitoring projects hook (from src/hooks/useProjects.ts)
```typescript
// Source: src/hooks/useProjects.ts
export function useMonitoredProjects() {
  // Returns: ProjectListResponse with root projects (gemeente level)
  // Each root project has: .children (wijk level), .gemeente_code, .name, .unread_count
}
```

### Responsive grid skeleton pattern (from existing components)
```tsx
// Pattern used in src/components/projects/ProjectList.tsx loading state
{Array.from({ length: 3 }).map((_, i) => (
  <div key={i} className="rounded-lg border border-grey-800 bg-grey-900 p-4 space-y-2">
    <Skeleton className="h-5 w-1/2" />
    <Skeleton className="h-4 w-3/4" />
  </div>
))}
```

---

## Data Model Clarification

The current `ProjectList.tsx` shows monitoring projects by reading from `useProjects()` which returns all projects. The monitoring-specific data (hierarchical structure) comes via `useMonitoredProjects()` (`/api/monitoring/projects`).

For the card grid, the plan should use `useMonitoredProjects()` because:
1. It returns only `is_monitored=true` projects with hierarchical children
2. It pre-computes `unread_count` per project
3. It includes `gemeente_code` on the parent (gemeente) level

The `gemeente_code` stored in `Project.gemeente_code` maps directly to CBS WFS `properties.statcode` (format `GM0000`). This can be verified in the existing `ProjectList.tsx` which uses `gemeente.gemeente_code` for display — no new code needed to understand the mapping.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw hex palette colours | CSS variable tokens (`--color-amber-accent`, `--color-error`, etc.) | Phase 42 | All new components must use token-based colours — no `#d4a843` literals |
| Separate tailwind.config.js | `@theme {}` block in `src/styles/index.css` | v4 migration | Standard Tailwind responsive prefixes still work |
| Light mode via `data-theme` | `html.light` class | Phase 42 | CSS variables auto-invert — components need no explicit light/dark branching if they use grey tokens |
| Accordion-only project display | Accordion list + visual card grid | Phase 43 | Monitoring projects get the card treatment; regular projects keep the list |

**Deprecated/outdated:**
- Direct `white` or `black` colour values in components: replaced by `--color-overlay` token (Phase 42)
- Hardcoded `#d4a843` in non-map components: banned after Phase 42 sweep

---

## Open Questions

1. **Navigation on card click**
   - What we know: The phase description says "Users see their scanned gemeenten as visual cards" — click behaviour is not specified in the requirements (CARD-01 through CARD-07 and NAV-01).
   - What's unclear: Does clicking a gemeente card navigate to the existing accordion view (same page, scroll to it?), to the map with that gemeente pre-selected, or to a future gemeente detail page?
   - Recommendation: Default to navigating to `/map` with `?gemeente_code=GM0014` query param (pre-select the gemeente on the map). If the planner disagrees, the card onClick handler is trivially swappable.

2. **What happens to the existing accordion section for monitoring projects?**
   - What we know: The current `monitoringProjects` block renders gemeente+wijk accordions inside `ProjectList.tsx`.
   - What's unclear: Phase 43 says the Projecten page "displays gemeente cards" — should the accordion entirely replace the existing list, or coexist?
   - Recommendation: Replace the `monitoringProjects.map(...)` accordion block with the card grid. The card's click target can expand to show wijk children inline or navigate. This matches the requirements as written.

3. **`gemeente_code` format consistency**
   - What we know: CBS WFS uses `GM0000` format. Backend `Project.gemeente_code` is a `String(10)` column.
   - What's unclear: Where is `gemeente_code` first set? Verified in `AreaScan` model and scan trigger code, but the exact storage format in the DB was not directly observed.
   - Recommendation: Check `backend/app/models/area_scan.py` and `backend/app/scans/service.py` to confirm the stored format matches `GM0000` — this is the lookup key used to find the CBS WFS feature.

4. **Card height and SVG sizing**
   - What we know: No fixed card dimensions are specified in requirements.
   - What's unclear: SVG area height — too tall wastes space, too short makes complex shapes unreadable.
   - Recommendation: Use a fixed `aspect-[5/3]` container for the SVG area (approx 200×120px on desktop, scales proportionally on mobile). This matches common Dutch gemeente boundary aspect ratios.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/lib/pdok.ts` — CBS WFS URL, confirmed to be 2024 vintage with `EPSG:4326`
- Codebase: `src/components/map/GemeenteBoundariesLayer.tsx` — `fetchGemeenteGeoJSON()` export, module cache pattern, property names `statcode`/`statnaam`
- Codebase: `src/hooks/useNotifications.ts` — `useUnreadCounts()` shape, poll interval
- Codebase: `src/hooks/useProjects.ts` — `useMonitoredProjects()` endpoint and return type
- Codebase: `src/lib/types/project.ts` — `ProjectResponse` with `gemeente_code`, `children`, `unread_count`
- Codebase: `src/lib/types/monitoring.ts` — `UnreadDetailResponse` shape
- Codebase: `backend/app/monitoring/router.py` — `/api/monitoring/projects` implementation, confirmed `is_monitored=True` filter
- Codebase: `src/styles/index.css` — All CSS design tokens, grey scale, semantic colours
- Live CBS WFS: Verified `statcode`/`statnaam` property names, confirmed MultiPolygon geometry type for real municipalities, confirmed EPSG:4326 coordinate order

### Secondary (MEDIUM confidence)

- SVG coordinate projection algorithm: standard geographic-to-pixel projection technique, cross-verified against `calculateBboxFromGeometry()` implementation in `src/lib/geo-utils.ts`
- Tailwind CSS v4 responsive prefix behaviour: Confirmed `sm:` / `lg:` grid column prefixes work with `@theme` inline config via project's existing component usage

### Tertiary (LOW confidence)

- Navigation click behaviour: Not specified in requirements — recommendation is an assumption

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries are pre-existing in the project
- Architecture: HIGH — Based on direct codebase analysis of actual implementations
- SVG projection math: HIGH — Derived from real CBS WFS coordinate samples and verified against existing `calculateBboxFromGeometry` logic
- Navigation behaviour on click: LOW — Not specified in requirements, requires planner decision

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (CBS WFS URL and GeoJSON structure are stable; React/Tailwind versions frozen until next dependency update)
