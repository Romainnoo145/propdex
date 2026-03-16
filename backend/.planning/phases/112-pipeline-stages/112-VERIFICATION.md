---
phase: 112-pipeline-stages
verified: 2026-03-16T07:40:47Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Click a stage pill on a FavoritedParcelCard on /projecten"
    expected: "Popover appears with 5 stage options, current stage has checkmark"
    why_human: "Cannot programmatically test UI popover open/close behaviour or visual positioning"
  - test: "Select Afgerond from the stage selector popover"
    expected: "AfgerondModal opens (no PATCH fires yet), shows Gekocht / Afgewezen buttons and textarea"
    why_human: "Modal open/close flow and DOM portal rendering require visual inspection"
  - test: "Select Gekocht, add a notitie, click Afronden"
    expected: "Modal closes, stage pill updates to Afgerond immediately, sub-label 'Gekocht' appears below pill"
    why_human: "Optimistic update visual feedback requires human observation"
  - test: "Navigate to /projecten?portfolio_mode=true and click 'Onderzoek' in the filter bar"
    expected: "URL updates to include portfolio_stage=Onderzoek, only Onderzoek parcels shown, zero-count wijken hidden"
    why_human: "Filter behaviour across drill-down levels requires interactive navigation testing"
  - test: "Drill down from province to wijk while Onderzoek filter is active, then click browser Back"
    expected: "Back restores previous stage filter state"
    why_human: "Browser history integration requires manual navigation testing"
---

# Phase 112: Pipeline Stages Verification Report

