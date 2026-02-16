# Technology Stack — v4.0 UX Redesign

**Project:** Propdex v4.0 (Industrial Amber Design System)
**Researched:** 2026-02-16
**Focus:** Design system tooling, map styling, animations, and feedback systems for UX polish
**Context:** Subsequent milestone adding design system to existing React 19 + Tailwind v4 + MapLibre application

---

## Overview

This stack analysis focuses ONLY on additions/changes needed for v4.0 UX redesign. The existing validated stack (React 19, Vite 7, TypeScript, TanStack ecosystem, MapLibre GL JS 5.x, Tailwind v4) remains unchanged.

**Key additions:**
1. **Icon library** for sidebar navigation
2. **Animation library** for slide-over panels and transitions
3. **Map style customization** for desaturated silver theme
4. **Toast system** (already installed: Sonner 2.0.7)

**Key insight:** Tailwind v4's native `@theme` directive handles design token system — no additional tooling needed.

---

## NEW Dependencies to Add

### Icons: Lucide React

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| lucide-react | ^0.564.0 | Icon library for navigation sidebar | Lightweight (tree-shakeable SVGs), 1,671+ icons, consistent design, TypeScript native, active maintenance (updated Feb 2026) |

**Installation:**
```bash
pnpm add lucide-react
```

**Why Lucide over alternatives:**
- Tree-shakeable (only bundle icons you use)
- Consistent 24x24 grid design system
- TypeScript-first with excellent DX
- Community-maintained fork of Feather Icons (more icons, active development)
- Already widely adopted in React ecosystem (9,931 dependent packages)
- Zero runtime dependencies

**Usage pattern:**
```tsx
import { Search, Map, Settings } from 'lucide-react';

<Search className="w-5 h-5 text-gray-500" />
```

**Confidence:** HIGH (official npm package, verified current version)

---

### Animation: Motion for React

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| motion | ^12.34.0 | Declarative animations for slide-over panels, page transitions | React 19 compatible, 120fps GPU-accelerated, declarative API, 18M+ monthly downloads, hybrid Web Animations API + JavaScript engine |

**Installation:**
```bash
pnpm add motion
```

**Import pattern (NOT framer-motion):**
```tsx
import { motion, AnimatePresence } from 'motion/react';
```

**Why Motion over alternatives:**
- **React 19 compatibility:** framer-motion has compatibility issues; motion is the successor package
- **Performance:** Hybrid engine (Web Animations API + JavaScript) delivers 120fps
- **Declarative API:** Natural fit for React (state-driven animations)
- **Production-grade:** Used by OpenAI, Vercel, Cursor, X
- **Gestures included:** Tap, drag, hover recognizers built-in
- **Small bundle impact:** Tree-shakeable, only import what you use

**Slide-over panel pattern:**
```tsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Panel content */}
    </motion.div>
  )}
</AnimatePresence>
```

**Alternative considered:**
- **CSS View Transitions API:** Browser-native, excellent performance, but limited browser support (no Firefox, Safari experimental). Best for 2027+ projects. For 2026, Motion provides cross-browser reliability.

**Confidence:** HIGH (official npm package, verified React 19 compatibility via motion.dev docs)

---

## Design System Implementation

### Tailwind v4 @theme Directive (NO NEW DEPENDENCIES)

**Existing:** Tailwind v4.1.18 (already installed)

**What's new in Tailwind v4:** Native design token system via `@theme` directive replaces JavaScript config.

**Industrial Amber token system:**

Edit `/frontend/src/styles/index.css`:

