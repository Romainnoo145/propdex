---
phase: 07-factor-pinning-groep-pages-6-cards-per-page
verified: 2026-04-26T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Visual pin flow — hover-star appears, click pins factor, factor appears on pinned page (GEPIND title)"
    expected: "Hover over any card on a group page reveals amber star outline; click pins it; page 0 shows GEPIND with the factor card"
    why_human: "Optimistic UI update timing and visual fade-in transition cannot be verified programmatically"
  - test: "Max-4 guard toast — pin 4 factors then attempt a 5th"
    expected: "Sonner toast fires with 'Max 4 bereikt' (note: REQUIREMENTS.md still says max 6, but implementation is 4 per decision recorded in SUMMARY)"
    expected_decision_note: "CARDS_PER_PAGE=4 and MAX_PINS=4 is the authoritative post-approval implementation; REQUIREMENTS.md text still references '6' but this is a doc lag, not a code bug"
    why_human: "Toast DOM rendering in live app context differs from Storybook; need to confirm toast appears at exactly 4 pins"
  - test: "Persistence across hard refresh — pin a factor, hard refresh, verify GEPIND page shows pinned factor"
    expected: "Backend-backed pins survive page reload; GEPIND title appears with previously pinned cards"
    why_human: "Requires live backend + authenticated session + real DB round-trip"
  - test: "REQUIREMENTS.md text vs implementation discrepancy — confirm intentional"
    expected: "PIN-01 in REQUIREMENTS.md says 'max 6 pins / toast max 6 bereikt'; GROUP-02 says '6 cards per page'; TEST-07 says 'max-6 guard'. Actual implementation is max 4 pins / 4 cards. Confirm with product owner that REQUIREMENTS.md can be updated to reflect the 4-per-page decision."
    why_human: "Product/requirements alignment decision — cannot be verified by code alone"
---

# Phase 7: Factor Pinning + Groep Pages + 4 Cards/Page Verification Report

**Phase Goal:** ParcelDetailModal Potentie/Risico tabs schalen naar 30+ factoren zonder UI-werk per cascade-milestone. User kan top-{N} pinnen (persistent), factoren gegroepeerd per bron over pages, {N} cards per page.
**Verified:** 2026-04-26
**Status:** human_needed
**Re-verification:** No — initial verification

Note on contract change: During execution the team dropped CARDS_PER_PAGE 6 → 4 and MAX_PINS 6 → 4 (post visual sign-off decision, recorded in 07-05-SUMMARY.md and STATE.md). All verification below uses the actual 4/4 contract. REQUIREMENTS.md text still says "6" in PIN-01, GROUP-02, and TEST-07 — this is a documentation lag flagged in the human verification section.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every FACTOR_REGISTRY entry (22) has a `bron` field with a valid Literal value | VERIFIED | `python -c "from app.services.score_v3 import FACTOR_REGISTRY; bad=[k for k,v in FACTOR_REGISTRY.items() if not getattr(v,'bron',None)]; print(len(FACTOR_REGISTRY),'entries, bad:',bad)"` → `22 entries, bad: []` |
| 2 | user_factor_pins table exists with UniqueConstraint + multi-tenant isolation | VERIFIED | `backend/alembic/versions/y0_m048_s04_create_user_factor_pins.py` creates table with `uq_user_factor_pins_user_cat_key`; 16 backend tests pass including `test_org_a_user_cannot_see_org_b_pins` |
| 3 | REST API endpoints GET/POST/DELETE operate at `/api/users/me/factor-pins` with auth, 409/400 guards, 204 delete | VERIFIED | Router mounted in main.py; 3 routes registered (`['/api/users/me/factor-pins', '/api/users/me/factor-pins', '/api/users/me/factor-pins/{pin_id}']`); 8 integration tests green |
| 4 | Potentie tab renders 4-cards-per-page with page 0 = TOP FACTOREN (0 pins) or GEPIND (≥1 pin) | VERIFIED | `grid grid-cols-2 grid-rows-2` in PotentieLayer.tsx; `CARDS_PER_PAGE=4` imported from factor-groups; `buildPages` produces pinned synth-page |
| 5 | Risico tab mirrors Potentie with `tone="negative"`, independent pin budget | VERIFIED | `useFactorPins('risico')` in RisicoLayer.tsx; `tone="negative"` on FactorCard; old `RisicoCard` function removed (grep returns 0) |
| 6 | Pin star is always-visible for pinned cards; hover-revealed for unpinned; max-4 toast fires client-side | VERIFIED | FactorCard.tsx renders `data-testid="pin-star-filled"` (always visible) vs `data-testid="pin-star-button"` (opacity-0 group-hover:opacity-100); `useFactorPins.ts` fires `toast('⭐ Max 4 bereikt')` at `pins.length >= 4` |
| 7 | WoonvisiePopup opens on woonvisie_match card-body click (not star click); popup not broken by refactor | VERIFIED | PotentieLayer.tsx line 448: `card.factor_key === 'woonvisie_match' && hasWoonvisieData` guards `onCardClick`; `e.stopPropagation()` in FactorCard prevents star from triggering card click |

