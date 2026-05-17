# Phase 07: Visual QA & Aura Conformance Sweep — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning
**Source:** Gap-closure derivation from `.planning/M049-MILESTONE-AUDIT.md` + ROADMAP phase 7 entry

<domain>
## Phase Boundary

**This phase closes the tech-debt accumulated in M049 phases S03/S04/S05** identified by the milestone audit (`tech_debt` status, all 33 requirements remain `Complete`). Two work-classes:

1. **One real code change** — `INT-03` deeplink polish: `beleid-beheer` migration banner currently points to `/instellingen/data-bronnen` (the index). It must instead point to `/instellingen/data-bronnen/{currentGemeenteCode}` when a gemeente context is available, and fall back to the index when not.

2. **Visual QA sweep** — capture before/after screenshots covering deferred human_needed items in S03 / S04 / S05 to prove Aura DESIGN.md conformance and three-state UX. No new components, no design shifts; this is verification work supported by minimal smoke-evidence artifacts.

**Out of scope:**
- Nyquist VALIDATION.md backfill for M049 phases (audit lists this as separate concern; accept as documentation gap)
- S04.2 retroactive VERIFICATION.md (audit recommends accept-debt route)
- Any new feature behaviour, schema change, route reshuffle, or styling overhaul
- M050+ extractor wiring (the cascade rescore source-key list stays unchanged)

</domain>

<decisions>
## Implementation Decisions

### Plan structure
- **Plan 07-01: INT-03 deeplink gemeente-aware** — code change in the `BeleidBeheerWithBanner` wrapper (or equivalent route-level wrapper added in M049/S04). Read current gemeente from existing context (user default gemeente / router context / `useCurrentGemeenteCode`-style hook). When known: render TanStack `<Link to="/instellingen/data-bronnen/$gemeenteCode" params={{ gemeenteCode }}>`. When unknown: keep current index-link fallback. Storybook play function covers both states.
- **Plan 07-02: Visual QA sweep + audit closure** — browser session over running dev server (port 9300) capturing the four deferred human-needed flows from the audit. Save before/after screenshots in `.planning/phases/07-visual-qa-aura-conformance/screenshots/`. Update `.planning/M049-MILESTONE-AUDIT.md` to flip S03/S04/S05 verifications to `passed` and INT-03 from `partial` to `wired`.

### Wave order
- Wave 1: 07-01 only (code change must land first so the visual smoke in 07-02 also covers the deeplink working end-to-end against the real router context).
- Wave 2: 07-02 (visual sweep + audit closure).

### INT-03 deeplink contract (locked)
- Source of truth: `frontend/src/routes/instellingen/beleid-beheer.tsx` (the `BeleidBeheerWithBanner` wrapper — confirmed in M049/S04 decisions in STATE.md).
- Gemeente resolution priority: (1) route param or active context if user is currently scoped to a gemeente, (2) user's default gemeente from auth/profile, (3) `null` → fallback to index link.
- No new hook unless the lookup pattern doesn't already exist (`useCurrentGemeenteCode`-style); prefer the same pattern that the `SettingsTabNav` Data-bronnen pill uses to resolve the deeplink — there is already prior art from M049/S03.
- Type-safe: TanStack Router `<Link>` with `params` object, not template-string interpolation.
- Banner copy stays unchanged — only the `to` target adapts.

### Visual smoke checklist (locked from audit + roadmap success criteria)
S03 — data-sources-ux:
- DESIGN.md token verification: Morning Mist `#F2F6F3` canvas, Pure Glass `bg-white/60 backdrop-blur-[24px]`, Plus Jakarta Sans font-family, status-pill palette (Vitality Green / red / amber / neutral), SettingsTabNav active-pill amber accent.
- Non-superuser session: log in as a non-superuser, prove `Data-bronnen` SettingsTabNav pill is hidden, prove direct nav to `/instellingen/data-bronnen` redirects to `/instellingen` (or the appropriate landing).

S04 — m045-upload-flow-integratie:
- End-to-end upload smoke: open upload modal from a data-source row → file upload → post-upload status flip on the row.
- "Bekijk versies" modal: opens with version list, backdrop click dismisses.
- `beleid-beheer` banner visual: banner renders + link target (post 07-01 fix) lands on the gemeente-specific data-bronnen page.

S05 — encrypted-credentials:
- `CredentialConfigModal` Aura tokens: glass surface, amber accents, Plus Jakarta Sans, Aura input styling.
- Three-state UX: empty → fill credential → submit → rotating (DELETE → empty form re-renders); toast + transition visible per state.
- DESIGN.md token grep: `bg-white/60`, `#F9A826` (or `text-aura-amber` token), `font-jakarta`/`Plus Jakarta Sans`, `#F2F6F3` (or `bg-aura-mist`) — grep-verifiable.

### Regression sweep (lightweight)
- Backend: `pytest backend/tests/` for M049 corpus only — green (already known green per audit, this is a re-confirm).
- Frontend type/lint: `npm run check` — green.
- Storybook: visual sweep of relevant `*.stories.tsx` files mentioned in M049 phases — no new regressions (no separate test command needed; spot-check via `npm run storybook` during the visual sweep).

