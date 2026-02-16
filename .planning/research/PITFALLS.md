# Domain Pitfalls: UX Redesign for PropTech Map Application

**Domain:** PropTech Map Application (MapLibre + React)
**Migration scope:** Design system addition + navigation restructure
**Researched:** 2026-02-16

## Critical Pitfalls

Mistakes that cause rewrites, full map re-renders, or major performance issues.

---

### Pitfall 1: MapLibre Instance Re-mount on Route Change

**What goes wrong:**
When restructuring navigation to use separate route pages (Map, Data/Results, Projects), the MapLibre map container gets unmounted and re-mounted on route transitions. This causes the map to fully reload: all layers, sources, event handlers, and WebGL context are destroyed and recreated. User experiences a flash of empty map, loss of camera position, and 2-5 second reload time. In SPAs with frequent navigation, memory consumption increases with each map creation/destruction cycle.

**Why it happens:**
React Router (and TanStack Router) unmount components when navigating between routes by default. If the `<MapView>` component lives inside a route file (like `map.tsx`), React destroys it when switching to another route. The MapLibre cleanup (`map.remove()`) runs, but the WebGL context and tile cache are lost. MapLibre React libraries use ref-based lifecycle patterns that don't survive route unmounts without explicit state management.

**Consequences:**
- Map flashes blank on every route change
- 2-5 second reload for tiles, layers, sources
- Loss of camera position, zoom level, selected layers
- Increased memory consumption in SPAs (MapLibre GitHub issue #4811 documents memory leaks on `map.remove()`)
- User frustration ("Why does the map keep resetting?")
- Breaking change for existing map-centric workflows

**Prevention:**

1. **Persistent Layout Pattern (recommended):** Use TanStack Router's layout routes with `<Outlet />`. Keep `<MapView>` in a persistent layout component that wraps all navigation targets. Only the outlet content (panels, tables, modals) changes; map stays mounted.

   ```tsx
   // _authenticated.tsx (layout)
   export function AuthLayout() {
     const mapRef = useRef<MapLibreMap | null>(null)
     return (
       <div className="flex h-screen">
         <MapView mapRef={mapRef} /> {/* Never unmounts */}
         <Outlet context={{ mapRef }} /> {/* Content swaps here */}
       </div>
     )
   }

   // map.tsx (route)
   export function MapRoute() {
     const { mapRef } = useOutletContext()
     // Use shared map ref, map never re-mounts
   }
   ```

2. **Router Context for Map State:** Pass map ref through TanStack Router context (not React Context, which re-renders). Use `context` prop on route definitions to share map instance without re-creating it.

3. **Conditional Visibility vs Unmount:** For panels/overlays, use CSS `display: none` or `visibility: hidden` instead of conditional rendering (`{showPanel && <Panel />}`). This keeps components mounted but hidden, preserving their state.

4. **Guard against re-initialization:** In `MapView` component, use empty dependency array `useEffect([], [])` to ensure map is created exactly once. Do NOT include `transformRequest` or other props in dependencies unless you want a full re-mount.

**Detection:**
- Map flashes white/blank when clicking navigation links
- DevTools React Profiler shows `MapView` unmounting on route change
- Browser DevTools Performance tab shows repeated MapLibre initialization
- Console warnings: "Cannot read property 'remove' of null" (stale map ref)
- Memory Profiler shows increasing heap usage with navigation
- User reports: "Map keeps resetting when I switch views"

**Phase to address:** Phase 1 (Navigation restructure foundation)
**Urgency:** CRITICAL — must be solved before any route splitting begins

---

### Pitfall 2: CSS Variable Migration Breaking Cascade Specificity

**What goes wrong:**
When replacing hardcoded glassmorphism colors with design token CSS variables, existing component styles break due to cascade and specificity conflicts. Inline styles that previously used `background: rgba(0, 0, 0, 0.55)` now use `background: var(--color-surface-dark)`, but Tailwind utility classes with higher specificity override the variable, causing panels to render with wrong backgrounds. Nested components inherit wrong token values from parent scopes. Buttons, modals, and panels render with broken colors or transparency.

**Why it happens:**
CSS custom properties follow cascade rules but are evaluated at computed-value time, not declaration time. When you define `--color-primary: #2563eb` in `:root` and override it in `.dark-mode { --color-primary: #1e40af }`, components using `var(--color-primary)` resolve to different values based on DOM hierarchy. This differs from Sass variables (compile-time) or Tailwind classes (specificity-based). Proximity matters for inheritance, but NOT for selectors. A deeply nested component can accidentally inherit a token from an intermediate parent, not the root design system.

Additionally, Tailwind's utility classes have high specificity (often `.class` or `.class.class`). When migrating from inline styles to token-based classes, the old Tailwind utilities remain in JSX. These override the new token-based variables unless you use Tailwind's `@layer` system or cascade layers to control ordering.

**Consequences:**
- Panels render with wrong background colors (opaque instead of transparent)
- Text becomes unreadable (wrong contrast ratios)
- Dark mode / light mode tokens conflict, causing visual chaos
- Components deep in tree inherit wrong token values from intermediate parents
- Animations break (CSS transitions on `var()` values behave differently than hardcoded colors)
- Design tokens don't cascade as expected, requiring extensive debugging

**Prevention:**

1. **Incremental Migration Strategy:**
   Migrate one component category at a time: buttons → cards → panels → modals. Use codemods or manual refactoring to replace hardcoded values with tokens. Do NOT mix old and new systems in the same component.

2. **Alias Old Tokens During Transition:**
   Create temporary aliases for old values to reduce blast radius:
   ```css
   :root {
     /* New design system */
     --color-amber-500: #f59e0b;

     /* Legacy aliases (deprecate in Phase 3) */
     --color-primary: var(--color-amber-500);
   }
   ```

3. **Use Cascade Layers (2026 best practice):**
   Leverage CSS `@layer` to control token ordering without specificity wars:
   ```css
   @layer base, tokens, components, utilities;

   @layer tokens {
     :root {
       --color-surface-dark: rgba(0, 0, 0, 0.55);
     }
   }

   @layer utilities {
     .bg-surface-dark {
       background: var(--color-surface-dark);
     }
   }
   ```
   This ensures utilities always win, regardless of source order.

4. **Prevent Regression with Linting:**
   Add ESLint rule to prevent hardcoded colors in new code:
   ```json
   {
     "rules": {
       "no-restricted-syntax": [
         "error",
         {
           "selector": "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
           "message": "Use design tokens instead of hardcoded colors"
         }
       ]
     }
   }
   ```

5. **Test in Isolation:**
   Create a Storybook/component playground to test token changes without full app context. Verify cascade behavior in nested components before deploying.

**Detection:**
- Visual regression: panels render with wrong colors
- DevTools Computed tab shows `var(--color-primary)` resolving to unexpected value
- Contrast checker fails (text unreadable against background)
- Dark mode switches cause color flashes or incorrect themes
- CSS transitions "jump" instead of animating smoothly
- Console warnings: `CSSStyleDeclaration` shows overridden variables

**Phase to address:** Phase 2 (Design token migration)
**Urgency:** HIGH — causes visual regression if not handled incrementally

---

### Pitfall 3: Mobile Breakpoint "Tablet Purgatory"

**What goes wrong:**
When adding mobile-responsive design to the existing desktop-first map application, the tablet breakpoint (768px - 1024px) renders in a broken hybrid state. The map is too small for desktop patterns (side-by-side panels), but slide-over drawers cover 80% of the screen, making the map unusable. Touch targets are too small for mobile but laid out for desktop. Users on iPad or small laptops experience a degraded UI that's worse than either mobile or desktop versions.

**Why it happens:**
The existing app is desktop-first (designed for 1366px+). When adding mobile responsiveness, developers often focus on extremes: small phone (360px) and desktop (1366px+). Tablet breakpoints (768px - 1024px) are treated as "scaled-down desktop" instead of a distinct layout. Tailwind's default breakpoints (`md: 768px`) encourage binary mobile/desktop thinking.

Additionally, the app's core pattern (map + side panels) doesn't scale down gracefully. At 768px width, a 400px drawer leaves only 368px for the map—too cramped for meaningful interaction. The "industrial amber" design system likely uses fixed-width components (buttons, inputs) that overflow on tablets.

**Consequences:**
- Tablet users see broken layout (panels overlap map, content overflows)
- Touch targets too small for fingers (buttons designed for mouse precision)
- Slide-over panels cover entire viewport, hiding map context
- Navigation becomes unusable (icon sidebar too small, text truncated)
- Landscape orientation (1024x768) breaks differently than portrait (768x1024)
- User abandonment on iPad (common device for real estate professionals)

**Prevention:**

1. **Design for Three Tiers, Not Two:**
   - **Mobile (320px - 768px):** Full-screen views with bottom sheet panels, stack navigation
   - **Tablet (768px - 1280px):** Slide-over panels with map visible, larger touch targets, hybrid nav
   - **Desktop (1280px+):** Side-by-side panels, icon sidebar, mouse-optimized

2. **Map-First Layout on Tablet:**
   Keep map visible at all times. Use narrower slide-over panels (max 360px) or collapsible panels that start minimized. Never cover more than 40% of viewport width on tablet.

3. **Responsive Breakpoints for PropTech:**
   ```css
   /* Tailwind config */
   theme: {
     screens: {
       'sm': '640px',   // Large phone
       'md': '768px',   // Tablet portrait
       'lg': '1024px',  // Tablet landscape / small laptop
       'xl': '1280px',  // Desktop
       '2xl': '1536px', // Large desktop
     }
   }
   ```
   Design distinct layouts for `md` and `lg`, don't assume `md === desktop`.

4. **Touch Target Minimum:**
   On `md` and below, enforce 44px minimum touch target (Apple HIG standard):
   ```css
   @media (max-width: 1024px) {
     button, a, input {
       min-height: 44px;
       min-width: 44px;
     }
   }
   ```

5. **Test on Real Devices:**
   iPad (10.2", 1620x2160), iPad Pro (12.9", 2048x2732), Surface (1368x912). Emulators don't catch touch interaction issues.

**Detection:**
- Panels overlap map on tablet (768px - 1024px)
- Touch targets fail "fat finger" test (< 44px)
- Content overflows horizontally on tablet
- Navigation icons unreadable at `md` breakpoint
- Landscape vs portrait tablet render differently (aspect ratio not handled)
- User complaints from iPad users

**Phase to address:** Phase 3 (Mobile responsiveness)
**Urgency:** HIGH — iPad is common for real estate professionals

---

## Moderate Pitfalls

These cause user experience issues or technical debt but don't require rewrites.

---

### Pitfall 4: Slide-Over Panel Animations Block Map Interactions

**What goes wrong:**
When adding slide-over panel animations (slide-in drawers, bottom sheets) to the design system, the CSS transitions cause map interactions to lag or freeze during animation. Panning the map while a drawer is animating feels janky. Touch/click events on the map are blocked or delayed by the animating panel overlay, even when the panel doesn't visually cover the map area.

**Why it happens:**
MapLibre runs on WebGL (GPU-accelerated), while CSS animations run on the main thread (unless using `transform` and `opacity` only). When a panel animates with `width`, `left`, or `background` transitions, it triggers layout recalculation (reflow) on every frame. This blocks the main thread, preventing MapLibre from processing map interactions. Additionally, slide-over panels often use `position: fixed` with high `z-index`, creating a stacking context that captures pointer events even when the panel is translucent or off-screen.

**Prevention:**

1. **GPU-Accelerated Animations Only:**
   Use `transform` and `opacity` for all panel animations. Never animate `width`, `height`, `left`, `top`, or `background`.
   ```css
   /* BAD: triggers reflow */
   .drawer {
     transition: width 300ms;
     width: 400px;
   }

   /* GOOD: GPU-accelerated */
   .drawer {
     transition: transform 300ms;
     transform: translateX(0);
     width: 400px; /* fixed, not animated */
   }
   ```

2. **Pointer Events Control:**
   Use `pointer-events: none` on animating elements, enable only when animation completes:
   ```css
   .drawer {
     pointer-events: none;
   }
   .drawer[data-state="open"] {
     pointer-events: auto;
   }
   ```

3. **Will-Change Hint:**
   Tell browser to optimize for animation:
   ```css
   .drawer {
     will-change: transform, opacity;
   }
   ```
   Remove after animation completes to avoid memory overhead.

4. **Debounce Map Interactions During Transition:**
   Disable map gestures during panel animation:
   ```tsx
   const [isAnimating, setIsAnimating] = useState(false)

   function openDrawer() {
     setIsAnimating(true)
     if (mapRef.current) {
       mapRef.current.dragPan.disable()
     }
     setTimeout(() => {
       setIsAnimating(false)
       mapRef.current?.dragPan.enable()
     }, 300) // Match animation duration
   }
   ```

5. **Test with Performance Profiler:**
   Use Chrome DevTools Performance tab. Record while opening/closing panel. Look for "Recalculate Style" or "Layout" in the timeline—these indicate main thread blocking.

**Detection:**
- Map panning feels laggy when drawer opens/closes
- Performance Profiler shows layout recalculation spikes
- Mobile devices show stuttering (60fps → 30fps during animation)
- Clicks on map are delayed or don't register during panel animation
- DevTools FPS meter shows dropped frames during transitions

**Phase to address:** Phase 4 (Panel animations)
**Urgency:** MEDIUM — affects UX but not blocking

---

### Pitfall 5: Design Token Proliferation (Too Many Tokens)

**What goes wrong:**
When creating the "Industrial Amber" design system, the team creates hundreds of highly specific tokens: `--color-amber-button-hover-border`, `--spacing-panel-header-left`, `--font-size-card-subtitle-mobile`. The token file grows to 500+ lines. Developers struggle to find the right token, guess wrong, or create duplicates. The design system becomes rigid—adding a new component requires 20 new tokens. Design iteration slows to a crawl.

**Why it happens:**
Teams treat design tokens like a database schema, creating a token for every possible value. This stems from fear of inconsistency or cargo-culting design system examples (Material Design has 100+ color tokens). Without a clear token hierarchy (primitive → semantic → component), tokens multiply uncontrollably.

**Prevention:**

1. **Three-Tier Token Hierarchy:**
   - **Primitives:** Raw values (`--amber-500: #f59e0b`)
   - **Semantic:** Purpose-based (`--color-accent: var(--amber-500)`)
   - **Component:** Scoped overrides (`--button-bg: var(--color-accent)`)

   Most components use semantic tokens. Component tokens are rare, only for complex components.

2. **80/20 Rule:**
   80% of the UI should use 20% of tokens. If you need a new token for every component, your system is too specific.

3. **Alias Aggressively:**
   ```css
   :root {
     /* Primitives */
     --amber-500: #f59e0b;
     --gray-900: #111827;

     /* Semantic (used by 80% of components) */
     --color-accent: var(--amber-500);
     --color-text: var(--gray-900);
     --spacing-md: 1rem;

     /* Component overrides (rare) */
     --button-padding: var(--spacing-md);
   }
   ```

4. **Start Minimal, Add on Demand:**
   Launch with 20-30 tokens. Add new tokens only when the same hardcoded value appears 3+ times in the codebase.

5. **Document Decision Tree:**
   ```
   "What token for button background?"
   → Is it an accent action? → --color-accent
   → Is it destructive? → --color-error
   → Is it neutral? → --color-surface
   ```

**Detection:**
- Token file exceeds 200 lines
- Developers ask "Which token should I use?" frequently
- Multiple tokens with same computed value (duplication)
- New components require 5+ new tokens
- Design changes require updating 10+ token references

**Phase to address:** Phase 2 (Design token creation)
**Urgency:** MEDIUM — causes tech debt if unchecked

---

### Pitfall 6: Imperative Map Layer Logic in useEffect Cleanup Hell

**What goes wrong:**
The current codebase uses imperative `useEffect` + ref patterns for all map layers (see `map.tsx` lines 249-257 for bestemmingsplan click handler, lines 269-301 for monitored wijk overlay). When restructuring navigation, components mount/unmount more frequently. Cleanup functions run out of order, layers are removed before their dependencies, causing "Cannot read property 'getLayer' of undefined" errors. Memory leaks appear (event handlers not removed, layers not cleaned up). Adding new layers becomes a minefield of dependency arrays and cleanup race conditions.

**Why it happens:**
MapLibre's API is imperative (`map.addLayer()`, `map.removeLayer()`), but React's model is declarative. The current code bridges this with `useEffect`:
```tsx
useEffect(() => {
  if (!mapReady || !mapRef.current) return
  addBestemmingsplanLayer(mapRef.current)
  return () => removeBestemmingsplanLayer(mapRef.current)
}, [mapReady])
```

When navigation causes remounts, these effects run in unpredictable order. A layer's cleanup runs after the map is removed, or before a dependent layer is cleaned up. The dependency array (`[mapReady, wijkGeojson, monitoredProjects]`) triggers re-runs when unintended, causing layers to flicker or duplicate.

**Consequences:**
- Console errors: "Cannot read property 'getLayer' of undefined"
- Map layers duplicate on route change (2x gemeente boundaries)
- Memory leaks (event handlers persist after component unmount)
- Race conditions (cleanup runs before async layer load completes)
- Adding new layers requires understanding 5+ useEffect interactions

**Prevention:**

1. **Centralize Layer Management:**
   Create a `useMapLayers` hook that manages all layers in one place:
   ```tsx
   function useMapLayers(mapRef: RefObject<MapLibreMap>) {
     const [layers, setLayers] = useState<LayerConfig[]>([])

     useEffect(() => {
       if (!mapRef.current) return

       layers.forEach(layer => {
         if (layer.visible) addLayer(mapRef.current, layer)
         else removeLayer(mapRef.current, layer.id)
       })

       return () => {
         layers.forEach(layer => removeLayer(mapRef.current, layer.id))
       }
     }, [layers, mapRef])
   }
   ```

2. **Guard Cleanup Functions:**
   Always check if map/layer exists before cleanup:
   ```tsx
   return () => {
     if (mapRef.current && mapRef.current.getLayer('layer-id')) {
       mapRef.current.removeLayer('layer-id')
     }
   }
   ```

3. **Use Refs for Mutable State (Not Dependency Arrays):**
   Avoid triggering re-runs with refs for values that shouldn't cause layer re-render:
   ```tsx
   const activeGemeenteRef = useRef(activeGemeente)
   activeGemeenteRef.current = activeGemeente
   // Use in handler without triggering useEffect
   ```

4. **Consider Declarative Wrapper:**
   Evaluate `react-map-components-maplibre` or `react-maplibre` for declarative layer API:
   ```tsx
   <RMap>
     <RSource id="gemeenten" {...sourceProps} />
     <RLayer id="gemeente-fill" {...layerProps} />
   </RMap>
   ```
   This eliminates cleanup hell entirely.

5. **Document Layer Dependencies:**
   Create a layer dependency graph:
   ```
   map (base)
   ├── gemeente-boundaries (independent)
   ├── wijk-boundaries (depends on gemeente selection)
   │   └── monitored-wijk-overlay (depends on wijk-boundaries)
   └── bestemmingsplan (independent)
   ```

**Detection:**
- Console errors on navigation: "Cannot read property 'getLayer' of undefined"
- Map layers persist after component unmount (visible in DevTools)
- Browser Memory Profiler shows increasing heap on route change
- Layers duplicate (2x boundaries after navigating back to /map)
- Event handlers fire multiple times (indicates duplicate listeners)

**Phase to address:** Phase 1 (Navigation foundation) or Phase 5 (Refactor to declarative)
**Urgency:** MEDIUM — manageable with guards, but grows with complexity

---

## Minor Pitfalls

These cause annoyance or minor bugs but are easily fixable.

---

### Pitfall 7: Glassmorphism Backdrop-Filter Performance on Mobile

**What goes wrong:**
The current glassmorphism design (`backdrop-filter: blur(16px)`) performs well on desktop but causes severe performance issues on mobile. Scrolling slide-over panels feels janky (30fps), animations stutter, battery drains faster. On older Android devices (< 2022), backdrop-filter may not render at all, showing opaque panels instead.

**Why it happens:**
`backdrop-filter` requires the browser to re-render everything behind the element on every frame. On desktop GPUs this is cheap, but mobile GPUs (especially in mid-range phones) struggle. Safari on iOS handles it better than Chrome on Android, creating inconsistent behavior.

**Prevention:**

1. **Disable Backdrop-Filter on Mobile:**
   ```css
   .panel {
     background: rgba(0, 0, 0, 0.95); /* Fallback */
   }

   @media (min-width: 1024px) {
     .panel {
       background: rgba(0, 0, 0, 0.55);
       backdrop-filter: blur(16px);
     }
   }
   ```

2. **Use `@supports` for Feature Detection:**
   ```css
   @supports (backdrop-filter: blur(16px)) {
     .panel {
       backdrop-filter: blur(16px);
     }
   }
   ```

3. **Reduce Blur Radius on Mobile:**
   ```css
   .panel {
     backdrop-filter: blur(8px); /* Less expensive */
   }

   @media (min-width: 1024px) {
     .panel {
       backdrop-filter: blur(16px);
     }
   }
   ```

4. **Test on Real Devices:**
   iPhone SE (2020), Samsung Galaxy A series, older Android (5+ years). Emulators don't show performance issues.

**Detection:**
- Scrolling panel feels laggy on mobile
- Performance Profiler shows GPU usage spikes
- Battery drains faster when panel is open
- Backdrop-filter doesn't render on older Android

**Phase to address:** Phase 3 (Mobile responsiveness)
**Urgency:** LOW — visual polish, not blocking

---

### Pitfall 8: Icon Sidebar Touch Targets Too Small on Mobile

**What goes wrong:**
The current side-rail navigation (`SideRailNav.tsx`) uses 48px (`h-12 w-12`) icon buttons, which meet the minimum touch target size. However, when the design system adds visual flourishes (smaller icons, tighter spacing for "industrial" aesthetic), touch targets shrink to 32px-36px. Mobile users miss taps, accidentally hit wrong buttons, or struggle to navigate.

**Why it happens:**
Designers prioritize visual aesthetics (compact, industrial look) over accessibility. The "industrial amber" design likely uses smaller, more precise iconography. Developers implement the design without checking touch target guidelines (Apple HIG: 44px, Material: 48px).

**Prevention:**

1. **Enforce Minimum Touch Target:**
   ```tsx
   // tailwind.config.ts
   theme: {
     extend: {
       spacing: {
         'touch-target': '44px', // Named token
       }
     }
   }

   // Component
   <button className="h-touch-target w-touch-target">
   ```

2. **Visual Icon ≠ Touch Target:**
   Icon can be 24px, but button remains 44px:
   ```tsx
   <button className="h-11 w-11 flex items-center justify-center">
     <Icon className="h-6 w-6" />
   </button>
   ```

3. **Add Spacing Between Buttons:**
   Ensure 8px minimum gap between touch targets (prevents fat-finger errors):
   ```tsx
   <div className="flex flex-col gap-2">
   ```

4. **Test with "Fat Finger" Method:**
   Use thumb (not index finger) on real device. If you miss > 10% of taps, target is too small.

**Detection:**
- Users report "hard to tap" navigation on mobile
- Accessibility audit fails (touch target < 44px)
- High rate of accidental taps (analytics show mis-clicks)
- Designers complain icons look "too big" (visual vs functional tension)

**Phase to address:** Phase 3 (Mobile responsiveness)
**Urgency:** LOW — affects UX but easily fixed

---

### Pitfall 9: TanStack Router `navigate()` Stale Closure in Map Click Handlers

**What goes wrong:**
When restructuring navigation, map click handlers (gemeente click, wijk click, bestemmingsplan click) use `navigate()` from TanStack Router to transition routes. These handlers are defined in `useCallback` with dependencies, but when navigation logic changes, the handlers don't update. Clicking a gemeente uses an old navigation function, causing navigation to fail or navigate to wrong route.

**Why it happens:**
The current code uses refs to avoid stale closures for map state (`activeGemeenteRef`, `activeScanIdRef`). But `navigate()` from `useNavigate()` is a stable function—it doesn't change. The issue arises when navigation logic changes (adding search params, changing route structure) but callbacks aren't updated because `navigate` isn't in the dependency array.

**Prevention:**

1. **Always Include `navigate` in Dependencies:**
   ```tsx
   const navigate = useNavigate()

   const handleClick = useCallback(() => {
     navigate({ to: '/map', search: { gemeente: code } })
   }, [navigate, code])
   ```

2. **Use Ref Pattern for Navigation Logic:**
   ```tsx
   const navigationLogicRef = useRef((code: string) => {
     navigate({ to: '/map', search: { gemeente: code } })
   })
   // Update ref when logic changes, callbacks stay stable
   ```

3. **Extract Navigation Logic to Custom Hook:**
   ```tsx
   function useMapNavigation() {
     const navigate = useNavigate()
     return useCallback((type: 'gemeente' | 'wijk', code: string) => {
       // Centralized navigation logic
       navigate({ to: '/map', search: { [type]: code } })
     }, [navigate])
   }
   ```

4. **Test Navigation Changes:**
   After route restructure, manually test all map click handlers (gemeente, wijk, bestemmingsplan, parcel) to ensure they navigate correctly.

**Detection:**
- Map click doesn't navigate (handler uses stale navigate function)
- Navigation goes to wrong route (old route structure)
- Console warning: "Cannot update component while rendering" (stale closure side effect)
- Clicking same feature twice behaves differently (closure captured different state)

**Phase to address:** Phase 1 (Navigation restructure)
**Urgency:** LOW — easy to catch in testing

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Navigation Foundation | MapLibre re-mount on route change (Pitfall 1) | Use persistent layout with `<Outlet />`, keep `<MapView>` in layout component |
| Phase 1: Navigation Foundation | TanStack Router stale closures (Pitfall 9) | Include `navigate` in all callback dependencies |
| Phase 2: Design Token Migration | Cascade specificity conflicts (Pitfall 2) | Use cascade layers, migrate incrementally, alias old tokens |
| Phase 2: Design Token Migration | Token proliferation (Pitfall 5) | Start with 20-30 tokens, three-tier hierarchy, add on demand |
| Phase 3: Mobile Responsiveness | Tablet purgatory (Pitfall 3) | Design distinct tablet layout, test on iPad, 44px touch targets |
| Phase 3: Mobile Responsiveness | Glassmorphism performance (Pitfall 7) | Disable backdrop-filter on mobile, reduce blur radius |
| Phase 3: Mobile Responsiveness | Touch target size (Pitfall 8) | Enforce 44px minimum, separate visual icon from touch target |
| Phase 4: Panel Animations | Animation blocking map (Pitfall 4) | Use transform/opacity only, pointer-events control, test with Profiler |
| Phase 5: Layer Management Refactor | useEffect cleanup hell (Pitfall 6) | Centralize layer management, guard cleanup, consider declarative wrapper |

---

## Sources

### MapLibre + React Patterns
- [MapLibre React Components Tutorial](https://maplibre-react-components.pentatrion.com/tutorial)
- [visgl/react-map-gl Issue #2166: Map resizing breaks with `reuseMaps`](https://github.com/visgl/react-map-gl/issues/2166)
- [MapLibre GL JS Memory Leak Issue #4811](https://github.com/maplibre/maplibre-gl-js/issues/4811)
- [MapLibre React Native Memory Leak Issue #873](https://github.com/maplibre/maplibre-react-native/issues/873)
- [How to display MapLibre GL JS using React](https://docs.maptiler.com/react/maplibre-gl-js/how-to-use-maplibre-gl-js/)

### React Router + State Preservation
- [Understanding Layout Components and React Router Outlet](https://medium.com/@jackpritomsoren/understanding-layout-components-and-react-router-outlet-in-react-03b8f96ac551)
- [TanStack Router Discussion #131: useState always using initial value on route change](https://github.com/TanStack/router/discussions/131)
- [TanStack Router: Render Optimizations](https://tanstack.com/router/v1/docs/framework/react/guide/render-optimizations)
- [React Navigation: Navigator Hierarchy Issues](https://reactnavigation.org/)

### Design System Migration
- [Migrations are the hardest part of design systems work](https://maecapozzi.com/newsletter/75)
- [Tips and tricks for Design System migrations](https://medium.com/@nonisnilukshi/tips-and-tricks-for-design-system-migrations-5beafb8e58c5)
- [How to Manage Breaking Changes in Design Tokens](https://designtokens.substack.com/p/how-to-manage-breaking-changes-in)
- [Design Tokens: The Foundation of Your UI Architecture](https://feature-sliced.design/blog/design-tokens-architecture)

### CSS Variables + Cascade
- [CSS Custom Properties In The Cascade](https://www.smashingmagazine.com/2019/07/css-custom-properties-cascade/)
- [CSS Custom Properties Guide 2026](https://devtoolbox.dedyn.io/blog/css-variables-complete-guide)
- [Using Custom Property "Stacks" to Tame the Cascade](https://css-tricks.com/using-custom-property-stacks-to-tame-the-cascade/)
- [How to use CSS variables with React](https://www.joshwcomeau.com/css/css-variables-for-react-devs/)

### Mobile-First vs Desktop-First
- [Mobile-First Design: What It Is & Why It Matters in 2026](https://seizemarketingagency.com/mobile-first-design/)
- [Mobile-First vs Desktop-First: Choosing the Right Strategy](https://www.digittrix.com/blogs/mobile-first-vs-desktop-first-choose-the-right-approach)
- [The State Of Mobile First and Desktop First](https://ishadeed.com/article/the-state-of-mobile-first-and-desktop-first/)

### Performance: Animations + WebGL
- [Comparing the best React animation libraries for 2026](https://blog.logrocket.com/best-react-animation-libraries/)
- [Progressive Enhancement with WebGL and React](https://www.14islands.com/journal/progressive-enhancement-with-webgl-and-react)
- [WebGL Overlay View (Google Maps)](https://developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view)
- [Mastering Web Transitions: From CSS Transitions to WebGL](https://www.awwwards.com/mastering-web-transitions.html)

### React Memory Leaks + Cleanup
- [How to Fix Memory Leaks in React Applications](https://www.freecodecamp.org/news/fix-memory-leaks-in-react-apps/)
- [Avoiding race conditions and memory leaks in React useEffect](https://www.wisdomgeek.com/development/web-development/react/avoiding-race-conditions-memory-leaks-react-useeffect/)
- [Understanding Memory Leaks in React](https://medium.com/@ignatovich.dm/understanding-memory-leaks-in-react-how-to-find-and-fix-them-fc782cf182be)

### Responsive Breakpoints
- [Breakpoint: Responsive Design Breakpoints in 2025](https://www.browserstack.com/guide/responsive-design-breakpoints)
- [Breakpoints in Responsive Design - Nielsen Norman Group](https://www.nngroup.com/articles/breakpoints-in-responsive-design/)
- [Responsive design - Tailwind CSS](https://tailwindcss.com/docs/responsive-design)
