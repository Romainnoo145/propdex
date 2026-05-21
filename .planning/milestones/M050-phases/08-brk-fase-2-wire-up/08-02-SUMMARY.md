---
phase: 08-brk-fase-2-wire-up
plan: 02
subsystem: frontend-data-access

tags: [brk, m050, s06, react-query, frontend, hooks, error-mapping, polling, avg, multi-tenant]

requires:
  - phase: 08-brk-fase-2-wire-up
    plan: 01
    provides: GET /api/parcels/{parcel_id}/brk read-only endpoint + BRKOwnershipRecordRead backend schema
  - phase: 02-brk-fetch-persist-endpoint
    provides: POST /api/parcels/{parcel_id}/brk/persist + 7-row failure registry (D12 error mapping)
provides:
  - useBrkRecords(parcelId) — GET /brk React Query hook with cache key ['brk', parcelId]
  - usePersistBrk(parcelId) — POST /brk/persist mutation with AD2 cache invalidation
  - useRescorePoll(opts) — 2s × 30 polling hook honoring eng-plan AD3 cadence
  - mapBrkError(status, detail) — single-source-of-truth for 7-row BRK failure registry → Dutch copy
  - fetchBrkRecords / persistBrkRecords / fetchScanFlags / shouldStopOnSuccess — pure functions exported for unit-testability
  - BRKOwnershipRecordRead TypeScript interface (mirrors backend Pydantic schema)
affects: [08-03 ContactPhaseView wire-up, 08-04 RisicoLayer BRK factor labels (already shipped), future M050+ frontend consumers]

tech-stack:
  added:
    - "Pure-logic + state-machine test pattern for React polling hooks using vi.useFakeTimers in node-env (no jsdom / no @testing-library/react)"
  patterns:
    - "Pure query/mutation functions exported alongside hook for unit-testing without React/QueryClient"
    - "Phase derived from props + terminal state (with runKey) avoids React 19 set-state-in-effect cascade-render lint rule"
    - "Project deviation from eng-plan literal text: apiFetch + useAuth (NOT axios/apiClient — those don't exist in this codebase)"

key-files:
  created:
    - "frontend/src/hooks/useBrkRecords.ts (41 LOC; GET /brk query hook)"
    - "frontend/src/hooks/usePersistBrk.ts (55 LOC; POST /brk/persist mutation hook)"
    - "frontend/src/hooks/useRescorePoll.ts (89 LOC; 2s × 30 polling hook with cleanup)"
    - "frontend/src/lib/brk/errorMapping.ts (89 LOC; mapBrkError + BrkErrorView)"
    - "frontend/src/hooks/__tests__/useBrkRecords.test.ts (6 tests)"
    - "frontend/src/hooks/__tests__/usePersistBrk.test.ts (19 tests)"
    - "frontend/src/hooks/__tests__/useRescorePoll.test.ts (17 tests)"
  modified:
    - "frontend/src/lib/types/brk.ts (+27 LOC; appended BRKOwnershipRecordRead interface — existing Phase 105 ephemeral types untouched)"

key-decisions:
  - "Used apiFetch + useAuth (project convention) instead of eng-plan literal axios/apiClient — axios is not a project dependency; apiFetch is the established Bearer-auth + token-refresh wrapper used by all 30+ existing hooks"
  - "Pure query/mutation functions (fetchBrkRecords / persistBrkRecords / fetchScanFlags / shouldStopOnSuccess) exported alongside hooks — enables 42 tests in the node-env unit project without @testing-library/react"
  - "useRescorePoll uses runKey-scoped terminal state instead of resetPhase-in-effect — passes react-hooks/set-state-in-effect lint rule with a single justified disable for the intentional tick-reset"
  - "mapBrkError 503 disambiguation case-insensitive: detail.toLowerCase().includes('credential') → CredentialNotConfigured; otherwise FeatureDisabled. Defensive against backend Dutch/English detail-text variation"
  - "403 and 404 collapse to identical Dutch copy ('Perceel niet in jouw portfolio') — eng-plan AD2 silent-isolation rule prevents existence leak; canary test pins shared title"
  - "Polling endpoint contract /api/parcels/{parcelId}/scan is eng-plan-defined; the actual backend route does not yet exist (Plan 08-03 wires it or adapts existing scan-data endpoint). Hook is decoupled via shouldStopOnSuccess predicate so the contract change point is one line"

