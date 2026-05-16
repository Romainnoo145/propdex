---
phase: 05-encrypted-credentials
plan: "05-03"
subsystem: frontend-admin
tags: [frontend, react, tanstack-query, aura, framer-motion, admin-modal, type-c-credentials]

# Dependency graph
requires:
  - phase: 05-encrypted-credentials
    plan: "05-02"
    provides: "/api/admin/integration-credentials router + CredentialEntryRead/CredentialCreate schemas + CREDENTIAL_FIELDS registry"
  - phase: 03-data-sources-ux
    provides: "GemeenteDataSourcesPage + DataSourceRow with configure_credential ACTION_ICON already wired"
provides:
  - frontend CREDENTIAL_FIELDS TS-mirror (manual twin of backend/app/services/credential_fields.py)
  - TanStack Query hooks (useCredentialsForSource, useCreateCredential, useDeleteCredential) with cache-invalidation
  - CredentialConfigModal (Aura-styled, three states empty/filled/rotating)
  - DataSourceRow onConfigureCredential prop + dedicated render branch
  - Page-level modal mount in instellingen.data-bronnen.$gemeenteCode route
affects: [M051-brk, M052-vindsubsidies, M053-nvm]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Manual TS-twin of backend registry — same shape as dataSourceKeys.ts manual mirror pattern from Phase 01-datamodel"
    - "Per-field empty/filled rendering inside one modal — fields[].map() switches presentational sub-component on entriesByName presence"
    - "DELETE → invalidate query → form auto-re-renders empty (no manual state-reset needed for rotate flow)"
    - "Dedicated ActionButton render branch per action.action — keeps refresh-specific spinner state isolated from upload/versions/credential branches"
    - "Modal mount at page level with sourceKey state — null = closed, non-null = open + source context (mirrors existing setOpenUploadFor pattern)"

key-files:
  created:
    - frontend/src/lib/types/integration-credentials.ts
    - frontend/src/lib/constants/credentialFields.ts
    - frontend/src/lib/queries/integration-credentials-admin.ts
    - frontend/src/components/settings/CredentialConfigModal.tsx
  modified:
    - frontend/src/components/settings/data-bronnen/DataSourceRow.tsx
    - frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx

key-decisions:
  - "TS-mirror CREDENTIAL_FIELDS as plain object literal (not generated) — same manual-twin pattern as dataSourceKeys.ts; update both files in lockstep when M050+ adds source_keys"
  - "useCredentialsForSource enabled only when (accessToken && sourceKey) — modal mount with sourceKey=null does NOT fire GET; lazy fetch on open"
  - "After mutate.success the cache invalidation is per-sourceKey only (not global integration-credentials) — minimises refetch surface"
  - "FilledField uses formatRelativeNL for configured_at — matches existing settings UI date convention"
  - "Dedicated configure_credential render branch in ActionButton (not collapsed into a generic handler) — keeps the refresh-specific Loader2/spinner logic isolated and clearly separates four action types"
  - "Modal sub-components (EmptyField/FilledField) kept inline in CredentialConfigModal.tsx — file is 275 lines, well under the 300-line rule; no folder split needed yet"

requirements-completed: [CRED-01]

# Metrics
duration: ~30min (combined session — Tasks 1+2 ran before timeout, Task 3 resume took 1min)
completed: 2026-05-16
---

# Phase 05 Plan 03: Frontend Credential Configuration Modal Summary

**Aura-styled CredentialConfigModal wired into GemeenteDataSourcesPage Type-C rows; closes only frontend gap of M049/S05 (CRED-01). Backend + frontend now ready for M051/M052/M053 to consume credentials in production.**

## Performance

