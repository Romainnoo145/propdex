---
phase: 1
slug: cache-sentinel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest >=7.4.0 + pytest-asyncio >=0.21.0 |
| **Config file** | `backend/pyproject.toml` (`[tool.pytest.ini_options]`) |
| **Quick run command** | `cd backend && python -m pytest tests/unit/test_factor_extraction_schemas.py -x -q` |
| **Full suite command** | `cd backend && python -m pytest tests/ -x -q` |
| **Estimated runtime** | ~30 seconds (quick) / ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && python -m pytest tests/unit/test_factor_extraction_schemas.py tests/unit/test_factor_extraction_service.py -x -q`
- **After every plan wave:** Run `cd backend && python -m pytest tests/ -x -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-T1 | 01-01 | 1 | CACHE-01 | unit | `pytest tests/unit/test_factor_extraction_schemas.py::test_schema_version_is_two -x` | ❌ rename needed | ⬜ pending |
| 1-01-T2a | 01-01 | 1 | TEST-01 | unit | `pytest tests/unit/test_factor_extraction_service.py::test_v1_cache_entry_is_miss -x` | ❌ Wave 0 | ⬜ pending |
| 1-01-T2b | 01-01 | 1 | TEST-01 | unit | `pytest tests/unit/test_factor_extraction_service.py::test_v2_cache_entry_is_hit -x` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_factor_extraction_service.py` — new file with v1-miss + v2-hit tests (Task 2)
- [ ] Rename `test_schema_version_starts_at_one` → `test_schema_version_is_two` (or update assertion) in `test_factor_extraction_schemas.py`

*Existing infrastructure (pytest, asyncio_mode="auto", test_db fixture) covers all phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
