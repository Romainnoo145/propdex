# Phase 44: Wijk Cards and Drill-Down - Research

**Researched:** 2026-02-22
**Domain:** Frontend — TanStack Router navigation, wijk SVG silhouettes, GeoJSON-to-SVG projection reuse, per-wijk unread badges, /resultaten filter pre-setting
**Confidence:** HIGH

---

## Summary

Phase 44 adds two layers of navigation that sit on top of the gemeente card grid built in Phase 43. First, clicking a gemeente card navigates to a wijk card view that renders each wijk boundary as an SVG silhouette in the same `GemeenteCardGrid` responsive layout. Second, clicking a wijk card navigates to `/resultaten` with a `scan_id` filter pre-set to the most recent completed scan for that wijk's project.

All the raw ingredients exist. The CBS WFS wijk endpoint is already implemented at `GET /api/scans/wijken?gemeente_code=` (via `wijk_service.py`) with a matching frontend function `fetchWijken()` in `lib/api.ts`. The `geoJsonToSvgPath()` utility in `lib/geo-utils.ts` already handles both `Polygon` and `MultiPolygon` geometries. The unread count system already provides per-project (i.e. per-wijk) counts via `useUnreadCounts()`. The `useProjectScans()` hook fetches all scans for a wijk project so the most recent completed scan_id can be extracted. The `/resultaten` route already accepts a `scan_id` search param to show scan results.

The key design question is **where the wijk view lives**. The requirements say "same responsive grid layout" and "user can navigate back without losing state" — this points to an in-page state approach (the Projecten page renders either the gemeente grid or the wijk grid depending on a `selectedGemeente` state), not a new route, because a separate route would reset scroll/filter state on the Projecten page. The GemeenteCard onClick already uses `setExpandedGemeenteId` in Phase 43 — Phase 44 replaces this click handler with a proper wijk drill-down.

**Primary recommendation:** Replace the Phase 43 temporary `setExpandedGemeenteId` click handler on GemeenteCard with a view-switching approach in `ProjectList.tsx` (state: `selectedGemeenteId | null`). When set, render `WijkCardGrid` (new component) in place of the gemeente grid. Add a back button to return to gemeente view. No new route needed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.0 | Component rendering | Already in project |
| TanStack Router | 1.158.4 | Navigation to `/resultaten` with search params | Already in project |
| TanStack Query | 5.90.x | `fetchWijken` + `useProjectScans` data fetching | Already manages all data |
| Tailwind CSS v4 | 4.1.18 | Layout utilities | Project standard |
| Inline SVG | native | Wijk boundary silhouette | Reuses existing `geoJsonToSvgPath` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fetchWijken` from `lib/api.ts` | — | CBS WFS wijk GeoJSON via backend proxy | Fetch once per gemeente on drill-down |
| `useProjectScans` from `hooks/useScans.ts` | — | Latest scan_id for a wijk project | Needed for wijk → resultaten navigation |
| `useUnreadCounts` from `hooks/useNotifications.ts` | — | Per-wijk unread badge counts | Already polled every 60 seconds |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| In-page state (selectedGemeenteId) | New route `/projecten/$gemeenteCode` | New route loses Projecten page state on back; also requires `routeTree.gen.ts` regeneration. In-page state is simpler and meets "back without losing state" requirement. |
| `fetchWijken` via backend proxy | Direct CBS WFS from frontend | The backend proxy endpoint already exists and handles the OGC FILTER syntax (PDOK CBS does not accept CQL_FILTER). Don't call CBS WFS directly from frontend for wijken. |
| `useProjectScans` for scan lookup | Store scan_id on wijk project | The wijk Project model has no scan_id field; the AreaScan has project_id. `useProjectScans` already fetches scans by project_id — use it. |

**Installation:** No new packages needed. All required libraries and API endpoints already exist.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── projects/
│       ├── ProjectList.tsx        # MODIFY: add selectedGemeenteId state + view switch
│       ├── WijkCard.tsx           # NEW: wijk card (SVG silhouette + name + badge)
│       ├── WijkCardGrid.tsx       # NEW: wrapper + loading skeleton (reuses GemeenteCardGrid layout)
│       ├── GemeenteCard.tsx       # NO CHANGE: receives onClick prop
│       └── GemeenteCardGrid.tsx   # NO CHANGE: reused as-is for wijk grid
├── hooks/
│   └── useWijkGeoJSON.ts         # NEW: TanStack Query hook wrapping fetchWijken
```

