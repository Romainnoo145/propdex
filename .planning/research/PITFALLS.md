# Domain Pitfalls: Premium Data Presentation UI/UX Overhaul

**Domain:** PropTech SaaS — adding comparison views, mini-maps, tab layouts, map filtering, scoring visualizations, and theme polish to an existing React 19 + MapLibre + TanStack platform
**Researched:** 2026-02-21
**Scope:** Pitfalls specific to adding premium data presentation features to Propdex (existing ~40K LOC, React 19 + MapLibre 5.x + TanStack Stack)

---

## Critical Pitfalls

Mistakes that cause rewrites, broken maps, or corrupted state.

---

### Pitfall 1: MapLibre Mini-Map Initialized Before Container Has Dimensions

**What goes wrong:**
A mini-map is mounted inside a modal, drawer, or initially-hidden tab panel. MapLibre initializes against a container with `height: 0` (or `display: none`), adopts zero dimensions, and renders as a blank tile-less rectangle. Calling `map.resize()` after the fact may not fix it if the GL context was created with zero-area.

**Why it happens:**
React renders the JSX tree before CSS transitions finish. A modal or tab panel whose animation is 300ms means the container reports `offsetHeight === 0` at `useEffect` mount time when `map = new maplibregl.Map({ container })` is called.

**Propdex specifics:**
- `MapView.tsx` uses `useEffect([], [])` — fine for the persistent main map (container always visible), but that pattern is wrong for mini-maps inside `<Drawer>` or `<Modal>`.
- `Drawer.tsx` renders only when `isOpen === true`, then animates. The container has real dimensions by the time the Drawer is open, but `requestAnimationFrame` timing in `useEffect` is still not guaranteed to fire after CSS transitions.

**Consequences:** Blank map that never recovers without a hard re-mount; or renders tiles scaled to 0px.

**Prevention:**
Use `map.on('load', ...)` as the gate, never the React `useEffect` mount. For hidden containers, use a `ResizeObserver` on the container div and call `map.resize()` whenever the container transitions from 0 dimensions to real dimensions. Alternatively, delay map instantiation until `containerRef.current.offsetHeight > 0`. Do NOT use `display: none` on map containers — use `visibility: hidden` or `opacity: 0` with real dimensions preserved.

**Code pattern to use:**
```typescript
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!isOpen || !containerRef.current) return;

  // Wait for container to have real dimensions
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (entry && entry.contentRect.height > 0) {
      if (!mapRef.current) {
        mapRef.current = new maplibregl.Map({ container: containerRef.current! });
      } else {
        mapRef.current.resize();
      }
      observer.disconnect();
    }
  });
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, [isOpen]);
```

**Detection:** Map container has non-zero CSS dimensions but tiles never load; browser console shows WebGL context warnings.

**Phase:** Phase implementing mini-maps in drawers/modals.

---

### Pitfall 2: Multiple MapLibre Instances Exceed Browser WebGL Context Limit

**What goes wrong:**
Comparison view shows 2 mini-maps. Detail modals open stacked with mini-maps. The scan results page adds a filter-synced mini overview map. Total simultaneous MapLibre instances reaches 8+, at which point browsers start silently destroying the oldest WebGL context. Maps go blank with no error in the UI.

**Why it happens:**
Browsers (Chrome, Firefox, Safari) enforce a limit of approximately 8 simultaneous WebGL contexts per page. MapLibre creates one WebGL context per `Map` instance. There is no MapLibre-level context pooling; this is a browser constraint.

**Propdex specifics:**
- Existing main map on `/map` = 1 context (persistent).
- Comparison view adds 2 side-by-side mini-maps = 3 total.
- Open a parcel detail modal with mini-map = 4.
- Projects page with a per-project thumbnail map = rapidly hits limit.

**Consequences:** Silent map blanking; oldest context destroyed without user-visible error; difficult to debug because the failing map may not be the newly added one.

