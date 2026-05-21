---
phase: 1
slug: fundament-demo-flag
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution (M052/S01).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest-asyncio 0.21+ (`asyncio_mode="auto"`) + vitest (frontend unit) |
| **Config file** | `backend/pyproject.toml` `[tool.pytest.ini_options]` · `frontend/vitest.config.*` |
| **Quick run command** | `cd backend && python -m pytest tests/integration/test_m052_s01_hauzer_demo.py tests/regression/test_m052_s01_project_type_rescore.py -x` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x --ignore=tests/eval` + `cd frontend && npm run check` |
| **Estimated runtime** | ~60-90 seconds backend quick · npm run check ~30s |

**Baseline note:** main is known-red — ~103 backend failures (pre-existing woonvisie/event-loop issue) + ~94 frontend tsc errors. Gate = **no NEW failures vs baseline**, not all-green.

---

## Sampling Rate

- **After every task commit:** Run quick command (backend targeted) + `cd frontend && npm run check`
- **After every plan wave:** Full backend suite + `npx vitest run --project unit`
- **Before `/gsd:verify-work`:** Full suite green relative to baseline (no new reds)
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| FUND-01 | HeartButton save success → picker shown → PUT project-type; NOT shown on un-favorite | Frontend unit | `npx vitest run --project unit src/hooks/__tests__/useToggleFavorite.test.ts` | ❌ W0 |
| FUND-02 | `PUT /project-type` enqueues rescore (best-effort) | Integration | `pytest tests/integration/test_m052_s01_hauzer_demo.py::test_put_project_type_enqueues_rescore -x` | ❌ W0 |
| FUND-02 | `rescore_parcel` passes stored `project_type` to `compute_score_v3` (iron-rule) | Regression | `pytest tests/regression/test_m052_s01_project_type_rescore.py -x` | ❌ W0 |
| DEMO-01 | `GET /auth/me` returns `hauzer_demo=false` for normal org | Integration | `pytest tests/integration/test_m052_s01_hauzer_demo.py::test_me_returns_hauzer_demo_false -x` | ❌ W0 |
| DEMO-01 | Two orgs: flagged org → true, other org → false (multi-tenant) | Regression | `pytest tests/regression/test_m052_s01_project_type_rescore.py::test_hauzer_demo_multi_tenant_isolation -x` | ❌ W0 |
| DEMO-03 | DESIGN.md line no longer marks makelaars as not-our-market | Static grep | `! grep -q "makelaars — NIET onze markt" DESIGN.md` | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_m052_s01_hauzer_demo.py` — DEMO-01 (`/me` hauzer_demo field) + FUND-02 (PUT project-type enqueues rescore)
- [ ] `backend/tests/regression/test_m052_s01_project_type_rescore.py` — iron-rule: `rescore_parcel` uses `project_type` from DB (not hardcoded "onbepaald"); multi-tenant hauzer_demo isolation
- [ ] `frontend/src/hooks/__tests__/useToggleFavorite.test.ts` — FUND-01: picker shown on save success, not on delete

*Existing `tests/integration/test_parcel_project_type_router.py` already covers the PUT/GET contract (5 tests) — no duplication.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Picker is Aura-conformant + readable on Morning Mist canvas | FUND-01 | Visual | localhost:9300 → save a parcel → screenshot picker before push (per project rule) |
| Headline score visibly shifts after choosing a non-onbepaald type | FUND-02 | End-to-end perception | Save parcel as `optoppen` → confirm potentie/risico changed vs `onbepaald` |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 stubs land)

**Approval:** pending
