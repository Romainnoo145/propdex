---
phase: 72-parcel-detail-redesign
verified: 2026-03-03T08:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 72: Parcel Detail Panel Redesign Verification Report

**Phase Goal:** Parcel detail panel shows three real data bars instead of abstract scores with "onbekend" placeholders
**Verified:** 2026-03-03
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| #  | Truth                                                                                          | Status     | Evidence                                                                                                      |
|----|-----------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------|
| 1  | "Bebouwbaarheid" replaced by "Vrije ruimte" showing real unbuilt % from pand_oppervlakte_m2  | VERIFIED   | ParcelDetailModal.tsx line 391: `label="Vrije ruimte"`, lines 294-300: reads `pand_oppervlakte_m2` from `building_metrics`, computes `(1 - pandOppervlaktM2 / parcel.area_m2) * 100` |
| 2  | "Leegstandsrisico" renamed to "Beschikbaarheid" with vacancy_confidence + top reason          | VERIFIED   | ParcelDetailModal.tsx line 402: `label="Beschikbaarheid"`, lines 303-308: `vacancy_confidence * 100`, strips `HARD:`/`PROXY:` prefixes via regex |
| 3  | "Transformatiepotentie" shows weighted bouwjaar + bestemming + perceelgrootte                 | VERIFIED   | ParcelDetailModal.tsx lines 97-131: `deriveTransformatiePotentie()` with 40/40/20 formula; line 407: `label="Transformatiepotentie"` |
| 4  | All FAR/TAR references removed from ParcelDetailModal and InspectorPanel                      | VERIFIED   | `grep -n "FAR\|TAR\|Planruimte\|Bouwruimte"` across all three files returns zero matches |
| 5  | No "onbekend" placeholders for FAR/TAR — section removed entirely                             | VERIFIED   | `grep -n "formatPlanruimteLabel\|deriveBuildabilityScore\|Planruimte (FAR"` returns zero matches; JSX section confirmed removed |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                                    | Expected                                      | Status     | Details                                                                                   |
|-------------------------------------------------------------|-----------------------------------------------|------------|-------------------------------------------------------------------------------------------|
| `backend/app/jobs/area_scan.py`                             | pand_oppervlakte_m2 capture in scan pipeline  | VERIFIED   | 5-tuple return on all 4 paths (lines 179, 183, 220, 228); accumulator at line 190, 205; merge into `final_bm` at lines 512-514 |
| `backend/tests/unit/test_area_scan.py`                      | Updated tests for 5-tuple return              | VERIFIED   | 4 tests updated (lines 52, 82, 111, 144); new accumulation test at line 144 asserts `pytest.approx(31, abs=1.0)`; 6 passed, 0 failed |
| `frontend/src/components/results/ParcelDetailModal.tsx`     | Three real data pillar bars                   | VERIFIED   | Contains "Vrije ruimte", "Beschikbaarheid", "Transformatiepotentie"; `deriveTransformatiePotentie()` function present; ScoreDonut preserved |
| `frontend/src/components/layout/InspectorPanel.tsx`         | Cleaned — no Bouwruimte Delta section         | VERIFIED   | Zero matches for FAR, TAR, `deriveBuildabilityForInspector`, `toMetricNumber`, `Bouwruimte` |
| `frontend/src/components/results/ParcelCard.tsx`            | Cleaned — no buildability subscore            | VERIFIED   | Zero matches for `extractScoreSubscores`, `subscores`, `buildability`                    |

### Key Link Verification

| From                                                       | To                                         | Via                                          | Status     | Details                                                                     |
|------------------------------------------------------------|--------------------------------------------|----------------------------------------------|------------|-----------------------------------------------------------------------------|
| `_derive_bag_attributes_for_parcel`                        | `_upsert_parcel_cache`                     | 5-tuple unpacking                            | WIRED      | Line 845: `has_pand, bouwjaar, pand_status, address_lookup_xy, pand_oppervlakte_m2 = _derive_bag_attributes_for_parcel(...)` |
| `_upsert_parcel_cache`                                     | `scored_parcels` / area_scan_job Phase 3   | 3-tuple return threaded into 12-element list | WIRED      | Line 894: `return parcel, address_lookup_xy, pand_oppervlakte_m2`; line 413-434: unpacked and appended |
| `scored_parcels`                                           | `ScanResult.flags.building_metrics`        | Phase 4 `final_bm` merge                    | WIRED      | Lines 512-514: `final_bm["pand_oppervlakte_m2"] = pand_oppervlakte_m2`; line 515+: `"building_metrics": final_bm` |
| `_batch_resolve_addresses` call site                       | 12-element tuple unpacking                 | `_pom` splat variable                        | WIRED      | Line 569: `for p, _s, _cat, _f, _vsub, _bsub, _ver, _vs, _os, _bm, c, _pom in address_targets` |
| `ParcelDetailModal.tsx`                                    | `ScanResultItem.building_metrics`          | `pand_oppervlakte_m2` read                   | WIRED      | Lines 294-296: optional-chain cast `(parcel.building_metrics as {...})?.pand_oppervlakte_m2 ?? null` |
| `ParcelDetailModal.tsx`                                    | `ScanResultItem.vacancy_confidence`        | `vacancy_confidence * 100`                   | WIRED      | Lines 303-305: `Math.round(parcel.vacancy_confidence * 100)`               |
| `ParcelDetailModal.tsx`                                    | `deriveTransformatiePotentie`              | `bouwjaar + bestemming + area_m2`            | WIRED      | Lines 311-313: called with `parcel.bouwjaar, supportsResidentialMixed, parcel.area_m2` |