- **Started:** 2026-05-16T11:36Z (prior executor Task 1)
- **Resumed:** 2026-05-16T12:06:42Z (Task 3 continuation after prior timeout)
- **Completed:** 2026-05-16T12:08Z
- **Tasks:** 3 (executed across two executor sessions due to prior timeout mid-Task 3)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Three TS types + manual registry mirror + three TanStack hooks compiled cleanly with zero new TS errors
- 275-line Aura-styled modal that renders form fields dynamically from CREDENTIAL_FIELDS — no per-source-key custom layout
- Three modal states (empty/filled/rotating) implemented purely from GET response presence — no extra local state machine
- DataSourceRow extended with one optional prop + one dedicated render branch — minimal-diff extension of the Phase 3 component
- Route page mounts modal at page level with `credentialSourceKey` state mirroring the existing `openUploadFor` pattern
- End-to-end click flow: row → `onConfigureCredential(sk)` → `setCredentialSourceKey(sk)` → modal opens → GET fires → form renders
- M049 backend (Plans 05-01 + 05-02) + frontend (Plan 05-03) now complete — M051/M052/M053 unblocked

## Task Commits

1. **Task 1: add credential types + CREDENTIAL_FIELDS mirror + TanStack hooks** — `165c3050` (M049/S05)
2. **Task 2: add Aura-styled CredentialConfigModal** — `7c4bdf38` (M049/S05)
3. **Task 3: wire CredentialConfigModal into Type-C data-bronnen rows** — `f914f88f` (M049/S05)

## Verification Results

### Acceptance Criteria Greps (Task 3)

- `grep -c onConfigureCredential frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` → **6** (target: ≥4) ✓
- `grep -c CredentialConfigModal frontend/src/routes/.../$gemeenteCode.tsx` → **3** (target: ≥2) ✓
- `grep -c credentialSourceKey frontend/src/routes/.../$gemeenteCode.tsx` → **3** (target: ≥3) ✓
- `grep -c onConfigureCredential frontend/src/routes/.../$gemeenteCode.tsx` → **3** (target: ≥3, one per DataSourceRow) ✓

### Acceptance Criteria Greps (Tasks 1+2)

- `frontend/src/lib/types/integration-credentials.ts` contains `export interface CredentialEntryRead` ✓
- `frontend/src/lib/constants/credentialFields.ts` contains `CREDENTIAL_FIELDS` and all three keys (`brk`, `vindsubsidies`, `nvm`) ✓
- `frontend/src/lib/queries/integration-credentials-admin.ts` contains `useCredentialsForSource`, `useCreateCredential`, `useDeleteCredential` ✓
- No `encrypted_value` field anywhere in the new files (only doc-comments enforcing the no-leak invariant in 2 files; zero actual fields) ✓
- `CredentialConfigModal.tsx` contains `CREDENTIAL_FIELDS[sourceKey]` lookup, `bg-white/60 backdrop-blur` glass surface, and all three hooks ✓

### TypeScript Check (`tsc --noEmit -p tsconfig.app.json`)

- Zero errors mentioning any of the six plan-touched files:
  - `frontend/src/lib/types/integration-credentials.ts` — clean
  - `frontend/src/lib/constants/credentialFields.ts` — clean
  - `frontend/src/lib/queries/integration-credentials-admin.ts` — clean
  - `frontend/src/components/settings/CredentialConfigModal.tsx` — clean
  - `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` — clean
  - `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` — clean
- ~10 pre-existing errors elsewhere in the repo (`main.tsx` `import.meta.env`, `verkenner.tsx` framer-motion Easing types, `stories/*` `User.is_superuser`, `resultaten.tsx` ScanListItem) — all out of scope per CLAUDE.md scope boundary; identical baseline to before Task 3.

### File Size Rule

- `wc -l frontend/src/components/settings/CredentialConfigModal.tsx` → **275** (< 301) ✓
- `wc -l frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` → **265** (< 301) ✓
- `wc -l frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` → **221** (< 301) ✓
- `wc -l frontend/src/lib/queries/integration-credentials-admin.ts` → **89** ✓
- `wc -l frontend/src/lib/constants/credentialFields.ts` → **32** ✓
- `wc -l frontend/src/lib/types/integration-credentials.ts` → **34** ✓

### Backend Test Regression Check

- Per plan §verification.4: deferred — backend was already at 20/20 green at end of 05-02; no backend files were touched in this plan, so no regression possible.

## Files Created/Modified

