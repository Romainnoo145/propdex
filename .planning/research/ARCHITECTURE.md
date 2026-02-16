# Architecture Patterns: v4.0 UX Redesign

**Domain:** PropTech map application UX redesign
**Researched:** 2026-02-16
**Confidence:** HIGH

## Recommended Architecture

The v4.0 design system integrates with the existing React 19 + TanStack Router + MapLibre codebase through a **shadcn/ui-inspired copy-paste component architecture** layered over the current glassmorphism foundation. This approach provides full component ownership while maintaining existing routing and state management patterns.

```
frontend/src/
├── components/
│   ├── ui/                    # Design system primitives (copy-paste)
│   │   ├── button.tsx         # NEW: Industrial Amber styled button
│   │   ├── card.tsx           # NEW: Industrial Amber styled card
│   │   ├── badge.tsx          # NEW: Industrial Amber styled badge
│   │   ├── input.tsx          # NEW: Form input primitive
│   │   ├── select.tsx         # NEW: Form select primitive
│   │   ├── drawer.tsx         # MODIFIED: Existing → Industrial Amber theme
│   │   ├── modal.tsx          # MODIFIED: Existing → Industrial Amber theme
│   │   └── form-field.tsx     # MODIFIED: Existing → Industrial Amber theme
│   ├── layout/                # Page-level layouts
│   │   ├── app-layout.tsx     # MODIFIED: Root layout (exists)
│   │   ├── side-rail-nav.tsx  # MODIFIED: Navigation rail (exists)
│   │   ├── report-sidebar.tsx # MODIFIED: Left sidebar (exists)
│   │   ├── map-shell.tsx      # NEW: Map page shell wrapper
│   │   ├── results-shell.tsx  # NEW: Results page shell wrapper
│   │   └── inspector-panel.tsx # NEW: Right slide-over inspector
│   ├── map/                   # Map-specific components (existing)
│   ├── property/              # Property-specific components (existing)
│   ├── results/               # Results-specific components (existing)
│   └── ...
├── routes/
│   ├── __root.tsx             # MODIFIED: Inject theme provider
│   ├── _authenticated.tsx     # MODIFIED: Layout with side-rail
│   ├── _authenticated/
│   │   ├── map.tsx            # MODIFIED: Map view (refactor to use shells)
│   │   ├── resultaten.tsx     # NEW: Results view (replaces inline ResultsLayout)
│   │   ├── projecten.tsx      # MODIFIED: Projects view (exists)
│   │   └── instellingen.tsx   # MODIFIED: Settings view (exists)
└── styles/
    └── index.css              # MODIFIED: Add @theme tokens
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ui/** | Design system primitives, owns Industrial Amber tokens, reusable across all views | All feature components |
| **layout/** | Page shells, navigation structure, view-level composition | routes/, ui/, feature components |
| **map/** | MapLibre integration, layer management, imperative map operations | MapView shell, ui/ |
| **property/** | Property detail panels, inspection UI, data display | Inspector panel, ui/ |
| **results/** | Results table, filters, parcel cards | Results shell, ui/ |
| **routes/** | Route definitions, search param validation, page composition | layout/, TanStack Router |

## Patterns to Follow

### Pattern 1: Design Token System with Tailwind v4 @theme

**What:** Define Industrial Amber tokens once in CSS using @theme, generate utilities automatically, expose as CSS variables.

**When:** Use for all color, spacing, typography, and radius values in the design system.

**Example:**
```css
/* frontend/src/styles/index.css */
@import "tailwindcss";

