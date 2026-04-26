---
phase: 7
slug: factor-pinning-groep-pages-6-cards-per-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | pytest 7.x (backend) + Storybook 8.x play-functions via `@storybook/addon-vitest` (frontend) |
| **Config files** | `backend/pyproject.toml` + `backend/tests/conftest.py` ; `frontend/vitest.config.ts` + `frontend/.storybook/main.ts` |
| **Quick run command (backend)** | `cd backend && pytest tests/unit/test_user_factor_pins.py tests/integration/test_factor_pins_router.py -x --tb=short` |
| **Quick run command (frontend)** | `cd frontend && npm run test-storybook -- --grep "Phase 7"` |
| **Full suite command (backend)** | `cd backend && pytest -x` (275+ tests, no regression) |
| **Full suite command (frontend)** | `cd frontend && npm run check && npm run test-storybook` |
| **Estimated runtime** | backend quick ~8s · backend full ~90s · frontend stories ~25s |

---

## Sampling Rate

- **After every task commit:** Run quick command for the surface touched (backend pytest module OR Storybook grep)
- **After every plan wave:** Run full suite for that surface
- **Before `/gsd:verify-work`:** Both full suites green (275+ pytest + all Storybook stories)
- **Max feedback latency:** 30 seconds (quick) / 120 seconds (full)

---

## Per-Task Verification Map

> Filled by gsd-planner during step 8. Map every task to: requirement ID, test surface, command, expected proof.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-XX-XX | TBD  | TBD  | PIN-01      | TBD       | TBD               | TBD         | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Test files that MUST exist before later waves can verify themselves:

- [ ] `backend/tests/unit/test_user_factor_pins_model.py` — model + TenantMixin + UniqueConstraint stubs (PIN-02)
- [ ] `backend/tests/integration/test_factor_pins_router.py` — endpoint stubs (auth, multi-tenant, max-6) (PIN-03)
- [ ] `backend/tests/conftest.py` — confirm shared `client` + `current_user_factory` fixtures cover org-A vs org-B isolation; add if missing
- [ ] `frontend/src/components/map/panels/parcel/layers/PotentieLayer.stories.tsx` — extend with 6 new stories (PinnedPageEmpty / PinnedPagePartial / PinnedPageFull / PinFlow / Max6Guard / MissingPinDashedBorder) (TEST-07)
- [ ] `frontend/src/components/map/panels/parcel/layers/RisicoLayer.stories.tsx` — mirror set for Risico tab
- [ ] `frontend/src/test-utils/factorPinsMock.ts` — TanStack Query inline cache pre-seed helper (no MSW; precedent Phase 3)

*Existing infrastructure (pytest fixtures, Storybook + addon-vitest, sonner Toaster, AuthContext decorator) covers everything else.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pin persists across browser-refresh and devices | PIN-01 (criterion 9) | Multi-device + refresh-cycle is environment-level, not unit-testable | (1) Pin 3 factors in browser A · (2) hard refresh — confirm pins reload · (3) login same user in browser B / incognito — confirm same 3 pins · (4) unpin one in B, refresh A — confirm sync |
| ⭐ badge visual rendering matches Aura tokens | UI-01 (criterion 7) | Visual fidelity (color/spacing/hover-fade) requires human eye against DESIGN.md | Open `PotentieLayer` → `PinnedPagePartial` story in Storybook · verify Star uses `--amber-500`, dashed border uses `--slate-200`, hover fade is 150ms, no layout shift on pin/unpin |
| Optimistic update perceived latency < 100ms | PIN-01 (criterion 7) | Performance perception is subjective; auto-test would be flaky | Throttle network to "Slow 3G" in DevTools · pin a factor · confirm card appears on page 0 instantly (before network roundtrip resolves) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (CI-friendly only)
- [ ] Feedback latency < 30s (quick) / 120s (full)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
