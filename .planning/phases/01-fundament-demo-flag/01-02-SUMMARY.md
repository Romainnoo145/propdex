---
phase: 01-fundament-demo-flag
plan: 02
subsystem: backend-auth
tags: [hauzer-demo, organization-model, alembic, auth-me, design-docs]
dependency_graph:
  requires: [01-00]
  provides: [Organization.hauzer_demo, GET /api/auth/me hauzer_demo field]
  affects: [frontend auth context, S03/S04/S05 mock-surface gating]
tech_stack:
  added: []
  patterns: [expose_score_internals mirror pattern, scalar flag-read in get_me]
key_files:
  created:
    - backend/alembic/versions/20260521_m052_s01_add_org_hauzer_demo.py
  modified:
    - backend/app/models/organization.py
    - backend/app/auth/schemas.py
    - backend/app/auth/router.py
    - backend/app/main.py
    - DESIGN.md
key_decisions:
  - "hauzer_demo scalar query inside get_me only (not eager-loaded in get_current_user) to avoid org-fetch overhead on every authenticated request"
  - "mount auth_router at /api prefix in addition to /auth to satisfy frontend /api/auth/* contract without breaking existing tests (Rule 3 auto-fix)"
  - "UserResponse.hauzer_demo default=False ensures model_validate(current_user) succeeds before explicit scalar assignment (Pitfall 2 from RESEARCH)"
metrics:
  duration: "7m 12s"
  completed_date: "2026-05-21"
  tasks: 3
  files_changed: 5
requirements_addressed: [DEMO-01, DEMO-03]
---

# Phase 01 Plan 02: HAUZER_DEMO Flag + /me Field Summary

Per-org `hauzer_demo` boolean added to Organization model, surfaced on `GET /api/auth/me` as a scalar query in `get_me`. DESIGN.md corrected to reflect makelaars as an in-market segment.

## Objective

Add the HAUZER_DEMO isolation flag: a per-org boolean on Organization, surfaced through GET /api/auth/me so the frontend can gate mock surfaces (DASH-04, MATCH-01, NAV-04, CONTACT-02-send) with zero extra round-trips. Multi-tenant correctness is the load-bearing requirement.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Organization.hauzer_demo column + Alembic migration | dc8f7ed1 | organization.py, 20260521_m052_s01_add_org_hauzer_demo.py |
| 2 | Surface hauzer_demo on GET /api/auth/me | 2913b019 | schemas.py, router.py, main.py |
| 3 | DESIGN.md makelaars-correctie (DEMO-03) | e73da2e0 | DESIGN.md |

## Decisions Made

1. **Scalar query in get_me only**: `Organization.hauzer_demo` is read via a single `SELECT hauzer_demo FROM organizations WHERE id = current_user.organization_id` inside `get_me`. This does NOT touch `get_current_user` or the dependency chain (running on every request). Overhead is one lightweight scalar query on the `/me` endpoint only.

2. **Auth router dual-mount (Rule 3 auto-fix)**: The parallel Plan 01-00 wrote `test_me_returns_hauzer_demo_false` calling `/api/auth/me`, matching the frontend contract (`API_BASE = '/api/auth'` in `frontend/src/lib/auth/api.ts`). The auth router was previously mounted only at `/auth` (inconsistent with all other `/api/*` routers). Fix: add `app.include_router(auth_router, prefix="/api")` alongside the existing unprefixed include. Both URLs now work; existing tests keep passing.

3. **UserResponse.hauzer_demo = False default**: Default ensures `model_validate(current_user)` succeeds (User ORM has no hauzer_demo field), then the field is overwritten with the scalar result. This is the documented Pitfall 2 from the plan research.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Auth router URL mismatch — /api/auth/me not routable**
- **Found during:** Task 2 test execution
- **Issue:** `test_me_returns_hauzer_demo_false` called `/api/auth/me` (404) because auth_router prefix is `/auth` without `/api/`. Frontend also calls `/api/auth/me`. Other routers (scans, properties, etc.) use `/api/` natively.
- **Fix:** Added `app.include_router(auth_router, prefix="/api")` in main.py (keeping unprefixed include for backward compat with existing test suite). Both `/auth/me` and `/api/auth/me` now resolve.
- **Files modified:** backend/app/main.py
- **Commit:** 2913b019

## Verification Results

- `test_me_returns_hauzer_demo_false` PASSED (GREEN — was RED in Wave 0)
- `test_hauzer_demo_multi_tenant_isolation` PASSED (GREEN — was RED in Wave 0)
- Alembic single head = `20260521_m052_s01` (confirmed)
- Ruff clean on all modified files
- `! grep -q "NIET onze markt" DESIGN.md` confirmed

## Self-Check: PASSED

All files exist. All commits verified.

| Item | Status |
|------|--------|
| backend/app/models/organization.py | FOUND |
| backend/alembic/versions/20260521_m052_s01_add_org_hauzer_demo.py | FOUND |
| backend/app/auth/schemas.py | FOUND |
| backend/app/auth/router.py | FOUND |
| DESIGN.md | FOUND |
| Commit dc8f7ed1 (Task 1) | FOUND |
| Commit 2913b019 (Task 2) | FOUND |
| Commit e73da2e0 (Task 3) | FOUND |
