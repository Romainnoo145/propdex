---
phase: 2
slug: score-ui-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Storybook 10.2.8 + Vitest 4.0.18 + `@storybook/addon-vitest` |
| **Config file** | `frontend/vite.config.ts` (test block with storybook plugin) |
| **Quick run command** | `cd frontend && npm run check` |
| **Full suite command** | `cd frontend && npx storybook test` |
| **Estimated runtime** | ~30 seconds (check) / ~60 seconds (storybook test) |

---

## Sampling Rate

- **After every task commit:** Run `cd /home/klarifai/Documents/klarifai/clientprojects/propdex/frontend && npm run check`
- **After every plan wave:** Run `cd /home/klarifai/Documents/klarifai/clientprojects/propdex/frontend && npx storybook test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | SCORE-01, SCORE-03 | TypeScript compile | `cd frontend && npm run check` | ✅ | ⬜ pending |
| 2-01-02 | 01 | 1 | SCORE-02 | TypeScript compile | `cd frontend && npm run check` | ✅ | ⬜ pending |
| 2-02-01 | 02 | 2 | TEST-02, TEST-03 | Storybook play | `cd frontend && npx storybook test --testPathPattern ScoreBreakdown` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/stories/parcel/` — directory must be created
- [ ] `frontend/src/stories/parcel/ScoreBreakdownModal.stories.tsx` — covers TEST-02 + TEST-03 (does not exist yet)

*No new framework install needed — Storybook + Vitest already installed and configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Balance bar visual proportion matches percentage | SCORE-01 | CSS flex ratio is visual only | Open ScoreBreakdownModal for any parcel, change org balance in config, verify bar widths change proportionally |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