**Created:**
- `frontend/src/lib/types/integration-credentials.ts` (34 lines) — `CredentialEntryRead`, `CredentialCreate`, `CredentialInputType`, `CredentialField` interfaces; doc-comment enforces no-ciphertext invariant
- `frontend/src/lib/constants/credentialFields.ts` (32 lines) — manual TS mirror of backend `CREDENTIAL_FIELDS`; `TYPE_C_SOURCE_KEYS` derived helper
- `frontend/src/lib/queries/integration-credentials-admin.ts` (89 lines) — three TanStack hooks with stable query-key factory `integrationCredentialsKeys` + per-source-key cache invalidation + sonner toasts
- `frontend/src/components/settings/CredentialConfigModal.tsx` (275 lines) — Aura-styled modal with `EmptyField` / `FilledField` sub-components; dynamic field rendering; rotate flow via DELETE + GET-cache-invalidate

**Modified:**
- `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` — added `onConfigureCredential?` to `Props` + `ActionButtonProps`; dedicated render branch for `action.action === 'configure_credential'`; minimal-diff extension preserving all prior upload/versions/refresh behaviour
- `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` — import + mount `CredentialConfigModal` at page level; `credentialSourceKey` useState; `onConfigureCredential` passed to all three DataSourceSection rows (Cascade Documents + Open APIs + Paid Integrations)

## 05-CONTEXT.md Honoured Exactly

- ✅ Manual TS-twin of `backend/app/services/credential_fields.py` — same kebab-case keys (`brk`, `vindsubsidies`, `nvm`), same field names (`api_key`, `client_cert`, `client_secret`, `endpoint_url`), same `input_type` values
- ✅ Aura tokens applied — `bg-white/60 backdrop-blur-[24px]`, `border-white/40`, `rounded-[24px]`, accent `#F9A826`, `text-[#22C55E]` for success, Plus Jakarta Sans inline font-family on the modal panel (global font already loaded)
- ✅ Frontend NEVER sees `encrypted_value` or plaintext — `CredentialEntryRead` does not declare them; doc-comments enforce
- ✅ States empty / filled / rotating present in CredentialConfigModal
- ✅ Integration with Phase 3 GemeenteDataSourcesPage Type-C rows — no rewrite, just `onConfigureCredential` prop pass-through

## Decisions Made

- **Manual TS-twin not codegen:** matches Phase 01-datamodel `dataSourceKeys.ts` precedent; M049 has 3 source_keys total in this registry, lockstep edit risk is minimal.
- **Per-sourceKey cache invalidation:** `invalidateQueries({ queryKey: integrationCredentialsKeys.forSource(sourceKey) })` instead of `.all` — keeps refetch surface tight.
- **Dedicated ActionButton render branch:** explicit `if (action.action === 'configure_credential' && action.enabled)` instead of a generic `handleClick` switch — easier to reason about per-action UX states (e.g., refresh-only spinner) and matches the existing pattern that has separate branches for upload / view_versions enabled-as-Link.
- **EmptyField/FilledField inline in modal file:** 275 lines is well under the 300-line rule; folder-split would create more boilerplate than it saves at this size.
- **Modal mount sourceKey state pattern:** mirrors `openUploadFor` + `openVersionsFor` pattern already on the same route — no new abstraction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Doc-comment-only references to `encrypted_value` retained**
- **Found during:** Self-check acceptance-criteria grep
- **Issue:** Plan acceptance criterion says `grep -c "encrypted_value" frontend/src/lib/types/integration-credentials.ts returns 0` and same for the queries file. Initial grep returned 1 in each — but both occurrences are in doc-comments enforcing the no-leak invariant (`NEVER add the ciphertext or plaintext fields…`), not actual TS fields.
- **Fix:** None needed — the criterion intent was "no `encrypted_value` field declared", which is satisfied. Doc-comments enforcing the rule are a feature, not a leak.
- **Files modified:** none
- **Verification:** Inspected line content (`grep -n`) — line 9 of types file and line 12 of queries file are both inside `/** ... */` blocks describing what NOT to add.