```css
@import "tailwindcss";

@theme {
  /* Color system — Industrial Amber */
  --color-base-white: #FFFFFF;
  --color-base-50: #FAFAFA;
  --color-base-100: #F5F5F5;
  --color-base-200: #E5E5E5;
  --color-base-300: #D4D4D4;
  --color-base-400: #A3A3A3;
  --color-base-500: #737373;
  --color-base-600: #525252;
  --color-base-700: #404040;
  --color-base-800: #262626;
  --color-base-900: #171717;
  --color-base-black: #000000;

  --color-amber: #EBCB4B;
  --color-amber-hover: #D4B743;
  --color-amber-active: #BDA33B;

  /* Semantic tokens */
  --color-primary: var(--color-amber);
  --color-primary-hover: var(--color-amber-hover);
  --color-surface: var(--color-base-white);
  --color-surface-secondary: var(--color-base-50);
  --color-text: var(--color-base-900);
  --color-text-secondary: var(--color-base-600);
  --color-border: var(--color-base-200);

  /* Z-index scale */
  --z-map-canvas: 0;
  --z-map-controls: 10;
  --z-search-bar: 100;
  --z-sidebar: 200;
  --z-side-rail: 250;
  --z-property-panel: 300;
  --z-dropdown: 400;
  --z-modal: 1000;
  --z-toast: 2000;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);

  /* Spacing scale (if custom needed beyond Tailwind defaults) */
  --space-sidebar-width: 64px;
  --space-search-height: 64px;
}
```

**How Tailwind v4 consumes tokens:**
- Automatically generates utilities: `bg-[--color-primary]`, `text-[--color-text-secondary]`
- Available as CSS variables: `var(--color-primary)` in custom CSS
- Runtime themeable (swap values via CSS, no rebuild)
- Single source of truth (design tokens, utilities, and runtime all use same variables)

**Why no additional tooling:**
- Tailwind v4 natively converts `@theme` tokens → utilities + CSS variables
- No need for design token libraries (Style Dictionary, Theo)
- No need for CSS variable generators
- Lightning CSS built-in (5x faster builds)

**Confidence:** HIGH (official Tailwind v4 documentation, released January 2025)

---

## Map Styling

### MapLibre Style JSON (NO NEW DEPENDENCIES)

**Existing:** maplibre-gl 5.17.0 (already installed)

**Requirement:** Desaturated silver map to match Industrial Amber monochrome aesthetic

**Approach:** Custom MapLibre Style JSON

**Options:**

#### Option 1: Use MapTiler Basic/Dataviz Style (RECOMMENDED)

MapTiler provides minimalist basemap styles designed for overlaying data:

- **Basic style:** Minimal distracting colors, simplified for data overlay focus
- **Dataviz style:** Maximum simplicity, no POIs, minimal features

**Implementation:**
```tsx
import maplibregl from 'maplibre-gl';

const map = new maplibregl.Map({
  container: 'map',
  style: 'https://api.maptiler.com/maps/dataviz/style.json?key=YOUR_API_KEY',
  // or 'https://api.maptiler.com/maps/basic/style.json?key=YOUR_API_KEY'
});
```

**Customization:** Modify color scheme via style JSON overrides to desaturate further

**Cost:** MapTiler free tier: 100,000 map loads/month

#### Option 2: OpenMapTiles Basic Style (Open Source)

- GitHub: `openmaptiles/maptiler-basic-gl-style`
- Self-hosted, fully customizable
- Requires tile server setup

#### Option 3: Maputnik Visual Editor (Development Tool)

For creating/editing custom styles:

- Web editor: https://maplibre.org/maputnik/
- Visual style editor for MapLibre Style Spec
- Export to JSON
- TypeScript + React based
- Actively maintained (updated Jan 2026)

**Recommended workflow:**
1. Start with MapTiler Basic/Dataviz
2. Use Maputnik to customize colors (desaturate, adjust to silver/grey palette)
3. Export style JSON
4. Host JSON or inline in application

**Desaturation technique:**
```json
{
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#F5F5F5"
      }
    },
    {
      "id": "water",
      "type": "fill",
      "paint": {
        "fill-color": "#E5E5E5"
      }
    },
    {
      "id": "landuse",
      "type": "fill",
      "paint": {
        "fill-color": "#FAFAFA"
      }
    },
    {
      "id": "roads",
      "type": "line",
      "paint": {
        "line-color": "#D4D4D4",
        "line-width": 1
      }
    }
  ]
}
```

**Confidence:** MEDIUM (MapTiler/OpenMapTiles docs verified, Maputnik confirmed active, desaturation approach standard but needs testing)

---

## Toast Notifications (ALREADY INSTALLED)

### Sonner

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| sonner | 2.0.7 | Toast notification system | ✅ Already installed |