**Prevention:**
- Budget WebGL contexts explicitly: decide the maximum simultaneous map instances and document it.
- Destroy map instances when their container unmounts — `map.remove()` in cleanup, which Propdex's `MapView.tsx` already does correctly.
- For mini-maps in modals: only initialize when modal is open, destroy on close. Do NOT use `display: none` to hide — actually unmount.
- Limit comparison view to maximum 2 maps. Never add per-row thumbnail maps in scrollable lists.
- Use `canvas` screenshots (static PNG fallback) for any list-level map thumbnails instead of live instances.

**Detection:** Maps randomly go blank after navigating; no network errors; `Too many active WebGL contexts` in console.

**Phase:** Phase implementing comparison views and mini-maps. Needs budget decision upfront.

---

### Pitfall 3: Tab Layout Destroys State on Tab Switch

**What goes wrong:**
Refactoring from long-scroll layout to tabs (e.g., Overview / Kaart / Analyse) causes data re-fetch, scroll position loss, and filter reset every time the user switches tabs. A 3-second API call fires on each tab return.

**Why it happens:**
React unmounts components not in the active tab if the tab implementation uses conditional rendering (`{activeTab === 'kaart' && <MapTab />}`). TanStack Query caches the server data, but component-local state (scroll position, selected row, expanded accordion) is gone. The map instance is destroyed and re-initialized on each switch.

**Propdex specifics:**
- `PropertyDetailDrawer.tsx` at 773 lines — if refactored to tabs, each tab's sub-component will be conditionally rendered.
- The persistent MapLibre instance (via `MapContext`) lives in `MapShell.tsx` above the route, so it survives tab switches at the route level. But any mini-map inside `PropertyDetailDrawer` does not.
- `ResultsTable.tsx` has row selection state, pagination state, and sort state — all local to the component. Unmounting loses them.

**Consequences:** Jarring UX where returning to a tab shows loading spinners and reset state; perceived as buggy even if data is correct.

**Prevention:**
- Use CSS visibility toggling (`display: none` → `display: block`) for tabs where you need to preserve DOM state. For map containers, use `visibility: hidden` not `display: none` (maps need real dimensions).
- Lift scroll position, selected row, and filter state to the parent route (URL search params via TanStack Router) so it survives tab switches via unmount/remount.
- Do NOT use `{activeTab === 'x' && <Component />}` for any tab that contains a map or has expensive initialization. Use `<div className={activeTab === 'x' ? '' : 'hidden'}>`.
- TanStack Router discussion confirms there is no built-in "keep alive" — the CSS approach is the standard workaround.

**Detection:** React DevTools shows component mount/unmount on tab switch; TanStack Query shows `isFetching: true` on every tab return.

**Phase:** Phase converting PropertyDetailDrawer to tab layout.

---

### Pitfall 4: Filter State Desync Between Map Controls and URL/Table

**What goes wrong:**
Adding map-level filter controls (e.g., score range slider on the map overlay) that update `ResultsFilterPanel` state creates a bidirectional sync problem. User changes filter on the map — URL updates — table re-fetches. User changes filter in the table panel — URL updates — map controls don't reflect the new state. After a browser Back, both are out of sync.

**Why it happens:**
The current architecture stores all filter state in URL search params (via `resultaten.tsx` `handleFilterChange`). Adding a second write path (map controls) that also writes to URL causes race conditions when both update within the same render cycle. URL as source of truth works only if all writers go through the same `navigate()` call.

**Propdex specifics:**
- `resultaten.tsx` uses TanStack Router's `navigate()` with `search: (prev) => ({ ...prev, ... })` pattern — this is the correct single writer.
- `ResultsFilterPanel.tsx` already uses debounced local state for area inputs, then commits to URL. Adding a map slider with its own local state creates a parallel commit path.
- TanStack Router Discussion #1249 notes: "URL as state doesn't mean all state should be in URL" — ephemeral map interactions (hover, drag) belong in component state, not URL.

**Consequences:** Filters that appear visually active but don't match the data being shown; Back button confusion; double API calls when both writers fire simultaneously.

