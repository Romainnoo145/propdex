# Phase 91: Aura Design System Foundation - Research

**Researched:** 2026-03-10
**Domain:** CSS design tokens, Tailwind CSS v4, glassmorphism components, font loading, dark mode removal
**Confidence:** HIGH

## Summary

This phase replaces the existing "Industrial Amber" design system (dark-first, oklch grey scale, Inter font, dual-theme) with the "Aura" system (light-only, Morning Mist canvas, Satoshi font, glass layering). The codebase uses **Tailwind CSS v4** with the `@theme` directive in CSS (no `tailwind.config.js`), `class-variance-authority` (CVA) for component variants, and `clsx`/`tailwind-merge` for class composition.

The migration surface is significant: **931+ occurrences** of old grey-scale tokens (`text-grey-*`, `bg-grey-*`, `border-grey-*`) across **60+ files**, plus **147 occurrences** of `amber-accent`/`teal-accent` references. The existing theme infrastructure (ThemeProvider, useTheme, `html.light` class gating, localStorage persistence) must be fully removed. Inter font is loaded via Google Fonts CDN in `index.html`.

**Primary recommendation:** Define all Aura tokens in the `@theme` block of `src/styles/index.css`, replacing the old grey/accent system entirely. Create GlassPanel, BentoPod, and PillBadge as new CVA-based primitives in `src/components/primitives/`. Self-host Satoshi via Fontshare CDN link. Remove ThemeProvider from `main.tsx` and all related code.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Full color swap in Phase 91** -- replace ALL color variables and references with Aura tokens in one pass
- **CSS custom properties as single source of truth** -- define all Aura tokens in `index.css`, Tailwind references them via `theme.extend`
- **New Aura variable names** -- `--aura-canvas`, `--aura-glass`, `--aura-amber`, `--aura-obsidian` etc. Clean break from old system
- **:root level, no class gating** -- Aura is the only theme, no `html.light` or `html.aura` class needed
- **Three-layer semantic color roles**: Warm Amber = Intelligence, Vitality Green = Validation, Deep Obsidian = Command
- **Four-layer tactile glass hierarchy**: Canvas (Layer 0) -> Main Panels (Layer 1, blur+glass) -> Inner Pods (Layer 2, solid translucent) -> Deep Cards (Layer 3)
- **Glass blur budget**: 4 surfaces, max 3 active. SideRailNav, Search/Top Bar, Bottom Sheet, ParcelDetailPanel. Contextual activation via CSS class
- **Unified border-white/40** on all glass surfaces, depth from blur+shadow not border thickness
- **Full dark mode removal** -- delete ThemeProvider, useTheme, all `dark:` variants, settings toggle, localStorage handling
- **Subtle professional micro-interactions** -- `scale-[1.02]` with soft amber glow, 250ms `cubic-bezier(0.4, 0, 0.2, 1)`
- **Full flat fallback for prefers-reduced-motion** -- bg-white solid, no blur, duration-0, border-slate-200

### Claude's Discretion
- Settings Appearance section: keep or remove after dark mode toggle gone
- Hover vocabulary differentiation per element type (consistent vs differentiated)
- Exact Satoshi font loading strategy (self-hosted vs Fontshare CDN)
- PillBadge specific styling details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DS-01 | Aura design tokens defined as CSS variables (Morning Mist, Pure Glass, Deep Obsidian, Warm Amber, Sage Mint, Vitality Green, Ink) | @theme directive in Tailwind v4 index.css -- replace existing oklch grey scale with Aura hex/oklch tokens |
| DS-02 | Satoshi font loaded and applied globally with sizing scale (Display 32px Bold, KPI 24px Semi-bold, Labels 11px All-caps +5% tracking) | Fontshare CDN provides woff2/woff/ttf at weights 300-900. Replace Inter Google Fonts link in index.html |
| DS-03 | Glass component primitives: GlassPanel, BentoPod, PillBadge | CVA pattern already established in Badge.tsx/Button.tsx. New components in primitives/ using same cn() + cva() pattern |
| DS-04 | Micro-interaction system: hover scale-[1.02] with glow, transitions | CSS utility classes in index.css + Tailwind arbitrary values. 250ms cubic-bezier timing |
| DS-05 | Dark mode removed entirely | Remove ThemeProvider (main.tsx), useTheme hook, AppearanceSection theme toggle, html.light CSS block, index.html FOUC script, localStorage handling. Zero `dark:` variants found (already clean) |
| DS-06 | Performance fallback: prefers-reduced-motion, will-change, blur budget | @media (prefers-reduced-motion: reduce) block in index.css. Conditional backdrop-filter activation class |

