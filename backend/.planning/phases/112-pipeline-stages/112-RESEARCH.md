# Phase 112: Pipeline Stages - Research

**Researched:** 2026-03-16
**Domain:** Frontend-only UI feature — pipeline stage selector, optimistic mutation, cross-wijk filter
**Confidence:** HIGH

## Summary

The backend is already fully implemented. `ParcelFavorite` model has `pipeline_stage` (String 30, default `'Gesignaleerd'`), `afgerond_reden` (String 30, nullable), and `notitie` (String 500, nullable). The PATCH endpoint `PATCH /api/parcels/favorites/{parcel_id}/pipeline` accepts a `PipelineUpdateRequest` body (`stage`, `afgerond_reden`, `notitie`) and returns a `FavoriteResponse`. Five valid stages are enforced via Pydantic `Literal`: `Gesignaleerd / Onderzoek / Contact / Besluit / Afgerond`. New favorites default to `Gesignaleerd` at creation time in the POST handler.

The frontend has scaffolding: `PipelineStage` type, `FavoriteResponse` with all pipeline fields, and a static `PipelineStagePill` display component. What is **missing** is: (1) a click-to-select stage mutation hook, (2) stage selector UI (popover/dropdown), (3) optimistic cache update pattern for stage changes, (4) `Afgerond` modal with reden + notitie capture, and (5) a cross-wijk stage filter control on the portfolio wijk list view.

This is a pure frontend phase. No backend migration, no new endpoints needed.

**Primary recommendation:** Add `useUpdatePipelineStage` to `useFavorites.ts` with optimistic update on `['favorites']` cache, extend `PipelineStagePill` to accept an `onClick` prop, build a `PipelineStageSelector` popover and `AfgerondModal`, and add a `portfolio_stage` URL search param for cross-wijk filtering.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PIPE-01 | Each favorited parcel card shows current pipeline stage pill (Gesignaleerd / Onderzoek / Contact / Besluit / Afgerond) | `PipelineStagePill` already renders stage — no new data needed; `FavoriteResponse.pipeline_stage` always present |
| PIPE-02 | Clicking the stage pill opens a selector; selecting a new stage updates it immediately (optimistic) and persists | Backend PATCH endpoint exists; need `useUpdatePipelineStage` hook + popover selector component |
| PIPE-03 | A newly favorited parcel defaults to "Gesignaleerd" without any user action | Already implemented in POST handler and optimistic placeholder in `useToggleFavorite` |
| PIPE-04 | A filter control on the portfolio page lets users show only parcels in a chosen stage; selecting "Onderzoek" hides all other stages across all wijken | No backend needed — pure client filter on `favorites` cache data; requires URL search param `portfolio_stage` |
| PIPE-05 | Setting stage to "Afgerond" prompts for reason (Gekocht or Afgewezen) with optional note field; reason is shown on the card | Backend accepts `afgerond_reden` + `notitie` in PATCH body; need `AfgerondModal` component; reden display needs to be added to `FavoritedParcelCard` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | existing | Optimistic mutations on `['favorites']` cache | Already used for all API state in this codebase |
| @tanstack/react-router | existing | `useSearch` + `useNavigate` for `portfolio_stage` URL param | Already used for all portfolio navigation params |
| sonner | existing | Toast feedback on mutation error | Already used everywhere in codebase |
| React useState | built-in | Local popover open/close state | No new dependency needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Framer Motion | existing | Popover/modal entrance animation | If consistent with existing Aura motion system |
| Lucide React | existing | Icons in stage selector (check mark for current stage) | Already used in project icons |

**Installation:** No new dependencies. All libraries are already in `package.json`.

## Architecture Patterns

