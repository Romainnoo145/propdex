---
phase: 7
slug: factor-pinning-groep-pages-6-cards-per-page
status: draft
nyquist_compliant: true
wave_0_complete: true
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-T1 | 01 | 0 | TEST-07 (Wave 0) | unit + integration stubs | `cd backend && pytest tests/unit/test_factor_registry_bron_field.py tests/unit/test_user_factor_pin_model.py tests/integration/test_factor_pins_router.py tests/integration/test_user_factor_pins_migration.py --collect-only` | ✅ post-task | ⬜ pending |
| 7-01-T2 | 01 | 0 | TEST-07 (Wave 0) | story stubs | `cd frontend && test -f src/test-utils/factorPinsMock.ts && grep -q PinnedPageEmpty src/stories/parcel/PotentieLayer.stories.tsx` | ✅ post-task | ⬜ pending |
| 7-01-T3 | 01 | 0 | TEST-07 (validation) | doc update | `grep -q "nyquist_compliant: true" .planning/phases/07-factor-pinning-groep-pages-6-cards-per-page/07-VALIDATION.md` | ✅ post-task | ⬜ pending |
| 7-02-T1 | 02 | 1 | PIN-02 | model + migration | `cd backend && pytest tests/unit/test_user_factor_pin_model.py tests/integration/test_user_factor_pins_migration.py -x` | ✅ via Plan 01 | ⬜ pending |
| 7-02-T2 | 02 | 1 | PIN-03 | router integration | `cd backend && pytest tests/integration/test_factor_pins_router.py -x` | ✅ via Plan 01 | ⬜ pending |
| 7-02-T3 | 02 | 1 | PIN-02/PIN-03 (regression) | full backend suite | `cd backend && pytest -x` (275+ tests, no regression) | ✅ existing | ⬜ pending |
| 7-03-T1 | 03 | 1 | GROUP-01 | unit (registry) | `cd backend && pytest tests/unit/test_factor_registry_bron_field.py -x` | ✅ via Plan 01 | ⬜ pending |
| 7-03-T2 | 03 | 1 | GROUP-02 + UI-01 | hook + module type-check | `cd frontend && npm run check` | ✅ existing | ⬜ pending |
| 7-04-T1 | 04 | 2 | GROUP-02 + UI-01 + PIN-01 | layer refactor type-check | `cd frontend && npm run check` | ✅ existing | ⬜ pending |
| 7-04-T2 | 04 | 2 | UI-01 + PIN-01 | story render smoke | `cd frontend && npm run test-storybook -- --grep "Phase 7 — Pinned page \\(0 pins"` | ✅ via Plan 01 | ⬜ pending |
| 7-05-T1 | 05 | 3 | TEST-07 + UI-01 + PIN-01 + GROUP-02 | full Storybook | `cd frontend && npm run test-storybook` | ✅ via Plan 01+04 | ⬜ pending |
| 7-05-T2 | 05 | 3 | phase gate | full backend + frontend | `cd backend && pytest -x && cd ../frontend && npm run check && npm run test-storybook` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Updated 2026-04-26 by Plan 01 Task 3.*

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

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (CI-friendly only)
- [x] Feedback latency < 30s (quick) / 120s (full)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Wave 0 complete (2026-04-26)
