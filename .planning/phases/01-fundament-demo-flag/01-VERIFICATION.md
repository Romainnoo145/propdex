---
phase: 01-fundament-demo-flag
verified: 2026-05-24T13:00:00Z
human_verified: 2026-05-26T15:43:00Z
status: passed
score: 8/8 must-haves verified
human_verification:
  - test: "Open http://localhost:9300, navigate to the Opgeslagen page (/opgeslagen), and confirm a parcel with a set project_type displays the Aura chip (rounded-full, glass bg-white/70, obsidian border/text). A parcel with no type set must show NO chip."
    expected: "Concrete project_type (e.g. 'optoppen') shows a small pill-label on SavedParcelCard; null/onbepaald shows nothing."
    why_human: "Chip renders conditionally based on live FavoriteResponse.project_type from the API — can only confirm end-to-end with a running dev server."
    confirmed: "2026-05-26 — PUT /project-type=transformatie_wonen on Sint Martinusstraat 10; /opgeslagen rendered 'Transformatie wonen' chip on that card; Onbekend adres (null) rendered NO chip. Evidence: /tmp/propdex-logs/uat-06-chip-rendered.png."
  - test: "Favorite a parcel (click heart) and confirm the ProjectTypePickerModal appears with title 'Wat ga je hier ontwikkelen?' and subtitle 'Dit bepaalt jouw route voor dit perceel.' — no scoring mention."
    expected: "Modal opens immediately after favorite is saved. Title and subtitle match intention-copy. No text about scoring or 'Kies het projecttype'."
    why_human: "Requires a live dev server with an authenticated session to trigger the onSuccess flow."
    confirmed: "2026-05-26 — Clicked heart on un-favorited Sint Martinusstraat 10; picker opened with exactly 'Wat ga je hier ontwikkelen?' + 'Dit bepaalt jouw route voor dit perceel.' + 6 options (Nieuwbouw wonen / Transformatie wonen / Optoppen / Splitsen / Commercieel → wonen / Later bepalen). Zero scoring claim in DOM text dump. Evidence: /tmp/propdex-logs/uat-20-picker-real.png."
  - test: "Un-favorite a parcel (click heart on already-saved parcel) and confirm the ProjectTypePickerModal does NOT appear."
    expected: "Heart click on saved parcel removes it from favorites; no modal is shown."
    why_human: "Behavioral flow that depends on live auth state and mutation lifecycle."
    confirmed: "2026-05-26 — Clicked heart on favorited Sint Martinusstraat 10; favorites count went 2→1 via API; grep for picker text ('ontwikkelen', 'zoekmethode', 'bepaalt', 'route') returned nothing in DOM. Evidence: /tmp/propdex-logs/uat-16-after-unfav-precise.png."
---

# Phase 01: Fundament + Demo-flag Verification Report

**Phase Goal:** "De data-foundation (projecttype) + isolatie-infra (HAUZER_DEMO) waar alle andere slices op bouwen." (M052/S01)
**Verified:** 2026-05-24T13:00:00Z
**Human-verified:** 2026-05-26T15:43:00Z (live UAT on localhost:9300, info@klarifai.nl)
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | rescore_parcel loads stored project_type and passes it into compute_score_v3 (FUND-02) | VERIFIED | `rescore_cascade_job.py:348` `compute_score_v3(flags, project_type=project_type_value)`; `get_project_type` imported locally at line 296; bare `compute_score_v3(flags)` count = 0 |
| 2 | PUT /api/parcels/{id}/project-type enqueues rescore_parcel best-effort, never blocks 200 (FUND-02) | VERIFIED | `parcel_project_type_router.py:85` calls `enqueue_rescore_parcel`; `logger.warning` at line 91 for non-blocking fallback; test `test_put_project_type_enqueues_rescore` PASSED |
| 3 | After saving a parcel the ProjectTypePickerModal appears (not on un-favorite) (FUND-01) | VERIFIED (code) / HUMAN (visual) | `HeartButton.tsx:21-22` exports `shouldShowProjectTypePicker`; `line 56` gates `setShowPicker(true)` on `!isFavorited && data != null`; `line 72-77` renders `ProjectTypePickerModal`; 4/4 unit test cases PASSED |
| 4 | GET /api/parcels/favorites returns project_type per favorite via org-scoped bulk join, no N+1 (FUND-01) | VERIFIED | `favorites_service.py:357-376` `project_type_sq` subquery; `org_id` resolved via scalar `User.organization_id` query; joined on `ParcelFavorite.parcel_id` (Kadaster-string); `test_bulk_join_single_query_no_n_plus_1` PASSED (before_cursor_execute counter == 1 for 3-favorite fixture) |
| 5 | Org B never sees org A's project_type on the same parcel (multi-tenant isolation) (FUND-01, DEMO-01) | VERIFIED | `test_org_b_never_sees_org_a_project_type` PASSED; `.where(ParcelProjectType.organization_id == org_id)` in subquery; `test_hauzer_demo_multi_tenant_isolation` PASSED |
| 6 | Organization has hauzer_demo boolean; GET /api/auth/me returns it; non-demo org gets false (DEMO-01) | VERIFIED | `organization.py:54` `hauzer_demo: Mapped[bool]`; migration `20260521_m052_s01`; `schemas.py:33` `hauzer_demo: bool = False`; `router.py:154-160` scalar query + assignment; `test_me_returns_hauzer_demo_false` PASSED |
| 7 | useHauzerDemo() hook derives flag from auth state for frontend gating (DEMO-01) | VERIFIED | `useHauzerDemo.ts:8-10` `export function useHauzerDemo(): boolean { return user?.hauzer_demo ?? false }`; `types.ts:11` `hauzer_demo: boolean` on User interface; derives from `useAuth()` — zero extra round-trip |
| 8 | DESIGN.md no longer frames makelaars as not-our-market (DEMO-03) | VERIFIED | `DESIGN.md:13` reads "Makelaars zijn wel onze markt (Hauzer = full-service developer-adjacent: makelaardij, advies, verkoop)"; `grep "NIET onze markt"` returns nothing |