### Recommended File Changes
```
frontend/src/
├── hooks/
│   └── useFavorites.ts           # Add useUpdatePipelineStage mutation
├── components/projects/
│   ├── PipelineStagePill.tsx     # Add onClick prop + interactive variant
│   ├── PipelineStageSelector.tsx # NEW: popover with 5 stage options
│   ├── AfgerondModal.tsx         # NEW: modal for reden + notitie capture
│   └── FavoritedParcelCard.tsx   # Wire pill click → selector; show afgerond_reden
├── routes/_authenticated/
│   └── projecten.tsx             # Add portfolio_stage to search schema
```

### Pattern 1: Optimistic Stage Update Mutation

The `useToggleFavorite` hook in `useFavorites.ts` already demonstrates the correct TanStack Query optimistic pattern for this codebase:

```typescript
// In useFavorites.ts — add below existing hooks
export function useUpdatePipelineStage() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<
    FavoriteResponse,
    Error,
    { parcelId: string; stage: PipelineStage; afgerondReden?: string | null; notitie?: string | null },
    { previousFavorites: FavoriteResponse[] | undefined }
  >({
    mutationFn: ({ parcelId, stage, afgerondReden, notitie }) =>
      apiFetch<FavoriteResponse>(`/api/parcels/favorites/${encodeURIComponent(parcelId)}/pipeline`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage,
          afgerond_reden: afgerondReden ?? null,
          notitie: notitie ?? null,
        }),
        accessToken,
      }),

    onMutate: async ({ parcelId, stage, afgerondReden, notitie }) => {
      await queryClient.cancelQueries({ queryKey: ['favorites'] })
      const previousFavorites = queryClient.getQueryData<FavoriteResponse[]>(['favorites'])

      queryClient.setQueryData<FavoriteResponse[]>(['favorites'], (old) =>
        (old ?? []).map((f) =>
          f.parcel_id === parcelId
            ? {
                ...f,
                pipeline_stage: stage,
                afgerond_reden: stage === 'Afgerond' ? (afgerondReden ?? null) : null,
                notitie: stage === 'Afgerond' ? (notitie ?? null) : null,
              }
            : f
        )
      )
      return { previousFavorites }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousFavorites !== undefined) {
        queryClient.setQueryData(['favorites'], context.previousFavorites)
      }
      toast.error('Kan fase niet bijwerken')
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}
```

**Key detail:** The optimistic update patches the in-cache `FavoriteResponse` directly — no `['portfolio']` invalidation needed because the portfolio endpoint only returns counts, not pipeline stages.

### Pattern 2: PipelineStagePill with onClick (interactive variant)

The existing `PipelineStagePill` is a static display. For PIPE-02, extend it to optionally accept `onClick`:

```typescript
interface PipelineStagePillProps {
  stage: PipelineStage
  onClick?: () => void         // if provided, renders as interactive button
  afgerondReden?: string | null // for Afgerond display (PIPE-05)
}
```

When `onClick` is provided, render `<button>` instead of `<span>` with `cursor-pointer` and hover opacity. When `afgerondReden` is present and stage is `Afgerond`, append ` — {reden}` inside the pill or below it as a sub-label.

### Pattern 3: PipelineStageSelector Popover

No Radix/shadcn popover exists in the project. Use a simple `position: relative` wrapper with a `useState(isOpen)` and a floating `div` that closes on outside click (`useEffect` with `document.addEventListener('mousedown')`). This is the established pattern in this codebase (see `LayerToggle` in map components).

```typescript
export function PipelineStageSelector({
  currentStage,
  parcelId,
  onClose,
}: {
  currentStage: PipelineStage
  parcelId: string
  onClose: () => void
}) {
  const { mutate: updateStage } = useUpdatePipelineStage()
  // ...
  // For Afgerond: instead of calling mutate, open AfgerondModal
}
```

Stage display order: `Gesignaleerd → Onderzoek → Contact → Besluit → Afgerond`. Show a checkmark or highlighted state on current stage. Clicking a stage calls `mutate` and closes the popover immediately (optimistic). Clicking `Afgerond` opens `AfgerondModal` instead.

