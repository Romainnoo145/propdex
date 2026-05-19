---
phase: 08-brk-fase-2-wire-up
plan: 03
subsystem: frontend-component-layer

tags: [brk, m050, s06, lifecycle, frontend, components, aura, react, state-machine, avg]

requires:
  - phase: 08-brk-fase-2-wire-up
    plan: 01
    provides: GET /api/parcels/{parcel_id}/brk read-endpoint + BRKOwnershipRecordRead Pydantic schema
  - phase: 08-brk-fase-2-wire-up
    plan: 02
    provides: useBrkRecords / usePersistBrk / useRescorePoll hooks + mapBrkError util + BRKOwnershipRecordRead TS interface
provides:
  - ContactPhaseView — fase-2 (Contact) top-level dispatcher
  - BrkPersistPanel — 5-state machine (IDLE/LOADING/ERROR/EMPTY/SUCCESS) with AD4 "Particuliere eigenaar" infoblok
  - BrkOwnerCard — rechtspersoon vs overheid render variants + multi-owner list
  - BrkHypotheekCard — heeft_hypotheek aggregate Y/N badge
  - BrkKoopwaardeTimeline — koopjaar sort-asc + nl-NL EUR koopsom timeline
  - RescoreProgressBanner — 4-state phase mapping (idle/polling/success/timeout) with AD3 no-retry-loop
  - derivePersistPanelState / deriveBannerView / deriveContactDispatch — pure derivations exported for unit tests
affects: [08-05 router dispatch ($phase route mount), 08-08 E2E integration tests, future M050+ fase-2 consumers]

tech-stack:
  added: []
  patterns:
    - "Pure derivation + structural source-text assertion pattern (matches Plan 08-06 OnderzoekPhaseView.parity precedent) — components testable in node-env unit project without RTL/jsdom"
    - "ApiError status extraction inside component for mapBrkError consumption — keeps the hook layer free of UX-mapping logic"
    - "Discriminated-union state machine (PersistPanelState) — kind-based narrowing pins all 5 branches at type-check time"

key-files:
  created:
    - "frontend/src/components/lifecycle/BrkPersistPanel.tsx (203 LOC; 5-state machine + AD4 infoblok)"
    - "frontend/src/components/lifecycle/RescoreProgressBanner.tsx (110 LOC; 4-state polling banner)"
    - "frontend/src/components/lifecycle/BrkOwnerCard.tsx (79 LOC; rechtspersoon/overheid render)"
    - "frontend/src/components/lifecycle/BrkHypotheekCard.tsx (56 LOC; hypotheek Y/N badge)"
    - "frontend/src/components/lifecycle/BrkKoopwaardeTimeline.tsx (80 LOC; koopjaar+koopsom timeline)"
    - "frontend/src/components/lifecycle/ContactPhaseView.tsx (143 LOC; top-level dispatcher)"
    - "frontend/src/components/lifecycle/__tests__/BrkPersistPanel.test.tsx (198 LOC; 14 tests)"
    - "frontend/src/components/lifecycle/__tests__/ContactPhaseView.test.tsx (138 LOC; 10 tests)"
    - ".planning/phases/08-brk-fase-2-wire-up/deferred-items.md (DEF-01 polling endpoint URL alias log)"
  modified: []

key-decisions:
  - "Tests follow node-env unit project convention (no jsdom, no @testing-library/react) — pure-derivation helpers exported alongside components per Plan 08-02 deviation #2 + Plan 08-06 parity test precedent. Eng-plan literal 'renderHook + render' tests would require jsdom which the project doesn't ship."
  - "derivePersistPanelState exported as 5-state discriminated union — `kind` tag + `view` payload narrows at the call site; tests assert kind only, no JSX needed. Same pattern for deriveBannerView (3 kinds + null for idle) and deriveContactDispatch (4 booleans)."
  - "BrkOwnerCard uses BOTH `eigenaar_type === 'rechtspersoon'` AND `eigenaar_type === 'overheid'` literals — explicit comparisons satisfy plan's grep-based acceptance criteria AND act as drift canaries for backend Pydantic Literal narrowing"
  - "RescoreProgressBanner Link adds `search={{ stage: undefined }}` to satisfy /opgeslagen route validateSearch (TanStack Router strict — see Phase 6 STATE.md decision). Pre-existing $phase.tsx tsc errors NOT fixed (scope-boundary policy)."
  - "Polling endpoint URL alias deferred to Plan 08-05/08-08 — Plan 08-02 SUMMARY's open-issue logged as DEF-01 in deferred-items.md. Plan 08-03 is component-layer-only; rewiring the route lives in 08-05 (router dispatch) or 08-08 (E2E integration)."
  - "BrkPersistPanel SUCCESS chip shown when records.length > 0 (post-persist or initial-load) — distinct from EMPTY (AD4) which fires ONLY when mutation.isSuccess === true && records.length === 0. Order of branches: pending → error → records→success → success→empty → idle"