@theme {
  /* Industrial Amber color scale */
  --color-amber-50: #fffbeb;
  --color-amber-100: #fef3c7;
  --color-amber-200: #fde68a;
  --color-amber-300: #fcd34d;
  --color-amber-400: #fbbf24;
  --color-amber-500: #f59e0b; /* Primary brand */
  --color-amber-600: #d97706;
  --color-amber-700: #b45309;
  --color-amber-800: #92400e;
  --color-amber-900: #78350f;

  /* Neutral silver scale (desaturated) */
  --color-silver-50: #f8f9fa;
  --color-silver-100: #e9ecef;
  --color-silver-200: #dee2e6;
  --color-silver-300: #ced4da;
  --color-silver-400: #adb5bd;
  --color-silver-500: #6c757d;
  --color-silver-600: #495057;
  --color-silver-700: #343a40;
  --color-silver-800: #212529;
  --color-silver-900: #0d1117;

  /* Semantic tokens */
  --color-primary: var(--color-amber-500);
  --color-primary-hover: var(--color-amber-600);
  --color-surface: var(--color-silver-50);
  --color-text: var(--color-silver-900);

  /* Spacing scale (8px base) */
  --spacing-1: 0.25rem; /* 4px */
  --spacing-2: 0.5rem;  /* 8px */
  --spacing-3: 0.75rem; /* 12px */
  --spacing-4: 1rem;    /* 16px */
  --spacing-6: 1.5rem;  /* 24px */
  --spacing-8: 2rem;    /* 32px */

  /* Border radius */
  --radius-sm: 0.375rem; /* 6px */
  --radius-md: 0.5rem;   /* 8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
}

/* Z-index scale (existing, keep for compatibility) */
:root {
  --z-map-canvas: 0;
  --z-map-controls: 10;
  --z-search-bar: 100;
  --z-sidebar: 200;
  --z-side-rail: 250;
  --z-property-panel: 300;
  --z-dropdown: 400;
  --z-modal: 1000;
  --z-toast: 2000;
}
```

**Result:** Utilities like `bg-amber-500`, `text-silver-900`, `p-4`, `rounded-md` are auto-generated. Tokens available as `var(--color-amber-500)` for custom CSS.

**Source:** [Tailwind CSS v4 @theme directive](https://tailwindcss.com/docs/theme), [Tailwind CSS 4 design tokens guide](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06)

### Pattern 2: shadcn/ui Copy-Paste Component Pattern

**What:** Own component source code in `components/ui/`, not npm packages. Copy primitives from Radix UI + Tailwind, customize with Industrial Amber tokens.

**When:** For all reusable UI primitives (buttons, cards, badges, inputs, selects).

**Example:**
```tsx
// frontend/src/components/ui/button.tsx
import * as React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  primary: 'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700',
  secondary: 'bg-silver-200 text-silver-900 hover:bg-silver-300',
  ghost: 'text-silver-700 hover:bg-silver-100',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center rounded-md font-medium
          transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500
          disabled:opacity-50 disabled:pointer-events-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className || ''}
        `}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
```

**Result:** Full component ownership, no breaking changes from upstream, customizable per project needs.

