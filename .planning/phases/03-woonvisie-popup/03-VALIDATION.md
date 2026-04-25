---
phase: 3
slug: woonvisie-popup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Storybook 10.2.8 + `@storybook/addon-vitest` 10.2.8 + `@vitest/browser-playwright` 4.0.18 (Chromium) — NOT React Testing Library |
| **Config file** | `frontend/vite.config.ts` (test.projects array, lines 54-76); `frontend/.storybook/main.ts`; `frontend/.storybook/vitest.setup.ts` |
| **Quick run command** | `cd frontend && pnpm exec vitest run --project=storybook src/stories/parcel/WoonvisiePopup.stories.tsx` |
| **Full suite command** | `cd frontend && pnpm run check && pnpm exec vitest run` |
| **Estimated runtime** | ~25 seconds (browser Chromium boot included) |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Plans are not yet authored. The planner MUST fill task IDs in this table when writing PLAN.md(s). Every requirement listed below has a planned automated home; no requirement may be left as "manual-only" without justification in the Manual-Only section.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| WOON-01 | Click on kaart 10 (`woonvisie_match`) opens the popup | Storybook play (browser) on `PotentieLayer.stories.tsx` | `pnpm exec vitest run --project=storybook src/stories/parcel/PotentieLayer.stories.tsx -t "ClickOpensPopup"` | ❌ Wave 0 — story file MUST be created | ⬜ pending |
| WOON-02 | Popup renders meta line, wijk_naam, prioriteit dot+label, plain citaat text, single-line segmentmatch sentence (minimal aesthetic — NO chips/blockquote) | Storybook play asserting DOM via `within(document.body)` | `pnpm exec vitest run --project=storybook src/stories/parcel/WoonvisiePopup.stories.tsx` | ⚠ Stories exist (5 visual variants), `play` functions NOT yet authored | ⬜ pending |
| WOON-03 | Popup uses Aura tokens — Plus Jakarta Sans, white surface, `rounded-[32px]`, framer-motion enter/exit | Storybook play + a11y addon | (same file as WOON-02) | ⚠ Visual stories exist; assertions NOT authored | ⬜ pending |
| TEST-04 | Component tests cover open + content + dismiss (click-outside; ESC if wired) | Storybook play | `WoonvisiePopup.stories.tsx`: 6 play-functions covering BlerickGroei, VenloCentrumMismatch, TegelenHerstructurering, GeenMatchFallback, EscDismisses, ClickOutsideDismisses | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/stories/parcel/PotentieLayer.stories.tsx` — NEW file enabling WOON-01 click-coverage
- [ ] Add `play` functions to `frontend/src/stories/parcel/WoonvisiePopup.stories.tsx` — covering WOON-02, WOON-03, TEST-04
- [ ] Verify `react-focus-lock` is in `frontend/package.json` deps (research says yes); if missing, add as Wave 0 install

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual diff against memory `feedback_m048_woonvisie_ui.md` description | WOON-02 / WOON-03 | Pixel-level visual taste check is faster by eye than by Chromatic at this scale | Run `cd frontend && pnpm storybook`, open `M048/WoonvisiePopup`, confirm each variant uses minimal aesthetic (dot+label, plain `<p>` citaat, single-line segmentmatch sentence — NO chips/blockquote/✓✗). |
| Live wire-up smoke in dev server | WOON-01 | End-to-end click-through requires a real scan with woonvisie data | `cd frontend && pnpm dev` (port 9300), open Venlo, click a parcel with woonvisie_match factor, click kaart 10, confirm popup opens with correct wijk |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`PotentieLayer.stories.tsx`, play-functions on existing `WoonvisiePopup.stories.tsx`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
