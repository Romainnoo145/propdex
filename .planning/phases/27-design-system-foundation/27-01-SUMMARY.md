---
phase: 27-design-system-foundation
plan: 01
subsystem: frontend/design-system
tags: [design-tokens, tailwind-v4, typography, utilities]
completed: 2026-02-16

dependency_graph:
  requires: []
  provides:
    - Industrial Amber design token system via Tailwind v4 @theme
    - cn() utility for class merging
    - Inter + JetBrains Mono fonts
    - ESLint enforcement for design token usage
  affects:
    - All future UI components will use these tokens
    - All className props should use cn() utility
    - All colors should reference design tokens (not arbitrary values)

tech_stack:
  added:
    - lucide-react: ^0.564.0 (icon library)
    - class-variance-authority: ^0.7.1 (component variants)
    - clsx: ^2.1.1 (conditional classes)
    - tailwind-merge: ^3.4.1 (class deduplication)
    - eslint-plugin-tailwindcss: ^4.0.0-beta.0 (linting)
  patterns:
    - Tailwind v4 @theme directive for design tokens
    - oklch color space for P3 gamut vibrancy
    - Google Fonts CDN for typography
    - cn() utility pattern for component className composition

key_files:
  created:
    - frontend/src/lib/utils.ts: cn() utility for class merging
  modified:
    - frontend/src/styles/index.css: Complete design token system
    - frontend/index.html: Google Fonts preconnect and stylesheet
    - frontend/eslint.config.js: Tailwind linting rules
    - frontend/package.json: Design system dependencies

decisions:
  - "Used eslint-plugin-tailwindcss v4 beta for Tailwind v4 compatibility (v3 incompatible)"
  - "Set no-arbitrary-value to 'warn' (not 'error') for gradual migration of existing code"
  - "Used oklch color space for all tokens (P3 gamut, better perceptual uniformity)"
  - "Loaded fonts from Google Fonts CDN (fast, no self-hosting needed for v4.0)"

metrics:
  duration: 256s
  tasks_completed: 3
  commits: 3
  files_created: 1
  files_modified: 4
---

# Phase 27 Plan 01: Design System Foundation Summary

JWT auth with refresh rotation using jose library—Industrial Amber design token system with Tailwind v4 @theme, Inter/JetBrains Mono fonts, cn() utility, and ESLint enforcement

## Overview

Established the single source of truth for all UI styling. Every color, font, radius, and shadow in the system flows from the @theme block in index.css. This foundation enables all subsequent primitives and component migration.

### What Was Built

1. **Design Token System** — Complete @theme block with:
   - Amber/teal accent colors in oklch (P3 gamut vibrancy)
   - Cool grey scale (950-100) with subtle blue undertone
   - Semantic colors (success/error/warning/info) high contrast
   - Typography (Inter + JetBrains Mono)
   - Compact font sizes (11-24px)
   - Subtle border radius (4-6-8px)
   - Dark-optimized shadows

2. **Typography** — Inter (400-700) for UI text, JetBrains Mono (400-500) for monospace elements, loaded from Google Fonts with preconnect hints

3. **Class Utility** — cn() function composing clsx + tailwind-merge for conflict-free className composition

4. **ESLint Enforcement** — eslint-plugin-tailwindcss v4 beta with no-arbitrary-value rule to prevent hardcoded colors

### Design Tokens

**Accent Colors (oklch):**
- Amber: `oklch(0.78 0.15 85.87)` → bg-amber-accent, text-amber-accent
- Amber Hover: `oklch(0.73 0.14 85.87)` → bg-amber-accent-hover
- Teal: `oklch(0.59 0.12 192.47)` → bg-teal-accent, text-teal-accent
- Teal Hover: `oklch(0.54 0.11 192.47)` → bg-teal-accent-hover

