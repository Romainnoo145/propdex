# Phase 6: Opgeslagen-Cockpit + Lifecycle Sidebar — Research

**Researched:** 2026-05-17
**Domain:** Frontend — React/TanStack Router/Framer Motion, Aura design system
**Confidence:** HIGH on existing code mapping; MEDIUM on lifecycle-sidebar pattern (new component design)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Opgeslagen-tab layout:** Behoud bestaand layout, transformeer naar FULL-WIDTH perceel-cards (één kolom). BAG-thumbnail links gerendered. Card-body: adres + key-facts + status-pills voor lifecycle-fase.
- **Click-behavior:** Card-click navigeert naar bestaande perceel-detail page. Geen nieuwe modal/overlay/sidebar. Detail-page = single source of truth.
- **Sidebar transformatie:** Toplevel-icons (Discovery / Settings / Workspace) → 4-8 lifecycle-icons (1. Onderzoek t/m 6. Exploitatie). Initial-render swap, geen morph-animation.
- **Active-state lifecycle-icon:** Framer Motion `layoutId` (stiffness 380, damping 30), match `SideRailNav` pattern uit v15.0.
- **Visual tokens:** Morning Mist `#F2F6F3` canvas, Pure Glass `bg-white/60 backdrop-blur-[24px]` cards, Warm Amber `#F9A826` accent, Plus Jakarta Sans, Lucide icons size=22 strokeWidth=1.5.
- **"1. Onderzoek" tab = bestaande detail-page content + slots voor M050 brief-feature (S04/S04.5/S05) + BRK-persistent (S01/S02). S06 implementeert die features NIET, alleen de slots.
- **Lifecycle-fases 2-6 in S06:** Empty-state placeholders. Status-transitions komen uit M053+.
- **M048-coordination:** Pin-mechanism (`useFactorPins`) + groep-pages (`buildPages` in `frontend/src/lib/factor-groups.ts`) MOGEN NIET breken. Test voor EN na S06.

### Claude's Discretion

- Exacte iconen-keuze voor lifecycle-fases (Lucide names) — pick semantically.
- Card-spacing en breedte-verhoudingen binnen full-width constraint.
- Empty-state copy voor fases 2-6 (NL, friendly, "Komt later").
- Loading-states voor BAG-thumbnail (skeleton vs shimmer).
- Hover-effects op cards (lift / glow / Aura-idiom).
- Card-info-density: welke key-facts naast adres + thumbnail.
- Sidebar collapse-mode (altijd open of toggle).

### Deferred Ideas (OUT OF SCOPE)