### Requirements Coverage

| Requirement | Source Plans     | Description                                            | Status        | Evidence                                                  |
|-------------|-----------------|--------------------------------------------------------|---------------|-----------------------------------------------------------|
| UX-01       | 72-01, 72-02    | Real data pillar bars replacing abstract FAR/TAR scores | SATISFIED     | All five success criteria verified in codebase; commits 5b26f6b, b53ecfa, 3cc1e9c, 96b194d confirmed |

**Note on UX-01 in REQUIREMENTS.md:** UX-01 is referenced in ROADMAP.md Phase 72 but does not appear in REQUIREMENTS.md (which remains titled "v9.0 — Risk Intelligence" covering WKB/BODEM/DOSSIER requirements). This is an administrative gap — REQUIREMENTS.md has not been updated to include v10.0 UX Polish requirements. The requirement is defined and traced in ROADMAP.md; implementation is fully verified. This does not block phase goal achievement.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| ParcelDetailModal.tsx | 94 | `return null` | Info | Expected — `deriveVacancyScore()` fallback returns null when no signal data available. Function is kept but result voided (`void vacancyPillar`) — deliberate design decision documented in SUMMARY |
| ParcelDetailModal.tsx | 271 | `return null` | Info | Guard clause — returns null when `parcel` prop is undefined. Standard React pattern |
| ParcelDetailModal.tsx | 619 | `return null` | Info | Guard clause — returns null when modal is not open. Standard React pattern |

No blockers or warnings found.

### Human Verification Required

#### 1. Vrije ruimte bar rendering with real scan data

**Test:** Open the app, run a scan or load a saved scan result, click on a parcel that has been scanned with Phase 72 backend (post-2026-03-03 scan). Open the ParcelDetail modal.
**Expected:** "Vrije ruimte" bar shows a percentage and context text like "42 m2 bebouwd". Older scans (pre-Phase-72) show "Footprint onbekend" or "--".
**Why human:** pand_oppervlakte_m2 requires a live or recorded scan result in the DB; can't verify DB contents programmatically.

#### 2. Beschikbaarheid prefix stripping

**Test:** Find a parcel with a `vacancy_reasons` array containing values prefixed with "HARD:" or "PROXY:". Open the modal.
**Expected:** Context text below the "Beschikbaarheid" bar shows the reason without the prefix (e.g., "Leegstandsdatabase signaal" not "HARD: Leegstandsdatabase signaal").
**Why human:** Requires live data with HARD:/PROXY: prefixed reasons in the DB.

#### 3. Transformatiepotentie label rendering

**Test:** Open a parcel with a known bouwjaar (e.g., 1975) and a wonen/gemengd bestemming. Open the modal.
**Expected:** "Transformatiepotentie" bar shows score ~85 and context label "Bouwjaar 1975 · wonen ok".
**Why human:** Requires specific parcel data to validate label composition.

### Gaps Summary

No gaps found. All five success criteria are implemented, wired, and tested. The phase goal is fully achieved.

---

## Commits Verified

| Commit  | Task                                                          | Files                                    |
|---------|---------------------------------------------------------------|------------------------------------------|
| 5b26f6b | feat(72-01): extend scan pipeline to capture pand_oppervlakte_m2 | backend/app/jobs/area_scan.py        |
| b53ecfa | feat(72-01): update unit tests for 5-tuple return signature   | backend/tests/unit/test_area_scan.py     |
| 3cc1e9c | feat(72-02): rewrite ParcelDetailModal pillar bars with real data | frontend/src/components/results/ParcelDetailModal.tsx |
| 96b194d | feat(72-02): clean up FAR/TAR dead code from InspectorPanel and ParcelCard | frontend/src/components/layout/InspectorPanel.tsx, frontend/src/components/results/ParcelCard.tsx |

## Quality Checks

- `python -m pytest backend/tests/unit/test_area_scan.py -x -v` — 6 passed, 0 failed
- `cd frontend && npm run check` — 0 errors, 524 warnings (pre-existing, none from Phase 72 changes)
- FAR/TAR grep across all three modified frontend files — 0 matches

---

_Verified: 2026-03-03T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
