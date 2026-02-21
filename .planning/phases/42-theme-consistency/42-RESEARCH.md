# Phase 42: Theme Consistency — Research

**Researched:** 2026-02-21
**Domain:** CSS custom properties, Tailwind v4, React theme persistence, Flash of Unstyled Content
**Confidence:** HIGH — findings are based entirely on direct codebase inspection

---

## Summary

Phase 42 is a focused audit-and-fix task. The codebase already has a well-designed theme system in place: Tailwind v4 CSS-first configuration with an `@theme` block in `index.css`, a `ThemeProvider` using `localStorage`, and a semantic grey scale that inverts between modes. The infrastructure is correct; the problems are in specific component-level usage patterns.

Three distinct issue categories exist. First, `text-grey-950` (and `text-grey-900`) on `bg-amber-accent` backgrounds is the most critical: in dark mode `grey-950` is near-black (correct), but in light mode it inverts to near-white — making button labels invisible on the golden accent background. Second, the `useEffect`-based theme class application means there is a Flash of Unstyled Content (FOUC) on page load when the stored theme is `light` — the dark mode renders briefly before React hydrates and the `.light` class is added to `<html>`. Third, a set of Tailwind default-palette classes (`blue-100`, `green-100`, `blue-600`, `green-600`, `red-50`, `red-700`, etc.) appear in UI components, bypassing the semantic token system and producing incorrect visuals in at least one mode.

**Primary recommendation:** Add a `--color-on-accent` CSS token (fixed dark, never inverts), add an inline theme script in `index.html` to eliminate FOUC, then sweep each component file replacing Tailwind default-palette colors with semantic tokens (`info`, `success`, `error` variables already defined).

---

## Current Theme System State

### What Already Works (Do Not Change)

- **Tailwind v4 CSS-first config** (`@import "tailwindcss"` + `@theme { }` block in `index.css`) — confirmed, no `tailwind.config.js` needed. [HIGH confidence — inspected directly]
- **amber-accent as CSS variable utility** — `--color-amber-accent` in `@theme` maps to the `amber-accent` Tailwind utility class. Every existing usage of amber in UI components already uses `amber-accent`, not raw `amber-500`/`amber-400` etc. **THEME-02 is therefore already satisfied at the utility level.** [HIGH confidence — grep over entire src confirms zero `amber-[0-9]` matches]
- **Semantic tokens** (`--color-success`, `--color-error`, `--color-warning`, `--color-info`) defined in `@theme` and correctly overridden in `html.light`. These are used by Badge and Button primitives. [HIGH confidence — inspected `index.css` and primitive components]
- **`--color-overlay` token** (`white` in dark, `black` in light) for subtle glass overlays — already adopted in several components. [HIGH confidence]
- **ThemeProvider + useTheme** in `src/lib/theme/` — `localStorage` key `propdex-theme`, correct `light`/`dark` type, `html.light` class toggling. [HIGH confidence]
- **`grey-` scale** (custom tokens, not Tailwind default `gray-`): 950/900/850/800/700/600/400/300/100 — semantic depth values that invert between modes. [HIGH confidence]

---

## Issues Found

### Issue 1 — CRITICAL: Amber Button Text Invisible in Light Mode

**Root cause:** The grey scale is semantic and inverts between modes. In dark mode, `grey-950 = oklch(0.13)` (near black), so `text-grey-950 bg-amber-accent` gives black text on gold — excellent contrast. In light mode, `grey-950 = oklch(0.99)` (near white), so `text-grey-950 bg-amber-accent` gives near-white text on gold — invisible.

**Affected components (11 occurrences across 9 files):**

| File | Usage |
|------|-------|
| `src/components/primitives/Button.tsx:11` | Primary variant — `bg-amber-accent text-grey-950` |
| `src/components/map/ScanProgressOverlay.tsx:35,80` | Step number badge, action button |
| `src/components/map/LayerToggle.tsx:136` | Active state |
| `src/components/layout/InspectorPanel.tsx:167` | Confirm scan button (`text-grey-900`) |
| `src/components/auth/LoginForm.tsx:80` | Submit button |
| `src/components/auth/RegisterForm.tsx:108` | Submit button |
| `src/components/results/BulkActionBar.tsx:33` | Export button |
| `src/components/results/ParcelDetailModal.tsx:304` | Modal confirm button (`text-grey-900`) |
| `src/routes/_authenticated/map.tsx:905,999` | Inline action buttons |

