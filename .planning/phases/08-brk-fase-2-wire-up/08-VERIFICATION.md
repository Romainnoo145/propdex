---
phase: 08-brk-fase-2-wire-up
verified: 2026-05-19T15:00:00Z
status: passed
score: 7/7 must-haves verified
---

# Phase 8: BRK Fase-2 Wire-up (M050/S06 cont.) — Verification Report

**Phase Goal:** Activeer lifecycle-fase 2 (Contact) als BRK-home. Verplaats BRK persist-CTA van fase 1 (Onderzoek) naar fase 2, voeg nieuwe `GET /api/parcels/{id}/brk` read-endpoint toe, render 3 BRK risico-factoren in RisicoLayer na rescore, en split de 1922-LOC `FavoriteParcelWorkspaceView.tsx` in ≤300-LOC componenten conform CLAUDE.md regel.

**Verified:** 2026-05-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| #   | Truth                                                                                                          | Status     | Evidence                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `GET /api/parcels/{id}/brk` endpoint live met org-filter + soft-delete-filter; cross-org returns []            | VERIFIED   | `backend/app/scans/brk_router.py:123-145` GET handler + `backend/app/services/brk_read_service.py:21-50` filters on org+parcel+soft_deleted_at, returns `[]` cross-org (no leak)                |
| 2   | Lifecycle-fase 2 enabled in phases.ts; navigation from fase-1 AANPAK → `/2-contact` works                      | VERIFIED   | `phases.ts:46` `enabled: true, plannedMilestone: 'M050/S06 cont. (Phase 8)'`; `$phase.tsx:5,53-54` imports + dispatches `ContactPhaseView`; `AanpakCard.tsx:84-87` "Naar Contact-fase" CTA       |
| 3   | BRK persist-CTA in fase 2: success-path + 7 typed error-states + AD4 empty-response UX                         | VERIFIED   | `BrkPersistPanel.tsx:59-73` 5-state machine (idle/loading/error/empty/success); `errorMapping.ts:37-94` maps 7 statuses (401/403/404/422/502/503-DPA/503-credential); AD4 "Particuliere eigenaar" at line 155-171 |
| 4   | Rescore-polling banner: voltooid binnen 60s window OF timeout-message                                          | VERIFIED   | `useRescorePoll.ts:11-12` `POLL_INTERVAL_MS=2000` + `MAX_TICKS=30` (= 60s); `RescoreProgressBanner.tsx` 4 phases (idle/polling/success/timeout) with link back to fase 1                          |
| 5   | RisicoLayer toont 3 nieuwe factor-cards (hypotheek_risico, eigendoms_complexiteit, koopwaarde_trend) na rescore | VERIFIED   | `RisicoLayer.tsx:85-87` FACTOR_LABELS entries + `:169,183,198` formatFactorValue cases for all 3 BRK keys                                                                                       |
| 6   | `FavoriteParcelWorkspaceView.tsx` gesplitst in ≥5 files, alle ≤300 LOC, feature-parity met pre-split           | VERIFIED   | Monolith DELETED; 5 cockpit components (280/151/50/292/245/188/167/163 LOC, all ≤300) + 2 lib helpers (252/266 LOC); `OnderzoekPhaseView.parity.test.tsx` pins parity                            |
| 7   | REGRESSION: Phase 105 ephemeral BRK-modal; LifecycleSideRailNav scope-rule; 25 score-factoren unchanged        | VERIFIED   | `test_phase105_modal_still_works.py` pins `BRKOwnership ≠ BRKOwnershipRecordRead` schema; `test_lifecycle_sidebar_scope.py` pins `useMatchRoute fuzzy /opgeslagen/perceel/$parcelId/*`; `test_score_v3_registry_25_factors.py` pins FACTOR_REGISTRY count==25 |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact                                                                                  | Expected                                  | Status     | Details                                                                                  |
| ----------------------------------------------------------------------------------------- | ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `backend/app/scans/brk_router.py`                                                         | GET /{parcel_id}/brk handler              | VERIFIED   | 146 LOC, GET handler at line 123 (after POST persist); imports `read_for_parcel`         |
| `backend/app/services/brk_read_service.py`                                                | `read_for_parcel(db, org_id, parcel_id)`  | VERIFIED   | 51 LOC, async function with 3 filters + MAX(fetched_at) anchor                            |
| `backend/tests/regression/test_multi_tenant_brk_isolation.py`                             | REGRESSION-CRITICAL cross-org returns []  | VERIFIED   | 314 LOC, includes `test_cross_org_get_returns_empty`, `test_query_includes_org_filter`, `test_soft_deleted_not_returned`, signature drift guard |
| `frontend/src/hooks/useBrkRecords.ts`                                                     | GET /brk React Query hook                 | VERIFIED   | 42 LOC, `useQuery` with cache key `['brk', parcelId]`                                    |
| `frontend/src/hooks/usePersistBrk.ts`                                                     | POST /brk/persist mutation                | VERIFIED   | 56 LOC, `useMutation` + `onSuccess` invalidates `['scan', parcelId]`, hydrates `['brk',]` |
| `frontend/src/hooks/useRescorePoll.ts`                                                    | 2s × 30 ticks poll + cleanup              | VERIFIED   | 104 LOC, setInterval cleanup via return; `shouldStopOnSuccess` pure predicate exported    |
| `frontend/src/lib/brk/errorMapping.ts`                                                    | `mapBrkError(status, detail)`             | VERIFIED   | 95 LOC, handles 401/403/404/422/502/503 (DPA + credential disambiguated via detail)      |
| `frontend/src/components/lifecycle/ContactPhaseView.tsx`                                  | Fase-2 top-level dispatcher               | VERIFIED   | 143 LOC, dispatches 5 sub-components via `deriveContactDispatch` pure helper             |
| `frontend/src/components/lifecycle/BrkPersistPanel.tsx`                                   | Persist CTA + 7 error states + AD4 empty  | VERIFIED   | 203 LOC, `derivePersistPanelState` 5-state machine                                       |
| `frontend/src/components/lifecycle/BrkOwnerCard.tsx`                                      | Rechtspersoon + overheid render variants  | VERIFIED   | 79 LOC, `eigenaar_type === 'rechtspersoon' / 'overheid'` branches; multi-owner list      |
| `frontend/src/components/lifecycle/BrkHypotheekCard.tsx`                                  | `heeft_hypotheek` Y/N rendering           | VERIFIED   | 56 LOC, "Hypotheek aanwezig" vs "Volledig eigendom"                                       |
| `frontend/src/components/lifecycle/BrkKoopwaardeTimeline.tsx`                             | Koopjaar + koopsom timeline               | VERIFIED   | 80 LOC, filter+sort by koopjaar, nl-NL EUR formatting                                    |
| `frontend/src/components/lifecycle/RescoreProgressBanner.tsx`                             | 3 states (polling/success/timeout)        | VERIFIED   | 110 LOC, consumes `useRescorePoll`; success path has Link back to fase 1                  |
| `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx`                        | 3 BRK keys in FACTOR_LABELS + formatter   | VERIFIED   | 3 keys mapped + 3 formatFactorValue cases                                                |
| `backend/tests/regression/test_score_v3_registry_25_factors.py`                           | REGRESSION-CRITICAL 25-factor pin         | VERIFIED   | 102 LOC, enumerates exact key set; drift detector                                        |
| `frontend/src/lib/lifecycle/phases.ts`                                                    | `2-contact` enabled toggle                | VERIFIED   | Line 46: `enabled: true`; 3-bod through 8-exit remain `false` (REGRESSION-CRITICAL)       |
| `frontend/src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx`              | Dispatch to ContactPhaseView              | VERIFIED   | Lines 5,53-54 imports + dispatches `ContactPhaseView`                                    |
| `frontend/src/components/cockpit/OnderzoekPhaseView.tsx`                                  | Fase-1 shell wrapper (post-split top)     | VERIFIED   | 280 LOC, mounted via `opgeslagen.perceel.$parcelId.tsx:50`                               |
| `frontend/src/components/cockpit/AanpakCard.tsx`                                          | BRK CTA REMOVED + Contact-fase CTA        | VERIFIED   | 151 LOC, no `brk-persist` kind anywhere; "Naar Contact-fase →" with `contact-handoff` kind |
| `frontend/src/components/cockpit/DossierPager.tsx`                                        | 5 dossier tabs                            | VERIFIED   | 50 LOC                                                                                   |
| `frontend/src/components/cockpit/DossierCardSlot.tsx`                                     | Single dossier card with sleep+upload     | VERIFIED   | 292 LOC                                                                                  |
| `frontend/src/components/cockpit/ProjectnotitiesGrid.tsx`                                 | 4-slot projectnotities grid               | VERIFIED   | 245 LOC                                                                                  |
| `frontend/src/lib/cockpit/dossier-pages.ts`                                               | `buildPages` + helpers                    | VERIFIED   | 252 LOC                                                                                  |
| `frontend/src/lib/cockpit/cockpit-derivations.ts`                                         | `deriveNextStep` with contact-handoff     | VERIFIED   | 266 LOC, returns `kind: 'contact-handoff'` (not `brk-persist`)                            |
| `frontend/src/components/cockpit/__tests__/OnderzoekPhaseView.parity.test.tsx`            | REGRESSION-CRITICAL parity test           | VERIFIED   | Exists; pins 5 dossier-tabs + scores + upload + projectnotities                          |
| `backend/tests/integration/test_brk_read_e2e.py`                                          | GET /brk integration E2E                  | VERIFIED   | 362 LOC, 6 tests (per 08-08 SUMMARY)                                                     |
| `backend/tests/regression/test_phase105_modal_still_works.py`                             | Phase 105 ephemeral schema isolation      | VERIFIED   | 234 LOC, distinguishes `BRKOwnership` vs `BRKOwnershipRecordRead`                         |
| `backend/tests/regression/test_lifecycle_sidebar_scope.py`                                | Sidebar fires only on perceel-detail      | VERIFIED   | 166 LOC, asserts `useMatchRoute fuzzy /opgeslagen/perceel/$parcelId`                      |
| `frontend/src/__tests__/e2e/phase8_contact_flow.test.tsx`                                 | Frontend E2E flow                         | VERIFIED   | Exists (199 LOC, 14 tests per 08-08 SUMMARY)                                              |

