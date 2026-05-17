---
phase: 04-m045-upload-flow-integratie
verified: 2026-05-15T10:30:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 04: m045-upload-flow-integratie Verification Report

**Phase Goal:** Upload-button op data-source rij opent existing M045/S05 modal; legacy beleid-beheer route geeft redirect banner.
**Verified:** 2026-05-15T10:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|---------|
| 1  | Click op "Upload" action bij beleidsdocument rij opent UploadDocumentModal met source_key pre-filled | VERIFIED | `DataSourceRow.tsx`: `<button onClick={() => onUpload?.(sourceKey)}>` (line 182). Detail route: `open={openUploadFor !== null}`, `initialSourceKey={openUploadFor ?? undefined}` (lines 183–191). State setter `setOpenUploadFor(sk)` passed to all three DataSourceRow render sites. |
| 2  | "Bekijk versies" action opent VersionHistoryPanel met juiste document context | VERIFIED | `DataSourceRow.tsx`: `<button onClick={() => onViewVersions?.(sourceKey)}>` (line 200). Detail route: `VersionHistoryPanel open={openVersionsFor !== null}` with `gemeenteCode` shorthand resolves entityType='gemeente'+entityCode automatically. `VersionHistoryPanel` uses `resolvedEntityType`/`resolvedEntityCode` derived from `gemeenteCode` prop (lines 46–47). |
| 3  | Bestaande document-uploads (uit M045/S05 era) zijn automatisch zichtbaar in nieuwe hub — geen handmatige migratie nodig | VERIFIED | `run_opportunistic_probes` called at line 133 in router before `return GemeenteDataSourcesPayload`. Orchestrator finds missing Type A rows, acquires advisory locks, runs `probe_type_a_cascade` via `asyncio.gather`, updates `DataSourceStatus` rows, commits, and rebuilds `cascade_uploads`. Three integration tests cover this path (lines 353, 398, 423 in test file). |
| 4  | /instellingen/beleid-beheer toont banner met deeplink naar nieuwe hub; oude routes blijven werken (geen 404) | VERIFIED | `instellingen.beleid-beheer.tsx`: `BeleidBeheerWithBanner` wrapper renders amber banner `bg-[#F9A826]/15` with `<Link to="/instellingen/data-bronnen">` and `<InstellingenBeleidPage />` below. Superuser gate preserved. No `throw redirect()` — route stays functional. `/instellingen/data-bronnen` route exists (`instellingen.data-bronnen.tsx` + `instellingen.data-bronnen.$gemeenteCode.tsx` + `instellingen.data-bronnen.index.tsx`). |
| 5  | M445 regression-test suite blijft groen | VERIFIED | `InstellingenBeleidPage` calls `<UploadDocumentModal open={uploadOpen} onClose={...} gemeenten={...} />` — only required props, no new required props added (all three new props are optional). `VersionHistoryPanel` all six original required props remain required (backwards-compat). `npm run check` passes on all modified files (pre-existing errors in unrelated files are out of scope). |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/settings/beleid/UploadDocumentModal.tsx` | Extended with initialGemeente/initialSourceKey/onSuccess | VERIFIED | 249 lines. Props interface has all three new optional props (lines 48–50). Pre-fill useEffect fires on `[open, initialGemeente, initialSourceKey]`. `onSuccess?.(doc.id)` at line 128 before `onClose()` at line 129. |
| `frontend/src/components/settings/beleid/VersionHistoryPanel.tsx` | Modal overlay mode with open/onClose/gemeenteCode | VERIFIED | 208 lines. Props interface adds `open?`, `onClose?`, `gemeenteCode?` (lines 26–28). `resolvedEntityType`/`resolvedEntityCode` derived before hook calls (lines 46–47). `if (open === false) return null` after hook calls (line 56). `ModalShell` + `VersionRows` inner components eliminate JSX duplication. |
| `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx` | Redirect banner with deeplink | VERIFIED | 28 lines. `BeleidBeheerWithBanner` wraps `InstellingenBeleidPage`. Amber banner with `bg-[#F9A826]/15 border border-[#F9A826]/30` (line 16). `<Link to="/instellingen/data-bronnen">` (line 20). Superuser gate unchanged. |
| `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` | Modal state + handleUploadSuccess + INT-04 probe trigger | VERIFIED | 207 lines. `openUploadFor`/`openVersionsFor` state declared before early returns (hooks compliance). `handleUploadSuccess` invalidates query cache then calls `refreshMutation.mutate` (lines 82–91). Both modals mounted at page level (lines 182–204). All three DataSourceRow sections pass `onUpload`/`onViewVersions` callbacks. |
| `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` | onUpload + onViewVersions callback props | VERIFIED | 239 lines. Props interface has `onUpload?: (sourceKey: string) => void` and `onViewVersions?: (sourceKey: string) => void` (lines 39–40). Dedicated upload branch (lines 178–192) and view_versions branch (lines 194–208). `<Link to="/instellingen/beleid-beheer">` placeholder fully removed. |
| `backend/app/admin/data_sources_helpers.py` | Shared helpers extracted from router | VERIFIED | 110 lines (slightly over the 100-line target, acceptable — no hardcoded limit in CLAUDE.md for helper size). Contains `compute_actions`, `_row_from_db`, `_synthesize_missing_row`, `_load_or_create_row`. No `app.admin` circular imports. |
| `backend/app/admin/data_source_probe_orchestrator.py` | run_opportunistic_probes with asyncio.gather | VERIFIED | 80 lines. `run_opportunistic_probes` exported. `asyncio.gather` over `probe_type_a_cascade` at line 51. Advisory lock per source_key. `db.commit()` after updates. Re-fetches and rebuilds Type A rows only. No import from `data_sources_router`. |
| `backend/app/admin/data_sources_router.py` | Delegates to run_opportunistic_probes + helpers imported | VERIFIED | 197 lines. Imports from `data_sources_helpers` (lines 18–22) and `data_source_probe_orchestrator` (line 16). `cascade_uploads = await run_opportunistic_probes(...)` at line 133. `_load_or_create_row` no longer defined in router (extracted). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| DataSourceRow upload button | GemeenteDataSourcesPage state setter | `onUpload` callback prop | WIRED | `onClick={() => onUpload?.(sourceKey)}` in DataSourceRow; `onUpload={(sk) => setOpenUploadFor(sk)}` in detail route |
| DataSourceRow view_versions button | GemeenteDataSourcesPage state setter | `onViewVersions` callback prop | WIRED | `onClick={() => onViewVersions?.(sourceKey)}` in DataSourceRow; `onViewVersions={(sk) => setOpenVersionsFor(sk)}` in detail route |
| GemeenteDataSourcesPage | UploadDocumentModal | `open={openUploadFor !== null}` | WIRED | Modal mounted at page level with `open`, `initialGemeente`, `initialSourceKey`, `onSuccess` |
| handleUploadSuccess | useRefreshDataSource mutation | `refreshMutation.mutate({ gemeenteCode, sourceKey, sourceLabel })` | WIRED | Called inside `handleUploadSuccess` after cache invalidation (line 86) |
| get_gemeente_sources | run_opportunistic_probes | `await run_opportunistic_probes(...)` | WIRED | Line 133 in router, before return statement |
| run_opportunistic_probes | probe_type_a_cascade | `asyncio.gather(*[probe_type_a_cascade(...)])` | WIRED | Line 51 in orchestrator |
| run_opportunistic_probes | pg_try_advisory_xact_lock | `compute_lock_key + pg_try_advisory_xact_lock` | WIRED | Lines 38–45 in orchestrator, sequential per source_key |
| instellingen.beleid-beheer.tsx banner | /instellingen/data-bronnen | `<Link to="/instellingen/data-bronnen">` | WIRED | Line 20 in beleid-beheer route |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| INT-01 | 04-01, 04-04 | UploadDocumentModal aangeroepen vanuit data-source rij met gemeente + source_key pre-filled | SATISFIED | DataSourceRow `onUpload` callback → `setOpenUploadFor` state → `UploadDocumentModal open={...} initialSourceKey={...} initialGemeente={...}` |
| INT-02 | 04-02, 04-04 | VersionHistoryPanel opent in nieuwe hub via "Bekijk versies" action | SATISFIED | DataSourceRow `onViewVersions` callback → `setOpenVersionsFor` state → `VersionHistoryPanel open={...} onClose={...} gemeenteCode={...}` in modal-overlay mode |
| INT-03 | 04-03 | /instellingen/beleid-beheer route blijft beschikbaar maar krijgt redirect-banner | SATISFIED | `BeleidBeheerWithBanner` adds amber info-banner above `InstellingenBeleidPage`; no beforeLoad redirect; route functional |
| INT-04 | 04-04, 04-05 | Bestaande document-uploads automatisch zichtbaar in nieuwe hub via opportunistic probe-on-load | SATISFIED | `run_opportunistic_probes` called in `get_gemeente_sources` + `handleUploadSuccess` triggers `refreshMutation.mutate` for new uploads; three integration tests verify both code paths |
| TEST-06 | 04-04 | Pre-merge regression: M445/S05 admin-hub paths blijven werken | SATISFIED | `InstellingenBeleidPage` uses `UploadDocumentModal` with only required props (no breaking change); `VersionHistoryPanel` preserves all six original required props |

---

### Anti-Patterns Found

None. No TODOs, FIXMEs, placeholder returns, or empty implementations found in any of the key phase files. The `Link` placeholder (`to="/instellingen/beleid-beheer"`) was fully replaced in `DataSourceRow.tsx`.

---

### Human Verification Required

#### 1. Upload flow end-to-end

**Test:** As superuser, navigate to `/instellingen/data-bronnen/GM0983`, click "Upload" on a Type A beleidsdocument row (e.g., woonvisie)
**Expected:** UploadDocumentModal opens with gemeente pre-selected to "GM0983" and source_key dropdown pre-selected to the clicked row's key. Upload a PDF. After success toast, the row status in the table flips to "live" without manual refresh.
**Why human:** DOM state transitions, network probe timing, and visual pre-selection cannot be verified statically.

#### 2. Bekijk versies modal

**Test:** On a row with status='live', click the History icon ("Bekijk versies")
**Expected:** A modal overlay appears with "Versiegeschiedenis" header, listing all uploaded versions with filename, date, size, and Bekijk/Download buttons. Clicking the backdrop or ✕ button closes the modal.
**Why human:** Modal rendering, backdrop click behavior, and version list visual correctness require runtime verification.

#### 3. Beleid-beheer banner deeplink

**Test:** Navigate to `/instellingen/beleid-beheer`
**Expected:** Amber banner appears at the top: "Gemeente-documenten beheer je nu vanuit Data-bronnen. Landelijk/Provincie blijft hier tot M050. Ga naar Data-bronnen →". Clicking the link navigates to `/instellingen/data-bronnen`. The full InstellingenBeleidPage content renders below.
**Why human:** Visual rendering and link navigation require a running browser.

---

### Gaps Summary

No gaps found. All five success criteria are met. All eight required artifacts exist, are substantive (no stubs), and are correctly wired together. The INT-04 pre-existing upload path is covered by both the opportunistic probe-on-load (plan 04-05) and the post-upload probe trigger (plan 04-04), with integration tests verifying the backend behavior.

One minor deviation from plan spec: `data_sources_helpers.py` is 110 lines rather than the plan's target "under 100 lines." The additional lines come from the `cast(DataSourceStatusValue, ...)` fix for pre-existing mypy errors. This is within the project-wide 300-line limit and does not affect correctness.

---

_Verified: 2026-05-15T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
