# Phase 110: ProjectList Refactor + HeartButton - Research

**Researched:** 2026-03-16
**Domain:** React component refactoring + TanStack Query optimistic mutations + TypeScript types
**Confidence:** HIGH

## Summary

Phase 110 has two goals that are closely coupled: (1) split the 1867-line `ProjectList.tsx` into sub-components before v17 portfolio features compound the problem, and (2) add a `HeartButton` to `ParcelDetailPanel` that lets users favorite a parcel server-side via the Phase 109 API.

The backend is fully complete (Phase 109). `POST /api/parcels/favorites` and `DELETE /api/parcels/favorites/{parcel_id}` are live. The migration `h8c9d0e1f2g3` creates the `parcel_favorites` table with RLS. No new backend work is required for this phase.

The critical pitfall is the `parcel_id` field. `ParcelFavorite.parcel_id` stores the **Kadaster string** (e.g., `"HTT02-A-1234"`) — which is `ScanResultItem.parcel_code` in the frontend, NOT `ScanResultItem.parcel_id` (which is the ParcelCache UUID). This is different from the `parcel_documents` pattern, where `parcel_id` is also Kadaster but the frontend consistently passes `parcel.parcel_id` (UUID). The research finds that the document pattern actually uses `parcel.parcel_id` (UUID) in practice, creating a naming collision — but for **favorites**, the model comment is explicit: "Kadaster parcel ID (e.g. HTT02-A-1234)" with `String(50)`. The DELETE endpoint path is `/{parcel_id}` which must match what was stored. Use `parcel.parcel_code` when calling the favorites endpoints.

The optimistic update pattern is already established in `useMarkChangeRead` (useNotifications.ts): `onMutate` snapshots + updates cache, `onError` rolls back, `onSettled` invalidates. This is the pattern to follow for `useFavorites`.

**Primary recommendation:** Create `frontend/src/lib/types/portfolio.ts` + `frontend/src/hooks/useFavorites.ts` in Plan 01 (pure data layer), then extract ProjectList sub-components and build `HeartButton.tsx` in Plan 02 (UI layer). This order means the hook is unit-testable before the component touches it.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BACK-05 | ProjectList.tsx refactored from 1867 lines into sub-components before new features — no single file exceeds 300 lines | Component boundary analysis section; extraction plan with 5 sub-components identified |
| FAV-01 | User can click heart button on parcel detail panel to favorite/unfavorite a parcel (server-side, org-scoped) | useFavorites hook pattern; POST/DELETE endpoints already live from Phase 109 |
| FAV-02 | Heart button positioned next to close button in ParcelPanelShell, close button aligned with panel title | ParcelPanelShell analysis; HeartButton placement alongside X button |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Query (`@tanstack/react-query`) | project version | useFavorites hook — list/create/delete + optimistic updates | Already used in all hooks |
| Framer Motion | project version | Heart fill animation (scale + color transition) | Already used in ParcelPanelShell |
| Lucide React | project version | Heart icon (`Heart` from lucide-react) | Already used throughout panels |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | project version | Toast on error rollback | Already wired in ParcelDetailPanel |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Query optimistic | useState local toggle | Local state loses sync with server on re-open — TanStack Query is the correct choice for "correct state on reopen" success criterion |
| `Heart` (Lucide) | Custom SVG | Lucide is already imported in panels; no reason to diverge |
| No animation | Framer Motion scale pulse | A subtle scale-to-1.2 pulse on toggle makes the interaction feel responsive; Framer Motion is already present |

**Installation:** No new dependencies required.

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── lib/types/
│   └── portfolio.ts              # NEW — FavoriteResponse, PortfolioResponse, PipelineStage types
├── hooks/
│   └── useFavorites.ts           # NEW — useParcelFavorites (list), useToggleFavorite (mutation)
└── components/
    ├── map/panels/parcel/
    │   ├── HeartButton.tsx        # NEW — favorite toggle button
    │   └── ParcelPanelShell.tsx   # MODIFY — add heartButton prop slot alongside close button
    └── projects/
        ├── ProjectenPage.tsx      # EXTRACT from ProjectList.tsx (top-level layout + loading)
        ├── ProvincieView.tsx      # EXTRACT from ProjectList.tsx (province selector panel)
        ├── GemeenteView.tsx       # EXTRACT from ProjectList.tsx (gemeente drill-down)
        ├── WijkView.tsx           # EXTRACT from ProjectList.tsx (wijk detail + scan list)
        ├── ParcelPortfolioView.tsx # EXTRACT from ProjectList.tsx (placeholder for Phase 111)
        └── ProjectList.tsx        # MODIFY — becomes thin orchestrator (~100-150 lines)
