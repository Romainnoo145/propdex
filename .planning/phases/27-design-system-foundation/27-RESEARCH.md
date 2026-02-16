# Phase 27: Design System Foundation - Research

**Researched:** 2026-02-16
**Domain:** Design systems, Tailwind v4 @theme tokens, React component primitives, dark-first UI
**Confidence:** HIGH

## Summary

This phase establishes the Industrial Amber design system foundation using Tailwind v4's CSS-first @theme configuration, delivering dark-mode-first design tokens that generate both utility classes and CSS variables. The research confirms Tailwind v4 (already installed: 4.1.18) offers dramatic improvements over v3: CSS-based configuration via @theme blocks, automatic CSS variable generation, 3.78x faster builds, and native support for dynamic utility values without arbitrary syntax.

The dark-first technical aesthetic (Bloomberg Terminal/Grafana style) requires careful attention to: **oklch color space** for vibrant P3-gamut amber (#EBCB4B) and teal (#0D9488) accents on dark surfaces, **layered grey system** (#111 base → #1A1A1A cards → #222 elevated) for depth without glassmorphism, and **Inter + JetBrains Mono** typography pairing (proven combination used by GitLab for data-dense professional interfaces). Component primitives will use **class-variance-authority (CVA)** for type-safe variant management, **lucide-react** for consistent iconography, and be documented in **Storybook** with the official Tailwind CSS recipe.

The phase creates the **foundation only** — actual component migration happens in Phase 31, so focus is on establishing tokens, primitives (button, card, badge, input, select), and the pattern others will follow.

**Primary recommendation:** Define dark-first tokens in @theme using oklch colors, build 5 core primitives with CVA variants, enforce token usage via eslint-plugin-tailwindcss, and document in Storybook. Avoid @apply (deprecated in v4), use explicit CSS variables (var(--color-*)) for component-level styling.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Color Palette:**
- Primary amber: **#EBCB4B** (bright gold/mustard) — the signature accent color
- Secondary accent: **Teal #0D9488** — for interactive elements, links, selected states
- Dark mode default — dark grey/charcoal backgrounds, light text
- Amber = primary actions and highlights, teal = secondary interactive elements
- Semantic colors (success/error/info): Claude's discretion, must work on dark backgrounds

**Component Aesthetic:**
- **Dark & technical** overall vibe — think Bloomberg Terminal, Grafana
- Dark mode default: charcoal backgrounds, light text, amber and teal glow against dark surfaces
- Corner radius: **subtle (4-6px)** — technical but not harsh
- Surface layering: **layered greys** (base #111 → card #1A1A1A → elevated #222), NOT glassmorphism
- Depth through subtle grey stepping, clean layering system

**Typography:**
- Primary font: **Inter** — clean geometric sans for all UI text
- Data font: **monospace** (JetBrains Mono or similar) for numbers, coordinates, parcel IDs, table data
- Density: **compact/dense** — 13-14px body, tight line-height. See more data at once.
- Monospace data values align in tables and reinforce the technical aesthetic

**Primitive Variants:**
- Primary button: **solid amber fill** (#EBCB4B background, dark text) — amber IS the action color
- Card/panel surfaces: layered greys system (see Component Aesthetic)
- Primary action = amber, secondary interactive = teal

### Claude's Discretion

- Grey scale temperature (warm vs cool greys) — pick what works best with #EBCB4B on dark backgrounds
- Border treatment on dark surfaces (visible borders vs elevation/shadows)
- Semantic color palette (success green, error red, info blue — chosen for dark mode contrast)
- Font weight scale (likely regular body + semibold headers for dark readability)
- Input field styling (recessed/inset vs bordered — fit the layered grey system)
- Badge/tag treatment (filled muted vs outline — optimize for data-dense dark interface)
- Exact monospace font choice for data values

### Deferred Ideas (OUT OF SCOPE)

- Light mode toggle — could be added in Phase 35 (Settings Page) as appearance setting
- Map theme adaptation for dark mode — Phase 29 scope (Silver Map Theme)
- Glassmorphism refinement — Phase 29 scope (may become dark glass or be replaced entirely)

</user_constraints>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **tailwindcss** | **4.1.18** ✅ | CSS framework with @theme design tokens | Industry standard for utility-first CSS; v4 offers 3.78x faster builds, CSS-first config, automatic CSS variable generation |
| **@tailwindcss/vite** | **4.1.18** ✅ | First-party Vite plugin | Faster than PostCSS approach, official integration for Vite projects |
| **lucide-react** | latest | Icon library (1,500+ icons) | Tree-shakable, consistent visual language, actively maintained, replaces inline SVG icons |
| **class-variance-authority** | latest | Type-safe component variant management | Industry pattern for managing Tailwind variants, used by shadcn/ui, excellent TypeScript support |
| **tailwind-merge** | latest | Intelligent Tailwind class merging | Prevents class conflicts when composing CVA variants with consumer overrides |

✅ = Already installed in project

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@storybook/react** | 9.x | Component documentation | Document primitives in isolation, enable design system governance |
| **storybook-addon-tailwind-autodocs** | latest | Auto-document Tailwind theme | Generates "Tailwind Theme" docs page from @theme tokens |
| **eslint-plugin-tailwindcss** | latest | Enforce design token usage | Prevent hardcoded colors via `no-arbitrary-value` rule |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CVA | Vanilla Tailwind conditionals | CVA provides type safety, better DX, compound variants; conditionals become unmanageable for 3+ variants |
| lucide-react | react-icons, heroicons | Lucide has better tree-shaking, more consistent design language, actively maintained |
| Tailwind v4 | Tailwind v3 | v3 requires JS config, slower builds, no automatic CSS variables; v4 is 3.78x faster with CSS-first approach |
| oklch colors | hex/rgb | oklch offers P3 gamut (25% more colors), perceptual uniformity for dark mode consistency |

**Installation:**

```bash
# Core (already have tailwindcss + @tailwindcss/vite)
npm install lucide-react class-variance-authority tailwind-merge

# Supporting
npm install -D @storybook/react storybook-addon-tailwind-autodocs eslint-plugin-tailwindcss
```

---

## Architecture Patterns

### Recommended Project Structure

```
frontend/src/
├── styles/
│   └── index.css                # @import "tailwindcss" + @theme block
├── components/
│   ├── primitives/              # NEW: Design system primitives
│   │   ├── Button.tsx           # Amber primary, teal secondary, ghost, outline variants
│   │   ├── Card.tsx             # Layered grey surfaces with subtle borders
│   │   ├── Badge.tsx            # Status indicators (filled muted pattern)
│   │   ├── Input.tsx            # Recessed dark field with focus ring
│   │   └── Select.tsx           # Dropdown with layered grey menu
│   ├── ui/                      # Existing: Composite UI components
│   ├── auth/                    # Existing: Feature components
│   ├── map/                     # Existing: Feature components
│   └── ...
├── lib/
│   └── utils.ts                 # cn() helper (CVA + tailwind-merge)
└── stories/                     # NEW: Storybook stories
    └── primitives/              # Document each primitive with variants
        ├── Button.stories.tsx
        ├── Card.stories.tsx
        └── ...
```

### Pattern 1: CSS-First @theme Token Definition

**What:** Define all design tokens in CSS using @theme directive instead of tailwind.config.js

**When to use:** Always in Tailwind v4 — CSS-first is the new standard

**Example:**

```css
/* src/styles/index.css */
@import "tailwindcss";

@theme {
  /* Color system — oklch for P3 gamut vibrancy */
  --color-amber-accent: oklch(0.78 0.15 85.87);     /* #EBCB4B */
  --color-teal-accent: oklch(0.59 0.12 192.47);     /* #0D9488 */

  /* Dark-first grey scale (cool greys for technical feel) */
  --color-grey-950: oklch(0.13 0.005 270);          /* #111111 base */
  --color-grey-900: oklch(0.18 0.005 270);          /* #1A1A1A cards */
  --color-grey-850: oklch(0.23 0.005 270);          /* #222222 elevated */
  --color-grey-800: oklch(0.28 0.005 270);          /* borders */
  --color-grey-100: oklch(0.95 0.005 270);          /* text primary */
  --color-grey-400: oklch(0.65 0.005 270);          /* text secondary */

  /* Semantic (high contrast for dark backgrounds) */
  --color-success: oklch(0.65 0.18 145);            /* Green */
  --color-error: oklch(0.60 0.22 25);               /* Red */
  --color-info: oklch(0.62 0.18 250);               /* Blue */

  /* Typography */
  --font-sans: Inter, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Courier New", monospace;

  /* Font sizes (compact/dense) */
  --text-xs: 0.6875rem;      /* 11px */
  --text-sm: 0.8125rem;      /* 13px — body default */
  --text-base: 0.875rem;     /* 14px — slightly larger body */
  --text-lg: 1rem;           /* 16px — headings */
  --text-xl: 1.125rem;       /* 18px — larger headings */

  /* Font weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  /* Spacing (Tailwind default is 0.25rem = 4px, keep for consistency) */
  --spacing: 0.25rem;

  /* Radius (subtle, technical) */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* Shadows (subtle elevation on dark) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
}

/* Global base styles */
:root {
  /* Body defaults */
  --color-body-bg: var(--color-grey-950);
  --color-body-text: var(--color-grey-100);
}

body {
  background-color: var(--color-body-bg);
  color: var(--color-body-text);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  line-height: 1.4; /* Compact */
}
```

**Why it works:** Tokens become both utilities (bg-amber-accent, text-grey-100) AND CSS variables (var(--color-amber-accent)), creating single source of truth. oklch ensures amber/teal glow vibrantly on P3 displays.

**Source:** [Tailwind CSS v4.0 - @theme](https://tailwindcss.com/docs/theme)

---

### Pattern 2: CVA Component Primitives with Variants

**What:** Use class-variance-authority to define type-safe component variants matching design system decisions

**When to use:** For all primitive components (button, card, badge, input, select) — enables compound variants and type safety

**Example:**

```tsx
// src/components/primitives/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // Base styles (all buttons share)
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary: solid amber fill, dark text (amber IS the action color)
        primary: 'bg-amber-accent text-grey-950 hover:bg-amber-accent/90 focus-visible:ring-amber-accent',

        // Secondary: teal accent for secondary actions
        secondary: 'bg-teal-accent text-white hover:bg-teal-accent/90 focus-visible:ring-teal-accent',

        // Ghost: minimal, hover highlight
        ghost: 'hover:bg-grey-900 hover:text-grey-100 focus-visible:ring-grey-800',

        // Outline: bordered
        outline: 'border border-grey-800 bg-transparent hover:bg-grey-900 focus-visible:ring-grey-800',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

**Why it works:** CVA provides autocomplete for variants, prevents invalid combinations, supports compound variants (e.g., "small + primary" could have unique styles). cn() helper (CVA + tailwind-merge) prevents class conflicts when consumers override.

**Source:** [Class Variance Authority - React with Tailwind](https://cva.style/docs/examples/react/tailwind-css)

---

### Pattern 3: cn() Utility Helper

**What:** Combine CVA with tailwind-merge to handle class conflicts intelligently

**When to use:** Every component that accepts className prop — prevents "bg-red-500 bg-blue-500" conflicts

**Example:**

```tsx
// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Usage:**

```tsx
// Consumer can override variant classes safely
<Button variant="primary" className="bg-teal-accent">
  Override to teal
</Button>
// Result: bg-teal-accent wins (tailwind-merge removes bg-amber-accent)
```

**Why it works:** clsx handles conditionals, twMerge resolves Tailwind conflicts by keeping last class.

**Source:** [shadcn/ui cn() pattern](https://github.com/shadcn-ui/ui/blob/main/apps/www/lib/utils.ts)

---

### Pattern 4: Lucide-React Icon Integration

**What:** Import icons individually from lucide-react for optimal tree-shaking

**When to use:** All icon needs — replaces inline SVG, ensures consistency

**Example:**

```tsx
import { Trash2, Check, X, ChevronDown } from 'lucide-react';

export function IconButton() {
  return (
    <button className="p-2 hover:bg-grey-900 rounded-md">
      <Trash2 size={16} className="text-grey-400" />
    </button>
  );
}
```

**Customization:**

```tsx
<Check
  size={20}                    // Default: 24
  strokeWidth={2.5}            // Default: 2
  className="text-success"     // Uses Tailwind classes
  aria-label="Task completed"  // Accessibility
/>
```

**Why it works:** Each icon is a React component, fully tree-shakable, accepts all SVG props, consistent stroke width across all icons.

**Source:** [Lucide React - Official Guide](https://lucide.dev/guide/packages/lucide-react)

---

### Pattern 5: Storybook Documentation with Tailwind Autodocs

**What:** Document primitives in Storybook with auto-generated Tailwind theme reference

**When to use:** All primitives need stories showing variants, states, and usage examples

**Example:**

```tsx
// src/stories/primitives/Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/primitives/Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'outline'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="outline">Outline</Button>
    </div>
  ),
};
```

**Storybook config for Tailwind:**

```ts
// .storybook/preview.tsx
import '../src/styles/index.css'; // Import Tailwind with @theme

export default {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#111111' }, // --color-grey-950
      ],
    },
  },
};
```

**Why it works:** Stories show all variants in isolation, autodocs generates props table, consumers can test components before integration.

**Source:** [Storybook - Tailwind CSS Recipe](https://storybook.js.org/recipes/tailwindcss)

---

### Anti-Patterns to Avoid

- **Using @apply in v4:** Deprecated, use explicit CSS variables instead (var(--color-*))
- **Runtime string concatenation:** `className={`bg-${color}-500`}` breaks tree-shaking; use CVA variants
- **Importing all icons:** `import * as Icons from 'lucide-react'` defeats tree-shaking; import individually
- **Hardcoded hex colors:** Use tokens (bg-amber-accent) or variables (var(--color-amber-accent)), never #EBCB4B in components
- **Mixing sRGB and oklch:** Pick oklch for all accent/semantic colors to ensure P3 consistency
- **Class string bloat:** If className has >12 classes, extract to primitive component with CVA variants

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component variant management | Conditional className strings | **class-variance-authority** | CVA handles compound variants, provides TypeScript safety, prevents className bloat; hand-rolled conditionals become unmaintainable at 3+ variants |
| Tailwind class conflicts | Custom merge logic | **tailwind-merge** | Handles precedence (bg-red-500 vs bg-blue-500), understands Tailwind's spacing scale, actively maintained |
| Icon library | Inline SVG files | **lucide-react** | 1,500+ icons, tree-shakable, consistent design language, accessibility built-in; managing SVG files is maintenance burden |
| Design token system | Manually synced CSS variables + config | **Tailwind v4 @theme** | Single source of truth, auto-generates utilities + variables, type-safe with IDE autocomplete; manual sync causes drift |
| Color conversion to oklch | Manual P3 gamut calculations | **oklch.fyi converter** | Perceptually uniform conversions, P3 gamut support, proper chroma/lightness mapping; hand-rolled conversions produce incorrect P3 colors |

**Key insight:** Design systems have deceptively complex edge cases (variant combinations, color space conversions, class precedence). Use battle-tested libraries — they've solved problems you don't know you have yet.

---

## Common Pitfalls

### Pitfall 1: oklch Color Space Browser Support Assumptions

**What goes wrong:** Assuming all browsers render oklch colors identically, or that fallbacks aren't needed

**Why it happens:** oklch is cutting-edge (2023+), older browsers don't support it

**How to avoid:**
- Test on non-P3 displays (standard sRGB) — colors should still look good
- Consider hex fallbacks for critical elements: `color: #EBCB4B; color: oklch(0.78 0.15 85.87);`
- Use online converters (oklch.fyi) to verify hex → oklch conversions match intended color

**Warning signs:** Colors look washed out on some devices, amber appears dull instead of vibrant

---

### Pitfall 2: Token Naming Disconnected from Usage

**What goes wrong:** Naming tokens by color (--color-mustard-500) instead of purpose (--color-primary-action)

**Why it happens:** Following Tailwind's default pattern without semantic layer

**How to avoid:**
- **Primitive tokens:** --color-amber-accent (describes the color)
- **Semantic tokens:** Can add layer like --color-action-primary that references --color-amber-accent
- For this phase, primitive naming is fine (amber-accent, teal-accent, grey-950), Phase 31 migration can add semantic aliases if needed

**Warning signs:** Developers ask "which color for buttons?" instead of referencing design system decisions

---

### Pitfall 3: CVA Variant Explosion

**What goes wrong:** Creating too many variants (size: xs/sm/md/lg/xl/2xl, variant: 8 options) leads to maintenance burden

**Why it happens:** Trying to cover every possible use case upfront

**How to avoid:**
- Start minimal: 3 sizes (sm/md/lg), 4 variants (primary/secondary/ghost/outline)
- Add variants when you have 3+ real use cases, not "just in case"
- Use className prop for true one-offs instead of creating variant

**Warning signs:** Variant definitions longer than component logic, unused variants accumulating

---

### Pitfall 4: Forgetting Dark-First Contrast Requirements

**What goes wrong:** Text contrast too low (grey-600 on grey-900 = 2.1:1, fails WCAG 4.5:1)

**Why it happens:** Colors that look fine on light backgrounds fail on dark backgrounds

**How to avoid:**
- Use contrast checker (e.g., WebAIM) for all text/background combinations
- Primary text: --color-grey-100 (very light) on --color-grey-950 (very dark) = high contrast
- Secondary text: --color-grey-400 on --color-grey-950 = still readable
- Interactive elements (teal/amber) should be bright enough to "glow" against dark surfaces

**Warning signs:** Text hard to read, user reports eyestrain, failing accessibility audits

---

### Pitfall 5: Storybook Not Matching Production Dark Theme

**What goes wrong:** Storybook shows components on white background, they look broken in production dark UI

**Why it happens:** Storybook default background is light, components designed for dark

**How to avoid:**
- Set Storybook backgrounds.default to 'dark' in .storybook/preview.tsx
- Import src/styles/index.css with @theme tokens into Storybook
- Test all primitives on dark background during development

**Warning signs:** Components look fine in Storybook, broken in app; missed styling issues during review

---

### Pitfall 6: ESLint Not Catching Hardcoded Colors

**What goes wrong:** Developer uses `className="bg-blue-500"` or `style={{ color: '#FF0000' }}`, breaks design system

**Why it happens:** ESLint not configured to enforce token usage

**How to avoid:**
- Install eslint-plugin-tailwindcss
- Enable `no-arbitrary-value` rule to prevent `bg-[#EBCB4B]`
- Custom rule to block raw Tailwind color classes (bg-red-500, text-blue-600)
- Allow only semantic tokens (bg-amber-accent, text-grey-100)

**Warning signs:** Random colors appearing in UI, design system "drift" from intended palette

**Config example:**

```js
// eslint.config.js
import tailwind from 'eslint-plugin-tailwindcss';

export default [
  {
    plugins: { tailwindcss: tailwind },
    rules: {
      'tailwindcss/no-arbitrary-value': 'error', // Blocks bg-[#EBCB4B]
      'tailwindcss/no-custom-classname': ['warn', {
        whitelist: ['amber-accent', 'teal-accent', 'grey-.*'], // Allow token-based classes
      }],
    },
  },
];
```

---

## Code Examples

Verified patterns from official sources:

### Example 1: Complete Button Primitive with All Variants

```tsx
// src/components/primitives/Button.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { type ButtonHTMLAttributes, forwardRef } from 'react';

const buttonVariants = cva(
  // Base: focus ring, transitions, disabled state
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-grey-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-amber-accent text-grey-950 hover:bg-amber-accent/90 focus-visible:ring-amber-accent',
        secondary: 'bg-teal-accent text-white hover:bg-teal-accent/90 focus-visible:ring-teal-accent',
        ghost: 'text-grey-100 hover:bg-grey-900 hover:text-grey-100 focus-visible:ring-grey-800',
        outline: 'border border-grey-800 bg-transparent text-grey-100 hover:bg-grey-900 focus-visible:ring-grey-800',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
```

**Source:** [CVA React Example](https://cva.style/docs/examples/react/tailwind-css)

---

### Example 2: Card Primitive with Layered Grey System

```tsx
// src/components/primitives/Card.tsx
import { cn } from '@/lib/utils';
import { type HTMLAttributes, forwardRef } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevation level in layered grey system */
  elevation?: 'base' | 'card' | 'elevated';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, elevation = 'card', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-md border border-grey-800',
          {
            'bg-grey-950': elevation === 'base',     // #111
            'bg-grey-900': elevation === 'card',     // #1A1A1A
            'bg-grey-850': elevation === 'elevated', // #222
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Subcomponents for composition
export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold text-grey-100', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';
```

**Usage:**

```tsx
<Card elevation="card">
  <CardHeader>
    <CardTitle>Property Details</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-grey-400 text-sm">Parcel information...</p>
  </CardContent>
</Card>
```

---

### Example 3: Badge Primitive (Filled Muted Pattern)

```tsx
// src/components/primitives/Badge.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { type HTMLAttributes, forwardRef } from 'react';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        // Filled muted pattern for data-dense interface
        default: 'bg-grey-850 text-grey-100 border border-grey-800',
        success: 'bg-success/20 text-success border border-success/30',
        error: 'bg-error/20 text-error border border-error/30',
        info: 'bg-info/20 text-info border border-info/30',
        amber: 'bg-amber-accent/20 text-amber-accent border border-amber-accent/30',
        teal: 'bg-teal-accent/20 text-teal-accent border border-teal-accent/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
    );
  }
);

Badge.displayName = 'Badge';
```

---

### Example 4: Input Primitive (Recessed Dark Field)

```tsx
// src/components/primitives/Input.tsx
import { cn } from '@/lib/utils';
import { type InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // Recessed appearance: inset shadow, dark background
          'flex h-9 w-full rounded-md border border-grey-800 bg-grey-900 px-3 py-2 text-sm text-grey-100 shadow-inner',
          'placeholder:text-grey-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-accent focus-visible:ring-offset-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
```

---

### Example 5: Using Inter + JetBrains Mono

```tsx
// Example: Table with monospace data values
export function PropertyTable({ data }: { data: PropertyData }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-grey-800">
          <th className="text-left font-semibold text-grey-100 py-2">Property</th>
          <th className="text-left font-semibold text-grey-100 py-2">Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="text-grey-400 py-2">Parcel ID</td>
          <td className="text-grey-100 font-mono">{data.parcelId}</td> {/* Monospace */}
        </tr>
        <tr>
          <td className="text-grey-400 py-2">Coordinates</td>
          <td className="text-grey-100 font-mono">{data.lat}, {data.lng}</td> {/* Monospace */}
        </tr>
        <tr>
          <td className="text-grey-400 py-2">Surface Area</td>
          <td className="text-grey-100 font-mono">{data.area} m²</td> {/* Monospace */}
        </tr>
      </tbody>
    </table>
  );
}
```

**Why it works:** Inter (sans-serif) for labels maintains clean readability, JetBrains Mono for data values creates technical aesthetic and aligns numbers in tables.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 JS config | Tailwind v4 @theme CSS blocks | January 2025 | 3.78x faster builds, automatic CSS variables, no PostCSS config needed |
| @apply for components | Explicit CSS variables | Tailwind v4 | Better IDE support, clearer debugging, avoids @apply deprecation |
| sRGB colors (hex/rgb) | oklch P3 colors | 2023-2024 | 25% more colors on modern displays, perceptual uniformity for dark mode |
| Manual variant conditionals | class-variance-authority | 2022-present | Type-safe variants, compound variant support, eliminates className bloat |
| react-icons barrel imports | lucide-react tree-shaking | 2023-present | Smaller bundles, individual icon imports, consistent design language |
| Light-first design systems | Dark-first with system respect | 2024-2026 | Users expect dark mode by default on technical/data tools (Bloomberg, Grafana pattern) |

**Deprecated/outdated:**

- **@apply in Tailwind v4:** Use var(--color-*) explicit variables instead; @apply has worse IDE support and creates maintenance issues
- **tailwind.config.js theme extension:** Use @theme directive in CSS; JS config still works but CSS-first is recommended
- **Arbitrary values for spacing:** v4 supports any value natively (w-17, mt-29); no need for arbitrary syntax `w-[17rem]`
- **postcss-import plugin:** v4 has built-in @import support

---

## Open Questions

### 1. **Google Fonts vs Self-Hosted for Inter/JetBrains Mono**

**What we know:**
- Inter available on Google Fonts and as self-hosted variable font
- JetBrains Mono available on Google Fonts
- Self-hosting avoids GDPR concerns (no Google tracking), but adds bundle size

**What's unclear:**
- Performance difference (Google CDN vs self-hosted)
- Variable font file size impact on FCP (First Contentful Paint)

**Recommendation:**
- Start with Google Fonts for development speed
- Add preconnect hints: `<link rel="preconnect" href="https://fonts.googleapis.com">`
- Measure performance in Phase 31, switch to self-hosted if needed

### 2. **Component Library Pattern: Copy-Paste vs npm Package**

**What we know:**
- shadcn/ui popularized "copy components to your codebase" pattern
- Traditional design systems use npm packages
- Phase 27 is foundation only, Phase 31 is migration

**What's unclear:**
- Whether primitives will be reused across multiple projects
- Developer preference for maintenance model

**Recommendation:**
- **For this phase:** Build in src/components/primitives (copy-paste style) for flexibility
- Can extract to package later if multi-project need emerges
- Focus on patterns being correct, not distribution method

### 3. **Monospace Font Final Choice**

**What we know:**
- JetBrains Mono is excellent (tall x-height, designed for code)
- GitLab uses JetBrains Mono successfully
- Alternatives: Fira Code, SF Mono, Consolas

**What's unclear:**
- User has final say (Claude's discretion)

**Recommendation:**
- **Start with JetBrains Mono** — proven in production (GitLab), free, variable font, excellent readability
- Can swap easily later (change --font-mono in @theme)

---

## Sources

### Primary (HIGH confidence)

- [Tailwind CSS v4.0 - Official Release](https://tailwindcss.com/blog/tailwindcss-v4) — @theme system, performance improvements, CSS-first approach
- [Tailwind CSS - Theme Variables](https://tailwindcss.com/docs/theme) — How to define design tokens with @theme
- [Lucide React - Official Docs](https://lucide.dev/guide/packages/lucide-react) — Installation, import patterns, customization
- [Class Variance Authority - Official Docs](https://cva.style/docs) — CVA API, React integration, Tailwind patterns
- [Storybook - Tailwind CSS Recipe](https://storybook.js.org/recipes/tailwindcss) — Official Storybook + Tailwind setup

### Secondary (MEDIUM confidence)

- [Color tokens for dark mode - Medium](https://medium.com/design-bootcamp/color-tokens-guide-to-light-and-dark-modes-in-design-systems-146ab33023ac) — Token architecture for light/dark modes
- [Tailwind CSS Best Practices 2025-2026](https://www.frontendtools.tech/blog/tailwind-css-best-practices-design-system-patterns) — Design token patterns, ESLint enforcement
- [Dark Mode Best Practices 2026](https://www.tech-rz.com/blog/dark-mode-design-best-practices-in-2026/) — Contrast requirements, technical interface aesthetics
- [OKLCH in CSS - Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl) — Why oklch for modern CSS, P3 gamut benefits
- [Inter + JetBrains Mono Pairing](https://maxibestof.one/typefaces/inter/pairing/jetbrains-mono) — Typography pairing for data-dense interfaces
- [GitLab Typefaces](https://about.gitlab.com/blog/new-typefaces-in-gitlab/) — Real-world Inter + JetBrains Mono implementation

### Tertiary (LOW confidence)

- [Bloomberg Terminal Design](https://www.bloomberg.com/company/stories/designing-the-terminal-for-color-accessibility/) — Color accessibility insights for financial interfaces
- [Tailwind Design System Pitfalls - Medium](https://medium.com/@vishalthakur2463/tailwind-css-in-large-projects-best-practices-pitfalls-bf745f72862b) — Common mistakes in large Tailwind projects

---

## Metadata

**Confidence breakdown:**

- **Standard stack:** HIGH — Tailwind v4 already installed, CVA/lucide-react/tailwind-merge are industry standard, verified with official docs
- **Architecture:** HIGH — @theme pattern from official Tailwind docs, CVA pattern from official CVA docs, Storybook recipe from official Storybook
- **Pitfalls:** MEDIUM-HIGH — oklch browser support verified, ESLint patterns from community best practices, contrast requirements from WCAG standards

**Research date:** 2026-02-16
**Valid until:** ~2026-04-16 (60 days — design system patterns are stable, Tailwind v4 is current major version)

**Notes:**

- Tailwind v4.1.18 already installed ✅
- User decisions are clear and detailed — dark-first is non-negotiable pivot from earlier research
- Phase boundary is clean: foundation only, migration in Phase 31
- All locked decisions (amber #EBCB4B, teal #0D9488, layered greys, Inter + JetBrains Mono, 4-6px radius) verified as technically sound
- Claude's discretion areas researched with recommendations: cool greys for technical feel, visible borders on dark, muted filled badges, JetBrains Mono for data