**Fix strategy:** Add `--color-on-accent: oklch(0.12 0.005 270)` to `@theme` in `index.css`. This value does NOT appear in the `html.light` override block — it remains a fixed dark color in both modes. Replace all `text-grey-950` and `text-grey-900` on amber backgrounds with `text-on-accent`.

The **canonical fix point** is `Button.tsx` primary variant. Fixing it there propagates to all callers of `<Button variant="primary">`. The remaining direct class usages in the 8 other files must be manually updated.

**One additional amber text bug:** `PDFExportModal.tsx:93` uses `bg-amber-accent text-white`. `text-white` is always bright white — also invisible on golden background in light mode. Same fix: replace with `text-on-accent`.

### Issue 2 — FOUC: Theme Class Applied After First Paint

**Root cause:** `ThemeProvider` initializes via `useState(getStoredTheme)` (reads `localStorage` synchronously) but applies the `.light` class only inside a `useEffect`. React's `useEffect` fires after the first paint. The `index.html` has no inline script. Therefore: if user stored `light`, the browser paints in dark mode for ~50–200ms before the class is applied.

**File affected:** `frontend/index.html` — needs an inline `<script>` in `<head>`.

**Fix pattern (industry standard):**
```html
<head>
  <!-- existing meta/link tags -->
  <script>
    (function() {
      try {
        var theme = localStorage.getItem('propdex-theme');
        if (theme === 'light') document.documentElement.classList.add('light');
      } catch (e) {}
    })();
  </script>
</head>
```

This script executes synchronously before the CSS or JavaScript bundle loads, so the correct class is present before the first paint. No React changes needed — the ThemeProvider `useEffect` will fire later and be a no-op (class already set).

**IMPORTANT:** The `ThemeProvider`'s `useState(getStoredTheme)` initial value must still match — it already does because `getStoredTheme()` also reads `localStorage`. The two are consistent.

### Issue 3 — Tailwind Default Palette Colors Bypassing Semantic Tokens

Several components use Tailwind's built-in color palette directly (not CSS custom properties). These don't adapt between modes.

**Confirmed problem instances:**

| Component | Colors Used | Problem |
|-----------|-------------|---------|
| `ChangeTimeline.tsx:305,328` | `bg-blue-100`, `bg-green-100`, `text-blue-600`, `text-green-600` | Light backgrounds (`blue-100`, `green-100`) look jarring in dark mode; `blue-600`/`green-600` have poor contrast on dark backgrounds |
| `ChangeTimeline.tsx:149,195,234` | `bg-blue-500/10`, `text-blue-400`, `text-blue-600` | Inconsistent, uses raw Tailwind values not semantic tokens |
| `auth/LoginForm.tsx:52`, `auth/RegisterForm.tsx:60` | `bg-red-50 text-red-700` | `red-50` = near-white in both modes; in dark mode, white/light pink box on dark bg looks broken |
| `auth/GoogleButton.tsx:53` | `text-red-600` | Raw palette, not `text-error` |
| `ui/FormField.tsx:38,43` | `border-red-500`, `text-red-600` | Should use `border-error`, `text-error` |
| `property/ConfidenceBadge.tsx:13,23` | `bg-green-500/20`, `text-green-100`, `bg-red-500/20`, `text-red-100` | Uses raw Tailwind greens/reds instead of `success`/`error` tokens |
| `property/PropertyDetailPanel.tsx` + `PropertyDetailDrawer.tsx` | `text-green-400`, `text-green-100`, `text-red-400`, `bg-green-500/10`, `bg-blue-500/10`, `text-green-200/70` | Inline color choices bypassing semantic system |
| `property/PropertyQuickCard.tsx:74` | `bg-green-500/10 text-green-200/70` | Non-monument status indicator |
| `property/PropertySummary.tsx:80` | `bg-green-500` | Progress bar fill |
| `reports/PDFExportModal.tsx:125` | `bg-blue-500 hover:bg-blue-600 text-white` | Download button uses raw blue |
| `reports/ReportDetailPage.tsx` | Many `blue-N`, `purple-N`, `emerald-N` instances | Tag/badge coloring, zoning categories |
| `results/ParcelDetailModal.tsx` | `bg-gradient-to-br from-green-500/20`, `text-green-300`, `bg-green-400/60` | Score badge |
| `results/ParcelEnrichmentCard.tsx:74` | `text-blue-400 hover:text-blue-300` | External link color |
| `projects/ProjectList.tsx` | `bg-red-500 text-white` (notification badges), `bg-blue-500/20 text-blue-400` (scan status) | Notification and status indicators |
| `layout/InspectorPanel.tsx:63` | `hover:text-white` | Hover state on dark icon button |

