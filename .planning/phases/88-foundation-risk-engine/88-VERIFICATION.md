---
phase: 88-foundation-risk-engine
verified: 2026-03-10T01:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
must_haves:
  truths:
    - "User sees foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND) derived from bouwjaar x bodemtype for any parcel"
    - "User sees combined Fysiek Risicoprofiel summary aggregating foundation, soil, asbest, and contamination risks"
    - "User sees KCAF reference cost range for foundation repair when risk is hoog or middel"
    - "Foundation risk for post-1970 buildings is always LAAG regardless of soil type"
    - "Missing soil data results in ONBEKEND risk, never LAAG"
    - "KCAF cost indication always includes prominent disclaimer text"
  artifacts:
    - path: "backend/app/services/foundation_risk_engine.py"
      provides: "assess_foundation_risk(), estimate_kcaf_cost(), build_fysiek_risico_profiel()"
    - path: "backend/app/schemas/fysiek_risico.py"
      provides: "FoundationRisk, KCAFCostIndication, FysiekRisicoProfiel schemas"
    - path: "backend/app/schemas/property.py"
      provides: "fysiek_risico_profiel field on PropertyReportResponse"
    - path: "backend/app/services/property_aggregator.py"
      provides: "Foundation risk wiring after asyncio.gather post-processing"
  key_links:
    - from: "backend/app/services/property_aggregator.py"
      to: "backend/app/services/foundation_risk_engine.py"
      via: "import and call after gather results processed"
    - from: "backend/app/services/foundation_risk_engine.py"
      to: "backend/app/schemas/fysiek_risico.py"
      via: "returns FoundationRisk and FysiekRisicoProfiel instances"
    - from: "backend/app/schemas/property.py"
      to: "backend/app/schemas/fysiek_risico.py"
      via: "import FysiekRisicoProfiel for PropertyReportResponse field"
---

# Phase 88: Foundation Risk Engine Verification Report

**Phase Goal:** User sees a foundation risk rating with cost indication derived from building age, soil type, and area context
**Verified:** 2026-03-10T01:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND) derived from bouwjaar x bodemtype | VERIFIED | `assess_foundation_risk()` implements full decision matrix: pre-1970 + klei/veen = hoog, leem = middel, zand = laag, post-1970 = laag, missing data = onbekend. Returns `FoundationRisk` with Dutch `reden` text. |
| 2 | User sees combined Fysiek Risicoprofiel summary aggregating foundation, soil, asbest, and contamination | VERIFIED | `build_fysiek_risico_profiel()` composes all sub-risks. `FysiekRisicoProfiel` schema has `overall_risk`, `overall_explanation`, and fields for all four sub-components. Worst-of logic in `_derive_overall_risk()`. |
| 3 | User sees KCAF reference cost range when risk is hoog or middel | VERIFIED | `estimate_kcaf_cost()` returns `KCAFCostIndication` with 700-1000 EUR/m2 for hoog, 400-700 EUR/m2 for middel, None for laag/onbekend. Total cost calculated from oppervlakte_m2. |
| 4 | Foundation risk for post-1970 buildings is always LAAG | VERIFIED | Line 69: `if bouwjaar >= 1970: return FoundationRisk(risk="laag", ...)` -- unconditional, ignores soil type. |
| 5 | Missing soil data results in ONBEKEND risk, never LAAG | VERIFIED | Line 82: `if soil_profile is None or soil_profile.dominant_type == "onbekend": return FoundationRisk(risk="onbekend", ...)` for pre-1970 buildings. Line 59: no building/bouwjaar = onbekend. |
| 6 | KCAF cost indication always includes prominent disclaimer | VERIFIED | `KCAFCostIndication.disclaimer` built dynamically with per-m2 range, BAG oppervlakte note, and "Dit is geen offerte" text (line 173). `FoundationRisk.disclaimer` default includes "Geen vervanging voor een gecertificeerd funderingsonderzoek." |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/foundation_risk_engine.py` | Pure functions: assess, estimate, build | VERIFIED | 258 lines, 3 public functions + 1 private helper. All synchronous, no I/O. |
| `backend/app/schemas/fysiek_risico.py` | FoundationRisk, KCAFCostIndication, FysiekRisicoProfiel | VERIFIED | 201 lines, all 3 schemas present with Literal types and Field descriptions. model_rebuild() for circular import resolution. |
| `backend/app/schemas/property.py` | fysiek_risico_profiel field | VERIFIED | Line 566: `fysiek_risico_profiel: FysiekRisicoProfiel \| None = Field(...)` on PropertyReportResponse. Import at line 14. |
| `backend/app/services/property_aggregator.py` | Foundation risk wiring | VERIFIED | Lines 1072-1087: calls assess_foundation_risk, estimate_kcaf_cost, build_fysiek_risico_profiel. Line 1375: passes fysiek_risico_profiel to PropertyReportResponse constructor. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| property_aggregator.py | foundation_risk_engine.py | import + call | WIRED | Import at line 49-53, calls at lines 1072/1077/1081. |
| foundation_risk_engine.py | fysiek_risico.py | returns schema instances | WIRED | Imports FoundationRisk, KCAFCostIndication, FysiekRisicoProfiel at line 19-26. Constructs instances throughout. |
| property.py | fysiek_risico.py | import for response field | WIRED | Import at line 14: `from app.schemas.fysiek_risico import FunderingsrisicogebiedData, FysiekRisicoProfiel, SoilProfile`. Field at line 566. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FUND-01 | 88-01-PLAN | User sees foundation risk rating (HOOG/MIDDEL/LAAG/ONBEKEND) derived from bouwjaar x bodemtype heuristic | SATISFIED | `assess_foundation_risk()` implements full decision matrix with Dutch reden text |
| FUND-02 | 88-01-PLAN | User sees combined Fysiek Risicoprofiel summary with traffic-light rating and Dutch-language explanation | SATISFIED | `FysiekRisicoProfiel` schema with `overall_risk` and `overall_explanation`, composed by `build_fysiek_risico_profiel()` |
| FUND-03 | 88-01-PLAN | User sees KCAF reference cost range for foundation repair based on pand footprint and risk level | SATISFIED | `estimate_kcaf_cost()` returns cost range with disclaimers, wired through aggregator |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | -- | -- | -- | No anti-patterns found in any modified file |

### Human Verification Required

### 1. End-to-end API Response

**Test:** Query a pre-1970 property on clay soil via the property aggregator endpoint and inspect the `fysiek_risico_profiel` field in the JSON response.
**Expected:** Response includes `fysiek_risico_profiel` with `overall_risk`, `foundation_risk.risk = "hoog"`, `kcaf_cost` with EUR range, and all disclaimer texts.
**Why human:** Requires running backend with database and external API dependencies to verify full aggregation pipeline.

### 2. Circular Import Stability

**Test:** Start the backend server and hit any property endpoint.
**Expected:** No ImportError or Pydantic validation errors. `model_rebuild()` resolves forward refs correctly at runtime.
**Why human:** Circular import issues may only surface under specific import orderings in production.

### Gaps Summary

No gaps found. All 6 observable truths verified, all 4 artifacts substantive and wired, all 3 key links confirmed, all 3 requirements satisfied. The phase delivers a complete foundation risk engine with decision matrix, KCAF cost ranges, and combined FysiekRisicoProfiel -- all wired into PropertyReportResponse via the property aggregator.

Commits verified: `157778b` (schemas + engine) and `2518e0c` (aggregator wiring). Completeness score denominator unchanged at 11.

---

_Verified: 2026-03-10T01:00:00Z_
_Verifier: Claude (gsd-verifier)_
