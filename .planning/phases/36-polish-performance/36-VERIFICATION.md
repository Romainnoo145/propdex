---
phase: 36-polish-performance
verified: 2026-02-18T15:37:26Z
status: gaps_found
score: 3/5 must-haves verified
re_verification: false
gaps:
  - truth: "Animations run at 60fps on desktop and 30fps minimum on mid-range mobile"
    status: failed
    reason: "No animation frame rate measurement is possible programmatically. Phase-03 added motion-reduce:transition-none and CSS transform-based transitions (GPU-composited, not layout-affecting), but 60fps compliance cannot be verified without runtime profiling."
    artifacts:
      - path: "frontend/src/components/layout/InspectorPanel.tsx"
        issue: "Uses CSS transition-transform (correct for GPU compositing), but actual fps is unverifiable without runtime device profiling"
    missing:
      - "Human verification: open browser DevTools Performance panel on desktop and mid-range mobile emulation, record InspectorPanel open/close animation, confirm frame rate meets 60fps / 30fps targets"

  - truth: "Lighthouse performance score above 90 for all main routes"
    status: failed
    reason: "Plan-01 SUMMARY explicitly documents Lighthouse score of 57 on dev server and NO_FCP on production preview. The SPA architecture requires JavaScript execution before first contentful paint, making Lighthouse >90 unachievable for this SPA without SSR. Bundle splitting was implemented but did not achieve the stated Lighthouse target."
    artifacts:
      - path: "frontend/vite.config.ts"
        issue: "manualChunks and autoCodeSplitting are correctly implemented, but Lighthouse score remains below 90 due to SPA FCP timing — not a vite.config issue"
    missing:
      - "The SC-05 goal (Lighthouse >90) was acknowledged as unachievable in the plan SUMMARY due to SPA architecture. Either the success criterion needs to be revised, or SSR/prerendering needs to be added to meet it."
human_verification:
  - test: "Animation frame rate — InspectorPanel slide animation"
    expected: "Panel slides open/close at 60fps on desktop Chrome, at least 30fps on mid-range mobile emulation"
    why_human: "Frame rate cannot be measured with grep/file checks; requires browser DevTools Performance panel or Lighthouse trace"
  - test: "Glassmorphism disabled on mobile — visual check"
    expected: "On a real mobile device (or DevTools mobile emulation at <=768px), map controls show solid bg-grey-900 with no blurring effect"
    why_human: "md: breakpoint behavior and backdrop-filter rendering requires visual/device inspection"
  - test: "Storybook renders without errors"
    expected: "Running npm run storybook shows all 11 stories (5 primitive + 6 layout) in Storybook UI without console errors"
    why_human: "Story compilation and render correctness requires running the Storybook dev server"
---

# Phase 36: Polish + Performance Verification Report

**Phase Goal:** Optimize performance, remove legacy code, and document design system.
**Verified:** 2026-02-18T15:37:26Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Animations run at 60fps on desktop and 30fps minimum on mid-range mobile | ? UNCERTAIN | CSS transform-based transitions (GPU-composited) and motion-reduce:transition-none are in place, but frame rate requires runtime measurement |
| 2 | Glassmorphism effects disabled on mobile to improve performance | ✓ VERIFIED | All `backdrop-blur-md` usages in AddressSearch.tsx, LayerToggle.tsx, ScanProgressOverlay.tsx, map.tsx use `md:backdrop-blur-md` prefix; mobile gets solid `bg-grey-900`; Sonner toast has no backdropFilter |
| 3 | Bundle size reduced by removing unused dependencies and legacy CSS | ✓ VERIFIED | manualChunks splits vendor into 4 parallel chunks (react 256KB, maplibre 1021KB, tanstack 141KB, vendor 177KB); autoCodeSplitting splits route code; undefined CSS vars eliminated from 11 files; BestemmingsplanLegend backdrop-blur removed |
| 4 | Storybook documentation complete for all UI primitives and layout shells | ✓ VERIFIED | 5 primitive stories (Phase 27) + 6 layout stories (Phase 36): SideRailNav, BottomTabNav, MapShell, ResultsShell, InspectorPanel, ReportSidebar — all substantive with router/auth/query mocks |
| 5 | Lighthouse performance score above 90 for all main routes | ✗ FAILED | Plan-01 SUMMARY explicitly records dev server Lighthouse score of 57 and NO_FCP on production preview; SPA architecture prevents Lighthouse >90 without SSR |

