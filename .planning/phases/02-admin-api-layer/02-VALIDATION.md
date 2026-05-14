---
phase: 2
slug: admin-api-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 02-RESEARCH.md §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 8.x + pytest-asyncio + httpx 0.27 (AsyncClient + ASGITransport) |
| **Config file** | `backend/pyproject.toml` (pytest section) + `backend/tests/conftest.py` |
| **Quick run command** | `cd backend && pytest tests/integration/test_admin_data_sources_router.py -x` |
| **Full suite command** | `cd backend && pytest tests/ -x` |
| **Estimated runtime** | ~10s for slice tests, ~90s full suite (275+ existing tests) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && pytest tests/integration/test_admin_data_sources_router.py -x`
- **After every plan wave:** Run `cd backend && pytest tests/ -x`
- **Before `/gsd:verify-work`:** Full suite must be green + manual `time.perf_counter()` <300ms
- **Max feedback latency:** ~10 seconds (slice tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-W0-01 | 01 | 0 | TEST-02 | scaffold | Wave-0 RED tests written + import errors expected | ❌ W0 | ⬜ pending |
| 2-W0-02 | 01 | 0 | API-01 | scaffold | `gemeente_name_lookup.py` stub raises NotImplementedError | ❌ W0 | ⬜ pending |
| 2-01-01 | 01 | 1 | API-01 | integration | `pytest -k test_get_gemeente_sources_200_full_catalog -x` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | API-01 | integration | `pytest -k test_get_gemeente_sources_200_status_mix -x` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | API-01 | integration | `pytest -k test_get_gemeente_sources_404_unknown_code -x` | ❌ W0 | ⬜ pending |
| 2-01-04 | 01 | 1 | API-01 | integration | `pytest -k test_get_gemeente_sources_422_malformed_code -x` | ❌ W0 | ⬜ pending |
| 2-01-05 | 01 | 1 | API-02 | integration | `pytest -k test_list_gemeenten_200_aggregate_counts -x` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | API-03 | integration | `pytest -k test_refresh_200_status_flips_to_live -x` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | API-03 | integration | `pytest -k test_refresh_idempotent_no_op_on_unchanged -x` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | API-03 | integration | `pytest -k test_refresh_concurrent_calls_one_wins_lock -x` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 2 | API-03 | integration | `pytest -k test_refresh_404_unknown_source_key -x` | ❌ W0 | ⬜ pending |
| 2-02-05 | 02 | 2 | API-03 | integration | `pytest -k test_refresh_type_b_stub_returns_not_applicable -x` and `::test_refresh_type_c_stub_returns_missing` | ❌ W0 | ⬜ pending |
| 2-02-06 | 02 | 2 | API-05 | integration | `pytest -k test_all_endpoints_403_for_regular_user -x` | ❌ W0 | ⬜ pending |
| 2-02-07 | 02 | 2 | API-05 | integration | `pytest -k test_all_endpoints_401_without_token -x` | ❌ W0 | ⬜ pending |
| 2-02-08 | 02 | 2 | TEST-02 | integration | `pytest -k test_catalog_drift_orphan_row -x` | ❌ W0 | ⬜ pending |
| 2-02-09 | 02 | 2 | Perf | integration | `pytest -k test_get_gemeente_sources_under_300ms -x` (inline `time.perf_counter()`) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/integration/test_admin_data_sources_router.py` — NEW FILE, all 15 tests written in RED state (imports `app.admin.data_sources_router` which doesn't exist yet)
- [ ] `backend/app/services/gemeente_name_lookup.py` — NEW FILE, stub raises NotImplementedError; real implementation in Wave 1 extracts `_gemeente_name_map` from `policy_documents/service.py:332`
- [ ] Existing `backend/tests/integration/test_admin_data_sources_rbac.py` (S01 placeholder) — deprecated in Wave 0, deleted in Wave 2 once new router tests green
- [ ] No framework install needed — pytest, httpx, pytest-asyncio reeds geconfigureerd

---

## Detection Thresholds

- **Regression:** any test in `test_admin_data_sources_router.py` failing → block merge
- **Perf:** GET endpoint >300ms met 50 catalog + 50 DB rows → block merge, investigate query plan
- **Coverage:** alle 15 test cases moeten aanwezig zijn (`pytest --collect-only`)

---

## Reconstruction Fidelity

Test suite reconstructs het volledige API-contract:
- Auth/RBAC (403/401)
- Path validation (422 + 404)
- Payload composition (full catalog rendered + status mix)
- Probe registry dispatch (A/B/C all exercised)
- Idempotency (lock + compare-and-update)
- Concurrency (advisory lock contention — LOW confidence, needs Wave 0 spike)
- Catalog drift (DB-row niet in catalog)
- Performance bound (<300ms)

**Missing from automation (acceptabel voor Phase 2):**
- Load-test onder honderden concurrent refreshes — deferred, advisory lock schaalt theoretisch
- Real Type B / Type C live probes — stubs only by design (latere slices/milestones)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OpenAPI schema render | API-01/02/03 | Visual confirmation of generated docs | Start backend, browse `/docs`, verify alle 4 endpoints met response_model schemas |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (router file + service module)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 RED tests committed

**Approval:** pending