</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tailwindcss | ^4.1.18 | Utility-first CSS with @theme directive | Already used. v4 CSS-first config via @theme block |
| @tailwindcss/vite | ^4.1.18 | Vite integration for Tailwind v4 | Already configured in vite.config.ts |
| class-variance-authority | ^0.7.1 | Component variant definitions (CVA) | Already used for Button, Badge. Use for GlassPanel/BentoPod/PillBadge |
| clsx | ^2.1.1 | Conditional class joining | Already used throughout |
| tailwind-merge | ^3.4.1 | Merge conflicting Tailwind classes | Already used via cn() utility |

### Supporting (no new dependencies needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | ^0.564.0 | Icons | Already used for all icons. No change needed |

### Font Loading
| Source | Method | Why |
|--------|--------|-----|
| Fontshare CDN | `<link>` in index.html | Free, commercial-use Satoshi font. CDN avoids self-hosting complexity. Use `api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap` |

**No new npm dependencies required.** The entire phase uses existing Tailwind v4 + CVA infrastructure.

## Architecture Patterns

### Recommended Changes to Project Structure
```
src/
├── styles/
│   └── index.css              # Aura @theme tokens (REWRITE)
├── components/
│   └── primitives/
│       ├── Badge.tsx           # UPDATE: Aura colors
│       ├── Button.tsx          # UPDATE: Aura colors + command variant
│       ├── Card.tsx            # UPDATE: Glass-based elevation
│       ├── GlassPanel.tsx      # NEW: Layer 1 glass container
│       ├── BentoPod.tsx        # NEW: Layer 2 inner pod
│       ├── PillBadge.tsx       # NEW: rounded-full pill badge
│       └── index.ts            # UPDATE: export new primitives
├── lib/
│   └── theme/                  # DELETE ENTIRELY
│       ├── ThemeContext.tsx     # DELETE
│       └── useTheme.ts         # DELETE
└── main.tsx                    # UPDATE: remove ThemeProvider wrapper
```

### Pattern 1: Aura Token Architecture in Tailwind v4 @theme

**What:** Define all Aura design tokens as CSS custom properties inside the `@theme` block. This both sets CSS variables AND generates Tailwind utility classes automatically.

**How it works in Tailwind v4:** The `@theme` directive replaces `tailwind.config.js`. Variables prefixed with `--color-` generate `bg-*`, `text-*`, `border-*` utilities. Variables prefixed with `--font-` generate `font-*` utilities.

**Example:**
```css
/* src/styles/index.css */
@import "tailwindcss";

@theme {
  /* Aura palette */
  --color-aura-canvas: #F2F6F3;          /* Morning Mist -- Layer 0 base */
  --color-aura-glass: rgba(255,255,255,0.60);  /* Pure Glass -- Layer 1 bg */
  --color-aura-pod: rgba(255,255,255,0.40);    /* Pod -- Layer 2 bg */
  --color-aura-deep: rgba(255,255,255,0.25);   /* Deep -- Layer 3 bg */
  --color-aura-obsidian: #0E1111;        /* Deep Obsidian -- command CTA, headers */
  --color-aura-ink: #1A1C1E;             /* Ink -- body text */
  --color-aura-amber: #F9A826;           /* Warm Amber -- intelligence/scores */
  --color-aura-amber-hover: #E8971F;     /* Amber hover state */
  --color-aura-mint: #D1E2D8;            /* Sage Mint -- secondary surfaces */
  --color-aura-green: #22C55E;           /* Vitality Green -- validation */
  --color-aura-green-hover: #16A34A;     /* Green hover */

  /* Semantic status colors */
  --color-success: #22C55E;
  --color-error: #EF4444;
  --color-warning: #F9A826;
  --color-info: #3B82F6;

  /* Neutral scale (light mode only) */
  --color-neutral-50: #F9FAFB;
  --color-neutral-100: #F3F4F6;
  --color-neutral-200: #E5E7EB;
  --color-neutral-300: #D1D5DB;
  --color-neutral-400: #9CA3AF;
  --color-neutral-500: #6B7280;
  --color-neutral-600: #4B5563;
  --color-neutral-700: #374151;
  --color-neutral-800: #1F2937;
  --color-neutral-900: #111827;

  /* Typography */
  --font-sans: "Satoshi", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Courier New", monospace;

  /* Font sizes -- Aura scale */
  --text-xs: 0.6875rem;     /* 11px -- labels */
  --text-sm: 0.8125rem;     /* 13px */
  --text-base: 0.875rem;    /* 14px -- body */
  --text-lg: 1rem;          /* 16px */
  --text-xl: 1.125rem;      /* 18px */
  --text-2xl: 1.5rem;       /* 24px -- KPI */
  --text-3xl: 2rem;         /* 32px -- Display */

  /* Radius -- Aura rounded */
  --radius-sm: 0.5rem;      /* 8px */
  --radius-md: 0.75rem;     /* 12px */
  --radius-lg: 1rem;        /* 16px */
  --radius-xl: 1.5rem;      /* 24px -- bento pods */
  --radius-2xl: 2rem;       /* 32px */
  --radius-3xl: 3rem;       /* 48px -- bottom sheet top */

  /* Shadows -- Aura glass shadows */
  --shadow-sm: 0 1px 3px 0 rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px -2px rgba(0,0,0,0.08);
  --shadow-lg: 0 10px 30px -4px rgba(0,0,0,0.10);
  --shadow-glass: 0 20px 50px rgba(0,0,0,0.10);
}
```

