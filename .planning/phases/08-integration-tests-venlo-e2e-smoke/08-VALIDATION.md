---
phase: 8
slug: integration-tests-venlo-e2e-smoke
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
revised: 2026-04-26
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

> Updated 2026-04-26 after revision: frontend Wave-0 stub task (T7) inserted; backend Wave-1 tasks shifted to T2–T5; frontend Wave-1 implementation tasks renumbered T8 + T9 (from T5 + T6 in the prior draft); regression gate is now T10. Every task with code-side acceptance lists its automated command + file.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-T1 | 01 | 0 | TEST-08 | infra (backend Wave-0 stubs) | `test -f backend/tests/integration/test_m048_phase8_smoke.py && grep -c 'pytest.fail.*Wave 0 stub' backend/tests/integration/test_m048_phase8_smoke.py` returns `4` | ❌ W0 | ⬜ pending |
| 8-01-T2 | 01 | 1 | TEST-08 / SC#1 | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_two_parcels_one_claude_call_via_cascade_boundary -x` | ❌ W0 | ⬜ pending |
| 8-01-T3 | 01 | 1 | TEST-08 / SC#2 | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_two_parcels_different_woonvisie_scores_via_cache -x` | ❌ W0 | ⬜ pending |
| 8-01-T4 | 01 | 1 | TEST-08 / cache-key | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_cache_key_uses_document_sentinel_and_schema_v4 -x` | ❌ W0 | ⬜ pending |
| 8-01-T5 | 01 | 1 | TEST-08 / idempotency | integration | `pytest backend/tests/integration/test_m048_phase8_smoke.py::test_second_cascade_call_is_idempotent -x` | ❌ W0 | ⬜ pending |
| 8-01-T6 | 01 | 1 | TEST-08 / contract | type-export | `grep -q 'export type WoonvisieMatchWaarde' frontend/src/lib/types/scan.ts && cd frontend && pnpm exec tsc -b --noEmit` | ✅ existing | ⬜ pending |
| 8-01-T7 | 01 | 0 | TEST-08 | infra (frontend Wave-0 stubs) | `grep -c 'export const Phase8' frontend/src/stories/parcel/PotentieLayer.stories.tsx` returns `>= 4` AND `cd frontend && pnpm exec vitest run --project=storybook -t Phase8 --reporter=verbose 2>&1 | grep -c 'Wave 0 stub'` returns `>= 4` (proves stubs fail loud) | ✅ existing (file extant; stubs to append) | ⬜ pending |
| 8-01-T8 | 01 | 1 | TEST-08 / SC#3 | storybook play | `pnpm exec vitest run --project=storybook -t Phase8WijkCitaatNotAlgemeen` AND `pnpm exec vitest run --project=storybook -t Phase8AlgemeenCitaatFallback` | ✅ existing | ⬜ pending |
| 8-01-T9 | 01 | 1 | TEST-08 / SC#4 | storybook play | `pnpm exec vitest run --project=storybook -t Phase8PinsPersistAcrossRemount` AND `pnpm exec vitest run --project=storybook -t Phase8PinnedSurvivesPageNav` | ✅ existing | ⬜ pending |
| 8-01-T10 | 01 | 2 | TEST-08 / SC#5 | regression | `cd backend && uv run pytest --tb=no -q` (gate = parsed-counters: `passed >= 1629` AND `failed <= 68`; pytest exit code is non-zero by virtue of 68 pre-existing failures — that's expected) AND `cd frontend && pnpm check && pnpm exec vitest run --project=storybook` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Note:** Final task IDs and counts are authoritative in `08-01-PLAN.md`. The 10 task IDs above (T1–T10) match the plan after the 2026-04-26 revision (frontend Wave-0 task inserted as T7; backend tasks unshifted; downstream Storybook impl + regression gate renumbered to T8/T9/T10).

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_m048_phase8_smoke.py` — NEW file; 4 stubs (one per: SC#1, SC#2, cache-key shape, idempotency) each calling `pytest.fail("Wave 0 stub — Wave 1 Task N implementation required")` (Task T1)
- [ ] `frontend/src/stories/parcel/PotentieLayer.stories.tsx` — append 4 NEW `Phase8*` Story exports whose `play` body throws `Error('Wave 0 stub — Wave 1 Task N implementation required')` (Task T7) — Nyquist stub-first parity with backend
- [ ] Helper extraction (optional): `_seed_venlo_woonvisie(test_db, org, user)` — relocate from `test_rescore_cascade_job.py:_seed_policy_doc` to `tests/factories.py` IF planner wants reuse → DEFERRED, inline in Phase 8 file per plan
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
- [ ] Wave 0 covers all MISSING file references (T1 backend stubs + T7 frontend stubs)
- [ ] No watch-mode flags (Storybook + pytest run-once only)
- [ ] Feedback latency < 60s per task
- [ ] `nyquist_compliant: true` set in frontmatter once planner finalizes per-task map

**Approval:** pending