### Audit file update (locked)
After visual sweep, edit `.planning/M049-MILESTONE-AUDIT.md`:
- `scores.phases`: keep `7/8 verified (04.2 inserted phase has SUMMARY-only)` — S04.2 stays out of scope.
- `scores.flows`: drop the "4 human visual smokes pending" trailer.
- `gaps.integration`: remove the INT-03-deeplink entry (now wired).
- Phase Verification Matrix rows for 03/05: flip `human_needed` → `passed`. S04 row already says `passed`; leave the human-smoke trailer text accurate to what was checked.
- INT-03 paragraph: rewrite to state the deeplink is now gemeente-aware via `useCurrentGemeenteCode`-style resolution.
- Append a `## Phase 7 Closure` section with a brief summary + pointer to `.planning/phases/07-visual-qa-aura-conformance/screenshots/`.

### Claude's Discretion
- Exact file path for the gemeente-resolution helper (re-use existing hook if found in `frontend/src/lib/hooks/` or `frontend/src/lib/queries/`; otherwise inline the lookup in the wrapper component — no new module created speculatively).
- Screenshot file naming convention (suggested: `{phase}-{flow}-{before|after}.png`, e.g. `s03-aura-tokens-before.png`).
- Whether the visual sweep needs the `gstack` browser skill / `/browse` skill or just a manual screenshot pass on the dev server — planner can choose, but should pick one and lock it in the plan.
- Test approach for 07-01: Storybook play function covering both Link targets is the minimum; vitest unit isn't required if Storybook covers it.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit + roadmap inputs
- `.planning/M049-MILESTONE-AUDIT.md` — the gap source-of-truth. Read frontmatter `tech_debt` + Tech Debt by Phase + INT-03 paragraph.
- `/home/klarifai/.gsd/projects/0fbd70b53f1b/milestones/M049/M049-ROADMAP.md` §S03/S04/S05 success criteria — the verification bar each smoke must clear.
- `.planning/ROADMAP.md` Phase 7 entry — success criteria 1-5 are the acceptance bar for this phase.

### Design contract (visual smoke must match these)
- `DESIGN.md` (repo root) — single source of truth for tokens, glass surfaces, typography, color, motion. Read before any visual judgement.
- `frontend/src/styles/index.css` — Tailwind v4 `@theme` block where tokens are declared. Grep here for the canonical class/variable names.
- `CLAUDE.md` (repo root) — design-system summary + harde regels (slice commit prefix `M049/S07: ...`, files under 300 lines, multi-tenant queries on org_id).

### INT-03 prior art
- `frontend/src/routes/instellingen/beleid-beheer.tsx` — current banner location with the `BeleidBeheerWithBanner` wrapper (from M049/S04 decisions).
- `frontend/src/routes/instellingen/data-bronnen/$gemeenteCode.tsx` (or the equivalent route file) — the route the deeplink must hit.
- `frontend/src/components/settings/SettingsTabNav.tsx` (or equivalent) — already resolves the active-gemeente target for the Data-bronnen pill; treat as the pattern to mirror.
- M049/S04 STATE decisions (above in this CONTEXT) — `BeleidBeheerWithBanner wrapper at route level keeps migration notice separate from InstellingenBeleidPage component` (lock-in 2026-05-16).

### Project rules
- `CLAUDE.md` — drie-laags pattern; gap-closure refactor without design-shift is exempt from brainstorming gate; verification-before-completion still required.

</canonical_refs>

<specifics>
## Specific Ideas

- The `useCurrentGemeenteCode`-style hook may already exist — grep before introducing. If it doesn't exist, the simplest version is reading `user.default_gemeente_code` from auth context (or whatever the SettingsTabNav uses).
- Storybook play function for 07-01 should cover both states with the same component — render with mocked context providing a gemeente, render with mocked context providing none.
- The "non-superuser session" smoke (S03 item) needs a non-superuser test login. Either reuse fixture users from backend test seeding, or document the manual test login in the screenshot caption.
- The 'Bekijk versies' modal in S04 already has component tests (see M049/S04 decisions); the visual smoke is just a backdrop-click + render evidence, not a re-test of logic.
- DESIGN.md token grep can produce evidence inline in the plan/SUMMARY without screenshots (e.g. `grep -r "#F9A826\|bg-white/60\|font-jakarta" frontend/src/components/settings/CredentialConfigModal.tsx`).

</specifics>

<deferred>
## Deferred Ideas

- Nyquist VALIDATION.md backfill across M049 phases (01, 03, 04, 04.1, 04.2, 05, 06) — accept as documentation gap per audit recommendation A.
- S04.2 security-hardening retroactive VERIFICATION.md — same; SUMMARY-only is accepted.
- T4 ActionItem DB entity audit re-enable — intentional SKIP; the legacy was frontend-only.
- MIG-02 SPA-redirect → literal HTTP 301 — documented divergence, not a gap.

</deferred>

---

*Phase: 07-visual-qa-aura-conformance*
*Context gathered: 2026-05-16 via gap-closure derivation*