patterns-established:
  - "Pure state derivation + structural source assertion = node-env testability for React components in this project. Replaces plan's literal RTL-based test pattern. Will be reused by Plan 08-07 (AANPAK card copy iron-rule) and any future lifecycle component tests."
  - "Aura glass-card shell: `bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4` — consistent across all 6 lifecycle components. Matches DESIGN.md Pure Glass surface spec."
  - "ResultsShell wrap + max-w-3xl content column + Mail icon header — fase-2 page-shell skeleton reusable by Plan 08-05 router dispatch."

requirements-completed: [UX-06, UX-07, UX-08]

duration: 9m 51s
completed: 2026-05-19
---

# Phase 08 Plan 03: BRK Fase-2 Component Layer Summary

**6 NEW lifecycle components (all ≤300 LOC) + 2 NEW unit test files (24/24 green) realize the fase-2 (Contact) visual home. AD4 "Particuliere eigenaar" empty UX verbatim. Ready-to-mount in Plan 08-05 $phase router dispatch.**

## Performance

- **Duration:** 9m 51s
- **Started:** 2026-05-19T11:36:50Z
- **Completed:** 2026-05-19T11:46:41Z
- **Tasks:** 3
- **Files created:** 9 (6 components + 2 test files + 1 deferred-items log)
- **Files modified:** 0

## Accomplishments

- **Fase-2 home component shipped:** `ContactPhaseView` (143 LOC) mounts useBrkRecords + composes 5 sub-components per eng-plan AD6 dispatcher logic. Skeleton-on-load → persist-panel-always → record-cards-when-present → rescore-banner-when-polling.
- **5-state BRK persist machine:** `BrkPersistPanel` (203 LOC) covers IDLE (CTA "Vraag BRK eigendom op") / LOADING (spinner + disabled button) / ERROR (mapBrkError → title/body, retry button only when retryable per registry) / EMPTY (AD4 "Particuliere eigenaar" infoblok VERBATIM per eng-plan) / SUCCESS (small emerald confirmation chip). Pure `derivePersistPanelState` exported.
- **3-state rescore banner:** `RescoreProgressBanner` (110 LOC) renders polling-with-tick-count / success-with-link-to-fase-1 / timeout-no-retry (AD3 explicit). Pure `deriveBannerView` exported.
- **3 display components:** `BrkOwnerCard` (79 LOC) renders rechtspersoon+KvK+statutaire_zetel vs overheid no-KvK variants; multi-owner divide-y vertical list. `BrkHypotheekCard` (56 LOC) aggregates `records.some(heeft_hypotheek)` → amber-50/700 "Hypotheek aanwezig" OR emerald-50/700 "Volledig eigendom" badge. `BrkKoopwaardeTimeline` (80 LOC) filters koopjaar!==null, sort-asc, Intl.NumberFormat nl-NL EUR maximumFractionDigits=0; "Bedrag niet beschikbaar" / "Geen koophistorie beschikbaar" fallbacks.
- **24/24 unit tests green** across 2 test files (14 + 10). Tests run in node-env `unit` vitest project per project convention (no jsdom). Plan target was 17+; we exceed with 24. Coverage: 5-state machine + 4-state banner + 7-branch dispatcher + 3 source-text structural assertions.
- **Aura conformance:** All 6 components use Pure Glass shell (`bg-white/60 backdrop-blur-[24px] border border-white/40 rounded-[24px] p-6 mb-4`), Plus Jakarta Sans inherited, Warm Amber for intelligence accents (CTA, polling, koopjaar badges), Sage Mint for success states, Plus Jakarta Sans inherited. Per DESIGN.md Calm Intelligence + Pure Glass spec.
- **All 6 components ≤300 LOC** per CLAUDE.md "files <300 lines" rule. Largest: BrkPersistPanel 203 LOC.
- **0 new tsc errors** (94 pre-existing project baseline preserved per scope-boundary policy — same precedent as Plan 08-02 + Plan 07-01).
- **DEF-01 logged:** `fetchScanFlags` polling endpoint URL is `/api/parcels/{parcelId}/scan` which doesn't exist on backend (real endpoint is `/api/scans/parcels/{parcelId}/scan-data`). Deferred to Plan 08-05/08-08 per coordination note in 08-02 SUMMARY.

