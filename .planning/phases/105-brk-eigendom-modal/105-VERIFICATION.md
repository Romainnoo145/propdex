---
phase: 105-brk-eigendom-modal
verified: 2026-03-12T10:30:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
human_verification:
  - test: "Click the status SecondaryField on a parcel detail panel"
    expected: "EigendomModal opens with confirmation dialog showing credit warning and adaptive title"
    why_human: "Requires running app with real parcel data to test click-through flow"
  - test: "Confirm the BRK lookup and observe results"
    expected: "Loading spinner, then BRK data or unavailable message (depending on Kadaster cert config)"
    why_human: "End-to-end flow requires backend + Kadaster cert; cannot verify programmatically"
  - test: "Close the modal and re-open DevTools React Query panel"
    expected: "BRK query key is garbage collected (gcTime:0 compliance)"
    why_human: "Runtime behavior of React Query cache eviction"
  - test: "Verify teaser sections and Genereer Rapport CTA"
    expected: "Blurred Bodemrisico and Bouwpotentieel teasers visible, CTA button triggers report generation"
    why_human: "Visual layout and rapport generation integration need live testing"
---

# Phase 105: BRK Eigendom Modal Verification Report

**Phase Goal:** On-demand BRK ownership data in a modal on the parcel detail panel with adaptive framing and rapport conversion teasers
**Verified:** 2026-03-12T10:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | GET /api/scans/parcels/{parcel_id}/eigendom returns BRK ownership data | VERIFIED | `backend/app/scans/router.py` L1862-1949: full endpoint with PDOK resolution, BRK fetch, 3 status paths |
| 2 | Endpoint resolves ParcelCache UUID to BRK identificatie via PDOK centroid | VERIFIED | L1896-1942: PostGIS ST_Centroid -> get_parcels_by_point -> identificatie extraction |
| 3 | Response is ephemeral: never cached, never stored | VERIFIED | No DB write in endpoint; returns `model_dump(mode="json")` directly; docstring confirms |
| 4 | Missing BRK config returns status=unavailable with admin_hint | VERIFIED | `fetch_brk_ownership` returns BRKOwnership with status/reason; endpoint propagates directly |
| 5 | Clicking status SecondaryField opens eigendom modal | VERIFIED | `ParcelBentoOverview.tsx` L237-239: `onClick={() => setShowEigendom(true)}` on status field |
| 6 | User sees confirmation dialog before BRK API call | VERIFIED | `EigendomModal.tsx` L142-178: Phase 1 confirmation with "Kost 1 credit" warning, refetch on confirm |
| 7 | Modal adapts framing: grondpositie vs herontwikkeling | VERIFIED | L78-82: `isLeeg = !parcel.has_pand`, title/subtitle switch; L248-255: adaptive context text |
| 8 | BRK data shows eigenaar type, zakelijk recht, aandeel, hypotheek | VERIFIED | L258-324: iterates PerceelOwnership -> gerechtigden, renders recht type, aandeel, hypotheek badge |
| 9 | Eigenaar type routing tips displayed | VERIFIED | L31-55: EIGENAAR_TIPS constant with 4 types; L308-309: `tip.tip` rendered per gerechtigde |
| 10 | Teaser sections with blurred content and Genereer Rapport CTA | VERIFIED | L328-345: TeaserSection for Bodemrisico + Bouwpotentieel; L334-345: CTA button with report generation |
| 11 | BRK data discarded on modal close (gcTime: 0) | VERIFIED | `useEigendom.ts` L28: `gcTime: 0` |
| 12 | Not-configured state shows distinct message | VERIFIED | `EigendomModal.tsx` L201-220: unavailable state renders reason + separate admin_hint box |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/scans/router.py` | get_parcel_eigendom endpoint | VERIFIED | L1862: route registered, L1864: async def, auth + rate limit + org-scoped |
| `frontend/src/lib/types/brk.ts` | BRKOwnershipResponse interfaces | VERIFIED | 26 lines, 3 interfaces matching backend schema exactly |
| `frontend/src/hooks/useEigendom.ts` | useEigendomLookup hook with gcTime:0 | VERIFIED | 31 lines, enabled:false, gcTime:0, staleTime:0, retry:false |
| `frontend/src/components/map/panels/parcel/EigendomModal.tsx` | Full modal with confirm/loading/results | VERIFIED | 400 lines, three-phase flow, adaptive framing, teasers, portal-based |
| `frontend/src/components/map/panels/parcel/ParcelBentoOverview.tsx` | Clickable status field + modal trigger | VERIFIED | L118: showEigendom state, L239: onClick, L253-260: EigendomModal render |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scans/router.py` | `pdok_cadastral.py` | `get_parcels_by_point()` | WIRED | L1914: direct call with x, y coordinates |
| `scans/router.py` | `property_aggregator.py` | `fetch_brk_ownership()` | WIRED | L1947: `await fetch_brk_ownership([parcel_obj])` |
| `useEigendom.ts` | `/api/scans/parcels/{id}/eigendom` | `apiFetch` | WIRED | L22-25: apiFetch to correct endpoint path |
| `ParcelBentoOverview.tsx` | `EigendomModal.tsx` | `setShowEigendom(true)` | WIRED | L8: import, L239: onClick trigger, L255: conditional render |
| `EigendomModal.tsx` | `useEigendom.ts` | `useEigendomLookup` | WIRED | L26: import, L74: hook call, L86: refetch on confirm |
| `EigendomModal.tsx` | `useReports.ts` | `useGenerateReportFromParcel` | WIRED | L27: import, L76: hook call, L95: mutate on CTA click |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BRK-01 | 105-01 | Backend eigendom endpoint | SATISFIED | Endpoint exists at L1862, org-scoped, rate-limited, ephemeral |
| BRK-02 | 105-02 | Frontend modal with confirmation and adaptive framing | SATISFIED | EigendomModal.tsx with 3-phase flow, adaptive title/context |
| BRK-03 | 105-02 | Teaser sections and rapport conversion CTA | SATISFIED | TeaserSection component, Genereer Rapport button wired to useGenerateReportFromParcel |

