---
phase: 07-visual-qa-aura-conformance
verified: 2026-05-17T12:15:00Z
status: partial
score: 4/5 must-haves verified
re_verification: null
human_verification:
  - test: "S05 three-state credential UX (filled → rotating → empty-after-rotate)"
    expected: "CredentialConfigModal form renders fields, accepts submit, transitions through configured → rotating → empty states with toast feedback"
    why_human: "Blocked by two NEW backend gaps surfaced during Phase 7 visual sweep (Type-C trigger gate hardcoded enabled=false + CREDENTIAL_FIELDS short-key vs catalog long-key mismatch). Three-state UX cannot be exercised end-to-end until follow-up phase closes those gaps."
gaps:
  - truth: "Visual smoke set in screenshots/ covers all 10 deferred items from audit"
    status: partial
    reason: "7/10 captured (S03 complete 3/3, S04 complete 3/3, S05 #7 modal-opens captured). #8/#9/#10 deferred — blocked by S05 backend gaps that exist in shipped M049/S05 code and were not in Phase 7 scope. Honest deferral, documented in deferred-items.md + audit Phase 7 Closure section."
    artifacts:
      - path: ".planning/phases/07-visual-qa-aura-conformance/screenshots/s05-credential-modal-filled.png"
        issue: "MISSING — blocked by CREDENTIAL_FIELDS source_key mismatch (form does not render)"
      - path: ".planning/phases/07-visual-qa-aura-conformance/screenshots/s05-credential-modal-rotating.png"
        issue: "MISSING — blocked by same backend gap (cannot submit form)"
      - path: ".planning/phases/07-visual-qa-aura-conformance/screenshots/s05-credential-modal-empty-after-rotate.png"
        issue: "MISSING — blocked by same backend gap (cannot rotate)"
    missing:
      - "Flip configure_credential gate in backend/app/admin/data_sources_helpers.py:50-62 (enabled=false → enabled=true)"
      - "Resolve CREDENTIAL_FIELDS short-key vs catalog long-key mismatch in backend/app/services/credential_fields.py"
      - "Recapture S05 three-state UX smokes after gate + key resolver land"
---

# Phase 7: Visual QA & Aura Conformance Sweep — Verification Report

**Phase Goal:** Sluit alle deferred visual-smoke items uit S03/S04/S05 in één browser-sessie + polish de INT-03 banner deeplink zodat hij naar de actieve gemeente verwijst i.p.v. de index.

**Verified:** 2026-05-17T12:15:00Z
**Status:** partial
**Re-verification:** No — initial verification

## Verdict