**Phase Goal:** Users can track the acquisition status of each favorited parcel through the 5-stage Dutch pipeline and filter their portfolio by stage
**Verified:** 2026-03-16T07:40:47Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Each favorited parcel card shows its current pipeline stage pill (Gesignaleerd / Onderzoek / Contact / Besluit / Afgerond) | VERIFIED | `FavoritedParcelCard.tsx` renders `<PipelineStagePill stage={favorite.pipeline_stage} ...>` backed by `FavoriteResponse.pipeline_stage` which is always present |
| 2 | Clicking the stage pill opens a selector; selecting a new stage updates it immediately (optimistic) and persists | VERIFIED | `PipelineStagePill` accepts `onClick`, `FavoritedParcelCard` toggles `selectorOpen`, `PipelineStageSelector` calls `useUpdatePipelineStage().mutate` with full optimistic cache update + rollback in `useFavorites.ts` |
| 3 | A newly favorited parcel defaults to "Gesignaleerd" without any user action | VERIFIED | Backend `create_favorite` hardcodes `pipeline_stage="Gesignaleerd"` (line 94 router.py); DB column has `server_default="'Gesignaleerd'"` (model line 69); optimistic placeholder in `useToggleFavorite` also sets `pipeline_stage: 'Gesignaleerd'` |
| 4 | A filter control on the portfolio page lets users show only parcels in a chosen stage; selecting "Onderzoek" hides all other stages across all wijken | VERIFIED | `PipelineStageFilter` component renders Alle fases + 5 stage pills, navigates via `portfolio_stage` URL param; `PortfolioView` `filteredFavorites` memo filters all 4 drill-down levels; zero-count wijken/gemeenten hidden via `.filter((g) => g.total_count > 0)` |
| 5 | Setting stage to "Afgerond" prompts for reason (Gekocht or Afgewezen) with optional note field; reason is shown on the card | VERIFIED | `PipelineStageSelector` calls `onAfgerond()` for Afgerond (no premature PATCH); `AfgerondModal` captures Gekocht/Afgewezen + textarea notitie; `PipelineStagePill` renders sub-label `<span className="text-[10px] text-neutral-400">{afgerondReden}</span>` when stage is Afgerond |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/hooks/useFavorites.ts` | useUpdatePipelineStage mutation hook | VERIFIED | Exports `useUpdatePipelineStage`, PATCH `/api/parcels/favorites/{encodeURIComponent(parcelId)}/pipeline`, full optimistic update + rollback, only invalidates `['favorites']` |
| `frontend/src/components/projects/PipelineStageSelector.tsx` | Popover with 5 stage options | VERIFIED | Renders 5 stages with Lucide Check on current, outside-click detection via `useEffect`/`mousedown`, delegates Afgerond to `onAfgerond` callback |
| `frontend/src/components/projects/AfgerondModal.tsx` | Modal for Afgerond reden + notitie capture | VERIFIED | `createPortal` to `document.body`, Gekocht/Afgewezen radio cards, optional textarea max 500 chars, confirm disabled until reden selected |
| `frontend/src/components/projects/PipelineStagePill.tsx` | Interactive pill with onClick prop + STAGE_STYLES export | VERIFIED | Optional `onClick` renders `<button>` with hover opacity; `afgerondReden` sub-label; `export const STAGE_STYLES` |
| `frontend/src/components/projects/FavoritedParcelCard.tsx` | Wired pill + selector + afgerond_reden display | VERIFIED | `selectorOpen`/`afgerondOpen` state, relative wrapper, `PipelineStageSelector` and `AfgerondModal` wired; uses `favorite.parcel_id` (Kadaster string) |
| `frontend/src/components/projects/PipelineStageFilter.tsx` | Stage filter pill bar component | VERIFIED | Alle fases + 5 stage pills, `useNavigate` functional updater, imports `STAGE_STYLES` from PipelineStagePill |
| `frontend/src/routes/_authenticated/projecten.tsx` | portfolio_stage in search schema | VERIFIED | `portfolio_stage: z.enum(['Gesignaleerd', 'Onderzoek', 'Contact', 'Besluit', 'Afgerond']).optional()` present |
| `frontend/src/components/projects/PortfolioView.tsx` | Client-side filtering of favorites by stage | VERIFIED | `filteredFavorites` memo, `filteredWijkenForGemeente`, `filteredGemeenteCards`, province-level recomputation, `PipelineStageFilter` rendered, `portfolio_stage` preserved in all 3 navigation handlers |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `PipelineStageSelector.tsx` | `useFavorites.ts` | `useUpdatePipelineStage` import + mutate call | WIRED | `import { useUpdatePipelineStage } from '@/hooks/useFavorites'`; `const { mutate } = useUpdatePipelineStage()` called in `handleStageClick` |
| `AfgerondModal.tsx` | `useFavorites.ts` | `useUpdatePipelineStage` import + mutate on confirm | WIRED | `import { useUpdatePipelineStage } from '@/hooks/useFavorites'`; `mutate({ parcelId, stage: 'Afgerond', afgerondReden: selectedReden, notitie })` in `handleConfirm` |
| `FavoritedParcelCard.tsx` | `PipelineStageSelector.tsx` | state toggle on pill click | WIRED | `import { PipelineStageSelector }`, `selectorOpen` state, `{selectorOpen && <PipelineStageSelector ...>}` conditional render |
| `FavoritedParcelCard.tsx` | `AfgerondModal.tsx` | `onAfgerond` callback sets `afgerondOpen` | WIRED | `import { AfgerondModal }`, `onAfgerond={() => setAfgerondOpen(true)}`, `<AfgerondModal ... isOpen={afgerondOpen}>` |
| `PipelineStageFilter.tsx` | `projecten.tsx` (URL schema) | `useNavigate` sets `portfolio_stage` search param | WIRED | `navigate({ search: (prev) => ({ ...prev, portfolio_stage: stage }) })`; schema validates with `z.enum` |
| `PortfolioView.tsx` | `useFavorites.ts` | `useParcelFavorites` filtered by `pipeline_stage` | WIRED | `const { data: favorites } = useParcelFavorites()`, `filteredFavorites` memo filters on `f.pipeline_stage === activeStageFilter` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| PIPE-01 | 112-01-PLAN.md | Each favorited parcel card shows current pipeline stage pill | SATISFIED | `FavoritedParcelCard` renders `PipelineStagePill` with `favorite.pipeline_stage`; all 5 stages styled via `STAGE_STYLES` |
| PIPE-02 | 112-01-PLAN.md | Clicking stage pill opens selector; new stage updates immediately (optimistic) and persists | SATISFIED | `PipelineStageSelector` with `useUpdatePipelineStage` optimistic mutation; PATCH `/api/parcels/favorites/{id}/pipeline`; `onMutate` patches cache, `onError` rolls back |
| PIPE-03 | 112-01-PLAN.md | New favorites default to "Gesignaleerd" without user action | SATISFIED | Backend `pipeline_stage="Gesignaleerd"` in `create_favorite`; DB `server_default`; optimistic placeholder in `useToggleFavorite` |
| PIPE-04 | 112-02-PLAN.md | Filter control shows only parcels in chosen stage across all wijken | SATISFIED | `PipelineStageFilter` + `portfolio_stage` URL param + `filteredFavorites` memo in `PortfolioView` applied at all 4 drill-down levels |
| PIPE-05 | 112-01-PLAN.md | Afgerond prompts for reason (Gekocht/Afgewezen) + optional note; reason shown on card | SATISFIED | `AfgerondModal` with radio selection + textarea; `PipelineStagePill` sub-label renders `afgerondReden` when stage is Afgerond |

**Orphaned requirements check:** PIPE-01 through PIPE-05 are defined in `112-RESEARCH.md` and `ROADMAP.md`. They do not appear in `REQUIREMENTS.md` (which covers v15.0/v16.0/v17.0 milestone requirements only). This is a documentation gap in REQUIREMENTS.md, not a code gap — the requirements are tracked in the phase research and both plans claim full coverage.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AfgerondModal.tsx` | 18 | `return null` | Info | Intentional guard — correct pattern for conditional portal rendering when `isOpen` is false. Not a stub. |