**Score:** 7/7 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/user_factor_pin.py` | UserFactorPin with TenantMixin + TimestampMixin | VERIFIED | `class UserFactorPin(Base, TenantMixin, TimestampMixin)` at line 14; `uq_user_factor_pins_user_cat_key` UniqueConstraint confirmed |
| `backend/alembic/versions/y0_m048_s04_create_user_factor_pins.py` | Migration with down_revision='28d2d029856d' | VERIFIED | `down_revision: str | Sequence[str] | None = '28d2d029856d'` at line 16 |
| `backend/app/users/factor_pins/router.py` | FastAPI router GET/POST/DELETE | VERIFIED | prefix `/api/users/me/factor-pins`; `MAX_PINS_PER_CATEGORY = 4`; 7 explicit `organization_id == current_user.organization_id` filters |
| `backend/app/users/factor_pins/schemas.py` | FactorPinCreate + FactorPinResponse | VERIFIED | Both classes present; Pydantic v2 ConfigDict(from_attributes=True) on response |
| `backend/app/services/score_v3.py` | FactorRegistryEntry with `bron: Bron` field | VERIFIED | `Bron = Literal[...]` at line 64; `bron: Bron` field at line 83; 22 `bron=` assignments confirmed |
| `frontend/src/lib/factor-groups.ts` | Bron, BRON_ORDER, BRON_LABEL, FACTOR_BRON, buildPages, CARDS_PER_PAGE | VERIFIED | All 6+ exports confirmed; CARDS_PER_PAGE=4; `capaciteit: 'fysiek'` and `criminaliteit: 'markt'` present |
| `frontend/src/hooks/useFactorPins.ts` | TanStack hook with optimistic updates, max-4 toast | VERIFIED | `useFactorPins`, `MAX_PINS_PER_CATEGORY=4`, optimistic add/remove mutations; `toast('⭐ Max 4 bereikt')` on guard |
| `frontend/src/components/map/panels/parcel/FactorCard.tsx` | Shared card with pin-star + GhostCard | VERIFIED | `FactorCard` + `GhostCard` exported; `data-testid="pin-star-filled"`, `data-testid="pin-star-button"`, `data-testid="factor-card-missing"` all present |
| `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` | Refactored to useFactorPins + buildPages + CARDS_PER_PAGE | VERIFIED | Imports `useFactorPins`, `FACTOR_BRON`, `buildPages`, `CARDS_PER_PAGE`; `grid-cols-2 grid-rows-2`; old `const CARDS_PER_PAGE = 9` absent |
| `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx` | Refactored to useFactorPins('risico') + buildPages + tone="negative" | VERIFIED | All patterns confirmed; `function RisicoCard` removed (0 matches); `tone="negative"` on FactorCard |
| `frontend/src/stories/parcel/PotentieLayer.stories.tsx` | 8 Phase 7 stories + Phase 3 stories preserved | VERIFIED | Phase 7 exports: PinnedPageEmpty, PinnedPagePartial, PinnedPageFull, GroupPagesNavigation, PinnedAlsoOnGroupPage, PinFlow, Max4Guard, MissingPinDashedBorder; Phase 3: Default + ClickOpensPopup intact |
| `frontend/src/stories/parcel/RisicoLayer.stories.tsx` | 3 risico stories | VERIFIED | PinnedPageEmpty, PinnedPageWithRisicoPins, Max4GuardRisico |
| `frontend/src/test-utils/factorPinsMock.ts` | makeFactorPin + makeQueryClientWithPins helpers | VERIFIED | Both functions exported; imported by both story files |
| `backend/tests/unit/test_factor_registry_bron_field.py` | 3 tests for bron field coverage | VERIFIED | All 3 pass in test run |
| `backend/tests/integration/test_factor_pins_router.py` | 8 endpoint integration tests | VERIFIED | All 8 pass (auth, list, create, 409 duplicate, 400 max-4, delete, round-trip, multi-tenant) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/main.py` | `backend/app/users/factor_pins/router.py` | `include_router` | WIRED | Line 45: `from app.users.factor_pins.router import router as factor_pins_router`; line 159: `app.include_router(factor_pins_router)` |
| `backend/app/models/__init__.py` | `backend/app/models/user_factor_pin.py` | import for Alembic autogenerate | WIRED | Line 35: `from app.models.user_factor_pin import UserFactorPin  # noqa: F401` |
| `backend/app/users/factor_pins/router.py` | `current_user.organization_id` | explicit WHERE in every query | WIRED | 7 occurrences of `organization_id == current_user.organization_id` (list/create-count/create-maxpos/create-guard/delete-verify/delete-execute; covers all 3 handlers) |
| `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` | `useFactorPins('potentie')` | hook call | WIRED | Line 312: `const { pins, toggle, isPinned } = useFactorPins('potentie')` |
| `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx` | `useFactorPins('risico')` | hook call | WIRED | Line 316: `const { pins, toggle, isPinned } = useFactorPins('risico')` |
| `frontend/src/hooks/useFactorPins.ts` | `/api/users/me/factor-pins` | apiFetch GET/POST/DELETE | WIRED | `BASE = '/api/users/me/factor-pins'`; used in queryFn, addMutation.mutationFn, removeMutation.mutationFn |
| `frontend/src/components/map/panels/parcel/FactorCard.tsx` | `lucide-react Star` | import | WIRED | `import { Star } from 'lucide-react'` (verified via file content check) |
| `frontend/src/stories/parcel/PotentieLayer.stories.tsx` | `factorPinsMock` helper | import | WIRED | Line 204: `import { makeFactorPin, makeQueryClientWithPins } from '@/test-utils/factorPinsMock'` |
| `frontend/src/stories/parcel/RisicoLayer.stories.tsx` | `factorPinsMock` helper | import | WIRED | Line 15: `import { makeFactorPin, makeQueryClientWithPins } from '@/test-utils/factorPinsMock'` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PIN-01 | 07-01, 07-03, 07-04 | User can pin/unpin factoren, max-4 guard (REQUIREMENTS.md says max-6 — doc lag) | SATISFIED | `useFactorPins.toggle()` + `MAX_PINS_PER_CATEGORY=4`; 8 integration tests green |
| PIN-02 | 07-02 | Pins persist via `user_factor_pins` table, UniqueConstraint, TenantMixin | SATISFIED | Model + migration both exist; 3 model/migration tests pass; round-trip test green |
| PIN-03 | 07-02, 07-03 | REST API GET/POST/DELETE + optimistic TanStack Query updates | SATISFIED | 3 routes registered; 8 integration tests green; `useFactorPins` uses `useQuery` + `useMutation` with onMutate optimistic cache |
| GROUP-01 | 07-03 | Every FACTOR_REGISTRY entry has `bron` field | SATISFIED | `bron: Bron` on dataclass; 22 entries assigned; 3 unit tests green |
| GROUP-02 | 07-03, 07-04 | 4 cards/page (REQUIREMENTS.md says 6 — doc lag), pinned synth-page, bron group pages | SATISFIED | `CARDS_PER_PAGE=4`; `buildPages()` produces pinned page-0 + bron group pages; `grid-cols-2 grid-rows-2` |
| UI-01 | 07-03, 07-04 | Hover star → pin; optimistic update; unpin from both pages; sync | SATISFIED | FactorCard: `opacity-0 group-hover:opacity-100` for unpinned; `toggle()` handles add/remove; both layers use same `isPinned` state |
| TEST-07 | 07-01, 07-05 | Story tests cover pin flow, max guard, badge rendering, page navigation | SATISFIED | 8 Potentie stories + 3 Risico stories created; Wave 0 stubs converged against real implementation; visual sign-off received 2026-04-26 |