Phase 7 achieved its primary deliverable (INT-03 promoted from `partial` to `wired` with real code + Storybook coverage + live browser proof) and 70% of the visual smoke target. The 3 deferred smokes (S05 #8/#9/#10) are blocked by two **newly-discovered** backend gaps in the shipped M049/S05 code, not by Phase 7 scope failure. The audit file correctly downgrades the S05 row from `human_needed` to `partial` (NOT `passed`) and documents both gaps + a follow-up phase recommendation.

This is `partial`, not `passed`, because one of the five must-haves (visual smoke set covers 10 deferred items) is only 7/10. It is also not `gaps_found`, because the deferral is honest, root-caused, documented, and out-of-scope per the audit's own classification of the S05 backend gaps as M049/S07.1 follow-up work.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | INT-03 deeplink gemeente-aware (live href = `/instellingen/data-bronnen/{gemeenteCode}` when resolvable, fallback to index when not) | VERIFIED | `instellingen.beleid-beheer.tsx:14-41` renders conditional `<Link>` with `params={{ gemeenteCode: firstGemeenteCode }}`; Storybook `WithGemeente` + `WithoutGemeente` play functions assert both branches; live browse session captured `href="/instellingen/data-bronnen/GM0983"` in `s04-banner-after.png` |
| 2 | Visual smoke set covers all 10 deferred items from audit | PARTIAL (7/10) | S03 complete (3 PNGs), S04 complete (3 PNGs), S05 #7 modal-opens captured. #8/#9/#10 deferred — blocked by S05 backend gaps (not Phase 7 scope). Honest deferral documented in deferred-items.md + audit Phase 7 Closure |
| 3 | Non-superuser smoke proves Data-bronnen pill hidden + redirect | VERIFIED | `s03-nonsuperuser-tabnav.png` (tom@propdex.nl session, no Data-bronnen pill in tab nav) + `s03-nonsuperuser-redirect.png` (direct nav to `/instellingen/data-bronnen` → `/instellingen` URL inspection) |
| 4 | Regression sweep green (backend M049 corpus + frontend npm run check baseline unchanged) | VERIFIED | `regression-sweep.txt`: backend 44 passed + 1 intentional skip in 131.71s; frontend baseline 91 TS errors unchanged (stash-verified during 07-01) |
| 5 | Audit file flips applied per 07-CONTEXT.md spec | VERIFIED | All 8 surgical edits applied: scores.flows updated, gaps.integration:[], S03 → passed/6/6, S05 → partial (correct — NOT passed since three-state UX deferred), S04 notes updated, Cross-Phase Integration says 9/9 wired, INT-03 paragraph rewritten, `## Phase 7 Closure` section appended at line 146 |

**Score:** 4/5 truths verified (truth #2 is `partial` — see deferral rationale above)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/routes/_authenticated/instellingen.beleid-beheer.tsx` | BeleidBeheerWithBanner wrapper with `useGemeentenSummary` + gemeente-aware Link | VERIFIED | 42 lines (under 60-line cap). Contains `useGemeentenSummary` import + call, conditional `<Link to="/instellingen/data-bronnen/$gemeenteCode" params={{ gemeenteCode: firstGemeenteCode }}>` branch, fallback `<Link to="/instellingen/data-bronnen">` branch. Banner copy byte-for-byte unchanged. Tailwind classes preserved. |
| `frontend/src/components/settings/beleid/BeleidBeheerBanner.stories.tsx` | Storybook stories with `WithGemeente` + `WithoutGemeente` exports + play functions | VERIFIED | 148 lines (< 200 cap). Imports `from 'storybook/test'` (Storybook 10 path); zero matches for legacy `@storybook/test`. Both stories present with play-function href assertions. |
| `.planning/phases/07-visual-qa-aura-conformance/screenshots/` | 10 PNGs covering S03/S04/S05/non-superuser/three-state UX | PARTIAL | 7 PNGs present, non-zero size (94–131 KB each). 3 deferred: `s05-credential-modal-filled.png`, `s05-credential-modal-rotating.png`, `s05-credential-modal-empty-after-rotate.png` (blocked by S05 backend gaps). |
| `.planning/phases/07-visual-qa-aura-conformance/design-token-grep.txt` | Token grep evidence for bg-white/60, backdrop-blur, Plus Jakarta Sans, amber, mist across S03/S04/S05 surfaces | VERIFIED | Per-file counts table + global Plus Jakarta Sans inheritance via Tailwind v4 @theme. Honest report: several components use raw Tailwind utilities (`bg-amber-100`, hex literals) rather than `aura-*` token aliases — rendered output remains DESIGN.md-conform per visual evidence; canonicalisation flagged as out-of-scope follow-up. |
| `.planning/phases/07-visual-qa-aura-conformance/regression-sweep.txt` | Backend + frontend exit-code summaries | VERIFIED | Documents backend command (8 integration test files), result (44 passed, 1 skipped, exit 0), and frontend baseline (91 pre-existing TS errors, zero introduced by Phase 7) |
| `.planning/M049-MILESTONE-AUDIT.md` | 8 surgical edits applied + `## Phase 7 Closure` section appended | VERIFIED | All 8 edits applied. `## Phase 7 Closure (M049/S07 — 2026-05-17)` section present at line 146. INT-03 paragraph rewritten at line 97. Zero matches for retired strings: `INT-03-deeplink`, `human visual smokes pending`, `8 fully wired`. S05 row says `partial` (not `passed`) which is the correct honest classification. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `instellingen.beleid-beheer.tsx` | `data-sources-admin.ts` (useGemeentenSummary) | hook import + call | WIRED | Line 3 import, line 15 call, line 16 read of `data?.[0]?.gemeente_code` |
| `instellingen.beleid-beheer.tsx` | `/instellingen/data-bronnen/$gemeenteCode` route | TanStack `<Link to params>` | WIRED | Lines 25-31 conditional branch with type-safe `params` object (not template string) |
| `M049-MILESTONE-AUDIT.md Phase 7 Closure` | `screenshots/` directory | Markdown link references | WIRED | Lines 152-155 enumerate each captured PNG by filename |
| `M049-MILESTONE-AUDIT.md gaps.integration` | INT-03 wired state | Empty list (entry removed) | WIRED | Line 12: `integration: []` — INT-03-deeplink entry removed from frontmatter |
| Live browser session | gemeente-aware deeplink | Banner href inspection | WIRED | Captured href = `/instellingen/data-bronnen/GM0983` in `s04-banner-after.png` (note: real `gemeente_code` in DB is `GM0983` with prefix, story-args mock uses bare `0983` — both branches still proven; live URL takes precedence as wiring evidence) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| INT-03 | 07-01 + 07-02 | Beleid-beheer migration banner deeplink → gemeente-specific page | SATISFIED | `useGemeentenSummary` resolves `firstGemeenteCode`; conditional Link points to `$gemeenteCode` route when present, falls back to index when not. Storybook covers both branches. Live browse session confirms href = `/instellingen/data-bronnen/GM0983`. Audit file promoted from `partial` to `wired` and INT-03-deeplink removed from `gaps.integration`. |

No new requirements opened by this phase (gap-closure phase per ROADMAP).

### Anti-Patterns Found

None of significance. Phase 7 introduced zero new code-quality regressions:
- `instellingen.beleid-beheer.tsx` is 42 lines (well under 300-line cap, well under plan's 60-line cap).
- `BeleidBeheerBanner.stories.tsx` is 148 lines (under 200-line cap).
- Zero new TS errors introduced (stash-verified).
- Backend-side temporary mutations (Type-C trigger gate flip) used to capture `s05-credential-modal-empty.png` were reverted via `git checkout`; git tree clean at end of phase.
- Test-only DB rows (qa-phase7@propdex.nl + uploaded test-doc.pdf) cleaned up after capture.

### Human Verification Required

#### 1. S05 Three-State Credential UX

**Test:** Capture screenshots #8/#9/#10 (`s05-credential-modal-filled.png`, `s05-credential-modal-rotating.png`, `s05-credential-modal-empty-after-rotate.png`) covering form submit → DELETE rotate → empty re-render with toast + transition.
**Expected:** CredentialConfigModal accepts dummy credential data, submits successfully, transitions to `configured: true` indicator, accepts rotate action, transitions through DELETE-in-flight to empty form state with toast feedback per state.
**Why human:** Blocked by two NEW backend gaps surfaced during Phase 7 sweep — (a) Type-C `configure_credential` trigger hardcoded `enabled=false` in `backend/app/admin/data_sources_helpers.py:50-62`, (b) CREDENTIAL_FIELDS short-key vs catalog long-key mismatch in `backend/app/services/credential_fields.py`. Both gaps are in shipped M049/S05 code (not Phase 7 scope) and require eng-review for the resolver approach before the three-state UX can be exercised end-to-end. Documented in `deferred-items.md` + audit Phase 7 Closure section with a follow-up M049/S07.1 phase recommendation.

### Gaps Summary

Phase 7 achieved its core deliverable: INT-03 deeplink is wired with type-safe TanStack Router params, banner copy preserved byte-for-byte, Storybook play functions cover both Link branches, and the live browser session captured the deeplink rendering `href="/instellingen/data-bronnen/GM0983"`. The audit file is correctly updated per the 07-CONTEXT.md spec — every surgical edit landed, the Phase 7 Closure section is appended with full evidence inventory.

The single must-have that lands at `partial` is the visual smoke set (7/10). This is **not a Phase 7 execution failure** — it is the surfacing of two pre-existing M049/S05 backend gaps that block end-to-end three-state UX exercise. The phase did the honest thing: captured what was capturable (#7 modal-opens proves Aura tokens render on the surface), root-caused the blocker for #8/#9/#10, documented both gaps with single-line fix scopes, and recommended a follow-up phase. Critically, the audit's S05 row was downgraded to `partial` (not falsely flipped to `passed`) which is the correct integrity-preserving move.

**Why this is `partial` rather than `passed`:** The phase's must-have #2 (full visual smoke set) is 70% done. ROADMAP phase 7 success criterion 1 ("Screenshot set covering before/after for S03/S04/S05 smokes") is not 100% met. Honesty over score-padding.

**Why this is `partial` rather than `gaps_found`:** The deferred items are not Phase 7 gaps — they are M049/S05 backend gaps that Phase 7 surfaced through diligent visual sweep. The audit explicitly classifies them as M049/S07.1 follow-up work. INT-03 is fully closed (the phase's primary stated objective). The remaining 3 smokes have a concrete recapture path documented.

**Recommended next step:** Open a follow-up phase (`M049/S07.1` or `08-credential-gap-closure`) to (a) flip the configure_credential gate in `data_sources_helpers.py:50-62` (single-line fix), (b) resolve the CREDENTIAL_FIELDS short-key vs catalog long-key mismatch in `credential_fields.py` (eng-review needed on resolver approach), (c) recapture the three S05 three-state UX smokes. After that phase lands, this VERIFICATION.md can be re-run and the S05 row in the audit can be flipped from `partial` to `passed`.

---

_Verified: 2026-05-17T12:15:00Z_
_Verifier: Claude (gsd-verifier)_