**Scope note:** Map canvas layers (`ParcelScoreLayer`, `WijkBoundariesLayer`, `MonitoredWijkOverlay`, `GemeenteBoundariesLayer`, `ScanAreaHighlightLayer`) use hardcoded hex colors in MapLibre paint expressions — these are intentional and OUT OF SCOPE since MapLibre doesn't support CSS variables in paint specs.

**Fix strategy:** Replace raw palette classes with semantic tokens:
- `green-*` in success/positive contexts → `success` + opacity modifier (e.g., `bg-success/15 text-success`)
- `red-*` in error/negative contexts → `error` + opacity modifier
- `blue-*` in informational contexts → `info` + opacity modifier
- `blue-100`/`green-100` icon circle backgrounds → `info/10` or `success/10` with `text-info`/`text-success`
- Where no exact semantic token fits (e.g., `purple-*` for zoning categories, `blue-*` for external links) → document these as acceptable uses, or add new tokens if warranted

**Grey-200 usage note:** `grey-200` appears in several components (`text-grey-200`, `border-grey-200`) but is NOT defined in `@theme`. In Tailwind v4, undefined color tokens produce no CSS output — the class compiles but has no effect. These should be replaced with `grey-300` (next defined step). Likewise `grey-500` (undefined, falls between `grey-600` and `grey-400`) should be replaced.

---

## Standard Stack

No new libraries needed. Phase 42 is a pure CSS/markup refactor.

| Tool | Version | Purpose |
|------|---------|---------|
| Tailwind CSS | ^4.1.18 | CSS-first, `@theme` block for design tokens |
| `@tailwindcss/vite` | ^4.1.18 | Vite plugin, no config file required |
| `class-variance-authority` | ^0.7.1 | CVA for primitive variants (Button, Badge) |

---

## Architecture Patterns

### Pattern 1: CSS Variable as Tailwind Utility

In Tailwind v4, every variable declared in `@theme { --color-X: value }` becomes the utility `bg-X`, `text-X`, `border-X`, `ring-X`, `fill-X`, `stroke-X`, `accent-X` automatically. No `safelist` or `extend` required.

```css
/* index.css @theme block */
--color-amber-accent: oklch(0.78 0.15 85.87);
--color-on-accent: oklch(0.12 0.005 270);   /* NEW: fixed dark for text on amber/teal */
```

```tsx
/* Usage — works in both modes */
<button className="bg-amber-accent text-on-accent hover:bg-amber-accent-hover">
```

The `html.light` override block should NOT include `--color-on-accent` since it must stay dark in both themes.

### Pattern 2: Semantic Token for State Colors

The `success`/`error`/`warning`/`info` tokens are already defined and already inverted in `html.light`. Use them with opacity modifiers for backgrounds:

```tsx
/* Replace: bg-green-500/20 text-green-100 border-green-500/40 */
/* With:    bg-success/15   text-success    border border-success/25 */
<div className="bg-success/15 text-success border border-success/25 rounded px-2 py-0.5">
  Geen monument
</div>
```

### Pattern 3: FOUC Prevention via Inline Script

The script must be in `<head>` BEFORE any stylesheets or deferred scripts to execute synchronously:

```html
<head>
  <meta charset="UTF-8" />
  <script>
    (function() {
      try {
        if (localStorage.getItem('propdex-theme') === 'light') {
          document.documentElement.classList.add('light');
        }
      } catch (e) {}
    })();
  </script>
  <!-- fonts, favicon, etc. -->
</head>
```

The `try/catch` handles `localStorage` being unavailable (private browsing, storage quota exceeded, etc.).

### Pattern 4: Fixed Dark Token for Accent Text

When text sits on a colored background that does NOT invert (amber-accent stays golden in both modes), the text color must also NOT invert. Use a token NOT listed in the `html.light` override:

```css
@theme {
  --color-on-accent: oklch(0.12 0.005 270);   /* near-black, same in both modes */
}

/* html.light block — do NOT include --color-on-accent override */
```

This is the same principle as design systems using `on-primary` tokens.

### Anti-Patterns to Avoid

- **Using `text-grey-950` on accent color backgrounds:** `grey-950` inverts to near-white in light mode → invisible text.
- **Using Tailwind default palette directly:** `blue-100`, `green-600`, `red-50` etc. don't adapt to the theme's grey scale or semantics.
- **Using `grey-200` or `grey-500`:** Not defined in `@theme`, produces no CSS in Tailwind v4. Use `grey-300` or `grey-400`.
- **Relying on useEffect for initial theme application:** FOUC risk. Always sync class in `<head>` script.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Success/error/info colors | Custom per-component color choices | `success`/`error`/`info` semantic tokens already in `@theme` |
| Dark/light toggle | Custom className toggling logic | ThemeContext already handles it correctly |
| Accent text contrast | Per-component `html.light:` selector | Single `--color-on-accent` token in `@theme` |