**Prevention:**
- Single source of truth: URL search params (already the pattern). All filter changes — map or table — must call `navigate()` via the same handler.
- Extract `handleFilterChange` to a shared hook imported by both `ResultsFilterPanel` and map controls.
- Map controls should read initial state from URL on mount and have NO local state; they write directly to URL and re-read on next render.
- Add `replace: true` to navigation calls for filter changes to avoid history stack pollution.
- Debounce in the handler, not in local component state, when adding map slider controls.

**Detection:** Filter pills in table panel show "active" but the map scatter plot shows a different distribution; table row count doesn't match visible map points.

**Phase:** Phase adding map filter controls.

---

## Moderate Pitfalls

### Pitfall 5: PropertyDetailDrawer 773-Line File Grows Further During Refactor

**What goes wrong:**
The drawer refactor adds tab navigation, mini-map, and new data sections without splitting the file. The file grows to 1000+ lines. Sub-components defined inside the file cause every drawer open to re-create their function references, causing unnecessary child re-renders.

**Why it happens:**
Components defined inline in the same file are technically separate (not re-created per render if defined at module level), but developers tend to co-locate new sections. 773 lines makes the file hard to audit, making it easy to accidentally add inline component definitions inside the main component body.

**Propdex specifics:**
- `PropertyDetailDrawer.tsx` currently has `KadasterContent`, `BestemmingContent`, `MonumentContent`, `BronnenContent` all in the same file. This is acceptable at the current size but will explode with tabs.
- The 300-line guideline is already violated. Any new feature added here compounds the problem.

**Prevention:**
- Before adding tabs, split NOW: extract each content section to `property/sections/KadasterSection.tsx`, etc.
- The mini-map tab should be a separate file `property/tabs/MapTab.tsx` that manages its own MapLibre lifecycle.
- After splitting, `PropertyDetailDrawer.tsx` should be <150 lines (the shell: Drawer + tab header + tab panels that import the section files).

**Detection:** File grows past 400 lines during the PR; CI should enforce the 300-line limit (project rule).

**Phase:** First phase touching PropertyDetailDrawer. Split is a prerequisite, not an afterthought.

---

### Pitfall 6: MapLibre Scroll Hijacking Inside Scroll Containers

**What goes wrong:**
A mini-map inside the scrollable drawer content area intercepts scroll events intended for the drawer. User tries to scroll down the drawer to see more property sections — the map zooms or pans instead. On mobile, touch events are captured by the map, preventing the bottom sheet from being scrolled.

**Why it happens:**
MapLibre's `ScrollZoomHandler` and touch handlers are active by default. When the map container is inside a scrollable parent, scroll/touch events bubble to MapLibre before reaching the scroll container.

**Propdex specifics:**
- `Drawer.tsx` already uses `onTouchStart={(e) => e.stopPropagation()}` on the content wrapper to prevent touch event conflicts. But this stops propagation upward, not downward into MapLibre.
- A mini-map inside the drawer's `overflow-y-auto` div will compete with the drawer scroll.

**Prevention:**
- Disable scroll zoom on mini-maps: `scrollZoom: false` in `MapOptions`.
- Disable drag pan if the mini-map is read-only (showing location only): `dragPan: false`, `dragRotate: false`.
- For any interactive mini-map, use a fixed height container that does NOT sit inside the scroll area — instead, pin it above the scrollable section or use a sticky position.
- Never put an interactive MapLibre instance inside `overflow-y-auto` without disabling conflicting interactions.

**Detection:** Scrolling the drawer causes unexpected map zoom; bottom sheet on mobile cannot be dismissed by swiping down.

**Phase:** Phase adding mini-maps to drawers/modals.

---

### Pitfall 7: Hardcoded Colors in Map Layer Configurations Break Theme Consistency

**What goes wrong:**
MapLibre layer paint properties use hardcoded hex colors (`#dc2626`, `#ffffff`, `#d4a843`). When dark/light mode is added or refined, these colors never update because MapLibre's style system is outside the CSS variable system. Light mode launches with dark-mode-optimized map overlays — white outlines that are invisible on light tile backgrounds.

