---
phase: 08-integration-tests-venlo-e2e-smoke
plan: 01
subsystem: testing
tags: [pytest, storybook, integration-smoke, woonvisie, factor-pins, cross-phase-contract]

# Dependency graph
requires:
  - phase: 05-document-level-cache-sentinel-woonvisie
    provides: DOCUMENT_SENTINEL substitution at cascade boundary; SCHEMA_VERSION 2->3 bump
  - phase: 06-wijkpolicy-schema-woonvisie-scoring-upgrade
    provides: WijkPolicy + WoonvisiePayload schema; SCHEMA_VERSION 3->4; Blerick vs Venlo-Centrum >=0.2 differentiation
  - phase: 03-woonvisie-popup
    provides: WoonvisiePopup component consuming factor.waarde dict shape
  - phase: 07-factor-pinning-groep-pages-6-cards-per-page
    provides: pin-star-filled testid; makeQueryClientWithPins helper; FactorCard div[role=button] interactive cards
provides:
  - 4 backend integration smoke tests (test_m048_phase8_smoke.py)
  - 4 Storybook plays (Phase8WijkCitaatNotAlgemeen, Phase8AlgemeenCitaatFallback, Phase8PinsPersistAcrossRemount, Phase8PinnedSurvivesPageNav)
  - WoonvisieMatchWaarde + WijkPolicy TypeScript contract types in scan.ts
  - Phase 8 regression baseline table in 08-VALIDATION.md
  - Single _VENLO_BLERICK_CENTRUM_PAYLOAD source-of-truth fixture pattern
affects: [m049-rapport-redesign, m050-cascade-batches]

# Tech tracking
tech-stack:
  added: []  # No new libraries — composition-only smoke layer
  patterns:
    - "Cross-phase smoke pattern — Storybook play + pytest integration share one fixture (_VENLO_BLERICK_CENTRUM_PAYLOAD)"
    - "Phase8/* story-name prefix for cross-phase smoke (parallel to backend test_m048_phase8_smoke.py)"
    - "Frontend Wave-0 stubs throw-from-play mirror backend pytest.fail (Nyquist parity)"
    - "Mock Claude wrapper SimpleNamespace(client, model) for monkeypatching app.ai.factor_extractor.create_claude_client"

key-files:
  created:
    - backend/tests/integration/test_m048_phase8_smoke.py
    - .planning/phases/08-integration-tests-venlo-e2e-smoke/deferred-items.md
  modified:
    - frontend/src/lib/types/scan.ts
    - frontend/src/stories/parcel/PotentieLayer.stories.tsx
    - .planning/phases/08-integration-tests-venlo-e2e-smoke/08-VALIDATION.md

key-decisions:
  - "Storybook = convergence smoke layer (NOT Playwright); component-level pin remount survival is the proxy for live-refresh which is deferred to human verification"
  - "Sentinel substitution at cascade boundary spy-tested via monkeypatch on cascade_enrichment_service.extract_factor (caller-side binding, NOT factor_extraction_service)"
  - "_VENLO_BLERICK_CENTRUM_PAYLOAD inline in test_m048_phase8_smoke.py — NOT relocated to tests/factories.py (out of scope)"
  - ">=0.2 differentiation threshold via cache layer mirrors Phase 6 Plan 04 locked floor; same fixture, composed through cache+score path"
  - "Plan path 'app.services.factor_extraction_service.get_claude_client' was incorrect — does not exist; corrected to 'app.ai.factor_extractor.create_claude_client' returning SimpleNamespace(client, model) wrapper"
  - "Pin-persistence component-level only; live-backend hard-refresh deferred to human verification block in 08-VERIFICATION.md"
  - "Deprecated WoonvisiePayload kwargs (growth_wijken/shrink_wijken/excluded_project_types) purged from Phase 8 fixtures"
  - "Frontend Wave-0 stub task (T7) added to enforce Nyquist parity with backend Task 1"

patterns-established:
  - "Single _VENLO_BLERICK_CENTRUM_PAYLOAD as cross-phase fixture source-of-truth (referenced by both backend pytest + frontend Storybook)"
  - "Phase8/* story-name prefix for cross-phase smoke (Phase8WijkCitaatNotAlgemeen, etc.)"
  - "Frontend Wave-0 stubs throw 'Wave 0 stub' Errors from play — mirrors backend pytest.fail signal"
  - "Disabled-aware nav loop: check button[disabled] / aria-disabled before clicking pagination"
  - "Mock Claude wrapper helper: _make_mock_claude_wrapper(mock_client) returns SimpleNamespace for create_claude_client patching"

requirements-completed: [TEST-08]

# Metrics
duration: 38min
completed: 2026-04-26
---

# Phase 8 Plan 01: Integration Tests + Venlo E2E Smoke Summary

**4 backend pytest + 4 Storybook plays + WoonvisieMatchWaarde TypeScript contract type compose Phases 5/6/3/7 into the M048 convergence smoke layer — sentinel-dedup proven, wijk-differentiation proven through cache, pin-persistence proven across remount.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-04-26T18:39:44Z
- **Completed:** 2026-04-26T19:17:56Z
- **Tasks:** 10
- **Files modified:** 5 (1 new backend test file, 1 new deferred-items doc, 2 frontend files extended, 1 VALIDATION.md updated)