**Score: 8/8 truths verified** (3 additionally need human confirmation for visual/behavioral aspects)

---

## Required Artifacts

| Artifact | Plan | Status | Details |
|----------|------|--------|---------|
| `backend/tests/integration/test_m052_s01_hauzer_demo.py` | 01-00 | VERIFIED | 2 tests, no skip/xfail, both GREEN |
| `backend/tests/regression/test_m052_s01_project_type_rescore.py` | 01-00 | VERIFIED | 2 tests, iron-rule drift-guard + isolation, both GREEN |
| `frontend/src/hooks/__tests__/useToggleFavorite.test.ts` | 01-00 | VERIFIED | 4 unit cases for `shouldShowProjectTypePicker`, all GREEN |
| `backend/app/jobs/rescore_cascade_job.py` | 01-01 | VERIFIED | Contains `get_project_type` import + `compute_score_v3(flags, project_type=project_type_value)` at line 348 |
| `backend/app/api/endpoints/parcel_project_type_router.py` | 01-01 | VERIFIED | Contains `enqueue_rescore_parcel` + `get_arq_pool` + `logger.warning` best-effort pattern |
| `backend/app/models/organization.py` | 01-02 | VERIFIED | `hauzer_demo: Mapped[bool]` at line 54, follows `expose_score_internals` pattern |
| `backend/alembic/versions/20260521_m052_s01_add_org_hauzer_demo.py` | 01-02 | VERIFIED | `down_revision = "20260519_m050_s02"`; single head confirmed |
| `backend/app/auth/schemas.py` | 01-02 | VERIFIED | `hauzer_demo: bool = False` at line 33 |
| `backend/app/auth/router.py` | 01-02 | VERIFIED | Scalar query `Organization.hauzer_demo` + `data.hauzer_demo = hauzer_demo` at lines 154-160 |
| `DESIGN.md` | 01-02 | VERIFIED | Makelaars framing corrected; "NIET onze markt" absent; "Brainbay/NVM" competitor retained |
| `frontend/src/lib/auth/types.ts` | 01-03 | VERIFIED | `hauzer_demo: boolean` on User interface |
| `frontend/src/hooks/useHauzerDemo.ts` | 01-03 | VERIFIED | `export function useHauzerDemo()` returning `user?.hauzer_demo ?? false` |
| `frontend/src/components/map/panels/parcel/HeartButton.tsx` | 01-03 | VERIFIED | `export function shouldShowProjectTypePicker`; `ProjectTypePickerModal` import + conditional render; picker guard on `!isFavorited && data != null` |
| `backend/app/favorites/favorites_service.py` | 01-04 | VERIFIED | `project_type_sq` subquery with `org_id` filter; outerjoin on `ParcelFavorite.parcel_id` (Kadaster-string); `resp.project_type = row[4]` in result loop |
| `backend/app/favorites/schemas.py` | 01-04 | VERIFIED | `project_type: str \| None = None` at line 48 |
| `backend/tests/regression/test_m052_s01_favorites_project_type_isolation.py` | 01-04 | VERIFIED | CRITICAL isolation test + Kadaster-string guard, both PASSED |
| `backend/tests/integration/test_favorites_project_type_join.py` | 01-04 | VERIFIED | with-type, without-type, no-N+1 counter tests, all PASSED |
| `frontend/src/lib/types/projectTypeChip.ts` | 01-04 | VERIFIED | `shouldShowProjectTypeChip` + `projectTypeChipLabel` pure helpers; 11/11 test cases PASSED |
| `frontend/src/lib/types/__tests__/projectTypeChip.test.ts` | 01-04 | VERIFIED | 11 test cases GREEN |
| `frontend/src/components/parcel/__tests__/projectTypePickerCopy.test.ts` | 01-04 | VERIFIED | 6 test cases (intention-copy present, scoring-claim absent, single-source guard) GREEN |
| `frontend/src/components/parcel/ProjectTypePickerModal.tsx` | 01-04 | VERIFIED | Title "Wat ga je hier ontwikkelen?"; subtitle "Dit bepaalt jouw route voor dit perceel."; no scoring text |
| `frontend/src/components/projects/SavedParcelCard.tsx` | 01-04 | VERIFIED | `shouldShowProjectTypeChip` gate + Aura chip markup (bg-white/70, border-aura-obsidian/10, text-aura-obsidian/80); no hardcoded hex |
| `frontend/src/components/projects/FavoritedParcelCard.tsx` | 01-04 | VERIFIED | Same chip markup as SavedParcelCard; `shouldShowProjectTypeChip(favorite.project_type)` gate |
| `frontend/src/lib/types/portfolio.ts` | 01-04 | VERIFIED | `project_type: string \| null` on FavoriteResponse |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `parcel_project_type_router.py` | `rescore_cascade_job.py` | `enqueue_rescore_parcel(arq_pool=..., organization_id=..., parcel_id=...)` in best-effort try/except | WIRED | Line 85; `logger.warning` non-blocking fallback confirmed |
| `rescore_cascade_job.py` | `score_v3.py` | `compute_score_v3(flags, project_type=project_type_value)` | WIRED | Line 348; `get_project_type` loads from DB using in-scope `db` session |
| `auth/router.py get_me` | `organization.py` | `SELECT Organization.hauzer_demo WHERE id = current_user.organization_id` | WIRED | Lines 154-160; scalar read, derives from caller's own org only |
| `HeartButton.tsx` | `ProjectTypePickerModal.tsx` | `render ProjectTypePickerModal when showPicker true, parcelId={parcel.parcel_code}` | WIRED | Lines 72-77; `onSuccess` gates show on `shouldShowProjectTypePicker` |
| `useHauzerDemo.ts` | `useAuth.ts` | `useAuth().user?.hauzer_demo` | WIRED | Lines 9-10; derives from already-loaded auth context |
| `favorites_service.py list_favorites` | `parcel_project_types table` | outerjoin on `parcel_id` (Kadaster-string) AND `organization_id` (via User join) | WIRED | Lines 357-376; `project_type_sq` subquery with `.where(ParcelProjectType.organization_id == org_id)` |
| `SavedParcelCard / FavoritedParcelCard` | `FavoriteResponse.project_type` | `shouldShowProjectTypeChip(parcel.project_type)` gate | WIRED | Confirmed in both card files |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FUND-01 | 01-00, 01-03, 01-04 | Gebruiker kiest bij opslaan projecttype; opgeslagen als `project_type` op ParcelFavorite | SATISFIED | HeartButton picker-on-save wired; shouldShowProjectTypePicker unit tests GREEN; favorites_service bulk-join returns project_type; Aura chip on both cards |
| FUND-02 | 01-00, 01-01 | Gekozen projecttype stuurt scoring via M047 projecttype-settings | SATISFIED | `compute_score_v3(flags, project_type=project_type_value)` at rescore_cascade_job.py:348; iron-rule regression test GREEN; PUT endpoint enqueues rescore best-effort |
| DEMO-01 | 01-00, 01-02, 01-03 | HAUZER_DEMO feature-flag gate (per-org boolean on Organization, surfaced on /me) | SATISFIED | Organization.hauzer_demo column + migration; GET /me returns field; useHauzerDemo() hook; multi-tenant isolation regression test GREEN |
| DEMO-03 | 01-02 | DESIGN.md makelaars-correctie — makelaars zijn wel onze markt | SATISFIED | DESIGN.md:13 corrected; "NIET onze markt" absent; "Makelaars zijn wel onze markt" present |