**Why Sonner:**
- Opinionated, minimal API (`<Toaster />` once, call `toast()` anywhere)
- 8M+ downloads/week
- Default toast component in shadcn/ui
- Used by OpenAI, Sonos, Adobe, Vercel
- Lightweight, excellent DX
- No context/hooks needed

**Usage:**
```tsx
import { Toaster, toast } from 'sonner';

// In root component
<Toaster position="top-right" />

// Anywhere in app
toast.success('Property scan complete');
toast.error('Failed to load kadaster data');
toast.loading('Scanning address...');
```

**No action needed:** Already installed in package.json

**Confidence:** HIGH (verified in package.json, official npm version confirmed)

---

## What NOT to Add

| Library | Category | Why Avoid |
|---------|----------|-----------|
| Style Dictionary / Theo | Design tokens | Tailwind v4 `@theme` handles this natively |
| react-spring | Animation | Motion provides better DX and performance |
| framer-motion | Animation | Deprecated in favor of `motion` package (React 19 compatibility issues) |
| React Icons | Icons | Larger bundle, less tree-shakeable than Lucide |
| react-toastify | Toasts | Sonner already installed, better DX |
| HeadlessUI | Component primitives | Not needed for this milestone (no new complex components) |
| Radix UI | Component primitives | Not needed for this milestone (no new complex components) |
| GSAP | Animation | Great library but overkill; Motion's declarative API better for React |
| Anime.js | Animation | Imperative API, not React-idiomatic |

**Key principle:** Leverage Tailwind v4's native capabilities before adding dependencies.

---

## Integration Points

### Tailwind v4 + Motion

Motion respects Tailwind utilities for styling:

```tsx
<motion.div
  className="bg-[--color-surface] shadow-lg rounded-lg"
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
>
  {/* Content */}
</motion.div>
```

### TanStack Router + Motion

Page transitions with AnimatePresence:

```tsx
import { AnimatePresence } from 'motion/react';
import { useLocation } from '@tanstack/react-router';

function AnimatedOutlet() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  );
}
```

### MapLibre + Tailwind Tokens

Reference CSS variables in MapLibre paint properties:

```tsx
map.setPaintProperty('cadastral-parcels', 'fill-color', 'var(--color-amber)');
```

### Lucide + Tailwind

Icons use Tailwind utilities for sizing/colors:

```tsx
import { Map, Search, Settings } from 'lucide-react';

<Map className="w-5 h-5 text-[--color-primary]" />
<Search className="w-6 h-6 text-[--color-text-secondary]" />
```

---

## Installation Commands

```bash
# New dependencies
pnpm add lucide-react motion

# Verify existing (should already be installed)
pnpm list sonner maplibre-gl tailwindcss
```

---

## Migration Notes

### From Glassmorphism to Industrial Amber

1. **Update @theme tokens** in `src/styles/index.css`
2. **Replace color references** throughout components:
   - `#2563eb` → `var(--color-primary)` or `bg-[--color-primary]`
   - Hardcoded greys → base scale variables
3. **Remove glassmorphism CSS** (`backdrop-filter: blur()`, `rgba()` backgrounds)
4. **Update MapLibre style** to silver/desaturated theme

### Add Animation to Existing Panels

Current panels use static CSS. Wrap with Motion:

```tsx
// Before
<div className={cn("fixed right-0 w-96", isOpen && "block")}>

// After
<AnimatePresence>
  {isOpen && (
    <motion.div
      className="fixed right-0 w-96"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
    >
```

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Tailwind v4 CSS | ✅ | ✅ | ✅ | ✅ |
| Motion animations | ✅ | ✅ | ✅ | ✅ |
| MapLibre GL JS | ✅ | ✅ | ✅ | ✅ |
| Lucide SVG icons | ✅ | ✅ | ✅ | ✅ |
| Sonner toasts | ✅ | ✅ | ✅ | ✅ |

**Note:** CSS View Transitions API (future alternative to Motion) not supported in Firefox, experimental in Safari. Motion provides better cross-browser support for 2026.

---

## Performance Considerations

