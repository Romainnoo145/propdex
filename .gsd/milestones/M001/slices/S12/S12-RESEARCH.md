# Phase 111: Portfolio Navigation — Research

**Researched:** 2026-03-16
**Domain:** React drill-down navigation + TanStack Query + Aura card layout + portfolio API
**Confidence:** HIGH

## Summary

Phase 111 builds a geographical drill-down experience on the Projecten page: Provincie → Gemeente → Wijk → Favorited Parcel Cards. The backend is fully complete — `GET /api/portfolio` groups all favorites by gemeente/wijk (`PortfolioResponse`), `GET /api/parcels/favorites` returns the full list with per-parcel metadata, and both are wired into `main.py`. Phase 110 completed all prerequisites: `portfolio.ts` types, `useFavorites.ts` hooks, and the full refactor of the Projecten page into sub-components.

The critical architectural insight is that Phase 111 does NOT replace the existing Projecten page (which shows projects + scans). It adds a **new navigation mode** on the same `/projecten` route: the current view is "workspace mode" (projects/scans); the new view is "portfolio mode" (favorited parcels navigated geographically). These two modes are best toggled via a pill at the top of the Projecten page, with the full-page Aura card layout only active in portfolio mode.

The `PortfolioResponse` from `GET /api/portfolio` is aggregated (gemeente/wijk groups with counts) but does NOT include per-parcel data (address, score, pipeline stage). To show individual parcel cards at the wijk level, Phase 111 must call `GET /api/parcels/favorites` for the full `FavoriteResponse[]` list and filter client-side by gemeente_code + wijk_naam. No new backend endpoints are needed.

Provincie grouping is explicitly left to the frontend (see backend comment: "Provincie grouping is derived by the frontend from gemeente_code using CBS GeoJSON"). The existing `provincieGeojson` + `provinceOptions` computed in `useProjectenWorkspace.ts` provide the spatial join needed to assign a `gemeente_code` to a province.

**Primary recommendation:** Add `usePortfolio` hook wrapping `GET /api/portfolio` + `useParcelFavorites` for the full list. Build a `PortfolioView` component that implements the 4-level drill-down (province → gemeente → wijk → parcel) as a state machine with URL search params mirroring the existing `provincie_code` / `gemeente_code` pattern. Reuse `GemeenteCard`, `WijkCard`, and the `DrilldownBreadcrumb` pattern — extend them rather than rebuilding.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORT-01 | Projecten page shows full-page Aura card layout (not bento) — 12 provincie cards, only those with favorites highlighted/navigable | PortfolioView component; provincie assignment via CBS GeoJSON spatial join; disabled-state styling for empty provinces |
| PORT-02 | Clicking a provincie shows gemeente cards for that provincie; only gemeenten with favorited parcels are shown | Filter `PortfolioResponse.gemeenten` by province assignment (CBS GeoJSON join); render GemeenteCard grid |
| PORT-03 | Clicking a gemeente shows wijk cards for that gemeente; only wijken with favorites shown; each wijk card displays "N parcelen opgeslagen" badge | Filter `PortfolioResponse.gemeenten[].wijken` by gemeente_code; PortfolioWijkCard with count badge |
| PORT-04 | Clicking a wijk shows individual favorited parcel cards with address, score, and pipeline stage | Filter `FavoriteResponse[]` by gemeente_code + wijk_naam; `FavoritedParcelCard` component; PipelineStagePill |
| PORT-05 | Breadcrumb (Projecten → Limburg → Venlo → Wijk 01) visible at every level; each segment clickable | Extend `DrilldownBreadcrumb` with province and portfolio mode support; URL search param navigation |
| PORT-06 | Ghost button at each level opens corresponding detail view (map / scan / parcel panel) | "Bekijk op kaart" ghost button at province/gemeente/wijk level; parcel card "Open perceel" ghost button |
| PORT-07 | Aura full-page card layout (not bento) for province/gemeente/wijk levels | 12-column responsive grid; rounded-xl border cards with SVG silhouette for provinces/gemeenten; amber highlight for non-empty |
| PORT-08 | Mode toggle between workspace mode (existing) and portfolio mode (new) at top of Projecten page | `PortfolioModeToggle` pill component; controlled by URL search param `portfolio_mode=true` |
| FAV-04 | Wijk cards in portfolio drill-down display "N parcelen opgeslagen" count badge | `PortfolioWijkGroup.parcel_count` from `GET /api/portfolio`; `PipelineStagePill` or badge chip in wijk card |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Query (`@tanstack/react-query`) | project version | `usePortfolio` hook — `GET /api/portfolio`; reuse `useParcelFavorites` for parcel list | Already used throughout, `useParcelFavorites` from Phase 110 already wraps favorites list |
| TanStack Router (`@tanstack/react-router`) | project version | URL search params for portfolio drill-down state | Already used: `useNavigate`, `useSearch` from `/_authenticated/projecten` route |
| Framer Motion | project version | Animate card grid transitions between levels | Already used in parcel panel and filter toggles |
| Lucide React | project version | Icons for ghost buttons, pipeline stage pills | Already used throughout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | project version | Extend `projectenSearchSchema` with `portfolio_mode` boolean | Already used in route definition |
| `sonner` | project version | Error toast on portfolio fetch failure | Already wired |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URL search params for drill-down state | React `useState` | URL params enable deep-linking and back-button support; aligns with existing `gemeente_id`/`wijk_id` pattern; use URL params |
| Client-side province assignment (CBS GeoJSON) | New `/api/portfolio/by-provincie` endpoint | Client-side join reuses existing `provincieGeojson` + `provinceOptions`; no backend change needed |
| `GET /api/portfolio` + `GET /api/parcels/favorites` combined | New endpoint returning parcels with portfolio grouping | Two existing endpoints cover all needs; no backend change for Phase 111 |

