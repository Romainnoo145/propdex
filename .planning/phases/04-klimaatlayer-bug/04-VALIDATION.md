---
phase: 4
slug: klimaatlayer-bug
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@storybook/addon-vitest` (Playwright Chromium) — canonical project test stack |
| **Config file** | `frontend/vitest.config.ts` (storybook integration) |
| **Quick run command** | `cd frontend && pnpm storybook --ci --test --include="**/gemeente/KlimaatLayer.stories.tsx"` |
| **Full suite command** | `cd frontend && pnpm storybook --ci --test` |
| **Estimated runtime** | ~10 seconds (single-story file), ~60 seconds full suite |

> Note: co-located `.test.tsx` files do NOT run in this project. Only Storybook play-functions execute.
> Mirror `frontend/src/stories/parcel/PotentieLayer.stories.tsx` precedent for new stories.

---

## Sampling Rate

- **After every task commit:** Run quick (single-story) command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | BUG-01 | unit (Storybook play) | `pnpm storybook --ci --test --include="**/gemeente/KlimaatLayer.stories.tsx"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | BUG-01 | unit (Storybook play) | `pnpm storybook --ci --test --include="**/gemeente/KlimaatLayer.stories.tsx"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 2 | BUG-01 | manual smoke | localhost:9300 gemeente A→B click | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/stories/gemeente/KlimaatLayer.stories.tsx` — new stories file (mirror `frontend/src/stories/parcel/PotentieLayer.stories.tsx` precedent)
- [ ] At least 3 play-function stories covering SC#1, SC#2, SC#3 from Phase 4 success criteria

*Existing test infrastructure (`@storybook/addon-vitest` + Playwright) covers all needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-map gemeente switch on localhost | BUG-01 | The fix touches `map.tsx` integration with MapLibre — Storybook tests prop-swap on the panel only, not the live map click handler chain | Open `localhost:9300`, switch to Gemeenten layer, click gemeente A → KlimaatLayer opens → click gemeente B → verdict updates, no ghost |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