```

### Pattern 1: TypeScript Types (portfolio.ts)

**What:** Central types file for all favorites + portfolio API shapes.
**When to use:** All new hooks and components import from here.

```typescript
// frontend/src/lib/types/portfolio.ts
export type PipelineStage = 'Gesignaleerd' | 'Onderzoek' | 'Contact' | 'Besluit' | 'Afgerond'

export interface FavoriteResponse {
  id: string  // UUID
  parcel_id: string  // Kadaster string (e.g. "HTT02-A-1234")
  user_id: string
  gemeente_code: string | null
  gemeente_naam: string | null
  wijk_naam: string | null
  pipeline_stage: PipelineStage
  afgerond_reden: string | null
  notitie: string | null
  created_at: string
  updated_at: string
}

export interface PortfolioWijkGroup {
  wijk_naam: string | null
  parcel_count: number
}

export interface PortfolioGemeenteGroup {
  gemeente_code: string | null
  gemeente_naam: string | null
  total_count: number
  wijken: PortfolioWijkGroup[]
}

export interface PortfolioResponse {
  gemeenten: PortfolioGemeenteGroup[]
  total_favorites: number
}
```

### Pattern 2: useFavorites Hook with Optimistic Update

**What:** TanStack Query hooks for listing favorites + toggling (add/remove) with optimistic update.
**When to use:** `HeartButton` calls `useToggleFavorite`; any component showing heart state calls `useParcelFavorites`.

```typescript
// frontend/src/hooks/useFavorites.ts
// Source: useMarkChangeRead pattern in useNotifications.ts (lines 197-254)

export function useParcelFavorites() {
  const { accessToken } = useAuth()
  return useQuery<FavoriteResponse[], Error>({
    queryKey: ['favorites'],
    queryFn: () => apiFetch<FavoriteResponse[]>('/api/parcels/favorites', { method: 'GET', accessToken }),
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  })
}

export function useToggleFavorite() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, Error, { parcel: ScanResultItem; isFavorited: boolean }>({
    mutationFn: async ({ parcel, isFavorited }) => {
      if (isFavorited) {
        // DELETE — uses parcel_code (Kadaster string), NOT parcel.parcel_id (UUID)
        await apiFetch(`/api/parcels/favorites/${parcel.parcel_code}`, { method: 'DELETE', accessToken })
      } else {
        await apiFetch('/api/parcels/favorites', {
          method: 'POST',
          accessToken,
          body: JSON.stringify({
            parcel_id: parcel.parcel_code,  // Kadaster string
            gemeente_code: parcel.gemeente_code,
            // gemeente_naam + wijk_naam passed from scan context (see below)
          }),
        })
      }
    },
    onMutate: async ({ parcel, isFavorited }) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] })
      const previous = queryClient.getQueryData<FavoriteResponse[]>(['favorites'])
      queryClient.setQueryData<FavoriteResponse[]>(['favorites'], (old = []) =>
        isFavorited
          ? old.filter((f) => f.parcel_id !== parcel.parcel_code)
          : [...old, { id: 'temp', parcel_id: parcel.parcel_code ?? '', /* minimal */ } as FavoriteResponse]
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['favorites'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  })
}
```

**Key: `parcel.parcel_code` for favorites, NOT `parcel.parcel_id`** — see Pitfall 1.

### Pattern 3: HeartButton Component

**What:** Small button rendered next to the close button in `ParcelPanelShell`.
**Placement:** `ParcelPanelShell` currently has a close button at `top-3 right-3`. The heart button goes at `top-3 right-12` (or the close button shifts right to make room). FAV-02 says "next to close button" — both at top right, heart at `right-12`, close at `right-3`.

```typescript
// frontend/src/components/map/panels/parcel/HeartButton.tsx
interface HeartButtonProps {
  parcel: ScanResultItem
  scanContext?: { gemeente_naam?: string | null; wijk_naam?: string | null }
}