| Technology | Bundle Impact | Performance Notes |
|------------|---------------|-------------------|
| lucide-react | Minimal (tree-shakeable, ~1KB per icon) | Only bundle icons imported |
| motion | ~30KB gzipped | Hybrid engine (Web Animations API + JS), 120fps animations |
| sonner | ~4KB gzipped | Lightweight toast implementation |
| Tailwind v4 | CSS only (no JS runtime) | Lightning CSS compiler (5x faster builds) |

**Total addition:** ~35KB gzipped for animation + icons (acceptable for UX polish milestone)

---

## Development Workflow

### Design Token Workflow

1. **Define tokens** in `@theme` block (`src/styles/index.css`)
2. **Reference in components:**
   - Tailwind utilities: `bg-[--color-primary]`
   - Custom CSS: `background: var(--color-primary);`
3. **No rebuild needed** for color changes (CSS variables update at runtime)

### Map Style Workflow

1. **Start with base style** (MapTiler Basic/Dataviz)
2. **Customize in Maputnik** (https://maplibre.org/maputnik/)
3. **Export JSON** and save to `src/styles/map-style.json`
4. **Import in map component:**
   ```tsx
   import mapStyle from './styles/map-style.json';

   const map = new maplibregl.Map({
     style: mapStyle as StyleSpecification
   });
   ```

### Animation Development

1. **Start simple:** `initial`, `animate`, `exit` states
2. **Test performance:** Monitor FPS in DevTools
3. **Prefer transforms** (`x`, `y`, `scale`, `rotate`) over position properties
4. **Use spring physics** for natural feel: `transition={{ type: 'spring' }}`

---

## Sources

### Design Tokens & Tailwind v4
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind v4 Theme Variables Documentation](https://tailwindcss.com/docs/theme)
- [Tailwind CSS 4 @theme Directive Guide](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06)
- [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns)

### Animation Libraries
- [Motion for React Official Docs](https://motion.dev/docs/react)
- [Motion npm Package](https://www.npmjs.com/package/motion)
- [Motion Installation Guide](https://motion.dev/docs/react-installation)
- [React Animation Libraries 2026](https://www.syncfusion.com/blogs/post/top-react-animation-libraries)
- [Framer Motion Examples](https://egghead.io/blog/how-to-create-a-sliding-sidebar-menu-with-framer-motion)
- [CSS View Transitions API Guide](https://devtoolbox.dedyn.io/blog/css-view-transitions-complete-guide)

### Toast Notifications
- [Sonner Official Docs (shadcn/ui)](https://ui.shadcn.com/docs/components/radix/sonner)
- [Sonner npm Package](https://www.npmjs.com/package/sonner)
- [Top React Toast Libraries 2026](https://knock.app/blog/the-top-notification-libraries-for-react)
- [React Toast Libraries Comparison](https://blog.logrocket.com/react-toast-libraries-compared-2025/)

### Icon Libraries
- [Lucide React Official Docs](https://lucide.dev/guide/packages/lucide-react)
- [Lucide Icons npm Package](https://www.npmjs.com/package/lucide-react)
- [Lucide Icons Library](https://lucide.dev/icons)

### Map Styling
- [MapLibre Style Specification](https://maplibre.org/maplibre-style-spec/)
- [MapTiler Basic Map Style](https://www.maptiler.com/maps/basic/)
- [Maputnik Style Editor](https://maplibre.org/maputnik/)
- [Maputnik GitHub Repository](https://github.com/maplibre/maputnik)
- [OpenMapTiles Basic Style](https://github.com/openmaptiles/maptiler-basic-gl-style)

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Design tokens (Tailwind v4 @theme) | HIGH | Official Tailwind v4 docs, released Jan 2025, widely adopted |
| Motion animation library | HIGH | Official npm package, verified React 19 compatibility, 18M+ downloads/month |
| Lucide icons | HIGH | Official npm package, current version verified (0.564.0), active maintenance |
| Sonner toasts | HIGH | Already installed in package.json, verified version matches npm |
| MapLibre style customization | MEDIUM | Approach is standard, tools verified, but desaturated silver theme needs design validation |

**Overall confidence:** HIGH — All recommendations based on official documentation, current npm versions verified, compatibility confirmed.
