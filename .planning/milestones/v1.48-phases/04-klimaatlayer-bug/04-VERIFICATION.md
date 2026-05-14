---
phase: 04-klimaatlayer-bug
verified: 2026-04-26T12:35:00Z
status: human_needed
score: 3/3 must-haves verified
human_verification:
  - test: "Live gemeente A → gemeente B switch on map canvas"
    expected: "After clicking a different gemeente on the MapLibre map, the KlimaatLayer verdict in GemeenteContextPanel immediately shows a loading state then renders the new gemeente's verdict — Venlo's label/score is not visible at any point after the switch"
    why_human: "Storybook play-functions test the prop-swap invariant in isolation using a harness that applies key={current} directly on KlimaatLayer. The production wiring goes through GemeenteContextPanel which is the actual key-bearing component. The MapLibre click-handler chain and activePanel state update cannot be exercised in Storybook."
---

# Phase 4: KlimaatLayer Bug Verification Report

**Phase Goal:** The KlimaatLayer always shows the verdict for the currently visible gemeente — switching gemeenten never leaves stale data on screen
**Verified:** 2026-04-26T12:35:00Z
**Status:** human_needed (all automated checks pass; one manual smoke item pending)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Switching gemeente A → B updates the KlimaatLayer verdict within one render cycle | VERIFIED | PropSwap story (test run: 3/3 PASS); play-function asserts 'LASTIG KLIMAAT' (Eindhoven) appears within 2000ms after switch button click |
| 2 | After a gemeente A → B transition, no text/score from gemeente A remains visible | VERIFIED | PropSwap story asserts `queryByText('ONTWIKKELKANSRIJK')` not in DOM after switch; NoStaleDataOnSwitch pins this within 500ms even with pre-seeded cache |
| 3 | Rapid 3-way switching (A → B → C) leaves only gemeente C's verdict visible | VERIFIED | RapidSwitch story clicks Eindhoven then immediately Amsterdam; asserts neither 'ONTWIKKELKANSRIJK' nor 'LASTIG KLIMAAT' in DOM, only 'GEMIDDELD KLIMAAT' |

**Score: 3/3 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/routes/_authenticated/map.tsx` | `key={activePanel.code}` on `<GemeenteContextPanel>` | VERIFIED | Confirmed at line 2662 via grep and `git show 1e1528a1` (exactly 1 line added, no other changes) |
| `frontend/src/stories/gemeente/KlimaatLayer.stories.tsx` | Three Storybook play-function stories pinning BUG-01 SC#1, SC#2, SC#3; contains "PropSwap" | VERIFIED | File exists, 322 lines, exports PropSwap / RapidSwitch / NoStaleDataOnSwitch; all three pass in vitest |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend/src/routes/_authenticated/map.tsx` | `frontend/src/components/map/panels/GemeenteContextPanel.tsx` | `key={activePanel.code}` on rendered `<GemeenteContextPanel>` | WIRED | `grep` confirms `key={activePanel.code}` at line 2662; GemeenteContextPanel imported at line 15 of map.tsx |
| `frontend/src/stories/gemeente/KlimaatLayer.stories.tsx` | `frontend/src/components/map/panels/gemeente/KlimaatLayer.tsx` | `QueryClient.setQueryData` seeds `['gemeente-profile', naam]` etc.; harness wraps `<KlimaatLayer key={current} ...>` | WIRED | `setQueryData.*gemeente-profile` pattern confirmed at line 119 of stories file; `KlimaatLayer` imported at line 19 and rendered in harness at line 171 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BUG-01 | 04-01-PLAN.md | KlimaatLayer shows correct gemeente verdict when user switches between gemeenten on the map (no stale gemeente data shown) | SATISFIED | `key={activePanel.code}` forces unmount/remount of GemeenteContextPanel on every gemeente switch, resetting all internal state and query subscriptions; 3/3 Storybook play-function stories confirm the invariant passes |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `frontend/src/routes/_authenticated/map.tsx` | 1429 | Comment uses word "placeholder" | Info | Describes an intentional fallback UUID pattern in the parcel enrichment error handler — pre-existing, unrelated to Phase 04, not stub code |

No blockers. No warnings.

---

## TypeScript / Lint Check

`pnpm run check` has pre-existing errors across 15+ unrelated files (WijkMapPanel, BottomTabNav, DocumentListItem, DataCatalog, etc.). Neither of the two Phase 04 files introduced new errors:

- `frontend/src/stories/gemeente/KlimaatLayer.stories.tsx` — zero new errors; `is_superuser` field correctly included in `mockAuthValue` (contrast with pre-existing errors in `ReportSidebar.stories.tsx` and `SideRailNav.stories.tsx` that omit it)
- `frontend/src/routes/_authenticated/map.tsx` — the pre-existing error at line 189 (`TS7030: Not all code paths return a value`) is far from the change at line 2662 and present before Phase 04 commits

The `KlimaatLayer.tsx` error at line 132 (`TS2532: Object is possibly 'undefined'`) is in the component itself, which Phase 04 did not modify.

---

## Human Verification Required

### 1. Live gemeente switch on MapLibre canvas

**Test:** Open `localhost:9300/map`, log in, enable the Gemeenten layer (top-center toggle). Click Venlo on the map, open the Vergunningen tab to see the KlimaatLayer verdict. Without closing the panel, click a different gemeente on the canvas (e.g., Eindhoven or any other).

**Expected:** GemeenteContextPanel immediately shows a loading state ('LADEN...') then renders the new gemeente's verdict. The Venlo label/score is not visible at any point after the click.

**Why human:** The Storybook stories test the prop-swap invariant by applying `key={current}` directly on `<KlimaatLayer>` inside the harness. Production code applies `key={activePanel.code}` one level higher on `<GemeenteContextPanel>`, which propagates the unmount down to KlimaatLayer. The MapLibre click-handler chain (`handleGemeenteClick` → `activePanel` state update → React re-render with new key) cannot be exercised in Storybook without a live MapLibre instance.

---

## Commits Verified

| Commit | Description | Verified |
|--------|-------------|---------|
| `a2167d4e` | test(04-01): add KlimaatLayer Storybook stories pinning BUG-01 SC#1-SC#3 | Confirmed via `git log` |
| `1e1528a1` | fix(04-01): add key={activePanel.code} to GemeenteContextPanel — BUG-01 fix | Confirmed via `git show`; diff shows exactly 1 line inserted |
| `dbe441ef` | docs(04-01): complete KlimaatLayer BUG-01 fix plan | Confirmed via `git log` |

---

## Test Results

```
pnpm exec vitest run --project=storybook src/stories/gemeente/KlimaatLayer.stories.tsx

  storybook (chromium) src/stories/gemeente/KlimaatLayer.stories.tsx (3 tests) 422ms

Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  2.37s
```

---

## Gaps Summary

No gaps. All three observable truths are verified by passing automated tests. The single human-verification item is a smoke confirmation of the live map canvas wiring — it cannot be automated but the underlying React invariant is fully covered by Storybook.

---

_Verified: 2026-04-26T12:35:00Z_
_Verifier: Claude (gsd-verifier)_