export function HeartButton({ parcel, scanContext }: HeartButtonProps) {
  const favoritesQuery = useParcelFavorites()
  const toggleFavorite = useToggleFavorite()

  const isFavorited = useMemo(
    () => (favoritesQuery.data ?? []).some((f) => f.parcel_id === parcel.parcel_code),
    [favoritesQuery.data, parcel.parcel_code]
  )

  return (
    <button
      type="button"
      onClick={() => toggleFavorite.mutate({ parcel, isFavorited })}
      disabled={toggleFavorite.isPending}
      className="absolute top-3 right-12 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
      aria-label={isFavorited ? 'Verwijder uit portfolio' : 'Toevoegen aan portfolio'}
    >
      <Heart className={`h-4 w-4 transition-colors ${isFavorited ? 'fill-aura-amber text-aura-amber' : ''}`} />
    </button>
  )
}
```

**ParcelPanelShell receives HeartButton as optional prop:**

```typescript
// ParcelPanelShell.tsx change
interface ParcelPanelShellProps {
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  headerActions?: ReactNode  // NEW — renders between position markers
}
```

Then in `ParcelDetailPanel.tsx`, pass `<HeartButton parcel={parcel} />` as `headerActions`. The shell renders it alongside the close button.

Alternatively, HeartButton renders inside the shell's position context directly (simpler — avoids prop threading). See Pitfall 3 for trade-off.

### Pattern 4: ProjectList.tsx Extraction Strategy

**What:** The 1867-line file must be split into sub-components, each under 300 lines.
**Current structure** (identified from code analysis):
- Lines 1–119: Constants, types, demo data
- Lines 119–738: `ProjectList()` — state, hooks, memo, handlers
- Lines 738–1214: `ProjectList()` return JSX — three view branches: province+gemeente list, gemeente detail (by ID), gemeente card detail
- Lines 1215–1288: `ProjectWorkspaceHeader` function
- Lines 1289–1313: `MonitoringToggleAction` function
- Lines 1314–1599: `UnlinkedGemeenteWorkspace` function
- Lines 1600–1629: `WorkspaceMetricCard` function
- Lines 1630–1753: `WijkScanList` function
- Lines 1754+: Icon helper functions (10 tiny SVG components)

**Extraction plan:**

| Extract To | What | Approx Lines |
|-----------|------|-------------|
| `ProvincieView.tsx` | Province selector panel + gemeente card grid (the `!hasGemeenteDetail` branch) | ~250 |
| `GemeenteView.tsx` | Gemeente detail by project ID (the `selectedGemeenteId` branch) + `GemeenteWorkspaceHeader` | ~200 |
| `WijkView.tsx` | `UnlinkedGemeenteWorkspace` + `WijkScanList` (already separated at line 1314) | ~280 |
| `ParcelPortfolioView.tsx` | Placeholder for Phase 111 parcel drill-down | ~30 |
| `ProjectenPage.tsx` | Top-level orchestrator: loading state, state management, hooks, render dispatch | ~200 |
| `ProjectList.tsx` | Thin re-export wrapper (for backward compat) or rename entry point in router | ~30 |

**Key challenge:** `ProjectList()` has ~50 `useMemo`/`useCallback`/`useEffect` hooks and ~20 derived state values all in one function scope. Many are interdependent. Moving them to sub-components requires either prop-drilling or a shared state context.

**Recommended approach: props down, not context** — For Phase 110, extract the view branches as pure presentational components receiving already-computed props. Keep all state + hooks in `ProjectenPage.tsx` (the new orchestrator) and pass computed values down. This avoids introducing a new Context (added complexity) and keeps the extraction mechanical.

```typescript
// ProjectenPage.tsx receives all hook results and passes to views
<ProvincieView
  provinceOptions={provinceOptions}
  selectedProvince={selectedProvince}
  provinceStatsByCode={provinceStatsByCode}
  selectedProvinceGemeenteCards={selectedProvinceGemeenteCards}
  favoriteGemeenteCodes={favoriteGemeenteCodes}
  recentGemeenteCodes={recentGemeenteCodes}
  onProvinceSelect={setSelectedProvinceCode}
  onGemeenteSelect={handleGemeenteSelect}
  renderGemeenteCard={renderGemeenteCard}
