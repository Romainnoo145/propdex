---
phase: 90-frontend-fysiek-risicoprofiel
verified: 2026-03-10T12:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 90: Frontend Fysiek Risicoprofiel Verification Report

**Phase Goal:** User sees all physical risk data in a cohesive section in ParcelDetailModal with appropriate confidence indicators
**Verified:** 2026-03-10T12:00:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees Fysiek Risicoprofiel section in ParcelDetailModal with sub-cards for bodem, fundering, asbest, and verontreiniging | VERIFIED | FysiekRisicoprofielSection.tsx renders 4 sub-cards (Fundering, Bodemtype, Asbest, Bodemkwaliteit) at line 105-214; ParcelDetailModal.tsx integrates it at line 618-623 |
| 2 | All risk indicators display amber confidence badges with source attribution and "indicatief" disclaimers -- never red/definitive | VERIFIED | getRiskBadgeClasses() uses amber-500 and grey-800 only (lines 5-16); "indicatief" badge at lines 72-74 and 100-102; no red/green colors in component |
| 3 | Area scan map tiles color parcels by foundation risk level alongside existing opportunity score | VERIFIED | tile_proxy.py CASE expression at line 131-136 derives foundation_risk_level from bouwjaar; ParcelScoreLayer.tsx foundation risk fill layer at lines 220-245 with amber/slate colors |
| 4 | Risk derivation is transparent -- user can see why a rating was assigned | VERIFIED | foundation_risk.reden rendered at line 117; asbest_indicator.reden at line 171; gebruiksdoel_factor appended at line 172-173 |
| 5 | Risk data loads on-demand when modal opens | VERIFIED | useParcelRiskProfile hook called with enabled: isOpen && !!parcel?.parcel_id (ParcelDetailModal.tsx line 354-356); staleTime 5min |
| 6 | User can toggle foundation risk overlay from layer toggle menu | VERIFIED | MAP_LAYER_CATALOG entry at layers.ts line 49; LayerToggle reads overlay at index 5 (line 205); map.tsx handler at line 1903 calls setParcelFoundationRiskVisibility |
| 7 | Pre-1970 parcels show distinct coloring from post-1970 parcels | VERIFIED | SQL CASE: bouwjaar < 1970 = 'hoog', < 1990 = 'middel', else 'laag' (tile_proxy.py lines 132-136); frontend match expression maps hoog=#f59e0b, middel=#fbbf24, laag=#64748b (ParcelScoreLayer.tsx lines 233-238) |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/scans/router.py` | GET /api/scans/parcels/{id}/risk-profile endpoint | VERIFIED | Endpoint at line 1166, JWT auth + rate limit, parallel asyncio.gather for soil/funderingsrisico/bodem, builds FysiekRisicoProfiel |
| `backend/app/scans/schemas.py` | ParcelRiskProfileResponse schema | VERIFIED | Pydantic model at line 396 with parcel_id, fysiek_risico_profiel, is_cached fields |
| `frontend/src/lib/types/property.ts` | FysiekRisicoProfiel TypeScript interface | VERIFIED | Interface at line 477 with all sub-risk fields (foundation_risk, soil_profile, asbest_indicator, bodem_data, funderingsrisicogebied, kcaf_cost) |
| `frontend/src/lib/types/scan.ts` | ParcelRiskProfileResponse type | VERIFIED | Interface at line 352 importing FysiekRisicoProfiel from property.ts |
| `frontend/src/lib/api.ts` | fetchParcelRiskProfile function | VERIFIED | Async function at line 991 using apiFetch to scans endpoint |
| `frontend/src/hooks/useScans.ts` | useParcelRiskProfile hook | VERIFIED | React Query hook at line 148 with 5min staleTime, null-safe enabled |
| `frontend/src/components/results/FysiekRisicoprofielSection.tsx` | 4 sub-card risk component | VERIFIED | 217-line component with loading skeleton, error fallback, 4 data cards |
| `frontend/src/components/results/ParcelDetailModal.tsx` | Integration of risk section | VERIFIED | Import at line 9, hook call at line 354, section rendered at line 618-623 between property info and Kansen |
| `backend/app/services/tile_proxy.py` | foundation_risk_level in MVT tiles | VERIFIED | SQL CASE at line 131-136 |
| `frontend/src/components/map/ParcelScoreLayer.tsx` | Foundation risk fill layer | VERIFIED | Layer ID exported at line 11, fill layer added at line 220, visibility function at line 575, mouse handlers at line 343/349, cleanup at line 445 |
| `frontend/src/lib/map/layers.ts` | foundation_risk in ParcelOverlayLayerId and catalog | VERIFIED | Union type at line 9, catalog entry at line 49 |
| `frontend/src/lib/api.ts` | TILE_SCHEMA_VERSION bumped | VERIFIED | Version '13' at line 788 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ParcelDetailModal.tsx | /api/scans/parcels/{id}/risk-profile | useParcelRiskProfile hook | WIRED | Import at line 9, hook at line 354, data passed to section at line 620 |
| Backend risk_profile endpoint | foundation_risk_engine.py | build_fysiek_risico_profiel() | WIRED | Import at line 1192, call at line 1272 |
| Backend risk_profile endpoint | soil_aggregator / funderingsrisico_aggregator / bodem_aggregator | asyncio.gather | WIRED | Three parallel fetch calls at lines 1242-1246 |
| tile_proxy.py | parcel_cache.bouwjaar | SQL CASE expression | WIRED | CASE WHEN pc.bouwjaar IS NULL/< 1970/< 1990 at lines 132-136 |
| ParcelScoreLayer.tsx | layers.ts | PARCEL_FOUNDATION_RISK_FILL_LAYER_ID | WIRED | Exported constant used in layer add, remove, visibility, mouse handlers |
| map.tsx | ParcelScoreLayer visibility function | setParcelFoundationRiskVisibility | WIRED | Import at line 57, called at line 1903, interactive layers array at line 1180 |
| LayerToggle.tsx | MAP_LAYER_CATALOG | parcelOverlays[5] | WIRED | activeParcelOverlay comparison at line 205 (showFoundationRisk) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FRNT-01 | 90-01 | User sees Fysiek Risicoprofiel section in ParcelDetailModal with sub-cards for bodem, fundering, asbest, and verontreiniging | SATISFIED | FysiekRisicoprofielSection.tsx with 4 sub-cards, integrated in ParcelDetailModal at line 618 |
| FRNT-02 | 90-01 | All risk indicators display amber confidence badges with source attribution and "indicatief" disclaimers | SATISFIED | Amber-only badge palette (no red/green), "indicatief" header badge, italic disclaimers per card |
| FRNT-03 | 90-02 | Area scan map tiles color parcels by foundation risk level alongside existing opportunity score | SATISFIED | foundation_risk_level in MVT tiles, toggleable Funderingsrisico overlay in ParcelScoreLayer |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| FysiekRisicoprofielSection.tsx | 132, 156, 182, 211 | "Geen gegevens beschikbaar" (typo: should be "gegevens" -> "gegevens" is correct Dutch) | Info | Minor -- Dutch text, acceptable |

