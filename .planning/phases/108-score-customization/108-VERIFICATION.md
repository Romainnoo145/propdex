---
phase: 108-score-customization
verified: 2026-03-14T06:15:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to /instellingen/score and interact with all controls"
    expected: "Preset cards pre-fill all weights, balance slider updates percentage labels, factor toggles disable/enable weight dropdowns, save triggers polling with impact preview"
    why_human: "UI interactivity (Framer Motion, form state feedback) cannot be verified programmatically"
  - test: "Toggle a factor off (weight=0) and attempt to save with fewer than 3 active"
    expected: "Save button is disabled and warning message 'Minimaal 3 factoren moeten actief zijn' appears below factor table"
    why_human: "React form validation UX state requires browser interaction"
  - test: "Save custom weights and wait for re-score job to complete"
    expected: "Impact preview shows X percelen omhoog, Y omlaag, Z ongewijzigd with avg delta"
    why_human: "Requires live ARQ worker and database with scan_results to exercise end-to-end poll flow"
---

# Phase 108: Score Customization Verification Report

**Phase Goal:** Extend Score v3.0 engine with 4 environmental risk factors (natura2000, overstromingsrisico, geluid, luchtkwaliteit — 9 to 13 risicofactoren), fix overall formula to discount model, and add per-organization score weight customization via /instellingen/score settings.
**Verified:** 2026-03-14T06:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                     | Status     | Evidence                                                                                    |
|----|-------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------|
| 1  | 4 new environmental risk factors produce FactorResult with categorie=risico               | VERIFIED   | Functions at lines 855/900/945/994 in score_v3_factors.py; Python import + assert test PASS |
| 2  | Overall formula uses discount model: potentie x (1 - risico_discount) with 50% max cap   | VERIFIED   | Lines 180-185 in score_v3.py; compute_score_v3({}) returns 48.2 (not negative)              |
| 3  | Scores are always 0-100 under new formula (never negative)                                | VERIFIED   | `overall = max(0.0, min(100.0, overall))` at line 185; verified programmatically            |
| 4  | compute_score_v3 accepts optional custom_weights param                                    | VERIFIED   | Signature at line 89, _apply_custom_weights called at line 165; custom weights test PASS    |
| 5  | _RISICO_MAX updated to 87 matching 13 factor weights sum; DEFAULT_WEIGHTS exported         | VERIFIED   | Lines 50 and 56 in score_v3.py; Python assertion PASS                                       |
| 6  | Organization.score_weights JSONB column with Alembic migration                            | VERIFIED   | Line 38 in organization.py; migration a1b2c3d4e5f6 file exists on disk                     |
| 7  | GET/PUT /api/users/org/score-weights return weights and save with min-3 validation        | VERIFIED   | Lines 140/175/186-201 in users/router.py; validation logic confirmed                        |
| 8  | Re-score job enqueued on PUT and re-applies weights without calling compute_score_v3      | VERIFIED   | rescore_weights_job registered in worker.py; _rescore_from_breakdown helper tested PASS     |
| 9  | Re-score job returns impact summary (up/down/unchanged counts, avg_delta)                 | VERIFIED   | Return dict at end of rescore_weights_job with processed/up_count/down_count/avg_delta      |
| 10 | Min 3 active factors per category enforced by validation                                  | VERIFIED   | Backend: lines 193-201 router.py; Frontend: FactorTable minActive prop + ScoreSection check |
| 11 | /instellingen/score route accessible via tab nav                                          | VERIFIED   | Route file exists; SettingsTabNav on both instellingen.tsx and instellingen.score.tsx        |
| 12 | Preset cards pre-fill weights                                                             | VERIFIED   | PresetCards component wired to ScoreSection onPresetSelect handler                          |
| 13 | Balance slider present with visual feedback                                               | VERIFIED   | BalanceSlider component renders native range input with gradient + percentage labels         |
| 14 | Factor tables with toggle+weight controls for all 21 factors                             | VERIFIED   | FactorTable renders 8 potentie + 13 risico factors with checkbox and 1-10 dropdown          |
| 15 | Save triggers re-score with polling and impact preview                                    | VERIFIED   | useRescoreJobStatus polling hook; jobStatus.up_count rendered at line 205 in ScoreSection   |
| 16 | "Custom profiel" badge in parcel detail when org uses custom weights                      | VERIFIED   | ParcelBentoOverview lines 213-217; uses_custom_weights also in API response                 |
| 17 | Badge derived at read time, not stored per scan_result                                    | VERIFIED   | router.py lines 1811-1816: SELECT Organization.score_weights IS NOT NULL check              |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact                                                                 | Expected                                              | Status     | Details                                   |
|--------------------------------------------------------------------------|-------------------------------------------------------|------------|-------------------------------------------|
| `backend/app/services/score_v3_factors.py`                              | 4 new factor functions (score_natura2000 et al.)      | VERIFIED   | Functions at lines 855, 900, 945, 994     |
| `backend/app/services/score_v3.py`                                      | Discount formula, _RISICO_MAX=87, custom_weights      | VERIFIED   | All constants and helpers present         |
| `backend/app/models/organization.py`                                    | score_weights JSONB column                            | VERIFIED   | Line 38                                   |
| `backend/alembic/versions/a1b2c3d4e5f6_add_score_weights_to_organizations.py` | Migration ADD COLUMN score_weights JSONB        | VERIFIED   | File exists on disk                       |
| `backend/app/schemas/score_weights.py`                                  | 4 Pydantic models (Config, Request, Response, Status) | VERIFIED   | Lines 6/15/40/48                          |
| `backend/app/users/router.py`                                           | GET/PUT/job endpoints                                 | VERIFIED   | Lines 140/175/235                         |
| `backend/app/jobs/rescore_weights.py`                                   | rescore_weights_job + _rescore_from_breakdown         | VERIFIED   | Both functions present; helper tested     |
| `backend/app/jobs/worker.py`                                            | rescore_weights_job registered                        | VERIFIED   | Lines 23 (import) and 61 (functions list) |
| `frontend/src/lib/types/scoreWeights.ts`                                | TS types + POTENTIE_FACTORS + RISICO_FACTORS + PRESETS | VERIFIED  | 8 potentie, 13 risico factors, 4 presets  |
| `frontend/src/hooks/useScoreWeights.ts`                                 | useOrgScoreWeights + useSaveScoreWeights + poll hook  | VERIFIED   | 3 hooks at lines 31/54/79                 |
| `frontend/src/routes/_authenticated/instellingen.score.tsx`             | /instellingen/score route                             | VERIFIED   | File exists, renders ScoreSection + tabs  |
| `frontend/src/components/settings/SettingsTabNav.tsx`                   | Tab nav with Account and Score profiel                | VERIFIED   | useMatchRoute() active state at line 15   |
| `frontend/src/components/settings/ScoreSection.tsx`                     | Orchestrator with all sub-components + save+poll      | VERIFIED   | 241 lines, all sub-components composed    |
| `frontend/src/components/settings/PresetCards.tsx`                      | 4 preset cards                                        | VERIFIED   | 42 lines                                  |
| `frontend/src/components/settings/BalanceSlider.tsx`                    | Range slider 0.0-1.0                                  | VERIFIED   | 43 lines                                  |
| `frontend/src/components/settings/FactorTable.tsx`                      | Toggle + weight dropdown per factor                   | VERIFIED   | 102 lines, minActive validation           |
| `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx`     | Custom profiel badge                                  | VERIFIED   | Lines 213-217, conditional on is_custom   |
| `backend/app/scans/router.py`                                           | uses_custom_weights in parcel-at-point response       | VERIFIED   | Lines 1811-1843                           |