All 4 requirement IDs from the phase plans are accounted for. No orphaned requirements detected.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/tests/integration/test_m052_s01_hauzer_demo.py` | 8 | "Do NOT add pytest.skip" in comment | Info | Not actual usage — comment instruction in test file; no actual skip decorators present |
| `backend/tests/regression/test_m052_s01_project_type_rescore.py` | 9 | Same comment | Info | Same as above — instructional comment only |
| `backend/app/favorites/favorites_service.py` | — | File is 641 lines (pre-existing 300-line overage) | Warning | Pre-existing overage documented in 01-04 SUMMARY as DEF-01; 01-04 only added ~15 lines; explicitly deferred to a future slice per eng-review lock |

No blocker anti-patterns. The 300-line overage in `favorites_service.py` is a known, tracked deviation from the house rule and explicitly in-scope to defer.

---

## Human Verification Required

### 1. Aura chip visible on Opgeslagen cards

**Test:** Open the Opgeslagen page (/opgeslagen) while logged in. Find a parcel that has a project_type set (e.g., by favoriting one and choosing 'Optoppen' via the picker). Confirm a subtle pill-chip appears below the address/meta line on the SavedParcelCard and inside the address block on FavoritedParcelCard. Then confirm a parcel with no type set (or null) shows no chip.
**Expected:** Concrete type shows `rounded-full bg-white/70` glass chip with `text-aura-obsidian/80` label (e.g. "Optoppen"). No chip for null/onbepaald.
**Why human:** Requires a running dev server with live API data returning project_type from the favorites endpoint.

### 2. Picker appears after save with correct intention copy

**Test:** Log in, open a parcel panel on the map, click the heart icon to favorite it. Confirm the ProjectTypePickerModal appears with title "Wat ga je hier ontwikkelen?" and subtitle "Dit bepaalt jouw route voor dit perceel." Confirm there is no text about scoring improvements or "Kies het projecttype".
**Expected:** Modal opens immediately post-save. Title and subtitle match intention framing. No scoring claim anywhere in the modal.
**Why human:** Requires live auth session + mutation cycle to trigger `onSuccess` callback.

### 3. Picker absent on un-favorite

**Test:** On a parcel already saved (heart filled), click the heart to un-favorite it. Confirm the ProjectTypePickerModal does NOT appear.
**Expected:** Parcel removed from favorites; no modal shown.
**Why human:** Behavioral flow requiring live auth state to confirm `isFavorited === true` path produces no picker.

---

## Test Run Summary

All automated tests PASSED:

| Suite | Tests | Result |
|-------|-------|--------|
| `test_m052_s01_hauzer_demo.py` | 2 | PASSED |
| `test_m052_s01_project_type_rescore.py` | 2 | PASSED |
| `test_m052_s01_favorites_project_type_isolation.py` | 2 | PASSED |
| `test_favorites_project_type_join.py` | 3 | PASSED |
| `test_parcel_project_type_router.py` (regression) | 6 | PASSED |
| `useToggleFavorite.test.ts` | 4 | PASSED |
| `projectTypeChip.test.ts` | 11 | PASSED |
| `projectTypePickerCopy.test.ts` | 6 | PASSED |
| **Total** | **36** | **36 PASSED** |

---

## Gaps Summary

No gaps. All 8 observable truths verified. All 24 artifacts exist, are substantive, and are wired. All 4 requirement IDs satisfied. The 3 human_verification items are confirmations of already-verified code behavior — the logic is correct per automated tests, these are visual/UX confirmations only.

The phase goal "data-foundation (projecttype) + isolatie-infra (HAUZER_DEMO) waar alle andere slices op bouwen" is achieved:
- FUND-01: picker-on-save flow wired end-to-end; project_type visible on Opgeslagen cards via org-scoped bulk join
- FUND-02: PUT project-type triggers rescore using stored project_type (not the onbepaald default); iron-rule regression green
- DEMO-01: hauzer_demo per-org boolean on Organization; surfaced on /me; multi-tenant isolation proven by regression test; useHauzerDemo() ready for S03/S04/S05
- DEMO-03: DESIGN.md corrected; makelaars confirmed as in-market

---

_Verified: 2026-05-24T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