patterns-established:
  - "Pure function alongside hook for testability — fetchBrkRecords / persistBrkRecords / fetchScanFlags exported as named functions; hook is a thin React-wrapper"
  - "Polling state-machine testing via test-double + vi.useFakeTimers — faithful reimplementation of interval body in test for cadence + cleanup verification without renderHook (not available in node-env unit project)"
  - "Single-source-of-truth error mapping util (mapBrkError) — consumers branch on { title, body, retryable } and never on raw HTTP status"

requirements-completed: [WIRE-04, UX-08]

duration: 8m 41s
completed: 2026-05-19
---

# Phase 08 Plan 02: BRK Frontend Hook Layer Summary

**3 React Query hooks (useBrkRecords / usePersistBrk / useRescorePoll) + 1 error-mapping util (mapBrkError) + BRKOwnershipRecordRead TS type. 42/42 unit tests green. Ready-to-mount data layer for Plan 08-03 ContactPhaseView.**

## Performance

- **Duration:** 8m 41s
- **Started:** 2026-05-19T11:23:55Z
- **Completed:** 2026-05-19T11:32:36Z
- **Tasks:** 3
- **Files created:** 7
- **Files modified:** 1

## Accomplishments

- Three React Query hooks shipped covering full BRK fase-2 data-access contract: read (`useBrkRecords`), write (`usePersistBrk`), and rescore-progress feedback (`useRescorePoll`).
- Single-source-of-truth error mapping (`mapBrkError`) implements the eng-plan §"Backend-error-mapping" 7-row failure registry. 503 disambiguates FeatureDisabled vs CredentialNotConfigured via case-insensitive `credential` substring on detail. 403 + 404 collapse to identical "niet in portfolio" copy per AD2 silent-isolation iron-rule.
- `useRescorePoll` honors eng-plan AD3 cadence verbatim: POLL_INTERVAL_MS=2000, MAX_TICKS=30 (60s window), stop when `flags.cascade_rescored_at > pollStartAt`, clearInterval cleanup, no retry-loop on timeout. State-machine semantics (idle → polling → success/timeout) verified via vi.useFakeTimers + faithful test-double.
- Cache invalidation contract pinned: `usePersistBrk` onSuccess (a) `setQueryData(['brk', parcelId], records)` to hydrate read cache for instant fase-2 re-render, (b) `invalidateQueries(['scan', parcelId])` to trigger refetch of the parcel-level scan endpoint for cascade_rescored_at signal.
- 42/42 unit tests green across 3 test files (6 + 19 + 17). Tests run in the node-env `unit` vitest project per project convention (no jsdom, no @testing-library/react — React rendering covered by Storybook in Plan 08-03).
- BRKOwnershipRecordRead TypeScript interface added to `lib/types/brk.ts` (appended without disturbing existing Phase 105 ephemeral types). Mirrors backend Pydantic schema field-for-field.
- All new files: lint clean, no new tsc errors introduced (94 pre-existing project errors per scope-boundary policy — see ENG-PLAN 07-01 precedent).

## Task Commits

1. **Task 1: BRKOwnershipRecordRead TS type + useBrkRecords + 6 tests** — `84163cbc` (feat)
2. **Task 2: errorMapping util + usePersistBrk + 19 tests** — `1fc02b40` (feat)
3. **Task 3: useRescorePoll + 17 tests** — `737702fe` (feat)

## Files Created/Modified

