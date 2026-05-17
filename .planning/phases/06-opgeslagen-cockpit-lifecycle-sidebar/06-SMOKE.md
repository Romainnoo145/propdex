# Phase 6 — Smoke + Regression Verification

**Date:** 2026-05-17
**Operator:** Claude executor (Tasks 1-2 automated) + human verifier (Task 3 manual)

---

## Automated Aura Token Audit (Task 1)

### Hardcoded hex check

**Command:**
```
grep -rnE "#[0-9a-fA-F]{6}\b" <all 10 S06 files>
```

**Pre-fix violations found (3):**
```
src/routes/_authenticated.tsx:103: style={{ background: '#D1E2D8', ... }}
src/components/projects/PipelineStagePill.tsx:30: 'bg-[#D1E2D8]/40 text-[#1A1C1E]'
src/components/projects/PipelineStagePill.tsx:31: 'bg-[#F9A826]/20 text-[#F9A826]'
```

**Fixes applied (commit dc8e4d97):**
- `tokens.ts`: Added `MINT = '#D1E2D8'` export (--color-aura-mint)
- `_authenticated.tsx:103`: `background: '#D1E2D8'` → `background: MINT`
- `PipelineStagePill.tsx:30`: `bg-[#D1E2D8]/40 text-[#1A1C1E]` → `bg-aura-mint/40 text-aura-ink`
- `PipelineStagePill.tsx:31`: `bg-[#F9A826]/20 text-[#F9A826]` → `bg-aura-amber/20 text-aura-amber`

**Post-fix result:** (empty — no output)

**Status: PASS**

---

### File-size discipline

```
   57 src/lib/lifecycle/phases.ts
  123 src/components/layout/LifecycleSideRailNav.tsx
  170 src/routes/_authenticated.tsx
  318 src/routes/_authenticated/opgeslagen.tsx
  120 src/components/projects/SavedParcelCard.tsx
  179 src/components/projects/PipelineStagePill.tsx
  197 src/stories/projects/SavedParcelCard.stories.tsx
   75 src/routes/_authenticated/opgeslagen.perceel.$parcelId.tsx
   86 src/routes/_authenticated/opgeslagen.perceel.$parcelId.$phase.tsx
```

**Limits vs actuals:**
| File | Limit | Actual | Result |
|------|-------|--------|--------|
| phases.ts | < 100 | 57 | PASS |
| LifecycleSideRailNav.tsx | < 200 | 123 | PASS |
| _authenticated.tsx | < 185 | 170 | PASS |
| opgeslagen.tsx | < 350 (Plan 03 relaxation) | 318 | PASS |
| SavedParcelCard.tsx | < 200 | 120 | PASS |
| PipelineStagePill.tsx | < 200 | 179 | PASS |
| SavedParcelCard.stories.tsx | < 200 | 197 | PASS |
| opgeslagen.perceel.$parcelId.tsx | < 150 | 75 | PASS |
| opgeslagen.perceel.$parcelId.$phase.tsx | < 150 | 86 | PASS |

**Status: PASS**

---

### npm run check (TypeScript + ESLint)

```
91 total errors — all pre-existing (baseline documented in 06-01-SUMMARY.md)
Exit code: 2 (non-zero due to pre-existing errors)
```

**Zero new errors introduced by S06.** Pre-existing errors are in:
- `verkenner.tsx` (3x TS2322 Framer Motion Variants.ease type)
- `ReportSidebar.stories.tsx` (TS2741 missing is_superuser)
- `SideRailNav.stories.tsx` (TS2741 missing is_superuser)
- + 86 additional pre-existing errors

**Status: WARN — 91 pre-existing errors, 0 new from S06. Deferred to dedicated TS-strict-cleanup phase.**

---

## Known Deviations from Waves 1-3 (documented per plan requirement)

### 1. opgeslagen.tsx at 318 lines (> CLAUDE.md 300-line rule)

**Context:** Plan 03 acceptance criteria explicitly relaxed the limit to < 350 for this file because full `GemeenteGroupAccordion` extraction is deferred. File is down from 610 lines (pre-S06) to 318. A follow-up todo exists at `.planning/todos/pending/2026-05-17-m050-s06-gemeente-accordion-extract.md`.