## Accomplishments

- 4 backend integration smoke tests proving SC#1 cache-dedup, SC#2 wijk-differentiation through cache, SC#3 cache-key shape regression guard, SC#4 idempotency at cascade boundary — all 4 passing standalone
- 4 Storybook plays proving SC#3 popup-citaat positive+fallback (Blerick citaat appears, algemeen_citaat suppressed; matched_policy=null fallback path) and SC#4 pin-persistence across remount + multi-page-nav round-trips
- WoonvisieMatchWaarde + WijkPolicy TypeScript contract types added to `scan.ts` — locks the cross-phase dict-shape contract for M049+ retrofit of PotentieLayer/WoonvisiePopup
- Phase 8 regression baseline table populated in 08-VALIDATION.md with actual numbers (1613 passed / 99 failed / 4 Phase 8 smoke passing); pre-existing failure list documented in deferred-items.md
- Single `_VENLO_BLERICK_CENTRUM_PAYLOAD` source-of-truth fixture pattern established — both backend pytest and Storybook stories reference the same Blerick-vs-Venlo-Centrum payload shape

## Task Commits

1. **Task 1: Wave 0 backend stub file with 4 failing smoke tests** - `1554bf82` (test)
2. **Task 2: SC#1 — two parcels collapse to 1 Claude call** - `cac64fb5` (test)
3. **Task 3: SC#2 — Blerick vs Venlo-Centrum diff >= 0.2 via cache** - `f6d27011` (test)
4. **Task 4: cache-key shape regression guard** - `0c505387` (test)
5. **Task 5: idempotency proof — 2nd cascade call hits cache** - `a0972f0c` (test)
6. **Task 6: WoonvisieMatchWaarde + WijkPolicy TypeScript contract types** - `dad4ddcf` (feat)
7. **Task 7: 4 Phase 8 Wave 0 stub stories appended to PotentieLayer** - `64382c81` (test)
8. **Task 8: SC#3 stubs replaced with popup-citaat plays** - `5232803a` (test)
9. **Task 9: SC#4 stubs replaced with pin-persistence remount plays** - `2b8d2bf8` (test)
10. **Task 10: Phase 8 VALIDATION green + regression baseline table** - `8f55cf5a` (docs)

**Plan metadata:** to follow this commit (docs: complete plan)

## Files Created/Modified

- `backend/tests/integration/test_m048_phase8_smoke.py` (new, 235 lines) — 4 cross-phase integration tests + inline `_VENLO_BLERICK_CENTRUM_PAYLOAD` constant + inline `_seed_venlo_woonvisie` helper + `_make_mock_claude_wrapper` helper
- `frontend/src/lib/types/scan.ts` (extended, +19 lines) — `WijkPolicy` and `WoonvisieMatchWaarde` TypeScript types mirroring Phase 6 backend dict shape
- `frontend/src/stories/parcel/PotentieLayer.stories.tsx` (extended, +136 lines) — 4 Phase 8 Storybook play exports + `mockParcelNoWijkMatch` fallback fixture
- `.planning/phases/08-integration-tests-venlo-e2e-smoke/08-VALIDATION.md` (updated) — `nyquist_compliant: true`, `wave_0_complete: true`, all 10 task rows green, regression baseline table populated, Approval: passed
- `.planning/phases/08-integration-tests-venlo-e2e-smoke/deferred-items.md` (new) — 5 pre-existing Phase 7 Storybook failures + pre-existing TypeScript errors documented as out-of-scope

## Decisions Made

- **Mock Claude client wrapper.** Plan referenced `app.services.factor_extraction_service.get_claude_client` which doesn't exist — corrected to `app.ai.factor_extractor.create_claude_client` returning a `SimpleNamespace(client, model)` wrapper because `extract_factor_live()` reads `wrapper.client` and `wrapper.model` (factor_extractor.py:79-81). Helper `_make_mock_claude_wrapper(mock_client)` keeps this shape inside the test file.
- **Spy-pattern monkeypatching** at the `cascade_enrichment_service.extract_factor` level for SC#2 + cache-key tests (Tasks 3 + 4) — bypasses Anthropic mock, returns deterministic `ExtractedFactor[WoonvisiePayload]`. Real Claude mock used only for SC#1 + idempotency (Tasks 2 + 5) where call-count assertions matter.
- **CARDS_PER_PAGE=4 navigation loop** in Storybook plays uses up to 5 forward clicks to find the WOONVISIE card across paginated pages — robust against future card-ordering changes that move woonvisie_match between group pages.
- **Disabled-aware nav loop** for SC#4 multi-nav (Task 9) — `Vorige`/`Volgende pagina` buttons are always rendered but disabled at boundaries; loop checks `disabled` attr to detect page-0/last-page rather than looping forever.
- **`mockParcelNoWijkMatch` reuses PARCEL_ID** to ensure the QueryClient project-type cache pre-seed lines up — avoids triggering a real network call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected mock-Claude monkeypatch path**
- **Found during:** Task 2 (`test_two_parcels_one_claude_call_via_cascade_boundary`)
- **Issue:** Plan specified `monkeypatch.setattr("app.services.factor_extraction_service.get_claude_client", lambda: mock_client)` — that import path does not exist. The actual factory is `create_claude_client` in `app.ai.claude_client`, called via `app.ai.factor_extractor.create_claude_client()` which returns a `ClaudeClient` wrapper with `.client` and `.model` attributes (factor_extractor.py:79-81).
- **Fix:** Patch `app.ai.factor_extractor.create_claude_client` and return a `SimpleNamespace(client=mock, model="test-model")` via `_make_mock_claude_wrapper` helper. Pattern matches existing tests in `test_document_summary.py:104` etc.
- **Files modified:** `backend/tests/integration/test_m048_phase8_smoke.py`
- **Verification:** All 4 backend smoke tests pass standalone (`uv run pytest tests/integration/test_m048_phase8_smoke.py` → 4 passed in 13s).
- **Committed in:** `cac64fb5` (Task 2 commit)