**What this generates:** Utility classes like `bg-aura-canvas`, `text-aura-obsidian`, `border-aura-amber`, `shadow-glass`, `rounded-xl`, `text-3xl`, etc.

### Pattern 2: CVA Glass Primitives

**What:** GlassPanel, BentoPod, PillBadge as CVA components following existing Badge/Button patterns.

**Example -- GlassPanel:**
```typescript
// src/components/primitives/GlassPanel.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glassPanelVariants = cva(
  'border border-white/40 transition-all duration-250',
  {
    variants: {
      blur: {
        active: 'bg-white/60 backdrop-blur-xl shadow-glass',
        inactive: 'bg-white/60 shadow-glass',  // no blur until activated
      },
      rounded: {
        default: 'rounded-2xl',
        pill: 'rounded-full',
        sheet: 'rounded-t-[48px]',
      },
    },
    defaultVariants: {
      blur: 'inactive',
      rounded: 'default',
    },
  }
);

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassPanelVariants> {}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, blur, rounded, ...props }, ref) => (
    <div ref={ref} className={cn(glassPanelVariants({ blur, rounded }), className)} {...props} />
  )
);
GlassPanel.displayName = 'GlassPanel';

export { GlassPanel, glassPanelVariants };
```

**Example -- BentoPod:**
```typescript
// src/components/primitives/BentoPod.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const bentoPodVariants = cva(
  'bg-white/40 border border-white/40 rounded-2xl p-4 shadow-sm',
  {
    variants: {
      interactive: {
        true: 'cursor-pointer transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(249,168,38,0.15)]',
        false: '',
      },
    },
    defaultVariants: {
      interactive: false,
    },
  }
);
```

**Example -- PillBadge:**
```typescript
// src/components/primitives/PillBadge.tsx
const pillBadgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-white/25 text-aura-ink border border-white/40',
        amber: 'bg-aura-amber/15 text-aura-amber',
        green: 'bg-aura-green/15 text-aura-green',
        obsidian: 'bg-aura-obsidian text-white',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);
```

### Pattern 3: prefers-reduced-motion Fallback

**What:** Complete flat fallback for accessibility/performance.

```css
/* In index.css, after @theme block */
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }

  .glass-blur-active {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background: white !important;
    border-color: #E2E8F0 !important; /* slate-200 equivalent */
  }
}
```

### Pattern 4: Micro-Interaction Utility Classes

**What:** Reusable hover/transition utilities defined once in CSS.

```css
/* Aura interaction utilities */
.aura-hover-pod {
  transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1);
}
.aura-hover-pod:hover {
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(249, 168, 38, 0.15);
}

/* Floating panels */
.aura-float {
  will-change: transform;
}
```