**Decision:** PASS under Plan 03's relaxed < 350 limit. Acceptable for this milestone.

### 2. Commit prefix deviation in Wave 3 (Plan 06-04)

**Commits:** `cbdde3d0` (feat), `b741dee2` (feat), `0b83b5ac` (docs) used `feat(06-04):` and `docs(06-04):` prefixes instead of the mandated `M050/S06:` prefix per CLAUDE.md.

**Context:** Plans 01-03 used correct `M050/S06:` prefix. Plan 04 executor used `feat(06-04):` convention. Functionally clean — all code is correct.

**Decision:** Flag only. User can decide whether to amend these commits before push. Subsequent commits (dc8e4d97, 99946ef2) use correct `M050/S06:` prefix.

### 3. Pipeline-filter bar + workspace-mode removed from opgeslagen.tsx

**Context:** Wave 1 (Plan 06-03) removed the pipeline-filter bar and inline workspace-mode from `opgeslagen.tsx` per RESEARCH.md recommendation. Verified no other files reference these removed surfaces:

```bash
grep -rn "workspace-mode\|WorkspaceMode\|pipeline-filter\|PipelineFilterBar" \
  frontend/src/ 2>/dev/null  # → no output
```

**Status:** Clean removal confirmed.

### 4. TypeScript baseline: 91 pre-existing errors

**Context:** 91 TS errors existed before S06 started (stash-verified baseline documented in 06-01-SUMMARY.md). S06 introduced zero new errors. This is the debt baseline for future PRs to detect regressions.

**Status:** Documented. Deferred to dedicated TS-strict-cleanup phase.

---

## M048 Regression Isolation (Automated Verification)

### git diff check

```bash
git diff 42bafc6e..99946ef2 -- \
  frontend/src/hooks/useFactorPins.ts \
  frontend/src/lib/factor-groups.ts \
  frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx \
  frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx
# → zero output (no diff)
```

**Status: PASS — M048 files untouched across all S06 commits**

### Import isolation check

```bash
grep -rn "useFactorPins|factor-groups|PotentieLayer|RisicoLayer" \
  <all S06 new/modified files>
# → no output
```

**Status: PASS — Zero shared imports between S06 files and M048 components**

---

## Reduced-motion Verification (Automated — Task 2)

**Story added:** `ReducedMotionDegrades` in `frontend/src/stories/projects/SavedParcelCard.stories.tsx` (commit 99946ef2)

**Approach:** CSS decorator injects `animation-duration: 0.01ms !important; transition-duration: 0.01ms !important` — mirrors the global `@media (prefers-reduced-motion: reduce)` rule in `styles/index.css:223-252`.

**`prefers-reduced-motion` coverage in index.css (lines 223-252):**
- All elements: `transition-duration: 0ms !important; animation-duration: 0ms !important`
- `[class*="backdrop-blur"]`: `backdrop-filter: none !important; background: white !important`
- `.aura-hover-pod`, `.aura-hover-nav`, `.aura-hover-glow`: `transform: none; box-shadow: none`
- `.aura-float`: `will-change: auto`

**Lifecycle sidebar coverage:** `LifecycleSideRailNav.tsx` uses `motion.div` with `layoutId="lifecycle-sidebar-active"` and `transition={{ type: 'spring', stiffness: 380, damping: 30 }}`. Under `prefers-reduced-motion: reduce`, the global CSS sets `transition-duration: 0ms` which degrades the spring animation.

**Storybook story verified:** `grep "ReducedMotionDegrades" + grep "prefers-reduced-motion"` → PASS

**Status: PASS (structural verification)**

---

## M048 Regression Smoke (manual — Task 3)

**Status: PENDING — awaiting human execution**

### A. M048 Pin-mechanism Regression (REGRESSION-CRITICAL)

