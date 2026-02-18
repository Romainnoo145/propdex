# Phase 36: Polish + Performance - Research

**Researched:** 2026-02-18
**Domain:** Frontend performance optimization, bundle analysis, CSS legacy cleanup, Storybook documentation
**Confidence:** HIGH

## Summary

Phase 36 is a cleanup and optimization phase. The codebase analysis reveals three concrete problems to solve:

1. **Bundle crisis**: The current build produces a single 1,813KB JS file (508KB gzip) with zero code splitting. Vite itself warns "Some chunks are larger than 500 kB after minification." The fix is two-pronged: enable TanStack Router's `autoCodeSplitting` option and add `manualChunks` for stable vendor libraries. This alone is likely to achieve the Lighthouse >90 target.

2. **Legacy CSS contamination**: 9 files still use old CSS variable names (`--color-primary`, `--color-border`, `--color-surface`, `--color-text`/`--color-text-secondary`) that are not defined in the current Industrial Amber `@theme`. The auth UI, form fields, and AuthLoadingScreen all reference undefined variables. Additionally, `BestemmingsplanLegend.tsx` and `ReportDetailPage.tsx` use Tailwind default `gray-*` classes instead of `grey-*` design tokens.

3. **Glassmorphism on mobile**: `backdrop-blur-md`/`backdrop-blur-sm` is applied on map floating controls (AddressSearch, LayerToggle, ScanProgressOverlay, property popup) that appear on mobile. The Tailwind v4 pattern to disable is `md:backdrop-blur-md` (desktop only) with `backdrop-blur-none` as mobile baseline, or use the responsive variant approach.

Storybook is already well-configured (v10.2.8, 5 primitive stories exist). The gap is layout shell stories for the 7 layout components (`AppLayout`, `MapShell`, `SideRailNav`, `BottomTabNav`, `InspectorPanel`, `ResultsShell`, `ReportSidebar`). These require `fullscreen` layout and context providers as decorators.

**Primary recommendation:** Start with bundle splitting (highest Lighthouse impact), then legacy CSS cleanup (correctness), then glassmorphism mobile disable, then Storybook layout shell stories.

## Standard Stack

### Core (already installed — no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | ^7.2.4 | Build tool with Rollup | Already in use; `build.rollupOptions.output.manualChunks` controls chunk splitting |
| `@tanstack/router-plugin/vite` | ^1.158.4 | TanStack Router Vite plugin | Already in use as `TanStackRouterVite()`; supports `autoCodeSplitting: true` |
| Tailwind CSS v4 | ^4.1.18 | Utility CSS | `motion-reduce:` variant built-in for animation safety |
| Storybook | ^10.2.8 | Component documentation | Already configured with vitest, a11y, docs addons |

### Supporting (dev dependencies to add)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rollup-plugin-visualizer` | ^5.12.0 | Bundle treemap visualization | During optimization work to identify what's large; remove after or keep as dev-only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `autoCodeSplitting` (TanStack) | Manual `.lazy.tsx` files | autoCodeSplitting is less work but has known HMR issues on Vite v6+; test HMR after enabling |
| `rollup-plugin-visualizer` | `vite-bundle-analyzer` | Both produce treemaps; visualizer is more battle-tested with Vite |
| CSS media queries for glassmorphism | JS-based `useIsMobile()` guard | CSS is simpler and avoids JS overhead; `md:backdrop-blur-md backdrop-blur-none` pattern |

**Installation:**
```bash
npm install --save-dev rollup-plugin-visualizer
```

## Architecture Patterns

### Recommended Project Structure (no changes needed)
```
frontend/
├── src/
│   ├── routes/          # File-based routes — split here
│   ├── stories/
│   │   ├── primitives/  # 5 stories already exist
│   │   └── layout/      # NEW: 7 layout shell stories
│   └── styles/
│       └── index.css    # @theme tokens — source of truth
├── vite.config.ts       # Add manualChunks + autoCodeSplitting
└── .storybook/
    └── preview.tsx      # Already imports index.css
```

### Pattern 1: TanStack Router autoCodeSplitting

**What:** Automatically splits route files by separating critical (loader/beforeLoad) from non-critical (component rendering) code.
**When to use:** When all routes live in a single chunk (current situation: 1.8MB).
**How:** Pass `autoCodeSplitting: true` to `TanStackRouterVite()`. Plugin must come BEFORE `react()` in plugins array (already the case).