### Anti-Patterns to Avoid
- **DO NOT use oklch for Aura tokens.** The old system used oklch. Aura uses hex (#F2F6F3) and rgba for glass opacity. Keep it simple and predictable.
- **DO NOT add backdrop-blur to inner pods.** Only Layer 1 surfaces get blur. Layer 2 (BentoPod) uses solid `bg-white/40` without blur.
- **DO NOT create a new config file.** Tailwind v4 uses the CSS `@theme` block. No `tailwind.config.js` or `tailwind.config.ts` needed.
- **DO NOT keep any `html.light` selectors.** Aura tokens go on `:root` directly. Remove the light mode override block entirely.
- **DO NOT use `dark:` Tailwind variants.** Zero `dark:` variants currently exist in the codebase (confirmed via grep), so this is already clean.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component variants | Manual className conditionals | CVA (`class-variance-authority`) | Already in use. Type-safe variants, consistent API across all primitives |
| Class merging | String concatenation | `cn()` via `clsx` + `tailwind-merge` | Already in use. Handles Tailwind class conflicts correctly |
| Font hosting | Download + self-host woff2 files | Fontshare CDN link | Free, reliable, proper caching headers, no build step needed |
| Blur budget management | JavaScript IntersectionObserver | CSS class toggle (`blur` variant in GlassPanel) | Simpler. Panels already mount/unmount via React state. CVA `blur` variant activates/deactivates |

## Common Pitfalls

### Pitfall 1: Tailwind v4 @theme Namespace Collision
**What goes wrong:** Defining `--color-canvas` collides with Tailwind's internal naming or generates unexpected utilities.
**Why it happens:** Tailwind v4 auto-generates utilities from all `--color-*` variables.
**How to avoid:** Use the `--color-aura-*` prefix for all custom Aura tokens. This generates `bg-aura-canvas`, `text-aura-obsidian` etc. -- clean namespace, no collisions.
**Warning signs:** Build errors or unexpected CSS output.

### Pitfall 2: rgba() Values in @theme Block
**What goes wrong:** `bg-white/60` notation won't work with rgba values defined in `@theme`.
**Why it happens:** Tailwind's opacity modifier syntax (`/60`) requires the color to be defined in a format that supports alpha decomposition (hex, rgb, oklch without alpha). A pre-set rgba value with alpha already baked in can't be further modified with `/60`.
**How to avoid:** For glass/pod backgrounds, define the color WITHOUT alpha in @theme (`--color-glass-white: #ffffff`), then use Tailwind opacity modifiers in markup: `bg-glass-white/60`. OR define the full rgba value and use it directly without Tailwind opacity modifiers (use custom utility classes instead).
**Recommendation:** Define `--color-glass-white: #ffffff` in @theme, then use `bg-glass-white/60`, `bg-glass-white/40`, `bg-glass-white/25` in components. This lets Tailwind handle opacity naturally.

### Pitfall 3: Forgetting to Remove FOUC Script
**What goes wrong:** The `index.html` contains an inline script that adds `html.light` class from localStorage. If left in place, it does nothing (harmless) but is dead code.
**Why it happens:** Easy to forget about the FOUC prevention script in index.html.
**How to avoid:** Include index.html cleanup in the dark mode removal task.

### Pitfall 4: Toaster Styling Hardcoded for Dark
**What goes wrong:** The `<Toaster>` in `main.tsx` has `theme="dark"` and hardcoded dark background styles.
**Why it happens:** Was designed for the dark-first Industrial Amber theme.
**How to avoid:** Update Toaster theme and styles to match Aura's light aesthetic.

### Pitfall 5: Massive Find-and-Replace Token Migration
**What goes wrong:** Inconsistent migration leaves some components with old `grey-*` tokens.
**Why it happens:** 931+ references across 60+ files. Manual replacement is error-prone.
**How to avoid:** Use systematic find-and-replace with a mapping table. Run `npm run check` after each batch. The old token names (`grey-950`, `grey-900`, etc.) should generate build errors once removed from @theme, catching any stragglers.
**Migration mapping:**
| Old Token | Aura Replacement | Notes |
|-----------|-----------------|-------|
| `grey-950` (bg) | `aura-canvas` | Was deepest bg in dark, now Morning Mist |
| `grey-900` (bg) | `white/60` or `aura-canvas` | Card backgrounds -> glass or canvas |
| `grey-850` (bg) | `white/40` | Elevated cards -> pod level |
| `grey-800` (border) | `white/40` or `neutral-200` | Glass borders or solid neutral |
| `grey-700` | `neutral-400` | Muted elements |
| `grey-600` | `neutral-500` | Secondary text |
| `grey-400` | `neutral-600` | Tertiary text |
| `grey-300` | `neutral-700` | Semi-strong text |
| `grey-100` (text) | `aura-ink` or `aura-obsidian` | Primary text |
| `amber-accent` | `aura-amber` | Intelligence/score color |
| `teal-accent` | `aura-green` or removed | Validation actions |
| `on-accent` | `white` or `aura-obsidian` | Text on accent backgrounds |

### Pitfall 6: Print Styles Reference Old Tokens
**What goes wrong:** The `@media print` block in index.css sets old `--color-grey-*` variables.
**Why it happens:** Print styles were designed for the old token system.
**How to avoid:** Update print styles to use Aura tokens. Most print overrides become simpler since Aura is already light-based.

## Code Examples

### Font Loading in index.html
```html
<!-- Replace Google Fonts Inter with Fontshare Satoshi -->
<link rel="preconnect" href="https://api.fontshare.com" crossorigin />
<link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap" rel="stylesheet" />
```

### Typography Utility Classes
```css
/* In index.css, after @theme */

/* Aura typography scale */
.text-display {
  font-size: 2rem;       /* 32px */
  font-weight: 700;      /* Bold */
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.text-kpi {
  font-size: 1.5rem;     /* 24px */
  font-weight: 600;      /* Semi-bold */
  line-height: 1.3;
}

.text-label {
  font-size: 0.6875rem;  /* 11px */
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em; /* +5% tracking */
}
```

### Dark Mode Removal Checklist
```
Files to modify:
1. src/main.tsx -- remove ThemeProvider import and wrapper
2. src/lib/theme/ThemeContext.tsx -- DELETE
3. src/lib/theme/useTheme.ts -- DELETE
4. src/components/settings/AppearanceSection.tsx -- remove theme toggle section
5. src/styles/index.css -- remove html.light {} block
6. index.html -- remove FOUC prevention script
7. main.tsx Toaster -- update theme="dark" and hardcoded dark styles
```

### Updated Button Variants (Command CTA)
```typescript
// Add 'command' variant to Button.tsx for Obsidian CTA
variant: {
  primary: 'bg-aura-amber text-aura-obsidian hover:bg-aura-amber-hover ...',
  command: 'bg-aura-obsidian text-white hover:bg-aura-obsidian/90 ...',
  secondary: 'bg-aura-green text-white hover:bg-aura-green-hover ...',
  ghost: 'text-aura-ink hover:bg-white/40 ...',
  outline: 'border border-neutral-200 bg-transparent text-aura-ink hover:bg-neutral-50 ...',
  destructive: 'bg-error text-white hover:bg-error/90 ...',
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` | CSS `@theme` directive | Tailwind v4 (Jan 2025) | All config in CSS, no JS config file |
| `darkMode: 'class'` config | Not applicable | Tailwind v4 | Dark mode via CSS, but Aura drops it entirely |
| oklch color values | hex + rgba for Aura | This phase | Simpler, more predictable. oklch was over-engineered for this use case |
| Dual-theme (dark+light) | Single light theme | This phase | Halves CSS surface, removes ThemeProvider React context |
| Inter font (Google Fonts) | Satoshi font (Fontshare) | This phase | Distinctive brand identity, modernist aesthetic |

## Open Questions

1. **Satoshi CDN vs Self-Host**
   - What we know: Fontshare CDN works at `api.fontshare.com/v2/css?f[]=satoshi@...`. CDNFonts also hosts it. Self-hosting means downloading woff2 files into `public/fonts/`.
   - Recommendation: **Use Fontshare CDN.** It is the official source, provides `font-display: swap`, serves woff2. Self-hosting adds build complexity with no meaningful benefit for a SaaS product. If Fontshare CDN has reliability concerns, CDNFonts is a fallback.

2. **Settings Appearance Section after Dark Mode Removal**
   - What we know: The section currently has theme toggle (dark/light) and map style selector (satellite/light).
   - Recommendation: **Keep the section, remove only the theme toggle.** The map style selector is still useful and has nothing to do with dark mode. Rename the section if desired.

3. **Storybook Stories Reference Old Tokens**
   - What we know: Story files in `src/stories/` reference old grey-scale tokens (e.g., ResultsShell.stories.tsx has 20 grey references).
   - Recommendation: Update stories as part of the token migration. They will break on build if old tokens are removed from @theme.

## Sources

### Primary (HIGH confidence)
- Project codebase analysis: `src/styles/index.css`, `src/lib/theme/`, `src/components/primitives/`, `package.json`, `vite.config.ts`
- Tailwind CSS v4 @theme docs: https://tailwindcss.com/docs/theme
- Fontshare CDN verified: `api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap` returns valid @font-face CSS with woff2/woff/ttf

### Secondary (MEDIUM confidence)
- CDNFonts Satoshi page: https://www.cdnfonts.com/satoshi.font -- confirmed weights 300/400/500/700/900
- Tailwind v4 theming patterns: https://github.com/tailwindlabs/tailwindcss/discussions/18471

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all tools already in project
- Architecture: HIGH -- CVA pattern established, @theme directive well-documented
- Pitfalls: HIGH -- verified via codebase grep, confirmed token counts and file impacts
- Font loading: MEDIUM -- Fontshare CDN reliability not independently verified, but is official source

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, no fast-moving dependencies)