No TODOs, FIXMEs, placeholders, or stub implementations found. No console.log-only handlers. No empty return values.

### Human Verification Required

### 1. Visual Layout of 4 Sub-Cards

**Test:** Open ParcelDetailModal for a parcel with bouwjaar < 1970 in a scanned gemeente
**Expected:** 2x2 grid of sub-cards (Fundering, Bodemtype, Asbest, Bodemkwaliteit) with amber badges, explanation text, and italic disclaimers visible below the property info grid and above Kansen section
**Why human:** Visual layout, spacing, and readability cannot be verified programmatically

### 2. Foundation Risk Map Overlay Toggle

**Test:** On the map page, enable Percelen toggle, then select "Funderingsrisico" from the parcel overlay dropdown
**Expected:** Parcels with pre-1970 bouwjaar show amber fill, post-1990 show grey/slate fill; hover state works
**Why human:** Map rendering and layer interaction require visual confirmation

### 3. Risk Profile API Response

**Test:** Open ParcelDetailModal for a parcel in Venlo -- verify all 4 data cards populate with real data
**Expected:** Foundation risk shows bouwjaar + soil reasoning, soil card shows BRO soil type, asbest shows bouwjaar-based assessment, bodemkwaliteit shows WBB dossier count
**Why human:** End-to-end data flow through live API calls to external services

### Gaps Summary

No gaps found. All 7 observable truths verified, all 12 artifacts exist and are substantive, all 7 key links are wired, and all 3 requirements (FRNT-01, FRNT-02, FRNT-03) are satisfied. No anti-pattern blockers detected.

---

_Verified: 2026-03-10T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