**Grey Scale (oklch, hue 270):**
- 950: `oklch(0.13 0.005 270)` → body background (#111111)
- 900: `oklch(0.18 0.005 270)` → card surfaces (#1A1A1A)
- 850: `oklch(0.23 0.005 270)` → elevated surfaces (#222222)
- 800: `oklch(0.28 0.005 270)` → borders, dividers
- 700: `oklch(0.35 0.005 270)` → subtle borders, hover
- 600: `oklch(0.45 0.005 270)` → disabled text
- 400: `oklch(0.65 0.005 270)` → secondary text
- 300: `oklch(0.75 0.005 270)` → tertiary text
- 100: `oklch(0.95 0.005 270)` → primary text

**Semantic (oklch):**
- Success: `oklch(0.65 0.18 145)` → green
- Error: `oklch(0.60 0.22 25)` → red
- Warning: `oklch(0.75 0.15 85)` → amber-adjacent
- Info: `oklch(0.62 0.18 250)` → blue

**Typography:**
- Sans: Inter (400/500/600/700)
- Mono: JetBrains Mono (400/500)
- Sizes: xs(11px), sm(13px), base(14px), lg(16px), xl(18px), 2xl(24px)

**Radius:**
- sm: 4px, md: 6px, lg: 8px

**Shadows:**
- sm/md/lg with dark-mode opacity (0.3-0.5)

### Usage Examples

```tsx
import { cn } from '@/lib/utils';

// Color utilities
<div className="bg-amber-accent text-grey-950">Action Button</div>
<div className="bg-grey-900 text-grey-100 border border-grey-800">Card</div>

// Typography
<h1 className="font-sans text-2xl font-bold">Heading</h1>
<code className="font-mono text-sm">data-value</code>

// Radius & shadows
<div className="rounded-md shadow-md">Elevated Card</div>

// Class merging with cn()
<button className={cn('bg-amber-accent', isDisabled && 'opacity-50')}>
  {label}
</button>
```

### CSS Variables

All tokens also available as CSS variables:
- `var(--color-amber-accent)`
- `var(--color-grey-950)`
- `var(--font-sans)`
- `var(--text-sm)`
- `var(--radius-md)`
- `var(--shadow-lg)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Upgraded eslint-plugin-tailwindcss to v4 beta**
- **Found during:** Task 3
- **Issue:** eslint-plugin-tailwindcss v3.18.2 incompatible with Tailwind v4 — tried to import 'tailwindcss/resolveConfig' which doesn't exist in v4's new module structure
- **Fix:** Upgraded to v4.0.0-beta.0 which is compatible with Tailwind v4
- **Files modified:** frontend/package.json, frontend/pnpm-lock.yaml
- **Commit:** f7b4cd8

## Verification Results

All verification checks passed:

1. All 5 packages installed (lucide-react, class-variance-authority, clsx, tailwind-merge, eslint-plugin-tailwindcss)
2. TypeScript + ESLint pass with no errors
3. @theme block present in index.css
4. All 18 colors use oklch (no hex values)
5. Inter and JetBrains Mono loaded from Google Fonts
6. cn() utility exists and exports correctly
7. ESLint no-arbitrary-value rule configured

### ESLint Output

Check command shows 52 warnings (0 errors) — these are **expected**:
- Warnings about arbitrary values in existing components using old CSS variables
- These will be migrated to design tokens in subsequent plans
- "Cannot resolve tailwindcss config" messages are expected with v4's config-less approach

## Next Steps

1. **Plan 02** — Build core primitives (Button, Input, Card, Badge, etc.) using design tokens
2. **Plan 03** — Build complex components (Combobox, Dialog, Dropdown, Tabs, etc.)
3. **Plan 04+** — Migrate existing components to use design system

## Self-Check: PASSED

**Created files verified:**
- FOUND: frontend/src/lib/utils.ts

**Modified files verified:**
- FOUND: frontend/src/styles/index.css
- FOUND: frontend/index.html
- FOUND: frontend/eslint.config.js
- FOUND: frontend/package.json

**Commits verified:**
- FOUND: 41c22cc (chore: install deps and fonts)
- FOUND: 5a9bc02 (feat: define design tokens)
- FOUND: f7b4cd8 (feat: create cn() utility and ESLint)

**Design tokens accessible:**
- Tailwind utilities work: bg-amber-accent, text-grey-100, font-mono, rounded-md, shadow-md
- CSS variables work: var(--color-amber-accent), var(--font-sans), var(--radius-md)

**Typography verified:**
- Inter loaded for UI text (weights 400-700)
- JetBrains Mono loaded for monospace (weights 400-500)

**ESLint enforcement verified:**
- no-arbitrary-value rule active (52 warnings on existing code)
- Plugin compatible with Tailwind v4