**Score:** 3/5 truths verified (1 uncertain, 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `frontend/vite.config.ts` | autoCodeSplitting + manualChunks + visualizer | ✓ VERIFIED | Lines 16, 24–32, 19: all three features present and wired |
| `frontend/package.json` | rollup-plugin-visualizer in devDependencies | ✓ VERIFIED | `"rollup-plugin-visualizer": "^6.0.5"` at line 61 |
| `frontend/src/components/search/AddressSearch.tsx` | Responsive glassmorphism: solid mobile, glass desktop | ✓ VERIFIED | Lines 114, 128: `bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md` pattern |
| `frontend/src/components/map/LayerToggle.tsx` | Responsive glassmorphism | ✓ VERIFIED | Line 111: `bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md` |
| `frontend/src/components/map/ScanProgressOverlay.tsx` | Responsive glassmorphism | ✓ VERIFIED | Line 56: `bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md` |
| `frontend/src/routes/_authenticated/map.tsx` | Responsive glassmorphism on scan status overlays | ✓ VERIFIED | Lines 788, 857, 865: `bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md` |
| `frontend/src/main.tsx` | No backdropFilter on Sonner toast | ✓ VERIFIED | Lines 64–66: solid `background: 'rgba(0,0,0,0.85)'`, no backdropFilter |
| `frontend/src/components/layout/InspectorPanel.tsx` | motion-reduce:transition-none on 3 elements | ✓ VERIFIED | Lines 32, 47, 125: all 3 instances present |
| `frontend/src/components/auth/LoginForm.tsx` | bg-amber-accent submit button (no --color-* vars) | ✓ VERIFIED | Line 80: `bg-amber-accent px-4 py-2 text-grey-950` |
| `frontend/src/components/reports/ReportDetailPage.tsx` | Dark theme (bg-grey-950/900), no gray-* | ✓ VERIFIED | Lines 26, 43, 57: bg-grey-950 throughout; no gray-* matches |
| `frontend/src/components/map/BestemmingsplanLegend.tsx` | bg-grey-900, no backdrop-blur, no gray-* | ✓ VERIFIED | Line 20: `bg-grey-900`; no backdrop-blur; no gray-* |
| `frontend/src/components/map/PropertyGeometryLayer.tsx` | Literal hex colors (no CSS var) | ✓ VERIFIED | Lines 39, 50, 84, 92: `'#d97706'`, `'#f59e0b'` hex literals |
| `frontend/src/stories/layout/SideRailNav.stories.tsx` | 5 stories with RouterProvider+AuthContext+QueryClient | ✓ VERIFIED | Substantive: makeRouter, makeQueryClient, AuthContext.Provider, 5 named story exports |
| `frontend/src/stories/layout/BottomTabNav.stories.tsx` | 3 stories with RouterProvider | ✓ VERIFIED | Substantive: createRouter+createMemoryHistory, 3 named story exports |
| `frontend/src/stories/layout/MapShell.stories.tsx` | 2 stories: Default + WithFloatingControls | ✓ VERIFIED | Substantive: both stories with realistic children |
| `frontend/src/stories/layout/ResultsShell.stories.tsx` | 3 stories: Default, FullWidth, WithScrollContent | ✓ VERIFIED | Substantive: all 3 exported, fullWidth prop documented |
| `frontend/src/stories/layout/InspectorPanel.stories.tsx` | 4 stories with mock ScanResultItem | ✓ VERIFIED | Substantive: mockParcel data, MapWrapper context, 4 named exports |
| `frontend/src/stories/layout/ReportSidebar.stories.tsx` | 2 stories with QueryClient+AuthContext | ✓ VERIFIED | Substantive: makeQueryClient, AuthContext.Provider, SidebarShell wrapper, 2 exports |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `vite.config.ts` visualizer | `dist/stats.html` | `process.env.ANALYZE` gate | ✓ WIRED | Line 19: conditional plugin array spread |
| `vite.config.ts` autoCodeSplitting | route lazy-loading | TanStackRouterVite plugin | ✓ WIRED | Line 16: `TanStackRouterVite({ autoCodeSplitting: true })` is first plugin |
| mobile CSS | no GPU blur on mobile | `md:` breakpoint prefix | ✓ WIRED | 7 instances across 4 files all use `md:backdrop-blur-md` not bare `backdrop-blur-md` |
| InspectorPanel transitions | GPU compositor | `transition-transform` (not layout property) | ✓ WIRED | Lines 32, 47, 125: transform/colors only — no layout-triggering transitions |
| Storybook stories | components | named imports from `@/` | ✓ WIRED | All 6 stories import real components; providers correctly stacked |

### Requirements Coverage

Phase 36 has no mapped requirements (polish phase). All 5 success criteria from ROADMAP.md are assessed above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `frontend/src/components/notifications/ChangeTimeline.tsx` | 88–135 | Legacy `gray-*` and `bg-white` classes | Info | Pre-existing; outside Phase 36 scope |
| `frontend/src/components/projects/ProjectEditModal.tsx` | 80–141 | Legacy `gray-*` and `bg-white` classes | Info | Pre-existing; outside Phase 36 scope |
| `frontend/package.json` | 32 | `react-resizable-panels` dependency still present | Info | Dependency was used in old ResultsLayout split-panel (removed Phase 30); now only used in `node_modules` but no src/ import found — potential unused dependency |

### Human Verification Required

#### 1. Animation Frame Rate (SC-01)

**Test:** Open the application in Chrome DevTools. Navigate to the map view. Open DevTools Performance panel and record while opening/closing the InspectorPanel (click a parcel marker). Also test with CPU throttling set to 4x slowdown to simulate mid-range mobile.
**Expected:** Frame rate stays at or near 60fps on desktop (no frame drops visible in Performance timeline). At 4x CPU throttling, frame rate stays above 30fps during the 300ms transition.
**Why human:** Frame rate measurement requires a running browser with Performance API; cannot be determined from source code alone.

#### 2. Mobile Glassmorphism Visual Check (SC-02)

**Test:** Open Chrome DevTools, enable device emulation (iPhone SE or similar, 375px width). Navigate to the map view. Observe the AddressSearch button, LayerToggle, and ScanProgressOverlay (trigger a scan).
**Expected:** All floating map controls appear with solid dark backgrounds (no blur visible behind them). On desktop view, the same controls should show slight blur/transparency.
**Why human:** CSS `md:` breakpoint rendering and backdrop-filter visual effect require visual inspection in a real browser.

#### 3. Storybook Renders Without Errors (SC-04)

**Test:** Run `npm run storybook` in the `frontend/` directory and open the Storybook UI at port 6006. Navigate to the Layout section and open each of the 6 stories.
**Expected:** All stories render their component without React errors or console errors. SideRailNav shows nav icons. InspectorPanel shows correct open/closed states. ReportSidebar shows empty state message.
**Why human:** Story compilation and component rendering requires the Storybook dev server to be running.

### Gaps Summary

**Two gaps block full goal achievement:**

**Gap 1 — SC-01 (Animation fps):** The technical implementation is correct (CSS `transform` transitions for GPU compositing, `motion-reduce:transition-none` for accessibility, mobile blur removed). However, the success criterion states measurable fps targets (60fps desktop, 30fps mobile) that cannot be verified without runtime profiling. This is a human verification item, not a missing implementation.

**Gap 2 — SC-05 (Lighthouse >90):** This gap is explicitly acknowledged in the Phase 36 Plan-01 SUMMARY. The SPA architecture (React + TanStack Router client-side rendering) prevents achieving Lighthouse >90 because the First Contentful Paint metric requires JavaScript execution before any DOM is painted. Headless Chrome records this as "NO_FCP." The bundle splitting delivers real-world performance improvement (reduced initial load from 1,813KB monolith to parallel-loaded chunks), but the Lighthouse score metric cannot be satisfied without adding server-side rendering or prerendering. The success criterion as written is not achievable for this architecture.

**Recommendation for SC-05:** Either (a) revise the success criterion to reflect what was actually measured ("bundle split from 1,813KB monolith to parallel-loadable chunks; dev server Lighthouse score 57 as baseline"), or (b) treat as a future-phase goal requiring SSR implementation.

**SC-02, SC-03, SC-04 are fully achieved** with all artifacts verified at all three levels (exists, substantive, wired).

---

_Verified: 2026-02-18T15:37:26Z_
_Verifier: Claude (gsd-verifier)_