### Pattern 4: AfgerondModal

Modal with two radio options (Gekocht / Afgewezen) + optional `<textarea>` for `notitie`. Submit button calls `useUpdatePipelineStage` with `stage: 'Afgerond'`, `afgerondReden`, `notitie`. Cancel returns to selector without changes.

Use the same portal pattern as `EigendomModal` (`createPortal(content, document.body)`) to ensure it renders above the parcel detail panel z-index.

```typescript
// AfgerondModal.tsx
interface AfgerondModalProps {
  parcelId: string
  isOpen: boolean
  onClose: () => void
}
```

### Pattern 5: Cross-Wijk Stage Filter (PIPE-04)

The filter operates on the client side only. The `favorites` query already returns all favorites. Filtering is done in `PortfolioView` by comparing `favorite.pipeline_stage` to the selected filter.

**URL search param:** Add `portfolio_stage` to `projectenSearchSchema` in `projecten.tsx`:

```typescript
portfolio_stage: z.enum(['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond']).optional(),
```

**Filter placement:** A stage filter pill row above the wijk grid in the portfolio level-3 view (`PortfolioWijkView` or the wijk-level section in `PortfolioView`). Show all 5 stages as clickable pill chips. Active stage gets amber highlight. Selecting "All" (no param) resets.

**Impact on wijk counts:** When a stage filter is active, the `wijkenForGemeente` displayed in `PortfolioWijkView` should reflect filtered counts (or be hidden if count drops to 0). The `parcel_count` from the portfolio API is unfiltered — so for level-3 and level-4 views, compute stage-filtered counts from the `favorites` cache directly rather than from `portfolio` API data.

### Anti-Patterns to Avoid

- **Don't update `['portfolio']` cache on stage change:** The `PortfolioResponse` only carries `parcel_count` per wijk, not pipeline data. Stage changes don't change wijk membership — only filtering logic changes. Portfolio invalidation is unnecessary.
- **Don't re-fetch favorites on every stage click:** Optimistic update is sufficient. `onSettled` invalidation ensures eventual consistency without blocking the UX.
- **Don't use a `<select>` element for stage selector:** Breaks Aura design system. Use a custom pill popover matching the existing design language.
- **Don't call Afgerond PATCH before capturing reden:** The backend clears `afgerond_reden` when stage is NOT `Afgerond`. If the user clicks Afgerond and cancels the modal, no PATCH should be sent.
- **Don't store stage filter in component state:** It must be a URL param so users can share/bookmark a filtered view and browser back works correctly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic mutation rollback | Custom state machine | TanStack Query `onMutate/onError` context pattern | Already demonstrated in `useToggleFavorite` |
| Toast on mutation error | Custom notification system | `sonner` toast | Consistent with all other mutations in codebase |
| Portal rendering for modal | Custom z-index stacking | `createPortal(content, document.body)` | Same pattern as `EigendomModal` |
| URL state for filter | React state / localStorage | TanStack Router `useSearch` + `useNavigate` | Preserves back/forward navigation; matches all other portfolio params |

## Common Pitfalls

### Pitfall 1: Stage filter hides wijken from PortfolioWijkView but counts come from portfolio API
**What goes wrong:** The portfolio API returns `parcel_count` per wijk computed at query time (no stage filter). When `portfolio_stage` filter is active, wijk cards show stale unfiltered counts.
**Why it happens:** `GET /api/portfolio` does `GROUP BY ... COUNT(*)` without stage filtering.
**How to avoid:** When `portfolio_stage` is active in the URL, compute wijk-level counts from the `favorites` cache (which has full `pipeline_stage` per favorite) rather than from `portfolio.wijken[].parcel_count`. Hide wijk cards where the filtered count is 0.
**Warning signs:** A wijk shows "3 percelen" but the drill-down shows 0 cards when filtered.

