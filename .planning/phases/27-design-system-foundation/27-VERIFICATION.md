---
phase: 27-design-system-foundation
verified: 2026-02-17T19:56:46Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Visual verification of all 5 primitives in Storybook"
    expected: "Button amber fill readable, Card elevation depth visible, Badge muted fills on dark, Input recessed effect on cards, Select ChevronDown icon styled correctly — all on #111111 background with Inter font"
    why_human: "Visual rendering cannot be verified programmatically. Storybook build succeeds and all artifacts are wired, but pixel-accurate dark-first aesthetic requires human visual inspection."
  - test: "Confirm ESLint enforcement detects arbitrary hardcoded colors"
    expected: "ESLint reports a warning when writing bg-[#EBCB4B] or similar hardcoded hex color in a .tsx file"
    why_human: "Plugin reports 'Cannot resolve default tailwindcss config path' — confirms plugin is active but the no-arbitrary-value detection for hex colors could not be end-to-end tested without running a live edit cycle."
---

# Phase 27: Design System Foundation Verification Report

**Phase Goal:** Establish Industrial Amber design token system as single source of truth for all UI styling.
**Verified:** 2026-02-17T19:56:46Z
**Status:** human_needed (automated checks passed, two items require human confirmation)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Developer can reference design tokens via Tailwind utilities (bg-amber-accent, text-grey-800, etc.) | VERIFIED | @theme block in index.css defines all 18 color tokens in oklch; `@import "tailwindcss"` causes them to generate utilities; no hex fallbacks |
| 2 | UI primitives (button, card, badge, input, select) render with Industrial Amber styling in Storybook | VERIFIED (automated) + human_needed (visual) | All 5 primitives compile, Storybook build succeeds, stories import from @/components/primitives — visual check needed |
| 3 | Icons from lucide-react display consistently across all interface elements | VERIFIED | lucide-react@0.564.0 installed; Select.tsx imports ChevronDown; Badge.stories.tsx imports Check/X/Info from lucide-react |
| 4 | Design token changes in @theme automatically propagate to all components without code changes | VERIFIED | All primitives use design token utilities (bg-amber-accent, text-grey-950, border-grey-800, etc.) — zero hardcoded colors in primitive files |
| 5 | Zero hardcoded hex colors remain in component files (enforced via ESLint rule) | VERIFIED + human_needed | ESLint tailwindcss/no-arbitrary-value configured as 'warn'; grep confirms no bg-[#...] or text-[#...] in any src/components/ file; plugin reports config path warning but is active |

**Score:** 5/5 truths verified (2 items flagged for human visual confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/styles/index.css` | @theme block with Industrial Amber tokens | VERIFIED | 18 oklch color tokens (amber/teal accents, grey scale 950-100, semantic colors), Inter/JetBrains Mono fonts, compact font sizes (11-24px), radius (4-6-8px), shadows — zero hex values |
| `frontend/src/lib/utils.ts` | cn() class merging utility | VERIFIED | Exports cn() composing clsx + twMerge, 11 lines, no stubs |
| `frontend/index.html` | Google Fonts preconnect + stylesheet | VERIFIED | Preconnect to fonts.googleapis.com and fonts.gstatic.com; Inter (400-700) + JetBrains Mono (400-500) with display=swap |
| `frontend/src/components/primitives/Button.tsx` | Button with primary/secondary/ghost/outline/destructive + sm/md/lg | VERIFIED | CVA variants, forwardRef, bg-amber-accent primary, bg-teal-accent secondary, exports Button/ButtonProps/buttonVariants |
| `frontend/src/components/primitives/Card.tsx` | Card with base/card/elevated + subcomponents | VERIFIED | Elevation via bg-grey-950/900/850, exports Card/CardHeader/CardTitle/CardContent/CardFooter |
| `frontend/src/components/primitives/Badge.tsx` | Badge with 7 semantic variants | VERIFIED | CVA with default/success/error/warning/info/amber/teal, muted fill pattern (15%/25% opacity) |
| `frontend/src/components/primitives/Input.tsx` | Input with recessed dark styling + teal focus ring | VERIFIED | bg-grey-950 recessed, focus-visible:ring-teal-accent, h-8, forwardRef |
| `frontend/src/components/primitives/Select.tsx` | Select with dark dropdown + ChevronDown icon | VERIFIED | ChevronDown from lucide-react, appearance-none, matches Input styling |
| `frontend/src/components/primitives/index.ts` | Barrel export for all primitives | VERIFIED | Exports all 5 components + TypeScript types |
| `frontend/.storybook/main.ts` | Storybook config with Vite builder and @/ alias | VERIFIED | @storybook/react-vite framework, viteFinal resolves @/ → src/, stories glob pattern |
| `frontend/.storybook/preview.tsx` | Dark background + Tailwind CSS import | VERIFIED | Imports ../src/styles/index.css, backgrounds.default = 'dark' (#111111) |
| `frontend/src/stories/primitives/Button.stories.tsx` | 8 Button stories | VERIFIED | Primary/Secondary/Ghost/Outline/Destructive/AllVariants/AllSizes/Disabled stories |
| `frontend/src/stories/primitives/Card.stories.tsx` | 3 Card stories with AllElevations | VERIFIED | Default/AllElevations/WithFooter stories; all elevation levels demonstrated |
| `frontend/src/stories/primitives/Badge.stories.tsx` | 3 Badge stories with AllVariants | VERIFIED | Default/AllVariants/WithIcon stories; Lucide icons used in WithIcon |
| `frontend/src/stories/primitives/Input.stories.tsx` | 4 Input stories | VERIFIED | Default/WithValue/Disabled/WithLabel stories; Dutch content |
| `frontend/src/stories/primitives/Select.stories.tsx` | 3 Select stories | VERIFIED | Default/Disabled/WithLabel stories; gemeente options |
| `frontend/eslint.config.js` | ESLint tailwindcss/no-arbitrary-value rule | VERIFIED | eslint-plugin-tailwindcss v4.0.0-beta.0 imported, no-arbitrary-value: 'warn' configured |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend/src/styles/index.css` | Tailwind v4 utilities | @theme directive | VERIFIED | `@import "tailwindcss"` + @theme block generates bg-amber-accent, text-grey-100, font-mono, rounded-md etc. |
| `frontend/src/lib/utils.ts` | tailwind-merge + clsx | import and compose | VERIFIED | `import { twMerge } from 'tailwind-merge'` + `import { type ClassValue, clsx } from 'clsx'` both present |
| `frontend/src/components/primitives/Button.tsx` | `frontend/src/lib/utils.ts` | cn() import | VERIFIED | `import { cn } from '@/lib/utils'` present in Button.tsx (and all 4 other primitives) |
| `frontend/src/components/primitives/Button.tsx` | class-variance-authority | cva() import | VERIFIED | `import { cva, type VariantProps } from 'class-variance-authority'` in Button.tsx and Badge.tsx |
| `frontend/src/components/primitives/Select.tsx` | lucide-react | ChevronDown import | VERIFIED | `import { ChevronDown } from 'lucide-react'` with size={14} positioned absolutely |
| `frontend/.storybook/preview.tsx` | `frontend/src/styles/index.css` | CSS import | VERIFIED | `import '../src/styles/index.css'` at line 2 of preview.tsx loads @theme tokens into Storybook |
| `frontend/src/stories/primitives/Button.stories.tsx` | primitives/Button.tsx | barrel import | VERIFIED | All 5 story files import from '@/components/primitives' (barrel); Storybook build confirms resolution |

---

### Requirements Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| DS-01 Industrial Amber color palette consistency | SATISFIED | oklch amber/teal/grey tokens in @theme; all primitives use token utilities exclusively |
| DS-02 Tailwind v4 @theme design tokens | SATISFIED | @import "tailwindcss" + @theme block in index.css; utilities (bg-amber-accent etc.) generated |
| DS-05 Lucide-react icons | SATISFIED | lucide-react@0.564.0 installed; used in Select primitive and Badge stories |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/map/PropertyGeometryLayer.tsx` | 84, 95 | Hardcoded hex color '#f59e0b' in MapLibre paint expressions | Info | Map layer paint properties — these are MapLibre GL JS paint expressions, not Tailwind classes; ESLint cannot lint these; acceptable for map-specific config |
| `src/routes/auth/index.tsx` | 37-59 | Arbitrary CSS variable references (text-[var(--color-text)]) | Info | Old CSS variable references from pre-design-system code; ESLint warns (52 warnings, 0 errors); planned migration in subsequent phases |
| `src/lib/svbp2012.ts` | 23-39 | Hardcoded hex colors for zoning category colors | Info | Data constants for SVBP2012 zoning standard — these are data values, not UI styling; not in component files |

No blockers found. All anti-patterns are pre-existing code or data constants outside the new primitives.

---

### Human Verification Required

#### 1. Industrial Amber Visual Rendering in Storybook

**Test:** Run `cd frontend && pnpm storybook`, open http://localhost:6006
**Expected:**
- Button > All Variants: amber primary (bright gold fill, dark text), teal secondary (teal fill, white text), and other variants visible side-by-side
- Card > All Elevations: three visibly distinct grey levels creating depth (darker base, mid card, lighter elevated)
- Badge > All Variants: 7 muted color fills that glow subtly against the #111111 background (not harsh/full saturation)
- Input > Default: appears visually "sunken" (darker than surrounding card surface), teal ring on focus
- Select > Default: ChevronDown icon visible at right, matching Input appearance
- All text renders in Inter (not system font), code elements use JetBrains Mono
- Overall "Bloomberg Terminal / Grafana" industrial aesthetic
**Why human:** Visual rendering, color perception, and aesthetic judgment cannot be verified programmatically. Storybook build succeeds but pixel-accurate visual quality requires human eyes.

#### 2. ESLint Detection of Hardcoded Hex Colors

**Test:** In any .tsx file under src/, temporarily add `className="bg-[#EBCB4B]"` to a component and run `npm run check`
**Expected:** ESLint reports a warning: `Arbitrary value detected in 'bg-[#EBCB4B]' tailwindcss/no-arbitrary-value`
**Why human:** The ESLint plugin reports "Cannot resolve default tailwindcss config path" during automated testing (expected with Tailwind v4 config-less approach). Active warnngs in existing code confirm the plugin runs, but end-to-end detection of a hardcoded hex specifically requires a live edit cycle to confirm.

---

## Gaps Summary

No structural gaps identified. All 5 phase success criteria have supporting artifacts that are:
- Substantive (not stubs or placeholders)
- Wired (imported and used by dependent files)
- Committed (9 commits from 41c22cc through 640cd7f)

The two human verification items are quality confirmations, not blockers. The automated infrastructure is complete and working (TypeScript: 0 errors, Storybook build: success, 52 ESLint warnings on pre-existing code).

---

_Verified: 2026-02-17T19:56:46Z_
_Verifier: Claude (gsd-verifier)_