No blockers or warnings found. All implementations are substantive with real logic.

### TypeScript Compilation

`npx tsc --noEmit` returned zero output (exit 0) — no type errors.

### Human Verification Required

1. **Stage selector popover opens on pill click**
   **Test:** Navigate to `/projecten?portfolio_mode=true`, drill down to a wijk with favorites, click any stage pill
   **Expected:** Floating popover appears below pill with 5 stage options; current stage has checkmark; clicking outside closes it
   **Why human:** Popover open/close and DOM positioning cannot be verified programmatically

2. **Afgerond modal flow (no premature PATCH)**
   **Test:** Click a stage pill, select "Afgerond" in the popover
   **Expected:** Popover closes, AfgerondModal opens; clicking Cancel returns without any stage change; clicking Gekocht + Afronden updates pill to Afgerond with "Gekocht" sub-label
   **Why human:** Multi-step modal flow and absence-of-side-effect on Cancel need visual verification

3. **Optimistic update rollback on network error**
   **Test:** Temporarily break network, change a stage
   **Expected:** Pill reverts to previous stage and toast "Kan fase niet bijwerken" appears
   **Why human:** Requires controlled network failure

4. **Stage filter across drill-down levels**
   **Test:** Click "Onderzoek" in filter bar at province level, drill down through gemeente and wijk
   **Expected:** URL contains `portfolio_stage=Onderzoek` at all levels; counts reflect filtered state; wijken with 0 Onderzoek parcels are hidden
   **Why human:** Cross-level filtering requires interactive multi-step navigation

5. **Browser Back/Forward preserves filter state**
   **Test:** Set filter to Besluit, drill to a wijk, press Back
   **Expected:** Returns to gemeente level with Besluit filter still active
   **Why human:** Browser history integration requires manual navigation testing

### Gaps Summary

No gaps found. All 5 observable truths are verified, all 8 artifacts exist and are substantively implemented, all 6 key links are wired. PIPE-01 through PIPE-05 are fully satisfied. TypeScript compiles cleanly.

The only outstanding items are the 5 human verification tests above (visual/interactive behaviour that cannot be checked statically). These are informational — they do not block goal achievement determination.

---

_Verified: 2026-03-16T07:40:47Z_
_Verifier: Claude (gsd-verifier)_