### Pitfall 2: AfgerondModal calling PATCH before user submits
**What goes wrong:** Clicking "Afgerond" in the stage selector triggers the optimistic update immediately, then user cancels modal → UI shows Afgerond but no PATCH was sent.
**Why it happens:** If the optimistic update is triggered in `PipelineStageSelector` before the modal confirms.
**How to avoid:** Do NOT call `mutate` from `PipelineStageSelector` when `Afgerond` is clicked. Only open `AfgerondModal`. Call `mutate` from inside `AfgerondModal.onConfirm`. The optimistic update only fires when mutate is called.

### Pitfall 3: parcel_id vs parcel_code confusion
**What goes wrong:** Using `favorite.id` (UUID) instead of `favorite.parcel_id` (Kadaster string) in the PATCH URL.
**Why it happens:** `FavoriteResponse` has both `id` (UUID) and `parcel_id` (Kadaster string). The PATCH endpoint is keyed on the Kadaster string: `PATCH /api/parcels/favorites/{parcel_id}/pipeline`.
**How to avoid:** Always use `favorite.parcel_id` (e.g. `"HTT02-A-1234"`) as the path param, and `encodeURIComponent()` it. This matches the DELETE pattern already in `useToggleFavorite`.

### Pitfall 4: URL search schema not updated
**What goes wrong:** Adding `portfolio_stage` in navigation calls but forgetting to update `projectenSearchSchema` in `projecten.tsx` → TanStack Router throws a validation error on navigation.
**Why it happens:** TanStack Router validates search params against the schema at route creation.
**How to avoid:** Update `projectenSearchSchema` with `portfolio_stage: z.enum([...]).optional()` before using it anywhere in navigation.

### Pitfall 5: PipelineStageSelector z-index conflict with parcel panel
**What goes wrong:** The popover appears behind the parcel detail panel on the map page (if stage editing is ever surfaced there).
**Why it happens:** The parcel detail panel uses z-50 or higher.
**How to avoid:** For now, stage editing is only in the portfolio page (`/projecten`) where there is no competing z-index stack. If surfaced on the map later, use `createPortal`.

## Code Examples

### PATCH /api/parcels/favorites/{parcel_id}/pipeline — request body

```json
{
  "stage": "Afgerond",
  "afgerond_reden": "Gekocht",
  "notitie": "Aankoopprijs €850k, sleuteloverdracht Q3 2026"
}
```

Response is `FavoriteResponse` with updated fields.

For non-Afgerond stages, `afgerond_reden` and `notitie` are ignored by backend (set to null):

```json
{
  "stage": "Onderzoek",
  "afgerond_reden": null,
  "notitie": null
}
```

### Stage color system (existing STAGE_STYLES in PipelineStagePill.tsx)

```typescript
const STAGE_STYLES: Record<PipelineStage, string> = {
  Gesignaleerd: 'bg-[#D1E2D8]/40 text-[#1A1C1E]',   // Sage Mint tint — default/neutral
  Onderzoek:    'bg-[#F9A826]/20 text-[#F9A826]',    // Amber — active interest
  Contact:      'bg-blue-50 text-blue-700',            // Blue — communication phase
  Besluit:      'bg-purple-50 text-purple-700',        // Purple — decision pending
  Afgerond:     'bg-neutral-100 text-neutral-600',     // Grey — closed/done
}
```

Use these same colors in `PipelineStageSelector` option rows for visual consistency.

### Portfolio filter pill rendering pattern