**Why it happens:**
MapLibre GL paint properties accept only literal color values, expressions, or data-driven steps — not CSS variables. CSS custom properties are not readable inside a GL style JSON object.

**Propdex specifics:**
- `ParcelScoreLayer.tsx`: `'line-color': '#ffffff'` (white outline) — invisible on light CartoDB tiles.
- `WijkBoundariesLayer.tsx`: `'text-halo-color': '#ffffff'` — same issue.
- `GemeenteBoundariesLayer.tsx`: `'line-color': '#d4a843'` — hardcoded amber that may not match `--color-amber-accent` OKLCH value visually.
- Light mode uses the same CartoDB light tiles but with different contrast expectations.

**Consequences:** Parcel outlines invisible in light mode; score layer looks washed out; boundary labels unreadable.

**Prevention:**
- Define a `MAP_THEME_COLORS` object in a dedicated module (`lib/map-theme.ts`) with separate `dark` and `light` entries for each semantic color (outline, boundary, label, halo, etc.).
- Pass `theme` state to all map layer functions; compute the color object at call time.
- Subscribe to theme changes and call the layer update functions when theme toggles: `setLayerPaintProperty` / remove + re-add layers.
- Do NOT try to dynamically read CSS variables at runtime inside GL paint expressions — it doesn't work. Read them once via `getComputedStyle(document.body).getPropertyValue('--color-amber-accent')` and pass them explicitly.

**Detection:** Toggle to light mode — parcel outlines disappear; score gradient renders with poor contrast on light tiles.

**Phase:** Theme polish phase (and any phase adding new map layers).

---

### Pitfall 8: Legacy `gray-*` Tailwind Classes Survive Refactor and Break in Light Mode

**What goes wrong:**
`ProjectEditModal.tsx` and `ProjectCreateModal.tsx` use hardcoded `gray-*` Tailwind classes (`border-gray-200 bg-white text-gray-900`). These components look correct in dark mode by accident (bg-white modals on dark backdrop look fine) but break in light mode because they use Tailwind's built-in gray palette rather than the project's semantic `grey-*` CSS variable system.

**Why it happens:**
These components were built early (before the semantic `grey-*` system was established) using default Tailwind colors. They weren't caught because dark mode was the default; the discrepancy is only obvious in light mode where `bg-white` duplicates the page background.

**Propdex specifics:**
- `ProjectEditModal.tsx` lines 80-148: 14 `gray-*` class usages.
- `ProjectCreateModal.tsx`: same count.
- `ChangeTimeline.tsx` `PermitIcon`/`ZoningIcon`: `bg-blue-100`/`bg-green-100` (light-tinted icon backgrounds) look fine in dark mode but conflict with the semantic color system.

**Consequences:** Components look visually inconsistent with the rest of the app in light mode; ESLint Tailwind plugin may not catch this automatically since `gray-*` is valid Tailwind.

**Prevention:**
- Audit ALL `gray-*` and `white` classes before the theme polish phase: `grep -r "gray-\|bg-white\|text-white" src/components --include="*.tsx"`.
- Replace with semantic equivalents: `gray-900` → `grey-900`, `bg-white` → `bg-grey-950`, `text-gray-900` → `text-grey-100`.
- Use `ChangeTimeline` icon backgrounds as a conversion example: `bg-blue-100` → `bg-blue-500/10`, `text-blue-600` → `text-blue-400`.
- Add a lint rule or CI check: `eslint-plugin-tailwindcss` with a `forbiddenClassNames` config to block `gray-*`.

**Detection:** Toggle to light mode — project modals show white-on-white text; icon backgrounds are too light/washed.

**Phase:** Theme polish phase. This audit must be Phase 1 of any theme work.

---

### Pitfall 9: Scoring Visualization Performance Degrades With 1000+ Rows in DOM