REQUIREMENTS.md documentation lag: PIN-01, GROUP-02, and TEST-07 still reference "max 6" and "6 cards" — the actual implementation is 4. This is a known doc lag documented in 07-05-SUMMARY.md (intentional decision post visual sign-off). No implementation gap; flagged for human sign-off on requirement text update.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/components/map/panels/parcel/layers/PotentieLayer.tsx` | — | File is 499 lines (project convention <300) | Info | Noted in SUMMARY; FactorCard extraction helps but layer is still long due to formatFactorValue helpers and complex score_breakdown mapping |
| `frontend/src/components/map/panels/parcel/layers/RisicoLayer.tsx` | — | File is 471 lines | Info | Same as above |
| `.planning/REQUIREMENTS.md` | 31, 38, 56 | PIN-01/GROUP-02/TEST-07 still say "max 6"/"6 cards" — implementation is 4 | Warning | Documentation lag; implementation is correct per post-approval decision; needs human to confirm REQUIREMENTS.md update |

No blocker anti-patterns found. No TODO/FIXME/placeholder stubs in Phase 7 files. No empty implementations.

---

### Human Verification Required

#### 1. Visual Pin Flow in Dev Server

**Test:** Navigate to any scanned parcel in dev server (:9300), open ParcelDetailModal, click Potentie tab. Navigate to a group page (e.g. MARKT). Hover over a card — star outline should appear. Click star.
**Expected:** Card immediately appears on page 0 under GEPIND title (optimistic update). Navigate back to MARKT — same card shows filled amber star always visible. Click filled star — card removed from GEPIND page.
**Why human:** Animation timing, optimistic UI visual delay, and fade-in transition cannot be verified programmatically.

#### 2. Max-4 Guard Toast

**Test:** Pin 4 factors across group pages. Attempt to pin a 5th.
**Expected:** Sonner toast fires with "⭐ Max 4 bereikt". No 5th card appears on GEPIND page.
**Why human:** Live toast DOM rendering in app context (vs Storybook) needs confirmation. Also confirms the 4-pin limit (not 6) is visibly correct in the real product.

#### 3. Persistence Across Hard Refresh

**Test:** Pin 2 factors. Press Cmd+Shift+R (hard refresh). Navigate back to same parcel.
**Expected:** GEPIND page shows the 2 previously pinned factors.
**Why human:** Requires live backend + authenticated session + real PostgreSQL round-trip.

#### 4. REQUIREMENTS.md Text Update Confirmation

**Test:** Review REQUIREMENTS.md lines 31, 38, 56 — they still say "max 6 pins" and "6 cards per page".
**Expected:** Product owner confirms the 4/4 decision is correct and authorizes update of REQUIREMENTS.md to reflect `max 4 pins / 4 cards per page / toast "max 4 bereikt"`.
**Why human:** Requires product decision, not code verification.

---

### Gaps Summary

No automated gaps found. All 7 observable truths verified, all artifacts exist and are substantive, all key links are wired, all 16 backend tests pass.

The 4 human verification items are standard for this type of feature: visual behavior, live persistence, and one documentation alignment decision. None indicate a code defect.

---

_Verified: 2026-04-26_
_Verifier: Claude (gsd-verifier)_