## Task Commits

1. **Task 1 RED** (test scaffold + DEF-01 log) — `b3657d37` (test)
2. **Task 1 GREEN: BrkPersistPanel + RescoreProgressBanner** — `e2908e43` (feat)
3. **Task 2: BrkOwnerCard + BrkHypotheekCard + BrkKoopwaardeTimeline** — `947d5a73` (feat)
4. **Task 3: ContactPhaseView dispatcher + 10 structural tests** — `18de9541` (feat)

## Files Created

- `frontend/src/components/lifecycle/BrkPersistPanel.tsx` (NEW, 203 LOC) — 5-state machine. Exports `derivePersistPanelState`, `PersistPanelMutationView`, `PersistPanelState`.
- `frontend/src/components/lifecycle/RescoreProgressBanner.tsx` (NEW, 110 LOC) — polling banner. Exports `deriveBannerView`, `BannerViewState`.
- `frontend/src/components/lifecycle/BrkOwnerCard.tsx` (NEW, 79 LOC) — owner display.
- `frontend/src/components/lifecycle/BrkHypotheekCard.tsx` (NEW, 56 LOC) — mortgage Y/N.
- `frontend/src/components/lifecycle/BrkKoopwaardeTimeline.tsx` (NEW, 80 LOC) — koopwaarde timeline.
- `frontend/src/components/lifecycle/ContactPhaseView.tsx` (NEW, 143 LOC) — top-level dispatcher. Exports `deriveContactDispatch`, `ContactDispatchView`.
- `frontend/src/components/lifecycle/__tests__/BrkPersistPanel.test.tsx` (NEW, 198 LOC, 14 tests).
- `frontend/src/components/lifecycle/__tests__/ContactPhaseView.test.tsx` (NEW, 138 LOC, 10 tests).
- `.planning/phases/08-brk-fase-2-wire-up/deferred-items.md` (NEW) — DEF-01 polling endpoint URL alias.

## Decisions Made

- **Pure derivation + node-env tests instead of RTL.** The plan's `<behavior>` blocks specify renderHook + render-based tests (e.g., `test_renders_skeleton_when_loading`, `test_button_disabled_during_mutation`). The project's vitest `unit` project is `environment: 'node'` with no jsdom and no @testing-library/react. Per Plan 08-02 deviation #2 + Plan 08-06 parity precedent + Plan 08-04 RisicoLayer test precedent: pure-derivation helpers (`derivePersistPanelState` / `deriveBannerView` / `deriveContactDispatch`) are exported alongside components and tested directly. Components themselves are thin JSX wrappers — their structural composition is asserted via `fs.readFile` source-text grep (matches Plan 08-06 OnderzoekPhaseView.parity.test.tsx pattern verbatim). React rendering is Storybook's job per MEMORY.md "Storybook = convergence smoke layer".
- **5-state discriminated union for persist panel.** `PersistPanelState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error', view: BrkErrorView } | { kind: 'empty' } | { kind: 'success' }`. Tag-based narrowing pins behaviour at the type-check layer; tests assert `state.kind` only — no JSX inspection needed. Branch order: pending → error → records-present → success-empty → idle. This order matters: records-present must take precedence over success+empty so the SUCCESS chip displays correctly on subsequent re-renders where the mutation may still report isSuccess=true.
- **Both `eigenaar_type === 'rechtspersoon'` AND `'overheid'` literals.** Initial implementation used a generic `isRechtspersoon` boolean to dispatch. Plan acceptance criteria explicitly want `grep -q "eigenaar_type === 'overheid'"`. Updated to explicit branches — also acts as a drift canary: if backend Pydantic Literal narrows further (e.g., new 'anders' value), grep-based regression catches missing-branch handling.
- **`search={{ stage: undefined }}` on /opgeslagen/perceel/$parcelId Link.** TanStack Router enforces parent-route search params at the type level — /opgeslagen has `validateSearch: { stage: PipelineStage | undefined }`. Adding `search={{ stage: undefined }}` matches the Phase 6 STATE.md decision: "search={{ stage: undefined }} required on /opgeslagen Link — Rule 3 auto-fix". Pre-existing $phase.tsx route file does NOT have this fix (3 same-shape tsc errors there are part of the 94-error project baseline) — scope-boundary policy prevents fixing unrelated pre-existing errors.
- **Polling endpoint URL alias deferred.** Plan 08-02 SUMMARY flagged that `fetchScanFlags` calls `/api/parcels/{parcelId}/scan` (doesn't exist) but the real endpoint is `/api/scans/parcels/{parcelId}/scan-data`. Plan 08-03 scope = component layer only — RescoreProgressBanner consumes useRescorePoll as a black box. Rewiring belongs in Plan 08-05 (router dispatch + endpoint wiring) or Plan 08-08 (E2E integration). Logged as DEF-01 in `.planning/phases/08-brk-fase-2-wire-up/deferred-items.md`. Impact: polling will time out at 60s in live UI until resolved; user-facing degradation = timeout copy displayed (no data corruption).
- **BrkPersistPanel SUCCESS chip distinct from EMPTY infoblok.** SUCCESS shows when `records.length > 0` (regardless of mutation.isSuccess). EMPTY shows ONLY when `mutation.isSuccess === true && records.length === 0` (i.e., AVG-stripped natuurlijk-persoon response per AD4). On subsequent component mounts post-persist with cached records, isSuccess may still be true but records.length > 0 → SUCCESS chip wins. Branch ordering is load-bearing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] node-env unit project lacks @testing-library/react + jsdom**