/>
```

### Anti-Patterns to Avoid

- **Sending `parcel.parcel_id` (UUID) to favorites API:** Must use `parcel.parcel_code` (Kadaster string). See Pitfall 1.
- **Wrapping the extraction in a Context provider:** Adds indirection with no benefit for Phase 110. Props are explicit and type-safe.
- **Moving icon components to separate files:** The 10 tiny SVG icon functions (lines 1754–1867) can stay in a single `ProjectIcons.tsx` helper — they are 10 lines each and don't need individual files.
- **Creating HeartButton as a class component or using useRef for animation:** Use Framer Motion `motion.button` or just CSS transition — the project already uses both patterns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic toggle logic | Custom state machine | TanStack Query `onMutate` / `onError` rollback | Already proven pattern in useMarkChangeRead; handles race conditions |
| Heart fill animation | Manual CSS animation | CSS `transition-colors` + conditional `fill-aura-amber` class | Framer Motion `scale` pulse optional, CSS transition sufficient |
| Favorites state persistence | localStorage / Zustand | TanStack Query `['favorites']` query key | Server is source of truth; "correct state on reopen" criterion requires server-backed state |

**Key insight:** The success criterion says "Heart button reflects correct filled/unfilled state when the same parcel is reopened in a new session" — this means localStorage is explicitly ruled out. Must use server-backed TanStack Query.

## Common Pitfalls

### Pitfall 1: parcel_id vs parcel_code Confusion

**What goes wrong:** Developer passes `parcel.parcel_id` (ParcelCache UUID like `"5a3b2c1d-..."`) to the favorites API. The backend stores it, but DELETE `/{parcel_id}` looks up by this value in `parcel_favorites.parcel_id`. On a fresh session, `GET /api/parcels/favorites` returns a `parcel_id` of the UUID, but `ScanResultItem.parcel_code` is the Kadaster string — the "is favorited" check fails, the UI always shows unfilled heart.
**Why it happens:** `parcel_documents` also uses `parcel_id` as a column name, but in practice the frontend passes `parcel.parcel_id` (UUID) there too. The favorites model has the explicit comment "Kadaster parcel ID (e.g. HTT02-A-1234)" — it IS the Kadaster string.
**How to avoid:** In `useFavorites.ts`, always use `parcel.parcel_code` when constructing the request body `parcel_id` field and the DELETE path segment. The comparison in `isFavorited` must also compare against `parcel.parcel_code`: `f.parcel_id === parcel.parcel_code`.
**Warning signs:** Heart always shows unfilled on re-open; DELETE returns 404.

### Pitfall 2: ScanResultItem Missing gemeente_naam / wijk_naam

**What goes wrong:** The favorites POST body should include `gemeente_naam` and `wijk_naam` for the portfolio grouped view to display correctly. `ScanResultItem` does NOT have `gemeente_naam` or `wijk_naam` fields (only `gemeente_code`). The scan context (from `ScanResultsResponse`) has these but the panel receives only `ScanResultItem`.
**Why it happens:** `ParcelDetailPanel` receives `parcel: ScanResultItem`, not the full scan response.
**How to avoid:** Either (a) extend `HeartButton` with an optional `scanContext?: { gemeente_naam?: string | null; wijk_naam?: string | null }` prop and wire it from `ParcelDetailPanel` which itself can accept a `scanContext` prop, or (b) pass `null` for these fields and accept that portfolio grouping may show `null` wijk_naam for parcels favorited without scan context. Option (b) is simpler and acceptable for Phase 110.
**Warning signs:** `wijk_naam` always null in portfolio response despite scanning.

### Pitfall 3: HeartButton Placement in ParcelPanelShell

**What goes wrong:** FAV-02 says "positioned next to close button, close button aligned with panel title". Currently `ParcelPanelShell` renders the close button at `absolute top-3 right-3`. If HeartButton is added at `right-12`, it must not be pushed by content or scroll.
**Why it happens:** Both buttons are in the absolute-positioned overlay zone, but only the close button exists today. Adding a sibling requires coordination.
**How to avoid:** Option A — `ParcelPanelShell` accepts `headerActions?: ReactNode` prop and renders a flex row of `[headerActions, close button]` at `top-3 right-3`. The close button then lives at the right end of this flex row. Option B — HeartButton renders separately at `right-12` while close stays at `right-3`. Both work; Option A is cleaner.
**Warning signs:** HeartButton overlaps close button; close button shifts unexpectedly.

### Pitfall 4: Extraction Breaks Dependent Variables

**What goes wrong:** Extracting a JSX branch from `ProjectList()` that references `useMemo`-derived values. If the `useMemo` stays in the parent and the extracted component needs it as a prop, every render of the parent recomputes before the child renders — no change in behavior, but props list grows.
**Why it happens:** ~50 memos are currently in one closure sharing all local variables implicitly.
**How to avoid:** For Phase 110, extract view branches as presentational components receiving computed props. Do NOT hoist memos up — let the orchestrator hold them. Each extracted component gets typed props. Accept that `ProjectenPage.tsx` will have ~200 lines of hooks/memos — that is acceptable if the render is clean.
**Warning signs:** TypeScript errors on missing props after extraction; infinite render loops from incorrectly typed callback props.

### Pitfall 5: ProjectList.tsx Backward Compatibility

**What goes wrong:** The route `/_authenticated/projecten` imports `ProjectList` by default export. After extraction, if `ProjectList.tsx` becomes a thin wrapper, it must still export `default`.
**Why it happens:** `@/components/projects/ProjectList` is the import target in the router file.
**How to avoid:** Keep `ProjectList.tsx` as the default export orchestrator (rename to `ProjectenPage.tsx` internally or keep as is). Do NOT rename the file unless you update all import sites first.

## Code Examples

### useFavorites — isFavorited check

```typescript
// Source: codebase analysis — parcel_code vs parcel_id distinction
const isFavorited = useMemo(
  () => (favoritesQuery.data ?? []).some((f) => f.parcel_id === parcel.parcel_code),
  [favoritesQuery.data, parcel.parcel_code]
)
```

### HeartButton Placement in ParcelPanelShell

Current close button (line 57-64 of ParcelPanelShell.tsx):
```tsx
<button
  type="button"
  onClick={onClose}
  className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
  aria-label="Sluiten"