**What goes wrong:**
Adding a per-row score visualization (radial progress bar, animated gauge, or SVG arc) to the results table causes frame drops and janky scrolling when 50 rows are rendered per page, each with an SVG-based score indicator. At 1000 total rows with virtual scroll, incorrect virtualization setup causes layout thrashing.

**Why it happens:**
SVG-based visualizations with CSS animations run on the main thread. 50 animated SVG elements per table page create 50 RAF callbacks. Without proper virtualization, scrolling 1000 rows means React renders all 1000 at once.

**Propdex specifics:**
- `ResultsTable.tsx` currently uses server-side pagination (50 rows per page) — this limits the DOM node count effectively. The existing `ScoreBadge` is a pure HTML span with CSS, which is performant.
- If a new radial score gauge replaces `ScoreBadge`, each row adds ~3-5 SVG elements. 50 rows × 4 SVG nodes = 200 additional DOM nodes per page — borderline acceptable.
- The mobile card view (`ParcelCard.tsx`) renders all visible cards without virtualization — acceptable at 50/page, but if page size increases or infinite scroll is added, this becomes a problem.

**Consequences:** Scroll jank at 60+ rows; CPU spikes on score column renders; mobile devices with slower GPUs show visible animation stuttering.

**Prevention:**
- Keep score visualizations as pure CSS where possible. The existing `ScoreBadge` (span with Tailwind classes) is correct. Enhance with CSS-only techniques: `background: conic-gradient()` for radial display — no SVG, no JS animation.
- If SVG is required (e.g., animated arc), disable animation after first paint: `prefers-reduced-motion` media query + `animation: none`.
- Do NOT add `requestAnimationFrame`-based score counters — they run continuously even when off-screen.
- If adding TanStack Virtual, ensure `estimateSize` returns accurate row heights. Variable heights without accurate estimates cause scroll position jumps.
- The server-side pagination at 50 rows is the correct performance budget. Do not increase page size without adding virtualization first.

**Detection:** Chrome DevTools Performance tab shows long frames (>16ms) during table scroll; "Rendering" section shows frequent layout recalculations.

**Phase:** Phase adding scoring visualizations to results table/cards.

---

### Pitfall 10: Comparison View Creates N×API-Calls Race Conditions

**What goes wrong:**
A side-by-side comparison view loads two property detail payloads simultaneously. If both requests modify the same cached TanStack Query key, or if one succeeds and one fails, the comparison UI partially renders — one panel shows data, the other shows an error or stale cache.

**Why it happens:**
TanStack Query caches by query key. If both parcels in the comparison use the same data shape but different IDs, the cache keys should be different (good). But if the comparison uses the existing `PropertyDetailDrawer` with a single `data` prop driven by a single selected parcel, switching to "compare 2 parcels" requires a parallel fetch architecture that doesn't exist yet.

**Propdex specifics:**
- Current pattern: `selectedParcel` (single) → API fetch → `PropertyDetailDrawer` shows result.
- Comparison needs: `selectedParcels[]` (up to 2) → 2 parallel fetches → comparison layout.
- The `onRowClick` in `ResultsTable.tsx` sets a single `modalParcel` state. Multi-select is already implemented (checkboxes + `selectedParcelIds`), but no comparison UI exists yet.

**Consequences:** First parcel data shows, second remains loading indefinitely (if fetch quota is hit); or both fetch but comparison UI unmounts one when the other resolves.

**Prevention:**
- Use `Promise.all` / multiple parallel `useQuery` calls with distinct keys: `['parcel-enrichment', parcel_id_1]` and `['parcel-enrichment', parcel_id_2]`.
- Design the comparison component to render independently-fetched panels — each panel manages its own loading/error state. Never merge two parcel payloads into one query.
- Limit comparison to 2 parcels and enforce this at the selection layer (disable checkbox after 2 are selected).
- Use the existing `selectedParcelIds` from `BulkActionBar` as the trigger for comparison mode — no new selection architecture needed.

**Detection:** Comparison panel shows one parcel loaded, one stuck in skeleton; network tab shows only 1 of 2 requests completing.

**Phase:** Phase implementing comparison views.

---

## Minor Pitfalls