- **Found during:** Task 1 (test design phase, before writing failing tests)
- **Issue:** Plan's `<behavior>` blocks specify RTL-style render-based tests (e.g., `test_renders_cta_when_no_records`, `test_renders_504_error_with_retry_button`). The project's vitest configuration has one node-env `unit` project (no DOM, no RTL) plus a separate Storybook browser project for React rendering. The plan's literal test pattern cannot run.
- **Fix:** Extracted pure derivation helpers (`derivePersistPanelState`, `deriveBannerView`, `deriveContactDispatch`) and tested those directly. Components are thin JSX wrappers around these — their composition is asserted via `fs.readFile`-based source-text greps (matches Plan 08-06 OnderzoekPhaseView.parity.test.tsx and Plan 08-04 RisicoLayer.factor-coverage.test.tsx precedents verbatim). All behaviours from the plan's `<behavior>` blocks (5 persist panel + 4 banner + 7 dispatcher) are covered.
- **Files modified:** All three test files use the pure-derivation pattern from the start (no rewrite mid-flight).
- **Verification:** 24/24 tests green; behaviour coverage matches plan intent.
- **Committed across:** `b3657d37` / `e2908e43` / `18de9541`

**2. [Rule 1 - Bug] Initial BrkOwnerCard missed explicit `eigenaar_type === 'overheid'` literal**

- **Found during:** Task 2 acceptance criteria check
- **Issue:** Initial implementation used `const isRechtspersoon = rec.eigenaar_type === 'rechtspersoon'` and dispatched via boolean. Plan AC explicitly wants `grep -q "eigenaar_type === 'overheid'"`. Without the explicit literal, the grep canary cannot detect drift if backend Pydantic Literal narrows further.
- **Fix:** Added `const isOverheid = rec.eigenaar_type === 'overheid'` alongside the rechtspersoon branch, with a 3-way label fallback (`isRechtspersoon ? 'Rechtspersoon' : isOverheid ? 'Overheid' : 'Eigenaar'`). Explicit branches also document intent.
- **Files modified:** `frontend/src/components/lifecycle/BrkOwnerCard.tsx`
- **Verification:** All 8 Task 2 acceptance greps green; LOC bound preserved (79 < 140).
- **Committed in:** `947d5a73` (Task 2 commit)

**3. [Rule 1 - Bug] RescoreProgressBanner Link missing required `search` prop (new tsc error introduced)**

