---
milestone: M049
audited: 2026-05-16T17:45:00Z
status: tech_debt
scores:
  requirements: 33/33
  phases: 7/8 verified (04.2 inserted phase has SUMMARY-only)
  integration: 8/9 fully wired (INT-03 banner partial)
  flows: 4/4 e2e flows traceable; 10/10 Phase-7 visual smokes captured (S05 three-state UX closed in M049/S07.1)
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 03-data-sources-ux
    items:
      - "Visual smoke against DESIGN.md (Morning Mist / Pure Glass / Plus Jakarta Sans / Aura tokens) — explicit human_needed per verifier"
      - "Non-superuser session check (Data-bronnen tab hidden + direct nav redirect) — needs live JWT"
  - phase: 04-m045-upload-flow-integratie
    items:
      - "End-to-end upload flow (DOM state transitions, network probe timing, pre-selection)"
      - "Bekijk versies modal (backdrop click, version list rendering)"
      - "Beleid-beheer banner deeplink visual check"
  - phase: 04.2-security-hardening-strip-scoring-internals-from-public-api
    items:
      - "No VERIFICATION.md created — only SUMMARY.md. Inserted security phase (not in original M049 REQUIREMENTS) but advanced Alembic chain. 42/42 tests + alembic upgrade verified per SUMMARY; absent verifier audit-trail."
  - phase: 05-encrypted-credentials
    items:
      - "Aura-conform CredentialConfigModal visual screenshot deferred (per 05-03-SUMMARY)"
      - "Three-state UX (empty/filled/rotating) toast + transition smoke"
      - "DESIGN.md token conformance (bg-white/60 + #F9A826 + Plus Jakarta Sans) — human responsibility"
  - phase: 06-actionitems-deprecation
    items:
      - "T4 test_e2e_action_item_db_entity_preserved SKIPPED — audit signal that no ActionItem SQLAlchemy model ever existed (frontend-only legacy). Intentional, but reduces verifier confidence."
      - "MIG-02 is SPA client-side redirect, not literal HTTP 301 — documented divergence."
nyquist:
  compliant_phases: 0
  partial_phases: 1   # 02-admin-api-layer (VALIDATION.md exists, nyquist_compliant: false, wave_0_complete: false)
  missing_phases: 7   # 01, 03, 04, 04.1, 04.2, 05, 06
  overall: gap        # /gsd:validate-phase needed across the milestone if Nyquist discipline is to be enforced retroactively
---

# M049 Milestone Audit — Data Sources per Gemeente hub

**Audited:** 2026-05-16T17:45:00Z
**Status:** `tech_debt` — all 33 requirements satisfied, no critical blockers, accumulated visual-smoke + audit-trail debt needs review before complete-milestone.

## Scope

| | |
|---|---|
| Milestone | M049 — Data Sources per Gemeente hub |
| Kickoff | 2026-05-14 |
| Phases | 8 (S01, S02, S03, S04, **S04.1**, **S04.2**, S05, S06) |
| Requirements (M049 traceability) | 33/33 marked Complete |
| Inserted phases | S04.1 (manual upload rescore), S04.2 (security hardening — strip scoring internals) |
| Alembic chain head | `79117298d1ad` (single head, chain unbroken) |

## Phase Verification Matrix

| Phase | VERIFICATION.md | Status | Score | Notes |
|---|---|---|---|---|
| 01-datamodel-source-key-catalog | ✓ | passed | 5/5 | 42-entry catalog (>27); 23/23 tests; no TenantMixin; Python↔TS twin verified |
| 02-admin-api-layer | ✓ | passed | 7/7 | 15/15 integration tests; advisory-lock idempotency; RBAC verified |
| 03-data-sources-ux | ✓ | passed | 6/6 | All wiring + Aura tokens verbatim; Phase 7 captured visual smokes (s03-aura-tokens-after, non-superuser tabnav + redirect) |
| 04-m045-upload-flow-integratie | ✓ | passed | 5/5 | INT-01..04 wired; Phase 7 captured upload-modal + versions-modal + banner-deeplink visual smokes; INT-03 banner now gemeente-aware (M049/S07) |
| 04.1-manual-upload-rescore | ✓ | passed | 7/7 | Re-verified after 300-line gap closure; 6/6 + 18/18 regression green |
| **04.2-security-hardening** | **✗** | **summary-only** | — | Inserted (not in M049 REQUIREMENTS); SUMMARY reports 42/42 tests + alembic OK, no verifier sign-off |
| 05-encrypted-credentials | ✓ | passed | 5/5 | 20/20 backend tests; MultiFernet rotation proven; Phase 7 captured modal-opens smoke; Phase 7.1 closed three-state UX (filled/rotating/empty-after-rotate) after fixing Type-C trigger gate + source_key aliasing. See Phase 7.1 Closure. |
| 06-actionitems-deprecation | ✓ | passed | 8/8 | E2E smoke + legacy component deleted; T4 SKIPPED (audit-only) |

## Requirements Coverage (3-source cross-reference)

All 33 M049 requirements pass the VERIFICATION.md × SUMMARY frontmatter × REQUIREMENTS.md traceability gate:

| Category | Count | All satisfied? |
|---|---|---|
| DATA-01..05 | 5 | ✓ |
| API-01..05 | 5 | ✓ |
| UX-01..06 | 6 | ✓ |
| INT-01..04 | 4 | ✓ (INT-04 reinforced by S04.1) |
| CRED-01..04 | 4 | ✓ |
| MIG-01..03 | 3 | ✓ |
| TEST-01..06 | 6 | ✓ |

**Orphans:** 0
**Unsatisfied:** 0

## Cross-Phase Integration (from integration-checker)

- 9 cross-phase connections checked, 9/9 fully wired (INT-03 deeplink promoted to wired in M049/S07)
- 0 orphaned exports
- 0 unprotected admin endpoints (all `Depends(get_current_superuser)`)
- 4 E2E flows traceable: onboarding, credential, action-item, legacy-paths
- Alembic chain integrity verified: `657143b79099 → b2a4f6c8e1d3 → ad5af9028eb1 → 79117298d1ad` (single head)

### INT-03 (wired)
`/instellingen/beleid-beheer` banner now links to `/instellingen/data-bronnen/$gemeenteCode` when `useGemeentenSummary()` resolves a gemeente, falling back to the index `/instellingen/data-bronnen` when none is known. Resolved in M049/S07 Plan 07-01 (commits `7ba5feac` + `9d6c7103`). Verified in Phase 7 browse session — banner href = `/instellingen/data-bronnen/GM0983` (see `screenshots/s04-banner-after.png`).

## Nyquist Coverage

| Phase | VALIDATION.md | Compliant | Action |
|---|---|---|---|
| 01 | missing | — | `/gsd:validate-phase 01` |
| 02 | exists | nyquist_compliant: false / wave_0_complete: false | `/gsd:validate-phase 02` (close wave-0) |
| 03 | missing | — | `/gsd:validate-phase 03` |
| 04 | missing | — | `/gsd:validate-phase 04` |
| 04.1 | missing | — | `/gsd:validate-phase 04.1` |
| 04.2 | missing | — | `/gsd:validate-phase 04.2` |
| 05 | missing | — | `/gsd:validate-phase 05` |
| 06 | missing | — | `/gsd:validate-phase 06` |

**Nyquist verdict:** gap. M049 was run without per-phase validation contracts. Either accept (treat as documentation gap) or backfill before complete-milestone.

## Tech Debt — by Phase

### S03 — data-sources-ux
- Aura visual smoke (Morning Mist + Pure Glass + Plus Jakarta Sans)
- Non-superuser DOM-level redirect check

### S04 — m045-upload-flow-integratie
- 3 human smoke paths (upload e2e, version modal, banner deeplink visual)
- INT-03 deeplink not gemeente-aware

### S04.2 — security-hardening (inserted)
- No VERIFICATION.md (SUMMARY-only)
- Phase is **outside M049 REQUIREMENTS.md** traceability — security insertion sandwich-stacked into the Alembic chain

### S05 — encrypted-credentials
- 3 visual smokes deferred (modal Aura conformance, three-state UX, DESIGN.md tokens)

### S06 — actionitems-deprecation
- T4 SKIPPED (DB entity-preservation audit returns no-op because no SQLAlchemy model ever existed — legacy was frontend-only)
- MIG-02 redirect is SPA client-side, not literal HTTP 301 — documented divergence

## Recommendation

Status `tech_debt`: No critical blockers. Either:

**A.** Accept debt → `/gsd:complete-milestone M049` and capture in backlog (4 visual smokes + S04.2 VERIFICATION.md backfill + Nyquist gap)

**B.** Close debt first → `/gsd:plan-milestone-gaps` to address visual smokes + S04.2 verifier sign-off + (optionally) backfill VALIDATION.md across phases

---

## Phase 7 Closure (M049/S07 — 2026-05-17)

**INT-03 promoted from `partial` to `wired`** via M049/S07 Plan 07-01:
- `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx` — banner Link resolves `useGemeentenSummary()` → `<Link to="/instellingen/data-bronnen/$gemeenteCode">`; falls back to index when no gemeente.
- `frontend/src/components/settings/beleid/BeleidBeheerBanner.stories.tsx` — `WithGemeente` + `WithoutGemeente` play functions cover both branches.

**Visual smokes captured** (`.planning/phases/07-visual-qa-aura-conformance/screenshots/`):
- S03: `s03-aura-tokens-after.png` (Morning Mist canvas, Pure Glass surface, Plus Jakarta Sans, status pills, amber active tab), `s03-nonsuperuser-tabnav.png` (Data-bronnen pill absent for tom@propdex.nl), `s03-nonsuperuser-redirect.png` (direct nav `/instellingen/data-bronnen` → `/instellingen` confirmed via URL inspection).
- S04: `s04-upload-after.png` (UploadDocumentModal pre-filled with `GM0983 · Venlo` + `Omgevingsvisie`), `s04-versions-modal.png` (Versiegeschiedenis with v1 row + Bekijk/Download actions), `s04-banner-after.png` (banner with `href=/instellingen/data-bronnen/GM0983`).
- S05: `s05-credential-modal-empty.png` (modal opens with `Credential configureren · brk-eigendom` header + amber lock icon + `Versleuteld opgeslagen (Fernet, vendor-managed)` subtitle).

