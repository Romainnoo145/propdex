---
phase: 8
slug: integration-tests-venlo-e2e-smoke
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 8 IS the validation layer for M047 — it composes existing per-phase tests into cross-phase smoke coverage.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Backend framework** | pytest 7.x + pytest-asyncio (existing in `backend/pyproject.toml`) |
| **Frontend framework** | Storybook 10.2.8 + `@storybook/addon-vitest` + Playwright (browser driver) |
| **Backend config** | `backend/pyproject.toml` (existing) |
| **Frontend config** | `frontend/vite.config.ts` (existing — `test.projects[0]` named `'storybook'`) |
| **Quick run (backend)** | `cd backend && uv run pytest tests/integration/test_m048_phase8_smoke.py -x` |
| **Quick run (frontend)** | `cd frontend && pnpm exec vitest run --project=storybook -t Phase8` |
| **Full suite (backend)** | `cd backend && uv run pytest -x` |
| **Full suite (frontend)** | `cd frontend && pnpm check && pnpm exec vitest run --project=storybook` |
| **Estimated runtime** | backend smoke <30s; frontend smoke <60s; full backend ~3min; full frontend ~2min |

---

## Sampling Rate

- **After every task commit:** Run quick-run for the relevant layer (backend integration <30s; storybook play <60s)
- **After every plan wave:** Run `cd backend && uv run pytest tests/integration/ -x` (<3min) + `cd frontend && pnpm exec vitest run --project=storybook` (<2min)
- **Before `/gsd:verify-work`:** Full backend suite + `pnpm check` + Storybook full-suite all green
- **Max feedback latency:** 60s for per-task, 5min for per-wave

---

## Per-Task Verification Map

> Filled in by planner during plan creation. Every task with code-side acceptance must list its automated command + file. Manual-only behaviors go to the section below.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-W0-01 | 01 | 0 | TEST-08 | infra | `test -f backend/tests/integration/test_m048_phase8_smoke.py` | ❌ W0 | ⬜ pending |
| 8-01-W0-02 | 01 | 0 | TEST-08 | infra | `grep -q 'Phase8' frontend/src/stories/parcel/PotentieLayer.stories.tsx` | ❌ W0 | ⬜ pending |
| 8-01-01 | 01 | 1 | TEST-08 / SC#1 | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_two_parcels_one_claude_call_via_cascade_boundary -x` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | TEST-08 / SC#2 | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_two_parcels_different_woonvisie_scores_via_cache -x` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 1 | TEST-08 / cache-key | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_cache_key_shape -x` | ❌ W0 | ⬜ pending |
| 8-01-04 | 01 | 1 | TEST-08 / idempotency | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_second_cascade_call_is_idempotent -x` | ❌ W0 | ⬜ pending |
| 8-01-05 | 01 | 1 | TEST-08 / SC#3 | storybook play | `pnpm exec vitest run --project=storybook -t Phase8WijkCitaatNotAlgemeen` | ❌ W0 | ⬜ pending |
| 8-01-06 | 01 | 1 | TEST-08 / SC#3-fallback | storybook play | `pnpm exec vitest run --project=storybook -t Phase8AlgemeenCitaatFallback` | ❌ W0 | ⬜ pending |
| 8-01-07 | 01 | 1 | TEST-08 / SC#4 | storybook play | `pnpm exec vitest run --project=storybook -t Phase8PinsPersistAcrossRemount` | ❌ W0 | ⬜ pending |
| 8-01-08 | 01 | 1 | TEST-08 / SC#4-nav | storybook play | `pnpm exec vitest run --project=storybook -t Phase8PinnedSurvivesPageNav` | ❌ W0 | ⬜ pending |
| 8-01-09 | 01 | 2 | TEST-08 / SC#5 | regression | `cd backend && uv run pytest -x --tb=no -q` (compare green-count vs Phase 7 baseline) | ✅ existing | ⬜ pending |
| 8-01-10 | 01 | 2 | TEST-08 / SC#5 | regression | `cd frontend && pnpm check && pnpm exec vitest run --project=storybook` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Note:** Final task IDs and counts are authoritative in `08-01-PLAN.md`. This map gets refined when planner finalizes the plan structure. Min target: **15 new tests** distributed across SC#1–4 (4–5 backend integration + 8–10 storybook plays + 1–2 contract checks).

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_m048_phase8_smoke.py` — NEW file; stubs for SC#1, SC#2, cache-key shape, idempotency
- [ ] Frontend extension to `frontend/src/stories/parcel/PotentieLayer.stories.tsx` (or split file `PotentieLayer.phase8.stories.tsx`) — Phase8 story prefix stubs for SC#3 + SC#4
- [ ] Helper extraction (optional): `_seed_venlo_woonvisie(test_db, org, user)` — relocate from `test_rescore_cascade_job.py:_seed_policy_doc` to `tests/factories.py` IF planner wants reuse
- [ ] Helper constant: `_VENLO_BLERICK_CENTRUM_PAYLOAD` — single source of truth for the Phase-6 Blerick-vs-Venlo-Centrum WoonvisiePayload (today duplicated in `test_woonvisie_match.py`)

**No framework install required.** No new dependencies.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live-backend pin survival across hard refresh (Cmd+Shift+R) | TEST-08 / SC#4-human | Storybook only proves component-level remount survival; persistent backend roundtrip + browser cache invalidation cannot be Storybook-tested | 1. `make dev` running on `:9300`; 2. open ParcelDetailModal for any Venlo parcel; 3. pin 3 factors on Potentie tab; 4. Cmd+Shift+R; 5. assert pinned 3 factors visible on page 1; 6. navigate to a different parcel; 7. assert pins still visible on page 1 |
| Visual smoke (Aura conform) | TEST-08 / SC#5-design | Component-level snapshot tests don't catch DESIGN.md drift | dev-server screenshot of ParcelDetailModal Potentie tab → confirm Morning Mist canvas, Pure Glass surfaces, Plus Jakarta Sans, no design-token violations |

---

## Validation Sign-Off

- [ ] All tasks have automated verify command OR Wave 0 dependency listed
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING file references
- [ ] No watch-mode flags (Storybook + pytest run-once only)
- [ ] Feedback latency < 60s per task
- [ ] `nyquist_compliant: true` set in frontmatter once planner finalizes per-task map

**Approval:** pending