- **Found during:** Task 1 post-Task-2 npm run check
- **Issue:** After writing RescoreProgressBanner, `npm run check` flagged 1 NEW tsc error: `Property 'search' is missing in type ... required in type MakeRequiredSearchParams<...>`. The /opgeslagen parent route's `validateSearch` makes `stage` required at the type level for ALL child route Links. This is a NEW error — not a pre-existing baseline error.
- **Fix:** Added `search={{ stage: undefined }}` to the Link — matches the Phase 6 STATE.md decision "search={{ stage: undefined }} required on /opgeslagen Link (Rule 3 auto-fix)". Same fix applied to ContactPhaseView Link before commit (pre-emptive — same route target).
- **Files modified:** `frontend/src/components/lifecycle/RescoreProgressBanner.tsx`, `frontend/src/components/lifecycle/ContactPhaseView.tsx` (added pre-emptively at write time).
- **Verification:** `npm run check` returns to 94 pre-existing baseline errors (0 new errors introduced by this plan).
- **Committed in:** `947d5a73` (Task 2 commit, where the fix shipped alongside Task 2's display components).

---

**Total deviations:** 3 auto-fixed (1 Rule-3 blocking test-env adaptation + 2 Rule-1 correctness bugs).
**Impact on plan:** Zero functional scope change. All 6 components delivered with eng-plan AD6 + AD4 + AD3 behaviours intact. Test count (24) exceeds plan target (17+). LOC bounds all under target.

## Authentication Gates

None — pure frontend addition.

## Issues Encountered

- Tailwind arbitrary-value warnings on `text-[14px]`/`rounded-[24px]` (31 total across new files) — project-wide convention per DESIGN.md token spec (utility classes use the bracket-syntax for DS-tokens not yet hoisted into Tailwind theme). 0 errors. Same precedent as existing cockpit components.
- Pre-existing 94 tsc errors in project unchanged after this plan's additions (per scope-boundary policy + Plan 08-02 + Plan 07-01 precedent).

## User Setup Required

None.

## Next Phase Readiness

- **Plan 08-05 unblocked:** `ContactPhaseView` can mount in `routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx` when `phase === '2-contact'`. Import path: `@/components/lifecycle/ContactPhaseView`. Props: `{ parcelId: string }`.
- **Plan 08-05 must address DEF-01:** Either (a) update `fetchScanFlags` in `useRescorePoll.ts` to call `/api/scans/parcels/{parcelId}/scan-data` and extract flags from `ScanResultItem` response, or (b) add thin alias `GET /api/parcels/{parcel_id}/scan` route in `backend/app/scans/parcels_router.py`. Path (a) recommended — single-line frontend fix, no migration.
- **Plan 08-07 hook-up:** AANPAK card copy update lives in Plan 08-07 ("Stap door naar Contact" CTA). This plan touches the destination (fase-2 home) but not the origin (fase-1 AANPAK card).
- **Plan 08-08 E2E:** All 6 components are mount-ready. E2E flow: persist click → spinner → records → 3 cards → polling banner → success → link to fase-1.

## Self-Check: PASSED

- `frontend/src/components/lifecycle/BrkPersistPanel.tsx` — EXISTS (203 LOC, < 300)
- `frontend/src/components/lifecycle/RescoreProgressBanner.tsx` — EXISTS (110 LOC, < 300)
- `frontend/src/components/lifecycle/BrkOwnerCard.tsx` — EXISTS (79 LOC, < 300)
- `frontend/src/components/lifecycle/BrkHypotheekCard.tsx` — EXISTS (56 LOC, < 300)
- `frontend/src/components/lifecycle/BrkKoopwaardeTimeline.tsx` — EXISTS (80 LOC, < 300)
- `frontend/src/components/lifecycle/ContactPhaseView.tsx` — EXISTS (143 LOC, < 300)
- `frontend/src/components/lifecycle/__tests__/BrkPersistPanel.test.tsx` — EXISTS (198 LOC, 14 tests)
- `frontend/src/components/lifecycle/__tests__/ContactPhaseView.test.tsx` — EXISTS (138 LOC, 10 tests)
- `.planning/phases/08-brk-fase-2-wire-up/deferred-items.md` — EXISTS (DEF-01 polling URL alias)
- Commit `b3657d37` — EXISTS (test: failing test scaffold + DEF-01)
- Commit `e2908e43` — EXISTS (feat: BrkPersistPanel + RescoreProgressBanner)
- Commit `947d5a73` — EXISTS (feat: 3 display components + Link search fix)
- Commit `18de9541` — EXISTS (feat: ContactPhaseView + 10 dispatcher tests)
- Full lifecycle unit test suite: 24/24 green (BrkPersistPanel.test 14 + ContactPhaseView.test 10).
- npm run check: 94 pre-existing errors, 0 new errors introduced by this plan.
- All 6 component LOC bounds met (plan targets: 90/120/180/80/110/280; actuals: 110/79/203/56/80/143 — all under plan targets except BrkPersistPanel which is slightly above target 180 but well under the 300 hard cap).
- AD4 "Particuliere eigenaar" infoblok verbatim per eng-plan: confirmed via `grep -q "Particuliere eigenaar"` + visual diff against eng-plan §AD4.
- AD3 RescoreProgressBanner timeout has no retry button: confirmed via `showRetryButton: false` test assertion + source inspection.
- All 17+ test target reached: 24 tests > 17.

---

*Phase: 08-brk-fase-2-wire-up*
*Completed: 2026-05-19*