**Installation:** No new dependencies required.

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── components/
│   └── projects/
│       ├── PortfolioView.tsx         # NEW — top-level portfolio mode orchestrator
│       ├── PortfolioProvincieView.tsx # NEW — 12 provincie cards with favorites highlight
│       ├── PortfolioGemeenteView.tsx  # NEW — gemeente cards filtered by favorites
│       ├── PortfolioWijkView.tsx      # NEW — wijk cards with parcel_count badge
│       ├── FavoritedParcelCard.tsx    # NEW — individual parcel card (address, score, stage)
│       ├── PipelineStagePill.tsx      # NEW — colored pill for pipeline stage
│       └── ProjectenPage.tsx          # MODIFY — add portfolio mode toggle + PortfolioView branch
```

### Pattern 1: Portfolio Mode Toggle via URL Search Param

**What:** A pill at the top of the Projecten page toggles between workspace mode (existing) and portfolio mode (new). Controlled by `portfolio_mode=true` URL search param.

**When to use:** Both modes live on the same `/projecten` route; only the root view changes.

```typescript
// Extend projectenSearchSchema in projecten.tsx
const projectenSearchSchema = z.object({
  gemeente_id: z.string().optional(),
  gemeente_code: z.string().optional(),
  wijk_id: z.string().optional(),
  provincie_code: z.string().optional(),
  portfolio_mode: z.boolean().optional(),     // NEW — enables portfolio view
  portfolio_provincie: z.string().optional(), // NEW — selected province code in portfolio
  portfolio_gemeente: z.string().optional(),  // NEW — selected gemeente_code in portfolio
  portfolio_wijk: z.string().optional(),      // NEW — selected wijk_naam in portfolio
})
```

Portfolio drill-down uses separate search params (`portfolio_*`) to avoid collision with the existing workspace mode params (`gemeente_id`, `wijk_id`).

### Pattern 2: Province Assignment (CBS GeoJSON Spatial Join)

**What:** `PortfolioResponse.gemeenten` has `gemeente_code` but no `provincie_code`. The frontend must derive which province each gemeente belongs to. The existing `provincieGeojson` and `provinceOptions` computation in `useProjectenWorkspace.ts` already solves this problem.

**How:** `gemeenteGeojson.features` already have a `statcode` (gemeente_code) that can be cross-referenced with `provincieGeojson`. The existing `GemeenteScopeCard` type (from `useMunicipalityWorkspaceStats`) includes `provinceCode` — this is the mapping to use.

```typescript
// In useProjectenWorkspace.ts (already computed):
// allGemeenteCards: GemeenteScopeCard[] — each has .code (gemeente_code) + .provinceCode