---

## Common Pitfalls

### Pitfall 1: Fixing Button Primitive But Missing Inline Copies

**What goes wrong:** `Button.tsx` primary variant is fixed, but 8 other files have inline `bg-amber-accent text-grey-950` strings not using the Button component. Tests pass (they don't test visual contrast), visual review misses them.

**How to avoid:** After fixing `Button.tsx`, run `grep -rn "text-grey-950" src/` and `grep -rn "text-grey-900" src/` and fix each match that appears alongside `bg-amber-accent`.

### Pitfall 2: The html.light Script Race Condition

**What goes wrong:** Script placed AFTER `<script type="module">` or inside body — the main React bundle may execute first, causing a race.

**How to avoid:** Place the inline script as the FIRST element inside `<head>`, before all link/script tags.

### Pitfall 3: Over-Scoping to Map Layers

**What goes wrong:** Developer sees `ParcelScoreLayer.tsx` using `#dc2626` (hardcoded hex) and spends time trying to apply CSS variables. MapLibre GL uses its own rendering context and does not observe CSS variables.

**How to avoid:** Scope the audit to UI components only. Map paint expressions are intentionally hardcoded and should be skipped.

### Pitfall 4: grey-200 / grey-500 Not Defined

**What goes wrong:** Using `text-grey-200` compiles without error but produces no CSS output in Tailwind v4. The text inherits color from parent instead of being muted.

**How to avoid:** Only use grey values defined in `@theme`: 950, 900, 850, 800, 700, 600, 400, 300, 100. Replace `grey-200` → `grey-300`, `grey-500` → `grey-600` or `grey-400`.

### Pitfall 5: Semantic Green Not Always Right

**What goes wrong:** Replacing all `green-*` with `success` even in contexts where green is decorative (e.g., a map legend color). `success` carries semantic meaning (positive state). Using it decoratively pollutes the signal.

**How to avoid:** Only replace `green-*` in contexts that genuinely signal success/positive state. For decorative or data-categorical use, `teal-accent` is a better choice.

---

## Code Examples

### New CSS Token (index.css)

```css
/* In @theme block, after amber-accent-hover */
--color-on-accent: oklch(0.12 0.005 270);
```

Do NOT add to `html.light` block — it must stay dark in both modes.

### Button.tsx Fix

```tsx
/* Before */
primary: 'bg-amber-accent text-grey-950 hover:bg-amber-accent-hover focus-visible:ring-amber-accent',

/* After */
primary: 'bg-amber-accent text-on-accent hover:bg-amber-accent-hover focus-visible:ring-amber-accent',
```

### ChangeTimeline Icon Circle Fix

```tsx
/* Before */
<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
  <svg className="text-blue-600">...</svg>
</div>

/* After */
<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10">
  <svg className="text-info">...</svg>
</div>
```

### Auth Error Box Fix

```tsx
/* Before */
<div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>

/* After */
<div className="rounded-lg bg-error/10 border border-error/20 p-3 text-sm text-error">{error}</div>
```

### FOUC Prevention (index.html)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <script>
      (function() {
        try {
          if (localStorage.getItem('propdex-theme') === 'light') {
            document.documentElement.classList.add('light');
          }
        } catch (e) {}
      })();
    </script>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <!-- ... rest of head ... -->
  </head>
```

---

## Scope Decisions for Plan 42-01

The plan covers THREE deliverables:

**Deliverable A — Critical contrast fix (THEME-01 blocker):**
- Add `--color-on-accent` to `@theme` in `index.css`
- Fix `Button.tsx` primary variant
- Fix 8 files with direct `bg-amber-accent text-grey-950/900` inline strings
- Fix `PDFExportModal.tsx` `text-white` on amber

**Deliverable B — FOUC fix (THEME-03):**
- Add inline script in `index.html` `<head>` before all other tags

**Deliverable C — Semantic token sweep (THEME-01 completion):**
- `ChangeTimeline.tsx`: `bg-blue-100`/`bg-green-100`/`text-blue-600`/`text-green-600` → `info`/`success` tokens
- `auth/LoginForm.tsx`, `auth/RegisterForm.tsx`: `bg-red-50 text-red-700` → `bg-error/10 border-error/20 text-error`
- `auth/GoogleButton.tsx`: `text-red-600` → `text-error`
- `ui/FormField.tsx`: `border-red-500`, `text-red-600` → `border-error`, `text-error`
- `property/ConfidenceBadge.tsx`: green/red raw → success/error tokens
- `property/PropertyDetailPanel.tsx` + `PropertyDetailDrawer.tsx`: green-400/green-100 → success, red-400 → error, blue-500 → info
- `property/PropertyQuickCard.tsx`: green-500/10 → success/10 or teal-accent/10
- `property/PropertySummary.tsx:80`: `bg-green-500` progress bar → `bg-success`
- `reports/PDFExportModal.tsx:125`: `bg-blue-500 text-white` download button → `bg-info text-on-accent` or `variant="secondary"` Button
- `results/ParcelDetailModal.tsx`: green gradient score badge → success tokens
- `results/ParcelEnrichmentCard.tsx:74`: `text-blue-400 hover:text-blue-300` → `text-info hover:text-info/80`
- `projects/ProjectList.tsx`: `bg-red-500 text-white` notification badges → `bg-error text-white` (already correct semantic), status pills → info/error
- `layout/InspectorPanel.tsx:63`: `hover:text-white` → `hover:text-grey-100`
- `reports/ReportDetailPage.tsx`: scoped sweep of blue-N/purple-N/emerald-N inline classes
- `grey-200`/`grey-500` usages → `grey-300`/`grey-400` or `grey-600`

**Out of scope for Phase 42:**
- Map layer paint expressions (MapLibre, SVBP2012 legend, etc.)
- `ProjectEditModal` and `ProjectCreateModal` (intentionally light-themed — documented prior decision)
- `notification badges on red-500` — red/white is intentional for notification count badges (already works in both modes since `red-500` doesn't invert), but should verify

---

## Open Questions

1. **grey-200 undefined values:** Files use `text-grey-200` which has no CSS definition. Is there a desired value for this gap in the scale? The closest defined values are `grey-100` (primary text, 0.95 lightness) and `grey-300` (0.75). A `grey-200` at ~0.85 would be a natural secondary text. Recommendation: either add `--color-grey-200` to `@theme`, or replace all `grey-200` usages with `grey-300`.
   - What we know: `grey-200` appears in ~10 locations, all as slightly muted text
   - Recommendation: add `--color-grey-200: oklch(0.85 0.005 270)` (dark) and `oklch(0.25 0.008 270)` (light), OR replace with `grey-300`

2. **`accent-amber-accent` on checkboxes:** `ResultsTable.tsx:186,195` uses `accent-amber-accent` for checkbox tint. The `accent` CSS property uses the computed color. This SHOULD work correctly since `amber-accent` is a CSS variable that updates on theme change. Confirmed as non-issue.

3. **teal-accent on `text-white` in Button secondary:** `Button.tsx` secondary variant uses `bg-teal-accent text-white`. Teal accent is a medium-lightness oklch color (~0.59 in dark, ~0.48 in light). White text on teal: contrast depends on the mode. In dark mode at 0.59 lightness, white text is borderline. Recommend also using `text-on-accent` here if contrast fails WCAG AA. Out of scope for this phase — teal secondary buttons are rare; flag for monitoring.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `/frontend/src/styles/index.css` — confirmed `@theme` block, grey scale values, `html.light` overrides
- Direct inspection of `/frontend/src/lib/theme/ThemeContext.tsx` — confirmed `useState + useEffect` pattern, FOUC vulnerability
- Direct inspection of `/frontend/index.html` — confirmed no inline theme script
- `grep -rn "amber-[0-9]"` over entire `src/` — confirmed zero raw amber-N classes
- `grep -rn "text-grey-950.*bg-amber-accent"` — confirmed 9 critical contrast failures
- Direct inspection of `Button.tsx`, `Badge.tsx` — confirmed primitive patterns

### Secondary (MEDIUM confidence)

- FOUC inline script pattern — established web standard practice, no library needed
- Tailwind v4 `@theme` CSS variable mapping — confirmed by presence of `tailwindcss: ^4.1.18` and `@tailwindcss/vite: ^4.1.18` in `package.json`, and CSS-first setup in `vite.config.ts`

---

## Metadata

**Confidence breakdown:**
- Issue identification: HIGH — all issues found via direct code inspection, no inference
- Fix patterns: HIGH — patterns match existing working patterns in the same codebase
- Scope boundaries: HIGH — map layers explicitly excluded, prior decisions documented

**Research date:** 2026-02-21
**Valid until:** No expiry — findings are based on static code, not external APIs