**All artifacts present and substantive.**

### Key Link Verification

| From                                                              | To                                                                | Via                                                | Status | Details                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `brk_router.py` GET handler                                       | `brk_read_service.read_for_parcel`                                | `from app.services.brk_read_service import read_for_parcel` | WIRED  | Line 44 import; line 141 call                                            |
| `brk_read_service.py`                                             | `BrkOwnershipRecord` model                                        | `select(BrkOwnershipRecord).where(org+parcel+soft_deleted)` | WIRED  | All 3 filter clauses present                                             |
| `ContactPhaseView`                                                | `useBrkRecords`                                                   | `const { data: records, isLoading } = useBrkRecords(parcelId)` | WIRED  | Line 22 import; line 82 use                                              |
| `BrkPersistPanel`                                                 | `usePersistBrk` + `mapBrkError`                                   | `const mutation = usePersistBrk(parcelId)` + `mapBrkError(...)` | WIRED  | Imports + calls present                                                 |
| `RescoreProgressBanner`                                           | `useRescorePoll`                                                  | `useRescorePoll({ parcelId, pollStartAt, enabled })` | WIRED  | Line 19 import; line 70 use                                              |
| `useRescorePoll`                                                  | GET /api/scans/parcels/{id}/scan-data                             | `apiFetch` to scan-data endpoint                   | WIRED  | DEF-01 resolution: backend ScanResultItem now exposes `cascade_rescored_at` top-level |
| `$phase.tsx` route                                                | `ContactPhaseView`                                                | `import { ContactPhaseView } from '@/components/lifecycle/ContactPhaseView'` | WIRED  | Line 5 import; line 54 render                                            |
| `AanpakCard.tsx`                                                  | `/opgeslagen/perceel/$parcelId/$phase` route                      | TanStack Link `phase: '2-contact'`                 | WIRED  | "Naar Contact-fase →" CTA renders when `kind === 'contact-handoff'`      |
| `cockpit-derivations.ts` `deriveNextStep`                         | `AanpakCard.tsx`                                                  | Returns `kind: 'contact-handoff'` (replaced `brk-persist`) | WIRED  | No `brk-persist` kind anywhere in cockpit code; `contact-handoff` flows end-to-end |
| `opgeslagen.perceel.$parcelId.tsx`                                | `OnderzoekPhaseView`                                              | `import { OnderzoekPhaseView } from '@/components/cockpit/OnderzoekPhaseView'` | WIRED  | Line 5 import; line 50 render with full props                            |

