---
phase: 27-design-system-foundation
plan: 02
subsystem: frontend/design-system
tags: [primitives, components, button, card, badge, input, select, cva]
completed: 2026-02-16

dependency_graph:
  requires:
    - 27-01 (design tokens, cn() utility, CVA dependency)
  provides:
    - Button primitive with 5 variants and 3 sizes
    - Card primitive with 3 elevation levels and 4 subcomponents
    - Badge primitive with 7 semantic variants
    - Input primitive with recessed dark styling
    - Select primitive with native select and ChevronDown icon
    - Barrel export for all primitives
  affects:
    - All future UI components will use these primitives as building blocks
    - Phase 31 component migration will consume these primitives

tech_stack:
  added: []
  patterns:
    - CVA (class-variance-authority) for type-safe variant definitions
    - forwardRef pattern for all primitives (ref forwarding)
    - cn() utility for className composition
    - Lucide React icons (ChevronDown in Select)
    - Type aliases for simple prop extensions (InputProps, SelectProps)

key_files:
  created:
    - frontend/src/components/primitives/Button.tsx: Primary action component with CVA variants
    - frontend/src/components/primitives/Card.tsx: Surface container with elevation system
    - frontend/src/components/primitives/Badge.tsx: Status indicator with muted semantic fills
    - frontend/src/components/primitives/Input.tsx: Form input with recessed dark styling
    - frontend/src/components/primitives/Select.tsx: Native select with custom icon
    - frontend/src/components/primitives/index.ts: Barrel export for all primitives
  modified: []

decisions:
  - "Used type aliases instead of empty interfaces for InputProps/SelectProps (ESLint compliance)"
  - "Input/Select both use h-8 (32px) height for consistency with Button md size"
  - "Badge uses muted fill pattern (15% opacity bg, 25% opacity border) for data-dense dark interfaces"
  - "Select uses native <select> with custom styling (not headless UI) for simplicity and accessibility"

metrics:
  duration: 329s
  tasks_completed: 2
  commits: 2
  files_created: 6
  files_modified: 0
---

# Phase 27 Plan 02: UI Primitives Summary

Core UI primitives (Button, Card, Badge, Input, Select) with CVA variants, forwardRef, and design token integration

## Overview

Built five foundational UI primitives that serve as building blocks for all future component work. Each primitive follows the same pattern: CVA for variants, forwardRef for ref forwarding, cn() for class merging, and full TypeScript types. These components directly consume the design tokens from Plan 01.

### What Was Built

1. **Button Primitive** — Primary action component with 5 variants and 3 sizes
   - Variants: primary (amber), secondary (teal), ghost, outline, destructive
   - Sizes: sm (28px), md (32px), lg (36px)
   - Pattern: CVA + forwardRef + cn() + className prop
   - Exports: Button, ButtonProps, buttonVariants (for extending)

2. **Card Primitive** — Surface container with layered grey elevation system
   - Elevations: base (bg-grey-950), card (bg-grey-900), elevated (bg-grey-850)
   - Subcomponents: CardHeader, CardTitle, CardContent, CardFooter
   - All subcomponents use forwardRef and accept className
   - Default elevation: 'card'

3. **Badge Primitive** — Status indicator with muted semantic fills
   - 7 variants: default, success, error, warning, info, amber, teal
   - Muted fill pattern: 15% opacity background, 25% opacity border
   - Works well on dark surfaces for data-dense interfaces

4. **Input Primitive** — Form input with recessed dark styling
   - Background: bg-grey-950 (darkest) creates "recessed" effect on bg-grey-900 cards
   - Focus ring: teal (secondary interactive color)
   - Height: h-8 (32px) matches Button md size
   - Includes file input styling

5. **Select Primitive** — Native select with custom ChevronDown icon
   - Native `<select>` element with custom styling
   - ChevronDown icon from lucide-react (14px, grey-400)
   - Matches Input styling for consistency
   - Wrapper div for icon positioning

6. **Barrel Export** — Convenient import path
   - Exports all components and TypeScript types
   - Usage: `import { Button, Card, Badge, Input, Select } from '@/components/primitives'`

### Component Patterns

**Button Example:**
```tsx
import { Button } from '@/components/primitives';

<Button variant="primary" size="md">Action</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost" size="lg">Dismiss</Button>
```

**Card Example:**
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/primitives';

<Card elevation="card">
  <CardHeader>
    <CardTitle>Property Details</CardTitle>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

**Badge Example:**
```tsx
import { Badge } from '@/components/primitives';

<Badge variant="success">Active</Badge>
<Badge variant="error">Failed</Badge>
<Badge variant="amber">Warning</Badge>
```