- `frontend/src/lib/types/brk.ts` (MOD, +27 LOC) — appended `BRKOwnershipRecordRead` interface; existing Phase 105 `BRKOwnershipResponse` / `PerceelOwnership` / etc. types untouched.
- `frontend/src/hooks/useBrkRecords.ts` (NEW, 41 LOC) — exports `fetchBrkRecords(parcelId, token)` pure async + `useBrkRecords(parcelId)` hook with cache key `['brk', parcelId]`, staleTime 30s, enabled-gated on parcelId + accessToken.
- `frontend/src/hooks/usePersistBrk.ts` (NEW, 55 LOC) — exports `persistBrkRecords(parcelId, token)` pure async + `usePersistBrk(parcelId)` mutation hook; onSuccess does AD2 cache invalidation (setQueryData brk + invalidateQueries scan).
- `frontend/src/hooks/useRescorePoll.ts` (NEW, 89 LOC) — exports `shouldStopOnSuccess` pure predicate + `fetchScanFlags` query fn + `useRescorePoll(opts)` hook returning `{ phase, tickCount }`. POLL_INTERVAL_MS + MAX_TICKS constants exported for tests + consumer wiring.
- `frontend/src/lib/brk/errorMapping.ts` (NEW, 89 LOC) — exports `mapBrkError(status, detail) → BrkErrorView` per eng-plan §"Backend-error-mapping" 7-row registry.
- `frontend/src/hooks/__tests__/useBrkRecords.test.ts` (NEW, 6 tests) — empty/[] response, rechtspersoon row, URL-encoding, error propagation, cache-key drift guard, enabled-gate boolean rule.
- `frontend/src/hooks/__tests__/usePersistBrk.test.ts` (NEW, 19 tests) — 11 mapBrkError variants (401/403/404/422/502/503-FeatureDisabled/503-Credential/case-insensitivity/no-detail/undefined/500), 4 persistBrkRecords function tests, 4 onSuccess cache-mutation tests (hydrate brk, invalidate scan, no cross-parcel pollution).
- `frontend/src/hooks/__tests__/useRescorePoll.test.ts` (NEW, 17 tests) — 2 cadence-constant pins, 7 shouldStopOnSuccess predicate cases, 2 fetchScanFlags URL tests, 6 state-machine tests (idle when disabled, start polling, 3-tick poll, success-on-fresh-cascade, timeout-after-30-ticks, cleanup-clears-interval, silent-on-transient-fetch-error).

## Decisions Made

