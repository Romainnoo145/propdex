# Phase 97: Settings (Aura Reskin) - Research

**Researched:** 2026-03-14
**Domain:** Frontend reskin — Aura design system applied to settings pages
**Confidence:** HIGH

## Summary

Phase 97 is a pure frontend reskin of two existing settings routes (`/instellingen` and `/instellingen/score`) to align with the Aura design system. No backend changes are needed. The settings pages already use Aura tokens (`text-aura-ink`, `bg-aura-canvas`, `bg-aura-amber`, `bg-aura-obsidian`) partially, but the page structure — section containers, form fields, toggle controls, and tab navigation — lack the BentoPod/glass card treatment seen in the map panel and resultaten route.

The primary work is: wrapping each settings section in `BentoPod` cards, upgrading the page header to match the pattern in `resultaten.tsx` (glass header bar), and making the `SettingsTabNav` and `FactorTable` rows more visually consistent with the Aura bento aesthetic. All logic and API calls remain unchanged — this is styling only.

The REQUIREMENTS.md maps **SET-01** to Phase 97. There is no RPT-01 work here — the traceability table places RPT-01 at Phase 97 but the context description scopes Phase 97 to settings only. Confirm with the planner whether RPT-01 (report detail page redesign) is also in scope or a separate phase.

**Primary recommendation:** Wrap each settings section in `BentoPod size="spacious"`, replace raw `<section>` wrappers, and add a glass header bar to both routes. Keep all form logic, hooks, and validation unchanged.

## Standard Stack

### Core (already in place — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS v4 | 4.x | Utility styling via `@theme` tokens | Project standard, Aura tokens defined here |
| `class-variance-authority` | existing | BentoPod/Button variant composition | Used throughout primitives |
| `framer-motion` | existing | Optional tab indicator animation | Used in SettingsTabNav pattern (CategoryTabs model) |
| lucide-react | existing | Section header icons | Already used in all settings sections |

### Supporting (available primitives)

| Primitive | Path | Purpose |
|-----------|------|---------|
| `BentoPod` | `@/components/primitives/BentoPod` | Section card containers — `bg-white/40 border-white/40 rounded-2xl` |
| `GlassPanel` | `@/components/primitives/GlassPanel` | Page header bar — `bg-white/60 shadow-glass` |
| `Button` | `@/components/primitives/Button` | Save/submit CTAs — use `variant="command"` for authoritative actions |
| `Input` | `@/components/primitives/Input` | Already Aura-styled — no changes needed |

**Installation:** None — all dependencies already present.

## Architecture Patterns

### Recommended Component Structure (unchanged files)

```
frontend/src/
├── routes/_authenticated/
│   ├── instellingen.tsx          # Page layout only — add glass header
│   └── instellingen.score.tsx    # Page layout only — add glass header
└── components/settings/
    ├── AccountSection.tsx         # Wrap in BentoPod, no logic change
    ├── PasswordSection.tsx        # Wrap in BentoPod, no logic change
    ├── NotificationsSection.tsx   # Wrap in BentoPod, toggle → Aura toggle style
    ├── AppearanceSection.tsx      # Wrap in BentoPod, card buttons → BentoPod interactive
    ├── SettingsTabNav.tsx         # Already correct — minor bg tweak if needed
    ├── ScoreSection.tsx           # Wrap sub-blocks in BentoPod, save button upgrade
    ├── PresetCards.tsx            # Already Aura-amber border — minimal changes
    ├── BalanceSlider.tsx          # Wrap in BentoPod, no logic change
    └── FactorTable.tsx            # Table rows → Aura hover, header tweaks
```

### Pattern 1: Section card via BentoPod

**What:** Each settings section becomes a `BentoPod size="spacious"` instead of a bare `<section>`.
**When to use:** All four Account/Password/Notifications/Appearance sections and Score sub-sections.

```tsx
// Before:
<section>
  <div className="mb-4 flex items-center gap-2">
    <User className="h-5 w-5 text-neutral-600" />
    <h2 className="text-lg font-semibold text-aura-ink">Account</h2>
  </div>
  ...
</section>

// After:
<BentoPod size="spacious" className="space-y-4">
  <div className="flex items-center gap-2">
    <User className="h-5 w-5 text-aura-amber" />
    <h2 className="text-lg font-semibold text-aura-ink">Account</h2>
  </div>
  ...
</BentoPod>
```