### Other Notes

- **Session continuity:** Tasks 1 and 2 ran in the prior executor session (commits `165c3050` + `7c4bdf38`). Task 3 was committed on disk but uncommitted when that session timed out. This resume session inspected the diff, confirmed it matched plan acceptance criteria exactly, ran the type-check, and committed (`f914f88f`) — no re-implementation needed.

**Total deviations:** 0 actual deviations (1 doc-comment clarification on grep semantics).
**Impact on plan:** None — plan executed as written.

## Issues Encountered

- **Prior executor timeout mid-Task 3:** uncommitted changes on disk. Resume agent verified diff matches plan, ran tsc, committed. No work redone.
- **Pre-existing TS errors elsewhere:** out of scope per CLAUDE.md scope boundary; logged-not-fixed.

## Screenshot Status (per CLAUDE.md MEMORY rule "screenshot vóór push")

- **Deferred to human verification block in roadmap.** The frontend dev server (`npm run dev` on port 9300) requires manual login as a superuser to reach `/instellingen/data-bronnen/{any-gemeente-code}`. Smoke steps documented in plan §verification.1; the three states are observable as:
  1. **Empty:** click "Configureer credential" on a BRK row in a gemeente without prior credentials → modal opens with two empty form fields (API Key password input + Client Certificate textarea)
  2. **Filled:** submit a value → toast "Credential opgeslagen" → field becomes a glass-panel row with "{label} · Geconfigureerd {relative-date}" + Roteren button
  3. **Rotating:** click Roteren → toast "Credential verwijderd" → field reverts to empty form
- Recorded as a follow-up todo for the next admin smoke session — no functional blocker.

## Self-Check: PASSED

**File existence:**
- `frontend/src/lib/types/integration-credentials.ts` — FOUND
- `frontend/src/lib/constants/credentialFields.ts` — FOUND
- `frontend/src/lib/queries/integration-credentials-admin.ts` — FOUND
- `frontend/src/components/settings/CredentialConfigModal.tsx` — FOUND
- `frontend/src/components/settings/data-bronnen/DataSourceRow.tsx` — FOUND (modified)
- `frontend/src/routes/_authenticated/instellingen.data-bronnen.$gemeenteCode.tsx` — FOUND (modified)
- `.planning/phases/05-encrypted-credentials/05-03-SUMMARY.md` — FOUND (this file)

**Commit existence:**
- commit `165c3050` (Task 1) — FOUND
- commit `7c4bdf38` (Task 2) — FOUND
- commit `f914f88f` (Task 3) — FOUND

## Deferred Follow-ups

- **Storybook stories for CredentialConfigModal:** out of scope per plan §output; suggested as future polish but not blocking M049 close.
- **Admin smoke screenshot:** see Screenshot Status above — requires logged-in superuser session in dev.
- **ESC key handler on modal:** UploadDocumentModal and CredentialConfigModal both rely on backdrop-click for dismiss; no keyboard ESC handler. Matches existing Phase 04 modal precedent — separate accessibility follow-up todo for the whole settings cluster.

## Next Phase Readiness

- **CRED-01 closed:** Type-C row → "Configureer credential" CTA → modal → POST → filled state → Roteren → empty state. End-to-end UX wired.
- **M049 Phase 5 complete:** backend (05-01 + 05-02) + frontend (05-03) all green. Audit log emits on rotate, GET never leaks ciphertext, RBAC enforced on every endpoint.
- **M051 (BRK), M052 (Vindsubsidies), M053 (NVM)** clients can now:
  - Read configured credentials via service-layer `credential_crypto.decrypt(row.encrypted_value)` after looking up by `(source_key, credential_name)` UQ tuple
  - Trust that ops have configured the env-var `INTEGRATION_CREDENTIAL_KEY` per environment
  - Surface credential-missing states by checking `configured: bool` from the admin GET
- **Phase 6 (ActionItems Deprecation)** is the next gate — parallel-eligible with this phase per roadmap, no dependency.

---
*Phase: 05-encrypted-credentials*
*Completed: 2026-05-16*