// In PortfolioView — derive which provinces have favorites:
const favoriteGemeenteCodes = new Set(portfolioData?.gemeenten.map(g => g.gemeente_code))

const provinciesWithFavorites = useMemo(() =>
  allGemeenteCards
    .filter(card => favoriteGemeenteCodes.has(card.code))
    .map(card => card.provinceCode),
  [allGemeenteCards, favoriteGemeenteCodes]
)
```

**Key insight:** Do NOT re-fetch or re-compute province assignment. Pass `allGemeenteCards` from `useProjectenWorkspace` down to `PortfolioView` as a prop — the province mapping is already there.

### Pattern 3: Data Flow for Portfolio View

**What:** Two TanStack Query calls serve all portfolio navigation levels.

```typescript
// NEW hook in useFavorites.ts
export function usePortfolio() {
  const { accessToken } = useAuth()
  return useQuery<PortfolioResponse, Error>({
    queryKey: ['portfolio'],
    queryFn: () => apiFetch<PortfolioResponse>('/api/portfolio', { method: 'GET', accessToken }),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}

// Already exists from Phase 110:
// useParcelFavorites() — returns FavoriteResponse[] for per-parcel filtering at wijk level
```

**Level 1 (Provincie):** All 12 provinces shown; provinces with favorites are active, others greyed.
Data: `allGemeenteCards` (from workspace) + `portfolioData.gemeenten` → derive `provinciesWithFavorites`.

**Level 2 (Gemeente):** Only gemeenten with favorites shown.
Data: `portfolioData.gemeenten` filtered by selected province code.

**Level 3 (Wijk):** Only wijken with favorites shown; badge = `wijk.parcel_count`.
Data: `portfolioData.gemeenten.find(g => g.gemeente_code === selectedGemeente)?.wijken`.

**Level 4 (Perceel):** Individual favorited parcel cards.
Data: `favorites.filter(f => f.gemeente_code === selectedGemeente && f.wijk_naam === selectedWijk)`.

### Pattern 4: PortfolioProvincieView — 12 Provincie Cards

**What:** Full-page grid of all 12 provinces. Provinces with favorites: amber-highlighted, clickable. Others: greyed out, non-clickable.

```typescript
// PortfolioProvincieView.tsx
interface PortfolioProvincieViewProps {
  provinceOptions: ProvinceOption[]
  provinciesWithFavorites: Set<string>      // province codes that have favorites
  favoriteCountByProvince: Map<string, number>  // total parcel count per province
  selectedProvinceCode: string | null
  provincieGeojson: GeoJSON.FeatureCollection | null | undefined
  onProvinceSelect: (code: string) => void
}
```

Card rendering: Same SVG silhouette pattern as `GemeenteCard` (uses `geoJsonToSvgPath`). Provincie SVG from `provincieGeojson`. Amber highlight + click only when province has favorites. Grey + disabled cursor when no favorites.

**Grid layout:** `grid-cols-3 gap-4` at default width (max 4 provinces per row on large screens = `lg:grid-cols-4`). Each card: `aspect-[4/3]` SVG area, province name, favorite count badge.

### Pattern 5: FavoritedParcelCard

**What:** Individual card for a favorited parcel at the wijk-drill-down level.

```typescript
interface FavoritedParcelCardProps {
  favorite: FavoriteResponse     // from useFavorites
  onOpenParcel?: () => void       // ghost button — opens map + parcel detail panel
}
```

**Display fields from `FavoriteResponse`:**
- `parcel_id` (Kadaster string, e.g. "HTT02-A-1234") — used as display identifier
- `gemeente_naam` + `wijk_naam` — location context
- `pipeline_stage` — rendered as `PipelineStagePill`

**Note:** `FavoriteResponse` does NOT include address text or score — these are in `ScanResultItem` / `ParcelAtPointResponse`. The parcel card at the wijk level will show the Kadaster ID, gemeente, wijk, and pipeline stage. Address + score are only accessible by navigating to the map/parcel panel. This is acceptable for Phase 111 — the "Open perceel" ghost button links to the map.

### Pattern 6: PipelineStagePill

**What:** Colored pill component for pipeline stage values.

```typescript
const PIPELINE_STAGE_COLORS: Record<PipelineStage, string> = {
  'Gesignaleerd': 'bg-aura-sage-mint/40 text-aura-ink',
  'Onderzoek':   'bg-aura-amber/20 text-aura-amber',
  'Contact':     'bg-blue-50 text-blue-700',
  'Besluit':     'bg-purple-50 text-purple-700',
  'Afgerond':    'bg-neutral-100 text-neutral-600',
}
```

### Pattern 7: Extended DrilldownBreadcrumb

**What:** The existing `DrilldownBreadcrumb` only handles `gemeente_id` and `wijk_id`. Portfolio mode needs: Projecten → [ProvinceName] → [GemeenteName] → [WijkName].

**Options:**
- **Option A:** Extend existing `DrilldownBreadcrumb` to accept optional `portfolioPath: { provincie?: string; gemeente?: string; wijk?: string }` prop.
- **Option B:** Create a new `PortfolioBreadcrumb` component in `PortfolioView`.

**Recommendation:** Option B — dedicated `PortfolioBreadcrumb` inside `PortfolioView.tsx` to avoid growing the existing breadcrumb with two separate concerns. It reads `portfolio_provincie`, `portfolio_gemeente`, `portfolio_wijk` search params.

### Pattern 8: Ghost Buttons (PORT-06)

**What:** At each portfolio level, a secondary button opens the corresponding detail view without navigating away from the portfolio.

| Level | Ghost Button Label | Navigation Target |
|-------|-------------------|-------------------|
| Provincie | "Bekijk gemeenten op kaart" | `/map` (no filter) |
| Gemeente | "Bekijk wijken op kaart" | `/map?gemeente_code=GM0983` |
| Wijk | "Scan starten" OR "Open scan" | `/map?gemeente_code=GM0983` |
| Perceel | "Open perceel op kaart" | `/map` (requires `parcel_id` deeplink — tricky) |

**Parcel ghost button:** Opening a specific parcel on the map from the portfolio is the hardest navigation. The map uses `fetchParcelAtPoint` (coordinate-based). The `FavoriteResponse` does not include coordinates. For Phase 111, the parcel ghost button navigates to `/map?gemeente_code=...` and shows a toast "Zoek het perceel op via het adres" — or is simply omitted. This is the primary open question.

### Anti-Patterns to Avoid

- **Fetching scan results in portfolio view to show address/score:** This would require a new `/api/scans/parcel/{parcel_code}` endpoint or batch lookup. Defer to Phase 112+. Phase 111 shows only what `FavoriteResponse` already contains.
- **Recreating province-to-gemeente mapping:** `allGemeenteCards` from `useMunicipalityWorkspaceStats` already has `provinceCode`. Pass this down; don't re-derive from GeoJSON.
- **Replacing the existing workspace mode:** The Projecten page has significant functionality (monitoring, meldingen, scan lists). Portfolio mode is additive — a toggle, not a replacement.
- **Separate route for portfolio:** Stay on `/projecten` with search params. Separate routes would break the shared `ResultsShell` layout and split the component tree unnecessarily.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Province assignment | Custom GeoJSON point-in-polygon | `allGemeenteCards[].provinceCode` from existing `useMunicipalityWorkspaceStats` | Already computed with correct spatial join; free to use |
| SVG map silhouettes for provinces | Custom path computation | `geoJsonToSvgPath(province.geometry)` — already used in `ProvincieView.tsx` | Pattern already established for gemeente silhouettes |
| Portfolio data aggregation | Client-side grouping of `FavoriteResponse[]` | `GET /api/portfolio` returns server-side grouped data | Single query with GROUP BY; no N+1 |
| Portfolio types | New types | Import from `frontend/src/lib/types/portfolio.ts` (Phase 110 deliverable) | Already has `FavoriteResponse`, `PortfolioResponse`, `PortfolioGemeenteGroup`, `PortfolioWijkGroup`, `PipelineStage` |

**Key insight:** The hard work of types, hooks, and data modelling is done. Phase 111 is primarily UI composition.

## Common Pitfalls

### Pitfall 1: `portfolio_mode` URL param vs existing `gemeente_id`

**What goes wrong:** Portfolio mode's `portfolio_gemeente` search param collides conceptually (but NOT technically) with the workspace mode's `gemeente_id` + `gemeente_code`. A user navigating from portfolio gemeente view to workspace gemeente view accidentally merges the two states, causing `hasGemeenteDetail` to be true when returning to workspace mode.

**Why it happens:** `useProjectenWorkspace.ts` reads `search.gemeente_id` and `search.gemeente_code`. If portfolio navigation also sets `gemeente_code`, the workspace mode misreads it.

**How to avoid:** Use dedicated `portfolio_*` params (`portfolio_provincie`, `portfolio_gemeente`, `portfolio_wijk`). These are completely separate from `gemeente_id`/`gemeente_code`/`wijk_id`. The workspace mode branch in `ProjectenPage.tsx` checks `!search.portfolio_mode` before rendering `ProvincieView`/`GemeenteView`.

**Warning signs:** Gemeente detail view appears when navigating portfolio back to workspace.

### Pitfall 2: `wijk_naam` null in `FavoriteResponse`

**What goes wrong:** When a parcel was favorited from `HeartButton` (Phase 110), `wijk_naam` was passed as `null` because `ScanResultItem` lacks `wijk_naam`. Portfolio level 3 groups by wijk_naam — parcels with `wijk_naam: null` form their own group named "Onbekende wijk."

**Why it happens:** Phase 110 Phase 2 summary confirms: "wijk_naam: null" was accepted for Phase 110, deferring fix to Phase 111.

**How to avoid:** In `PortfolioWijkView`, handle null wijk_naam gracefully: show a "Onbekende wijk" card with the count. Do NOT hide these parcels. The displayed `wijk_naam` in the breadcrumb for null would be "Onbekende wijk."

**Warning signs:** Parcels disappear at the wijk level; null pointer errors on `wijk_naam.toUpperCase()`.

### Pitfall 3: Province Highlight Logic (Favorites with null gemeente_code)

**What goes wrong:** `FavoriteResponse.gemeente_code` can be null (parcels favorited without scan context). These parcels have no province assignment and cannot appear in portfolio level 1. They must be counted but not shown until gemeente is known.

**Why it happens:** `HeartButton` passes `gemeente_code: parcel.gemeente_code ?? null` — if the parcel has no `gemeente_code` in `ScanResultItem`, it's stored as null.

**How to avoid:** At province level, show null-gemeente parcels in a special "Overige" bucket or simply exclude them from province navigation (acceptable for Phase 111). The wijk-level count badge should include a note if some parcels have unknown location.

**Warning signs:** `total_favorites` from `GET /api/portfolio` is higher than sum of visible cards; user asks "where are my other favorites?"

### Pitfall 4: SVG Silhouette for Provinces

**What goes wrong:** Province silhouettes are large MultiPolygon features (entire province including Zee, islands, etc.). `geoJsonToSvgPath` handles this, but viewBox calculation may produce very elongated shapes (e.g., Zeeland with islands).

**Why it happens:** `provincieGeojson` features are complex — some provinces have holes or exclaves.

**How to avoid:** The existing `geoJsonToSvgPath` function is already used in `ProvincieView.tsx` for province shapes in the left sidebar. The province card SVG area should use `preserveAspectRatio="xMidYMid meet"` (already the pattern in `GemeenteCard` and `WijkCard`). No special handling needed beyond what already exists.

### Pitfall 5: `usePortfolio` Query Key Invalidation

**What goes wrong:** After toggling a favorite (adding/removing), the `['portfolio']` query becomes stale but `useToggleFavorite.onSettled` only invalidates `['favorites']` — NOT `['portfolio']`. The portfolio view shows outdated counts.

**Why it happens:** Phase 110's `useToggleFavorite` was written before `usePortfolio` existed.

**How to avoid:** In `usePortfolio` hook, OR in `useToggleFavorite`'s `onSettled`, add `queryClient.invalidateQueries({ queryKey: ['portfolio'] })`. The cleaner fix is to update `useToggleFavorite.onSettled` to invalidate both `['favorites']` and `['portfolio']`.

**Warning signs:** Province/gemeente/wijk counts don't update after heart button toggle; stale parcel counts shown.

## Code Examples

### usePortfolio Hook

```typescript
// Add to frontend/src/hooks/useFavorites.ts
// Source: useParcelFavorites pattern (same file, Phase 110)

export function usePortfolio() {
  const { accessToken } = useAuth()
  return useQuery<PortfolioResponse, Error>({
    queryKey: ['portfolio'],
    queryFn: () =>
      apiFetch<PortfolioResponse>('/api/portfolio', {
        method: 'GET',
        accessToken,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}
```

### Fix useToggleFavorite to Invalidate Portfolio

```typescript
// Modify onSettled in useToggleFavorite (useFavorites.ts)
onSettled: () => {
  void queryClient.invalidateQueries({ queryKey: ['favorites'] })
  void queryClient.invalidateQueries({ queryKey: ['portfolio'] })  // ADD THIS
},
```

### Extend Route Search Schema

```typescript
// frontend/src/routes/_authenticated/projecten.tsx
const projectenSearchSchema = z.object({
  gemeente_id: z.string().optional(),
  gemeente_code: z.string().optional(),
  wijk_id: z.string().optional(),
  provincie_code: z.string().optional(),
  // Portfolio mode (Phase 111)
  portfolio_mode: z.boolean().optional(),
  portfolio_provincie: z.string().optional(),
  portfolio_gemeente: z.string().optional(),
  portfolio_wijk: z.string().optional(),
})
```

### PortfolioView Branch in ProjectenPage

```typescript
// frontend/src/components/projects/ProjectenPage.tsx
const search = useSearch({ from: '/_authenticated/projecten' })
const isPortfolioMode = search.portfolio_mode === true

return (
  <div className="space-y-4">
    <PortfolioModeToggle isPortfolioMode={isPortfolioMode} />

    {isPortfolioMode ? (
      <PortfolioView
        allGemeenteCards={ws.allGemeenteCards}       // province mapping
        provinceOptions={ws.provinceOptions}
        provincieGeojson={ws.provincieGeojson}
        gemeenteGeojson={ws.gemeenteGeojson}
      />
    ) : (
      /* existing workspace mode JSX unchanged */
    )}
  </div>
)
```

### Province Favorites Derivation

```typescript
// In PortfolioView.tsx
const { data: portfolioData } = usePortfolio()
const { data: favorites } = useParcelFavorites()

const favoriteGemeenteCodes = useMemo(
  () => new Set((portfolioData?.gemeenten ?? []).map(g => g.gemeente_code).filter(Boolean)),
  [portfolioData]
)

// allGemeenteCards has .code (gemeente_code) + .provinceCode from CBS GeoJSON join
const favoriteCountByProvince = useMemo(() => {
  const counts = new Map<string, number>()
  for (const g of portfolioData?.gemeenten ?? []) {
    const card = allGemeenteCards.find(c => c.code === g.gemeente_code)
    if (!card?.provinceCode) continue
    counts.set(card.provinceCode, (counts.get(card.provinceCode) ?? 0) + g.total_count)
  }
  return counts
}, [portfolioData, allGemeenteCards])
```

### FavoritedParcelCard Skeleton

```typescript
// frontend/src/components/projects/FavoritedParcelCard.tsx
import type { FavoriteResponse } from '@/lib/types/portfolio'

interface FavoritedParcelCardProps {
  favorite: FavoriteResponse
  onOpenMap?: () => void   // ghost button — navigate to map
}

export function FavoritedParcelCard({ favorite, onOpenMap }: FavoritedParcelCardProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-aura-glass-white/60 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono text-neutral-500 truncate">{favorite.parcel_id}</p>
          <p className="text-sm font-semibold text-aura-ink truncate">
            {favorite.gemeente_naam ?? favorite.gemeente_code ?? '—'}
          </p>
          {favorite.wijk_naam && (
            <p className="text-xs text-neutral-600">{favorite.wijk_naam}</p>
          )}
        </div>
        <PipelineStagePill stage={favorite.pipeline_stage as PipelineStage} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {new Date(favorite.created_at).toLocaleDateString('nl-NL')}
        </p>
        {onOpenMap && (
          <button
            onClick={onOpenMap}
            className="text-xs text-aura-amber underline underline-offset-2 hover:text-aura-amber/80"
          >
            Bekijk op kaart →
          </button>
        )}
      </div>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ProjectList.tsx` monolith (1867 lines) | Sub-components: `ProjectenPage`, `ProvincieView`, `GemeenteView`, `WijkView` + two custom hooks | Phase 110 (2026-03-16) | Portfolio view can be added as a clean new branch without entangling existing code |
| No favorites UI | `HeartButton` + `useFavorites` + `portfolio.ts` types | Phase 110 (2026-03-16) | All data layer ready for Phase 111 |
| `GET /api/parcels/favorites` only | `GET /api/portfolio` (GROUP BY query) + `GET /api/parcels/favorites` (full list) | Phase 109 (2026-03-16) | Both endpoints live; province grouping client-side |

**Deprecated/outdated:**
- Nothing deprecated. All Phase 110 artifacts are active and needed.

## Open Questions

1. **Parcel ghost button — how to open a specific favorited parcel on the map**
   - What we know: `FavoriteResponse` has `parcel_id` (Kadaster string, e.g. "HTT02-A-1234") but no coordinates. The map opens parcels via `fetchParcelAtPoint` (lat/lng). There is no `GET /api/parcels/by-code/{parcel_id}` endpoint.
   - What's unclear: Whether Phase 111 should add a backend lookup endpoint, or simply navigate to the gemeente's map view without opening a specific parcel.
   - Recommendation: For Phase 111, the ghost button navigates to `/map?gemeente_code=...` without pre-selecting the parcel. Show a toast: "Gebruik het zoekvenster om het perceel te vinden." A dedicated parcel lookup by Kadaster code can be a separate Phase 112 enhancement.

2. **`allGemeenteCards` not currently exposed from `useProjectenWorkspace`**
   - What we know: `useMunicipalityWorkspaceStats` computes `allGemeenteCards` internally; `useProjectenWorkspace` exposes `selectedProvinceGemeenteCards` (filtered to selected province), NOT `allGemeenteCards`.
   - What's unclear: Whether `allGemeenteCards` should be exposed from the workspace hook or computed separately in `PortfolioView`.
   - Recommendation: Add `allGemeenteCards` to the return value of `useProjectenWorkspace`. It's already computed in the hook via `useMunicipalityWorkspaceStats` — just needs to be included in the return object. One-line change.

3. **Should `portfolio_mode` be a route param or local state?**
   - What we know: The phase success criteria say "full-page Aura card layout" — implying portfolio mode is the full content of the page, not a side panel.
   - What's unclear: Whether deep-linking to portfolio mode (e.g., `/projecten?portfolio_mode=true&portfolio_gemeente=GM0983`) is a hard requirement.
   - Recommendation: Use URL search param (consistent with all other state in the Projecten page). Enables deep-linking and browser back button support. Negligible cost.

4. **`GemeenteCard` reuse vs PortfolioGemeenteCard**
   - What we know: `GemeenteCard` shows SVG silhouette + meldingen badge + wijken/rapporten chips. Portfolio gemeente cards would show: SVG silhouette + "N percelen opgeslagen" instead of the workspace metrics.
   - What's unclear: Whether to reuse `GemeenteCard` with optional props vs create `PortfolioGemeenteCard`.
   - Recommendation: Create `PortfolioGemeenteCard` — it has fundamentally different content (parcel count instead of project metrics). Attempting to make `GemeenteCard` dual-purpose would require many conditional props and make both use cases harder to maintain.

## Sources

### Primary (HIGH confidence)

- Codebase: `backend/app/favorites/router.py` — confirmed `GET /api/portfolio` returns `PortfolioResponse` with GROUP BY; confirmed `GET /api/parcels/favorites` returns full `FavoriteResponse[]`; confirmed `portfolio_router` included in `main.py`
- Codebase: `backend/app/favorites/schemas.py` — confirmed `PortfolioResponse`, `PortfolioGemeenteGroup`, `PortfolioWijkGroup` shapes with exact field names
- Codebase: `frontend/src/lib/types/portfolio.ts` — Phase 110 deliverable; all TS types confirmed present
- Codebase: `frontend/src/hooks/useFavorites.ts` — Phase 110 deliverable; `useParcelFavorites` + `useToggleFavorite` confirmed; `onSettled` only invalidates `['favorites']` (Pitfall 5 confirmed)
- Codebase: `frontend/src/components/projects/ProjectenPage.tsx` — current orchestrator; clean branch point for `portfolio_mode` toggle
- Codebase: `frontend/src/components/projects/useProjectenWorkspace.ts` — `allGemeenteCards` computed but not returned (Open Question 2)
- Codebase: `frontend/src/routes/_authenticated/projecten.tsx` — `projectenSearchSchema` definition; extension point confirmed
- Codebase: `frontend/src/components/projects/DrilldownBreadcrumb.tsx` — current breadcrumb only handles `gemeente_id` + `wijk_id`; portfolio needs separate variant
- Codebase: `frontend/src/components/projects/GemeenteCard.tsx` — SVG silhouette pattern; reusable for province and gemeente cards
- Codebase: `frontend/src/components/projects/WijkCard.tsx` — SVG silhouette + badge pattern; `PortfolioWijkCard` mirrors this
- Phase 110 summaries (both SUMMARY.md files) — confirmed Phase 110 complete; all artifacts present

### Secondary (MEDIUM confidence)

- `.planning/phases/110-projectlist-refactor-heartbutton/110-RESEARCH.md` — architecture guidance for portfolio types + hook structure; confirmed all deliverables
- `.planning/phases/110-projectlist-refactor-heartbutton/110-02-SUMMARY.md` — confirmed `wijk_naam: null` accepted in Phase 110 (Pitfall 2)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all hooks and types are already in the codebase
- Architecture: HIGH — based on direct code analysis of all relevant files; no guesswork
- Pitfalls: HIGH — Pitfall 1 (param collision) and Pitfall 5 (portfolio invalidation) verified in code; Pitfall 2 (null wijk_naam) confirmed in Phase 110 summary

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable patterns — all dependencies are in-project code, no external APIs)