```typescript
// vite.config.ts — add autoCodeSplitting to existing TanStackRouterVite()
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

// Source: https://tanstack.com/router/v1/docs/framework/react/guide/automatic-code-splitting
plugins: [
  TanStackRouterVite({ autoCodeSplitting: true }),
  react(),
  tailwindcss(),
]
```

**Known issue (MEDIUM confidence):** When using autoCodeSplitting with Vite 7, HMR should work, but a GitHub issue (TanStack/router#3561) reports HMR stops working on Vite v6+. Verify HMR still works after enabling — Vite 7 may have fixed this.

### Pattern 2: Vite manualChunks for Vendor Splitting

**What:** Separates rarely-changing vendor code into dedicated chunks with stable hashes — maximizes browser cache hits across deployments.
**When to use:** Always, in combination with autoCodeSplitting.

```typescript
// vite.config.ts — add build.rollupOptions
// Source: https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          // React core — most stable, changes least
          if (id.includes('react') && !id.includes('react-hook-form')) {
            return 'vendor-react';
          }
          // MapLibre — large (~800KB), changes infrequently
          if (id.includes('maplibre-gl')) {
            return 'vendor-maplibre';
          }
          // TanStack ecosystem
          if (id.includes('@tanstack')) {
            return 'vendor-tanstack';
          }
          // Lucide icons — many small files, better grouped
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          // Remaining node_modules
          return 'vendor';
        }
      },
    },
  },
},
```

### Pattern 3: Bundle Visualization

**What:** Generate a treemap showing which modules contribute to bundle size.
**When to use:** Before optimization (to find targets) and after (to verify results).

```typescript
// vite.config.ts — add to plugins for analysis builds only
import { visualizer } from 'rollup-plugin-visualizer';

// Run: ANALYZE=true npm run build
plugins: [
  TanStackRouterVite({ autoCodeSplitting: true }),
  react(),
  tailwindcss(),
  ...(process.env.ANALYZE ? [visualizer({ open: true, filename: 'dist/stats.html' })] : []),
]
```

### Pattern 4: Mobile Glassmorphism Disable

**What:** Apply backdrop-blur only on desktop; solid background on mobile.
**When to use:** Any floating map UI element that appears on mobile.
**Tailwind v4 approach:** Use responsive prefix — `backdrop-blur-none md:backdrop-blur-md`.

```tsx
// Before (applies blur on all viewports):
className="bg-grey-900/90 backdrop-blur-md"

// After (solid on mobile, blur on desktop):
className="bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md"
```

**Files affected:**
- `src/components/search/AddressSearch.tsx` (2 instances)
- `src/components/map/LayerToggle.tsx`
- `src/components/map/ScanProgressOverlay.tsx`
- `src/components/map/BestemmingsplanLegend.tsx` (also has legacy CSS to fix)
- `src/routes/_authenticated/map.tsx` (2 instances — scan status overlays)
- `src/main.tsx` — Sonner toast `backdropFilter: 'blur(24px)'` inline style

### Pattern 5: Storybook Layout Shell Stories

**What:** Fullscreen stories for layout components that require the full viewport.
**When to use:** Any component that positions itself absolutely or uses `fixed`/`h-screen`.

```tsx
// Source: https://storybook.js.org/docs/configure/story-layout
// stories/layout/SideRailNav.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import SideRailNav from '@/components/layout/SideRailNav';

const meta: Meta<typeof SideRailNav> = {
  title: 'Layout/SideRailNav',
  component: SideRailNav,
  parameters: {
    layout: 'fullscreen',  // needed for fixed-position elements
  },
};

export default meta;
type Story = StoryObj<typeof SideRailNav>;

export const Default: Story = {
  args: {
    sidebarOpen: false,
    onToggleSidebar: () => {},
  },
  decorators: [
    (Story) => (
      <div className="flex h-screen bg-grey-950">
        <Story />
        <div className="flex-1 bg-grey-900 flex items-center justify-center">
          <span className="text-grey-400 text-sm">Main content area</span>
        </div>
      </div>
    ),
  ],
};
```

### Pattern 6: Legacy CSS Variable Migration

**What:** Replace undefined `--color-primary` / `--color-text` etc. with Industrial Amber tokens.
**Mapping:**
```
--color-primary        → var(--color-amber-accent) or Tailwind: bg-amber-accent
--color-primary-hover  → var(--color-amber-accent-hover) or bg-amber-accent-hover
--color-text           → var(--color-grey-100) or text-grey-100
--color-text-secondary → var(--color-grey-400) or text-grey-400
--color-surface        → var(--color-grey-900) or bg-grey-900
--color-surface-secondary → var(--color-grey-950) or bg-grey-950
--color-border         → var(--color-grey-800) or border-grey-800
```

**Files to migrate (30 occurrences in 9 files):**
- `src/components/AuthLoadingScreen.tsx`
- `src/components/ui/FormField.tsx`
- `src/components/auth/LoginForm.tsx`, `RegisterForm.tsx`, `GoogleButton.tsx`, `AuthTabs.tsx`
- `src/routes/auth/index.tsx`, `google-callback.tsx`
- `src/components/map/PropertyGeometryLayer.tsx` (MapLibre paint properties)

### Anti-Patterns to Avoid

- **Enabling `autoCodeSplitting` without testing HMR**: Check that hot module replacement still works in dev after enabling.
- **Removing backdrop-blur entirely on desktop**: Map floating cards need it per DS-04 decisions. Only disable on mobile.
- **Adding Lighthouse CI as a CI gate immediately**: Run Lighthouse locally first to measure baseline, then enforce after optimizations are proven.
- **Splitting layout shell stories with mocked TanStack Router**: Use `MemoryRouter` pattern only if needed — keep stories simple with static props.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bundle chunk analysis | Custom Rollup plugin | `rollup-plugin-visualizer` | Handles circular deps, produces accurate treemaps |
| Route-level code splitting | Manual dynamic imports per route | `TanStackRouterVite({ autoCodeSplitting: true })` | Static analysis by the plugin is more reliable |
| Animation performance profiling | Manual Chrome DevTools scripting | Chrome DevTools Performance tab + React Profiler | Built-in, no overhead |
| Lighthouse scoring | Custom audit scripts | `lighthouse` CLI or `@lhci/cli` | Handles all audit categories correctly |

**Key insight:** The bundle and animation problems in this codebase are solved by configuration, not new code. The main work is identifying what to configure and migrating CSS.

## Common Pitfalls

### Pitfall 1: autoCodeSplitting and HMR

**What goes wrong:** HMR (hot module replacement) stops working in development after enabling `autoCodeSplitting: true`.
**Why it happens:** The TanStack router plugin transforms route files; known issue on Vite v6 (TanStack/router#3561). Vite 7 (currently installed at 7.2.4) may have resolved this.
**How to avoid:** After enabling, run `npm run dev` and test that editing a route component triggers a hot update. If not, fall back to manual `.lazy.tsx` split files for the largest routes.
**Warning signs:** Dev server restarts instead of hot-updating when editing route files.

### Pitfall 2: manualChunks with TanStack autoCodeSplitting

**What goes wrong:** Conflicting chunk assignments when both `autoCodeSplitting` and `manualChunks` are active.
**Why it happens:** Both systems produce chunks; they need to cooperate, not conflict.
**How to avoid:** Only use `manualChunks` for `node_modules` (vendor code). Leave application code splitting entirely to `autoCodeSplitting`.
**Warning signs:** Build warnings about circular dependencies or duplicate modules in multiple chunks.

### Pitfall 3: map.tsx 974-line Route File

**What goes wrong:** Even with autoCodeSplitting, map.tsx at 974 lines may remain heavy because all MapLibre layer imports are static at the top.
**Why it happens:** Static imports at file top always end up in the critical chunk.
**How to avoid:** `autoCodeSplitting` separates the component code from loader code. MapLibre itself goes to `vendor-maplibre` chunk via manualChunks. The map route component will still load MapLibre on first visit — this is acceptable since `/map` is the primary entry point.
**Warning signs:** `vendor-maplibre` not appearing in the build output.

### Pitfall 4: ReportDetailPage Light-Mode Legacy

**What goes wrong:** `ReportDetailPage.tsx` uses `bg-white`, `text-gray-900`, `border-gray-200` throughout — rendering white card surfaces in the dark Industrial Amber UI.
**Why it happens:** This component was never migrated in Phase 31.
**How to avoid:** Migrate to `bg-grey-900`, `text-grey-100`, `border-grey-800` tokens systematically.
**Warning signs:** White card flashes visible in the dark app shell.

### Pitfall 5: Storybook layout stories needing TanStack Router context

**What goes wrong:** Layout components like `SideRailNav` import from `@tanstack/react-router` (`useMatchRoute`, `Link`). Stories crash without a router context.
**Why it happens:** TanStack Router requires a RouterProvider with a router instance.
**How to avoid:** Wrap story with a `MemoryRouter`-equivalent. TanStack Router provides `RouterProvider` with a pre-built `createMemoryHistory()` router, or mock `useMatchRoute` at the story level. The simplest approach: use decorator with a minimal router.

```tsx
// Decorator for layout stories needing router
import { createRouter, RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'

const testRouter = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ['/map'] }),
})

decorators: [
  (Story) => (
    <RouterProvider router={testRouter}>
      <Story />
    </RouterProvider>
  ),
]
```

### Pitfall 6: oklch Colors in Lighthouse/Performance

**What goes wrong:** oklch() colors are wide-gamut (P3). Older Lighthouse versions or non-P3 displays may flag contrast issues.
**Why it happens:** Contrast calculations differ between sRGB and P3 gamuts.
**How to avoid:** Not a blocker for Lighthouse performance score (only affects accessibility score). Keep tokens as-is.

## Code Examples

Verified patterns from official sources and codebase analysis:

### Final vite.config.ts with All Optimizations

```typescript
// Source: Vite docs + TanStack Router docs + rollup-plugin-visualizer
import { defineConfig } from 'vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { visualizer } from 'rollup-plugin-visualizer';

const dirname = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),  // CHANGE: add autoCodeSplitting
    react(),
    tailwindcss(),
    ...(process.env.ANALYZE ? [visualizer({ open: true, filename: 'dist/stats.html' })] : []),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') && !id.includes('react-hook-form')) return 'vendor-react';
            if (id.includes('maplibre-gl')) return 'vendor-maplibre';
            if (id.includes('@tanstack')) return 'vendor-tanstack';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 9300,
    proxy: { /* unchanged */ },
  },
  resolve: { alias: { '@': '/src' } },
  test: { /* unchanged */ },
});
```

### Storybook BottomTabNav Story (fullscreen + router)

```tsx
// src/stories/layout/BottomTabNav.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createRouter, RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { routeTree } from '@/routeTree.gen';
import BottomTabNav from '@/components/layout/BottomTabNav';

// Minimal router for stories
const makeRouter = (path: string) => createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: [path] }),
});

const meta: Meta<typeof BottomTabNav> = {
  title: 'Layout/BottomTabNav',
  component: BottomTabNav,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof BottomTabNav>;

export const MapActive: Story = {
  decorators: [
    (Story) => (
      <RouterProvider router={makeRouter('/map')}>
        <div className="relative h-screen bg-grey-950">
          <Story />
        </div>
      </RouterProvider>
    ),
  ],
};

export const ResultatenActive: Story = {
  decorators: [
    (Story) => (
      <RouterProvider router={makeRouter('/resultaten')}>
        <div className="relative h-screen bg-grey-950">
          <Story />
        </div>
      </RouterProvider>
    ),
  ],
};
```

### Glassmorphism Mobile Pattern (Tailwind v4)

```tsx
// Source: https://tailwindcss.com/docs/backdrop-filter
// Before (blurs on ALL viewports including mobile):
<div className="bg-grey-900/90 backdrop-blur-md border border-grey-800 shadow-lg rounded-lg p-4">

// After (solid on mobile, glass on desktop — per DS-04):
<div className="bg-grey-900 md:bg-grey-900/90 md:backdrop-blur-md border border-grey-800 shadow-lg rounded-lg p-4">
```

### Legacy CSS Variable Migration Example

```tsx
// Before (undefined variables — renders incorrectly):
<div style={{ backgroundColor: 'var(--color-surface-secondary)' }}>
  <h1 style={{ color: 'var(--color-text)' }}>Propdex</h1>
  <div style={{ backgroundColor: 'var(--color-primary)' }} />
</div>

// After (Industrial Amber tokens):
<div className="bg-grey-950">
  <h1 className="text-grey-100">Propdex</h1>
  <div className="bg-amber-accent" />
</div>
```

### Motion-Reduce Pattern (Tailwind v4)

```tsx
// Source: https://tailwindcss.com/docs/hover-focus-and-other-states
// Add motion-reduce: prefix to disable animations for users who prefer it
<div className="transition-transform duration-300 ease-out motion-reduce:transition-none">
  {/* InspectorPanel slide animation */}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual `React.lazy()` per route | `autoCodeSplitting: true` in TanStack Router plugin | TanStack Router v1.x | No code changes to route files needed |
| CommonJS Storybook | ESM-only Storybook 10 | Storybook 10 (2025) | Already using v10.2.8 |
| Global `backdrop-blur` everywhere | Responsive `md:backdrop-blur-md` | Best practice, no formal version | Mobile perf improvement |
| Single monolithic JS bundle | Vendor + route-level chunks | Ongoing Vite best practice | Lighthouse score improvement |

**Deprecated/outdated:**
- `var(--color-primary)` etc.: Not defined in `@theme`; these are from a pre-Industrial-Amber CSS variable system. Never defined in current `src/styles/index.css`.
- `text-gray-*` / `bg-white` (in non-auth components): These reference Tailwind's default palette, not the custom `grey-*` scale in `@theme`.

## Open Questions

1. **Does autoCodeSplitting work with Vite 7.2.4?**
   - What we know: Known HMR issue was reported for Vite v6 (TanStack/router#3561); Vite 7 is installed
   - What's unclear: Whether the HMR issue was fixed in Vite 7
   - Recommendation: Enable, test HMR in dev, proceed if working; fall back to manual `.lazy.tsx` for `/map` route if not

2. **Should ReportDetailPage.tsx be fully redesigned or just token-swapped?**
   - What we know: File uses light-mode `bg-white/gray-*` classes throughout (605 lines); it renders a PDF-style report layout
   - What's unclear: Whether the light-mode aesthetic is intentional for the report view
   - Recommendation: Migrate to dark `grey-*` tokens to match the rest of the app; if a light PDF-print view is desired, use a separate print media query

3. **Lighthouse CI integration scope**
   - What we know: Success criterion requires Lighthouse >90; `@lhci/cli` or `lighthouse` npm package can measure this
   - What's unclear: Whether to add CI gates or just measure locally
   - Recommendation: Measure locally first (`npx lighthouse http://localhost:9300/map`), verify >90 is achievable, then decide on CI integration. For a polish phase, local measurement is sufficient.

## Sources

### Primary (HIGH confidence)
- Codebase analysis — `vite build` output (1,813KB bundle warning verified), `grep` of all CSS variable and glassmorphism usage
- Tailwind CSS v4 docs — backdrop-filter, motion-reduce variants
- Storybook 10 docs — layout: 'fullscreen', decorators pattern — https://storybook.js.org/docs/configure/story-layout

### Secondary (MEDIUM confidence)
- TanStack Router docs — autoCodeSplitting, code splitting guide — https://tanstack.com/router/v1/docs/framework/react/guide/code-splitting
- Vite docs — performance guide, build.rollupOptions — https://vite.dev/guide/performance
- rollup-plugin-visualizer — GitHub README — https://github.com/btd/rollup-plugin-visualizer (v5.12.0 / 6.0.5 latest)

### Tertiary (LOW confidence)
- manualChunks pattern effectiveness claim (95% main bundle reduction) — https://www.mykolaaleksandrov.dev/posts/2025/10/react-lazy-suspense-vite-manualchunks/ — single source, dramatic claim; actual results depend on codebase

## Metadata

**Confidence breakdown:**
- Bundle splitting approach: HIGH — `vite build` output directly confirms the problem; Vite docs confirm the solution
- glassmorphism mobile disable: HIGH — Tailwind v4 responsive prefix is well-documented; files identified by grep
- Legacy CSS migration: HIGH — `grep` confirms undefined variables in 9 files; token mapping from index.css is exact
- Storybook layout stories: MEDIUM — pattern is sound but TanStack Router context in stories needs validation
- Lighthouse >90 achievability: MEDIUM — likely achievable with bundle splitting but not measured yet

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable tools; Storybook/TanStack Router active but core patterns stable)