**Note:** BRK-01, BRK-02, BRK-03 are referenced in ROADMAP.md and plan frontmatter but are NOT defined in `.planning/REQUIREMENTS.md`. They are ORPHANED from the requirements registry. This is a documentation gap, not a functional gap -- the implementations satisfy the intent described in the roadmap success criteria.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| EigendomModal.tsx | 384 | "Blurred placeholder content" comment | Info | Intentional design -- blurred teaser, not a TODO |

No blocker or warning-level anti-patterns found. No TODO/FIXME/HACK markers in any phase 105 files.

### Human Verification Required

### 1. Modal Open Flow
**Test:** Click the status SecondaryField ("Leeg perceel" or pand status) in parcel detail panel
**Expected:** EigendomModal opens with backdrop blur, confirmation dialog with adaptive title and "Kost 1 credit" warning
**Why human:** Requires running frontend with real parcel data

### 2. BRK Lookup End-to-End
**Test:** Confirm the lookup in the modal
**Expected:** Loading spinner, then BRK data display (or "unavailable" if no Kadaster cert configured)
**Why human:** Backend requires PKIOverheid certificate for real BRK data; only shows unavailable in dev

### 3. Data Ephemerality
**Test:** Close modal, check React Query DevTools
**Expected:** brk-eigendom query key garbage collected immediately
**Why human:** Runtime React Query cache behavior

### 4. Rapport CTA Integration
**Test:** Click "Genereer Rapport" button in results view
**Expected:** Toast notification, report generation triggered
**Why human:** Requires full backend rapport pipeline

### Gaps Summary

No gaps found. All 12 observable truths verified across backend endpoint and frontend modal. All 5 artifacts exist, are substantive (not stubs), and are properly wired. All 6 key links confirmed. The only documentation issue is that BRK-01/02/03 requirement IDs are not formally defined in REQUIREMENTS.md -- they should be added for traceability completeness.

---

_Verified: 2026-03-12T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