- Status-transitions tussen lifecycle-fases (M053+).
- Functionaliteit fases 2-6 (empty-state only in S06).
- Bulk-actions / multi-select op cards (M052+).
- Card sorteer/filter opties binnen opgeslagen-tab.
- Sidebar customization per-user (geen v1 UX).
- Drag-and-drop reorder.
- Brief-feature implementation (S04/S04.5/S05).
- BRK-data fetching (S01/S02).
- Tier-gate UI (S07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| **UX-01** | Opgeslagen-tab → full-width perceel-cards met BAG-thumbnail (geen layout-regression op M048 pin-mechanism + groep-pages) | Bestaande grid in `frontend/src/routes/_authenticated/opgeslagen.tsx` lines 358-367 (`grid grid-cols-1 md:grid-cols-2`) wordt vervangen door single-column. BAG-thumbnail beschikbaar via `useAerialCrop(parcelId)` in `frontend/src/hooks/useScans.ts:297` (24h cache, blob URL). M048 pin-mechanism leeft uitsluitend binnen detail-page (PotentieLayer/RisicoLayer), niet in opgeslagen-tab → geen risico op regressie zolang `FavoriteParcelWorkspaceView` niet de detail-page-flow vervangt. |
| **UX-02** | Linker sidebar → 4-8 lifecycle-icons met active-state per perceel-fase | Huidige `SideRailNav` (`frontend/src/components/layout/SideRailNav.tsx`, 195 regels) levert het exacte pattern: `motion.div` met `layoutId="sidebar-active"`, spring stiffness 380/damping 30, Lucide icons size=22 strokeWidth=1.5. Sidebar mount in `frontend/src/routes/_authenticated.tsx:104`. Voor lifecycle-context (alleen op /opgeslagen of binnen detail-page?) → planner-beslissing. |
| **UX-03** | Card-click opent bestaande detail-page; "1. Onderzoek"-tab toont scan-data + brief-feature + BRK-persistent | **GEEN dedicated detail-page-route bestaat** (`frontend/src/routes/_authenticated/parcels/$parcelId.tsx` is er niet). Huidige flow: opgeslagen-card-click → `setWorkspaceParcel(parcel)` → in-route `FavoriteParcelWorkspaceView` rendering (zie `opgeslagen.tsx:178-188`). Alternatief: click → `navigate({ to: '/map', search: toMapParcelSearch(...) })` opent `ParcelDetailPanel` floating glass-panel (Split-Canvas, `frontend/src/components/map/panels/ParcelDetailPanel.tsx`). **CRITICAL PLANNER DECISION:** welk pad = "bestaande detail-page"? Beide bestaan; mijn lezing: V5 wireframe verwijst naar `ParcelDetailPanel` op /map (= de "echte" detail-experience met scan-data + bento + pin-mechanism). `FavoriteParcelWorkspaceView` is een aparte dossier-mode workspace. |
| **UX-04** | Aura-tokens consistent (Morning Mist / Pure Glass / Plus Jakarta / Warm Amber) | Tokens centraal in `frontend/src/styles/index.css` (Tailwind v4 `@theme` block). Aura-utility-klassen: `bg-aura-canvas` / `bg-aura-obsidian` / `text-aura-amber` / `text-aura-ink`. `ResultsShell` (`frontend/src/components/layout/ResultsShell.tsx:29`) gebruikt expliciet `bg-[#FAFCFA]` (half-step lichter dan canvas) — `/opgeslagen` rendert hierin. |
| **UX-05** | `prefers-reduced-motion` fallback; `will-change:transform` op floating panels | DESIGN.md regelt al een global `@media (prefers-reduced-motion)` block in `index.css:223-252` (sloopt transitions/blur/hover). Helper-class `.aura-float` zet `will-change: transform`. S06-components moeten alleen consistent zijn met deze tokens — geen extra implementatie nodig tenzij Framer Motion specifieke `useReducedMotion()` checks vereist. |
</phase_requirements>

## Summary

S06 is een **frontend-only refactor** binnen één GSD-slice. Twee hoofdcomponenten muteren: (1) opgeslagen-tab layout en (2) linker sidebar. Beide hebben bestaande counterparts in de codebase die als pattern-bron dienen — geen rebuild from scratch.

**Belangrijkste bevinding:** Er bestaat **GEEN dedicated `/parcels/:id` route**. De "bestaande perceel-detail page" waar de wireframe naar verwijst is óf (a) `ParcelDetailPanel` floating glass-panel op `/map` (Split-Canvas met scan-data + bento + pin-mechanism), óf (b) `FavoriteParcelWorkspaceView` dossier-workspace (in-route op `/opgeslagen`). De planner moet expliciet kiezen welk pad de card-click triggert. Mijn lezing: (a) `ParcelDetailPanel` past bij V5-wireframe-bedoeling (Onderzoek = scan + scoring + pin-mechanism), terwijl (b) past bij dossier/correspondentie/brief-context. Een hybride is mogelijk: card-click → `/map` met parcel-search → opent `ParcelDetailPanel`, en de brief-feature/BRK-slot landt binnen de Bronnen-tab (S04/S05 implementatie).

**Primary recommendation voor planner:** Split S06 in 3 atomic tasks — (T1) `LifecycleSideRailNav` component build + route-aware mount; (T2) `OpgeslagenPage` route layout refactor (grid → full-width cards + BAG-thumbnail); (T3) wiring + regression-smokes voor M048 pin/groep-pages.

## Current State Mapping

### Opgeslagen-tab (current grid layout)

**File:** `frontend/src/routes/_authenticated/opgeslagen.tsx` (610 lines — *boven 300-regel limit, splits bij refactor*)

**Current structure:**
- Route component `OpgeslagenPage` (line 79).
- Two render-modes:
  - **List mode** (lines 190-394): gemeente-grouped accordions, expanded → 2-column grid `md:grid-cols-2 gap-3` met `ParcelCard` (line 358).
  - **Workspace mode** (lines 178-188): when `workspaceParcel` set → renders `FavoriteParcelWorkspaceView` full-screen.
- `ParcelCard` (lines 402-528): rounded-[20px], white bg, address + scores + pipeline pill + action buttons (checklist, map). Click → `onOpenWorkspace()` (sets workspaceParcel). No BAG-thumbnail.
- `PipelineStagePill` (lines 534-609): portal-rendered dropdown with 5 stages (Gesignaleerd / Onderzoek / Contact / Besluit / Afgerond).

**Backend pipeline stage states ALREADY EXIST** — see `useUpdatePipelineStage` in `frontend/src/hooks/useFavorites.ts:206`. The 5 backend stages (`PipelineStage` in `frontend/src/lib/types/portfolio.ts`) overlap conceptually with the 6 lifecycle-fases but are NOT 1:1.
- Backend: `Gesignaleerd · Onderzoek · Contact · Besluit · Afgerond`
- CONTEXT proposal: `Onderzoek · Eerste contact · Kwalificatie · Bod · Bouw · Exploitatie`

**Planner decision needed:** Map backend pipeline_stage → lifecycle-fase, or extend the type, or keep them parallel (lifecycle = visual category, pipeline_stage = data column). Recommend: visual-only mapping in S06, defer schema-change to M053+.

### Sidebar (`SideRailNav.tsx`)

**File:** `frontend/src/components/layout/SideRailNav.tsx` (195 lines)

**Current 5 toplevel nav items (line 34-65):** Kaart · Opgeslagen · Verkenner · Beleid · Jurisprudentie
**System pods (bottom, lines 124-191):** Documentatie · Instellingen · Uitloggen

**Pattern reusable for lifecycle-sidebar:**
- `motion.div layoutId="sidebar-active"` + `bg-aura-obsidian` shadow circle (lines 79-84).
- `text-aura-amber` voor actief icon (line 86).
- Tooltips via group-hover absolute pill (line 92).
- Mounted fixed at `left-0 top-0 bottom-0 w-[130px] z-[100]` in `_authenticated.tsx:104`. Content area `ml-[130px]`.

**CRITICAL:** Current SideRailNav is **globally mounted** in `_authenticated.tsx` — visible on ALL authenticated routes. Lifecycle-sidebar transformatie heeft 3 mount-strategy opties:
1. **Vervang `SideRailNav` global** met `LifecycleSideRailNav` (toplevel-icons verdwijnen overal — riskant, breekt nav op /map, /beleid, etc.)
2. **Conditionele render** binnen `_authenticated.tsx`: if route matches `/opgeslagen` → render `LifecycleSideRailNav` else `SideRailNav`. (V5-wireframe-conform.)
3. **Replace per-route** — `/opgeslagen` mount eigen sidebar via slot/portal.

Recommend **(2)**: clean toggle, geen state-coupling, makkelijk reverte.

### Perceel-detail page (target van card-click)

**No `/parcels/:id` route exists.** Two candidates:

| Path | Component | Mount | Content |
|------|-----------|-------|---------|
| `/map?parcel_id=X` | `ParcelDetailPanel` | Portal-rendered glass-panel (Split-Canvas), 620px left side | ParcelBentoOverview + Potentie/Risico/Dossiers layers — **includes M048 pin-mechanism** |
| `/opgeslagen` workspace-mode | `FavoriteParcelWorkspaceView` | In-route, full-screen | Dossier pages (4-card-per-page), notes, documents, contact, brief-style sections — **NO M048 pin-mechanism** |

**My interpretation of "bestaande perceel-detail page" (LOW confidence — verify with design-review):**
- V5-wireframe-text "Click → bestaande perceel-detail page (geen nieuwe modal)" + "1. Onderzoek = bestaande detail-page content + scan-data" → strongly implies **`ParcelDetailPanel` on /map** (has scan + scoring).
- However: `FavoriteParcelWorkspaceView` is *already* a full-screen workspace fired from /opgeslagen and contains slots for dossier/correspondence/checklists — closer to "stappenplan-cockpit" semantically.
- **Most likely actual intent:** Keep BOTH. Card-click → `ParcelDetailPanel` op /map (scan-data + scoring + brief-slot in Bronnen-tab). The lifecycle-sidebar reflects fase **per perceel**, not per global app-state.

### BAG-thumbnail data source

**EXISTS:** `useAerialCrop(parcelId)` in `frontend/src/hooks/useScans.ts:297-310`.
- Returns blob URL (PDOK WMS aerial via backend proxy).
- Query key: `['aerial-crop', parcelId]`, staleTime 24h.
- Used by `ParcelHero` (`frontend/src/components/map/panels/parcel/ParcelHero.tsx`) in detail-panel.
- **Ready for reuse in S06 cards** — no new backend work needed. Each card calls `useAerialCrop(parcel.parcel_cache_id ?? parcel.parcel_id)`.

**Performance note:** N favorites × N concurrent `useAerialCrop` calls = N WMS requests on mount. Backend proxy + TanStack 24h cache mitigates but consider lazy-load (IntersectionObserver) if N > 20.

## Reuse Opportunities

| Component / Hook | Path | Reuse Strategy |
|---|---|---|
| `useParcelFavorites` | `frontend/src/hooks/useFavorites.ts:48` | **REUSE as-is** — already returns full FavoriteResponse[]. |
| `useToggleFavorite` / `useUpdatePipelineStage` | `frontend/src/hooks/useFavorites.ts:77,206` | **REUSE as-is**. |
| `useAerialCrop` | `frontend/src/hooks/useScans.ts:297` | **REUSE** voor BAG-thumbnail in nieuwe full-width cards. |
| `ParcelHero` | `frontend/src/components/map/panels/parcel/ParcelHero.tsx` (41 lines) | **REFERENCE / partial reuse** — kleinere thumbnail-variant nodig (4:3 of 1:1, niet 5:6). |
| `SideRailNav` styling pattern | `frontend/src/components/layout/SideRailNav.tsx` | **PATTERN-CLONE** — copy structure, swap items list to lifecycle phases. |
| `ScoreBadge` / `PotentieModal` / `RisicoModal` | `frontend/src/components/projects/ScoreDetailModal.tsx` | **REUSE as-is** in nieuwe card-design. |
| `PipelineStagePill` | currently inline in `opgeslagen.tsx:534` | **EXTRACT + reuse** in nieuwe full-width card. |
| Aura tokens / utility classes | `frontend/src/styles/index.css` | **MANDATORY** — use `bg-aura-canvas`, `text-aura-amber`, `aura-float`, etc. NEVER hardcode hex (CLAUDE.md rule). |
| `staggerContainer` / `fadeUp` animations | `frontend/src/lib/animations.ts` | **REUSE** voor card-stagger. |
| `Skeleton` / `EmptyState` | `frontend/src/components/feedback/*` | **REUSE** voor loading + empty-states. |
| `FavoriteParcelWorkspaceView` (1922 lines!) | `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` | **KEEP AS-IS** — niet vervangen in S06. Is dossier-mode workspace (4-card-per-page pagination, document upload, notes). Bevat NIET M048 pin-mechanism. Card-click moet NIET hierheen routen (anders verlies je het scan-data/scoring-pad). |

## Lifecycle-Sidebar Component Design (recommendations)

**Pattern foundation:** Clone `SideRailNav` structure. Replace `mainItems` array with 6 lifecycle phases.

**Suggested Lucide icons (Claude's discretion area):**
| Fase | Icon | Rationale |
|------|------|-----------|
| 1. Onderzoek | `Search` of `Compass` | Discovery-fase |
| 2. Eerste contact | `Mail` of `Send` | Outreach |
| 3. Kwalificatie | `Phone` of `Users` | Conversation |
| 4. Bod / Onderhandeling | `Handshake` of `FileSignature` | Deal |
| 5. Bouw / Vergunning | `Hammer` of `Shovel` | Construction (Hammer al import in `FavoriteParcelWorkspaceView`) |
| 6. Exploitatie | `Building2` of `KeySquare` | Live asset |

**Mount strategy:** Conditional in `_authenticated.tsx:104`:
```tsx
{matchRoute({ to: '/opgeslagen' })
  ? <LifecycleSideRailNav />
  : <SideRailNav />}
```

**Active-state semantics (planner decision):**
- **Option A:** Active = currently-selected lifecycle-filter (user clicks fase → filtert cards).
- **Option B:** Active = lifecycle-fase van currently-viewed-parcel (alleen relevant in detail-mode).
- **Option C:** No active state in v1 — sidebar als pure navigatie tussen empty-state-fase-views.

S06 default = lifecycle-fase per perceel is "Onderzoek" voor alle (M053+ voegt transitions toe). **Option A maakt het meest visuele zin** — sidebar = filter-bar lifecycle-aware.

**File-size discipline:** New component < 300 lines (CLAUDE.md). Suggest split:
- `frontend/src/components/layout/LifecycleSideRailNav.tsx` — render + nav-items array
- `frontend/src/lib/lifecycle/phases.ts` — phase definitions (key, label, icon, Lucide name)

## M048 Coordination

### Pin-mechanism (REGRESSION-CRITICAL)

**Files involved:**
- `frontend/src/hooks/useFactorPins.ts` (148 lines) — TanStack Query hook, `MAX_PINS_PER_CATEGORY = 4`, optimistic add/remove.
- `frontend/src/lib/factor-groups.ts` — `buildPages(allCards, pins)`, `CARDS_PER_PAGE = 4`, page 0 = pinned synth-page + ghost slots when partial.
- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx:312-377` — consumer for potentie category.
- `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx:316-361` — consumer for risico category.
- `frontend/src/components/map/panels/parcel/FactorCard.tsx` — `isPinned` prop renders pin-affordance.
- `frontend/src/test-utils/factorPinsMock.ts` — exists, suggests prior test-coverage scaffolding.

**Critical scope-boundary:** Pin-mechanism is **only invoked from PotentieLayer/RisicoLayer**, which live inside `ParcelDetailPanel` (on `/map`). It is **NOT touched by `/opgeslagen` route** or `FavoriteParcelWorkspaceView`. → **S06 can refactor the opgeslagen-page freely without regression risk on pin-mechanism**, as long as it doesn't modify the four files above.

### Groep-pages mechanism

Same isolation: `buildPages()` is invoked in `PotentieLayer.tsx:377` and `RisicoLayer.tsx:361` — both within `ParcelDetailPanel`. Untouched by S06.

### Regression test strategy

Frontend has **no vitest config and no `.test.*` files** under `frontend/src/` (only Storybook stories). Vitest is installed as devDependency but unconfigured. Test infrastructure status:
- `frontend/package.json` scripts: `lint`, `check` (= `tsc -b --noEmit && eslint .`). **No `test` script.**
- Storybook stories exist for SideRailNav (`frontend/src/stories/layout/SideRailNav.stories.tsx`), PotentieLayer (`frontend/src/stories/parcel/PotentieLayer.stories.tsx`).
- `e2e/` directory exists (Playwright installed). Status of existing E2E suite unknown — not investigated.

**Pragmatic regression strategy for S06:**
1. **Pre-merge manual smoke** (mandatory, document in PR):
   - Open `/map`, click a parcel → ParcelDetailPanel opens → Potentie tab → verify pin-toggle works (`⭐ Max 4 bereikt` toast firing).
   - Verify groep-page pagination (chevron-left/right) navigates 6 bron-pages.
   - Repeat for Risico tab.
2. **Storybook smoke** on `PotentieLayer.stories.tsx` (visual regression by eyeballing).
3. **`npm run check`** (typecheck + lint) must be green.
4. **Optional but recommended:** Add a Playwright E2E smoke that opens /opgeslagen, clicks a favorite, lands on /map ParcelDetailPanel, toggles a pin. Defer if E2E infra not ready.

## State Management

### Per-parcel lifecycle-fase

**Backend field:** `pipeline_stage` enum in `brief_messages`-style — already exists on FavoriteResponse (`Gesignaleerd · Onderzoek · Contact · Besluit · Afgerond`). Endpoint: `PATCH /api/parcels/favorites/{parcelId}/pipeline` (see `useUpdatePipelineStage`).

**S06 strategy (CONTEXT: "default v1: alle naar Onderzoek"):**
- Lifecycle-fase = derived UI label, NOT a new DB column in S06.
- Mapping function (suggest in `frontend/src/lib/lifecycle/phases.ts`):
  ```ts
  pipelineStageToLifecyclePhase(stage: PipelineStage): LifecyclePhase
  // 'Gesignaleerd' | 'Onderzoek' → '1-onderzoek'
  // 'Contact' → '2-eerste-contact'
  // 'Besluit' → '4-bod' (or '3-kwalificatie'? planner decision)
  // 'Afgerond' → '5-bouw' or '6-exploitatie'
  ```
- Future M053+ can add a dedicated `lifecycle_phase` column without breaking this mapping.

### Filter state

If lifecycle-sidebar acts as filter (Option A above), use existing URL search-param pattern. Already done for `stage`:
- `opgeslagen.tsx:18-23` `validateSearch` defines `stage?: PipelineStage`.
- Add `lifecycle?: LifecyclePhaseKey` — survives reload, deep-linkable.
- Existing horizontal pipeline filter bar (line 226-272) may visually duplicate the sidebar; **planner decide:** keep both, replace one, or hide the horizontal bar when sidebar is in lifecycle-mode.

## Validation Strategy

Per `.planning/config.json` — `workflow.nyquist_validation` is **absent** → treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None configured for unit tests. Vitest 4.0.18 installed but no config. Playwright 1.58.2 installed; E2E status unknown. |
| Config file | None — see Wave 0 |
| Quick run command | `cd frontend && npm run check` (typecheck + lint) |
| Full suite command | `cd frontend && npm run check` (plus manual Storybook smoke) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Opgeslagen renders full-width cards with BAG-thumbnail; M048 pin not regressed | manual-only + storybook + e2e-smoke | manual + `npm run check` | manual |
| UX-02 | Sidebar swap on /opgeslagen; active-state animates via layoutId | storybook + manual | manual + visual diff Storybook | manual |
| UX-03 | Card-click → ParcelDetailPanel on /map; brief-slot + BRK-slot visible | manual smoke + Playwright if available | manual | ❌ Wave 0 |
| UX-04 | Aura tokens consistent (Morning Mist / Pure Glass / Plus Jakarta / Warm Amber) | manual visual + lint (no hardcoded hex) | `npm run check` | covered |
| UX-05 | `prefers-reduced-motion` disables transitions; floating panels have `will-change` | manual via DevTools forced-reduce | manual | manual |

### Sampling Rate
- **Per task commit:** `cd frontend && npm run check`
- **Per wave merge:** `npm run check` + manual smoke checklist (pin/groep-pages + opgeslagen render + sidebar active-state)
- **Phase gate:** Manual smoke ALL routes (`/map`, `/opgeslagen`, `/beleid`, `/jurisprudentie`) for visual regressions; full Storybook visual eyeball.

### Wave 0 Gaps
- [ ] **Playwright E2E smoke spec** (optional but recommended) — `e2e/opgeslagen-cockpit.spec.ts`. Covers: card-click → ParcelDetailPanel opens → pin-toggle works.
- [ ] **Storybook story for `LifecycleSideRailNav`** — `frontend/src/stories/layout/LifecycleSideRailNav.stories.tsx`. Mirror `SideRailNav.stories.tsx` pattern.
- [ ] **PR-template regression checklist** for M048 pin/groep-pages — embed in commit-body of S06 PR.
- [ ] **Manual smoke script** in `.planning/phases/06-.../06-SMOKE.md` (planner-discretion to add).

## Implementation Order (suggested)

Atomic tasks the planner can break out:

1. **T1 — Lifecycle data + helpers** (no UI):
   - Create `frontend/src/lib/lifecycle/phases.ts` (phase enum, mapping function, Lucide icon registry).
   - Unit-isolatable, no rendering. Lands first to unblock T2 + T3.

2. **T2 — `LifecycleSideRailNav` component**:
   - Clone `SideRailNav.tsx` structure, parameterize on phase-list.
   - Add Storybook story.
   - No mount yet — just component.

3. **T3 — Conditional mount in `_authenticated.tsx`**:
   - Add `matchRoute({ to: '/opgeslagen' })` switch.
   - Verify other routes (/map, /beleid, etc.) still render `SideRailNav`.
   - Manual smoke each route.

4. **T4 — `OpgeslagenPage` layout refactor**:
   - Replace 2-col grid with single-column full-width cards.
   - Add `useAerialCrop` thumbnail to each card.
   - Optionally add lifecycle status-pill (visual only, mapping from pipeline_stage).
   - File-size discipline: `opgeslagen.tsx` already 610 lines — **must split** before adding more (extract `ParcelCard` + `PipelineStagePill` to `frontend/src/components/projects/SavedParcelCard.tsx`).

5. **T5 — Wiring + brief-slot + BRK-slot placeholders**:
   - Inside `ParcelDetailPanel` (or via Bronnen-tab) add empty placeholder cards "Brief sturen — komt later" and "BRK Eigendom — komt later".
   - Verify they don't break existing layers.

6. **T6 — M048 regression smoke**:
   - Pre-merge manual + Storybook + (optional) Playwright spec.
   - Document outcome in PR body.

**Blocking dependencies:**
- T1 blocks T2.
- T2 blocks T3.
- T3 and T4 can run parallel after T2.
- T5 depends on T3 + T4.
- T6 = final gate.

**External dependencies** (from M050-ENG-PLAN Lane E row):
- **Lane B merge** (S01 + S02 BRK datamodel + persist client) — needed for *actual* BRK-slot wiring; for S06 we only need placeholders so this is **soft dep**.
- **Lane D merge** (S05 PostNL + S05.5 partner-branding) — needed for *actual* brief-status display; S06 only shows slot → **soft dep**.

S06 can ship with empty placeholders and not be blocked by B/D in practice. Lane-E start = after B+D merge per ENG-PLAN, but technically S06 is independent.

## Open Questions

1. **Which "perceel-detail page" is the card-click target?** `ParcelDetailPanel` on /map (most likely — has scan-data + scoring + M048 pin-mechanism) or `FavoriteParcelWorkspaceView` (current behavior — dossier workspace)?
   - **Recommendation:** Confirm with design-review V5 wireframe (`~/.gstack/projects/Romainnoo145-propdex/designs/m050-stappenplan-cockpit-20260517/`) before T4 lands. Default = `ParcelDetailPanel` via `/map?parcel_id=X` navigation.

2. **Should the horizontal pipeline-filter bar (current opgeslagen.tsx:226-272) be kept, replaced, or removed when lifecycle-sidebar exists?**
   - **Recommendation:** Remove. Sidebar replaces it semantically. Reduces visual noise per "Minimal Calm Intelligence".

3. **How is lifecycle-fase displayed per card visually?** Status-pill (like current `PipelineStagePill`)? Color-coded edge? Lifecycle-icon overlay on thumbnail?
   - **Recommendation:** Status-pill in top-right corner van card, Plus Jakarta semibold, amber-bg if onderzoek (default), other phases use Sage Mint or Pure Glass per phase.

4. **Should sidebar collapse / be persistent?**
   - **Recommendation:** Persistent (match current `SideRailNav` always-open behavior). Collapse-feature defer.

5. **Should empty-state placeholders be rendered when user clicks lifecycle-fase 2-6 in sidebar?**
   - If sidebar acts as **filter**: empty-state shows "Nog geen percelen in fase X — verplaats vanuit Onderzoek".
   - If sidebar is **purely visual** (no filter): no empty-state path.
   - **Recommendation:** Filter mode + empty-state. Better discoverability.

## Sources

### Primary (HIGH confidence — verified by reading codebase)

- `frontend/src/routes/_authenticated/opgeslagen.tsx` (610 lines) — current opgeslagen route + ParcelCard inline.
- `frontend/src/components/projects/FavoriteParcelWorkspaceView.tsx` (1922 lines) — dossier workspace.
- `frontend/src/components/layout/SideRailNav.tsx` (195 lines) — toplevel sidebar pattern.
- `frontend/src/hooks/useFavorites.ts` (372 lines) — favorites + pipeline stage hooks.
- `frontend/src/hooks/useFactorPins.ts` (148 lines) — M048 pin mechanism, isolated to detail-panel.
- `frontend/src/lib/factor-groups.ts` — buildPages / CARDS_PER_PAGE / groep-pages.
- `frontend/src/components/map/panels/ParcelDetailPanel.tsx` — Split-Canvas glass panel.
- `frontend/src/components/map/panels/parcel/ParcelHero.tsx` + `useAerialCrop` in `useScans.ts:297` — BAG-thumbnail source.
- `frontend/src/components/layout/ResultsShell.tsx` (37 lines) — opgeslagen mount shell.
- `frontend/src/routes/_authenticated.tsx` — sidebar global mount point.
- `DESIGN.md` (391 lines) — Aura system canonical.
- `.planning/phases/06-opgeslagen-cockpit-lifecycle-sidebar/06-CONTEXT.md` — locked decisions.
- `.planning/milestones/M050-ENG-PLAN.md` — Lane E dependencies.

### Secondary (MEDIUM confidence)

- `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx:312-377` + RisicoLayer.tsx:316-361 — confirms pin-mechanism isolation.
- `frontend/package.json` — confirms test-infra (vitest/playwright installed, no scripts).

### Tertiary (LOW confidence — needs confirmation)

- V5-wireframe interpretation re: which detail-page the card-click targets — **unread artifact** at `~/.gstack/projects/Romainnoo145-propdex/designs/m050-stappenplan-cockpit-20260517/`. Planner should open before T4.

## Metadata

**Confidence breakdown:**
- Current state mapping (existing files, paths, line numbers): **HIGH** — verified by direct file reads.
- Reuse opportunities: **HIGH** — hooks + components inspected.
- Lifecycle-sidebar component design: **MEDIUM** — extrapolated from SideRailNav pattern, not yet built.
- M048 isolation claim (pin-mechanism only in /map detail panel): **HIGH** — verified by grep; only PotentieLayer/RisicoLayer import useFactorPins.
- Card-click target ambiguity (ParcelDetailPanel vs FavoriteParcelWorkspaceView): **LOW** — planner must disambiguate against V5 wireframe.
- Test strategy: **MEDIUM** — no unit-test infra detected; relies on manual + Storybook + lint/typecheck.

**Research date:** 2026-05-17
**Valid until:** 2026-06-17 (30 days — stable frontend domain, no fast-moving dependencies)