---

### Key Link Verification

| From                                         | To                                                 | Via                                    | Status   | Details                                             |
|----------------------------------------------|----------------------------------------------------|----------------------------------------|----------|-----------------------------------------------------|
| `score_v3.py`                                | `score_v3_factors.py`                              | import of 4 new factor functions       | WIRED    | Lines 119-127 import all 4; called at lines 154-157 |
| `users/router.py`                            | `jobs/rescore_weights.py`                          | arq_pool.enqueue_job rescore_weights   | WIRED    | Line 223 enqueues 'rescore_weights_job'             |
| `jobs/rescore_weights.py`                    | `models/organization.py`                           | reads org.score_weights                | WIRED    | Lines 183-187 load org and check score_weights      |
| `ScoreSection.tsx`                           | `useScoreWeights.ts`                               | useOrgScoreWeights + useSaveScoreWeights | WIRED  | Lines 5-6 import, lines 30+54 call hooks           |
| `useScoreWeights.ts`                         | `/api/users/org/score-weights`                     | apiFetch GET/PUT                       | WIRED    | Lines 37 (GET) and 60 (PUT) with correct path       |
| `ParcelBentoOverview.tsx`                    | `useScoreWeights.ts`                               | useOrgScoreWeights().data?.is_custom   | WIRED    | Lines 10 (import) and 124 (call), badge at 214      |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                      | Status      | Evidence                                                            |
|-------------|-------------|--------------------------------------------------------------------------------------------------|-------------|---------------------------------------------------------------------|
| SC-01       | 108-01      | 4 environmental risk factors in score_v3_factors.py                                              | SATISFIED   | Functions present and Python assertion test PASS                    |
| SC-02       | 108-01      | _RISICO_MAX=87, DEFAULT_WEIGHTS exported                                                          | SATISFIED   | Lines 50 and 56 score_v3.py verified                                |
| SC-03       | 108-01      | Discount formula with 50% max cap, default 70/30 balance                                         | SATISFIED   | Lines 181-185 score_v3.py; formula tested produces 0-100 range      |
| SC-04       | 108-02      | Per-org score_weights JSONB with Alembic migration                                               | SATISFIED   | organization.py line 38; migration file a1b2c3d4e5f6 exists         |
| SC-05       | 108-02      | GET/PUT /api/users/org/score-weights with min-3 validation                                       | SATISFIED   | 3 endpoints in users/router.py; validation lines 193-201            |
| SC-06       | 108-02      | Background ARQ re-score job (weights-only, no re-computation)                                    | SATISFIED   | rescore_weights_job reads genormaliseerde_score, skips compute_score_v3 |
| SC-07       | 108-01      | compute_score_v3 accepts custom_weights param                                                     | SATISFIED   | Signature line 89, _apply_custom_weights called at line 165         |
| SC-08       | 108-03      | /instellingen/score with preset cards, balance slider, factor tables, tab nav                    | SATISFIED   | All 8 frontend files created and wired                              |
| SC-09       | 108-03      | Save triggers async re-score with progress indicator and impact preview                          | SATISFIED   | useRescoreJobStatus polling + impact grid in ScoreSection           |
| SC-10       | 108-04      | "Custom profiel" badge in ParcelDetailPanel derived at read time                                 | SATISFIED   | Badge in ParcelBentoOverview; API read-time derivation in scans router |