>
  <X className="h-4 w-4" />
</button>
```

Modified to accept `headerActions` slot:
```tsx
{/* Header action buttons — overlays hero, right-aligned */}
<div className="absolute top-3 right-3 z-10 flex items-center gap-2">
  {headerActions}
  <button type="button" onClick={onClose} ... aria-label="Sluiten">
    <X className="h-4 w-4" />
  </button>
</div>
```

### Optimistic Toggle (onMutate/onError/onSettled)

```typescript
// Source: useMarkChangeRead pattern — useNotifications.ts lines 201-254
onMutate: async ({ parcel, isFavorited }) => {
  await queryClient.cancelQueries({ queryKey: ['favorites'] })
  const previous = queryClient.getQueryData<FavoriteResponse[]>(['favorites'])
  queryClient.setQueryData<FavoriteResponse[]>(['favorites'], (old = []) =>
    isFavorited
      ? old.filter((f) => f.parcel_id !== parcel.parcel_code)
      : [...old, { id: 'optimistic', parcel_id: parcel.parcel_code ?? '' } as FavoriteResponse]
  )
  return { previous }
},
onError: (_err, _vars, context) => {
  if (context?.previous !== undefined) {
    queryClient.setQueryData(['favorites'], context.previous)
  }
},
onSettled: () => {
  void queryClient.invalidateQueries({ queryKey: ['favorites'] })
},
```

### ProjectList Extraction — orchestrator shell

```typescript
// ProjectenPage.tsx (formerly ProjectList.tsx body)
export default function ProjectList() {
  // All hooks + memos stay here (~200 lines)
  // ...

  if (isLoading) return <LoadingSkeleton />

  return (
    <div className="space-y-4">
      {isDemo && <DemoBanner />}
      {!hasGemeenteDetail && <ProjectWorkspaceHeader {...headerProps} />}
      {allProjects.length > 0
        ? hasGemeenteDetail
          ? <GemeenteView selectedGemeenteId={selectedGemeenteId} selectedGemeenteCard={selectedGemeenteCard} {...gemeenteProps} />
          : <ProvincieView provinceOptions={provinceOptions} {...provincieProps} />
        : <EmptyState />
      }
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage favorites (current `favoriteGemeenteCodes`) | Server-backed TanStack Query `['favorites']` | Phase 110 | Survives session, syncs across devices |
| Single 1867-line component | Orchestrator + extracted sub-components | Phase 110 | Each file <300 lines, composable for Phase 111+ |

**Deprecated/outdated:**
- `FAVORITE_GEMEENTEN_KEY` localStorage constant: this is for _gemeente_ favorites (star a gemeente in Projecten), separate from parcel favorites. Keep it — do not confuse with the new parcel favorites.

## Open Questions

1. **parcel_code null guard**
   - What we know: `ScanResultItem.parcel_code` is typed as `string` (not nullable) — but parcels without Kadaster IDs theoretically exist
   - What's unclear: Whether the API guarantees `parcel_code` is always set for favoritable parcels
   - Recommendation: Guard with `if (!parcel.parcel_code) return` in `HeartButton` — disable button when null, log warning

2. **ScanResultItem missing gemeente_naam / wijk_naam**
   - What we know: The panel has `parcel: ScanResultItem` which lacks `gemeente_naam` and `wijk_naam`
   - What's unclear: Whether Phase 110 needs to wire these from scan context (via parent props) or can defer to Phase 111
   - Recommendation: Pass `null` for Phase 110; accept portfolio grouping will show null wijk_naam. Phase 111 can fix this when building the portfolio view.

3. **`useFavorites.ts` vs `usePipeline.ts` separation**
   - What we know: Phase 110 only needs create/delete (not pipeline PATCH). ARCHITECTURE.md suggested separate files.
   - What's unclear: Whether a single `useFavorites.ts` covering all favorites operations is better than splitting
   - Recommendation: Single `useFavorites.ts` for Phase 110 (list + toggle). A separate `usePipeline.ts` in Phase 112 (pipeline feature).

## Validation Architecture

nyquist_validation is not enabled in `.planning/config.json` — this section is skipped.

## Sources

### Primary (HIGH confidence)

- Codebase: `frontend/src/components/map/panels/parcel/ParcelPanelShell.tsx` — close button position, shell props interface
- Codebase: `frontend/src/components/map/panels/ParcelDetailPanel.tsx` — panel structure, parcel prop type
- Codebase: `frontend/src/components/projects/ProjectList.tsx` (1867 lines) — full component structure, hook inventory, sub-component candidates
- Codebase: `frontend/src/hooks/useNotifications.ts` lines 197-254 — optimistic update pattern to copy
- Codebase: `frontend/src/lib/types/scan.ts` lines 256-301 — ScanResultItem fields (parcel_id UUID, parcel_code Kadaster string)
- Codebase: `backend/app/models/parcel_favorite.py` — parcel_id column comment: "Kadaster parcel ID (e.g. HTT02-A-1234)"
- Codebase: `backend/app/favorites/router.py` — POST/GET/DELETE/PATCH endpoints, idempotent POST
- `.planning/REQUIREMENTS.md` — FAV-01, FAV-02, BACK-05 definitions
- `.planning/phases/109-backend-foundation/109-01-SUMMARY.md` — confirmed all backend artifacts created
- `.planning/phases/109-backend-foundation/109-02-SUMMARY.md` — confirmed all 5 endpoints live
- `.planning/research/ARCHITECTURE.md` lines 370-450 — HeartButton component boundary, optimistic pattern

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` — component list for Phase 110 extraction
- `frontend/src/hooks/useProjects.ts` — pattern for mutation hooks in this project

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — extraction plan based on actual file analysis; optimistic pattern copied from existing code
- Pitfalls: HIGH — parcel_id/parcel_code distinction verified in model + type files directly

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable patterns)