**All 10 key links verified WIRED.**

### Requirements Coverage

| Requirement | Source Plan        | Description                                                                                          | Status    | Evidence                                                                                                            |
| ----------- | ------------------ | ---------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------- |
| UX-06       | 08-03, 08-04, 08-05, 08-07 | Lifecycle-fase 2 enabled + BRK persist-CTA moved to fase-2 + "Stap door naar Contact" copy; no score-drempel | SATISFIED | `phases.ts:46` enabled, `AanpakCard.tsx` `contact-handoff` kind only, no `brk-persist` anywhere in fase-1, `ContactPhaseView` mounts |
| UX-07       | 08-03              | Empty BRK response → "Particuliere eigenaar" infoblok with AVG context                               | SATISFIED | `BrkPersistPanel.tsx:155-171` renders "Particuliere eigenaar" + AVG copy + outreach suggestion (BAG-adres/makelaar) |
| UX-08       | 08-02, 08-03       | Rescore-polling UX: inline banner 2s × 30 ticks (60s window) → success or timeout                    | SATISFIED | `useRescorePoll.ts:11-12` constants; `RescoreProgressBanner.tsx` 3 states with link back to fase 1                  |
| WIRE-04     | 08-01, 08-02, 08-08 | New `GET /api/parcels/{id}/brk` with org-filter + soft-delete-filter + multi-owner + cross-org → [] | SATISFIED | `brk_router.py:123-145` + `brk_read_service.py:35-50` with MAX(fetched_at) anchor + `test_multi_tenant_brk_isolation.py` |
| WIRE-05     | 08-06, 08-08       | 1922-LOC monolith split into ≥5 components ≤300 LOC; feature-parity REGRESSION test                  | SATISFIED | 7 component files + 2 helper files all ≤300 LOC (max 292); `OnderzoekPhaseView.parity.test.tsx` exists; monolith DELETED |
| TEST-09     | 08-01, 08-06, 08-08 | REGRESSION-CRITICAL multi-tenant + Phase 105 schema + LifecycleSideRailNav scope                     | SATISFIED | 3 backend regression test files (multi-tenant, phase105, sidebar-scope) all substantive (314/234/166 LOC)            |