**Source:** [shadcn/ui architecture](https://manupa.dev/blog/anatomy-of-shadcn-ui), [shadcn/ui adoption guide](https://blog.logrocket.com/shadcn-ui-adoption-guide/)

### Pattern 3: TanStack Router Layout Routes for View Structure

**What:** Use file-based routing with layout routes to wrap 3 main views (Map, Results, Projects) with shared navigation shell.

**When:** Organizing page-level navigation and shared layout components.

**Example:**
```tsx
// frontend/src/routes/_authenticated.tsx (MODIFIED)
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import SideRailNav from '@/components/layout/SideRailNav'
import ReportSidebar from '@/components/layout/ReportSidebar'
import InspectorPanel from '@/components/layout/InspectorPanel'
import { useNavigationContext } from '@/lib/navigation-context'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: '/auth', search: { redirect: location.href } })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { inspectorState } = useNavigationContext() // NEW: Cross-view state

  return (
    <div className="flex h-screen">
      <SideRailNav
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
      <ReportSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 relative overflow-hidden">
        <Outlet /> {/* Map, Results, Projects pages render here */}
      </main>
      {inspectorState.isOpen && (
        <InspectorPanel
          type={inspectorState.type}
          data={inspectorState.data}
          onClose={() => inspectorState.close()}
        />
      )}
    </div>
  )
}
```

**Result:** Shared navigation shell across all authenticated views, inspector panel available from any page.

**Source:** [TanStack Router layout routes](https://tanstack.com/router/v1/docs/framework/react/routing/routing-concepts), [TanStack Router file-based routing](https://tanstack.com/router/v1/docs/framework/react/routing/file-based-routing)

### Pattern 4: Navigation Context via Search Params + React Context

**What:** Store route-specific state in search params (type-safe, shareable URLs), store ephemeral UI state in React Context (inspector open/closed, active filters).

**When:** Managing cross-view state like "active gemeente", "active scan", "inspector panel state".

**Example:**
```tsx
// frontend/src/lib/navigation-context.tsx (NEW)
import { createContext, useContext, useState } from 'react'

interface InspectorState {
  isOpen: boolean
  type: 'property' | 'parcel' | 'project' | null
  data: unknown | null
}

interface NavigationContextValue {
  inspectorState: InspectorState & {
    open: (type: 'property' | 'parcel' | 'project', data: unknown) => void
    close: () => void
  }
}

const NavigationContext = createContext<NavigationContextValue | null>(null)

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [inspectorState, setInspectorState] = useState<InspectorState>({
    isOpen: false,
    type: null,
    data: null,
  })

  return (
    <NavigationContext.Provider
      value={{
        inspectorState: {
          ...inspectorState,
          open: (type, data) => setInspectorState({ isOpen: true, type, data }),
          close: () => setInspectorState({ isOpen: false, type: null, data: null }),
        },
      }}
    >
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigationContext() {
  const ctx = useContext(NavigationContext)
  if (!ctx) throw new Error('useNavigationContext must be used within NavigationProvider')
  return ctx
}
```

```tsx
// frontend/src/routes/_authenticated/map.tsx (search params example)
export const Route = createFileRoute('/_authenticated/map')({
  component: MapPage,
  validateSearch: (search: Record<string, unknown>): MapSearchParams => ({
    gemeente_code: typeof search.gemeente_code === 'string' ? search.gemeente_code : undefined,
    scan_id: typeof search.scan_id === 'string' ? search.scan_id : undefined,
    // Type-safe, shareable via URL
  }),
})
```

**Result:** Inspector panel state shared across views without prop drilling. Route state shareable via URL.

**Source:** [TanStack Router search params](https://tanstack.com/router/v1/docs/framework/react/guide/search-params), [TanStack Router route context](https://github.com/TanStack/router/discussions/1207)

### Pattern 5: MapLibre Silver Theme via Style Customization

**What:** Desaturate base map colors using MapLibre style layer paint properties, not external style JSON.

**When:** Customizing the existing CartoDB light layer for silver/desaturated aesthetic.

**Example:**
```tsx
// frontend/src/components/map/MapView.tsx (MODIFIED)
const map = new maplibregl.Map({
  container: containerRef.current,
  transformRequest,
  style: {
    version: 8,
    sources: {
      'carto-light': {
        type: 'raster',
        tiles: [CARTO_LIGHT_TILES],
        tileSize: 512,
        attribution: CARTO_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f8f9fa' }, // Silver-50
      },
      {
        id: 'carto-light-layer',
        type: 'raster',
        source: 'carto-light',
        paint: {
          'raster-opacity': 0.6,           // Reduce visibility
          'raster-saturation': -0.5,       // Desaturate colors
          'raster-contrast': -0.1,         // Soften contrast
          'raster-brightness-min': 0.3,    // Lighten dark areas
        },
      },
    ],
  },
  // ...
})
```

**Result:** Silver/desaturated base map without external style dependencies.

**Source:** [MapLibre Style Spec layers](https://maplibre.org/maplibre-style-spec/layers/), [MapLibre GL JS style customization](https://developers.arcgis.com/maplibre-gl-js/maps/vector-tile-basemaps/change-the-basemap-style/)

### Pattern 6: Incremental Migration Strategy

**What:** Migrate existing components to Industrial Amber design system incrementally, prioritizing high-visibility components first.

**When:** Refactoring existing glassmorphism components to new design tokens.

**Example migration order:**
1. **Phase 1: Design tokens** (index.css @theme) — establishes foundation
2. **Phase 2: UI primitives** (Button, Card, Badge) — copy-paste new components
3. **Phase 3: Layout shells** (MapShell, ResultsShell, InspectorPanel) — new wrappers
4. **Phase 4: High-visibility refactor** (PropertyDetailDrawer, ResultsTable) — update existing
5. **Phase 5: Low-visibility refactor** (Modals, forms, minor components) — complete migration

**Coexistence pattern:**
```tsx
// During migration, both systems coexist
import { Button } from '@/components/ui/button' // NEW: Industrial Amber
import { Drawer } from '@/components/ui/Drawer' // OLD: Glassmorphism (not migrated yet)

// Gradually replace old components with new as features are updated
```

**Result:** No "big bang" rewrite, continuous delivery, reduced risk.

**Source:** [Incremental migration approaches](https://circleci.com/blog/incremental-migration-approaches-for-legacy-applications/), [Design system migration tips](https://medium.com/@houhoucoop/pro-tips-for-ui-library-migration-in-large-projects-d54f0fbcd083)

### Pattern 7: Inspector Panel Architecture (Right Slide-Over)

**What:** Unified right-side panel for property details, parcel inspection, project details — shared across all views.

**When:** Displaying detail views without navigating away from current page.

**Example:**
```tsx
// frontend/src/components/layout/InspectorPanel.tsx (NEW)
import { Drawer } from '@/components/ui/drawer'
import { PropertyInspector } from '@/components/property/PropertyInspector'
import { ParcelInspector } from '@/components/results/ParcelInspector'
import { ProjectInspector } from '@/components/projects/ProjectInspector'

interface InspectorPanelProps {
  type: 'property' | 'parcel' | 'project'
  data: unknown
  onClose: () => void
}

export function InspectorPanel({ type, data, onClose }: InspectorPanelProps) {
  return (
    <Drawer isOpen onClose={onClose} width="lg">
      {type === 'property' && <PropertyInspector data={data} />}
      {type === 'parcel' && <ParcelInspector data={data} />}
      {type === 'project' && <ProjectInspector data={data} />}
    </Drawer>
  )
}
```

**Usage from any view:**
```tsx
// In Map view, Results view, or Projects view
const { inspectorState } = useNavigationContext()

function handleParcelClick(parcel: Parcel) {
  inspectorState.open('parcel', parcel) // Opens inspector panel
}
```

**Result:** Consistent inspector experience across all views, single source of truth for panel state.

**Source:** [React sliding panels guide](https://copyprogramming.com/howto/react-sliding-up-panel-for-web), [React sidebar patterns](https://primereact.org/sidebar/)

## Anti-Patterns to Avoid

### Anti-Pattern 1: CSS-in-JS for Design Tokens

**What:** Using styled-components or emotion to define design tokens in JavaScript objects.

**Why bad:** Incompatible with Tailwind v4 @theme directive, loses CSS variable runtime flexibility, increases bundle size.

**Instead:** Define all tokens in index.css using @theme, consume via Tailwind utilities or var() in custom CSS.

### Anti-Pattern 2: Prop Drilling for Cross-View State

**What:** Passing inspector state through multiple component layers via props.

**Why bad:** Couples components tightly, makes refactoring difficult, clutters component APIs.

**Instead:** Use NavigationContext for ephemeral UI state, search params for shareable route state.

### Anti-Pattern 3: Monolithic Map Page with Inline View Logic

**What:** Keeping all map, results, and inspector logic in a single 900-line map.tsx file.

**Why bad:** Hard to test, poor separation of concerns, difficult to add new views.

**Instead:** Extract view-specific logic to separate route files (map.tsx, resultaten.tsx), use layout shells for composition.

### Anti-Pattern 4: Global CSS Overrides for Component Styling

**What:** Overriding component styles with global CSS classes or !important rules.

**Why bad:** Breaks component encapsulation, creates specificity wars, hard to debug.

**Instead:** Use design tokens in @theme, variant props on components, className composition with cn() utility.

### Anti-Pattern 5: Hardcoding MapLibre Style JSON URLs

**What:** Loading external style JSON files for base map styling.

**Why bad:** External dependency, slow load times, limited customization control.

**Instead:** Define style inline in MapView component, use paint properties for desaturation.

## Data Flow

```
User Interaction
    ↓
Route Component (map.tsx, resultaten.tsx, projecten.tsx)
    ↓
Layout Shell (MapShell, ResultsShell) — composition layer
    ↓
Feature Components (PropertyCard, ResultsTable) — domain logic
    ↓
UI Primitives (Button, Card, Badge) — design system
    ↓
Design Tokens (@theme CSS variables) — single source of truth
```

**Cross-cutting concerns:**
- **Navigation Context** → Inspector panel state, ephemeral UI state
- **Search Params** → Route state, shareable URLs (gemeente_code, scan_id)
- **TanStack Query** → Server state, cache management
- **MapLibre Map Ref** → Imperative map operations, shared across map layers

## Integration Points

### 1. Existing TanStack Router → New Layout Structure

**Current:**
```
routes/
├── _authenticated.tsx (layout with side-rail + sidebar)
└── _authenticated/map.tsx (monolithic map page)
```

**After v4.0:**
```
routes/
├── _authenticated.tsx (layout with side-rail + sidebar + inspector)
└── _authenticated/
    ├── map.tsx (map view, uses MapShell)
    ├── resultaten.tsx (results view, uses ResultsShell)
    └── projecten.tsx (projects view, uses ProjectsShell)
```

**Integration:** Add `InspectorPanel` to `_authenticated.tsx` layout, wrap `<Outlet />` with `NavigationProvider`.

### 2. Existing MapLibre Setup → Silver Theme

**Current:**
```tsx
// MapView.tsx uses CARTO_LIGHT_TILES with default opacity
layers: [
  { id: 'carto-light-layer', type: 'raster', source: 'carto-light' }
]
```

**After v4.0:**
```tsx
// Add desaturation paint properties
layers: [
  {
    id: 'carto-light-layer',
    type: 'raster',
    source: 'carto-light',
    paint: {
      'raster-opacity': 0.6,
      'raster-saturation': -0.5,
      'raster-contrast': -0.1,
      'raster-brightness-min': 0.3,
    }
  }
]
```

**Integration:** Modify MapView.tsx style object, no external dependencies.

### 3. Existing Glassmorphism CSS → Industrial Amber Tokens

**Current:**
```css
:root {
  --color-primary: #2563eb; /* Blue */
  --color-surface: #ffffff;
}
```

**After v4.0:**
```css
@theme {
  --color-primary: #f59e0b; /* Amber */
  --color-surface: #f8f9fa; /* Silver */
}
```

**Integration:** Replace `:root` variables with `@theme` tokens, update references in components.

### 4. Existing Drawer Component → Inspector Panel Wrapper

**Current:**
```tsx
// PropertyDetailDrawer.tsx renders Drawer directly
<Drawer isOpen={isOpen} onClose={onClose}>
  <PropertyDetails />
</Drawer>
```

**After v4.0:**
```tsx
// InspectorPanel wraps Drawer, routes content by type
<InspectorPanel type="property" data={propertyData} onClose={onClose} />
```

**Integration:** Refactor PropertyDetailDrawer to PropertyInspector (content only), use InspectorPanel wrapper.

### 5. Existing ResultsLayout → New Results Route

**Current:**
```tsx
// map.tsx includes ResultsLayout inline
<ResultsLayout scanId={scanId} collapsed={!showResults}>
  <MapView />
</ResultsLayout>
```

**After v4.0:**
```tsx
// resultaten.tsx as separate route
export const Route = createFileRoute('/_authenticated/resultaten')({
  validateSearch: (search) => ({ scan_id: search.scan_id }),
  component: ResultsPage,
})
```

**Integration:** Extract ResultsLayout to `routes/_authenticated/resultaten.tsx`, navigate via `/resultaten?scan_id=X`.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Design token updates** | Update index.css @theme, rebuild frontend | Same (CSS variables, no runtime cost) | Same (CSS variables, no runtime cost) |
| **Component library size** | ~15 UI primitives in components/ui/ | ~30 UI primitives (add composites) | ~50 UI primitives (split by domain) |
| **Route complexity** | 3 main views (Map, Results, Projects) | +5 views (Analytics, Reports, Admin) | Lazy-load routes, code-split by view |
| **Inspector panel performance** | Render on open, unmount on close | Same (React 19 concurrent rendering) | Virtualize lists in inspector, memoize heavy components |
| **MapLibre style size** | Inline style object (~100 LOC) | Same (raster layers, no vector tile bloat) | Vector tile layers for parcels, separate style modules |

## New vs Modified Components

### New Components

| Component | Purpose | Dependencies |
|-----------|---------|--------------|
| `components/ui/button.tsx` | Primary button primitive | @theme tokens |
| `components/ui/card.tsx` | Card container primitive | @theme tokens |
| `components/ui/badge.tsx` | Status badge primitive | @theme tokens |
| `components/ui/input.tsx` | Form input primitive | @theme tokens |
| `components/ui/select.tsx` | Form select primitive | @theme tokens |
| `components/layout/map-shell.tsx` | Map view wrapper | MapView, LayerToggle |
| `components/layout/results-shell.tsx` | Results view wrapper | ResultsTable, ResultsFilterPanel |
| `components/layout/inspector-panel.tsx` | Unified inspector wrapper | Drawer, inspector components |
| `lib/navigation-context.tsx` | Cross-view state context | React Context API |
| `routes/_authenticated/resultaten.tsx` | Results page route | ResultsShell, TanStack Router |

### Modified Components

| Component | Change | Reason |
|-----------|--------|--------|
| `components/ui/drawer.tsx` | Update colors to Industrial Amber tokens | Design system consistency |
| `components/ui/modal.tsx` | Update colors to Industrial Amber tokens | Design system consistency |
| `components/ui/form-field.tsx` | Update colors to Industrial Amber tokens | Design system consistency |
| `components/layout/app-layout.tsx` | No change (already minimal wrapper) | — |
| `components/layout/side-rail-nav.tsx` | Update button styles to use ui/button.tsx | Design system consistency |
| `components/layout/report-sidebar.tsx` | Update card styles to use ui/card.tsx | Design system consistency |
| `components/map/MapView.tsx` | Add raster paint properties for silver theme | Base map desaturation |
| `routes/__root.tsx` | Wrap with NavigationProvider | Cross-view state |
| `routes/_authenticated.tsx` | Add InspectorPanel to layout | Unified inspector across views |
| `routes/_authenticated/map.tsx` | Refactor to use MapShell, extract results to separate route | View separation |

## Build Order for Migration

**Phase 1: Foundation (Week 1)**
1. Add @theme tokens to `styles/index.css`
2. Create `lib/navigation-context.tsx`
3. Update `routes/__root.tsx` with NavigationProvider
4. Create `components/ui/button.tsx`
5. Create `components/ui/card.tsx`
6. Create `components/ui/badge.tsx`

**Phase 2: Layout Structure (Week 2)**
1. Create `components/layout/inspector-panel.tsx`
2. Update `routes/_authenticated.tsx` with InspectorPanel
3. Create `components/layout/map-shell.tsx`
4. Create `components/layout/results-shell.tsx`
5. Modify `components/map/MapView.tsx` for silver theme

**Phase 3: View Separation (Week 3)**
1. Create `routes/_authenticated/resultaten.tsx`
2. Refactor `routes/_authenticated/map.tsx` to use MapShell
3. Extract PropertyDetailDrawer → PropertyInspector
4. Update navigation in SideRailNav to route to /resultaten

**Phase 4: Component Refactoring (Week 4)**
1. Update `components/ui/drawer.tsx` with Industrial Amber
2. Update `components/ui/modal.tsx` with Industrial Amber
3. Update `components/layout/side-rail-nav.tsx` to use ui/button
4. Update `components/layout/report-sidebar.tsx` to use ui/card
5. Create `components/ui/input.tsx`
6. Create `components/ui/select.tsx`

**Phase 5: Polish (Week 5)**
1. Update remaining feature components with new primitives
2. Remove old glassmorphism CSS variables
3. Add storybook/documentation for ui/ components
4. Performance audit (bundle size, runtime)

**Dependencies:**
- Phase 2 depends on Phase 1 (needs @theme tokens)
- Phase 3 depends on Phase 2 (needs layout shells)
- Phase 4 can run in parallel with Phase 3
- Phase 5 depends on all previous phases

## Sources

### Design System Architecture
- [React Component Libraries in 2026](https://www.builder.io/blog/react-component-libraries-2026)
- [Implementing Design Systems in React](https://www.mindfulchase.com/deep-dives/design-system-framework/implementing-your-design-system-in-react-best-practices-and-patterns.html)
- [React component library organization](https://blog.webdevsimplified.com/2022-07/react-folder-structure/)
- [Radix UI primitives](https://yakhil25.medium.com/react-component-libraries-in-2026-the-definitive-guide-to-choosing-your-stack-fa7ae0368077)

### Tailwind v4 Design Tokens
- [Tailwind CSS v4.0 theme variables](https://tailwindcss.com/docs/theme)
- [Tailwind CSS v4 @theme directive](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind CSS 4 design tokens guide](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06)
- [Tailwind v4 best practices](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)

### shadcn/ui Pattern
- [The anatomy of shadcn/ui](https://manupa.dev/blog/anatomy-of-shadcn-ui)
- [shadcn/ui adoption guide](https://blog.logrocket.com/shadcn-ui-adoption-guide/)
- [shadcn/ui customization](https://ui.spectrumhq.in/blog/shadcn-customization-guide)

### TanStack Router
- [TanStack Router routing concepts](https://tanstack.com/router/v1/docs/framework/react/routing/routing-concepts)
- [TanStack Router file-based routing](https://tanstack.com/router/v1/docs/framework/react/routing/file-based-routing)
- [TanStack Router search params](https://tanstack.com/router/v1/docs/framework/react/guide/search-params)
- [TanStack Router navigation](https://tanstack.com/router/v1/docs/framework/react/guide/navigation)
- [Passing data between routes](https://helloadel.com/blog/passing-data-between-routes-in-tanstack-router/)

### MapLibre Styling
- [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/)
- [MapLibre layers](https://maplibre.org/maplibre-style-spec/layers/)
- [Change basemap style](https://developers.arcgis.com/maplibre-gl-js/maps/vector-tile-basemaps/change-the-basemap-style/)

### Migration Strategy
- [Incremental migration approaches](https://circleci.com/blog/incremental-migration-approaches-for-legacy-applications/)
- [Design system migration tips](https://medium.com/@houhoucoop/pro-tips-for-ui-library-migration-in-large-projects-d54f0fbcd083)
- [Design system versioning](https://www.supernova.io/blog/8-examples-of-versioning-in-leading-design-systems)

### Inspector Panel Patterns
- [React sliding panels guide](https://copyprogramming.com/howto/react-sliding-up-panel-for-web)
- [React sidebar component](https://primereact.org/sidebar/)