Key changes:
- Section icons: `text-neutral-600` → `text-aura-amber` (consistent with Aura accent use)
- Section dividers: `<div className="border-t border-neutral-200" />` between sections → `space-y-4` gap inside `BentoPod` or removed (BentoPod border already separates visually)
- `<section>` → `<BentoPod size="spacious">`

### Pattern 2: Glass header bar on page routes

**What:** Page header with `h1` + description gets a `GlassPanel` or inline glass treatment, matching `resultaten.tsx` pattern.
**Source:** `resultaten.tsx` line 120 — `rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-4`

```tsx
// instellingen.tsx and instellingen.score.tsx header:
<div className="mb-6 rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-5 py-4">
  <h1 className="text-2xl font-semibold text-aura-ink">Instellingen</h1>
  <p className="mt-1 text-sm text-neutral-600">Beheer je account en voorkeuren</p>
</div>
```

### Pattern 3: SettingsTabNav Aura upgrade

Current: `bg-neutral-100` pill container. Aura: `bg-aura-canvas` or `bg-aura-glass-white/40 border border-white/40` container with `rounded-full`.
Active tab already uses `bg-aura-obsidian text-white` — correct per spec.

```tsx
// Current container:
<nav className="flex gap-1 rounded-full bg-neutral-100 p-1 w-fit">
// After:
<nav className="flex gap-1 rounded-full bg-aura-glass-white/40 border border-white/40 p-1 w-fit">
```

### Pattern 4: AppearanceSection card buttons → BentoPod interactive

**What:** Map style selector buttons (Satellite/Light) → `BentoPod interactive` with amber active state.

```tsx
// Replace current border-based button:
<BentoPod
  interactive
  size="compact"
  className={cn(
    'w-40 flex flex-col items-center gap-2',
    isSelected ? 'ring-1 ring-aura-amber border-aura-amber' : '',
  )}
  onClick={() => handleSelectStyle(value)}
>
  <Icon className={isSelected ? 'text-aura-amber' : 'text-neutral-500'} />
  <span className={isSelected ? 'text-aura-ink font-semibold' : 'text-neutral-600'}>{label}</span>
  <span className="text-xs text-neutral-500">{description}</span>
</BentoPod>
```

### Pattern 5: NotificationsSection toggle → inline Aura pill

Current toggle is manually built with `bg-aura-green`. This is already functional. Minor change: ensure the section is wrapped in BentoPod — the toggle itself needs no logic change.

### Pattern 6: ScoreSection sub-sections → BentoPod pods

The `ScoreSection` renders `<div className="space-y-8">` with sub-blocks separated by `border-t border-neutral-200`. Aura treatment: each sub-block (preset cards block, balance slider block, potentie factor table, risico factor table, save area) becomes a `BentoPod`.

```tsx
// Balance slider sub-block:
<BentoPod size="spacious" className="space-y-3">
  <p className="text-sm font-medium text-aura-ink">Potentie / Risico verhouding</p>
  <BalanceSlider value={...} onChange={...} />
</BentoPod>
```

### Pattern 7: FactorTable Aura row styling

Current row hover: `hover:bg-neutral-50/50`. Aura: `hover:bg-aura-glass-white/40`. Table header labels: `text-neutral-500 font-medium` → add `.text-label` class (uppercase, 11px, 0.05em tracking) for Aura label scale.

```tsx
// thead th:
<th className="pb-2 text-left text-label text-neutral-500">Factor</th>

// tbody tr:
<tr className="hover:bg-aura-glass-white/40 transition-colors">
```

### Pattern 8: Save button → command variant

`ScoreSection` save button is already `bg-aura-obsidian` custom — good. Can optionally migrate to `Button variant="command" size="lg" className="rounded-full h-12 px-8"` to use the existing primitive. Either approach is fine.

Account/Password forms use `<Button variant="primary">` (amber). For authoritative save actions in settings, the convention is:
- **Profile/preferences saves**: `variant="primary"` (amber) is acceptable — lower authority
- **Score rescore (irreversible operation)**: `variant="command"` (obsidian) — already implemented correctly

### Anti-Patterns to Avoid

