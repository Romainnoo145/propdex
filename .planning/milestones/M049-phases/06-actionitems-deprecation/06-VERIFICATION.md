---
phase: 06-actionitems-deprecation
verified: 2026-05-16T17:25:00Z
status: passed
score: 8/8 must-haves verified
re_verification: null
---

# Phase 06: ActionItems Deprecation — Verification Report

**Phase Goal (ROADMAP M049 Phase 6):** Oude ActionItems pagina is dood; alle content beschikbaar via Data-bronnen rijen; geen broken links elders in app.

**Verified:** 2026-05-16T17:25:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP M049 Phase 6 Success Criteria)

| # | Truth (from ROADMAP) | Status | Evidence |
|---|---|---|---|
| 1 | ActionItem cards uit oude pagina zijn terug te vinden als "Bekijk action item" action-buttons in Data-bronnen | VERIFIED | `ACTION_ITEMS_CATALOG` (6 source-keyed entries) + `INFRASTRUCTURE_ACTION_ITEMS` (12 entries) live in `backend/app/services/action_items_catalog.py`. `compute_actions(...)` appends `view_action_item` for catalog source_keys. Frontend `ActionItemDetailModal.tsx` renders from TS-twin `actionItemsCatalog.ts`. Test `test_view_action_item_appears_for_catalog_source` PASSED. |
| 2 | `/instellingen/action-items` route returns HTTP 301 → `/instellingen/data-bronnen` | VERIFIED (SPA-equivalent) | Route file `frontend/src/routes/_authenticated/instellingen.action-items.tsx` exists, calls `throw redirect({ to: '/instellingen/data-bronnen' })` in beforeLoad, no component mounted. 9 occurrences in `routeTree.gen.ts`. Test `test_e2e_redirect_route_registered_in_router` PASSED. Documented divergence: SPA client-side redirect vs literal HTTP 301 — explicitly called out in 06-02 plan & summary. |
| 3 | Grep door codebase vindt geen interne links naar `/action-items` meer | VERIFIED | `rg -n "/action-items" frontend/src/` minus 5 whitelisted files (redirect route, TS types, TS catalog, ActionItemDetailModal, routeTree.gen.ts) returns 0 results. Test `test_e2e_grep_no_internal_action_items_links` PASSED. |
| 4 | ActionItem entity blijft bestaan in DB; alleen UI-paden zijn verdwenen | VERIFIED (N/A — frontend-only legacy) | T4 `test_e2e_action_item_db_entity_preserved` SKIPPED with audit message: no ActionItem SQLAlchemy model ever existed in `backend/app/models/`. The legacy ActionItems was a frontend-only construct (`components/documentation/ActionItems.tsx` ITEMS array). Skip is the audit signal that import-attempt did happen. Zero new Alembic migrations confirms backend referential is unchanged. |
| 5 | E2E smoke: admin doorloopt complete flow (upload → status flip → "live") zonder regression | VERIFIED | T1 `test_e2e_admin_upload_to_live_with_action_item` PASSED — admin GET → POST upload `welstandsnota` PDF → enqueue document_summary_job → POST refresh → second GET shows status='live' AND `available_actions` exactly `[view_versions, upload, refresh, view_action_item]`. M049 regression corpus (admin data-sources router + rescore wiring + integration credentials) — 30 passed. |
| 6 | Legacy `frontend/src/components/documentation/ActionItems.tsx` is DELETED | VERIFIED | `ls` returns "No such file or directory". `documentatie.tsx` reduced 78 → 47 lines; toggle removed; `useState`/`ActionItems`/`activeTab` grep returns 0. |
| 7 | `/documentatie?tab=acties` UI path is GONE | VERIFIED | `grep -E "acties\|ActionItems\|activeTab" documentatie.tsx` returns 0. Single-tab `DataCatalog` only. |
| 8 | Smoke tests cover E2E flow | VERIFIED | 4 backend smoke tests + 1 Storybook play. 11 passed + 1 skipped (T4 audit). |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `backend/app/services/action_items_catalog.py` | ACTION_ITEMS_CATALOG + INFRASTRUCTURE_ACTION_ITEMS + ActionItemEntry | VERIFIED | 267 lines. `ACTION_ITEMS_CATALOG: dict[str, ActionItemEntry]`, `INFRASTRUCTURE_ACTION_ITEMS: list[...]`, `_validate_catalog()` self-check. |
| `backend/app/admin/data_sources_schemas.py` | ActionType Literal with `view_action_item` | VERIFIED | 1 match. |
| `backend/app/admin/data_sources_helpers.py` | `_ACTION_LABELS['view_action_item']` + append in `compute_actions` | VERIFIED | 4 matches. Import `from app.services.action_items_catalog import ACTION_ITEMS_CATALOG`. Signature `compute_actions(source_type, status, source_key)`. Both call sites updated (lines 84, 97). |
| `frontend/src/lib/types/action-items.ts` | ActionItemEntry/Category/Priority TS types | VERIFIED | 25 lines. |
| `frontend/src/lib/constants/actionItemsCatalog.ts` | TS twin of backend catalog | VERIFIED | 182 lines. Drift script (06-02 summary) confirmed 6/6 catalog + 12/12 infra match backend 1:1. |
| `frontend/src/lib/types/data-sources-admin.ts` | ActionType union with `view_action_item` | VERIFIED | Union has 5 members. |
| `frontend/src/components/settings/data-bronnen/ActionItemDetailModal.tsx` | Aura-styled modal | VERIFIED | 153 lines. `bg-white/60 backdrop-blur-[24px]`, Plus Jakarta Sans inline style, `ACTION_ITEMS_CATALOG[sourceKey]` lookup. |
| `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` | ClipboardList icon + view_action_item branch + onViewActionItem prop | VERIFIED | 288 lines. `ClipboardList` import; `ACTION_ICON.view_action_item = ClipboardList`; dedicated render branch; `onViewActionItem` prop on Props + ActionButtonProps + forwarded. |
| `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` | actionItemSourceKey state + 3× onViewActionItem + modal mount | VERIFIED | All 3 DataSourceRow instances wire `onViewActionItem`; modal mounted next to CredentialConfigModal. |
| `frontend/src/routes/_authenticated/instellingen.action-items.tsx` | `throw redirect` route | VERIFIED | 46 lines, `throw redirect({ to: '/instellingen/data-bronnen' })` in beforeLoad. No component. |
| `frontend/src/routes/_authenticated/documentatie.tsx` | Toggle removed, DataCatalog only | VERIFIED | 47 lines (was 78); no `acties`/`ActionItems`/`activeTab` references. |
| `frontend/src/components/documentation/ActionItems.tsx` | DELETED | VERIFIED | "No such file or directory". |
| `backend/tests/unit/test_action_items_catalog.py` | 5 unit tests | VERIFIED | 5 passed. |
| `backend/tests/integration/test_m049_s06_action_items_action.py` | 3 integration tests | VERIFIED | 3 passed. |
| `backend/tests/integration/test_m049_s06_e2e_smoke.py` | 4 E2E smoke tests | VERIFIED | 294 lines. 3 passed + 1 skipped (T4 audit). |
| `frontend/src/components/settings/data-bronnen/DataSourceRow.stories.tsx` | WithActionItem story + play | VERIFIED | `WithActionItem`, `onViewActionItem: fn()`, `toHaveBeenCalledWith` all present (story registered, not in vitest-storybook run by design — see 06-03 summary). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `data_sources_helpers.py` | `action_items_catalog.py` | `from app.services.action_items_catalog import ACTION_ITEMS_CATALOG` | WIRED | Import + 4 references confirmed. |
| `data_sources_helpers.py` | `data_sources_schemas.py` | `Action(action="view_action_item", ...)` | WIRED | Action constructor at line 67. |
| `DataSourceRow.tsx` | `ActionItemDetailModal` (via parent) | `onViewActionItem?: (sourceKey: string) => void` callback | WIRED | Prop pipeline: Props → ActionButtonProps → click handler. |
| `instellingen.data-bronnen.$gemeenteCode.tsx` | `ActionItemDetailModal` | page-level state + per-row callback | WIRED | `actionItemSourceKey` state hook + 3× `onViewActionItem={(sk) => setActionItemSourceKey(sk)}` + modal mount. |
| `instellingen.action-items.tsx` | `/instellingen/data-bronnen` | `throw redirect({ to: ... })` in `beforeLoad` | WIRED | Registered in `routeTree.gen.ts` (9 occurrences). |
| `actionItemsCatalog.ts` | `action_items_catalog.py` | Manual TS-twin | WIRED | Drift check (06-02 summary) confirmed 1:1 parity. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| MIG-01 | 06-01, 06-02 | ActionItems pagina content migreert naar Data-bronnen rijen als action-button "Bekijk action item" | SATISFIED | Backend `ACTION_ITEMS_CATALOG` drives admin payload `view_action_item` action; frontend `ActionItemDetailModal` renders content. Test `test_view_action_item_appears_for_catalog_source` PASSED. |
| MIG-02 | 06-02 | `/instellingen/action-items` route geeft 301 redirect naar `/instellingen/data-bronnen/{...}` | SATISFIED (SPA equivalent) | Redirect route registered; T3 PASSED. Divergence (SPA client-side vs HTTP 301) documented in 06-02 plan/summary. |
| MIG-03 | 06-01 | ActionItem entity in DB blijft bestaan (referentieel werk), maar UI-paden verdwijnen | SATISFIED | T4 SKIPPED with audit message — no ActionItem SQLAlchemy model ever existed (frontend-only legacy). Zero new Alembic migrations. UI-paden verdwenen: legacy component DELETED, toggle GONE. |
| TEST-05 | 06-03 | E2E smoke test: admin opent gemeente → ziet 27 bronnen → uploadt PDF → status flips naar live | SATISFIED | T1 `test_e2e_admin_upload_to_live_with_action_item` PASSED end-to-end. 4 backend smoke tests + 1 Storybook play. |