**Visual smokes deferred** (3): S05 #8 filled / #9 rotating / #10 empty-after-rotate.

**Two new S05 backend gaps surfaced during Phase 7 visual smoke** (see `.planning/phases/07-visual-qa-aura-conformance/deferred-items.md`):
1. **Type-C configure_credential trigger gate hardcoded `enabled=false`** in `backend/app/admin/data_sources_helpers.py:50-62`. Was meant to flip on S05 ship; never did. Single-line fix. Phase 7 captured evidence by temporarily flipping the gate in working tree (reverted, not committed).
2. **CREDENTIAL_FIELDS source_key mismatch** — `backend/app/services/credential_fields.py` registers short keys (`brk`, `vindsubsidies`, `nvm`) while catalog emits long kebab-case (`brk-eigendom`, …). Modal renders header but form fails to populate. Needs eng-review on resolver approach.

**Regression sweep** (`.planning/phases/07-visual-qa-aura-conformance/regression-sweep.txt`):
- Backend M049 corpus: 44 passed, 1 skipped (intentional `test_e2e_action_item_db_entity_preserved` — audit-only).
- Frontend `npm run check`: 91 pre-existing TS errors unchanged; zero introduced by Phase 7.

**DESIGN.md token grep** (`.planning/phases/07-visual-qa-aura-conformance/design-token-grep.txt`):
- Canonical tokens declared in `frontend/src/styles/index.css` @theme.
- Component-level coverage uneven (some files use raw Tailwind utilities + hex literals rather than `aura-*` token aliases); rendered output remains DESIGN.md-conform per visual evidence. Out-of-scope for Phase 7 closure; flag for a future token-canonicalisation pass.

**Follow-up phase recommended:** A small `M049/S07.1` (or a new gap-closure milestone slot) to (a) flip the configure_credential gate, (b) resolve the CREDENTIAL_FIELDS key mismatch, (c) capture the three remaining S05 three-state UX smokes. Out-of-scope for this phase.

## Phase 7.1 Closure (M049/S07.1 — 2026-05-17)

The two backend gaps surfaced in Phase 7 are resolved and the three deferred S05 visual smokes are captured.

**Backend fixes:**
- `backend/app/admin/data_sources_helpers.py` (commit `9c9819b5`) — Type-C `Action(configure_credential, enabled=False, reason_disabled="Beschikbaar vanaf S05")` flipped to `enabled=True`. Refresh action still disabled with new reason "Beschikbaar zodra credential geconfigureerd is" (M051+ wires the actual refresh).
- `backend/app/services/credential_fields.py` (commit `d96802b9`) — added `SOURCE_KEY_TO_PROVIDER` alias map (`brk-eigendom`/`brk-hypotheken`/`brk-beslagen` → `brk`; `nvm-transactiedata` → `nvm`; `vindsubsidies-database` → `vindsubsidies`) + `provider_for()` helper. `valid_names_for()` resolves through it.
- `backend/app/admin/integration_credentials_router.py` (same commit) — all `in CREDENTIAL_FIELDS` checks resolve through `provider_for()` first. DB rows store `source_key = provider_for(input)` so the BRK family shares one credential namespace at Haal-Centraal.

**Frontend fixes (same commit `d96802b9`):**
- `frontend/src/lib/constants/credentialFields.ts` — mirror `SOURCE_KEY_TO_PROVIDER` + `providerFor()`. Manual TS-twin pattern per M049/S05 Plan 03.
- `frontend/src/components/settings/CredentialConfigModal.tsx` — resolve provider before API calls; display label reads provider name (e.g. "BRK (Kadaster)") while the row source_key stays in the prop.

**Visual smokes captured** (commit `<screenshots commit>`):
- `s05-credential-modal-filled.png` — `API Key: Geconfigureerd 2 uur geleden` + Roteren button + `Credential opgeslagen` toast; header reads `Credential configureren · BRK (Kadaster)` (provider label proves resolution works end-to-end).
- `s05-credential-modal-rotating.png` — DELETE in flight; form transitions back to EMPTY state.
- `s05-credential-modal-empty-after-rotate.png` — `Credential verwijderd` toast + EMPTY form ready for re-entry.

**Regression sweep:**
- `pytest backend/tests/integration/test_integration_credentials_router.py + test_admin_data_sources_router.py + test_admin_data_sources_rbac.py`: 30 passed in 122.72s. Existing short-key inputs unchanged because `SOURCE_KEY_TO_PROVIDER.get(short_key, short_key)` returns the short key.

**S05 row in Phase Verification Matrix promoted from `partial` to `passed`** (5/5).

_Audited: 2026-05-16T17:45:00Z_
_Auditor: Claude (gsd audit-milestone)_
_Phase 7 closure: 2026-05-17 — Claude (M049/S07)_
_Phase 7.1 closure: 2026-05-17 — Claude (M049/S07.1)_