- **Adding backdrop-blur to BentoPod**: BentoPod is explicitly NO blur (locked decision from STATE.md). Only GlassPanel / page-level containers get blur.
- **Changing form logic**: All `useForm`, `zodResolver`, hooks, and API calls remain 100% unchanged.
- **Dark mode variants**: Drop entirely — no `dark:` prefixes anywhere.
- **Removing the SettingsTabNav**: It already works correctly with Aura tokens.
- **Using `border-t` dividers between BentoPod sections**: BentoPod cards provide visual separation; raw dividers inside cards conflict with the glass aesthetic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toggle switch styling | Custom CSS toggle | Reuse existing pattern in NotificationsSection | Already correct Aura-green, just needs BentoPod wrapper |
| Card selection (map style) | Custom selected state | BentoPod interactive + `ring-1 ring-aura-amber` | Matches PresetCards pattern already in use |
| Tab navigation animation | Framer Motion layoutId | Current `bg-aura-obsidian` pill toggle | SettingsTabNav already works; animation is optional improvement |
| Section headers | New component | Inline `flex items-center gap-2` with lucide icon + `text-aura-amber` | All sections already have this pattern |

## Common Pitfalls

### Pitfall 1: BentoPod inside BentoPod without visual hierarchy

**What goes wrong:** Nesting `BentoPod` inside `BentoPod` without varying opacity creates a flat look where hierarchy is unclear.
**Why it happens:** ScoreSection has many sub-sections that could all become equal-weight pods.
**How to avoid:** Use `BentoPod size="spacious"` for outer containers at section level. Inner groupings (like the preset cards grid itself) keep their native styling — `PresetCards` already renders its own bordered buttons, don't wrap those in an additional pod.
**Warning signs:** If you see bg-white/40 inside bg-white/40, the inner one should be removed or reduced.

### Pitfall 2: Removing the `max-w-2xl` / `max-w-3xl` content constraint

**What goes wrong:** Settings content stretches too wide on large screens, making form fields uncomfortably wide.
**Why it happens:** ResultsShell has `max-w-5xl` container, and wrapping sections in BentoPod might tempt removing the inner max-width.
**How to avoid:** Keep `max-w-2xl` on Account/Password/Notifications/Appearance. Keep `max-w-3xl` on Score page. These are in the route files, not section components.

### Pitfall 3: Score section `border-t` dividers between BentoPod blocks

**What goes wrong:** `border-t border-neutral-200` raw dividers between pods create visual noise.
**Why it happens:** Current ScoreSection has `<div className="border-t border-neutral-200" />` between sub-blocks.
**How to avoid:** Replace with `space-y-4` gap between BentoPod blocks. The pods' own borders provide separation.

### Pitfall 4: `Button variant="primary"` on authoritative command actions

**What goes wrong:** Amber primary buttons on destructive/irreversible actions (like score recalculation) feel lower-authority than intended.
**Why it happens:** AccountSection uses `variant="primary"` — fine for profile. Score save already uses obsidian — correct. Don't accidentally flip these.
**How to avoid:** Score save stays obsidian (`command` variant or custom). Account/Password saves stay amber (`primary`).

### Pitfall 5: TypeScript errors from className on BentoPod

**What goes wrong:** Adding `className` to BentoPod that conflicts with CVA defaults (e.g., second `rounded-` class).
**Why it happens:** CVA merges classes but Tailwind can produce conflicting rounded values.
**How to avoid:** Use `cn()` properly — CVA already passes `className` through via `cn(bentoPodVariants(...), className)`. Avoid overriding `rounded-2xl` unless intentional.

## Code Examples

### Verified: Aura BentoPod usage pattern

```tsx
// Source: frontend/src/components/primitives/BentoPod.tsx
// bg-aura-glass-white/40 border border-white/40 rounded-2xl shadow-sm
<BentoPod size="spacious" className="space-y-4">
  {/* section content */}
</BentoPod>
```

### Verified: Glass header bar (resultaten.tsx pattern)

```tsx
// Source: frontend/src/routes/_authenticated/resultaten.tsx line 120
<div className="rounded-2xl border border-neutral-200 bg-aura-glass-white/60 px-4 py-4 sm:px-5">
  <h1 className="text-lg font-semibold text-aura-ink">...</h1>
</div>
```

### Verified: Aura token list from index.css

```css
--color-aura-canvas: #F2F6F3;
--color-aura-glass-white: #ffffff;      /* use with /60, /40, /25 modifiers */
--color-aura-obsidian: #0E1111;
--color-aura-ink: #1A1C1E;
--color-aura-amber: #F9A826;
--color-aura-mint: #D1E2D8;
--color-aura-green: #22C55E;
```

### Verified: SettingsTabNav current state