**Coverage:** 4/4 requirements declared in PLAN frontmatter satisfied. REQUIREMENTS.md confirms all 4 marked `[x]` complete and traceability table maps each to S06. No orphans.

### Anti-Patterns Found

None. Code scanned:
- `backend/app/services/action_items_catalog.py` — no TODO/FIXME/placeholder/stub patterns
- `frontend/src/components/settings/data-bronnen/ActionItemDetailModal.tsx` — no stubs, legitimate Aura tokens
- `frontend/src/routes/_authenticated/instellingen.action-items.tsx` — minimal redirect-only by design (correct pattern, not a stub)
- `frontend/src/routes/_authenticated/documentatie.tsx` — 47 lines, no acties toggle

### Human Verification Required

None blocking. Two manual smoke paths noted in 06-02 summary but already verified statically via grep + routeTree check + automated tests:

1. **Click-flow row → modal:** UI rendering of ActionItemDetailModal at runtime — verified structurally via DataSourceRow.tsx wiring + ActionItemDetailModal.tsx Aura tokens; runtime visual confirmation is a 30-second optional dev-server smoke.
2. **Redirect-chain:** Visit `/instellingen/action-items` → URL bar resolves to `/instellingen/data-bronnen/{gemeente}` — verified via routeTree.gen.ts registration + redirect target string match.

Neither blocks "passed" status — automated coverage is comprehensive.

### Gaps Summary

No gaps. All 8 truths VERIFIED. All artifacts exist, are substantive (well above stub thresholds), and are wired (key links confirmed). All 4 requirement IDs (MIG-01, MIG-02, MIG-03, TEST-05) satisfied with test evidence. Legacy `ActionItems.tsx` deleted. Zero stray internal references to `/action-items`. CI grep guard enforces this forward.

**Phase 6 closes M049 (ActionItems Deprecation) cleanly.** STATE.md / ROADMAP.md flip to M049 complete in the post-execution metadata commit.

---

_Verified: 2026-05-16T17:25:00Z_
_Verifier: Claude (gsd-verifier)_