- **apiFetch + useAuth instead of axios + apiClient.** The plan's `<interfaces>` block (verbatim from eng-plan §"Frontend changes") references `axios.get`, `AxiosError`, and `apiClient`. None of those exist in this codebase. `apiFetch` (raw fetch + Bearer-auth wrapper with 401-driven token refresh) is the established convention used by every existing hook. Translation is mechanical: `apiClient.get(url)` → `apiFetch<T>(url, { method: 'GET', accessToken })`. Consumer error mapping reads `(error as ApiError).status` instead of `error.response?.status`.
- **Pure query/mutation functions exported alongside hooks.** `fetchBrkRecords` / `persistBrkRecords` / `fetchScanFlags` / `shouldStopOnSuccess` are exported as standalone functions. The hooks are thin React wrappers that call them. This enables full unit-test coverage in the node-env `unit` vitest project (no jsdom, no @testing-library/react) per project convention (vite.config.ts comment + RisicoLayer factor-coverage test precedent).
- **useRescorePoll: phase derived from props + terminal state.** Initial design called `setPhase('polling')` synchronously in the effect, which fails the React 19 `react-hooks/set-state-in-effect` lint rule (cascade-render warning). Reworked to: `phase = !active ? 'idle' : terminal?.key === runKey ? terminal.phase : 'polling'`. The terminal `{ key, phase }` shape ensures stale terminal flips from a previous run don't bleed into a new run (parcelId or pollStartAt change → runKey changes → terminal is gated out until a new terminal sets a matching key). One justified `eslint-disable` for the intentional tick-reset; matches established project precedent (PipelineStagePill, JuridischKlimaatModalContent).
- **mapBrkError 503 disambiguation case-insensitive.** Backend may return detail in mixed case ("Kadaster credential ontbreekt" vs "CREDENTIAL missing"). `detail.toLowerCase().includes('credential')` is the gate — pinned by an explicit test.
- **403 + 404 share identical Dutch copy ('Perceel niet in jouw portfolio').** Eng-plan AD2 iron-rule: 403 (CrossOrgParcelAccess) masks as 404 to prevent existence leak. A canary test asserts `mapBrkError(403).title === mapBrkError(404).title` — future divergence will fail loudly.
- **Polling endpoint contract `/api/parcels/{parcelId}/scan` is forward-looking.** The actual route doesn't exist yet (Plan 08-03 wires it or adapts the existing `/api/scans/parcels/{parcelId}/scan-data`). The hook is decoupled from the route shape via `shouldStopOnSuccess({ flags?: { cascade_rescored_at?: string } }, pollStartAt)` — changing the URL or response shape touches one line (`fetchScanFlags`) + the predicate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] axios + apiClient + AxiosError don't exist in this codebase**
- **Found during:** Task 1 (initial Read of frontend/src/lib/api.ts header — explicitly states "Raw fetch (no axios)")
- **Issue:** The plan's `<interfaces>` block lifts hook signatures verbatim from eng-plan §"Frontend changes", which references `axios.get`, `AxiosError`, and `apiClient`. Project uses raw fetch via `apiFetch` (with Bearer-auth + 401-driven token refresh) + `useAuth()` accessToken extraction. Installing axios to honor the literal spec would add a runtime dep with zero functional benefit and break the established 30+ hook convention.
- **Fix:** Translated every `apiClient.get(url)` → `apiFetch<T>(url, { method: 'GET', accessToken })`. Translated `AxiosError` → `ApiError | Error` (the project's existing wrapper from `lib/api.ts`). Consumer-side error reads use `(error as ApiError).status` instead of `error.response?.status` — single docstring line in usePersistBrk explains the Plan-08-03 consumer contract.
- **Files modified:** all three hook files + usePersistBrk test (mocked `ApiError` class shape).
- **Verification:** All 42 tests green; lint clean; the project's `apiFetch` 401-refresh logic is now usable by BRK hooks for free (no new auth wiring needed).
- **Committed in:** spread across `84163cbc` / `1fc02b40` / `737702fe`.

**2. [Rule 3 - Blocking] Project node-env unit project has no @testing-library/react / jsdom**
- **Found during:** Task 1 (plan's test action mentions `renderHook + QueryClientProvider wrapper`)
- **Issue:** The project's vitest `unit` project is `environment: 'node'` with no jsdom and no @testing-library installed. Plan's test pattern (renderHook + QueryClientProvider) cannot run. Project convention (per vite.config.ts comment + MEMORY.md "Storybook = convergence smoke layer" + Plan 08-04 RisicoLayer test precedent): pure-logic tests in node env, React rendering tests via Storybook play functions.
- **Fix:** Restructured all three hooks to export the pure data-access function alongside the hook (`fetchBrkRecords` / `persistBrkRecords` / `fetchScanFlags` / `shouldStopOnSuccess`). Tests exercise the pure functions + the onSuccess cache callbacks via a manually-instantiated `QueryClient` (which runs fine in node env — TanStack Query's core has no DOM dependencies). Polling state-machine tested via a faithful test-double of the interval body + `vi.useFakeTimers`. This matches the Plan 08-04 RisicoLayer.factor-coverage.test.tsx pattern exactly.
- **Files modified:** all three test files; both hook files restructured to export pure functions.
- **Verification:** 42/42 tests green; coverage spans all behaviors in the plan's `<behavior>` blocks (empty response, success, error mapping, cache invalidation, polling success, timeout, cleanup, transient-error silence).
- **Committed in:** spread across `84163cbc` / `1fc02b40` / `737702fe`.

**3. [Rule 1 - Bug] useRescorePoll synchronous setState-in-effect failed lint**
- **Found during:** Task 3 lint check (post-implementation, pre-commit)
- **Issue:** Initial implementation called `setPhase('polling')` + `setTickCount(0)` directly in the effect body, triggering React 19's `react-hooks/set-state-in-effect` cascade-render warning as an error. The lint rule is enabled project-wide; cannot bypass without a justified disable comment.
- **Fix:** Reworked phase derivation. Phase is now derived from props (`active = enabled && Boolean(parcelId)` → `'idle'` when inactive) + a terminal-state useState gated by a `runKey` (parcelId:pollStartAt:active). When a poll run reaches success or timeout, the effect sets `{ key: runKey, phase: 'success' | 'timeout' }`; the render reads terminal only when its key matches the current runKey, so a stale terminal from a previous run doesn't bleed into the next. Only one `eslint-disable-next-line` remains, on the intentional `setTickCount(0)` reset — matches established project precedent (PipelineStagePill.tsx line 119, JuridischKlimaatModalContent.tsx line 124, JurisprudenceSection.tsx line 34).
- **Files modified:** `frontend/src/hooks/useRescorePoll.ts`
- **Verification:** Lint clean, 17/17 tests still green.
- **Committed in:** `737702fe` (Task 3 commit; pre-commit cleanup).

---

**Total deviations:** 3 auto-fixed (2 Rule-3 blocking environmental adaptations + 1 Rule-1 lint correctness bug)
**Impact on plan:** Zero functional scope change. All behaviors from the plan's `<behavior>` blocks delivered. The hooks are drop-in for Plan 08-03 ContactPhaseView — the only consumer-side adjustment from the literal eng-plan signature is `error.response?.status` → `(error as ApiError).status`, documented in usePersistBrk.

## Issues Encountered

- Initial useRescorePoll lint failure on synchronous setState-in-effect (resolved via runKey-scoped terminal-state refactor — see Deviation #3).
- Project-wide 94 pre-existing tsc errors confirmed unchanged after this plan's additions (per scope-boundary policy, out of scope — same precedent as Plan 07-01 of Phase 07-visual-qa).

## User Setup Required

None — pure frontend addition, no env vars / DB migrations / external services.

## Next Phase Readiness

- **Plan 08-03 unblocked:** `ContactPhaseView`, `BrkPersistPanel`, `BrkOwnerCard`, `BrkHypotheekCard`, `BrkKoopwaardeTimeline`, and `RescoreProgressBanner` can mount these hooks zero-friction.
- **Coordination note for Plan 08-03:** The polling hook's endpoint contract is `GET /api/parcels/{parcelId}/scan` returning `{ flags: { cascade_rescored_at: string | null } }`. The actual backend route does not yet exist. Plan 08-03 either (a) adds the route as a thin wrapper around the existing `/api/scans/parcels/{parcelId}/scan-data` (which already reads ScanResult.flags), or (b) updates `fetchScanFlags` to call `/api/scans/parcels/{parcelId}/scan-data` and extracts flags from the existing response. Either way, the change is one line.
- **Cache-key alignment:** `usePersistBrk` invalidates `['scan', parcelId]`. No existing hook uses this exact key today — Plan 08-03 wires a new hook (likely `useParcelScanFlags(parcelId)`) on this key, or adjusts the key here if a different scan-data hook is reused.
- **Error consumer contract:** Plan 08-03 components read errors as `(error as ApiError).status` (not `error.response?.status`). The `mapBrkError(status, detail)` signature is stable and projects-readable.

## Self-Check: PASSED

- `frontend/src/lib/types/brk.ts` — MODIFIED (BRKOwnershipRecordRead interface appended, +27 LOC)
- `frontend/src/hooks/useBrkRecords.ts` — EXISTS (41 LOC, < 70 ✓)
- `frontend/src/hooks/usePersistBrk.ts` — EXISTS (55 LOC, < 100 ✓)
- `frontend/src/hooks/useRescorePoll.ts` — EXISTS (89 LOC, < 90 ✓)
- `frontend/src/lib/brk/errorMapping.ts` — EXISTS (89 LOC)
- `frontend/src/hooks/__tests__/useBrkRecords.test.ts` — EXISTS (6 tests)
- `frontend/src/hooks/__tests__/usePersistBrk.test.ts` — EXISTS (19 tests)
- `frontend/src/hooks/__tests__/useRescorePoll.test.ts` — EXISTS (17 tests)
- Commit 84163cbc — EXISTS (feat: BRKOwnershipRecordRead + useBrkRecords + 6 tests)
- Commit 1fc02b40 — EXISTS (feat: mapBrkError + usePersistBrk + 19 tests)
- Commit 737702fe — EXISTS (feat: useRescorePoll + 17 tests)
- Full unit test suite: 42/42 green across all 3 files.
- ESLint on all 8 new/modified files: clean.
- Acceptance criteria verified for all 3 tasks (greps + LOC bounds + test exit codes).

---

*Phase: 08-brk-fase-2-wire-up*
*Completed: 2026-05-19*