**All 6 phase-8 requirements SATISFIED.** No orphaned requirements (every ID in REQUIREMENTS.md Phase-8 block accounted for in at least one PLAN's `requirements` field).

### Anti-Patterns Found

| File                                                                  | Line | Pattern                                                | Severity | Impact                                                                                                                       |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/components/lifecycle/BrkPersistPanel.tsx`               | 168  | `{/* TODO Plan 08-07: link naar brief-flow placeholder */}` | Info     | Forward-reference to brief-flow (M050/S05 follow-on). Empty-state copy still complete (AD4 infoblok + outreach suggestion). Non-blocking. |

No blocker or warning anti-patterns. The single Info-level TODO is a forward-reference for a future enhancement (brief-flow), not incomplete work for Phase 8.

### Human Verification Required

None — all automated checks pass. Optional manual smoke-tests (not required for verification):
- Visual: navigate to `/opgeslagen/perceel/{id}/2-contact` and confirm Aura tokens render correctly (Pure Glass surfaces, Warm Amber CTA, Plus Jakarta Sans).
- Real-time: trigger BRK persist on a test perceel; confirm rescore banner ticks visible (1..N..30) and success-link returns to fase 1.
- AVG-edge: persist on a parcel known to have natuurlijk-persoon only → "Particuliere eigenaar" infoblok visible.

These are confirmation-only — code paths are verified via component composition tests (`phase8_contact_flow.test.tsx`) and unit tests (`derivePersistPanelState`, `deriveContactDispatch`).

### Gaps Summary

**No gaps.** Phase 8 fully achieves the stated goal:
- Lifecycle-fase 2 (Contact) is the BRK-home; fase 1 AANPAK now shows "Naar Contact-fase →" CTA without score gating (AD1).
- New `GET /api/parcels/{id}/brk` endpoint hydrates fase-2 on page load with org+soft-delete filters + MAX(fetched_at) anchor (AD2).
- Polling banner runs 2s × 30 ticks with inline messaging and success-link back to fase 1 (AD3).
- AD4 "Particuliere eigenaar" infoblok renders for empty BRK responses with AVG context + outreach suggestion (AD4).
- 1922-LOC FavoriteParcelWorkspaceView.tsx is fully deleted; replaced by 7 ≤300-LOC components + 2 lib/cockpit helpers (AD5).
- ContactPhaseView dispatches to 4 BRK display sub-components + RescoreProgressBanner (AD6).

Backend (5 regression+integration test files, 1178 LOC total) and frontend (5+ test files, including E2E composition test) coverage is comprehensive. Iron-rule regressions pin the 3 critical invariants: multi-tenant isolation, Phase 105 schema separation, and LifecycleSideRailNav scope. All 6 requirement IDs (UX-06/07/08, WIRE-04/05, TEST-09) are SATISFIED with concrete code evidence.

DEF-01 (Plan 08-03 deferred-items) was resolved in Plan 08-05 — `useRescorePoll` now calls real `/api/scans/parcels/{id}/scan-data` endpoint after backend exposed `cascade_rescored_at` top-level on `ScanResultItem`.

---

_Verified: 2026-05-19_
_Verifier: Claude (gsd-verifier)_