**Steps:**
1. Open http://localhost:9300/map → click any parcel → ParcelDetailPanel opens
2. Switch to "Potentie" tab → verify 9 factor cards render
3. Click pin-star (⭐) on 4 cards → star turns amber, cards move to synth-page, "Max 4 bereikt" toast on 5th pin attempt
4. Paginate through Potentie pages → all bron-pages render
5. Repeat for "Risico" tab
6. Refresh → pins persist (backend-stored)

| Step | Expected | Result | Notes |
|------|----------|--------|-------|
| 1. ParcelDetailPanel opens | Panel opens on parcel click | — | |
| 2. Potentie tab: 9 cards | 9 factor cards visible | — | |
| 3. Pin 4 + toast on 5th | Amber stars, toast fires | — | |
| 4. Potentie pagination | All pages render | — | |
| 5. Risico tab same | Same behavior | — | |
| 6. Refresh → persist | Pins survive refresh | — | |

**Status: [ ] PASS / [ ] FAIL**

---

### B. Opgeslagen Lifecycle Cockpit Flow

| Step | Expected | Result | Notes |
|------|----------|--------|-------|
| 1. /opgeslagen | Single-column cards + 6 lifecycle icons in sidebar | — | |
| 2. Click card → /opgeslagen/perceel/{id} | Onderzoek header + FavoriteParcelWorkspaceView + Onderzoek active | — | |
| 3. URL edit to /2-eerste-contact | Empty-state "Komt later" + Mail icon + active pill | — | |
| 4. URL edit to /1-onderzoek | Redirects → /opgeslagen/perceel/{id} (no flash) | — | |
| 5. Back-link → /opgeslagen | Returns to list with lifecycle sidebar | — | |

**Status: [ ] PASS / [ ] FAIL**

---

### C. Sidebar Route-Prefix Swap (incl. unknown-phase resilience)

| Step | Expected | Result | Notes |
|------|----------|--------|-------|
| 1. /opgeslagen vs /map in separate tabs | /opgeslagen: LifecycleSideRailNav; /map: SideRailNav | — | |
| 2. Browser back/forward | Sidebar state correct per route | — | |
| 3. /opgeslagen/perceel/abc/garbage | LifecycleSideRailNav stays mounted; page shows "Onbekende fase: garbage" fallback; default pill = Onderzoek | — | |
| 4. /opgeslagen/perceel/nonexistent-uuid | LifecycleSideRailNav stays mounted; EmptyState "Perceel niet gevonden" | — | |

**Status: [ ] PASS / [ ] FAIL**

**NOTE:** Step C.3 is spec-critical — verifies LifecycleSideRailNav stays mounted instead of toplevel SideRailNav for invalid phase URLs. This is guaranteed by `matchRoute({ to: '/opgeslagen', fuzzy: true })` — any `/opgeslagen/*` URL returns truthy.

---

### D. prefers-reduced-motion (Chrome DevTools)

| Step | Expected | Result | Notes |
|------|----------|--------|-------|
| 1. DevTools → Rendering → "Emulate prefers-reduced-motion: reduce" | Setting applied | — | |
| 2. Navigate /opgeslagen → click card | No fade/slide animations; layout intact | — | |

**Status: [ ] PASS / [ ] FAIL**

---

### E. Console Hygiene

| Step | Expected | Result | Notes |
|------|----------|--------|-------|
| 1. Walk through B + C above with DevTools Console open | Zero errors, zero React key warnings, zero "Cannot update a component while rendering" | — | |

**Status: [ ] PASS / [ ] FAIL**

---

### F. Aura Visual Eyeball

| Step | Expected | Result | Notes |
|------|----------|--------|-------|
| 1. /opgeslagen card list | Morning Mist canvas (#F2F6F3), Pure Glass cards (bg-white/60 blur), Plus Jakarta Sans, Warm Amber accents | — | |

**Status: [ ] PASS / [ ] FAIL**

---

## Final Verdict

**Automated checks:** PASS (hex audit, file sizes, M048 isolation, reduced-motion story)
**Manual checks (A-F):** PENDING — awaiting human sign-off

**Overall: PENDING human verification**

---

## Follow-up Todos (if manual smoke finds failures)

_None yet — to be filled if manual sections report FAIL._