```typescript
// Filter bar above wijk grid — consistent with existing toggle pill style
const ALL_STAGES: PipelineStage[] = ['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond']

<div className="flex flex-wrap gap-2">
  <button
    onClick={() => navigate({ search: (prev) => ({ ...prev, portfolio_stage: undefined }) })}
    className={`rounded-full px-3 py-1 text-xs font-semibold ${!activeStage ? 'bg-aura-obsidian text-white' : 'bg-neutral-100 text-neutral-600'}`}
  >
    Alle fases
  </button>
  {ALL_STAGES.map((stage) => (
    <button
      key={stage}
      onClick={() => navigate({ search: (prev) => ({ ...prev, portfolio_stage: stage }) })}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${activeStage === stage ? 'bg-aura-obsidian text-white' : 'bg-neutral-100 text-neutral-600'}`}
    >
      {stage}
    </button>
  ))}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stage pill is static display span | Stage pill becomes interactive button | Phase 112 | Users can click to change stage inline |
| No stage filtering in portfolio | Cross-wijk stage filter via URL param | Phase 112 | Users can focus on one stage across all wijken |
| Afgerond has no reason capture | Afgerond modal captures reden + notitie | Phase 112 | reden shown on card as context |

**Already implemented (no changes needed):**
- `pipeline_stage` column with `server_default='Gesignaleerd'`
- PATCH `/api/parcels/favorites/{parcel_id}/pipeline` endpoint
- `PipelineStage` TypeScript type
- `FavoriteResponse.pipeline_stage / afgerond_reden / notitie` fields
- Static `PipelineStagePill` display component
- Optimistic placeholder `pipeline_stage: 'Gesignaleerd'` in `useToggleFavorite`

## Open Questions

1. **Should stage filter also affect the wijk-level count badge in PortfolioWijkView?**
   - What we know: The portfolio API count is unfiltered. When filter is active, wijk cards show wrong counts.
   - What's unclear: Should filtered-to-zero wijken be hidden or shown with "0 percelen"?
   - Recommendation: Hide wijken with 0 filtered parcels; compute filtered counts from `favorites` cache.

2. **Should Afgerond reason be shown inline on FavoritedParcelCard or in a sub-line?**
   - What we know: Current card has address + parcel_id on row 1, date + map-link on row 2. No reden display.
   - What's unclear: Space constraints on the card.
   - Recommendation: Add `afgerond_reden` as a small tag (e.g. `Gekocht` in green, `Afgewezen` in red) next to the Afgerond pill or as a third line on the card — only rendered when `pipeline_stage === 'Afgerond' && afgerond_reden`.

3. **Where exactly does the stage filter control render?**
   - What we know: The portfolio has 4 drill-down levels (Province → Gemeente → Wijk → Parcels). The stage filter affects ALL levels.
   - What's unclear: Should it live in the breadcrumb bar or above the grid at each level?
   - Recommendation: Render the filter bar between `PortfolioBreadcrumb` and the level grid in `PortfolioView`, so it's visible at all 4 levels. It filters what parcels are "counted" in each aggregation level.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `backend/app/favorites/router.py` — PATCH endpoint fully implemented
- Direct code inspection: `backend/app/models/parcel_favorite.py` — all pipeline columns present
- Direct code inspection: `backend/app/favorites/schemas.py` — `PipelineStage` Literal, `PipelineUpdateRequest`
- Direct code inspection: `frontend/src/hooks/useFavorites.ts` — optimistic mutation pattern
- Direct code inspection: `frontend/src/lib/types/portfolio.ts` — `FavoriteResponse` type complete
- Direct code inspection: `frontend/src/components/projects/PipelineStagePill.tsx` — static pill exists
- Direct code inspection: `frontend/src/components/projects/PortfolioView.tsx` — URL param navigation pattern
- Direct code inspection: `frontend/src/routes/_authenticated/projecten.tsx` — search schema, existing params

### Secondary (MEDIUM confidence)
- Memory context: EigendomModal portal pattern (`createPortal to document.body`) for AfgerondModal
- Memory context: Aura design system tokens for consistent styling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — backend complete, frontend patterns established from existing hooks
- Pitfalls: HIGH — derived from direct code inspection of actual implementation

**Research date:** 2026-03-16
**Valid until:** Stable (backend schema frozen, patterns established)