### Pattern 1: In-Page View Switching (Gemeente → Wijk)

**What:** `ProjectList.tsx` holds `selectedGemeenteId: string | null`. When null, render gemeente grid. When set, render wijk grid for that gemeente plus a back button.

**When to use:** Any time navigation back "without losing state" is required within the same page.

**Example:**

```typescript
// In ProjectList.tsx
const [selectedGemeenteId, setSelectedGemeenteId] = useState<string | null>(null)

// In render:
{monitoringProjects.length > 0 && (
  <>
    {selectedGemeenteId ? (
      <WijkCardGrid
        gemeente={monitoringProjects.find(p => p.id === selectedGemeenteId)!}
        onBack={() => setSelectedGemeenteId(null)}
        unreadData={unreadData}
      />
    ) : (
      <GemeenteCardGrid>
        {monitoringProjects.map((gemeente) => (
          <GemeenteCard
            key={gemeente.id}
            gemeente={gemeente}
            svgData={...}
            totalUnread={...}
            onClick={() => setSelectedGemeenteId(gemeente.id)}
          />
        ))}
      </GemeenteCardGrid>
    )}
  </>
)}
```

### Pattern 2: WijkCard (Mirrors GemeenteCard Structure)

**What:** A stateless card that receives pre-computed `svgData`, `unreadCount`, and `onClick` as props. Mirrors the `GemeenteCard` prop contract exactly.

**When to use:** Render inside `GemeenteCardGrid` (the same responsive grid wrapper is reused — no WijkCardGrid wrapper component needed beyond a thin data-fetching container).

**Example:**

```typescript
// WijkCard.tsx — stateless, mirrors GemeenteCard pattern exactly
interface WijkCardProps {
  wijk: ProjectResponse         // wijk project with wijk_naam
  svgData: { d: string; viewBox: string } | null
  unreadCount: number
  onClick?: () => void
}

export function WijkCard({ wijk, svgData, unreadCount, onClick }: WijkCardProps) {
  return (
    <div
      onClick={onClick}
      className="overflow-hidden rounded-lg border border-grey-800 bg-grey-900 cursor-pointer transition-colors hover:bg-grey-850"
    >
      {/* SVG silhouette area — same aspect ratio as GemeenteCard */}
      <div className="relative aspect-[4/3] bg-grey-950/50">
        {svgData ? (
          <svg viewBox={svgData.viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <path d={svgData.d} className="fill-amber-accent/20 stroke-amber-accent" strokeWidth="1" />
          </svg>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <WijkIcon />
          </div>
        )}
      </div>
      {/* Text area */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-base font-semibold text-grey-100" title={wijk.wijk_naam ?? wijk.name}>
            {wijk.wijk_naam ?? wijk.name}
          </h4>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 text-xs font-medium text-white shrink-0">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Pattern 3: WijkCardGrid (Data-Fetching Container)

**What:** A component that receives the selected gemeente and fetches its wijk GeoJSON. Renders the grid of WijkCards. Includes a back button header to return to gemeente view.

**Why separate from WijkCard:** `WijkCard` stays stateless (same pattern as `GemeenteCard`). The data-fetching concern lives in `WijkCardGrid`.

**Example:**

```typescript
// WijkCardGrid.tsx — fetches wijk GeoJSON, computes SVG paths, renders grid
interface WijkCardGridProps {
  gemeente: ProjectResponse               // selected gemeente-level project
  wijkProjects: ProjectResponse[]         // wijk children from allProjects
  unreadData: UnreadDetailResponse | undefined
  onBack: () => void
  onWijkClick: (wijk: ProjectResponse, scanId: string | null) => void
}