```tsx
// Active tab: bg-aura-obsidian text-white — CORRECT per spec
// Container: bg-neutral-100 — should be bg-aura-glass-white/40 border border-white/40
// Location: frontend/src/components/settings/SettingsTabNav.tsx
```

## Current State Audit

### What's already Aura-correct (no changes needed)

| Element | Status |
|---------|--------|
| `Input` primitive | Aura-styled (`bg-aura-canvas`, focus `ring-aura-green`) |
| `Button variant="primary"` | Amber — correct |
| `Button variant="command"` | Obsidian — correct |
| Section header text `text-aura-ink` | Already using Aura tokens |
| SettingsTabNav active pill | `bg-aura-obsidian text-white` — correct |
| ScoreSection save button | `bg-aura-obsidian rounded-full` — correct |
| PresetCards amber border | `border-aura-amber ring-aura-amber` — correct |
| BalanceSlider amber gradient | Inline `#F9A826` fill — correct |
| FactorTable amber checkbox | `accent-aura-amber` — correct |
| ResultsShell container | `bg-aura-canvas rounded-[40px]` — correct |
| NotificationsSection toggle | `bg-aura-green` when active — correct |

### What needs Aura treatment (the work)

| Element | Current | Target |
|---------|---------|--------|
| Section containers | Raw `<section>` | `<BentoPod size="spacious">` |
| Page header | Plain `div mb-8` | Glass header bar `bg-aura-glass-white/60` |
| SettingsTabNav container | `bg-neutral-100` | `bg-aura-glass-white/40 border border-white/40` |
| Section dividers | `border-t border-neutral-200` | Remove (BentoPod spacing) |
| Section icons | `text-neutral-600` | `text-aura-amber` |
| ScoreSection sub-dividers | `border-t border-neutral-200` | Remove (BentoPod pods) |
| ScoreSection sub-blocks | Plain `<div>` | `<BentoPod size="spacious">` |
| AppearanceSection style buttons | `border-neutral-200 rounded-lg` | `BentoPod interactive` |
| FactorTable header | `text-neutral-500 font-medium` | Add `.text-label` class |
| FactorTable row hover | `hover:bg-neutral-50/50` | `hover:bg-aura-glass-white/40` |
| ScoreSection impact stats card | `bg-[#F2F6F3] rounded-2xl` | `BentoPod` (already Morning Mist bg — minimal change) |

## Open Questions

1. **RPT-01 scope in Phase 97**
   - What we know: REQUIREMENTS.md traceability table places `RPT-01` (report detail page Aura reskin) at Phase 97 alongside SET-01
   - What's unclear: The phase description says "Settings page Aura styling" — no mention of reports. RPT-01 would be a separate route (`/rapport/:id`) with different components
   - Recommendation: Planner should split into two plans if RPT-01 is in scope: Plan 97-01 (Settings reskin) and Plan 97-02 (Report detail reskin). Or confirm RPT-01 is deferred to its own phase.

2. **FactorTable select dropdown styling**
   - What we know: Native `<select>` with `border-neutral-200 rounded` — functional but not Aura
   - What's unclear: Whether to replace with custom Select primitive or style native element
   - Recommendation: Use existing `Select` primitive at `@/components/primitives/Select.tsx` if it's Aura-styled; otherwise keep native select with `focus:border-aura-amber` (already has this).

## Sources

### Primary (HIGH confidence)

- Direct file reads of all 9 settings components — current state verified
- `frontend/src/styles/index.css` — Aura token definitions
- `frontend/src/components/primitives/BentoPod.tsx` — BentoPod API
- `frontend/src/components/primitives/GlassPanel.tsx` — GlassPanel API
- `frontend/src/components/primitives/Button.tsx` — Button variants
- `frontend/src/components/layout/ResultsShell.tsx` — Page container pattern
- `frontend/src/routes/_authenticated/resultaten.tsx` — Glass header bar reference
- `.planning/REQUIREMENTS.md` — SET-01 requirement definition
- `.planning/STATE.md` — Locked design decisions

### Secondary (MEDIUM confidence)

- MEMORY.md Aura design decisions — consistent with code observations

## Metadata

**Confidence breakdown:**
- Current state audit: HIGH — all files read directly
- Aura token names: HIGH — verified from index.css
- Pattern recommendations: HIGH — derived from existing Aura-styled components in codebase
- RPT-01 scope question: LOW — requires planner decision

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable — no external dependencies)