**Input Example:**
```tsx
import { Input } from '@/components/primitives';

<Input type="text" placeholder="Enter address..." />
```

**Select Example:**
```tsx
import { Select } from '@/components/primitives';

<Select>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</Select>
```

### Design Token Usage

All primitives use design tokens from Plan 01:

**Colors:**
- `bg-amber-accent` / `bg-amber-accent-hover` — primary actions
- `bg-teal-accent` / `bg-teal-accent-hover` — secondary actions, focus rings
- `bg-grey-950` / `bg-grey-900` / `bg-grey-850` — layered elevation system
- `bg-grey-800` — borders, dividers
- `text-grey-100` / `text-grey-600` — text, placeholders
- `bg-success/error/warning/info` — semantic badge variants

**Typography:**
- `text-xs` (11px) — Badge, Button sm
- `text-sm` (13px) — Input, Select, Button md/lg
- `text-lg` (16px) — CardTitle

**Radius:**
- `rounded-md` (6px) — all primitives
- `rounded-sm` (4px) — Badge only

**Spacing:**
- `h-7/h-8/h-9` — Button sizes
- `px-2/px-2.5/px-3/px-4` — horizontal padding
- `gap-1.5/gap-2` — internal spacing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ESLint no-empty-object-type error**
- **Found during:** Task 2 verification
- **Issue:** InputProps and SelectProps defined as empty interfaces extending React types — ESLint rule `@typescript-eslint/no-empty-object-type` flagged as error
- **Fix:** Changed from `export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}` to `export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;`
- **Files modified:** Input.tsx, Select.tsx
- **Commit:** 33da88d (included in Task 2 commit)
- **Reason:** Type aliases are preferred for simple extensions with no additional properties

## Verification Results

All verification checks passed:

1. **TypeScript compilation:** `npx tsc -b --noEmit` — 0 errors
2. **Full check:** `npm run check` — 0 errors, 52 warnings (all from existing code)
3. **Directory structure:** All 6 files present (Button, Card, Badge, Input, Select, index)
4. **forwardRef usage:** All 9 components use forwardRef (Button, Card + 4 subcomponents, Badge, Input, Select)
5. **cn() utility:** All components use cn() for class merging
6. **CVA usage:** Button and Badge use CVA for type-safe variants
7. **Lucide import:** Select imports ChevronDown from lucide-react
8. **Amber usage:** Button primary variant uses bg-amber-accent
9. **Teal usage:** Input focus ring uses focus-visible:ring-teal-accent
10. **Barrel export:** index.ts exports all 5 primitives with TypeScript types

### Component Exports Verified

**Button:** Button, ButtonProps, buttonVariants
**Card:** Card, CardHeader, CardTitle, CardContent, CardFooter, CardProps
**Badge:** Badge, BadgeProps
**Input:** Input, InputProps
**Select:** Select, SelectProps

## Next Steps

1. **Plan 03** — Build complex components (Combobox, Dialog, Dropdown, Tabs, etc.) using these primitives
2. **Phase 28-31** — Use these primitives in navigation, layout, and component migrations
3. **Future migrations** — Replace existing UI components with these primitives

## Self-Check: PASSED

**Created files verified:**
- FOUND: frontend/src/components/primitives/Button.tsx
- FOUND: frontend/src/components/primitives/Card.tsx
- FOUND: frontend/src/components/primitives/Badge.tsx
- FOUND: frontend/src/components/primitives/Input.tsx
- FOUND: frontend/src/components/primitives/Select.tsx
- FOUND: frontend/src/components/primitives/index.ts

**Commits verified:**
- FOUND: d07f561 (feat: Button, Card, Badge primitives)
- FOUND: 33da88d (feat: Input, Select, barrel export)

**TypeScript types verified:**
- Button: ButtonProps interface extends VariantProps
- Card: CardProps interface with elevation prop
- Badge: BadgeProps interface extends VariantProps
- Input: InputProps type alias
- Select: SelectProps type alias

**Design token integration verified:**
- Amber accent: primary button variant
- Teal accent: secondary button, input/select focus rings
- Grey scale: card elevations, borders, text colors
- Semantic colors: badge variants
- Typography: text-xs, text-sm, text-lg
- Radius: rounded-md, rounded-sm
- Spacing: h-7/8/9, px-2/2.5/3/4, gap-1.5/2

**ESLint compliance verified:**
- no-arbitrary-value: 0 new warnings (all primitives use design tokens)
- no-empty-object-type: 0 errors (type aliases used)
- All components pass TypeScript strict mode