**2. [Rule 3 - Blocking] Disabled-aware navigation loop in SC#4 multi-nav play**
- **Found during:** Task 9 (`Phase8PinnedSurvivesPageNav`)
- **Issue:** First implementation looped `while (prev = canvas.queryByLabelText('Vorige pagina'))` to navigate back to GEPIND — but `Vorige` button is always rendered (just `disabled` at page 0), so loop ran forever (15s vitest timeout).
- **Fix:** Replaced with bounded `for (let i = 0; i < 5; i++)` loop that checks `prev.hasAttribute('disabled')` before clicking and breaks at boundary.
- **Files modified:** `frontend/src/stories/parcel/PotentieLayer.stories.tsx`
- **Verification:** `Phase8PinnedSurvivesPageNav` passed in 180ms.
- **Committed in:** `2b8d2bf8` (Task 9 commit, second iteration before commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — Blocking)
**Impact on plan:** Both auto-fixes were path/loop mechanical fixes — no scope creep, no architectural change.

## Issues Encountered

- **Phase 6 baseline of 1625 passed / 68 failed (referenced from 06-04-SUMMARY.md) is stale.** Phase 7 introduced additional pre-existing failures during pin-cache + factor-pin migrations (test_prompt_improvement, test_eval_service, test_post_migration_model_contracts). Actual Phase 8 close = 1613 passed / 99 failed; Phase 8 introduced ZERO new failures. All 99 backend failures pre-date Phase 8, documented in `deferred-items.md`. Phase 8 smoke file passes 4/4 standalone — proving additive scope only.
- **Pre-existing 5 Phase 7 Storybook failures + pre-existing TypeScript errors** in `framer-motion ease`, `ReportSidebar.stories.tsx is_superuser`, etc. confirmed via `git stash` test before Task 7. These do not block Phase 8 acceptance — only affect the broader `pnpm check` gate.

## User Setup Required

None — no external service configuration required. All Claude calls in tests are mocked.

## Next Phase Readiness

- **Phase 8 closes M048.** Ready for `/gsd:verify-work` Phase 8 → M048 milestone close.
- M048 deliverables locked: cache-sentinel + score-UI fix + woonvisie popup + KlimaatLayer bug + document-level cache + WijkPolicy schema + factor pinning + Phase 8 smoke layer.
- Cross-phase contracts locked for M049+:
  - `WoonvisieMatchWaarde` TypeScript type in `frontend/src/lib/types/scan.ts`
  - `_VENLO_BLERICK_CENTRUM_PAYLOAD` Python fixture pattern reusable from Venlo-scope to other gemeente smoke tests
  - `Phase8/*` story-name prefix convention for cross-phase smoke reusable in M049+
- Manual-only verifications (live-backend hard refresh + Aura visual smoke) deferred to `08-VERIFICATION.md` human_verification block to be created during `/gsd:verify-work`.

---
*Phase: 08-integration-tests-venlo-e2e-smoke*
*Completed: 2026-04-26*

## Self-Check

Verifying claims before state updates:

**Files exist:**
- `backend/tests/integration/test_m048_phase8_smoke.py` — FOUND
- `frontend/src/lib/types/scan.ts` (extended) — FOUND
- `frontend/src/stories/parcel/PotentieLayer.stories.tsx` (extended) — FOUND
- `.planning/phases/08-integration-tests-venlo-e2e-smoke/08-VALIDATION.md` (updated) — FOUND
- `.planning/phases/08-integration-tests-venlo-e2e-smoke/deferred-items.md` — FOUND

**Commits exist:**
- `1554bf82` Task 1 — FOUND
- `cac64fb5` Task 2 — FOUND
- `f6d27011` Task 3 — FOUND
- `0c505387` Task 4 — FOUND
- `a0972f0c` Task 5 — FOUND
- `dad4ddcf` Task 6 — FOUND
- `64382c81` Task 7 — FOUND
- `5232803a` Task 8 — FOUND
- `2b8d2bf8` Task 9 — FOUND
- `8f55cf5a` Task 10 — FOUND

## Self-Check: PASSED