All 10 requirement IDs from PLAN frontmatter accounted for. No orphaned requirements found in REQUIREMENTS.md for Phase 108.

---

### Anti-Patterns Found

| File                                          | Line | Pattern               | Severity | Impact                                                                                   |
|-----------------------------------------------|------|-----------------------|----------|------------------------------------------------------------------------------------------|
| `backend/app/services/score_v3_factors.py`   | 468  | Unused variable `kort_labels` (ruff F841) | Warning | Pre-existing before phase 108; noted in SUMMARY as out-of-scope. No runtime impact. |
| `backend/app/services/score_v3_factors.py`   | 532  | f-string backslash escape (ruff invalid-syntax for Python 3.11) | Warning | Pre-existing before phase 108; noted in SUMMARY. No impact if runtime is Python 3.12+. |
| `backend/app/scans/router.py`                | 1237 | Unused import `asyncio` (ruff F401) | Info | In get_parcel_at_point, pre-existing. No runtime impact.                               |
| `backend/app/jobs/rescore_weights.py`        | 326  | File is 326 lines (limit: 300) | Info | New file created in phase 108. Exceeds global 300-line convention by 26 lines. All lines are substantive logic. |

No blocker anti-patterns found. All issues are pre-existing lint warnings or a minor file-length deviation.

---

### Human Verification Required

#### 1. Score Settings Page — Full Interaction Flow

**Test:** Navigate to /instellingen/score in a browser. Select each of the 4 preset cards and verify weights pre-fill. Drag the balance slider and observe percentage labels updating. Toggle individual factors off and confirm weight dropdown becomes disabled.
**Expected:** Preset selection populates all potentie and risico weight dropdowns correctly. Slider shows "X% Potentie / Y% Risico" labels updating in real time. Toggling off a factor sets its weight to 0 and disables the dropdown.
**Why human:** React state interactivity and visual feedback cannot be verified by static code analysis.

#### 2. Min-3 Validation Warning

**Test:** In /instellingen/score, toggle off 6 or more potentie factors (leaving only 2 active). Check if save button becomes disabled and warning text appears.
**Expected:** Save button is disabled. FactorTable shows "Minimaal 3 factoren moeten actief zijn" in red below the table.
**Why human:** Requires React form state interactions.

#### 3. End-to-End Save and Impact Preview

**Test:** With ARQ worker running and an organization with existing v3.0 scan_results, save a custom weight config. Poll until job completes. Observe impact preview.
**Expected:** Impact preview grid appears below save button showing percelen counts (up/down/unchanged) and average delta. Badge "Custom profiel" appears in the parcel detail panel.
**Why human:** Requires live ARQ worker, database with scan_results, and real scan data with score_model_version='score-v3.0' in flags.

---

### Gaps Summary

No gaps found. All automated checks pass.

---

## Summary

Phase 108 goal is fully achieved. The Score v3.0 engine now has 21 factors (8 potentie + 13 risico), the discount formula keeps all scores 0-100, and per-organization weight customization is implemented end-to-end: JSONB storage, GET/PUT API with validation, background ARQ re-score job, and a complete /instellingen/score settings UI with preset cards, balance slider, factor tables, and impact preview. The "Custom profiel" badge correctly derives org weight state at read time.

Pre-existing lint issues in score_v3_factors.py (F841, f-string backslash, import sort) predate phase 108 and were explicitly noted as out-of-scope in the SUMMARY. The rescore_weights.py file is 26 lines over the 300-line convention but contains only substantive logic.

---

_Verified: 2026-03-14T06:15:00Z_
_Verifier: Claude (gsd-verifier)_