### Pitfall 11: Tab Keyboard Navigation Missing on Custom Tab Implementation

**What goes wrong:**
A custom tab component built with `div` + `onClick` handlers doesn't support keyboard navigation (`ArrowLeft`/`ArrowRight` to switch tabs, `Enter` to select). Screen readers announce nothing meaningful.

**Why it happens:**
Developers implement visible tab styling without the ARIA `role="tablist"` / `role="tab"` / `aria-selected` / `aria-controls` pattern. The visual appearance works; keyboard access does not.

**Prevention:**
- Use `role="tablist"` on the container, `role="tab"` on each tab button, `aria-selected` on the active tab, `aria-controls` pointing to the panel ID.
- Implement `onKeyDown` with `ArrowLeft`/`ArrowRight` to move focus between tabs.
- Panel div uses `role="tabpanel"` and `tabIndex={0}`.
- This is 20 lines of code but catches 100% of accessibility issues.

**Detection:** Tab through the UI — tab buttons are not focusable or don't respond to arrow keys.

**Phase:** Every phase that adds tab components.

---

### Pitfall 12: `oklch()` Colors Not Supported in All CSS Contexts

**What goes wrong:**
The design system uses `oklch()` for all semantic colors (e.g., `--color-amber-accent: oklch(0.78 0.15 85.87)`). Passing these to MapLibre paint properties via `getComputedStyle` returns the raw `oklch(...)` string, which MapLibre does not parse (it expects hex, rgb, or named colors).

**Why it happens:**
MapLibre's color parser uses a subset of CSS color parsing that predates wide `oklch()` support.

**Propdex specifics:**
- This is already an implicit risk in `GemeenteBoundariesLayer.tsx` and `WijkBoundariesLayer.tsx` where colors are hardcoded as hex (the "safe" workaround). The risk appears when developers try to be "correct" by reading CSS variables: `getComputedStyle` → MapLibre → fails.

**Prevention:**
- Define `MAP_THEME_COLORS` in `lib/map-theme.ts` using hex equivalents of the design tokens. Document which hex value corresponds to which CSS variable.
- Never pass `getComputedStyle` output directly to MapLibre. Always convert to hex first.
- Add a comment in the theme colors file: "These hex values are the MapLibre equivalents of the OKLCH design tokens in index.css."

**Detection:** MapLibre throws `Error: Invalid color "oklch(...)"` in console; layer renders with fallback black/white.

**Phase:** Map layer development in any phase.

---

### Pitfall 13: TanStack Router `navigate()` With Search Params Triggers Unnecessary Re-Fetches

**What goes wrong:**
Every `navigate()` call for filter changes causes TanStack Query to re-evaluate its cache keys. If the filter object is constructed inline (`{ ...filters, score_category: cat }`), the resulting object is a new reference even when the values are identical. This triggers spurious API calls.

**Why it happens:**
TanStack Router's `validateSearch` runs on every navigation. TanStack Query compares query keys by value (deep equality), but if the filters object is reconstructed with the same values, the key array's content is identical, so re-fetches are NOT triggered — this is actually fine. The real problem is when filter changes trigger navigation that resets `page: 0`, forcing a re-fetch even when the user is on page 0 already.