export function WijkCardGrid({ gemeente, wijkProjects, unreadData, onBack, onWijkClick }: WijkCardGridProps) {
  const { data: wijkGeojson, isLoading } = useWijkGeoJSON(gemeente.gemeente_code)

  return (
    <div className="space-y-4">
      {/* Breadcrumb / back navigation */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-sm text-grey-400 hover:text-grey-300 transition-colors">
          ← Gemeenten
        </button>
        <span className="text-grey-600">/</span>
        <span className="text-sm font-medium text-grey-100">{gemeente.name}</span>
      </div>

      {isLoading ? (
        <GemeenteCardGridSkeleton count={wijkProjects.length || 3} />
      ) : (
        <GemeenteCardGrid>
          {wijkProjects.map((wijk) => {
            const unreadCount = unreadData?.per_project.find(
              p => p.project_id === wijk.id
            )?.unread_count ?? 0

            const feature = wijkGeojson?.features.find(
              f => f.properties?.statcode === `WK${(gemeente.gemeente_code ?? '').replace('GM', '')}${...}`
            )
            // ... statcode matching logic (see Pitfall 3)
            const svgData = feature ? geoJsonToSvgPath(feature.geometry) : null

            return (
              <WijkCard
                key={wijk.id}
                wijk={wijk}
                svgData={svgData}
                unreadCount={unreadCount}
                onClick={() => onWijkClick(wijk, null /* scan_id resolved in parent */)}
              />
            )
          })}
        </GemeenteCardGrid>
      )}
    </div>
  )
}
```

### Pattern 4: Wijk → Resultaten Navigation

**What:** When a wijk card is clicked, navigate to `/resultaten?scan_id=<id>` using the most recent completed scan for that wijk project. If no scan exists, show a toast and stay on page.

**Why `useProjectScans`:** The wijk Project has a `project_id`; scans for that wijk are fetched via `GET /api/projects/{projectId}/scans`. The `useProjectScans` hook is already built for exactly this. The hook is lazy by design (it only fires when `projectId` is non-null).

**Critical insight:** Wijk card click cannot be instant — it needs to look up the scan_id first. Use a dedicated handler component or lift scan lookup into `WijkCardGrid` parent to avoid per-card hook calls.

**Recommended approach:** Pre-fetch all wijk project scans when `WijkCardGrid` mounts (one query per wijk child). This is consistent with the existing `WijkScanList` pattern in `ProjectList.tsx` which already calls `useProjectScans` per wijk row.

**Navigation call:**

```typescript
// Source: src/components/projects/ProjectList.tsx (existing pattern)
navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
```

**Example of scan lookup for navigation:**

```typescript
function WijkClickHandler({ wijk, navigate }: { wijk: ProjectResponse; navigate: ReturnType<typeof useNavigate> }) {
  const { data } = useProjectScans(wijk.id)

  const handleClick = () => {
    const latestScan = data?.scans.find(s => s.status === 'completed')
    if (!latestScan) {
      toast.info('Nog geen scan beschikbaar voor deze wijk')
      return
    }
    navigate({ to: '/resultaten', search: { scan_id: latestScan.scan_id } })
  }

  return <WijkCard wijk={wijk} ... onClick={handleClick} />
}
```

### Pattern 5: `useWijkGeoJSON` Hook

**What:** TanStack Query hook wrapping `fetchWijken`. Keyed on `gemeente_code`. Long stale time (CBS WFS data is stable).

**Example:**

```typescript
// hooks/useWijkGeoJSON.ts (new)
export function useWijkGeoJSON(gemeenteCode: string | null) {
  const { accessToken } = useAuth()

  return useQuery<GeoJSON.FeatureCollection, Error>({
    queryKey: ['wijk-geojson', gemeenteCode],
    queryFn: () => fetchWijken(gemeenteCode!, accessToken),
    enabled: !!accessToken && !!gemeenteCode,
    staleTime: 30 * 60 * 1000,  // 30 minutes — CBS WFS data is stable
  })
}
```

### Anti-Patterns to Avoid

- **Calling `fetchWijken` directly from WijkCard:** Makes one network request per card. Instead, fetch once at the `WijkCardGrid` level and pass `svgData` as a prop.
- **Calling `useProjectScans` inside `WijkCard`:** Hooks can't be called conditionally; calling per-card also makes multiple sequential requests. Pre-fetch or use a click-time lookup component.
- **Creating a new `/projecten/$gemeenteCode` route:** TanStack Router file-based routing requires the plugin to regenerate `routeTree.gen.ts`. The in-page state pattern is simpler and matches "back without losing state".
- **Direct CBS WFS from frontend for wijken:** The backend proxy exists (`/api/scans/wijken`) specifically because the OGC FILTER parameter syntax is not supported in PDOK's CQL_FILTER. Always go through the backend for wijk data.
- **Hardcoding statcode format:** Wijk statcodes use `WK` prefix + gemeente 4-digit code + 2-digit wijk sequence (e.g. `WK098301`). The gemeente code stored in `Project.gemeente_code` uses `GM` prefix (e.g. `GM0983`). Matching requires stripping `GM` and building `WK{4digits}`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wijk GeoJSON fetch | Custom fetch with OGC filter | `fetchWijken()` from `lib/api.ts` → `GET /api/scans/wijken?gemeente_code=` | Backend already handles OGC XML FILTER syntax for PDOK CBS WFS |
| SVG wijk silhouette | New projection function | `geoJsonToSvgPath()` from `lib/geo-utils.ts` | Already handles Polygon/MultiPolygon + aspect ratio preservation |
| Wijk unread count | New notification system | `useUnreadCounts().per_project` | Already returns per-project (per-wijk) counts; polled every 60 sec |
| Latest scan lookup | Manual DB query | `useProjectScans(wijk.id)` | Already fetches scans by project_id; returns sorted by scan_date |
| Responsive card grid | New grid component | `GemeenteCardGrid` from `components/projects/GemeenteCardGrid.tsx` | Exact same 3/2/1 responsive grid — pass wijk cards as children |
| Loading skeleton | New skeleton | `GemeenteCardGridSkeleton` from `GemeenteCardGrid.tsx` | Already shows loading state for the same grid layout |

**Key insight:** Phase 44 is primarily a composition task. Every primitive already exists. The work is wiring them together with correct state management and navigation.

---

## Common Pitfalls

### Pitfall 1: Wijk statcode format mismatch

**What goes wrong:** Trying to match a wijk feature from CBS WFS using `wijk.wijk_naam` (a string like "Centrum") instead of the CBS `statcode` property format (`WK098301`). The feature lookup returns `undefined` and no silhouette renders for any wijk.

**Why it happens:** The `Project.wijk_naam` stores the display name (e.g. "Centrum"), NOT the CBS statcode. The CBS WFS feature has both `statcode` (e.g. `WK098301`) and `statnaam` (e.g. "Centrum").

**How to avoid:** Match using `f.properties?.statnaam === wijk.wijk_naam` (name matching), NOT statcode. The `statnaam` in CBS WFS is the human-readable name which is what the backend stores in `wijk_naam`.

**Verification:** Check `wijk_service.py` line 64 — the features have `{ statcode, statnaam }` properties. The backend stores `wijk_naam = scan_request.wijk_naam` which is the display name from the scan UI.

**Warning signs:** All wijk cards render with placeholder icons and no SVG silhouettes.

### Pitfall 2: Hook call inside conditional render or loop

**What goes wrong:** Placing `useProjectScans(wijk.id)` inside a `.map()` call violates React's rules of hooks (hooks must be called unconditionally).

**Why it happens:** Temptation to look up each wijk's scan on click by fetching inline in the card render.

**How to avoid:** Use a dedicated sub-component per wijk (like `WijkScanList` in `ProjectList.tsx`) so each hook call is at the top level of its own component. OR pre-fetch all scans at the grid level and pass scan_ids as props. The `WijkScanList` pattern already demonstrates this correctly.

**Warning signs:** React error "Rendered more hooks than during the previous render".

### Pitfall 3: `fetchWijken` gemeente_code format

**What goes wrong:** Passing `gemeente.gemeente_code` (format `GM0983`) directly to `fetchWijken()` causes the backend to query CBS WFS for `WK0983%` — but that's correct! The `wijk_service.py` already strips the `GM` prefix (`gemeente_code.replace("GM", "")`). So this actually works fine. Do NOT pre-strip the prefix before calling `fetchWijken` as the backend would then double-strip.

**Why it happens:** Developer sees the `GM` prefix in `Project.gemeente_code` and worries it needs to be stripped before calling `fetchWijken`. It doesn't — the backend handles it.

**How to avoid:** Pass `gemeente.gemeente_code` (e.g. `GM0983`) directly to `fetchWijken`. Let `wijk_service.py` handle the prefix stripping.

**Warning signs:** `ValueError: No wijken found for gemeente GM0983` (backend logs) despite valid gemeente code.

### Pitfall 4: Missing scan gracefully

**What goes wrong:** When user clicks a wijk card that has no completed scans, `navigate()` is called with `scan_id: undefined` which takes the user to `/resultaten` showing the "Geen scan geselecteerd" empty state. This is confusing — user doesn't know why they see nothing.

**Why it happens:** The `scan_id` may be undefined if `scans.find(s => s.status === 'completed')` returns undefined.

**How to avoid:** Guard the navigation: if no completed scan, show `toast.info('Nog geen scan beschikbaar voor deze wijk')` and do NOT navigate. The wijk card should visually indicate scan availability (e.g. grey out or show a secondary state).

**Warning signs:** User navigates to /resultaten and sees empty state without explanation.

### Pitfall 5: SVG Y-axis inversion (inherited from Phase 43)

**What goes wrong:** Wijk boundaries render upside-down.

**Why it happens:** Same as Phase 43 pitfall 1 — geographic latitude grows northward (up) but SVG Y grows downward. The existing `geoJsonToSvgPath()` already handles this correctly with `offsetY + (maxLat - lat) * scale`. This pitfall only applies if writing new projection code — use the existing function.

**How to avoid:** Always use `geoJsonToSvgPath()` from `lib/geo-utils.ts`. Never write new coordinate projection code.

### Pitfall 6: WijkCardGrid re-fetching on every render

**What goes wrong:** `useWijkGeoJSON` is called with `gemeente.gemeente_code` every render, causing a new network request each time `ProjectList` re-renders (e.g. unread count polling every 60 seconds).

**Why it happens:** TanStack Query key `['wijk-geojson', gemeenteCode]` is the same on each call — the cache handles this correctly. Not actually a problem as long as `staleTime` is set to a reasonable value (30+ minutes).

**How to avoid:** Set `staleTime: 30 * 60 * 1000` in `useWijkGeoJSON`. TanStack Query's built-in deduplication ensures only one request is made per cache miss.

### Pitfall 7: Route regeneration after adding new files

**What goes wrong:** If a developer accidentally creates a file inside `src/routes/_authenticated/` thinking they need a new route, the TanStack Router plugin (`TanStackRouterVite`) auto-regenerates `routeTree.gen.ts` — potentially breaking existing routes if the file naming is wrong.

**Why it happens:** The Vite plugin watches the routes directory and auto-generates on file creation.

**How to avoid:** Phase 44 does NOT need a new route. All new code goes in `src/components/projects/`. The `/resultaten` route already exists and handles `scan_id` via `validateSearch`.

---

## Code Examples

Verified patterns from existing codebase:

### Fetch wijk GeoJSON via backend (from lib/api.ts)

```typescript
// Source: frontend/src/lib/api.ts
export async function fetchWijken(
  gemeenteCode: string,
  accessToken: string | null
): Promise<GeoJSON.FeatureCollection> {
  return apiFetch<GeoJSON.FeatureCollection>(
    `/api/scans/wijken?gemeente_code=${encodeURIComponent(gemeenteCode)}`,
    { method: 'GET', accessToken }
  )
}
// gemeenteCode format: 'GM0983' (with GM prefix -- backend strips it internally)
// Returns: GeoJSON FeatureCollection, features have { statcode: 'WK098301', statnaam: 'Centrum' }
```

### CBS WFS wijk feature property names (from wijk_service.py)

```python
# Source: backend/app/services/wijk_service.py
# WFS typeName: gebiedsindelingen:wijk_gegeneraliseerd
# Feature properties: statcode (e.g. "WK098301"), statnaam (e.g. "Centrum")
# Geometry: EPSG:4326 Polygon or MultiPolygon
# statcode format: WK + gemeente_4digits + wijk_2digits
```

### Navigate to resultaten with scan_id (existing pattern)

```typescript
// Source: frontend/src/components/projects/ProjectList.tsx (WijkScanList)
const handleScanResultsClick = (scan: ScanListItem) => {
  navigate({ to: '/resultaten', search: { scan_id: scan.scan_id } })
}
```

### Fetch project scans (existing hook)

```typescript
// Source: frontend/src/hooks/useScans.ts
export function useProjectScans(
  projectId: string | null,
  params?: { offset?: number; limit?: number }
) {
  // Query key: ['project-scans', projectId, params]
  // Returns: ScanListResponse { scans: ScanListItem[], total, offset, limit }
  // ScanListItem has: scan_id, wijk_naam, status, scan_date, parcel_count
  // Disabled when projectId is null
}
```

### Per-wijk unread count (existing data)

```typescript
// Source: frontend/src/components/projects/ProjectList.tsx
const wijkUnread = unreadData?.per_project.find(
  (p) => p.project_id === wijk.id
)?.unread_count ?? 0
```

### GemeenteCard click pattern (from Phase 43)

```typescript
// Source: frontend/src/components/projects/ProjectList.tsx
// Phase 43 temporary onClick that Phase 44 replaces:
onClick={() => {
  // Phase 44 will add drill-down navigation to wijk cards.
  // For now, expand the gemeente to show wijk list inline.
  setExpandedGemeenteId((prev) => (prev === gemeente.id ? null : gemeente.id))
}}
// Phase 44 replaces this with:
onClick={() => setSelectedGemeenteId(gemeente.id)}
```

### SVG path from GeoJSON (existing utility)

```typescript
// Source: frontend/src/lib/geo-utils.ts
export function geoJsonToSvgPath(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  width = 200,
  height = 150,
  padding = 8
): { d: string; viewBox: string }
// Handles both Polygon and MultiPolygon
// Preserves aspect ratio — safe for irregular wijk shapes
// Use directly, do NOT reimplement
```

### Wijk project data shape (from existing API)

```typescript
// Source: frontend/src/lib/types/project.ts
// Wijk-level ProjectResponse fields used in Phase 44:
// project.id          -> useProjectScans(project.id) for scan lookup
// project.wijk_naam   -> Display name; matches CBS WFS statnaam
// project.gemeente_code -> Same as parent (inherited in get_or_create_wijk_project)
// project.parent_id   -> Links to gemeente parent project (non-null)
// project.is_monitored -> true for all wijk projects
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 43: gemeente card click expands inline accordion | Phase 44: gemeente card click switches to wijk card view | Phase 44 | `expandedGemeenteId` state replaced by `selectedGemeenteId` state with full view swap |
| Hard-coded hex in map SVG | CSS variable tokens only | Phase 42 | All new components must use `fill-amber-accent/20`, `stroke-amber-accent`, `bg-error` etc. |
| Separate `tailwind.config.js` | `@theme {}` block in `src/styles/index.css` | v4 migration | Standard responsive prefixes (`sm:`, `lg:`) still work |

**Deprecated/outdated:**
- `expandedGemeenteId` state in `ProjectList.tsx`: Replaced by `selectedGemeenteId`. The inline accordion approach was explicitly called out in Phase 43 plan as a temporary placeholder for Phase 44.

---

## Open Questions

1. **Should wijk cards show scan count badge or unread badge only?**
   - What we know: Requirements say "notification badge for unread changes" (CARD-06). Unread count data is available per wijk project.
   - What's unclear: Should the card also show how many scans exist (like the accordion did with `wijk.report_count`)? Requirements don't specify.
   - Recommendation: Show only the unread notification badge (bg-error, red). Keep CARD-06 as written. Report count is secondary info and adds visual noise.

2. **What if a wijk has scans but none are completed?**
   - What we know: `useProjectScans` returns all scans including `pending`, `running`, `failed` statuses. Only `completed` scans can show results.
   - What's unclear: Whether the wijk card should be clickable when no completed scan exists.
   - Recommendation: Always allow card click. On click, check for completed scan; if none, show `toast.info('Nog geen scan beschikbaar')`. This is consistent with the existing `WijkScanList` behavior where buttons are `disabled={!isCompleted}`.

3. **Does wijk GeoJSON fetch need to happen before the user clicks, or lazily on click?**
   - What we know: The wijk view only shows when `selectedGemeenteId` is set. Fetching wijk GeoJSON lazily on demand (when the wijk view mounts) is safe because TanStack Query handles the loading state.
   - What's unclear: Whether pre-fetching wijk GeoJSON when gemeente cards are first shown would improve UX.
   - Recommendation: Fetch lazily when `WijkCardGrid` mounts (after gemeente click). The skeleton loading state covers the fetch time. Pre-fetching is an optimization that can be added later.

4. **Should the wijk name in the card come from `wijk.wijk_naam` or `wijk.name`?**
   - What we know: `get_or_create_wijk_project` sets both `name=wijk_naam` and `wijk_naam=wijk_naam` (same value). So `wijk.name === wijk.wijk_naam` for all wijk projects.
   - Recommendation: Use `wijk.wijk_naam ?? wijk.name` with fallback. Show `wijk.wijk_naam` as primary — more semantically correct. Use `title` attribute for full name in case of truncation.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `frontend/src/components/projects/ProjectList.tsx` — Phase 43 implementation with inline comment "Phase 44 will add drill-down navigation"; `expandedGemeenteId` state pattern to replace
- Codebase: `frontend/src/components/projects/GemeenteCard.tsx` — stateless card pattern to replicate for WijkCard
- Codebase: `frontend/src/components/projects/GemeenteCardGrid.tsx` — responsive grid + skeleton (reuse directly)
- Codebase: `frontend/src/lib/api.ts` — `fetchWijken()` function, confirmed format and return type
- Codebase: `frontend/src/lib/geo-utils.ts` — `geoJsonToSvgPath()` — confirmed handles both Polygon and MultiPolygon with aspect ratio preservation
- Codebase: `frontend/src/hooks/useScans.ts` — `useProjectScans()` hook confirmed for wijk scan lookup
- Codebase: `frontend/src/hooks/useNotifications.ts` — `useUnreadCounts()` per_project breakdown confirmed
- Codebase: `frontend/src/lib/types/project.ts` — `ProjectResponse.wijk_naam` field confirmed
- Codebase: `frontend/src/routes/_authenticated/resultaten.tsx` — `scan_id` search param confirmed in `validateSearch`
- Codebase: `backend/app/services/wijk_service.py` — CBS WFS `wijk_gegeneraliseerd` typeName, `statcode`/`statnaam` properties, GM prefix stripping logic confirmed
- Codebase: `backend/app/scans/router.py` — `GET /api/scans/wijken` endpoint confirmed
- Codebase: `backend/app/scans/service.py` — `get_or_create_wijk_project` stores `wijk_naam` as display name, `name=wijk_naam` confirmed
- Codebase: `backend/app/models/project.py` — `wijk_naam` column (String(200), nullable) confirmed
- Codebase: `frontend/vite.config.ts` — `TanStackRouterVite` plugin with `autoCodeSplitting: true` confirmed — no new routes needed

### Secondary (MEDIUM confidence)

- TanStack Router v1.158.x file-based routing: `createFileRoute` pattern verified against existing `rapport.$id.tsx` which uses URL params. In-page state avoids need for new route.
- TanStack Query v5 `useQuery` with `enabled: !!token && !!id` pattern: verified against `useProjectScans` and `useWijkGeoJSON` pattern.

### Tertiary (LOW confidence)

- UX recommendation for "no scan" state (toast vs disabled card): Based on existing pattern in `WijkScanList`. Not specified in requirements.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries are pre-existing; no new dependencies
- Architecture (in-page state vs new route): HIGH — Requirements explicitly say "back without losing state"; Phase 43 code has comment "Phase 44 will add drill-down"; existing pattern in same file
- Wijk GeoJSON fetch pattern: HIGH — Both frontend function and backend endpoint verified
- SVG projection: HIGH — `geoJsonToSvgPath` verified working from Phase 43
- Statcode matching: HIGH — `wijk_service.py` shows statnaam = display name = wijk_naam; verified property names
- Navigation to /resultaten: HIGH — Exact pattern exists in `WijkScanList` component
- UX decisions (no scan state, badge style): MEDIUM — Extrapolated from existing patterns

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (CBS WFS structure stable; React/Tanstack/Tailwind versions frozen until next dependency update)