**Propdex specifics:**
- `resultaten.tsx` `handleFilterChange` always resets `page: 0`. If user is already on page 0, this navigation still fires and TanStack Query re-fetches because the `page` param in the URL changed (0 → 0 → 0 cycles if the router doesn't deduplicate identical URLs).
- TanStack Router Discussion #3686 notes that search parameter propagation must explicitly carry forward existing params, which `resultaten.tsx` already does correctly.

**Prevention:**
- Guard page reset: `page: search.page === 0 ? undefined : 0` — avoids no-op navigation.
- Use `replace: true` for filter navigation to avoid polluting browser history.
- Memoize the `filters` object (already done with `useMemo` in `resultaten.tsx` — maintain this pattern when adding new filter writers).

**Detection:** Network tab shows duplicate API calls with identical parameters; React Query Devtools shows refetch status on every filter pill click even when value doesn't change.

**Phase:** Phase adding map filter controls (new writers to the filter state).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Mini-maps in Drawer/Modal | Map initialized at 0px height (Pitfall 1) | Use ResizeObserver; delay init until `offsetHeight > 0` |
| Mini-maps in Drawer/Modal | Scroll hijacking (Pitfall 6) | Disable scrollZoom and dragPan on read-only mini-maps |
| Comparison view | WebGL context budget exceeded (Pitfall 2) | Hard cap at 2 comparison maps; destroy on close |
| Comparison view | Parallel fetch race conditions (Pitfall 10) | Independent `useQuery` per parcel; independent panel state |
| Tab layout refactor | State loss on tab switch (Pitfall 3) | CSS visibility toggle for map tabs; lift state to URL |
| Tab layout refactor | Drawer grows to 1000+ lines (Pitfall 5) | Split into section files BEFORE adding tabs |
| Tab accessibility | Missing keyboard/ARIA (Pitfall 11) | tablist/tab/tabpanel roles + ArrowKey handlers |
| Map filter controls | Filter state desync (Pitfall 4) | Single `navigate()` handler; no parallel local state |
| Map filter controls | Spurious re-fetches (Pitfall 13) | Guard page resets; use `replace: true` |
| Scoring visualizations | Scroll jank with animations (Pitfall 9) | CSS-only (conic-gradient); no SVG animations per row |
| Theme polish | Legacy gray-* classes (Pitfall 8) | Full audit before starting; grep + fix ProjectModals |
| Theme polish | Map colors ignore theme (Pitfall 7) | MAP_THEME_COLORS object; re-apply on theme change |
| Map layer work | oklch not parsed by MapLibre (Pitfall 12) | Hex equivalents in dedicated map-theme.ts module |

---

## Sources

- [MapLibre GL JS — Map does not fit container in modal window (Issue #1363)](https://github.com/maplibre/maplibre-gl-js/issues/1363) — HIGH confidence (official repo)
- [MapLibre GL JS — Too many active WebGL contexts (Discussion #3065)](https://github.com/maplibre/maplibre-gl-js/discussions/3065) — HIGH confidence (official repo)
- [MapLibre GL JS — Map.resize() API documentation](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/) — HIGH confidence (official docs)
- [TanStack Router — Best Practices for URL as State (Discussion #1249)](https://github.com/TanStack/router/discussions/1249) — HIGH confidence (official repo)
- [TanStack Router — Best Practices for Propagating Search Parameters (Discussion #3686)](https://github.com/TanStack/router/discussions/3686) — HIGH confidence (official repo)
- [TanStack Router — Cache Routes to allow Tabs to keep alive (Discussion #1447)](https://github.com/TanStack/router/discussions/1447) — HIGH confidence (official repo)
- [TanStack Virtual — Rendering lag with row and column virtualization (Issue #685)](https://github.com/TanStack/virtual/issues/685) — HIGH confidence (official repo)
- [Tailwind CSS v4 — CSS variables for dark/light mode (Discussion #15083)](https://github.com/tailwindlabs/tailwindcss/discussions/15083) — HIGH confidence (official repo)
- [Basedash Blog — How We Built Light Mode Without Tailwind's dark: Class](https://www.basedash.com/blog/how-we-built-light-mode-without-tailwind-s-dark-class) — MEDIUM confidence (practitioner, verified against official docs)
- [React Aria — ProgressBar accessibility pattern](https://react-spectrum.adobe.com/react-aria/ProgressBar.html) — HIGH confidence (official Adobe/Spectrum docs)
- Propdex codebase direct inspection (`MapView.tsx`, `ParcelScoreLayer.tsx`, `PropertyDetailDrawer.tsx`, `ResultsTable.tsx`, `ResultsFilterPanel.tsx`, `Drawer.tsx`, `ProjectEditModal.tsx`, `ChangeTimeline.tsx`, `index.css`) — HIGH confidence (source of truth)
