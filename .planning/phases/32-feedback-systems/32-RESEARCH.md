# Phase 32: Feedback Systems — Research

**Researched:** 2026-02-18
**Domain:** React UI feedback patterns — loading states, error states, empty states, toast notifications, progress indicators
**Confidence:** HIGH

---

## Summary

Phase 32 implements comprehensive user feedback across all states in the Propdex frontend. The work is primarily **additive and low-risk**: the design system (Industrial Amber, Tailwind 4, CSS variables) is stable after Phase 31, sonner is already installed and configured, and Tailwind's `animate-pulse` pattern is already in use for skeleton screens in several components. The goal is to standardize and extend these patterns consistently, not to introduce new libraries.

The scan pipeline already has a `ScanProgressOverlay` component and `ScanStatusResponse` with `current_phase`, `progress_pct`, `parcels_processed`, and `parcels_total` fields — all the data needed for FB-05 (step-based progress) and FB-06 (real-time progress messages) is already available in the backend response schema. The component just needs to be redesigned to match Industrial Amber tokens and enriched with a step stepper UI.

The biggest architectural insight is that most feedback work is **component-level refinement**, not feature work. Each requirement maps to upgrading or creating small, focused components using patterns already established in the codebase.

**Primary recommendation:** Build a shared `feedback/` primitives folder with `Skeleton`, `EmptyState`, `ErrorState`, `ProgressStepper`, and `Toast` helpers. Refactor existing ad-hoc inline feedback to use these primitives. No new dependencies needed.

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sonner` | 2.0.7 | Toast notifications | Already configured in `main.tsx` with dark glassmorphism theme |
| `tailwindcss` | 4.1.18 | Skeleton animations via `animate-pulse` | Already used for skeletons in ResultsTable, PropertyDetailPanel, PropertyQuickCard |
| `lucide-react` | 0.564.0 | Icons for empty/error state iconography | Already used in map.tsx |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` | 0.7.1 | CVA variants for Skeleton sizing | When Skeleton needs sm/md/lg variants |
| `clsx` + `tailwind-merge` | — | Conditional class composition | All feedback component internals |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Skeleton div | `react-loading-skeleton` | Not needed — `animate-pulse` on grey div is already the pattern, adding a library adds bundle weight and API surface |
| Custom progress bar | `rc-progress` or `nprogress` | Not needed — existing `ScanProgressOverlay` has a working animated progress bar using pure Tailwind |
| `sonner` | `react-hot-toast` or `@radix-ui/toast` | Sonner is already installed, configured, and in use across 8 files. Do NOT replace. |

**Installation:** No new packages needed. All required libraries already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── components/
│   └── feedback/                   # NEW: shared feedback primitives
│       ├── Skeleton.tsx             # FB-01: reusable skeleton block
│       ├── EmptyState.tsx           # FB-02: configurable empty state
│       ├── ErrorState.tsx           # FB-03: configurable error state with actions
│       └── ProgressStepper.tsx      # FB-05: multi-step scan progress stepper
├── components/map/
│   └── ScanProgressOverlay.tsx      # FB-05 + FB-06: refactor to use new primitives + Industrial Amber
├── components/results/
│   └── ResultsTable.tsx             # FB-01: upgrade skeleton to use Skeleton primitive
├── components/reports/
│   └── EmptyState.tsx               # FB-02: refactor to use EmptyState primitive
└── components/projects/
    └── ProjectList.tsx              # FB-01 + FB-02: upgrade loading/empty states
```

### Pattern 1: Skeleton Screens with `animate-pulse`

**What:** Grey placeholder blocks that match the shape of the content they replace. Use `animate-pulse` Tailwind class.
**When to use:** Any component that fetches async data (`isLoading: true` from TanStack Query).

The pattern is already established in the codebase. The goal is to extract it into a reusable `Skeleton` primitive:

```typescript
// src/components/feedback/Skeleton.tsx
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded bg-grey-800', className)}
    />
  )
}
```

Usage pattern (already in `PropertyDetailPanel.tsx` — extract and standardize):
```typescript
// Loading state — skeleton matches content shape
function LoadingState() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </div>
  )
}
```

### Pattern 2: Configurable Empty State

**What:** Context-aware empty states with icon, heading, body copy, and optional CTA button.
**When to use:** When a list/table/panel has zero items and the user needs guidance on what to do next.

```typescript
// src/components/feedback/EmptyState.tsx
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 px-6 text-center', className)}>
      {icon && <div className="text-grey-600">{icon}</div>}
      <p className="text-sm font-medium text-grey-400">{title}</p>
      {description && <p className="text-xs text-grey-600">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 px-4 py-2 text-xs font-medium rounded-md bg-amber-accent text-grey-950 hover:bg-amber-accent-hover transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

### Pattern 3: Error State with Recovery Actions

**What:** Error state with icon, message, and one or more recovery action buttons.
**When to use:** When an API call fails and the user can take corrective action.

```typescript
// src/components/feedback/ErrorState.tsx
interface ErrorStateProps {
  message?: string
  actions?: Array<{ label: string; onClick: () => void; variant?: 'primary' | 'ghost' }>
  className?: string
}

export function ErrorState({ message, actions, className }: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 px-6 text-center', className)}>
      {/* Error icon */}
      <svg className="w-8 h-8 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-sm text-grey-400">{message ?? 'Er is iets misgegaan.'}</p>
      {actions && actions.length > 0 && (
        <div className="flex gap-2 mt-1">
          {actions.map((action) => (
            <button key={action.label} onClick={action.onClick}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-accent text-grey-950 hover:bg-amber-accent-hover transition-colors">
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

### Pattern 4: Step-Based Progress Stepper (FB-05)

**What:** A horizontal or vertical stepper showing scan pipeline phases: Kadaster fetch → BAG cross-reference → Bestemmingen query.
**When to use:** During active scan in `ScanProgressOverlay`.

The scan API already provides `current_phase` with three values: `fetching_parcels`, `cross_referencing_bag`, `querying_bestemmingen`. These map directly to three steps.

```typescript
// src/components/feedback/ProgressStepper.tsx
interface Step {
  id: string
  label: string
  sublabel?: string
}

type StepState = 'pending' | 'active' | 'completed'

interface ProgressStepperProps {
  steps: Step[]
  currentStepId: string | null
  completedStepIds: string[]
}
```

### Pattern 5: Toast Notifications with sonner

**What:** Use `toast.success()`, `toast.error()`, `toast.info()` from `sonner`.
**When to use:** After any user-triggered mutation completes (save, filter apply, scan start, project create/delete).

The `Toaster` is already configured in `main.tsx` with Industrial Amber glassmorphism styling. The pattern is already in use in 8+ files. Phase 32 task is to ensure coverage — audit which mutations lack toast feedback and add it.

```typescript
// Source: existing pattern in map.tsx, ProjectList.tsx, SaveReportFlow.tsx
import { toast } from 'sonner'

// Success
toast.success('Project opgeslagen')

// Error
toast.error('Scan mislukt. Probeer opnieuw.')

// Info (for non-critical confirmations)
toast.info('Filters toegepast')
```

### Anti-Patterns to Avoid

- **Blank white/grey screens on load:** Never render an empty container while `isLoading`. Always show skeleton or spinner.
- **Generic error messages:** Never use "Error" or "Something went wrong" — always provide Dutch context-specific text and at least one recovery action.
- **Empty string for empty states:** Never render `null` or a blank element when a list is empty — always render an `EmptyState` with guidance.
- **Using `window.confirm` for destructive actions:** ProjectList.tsx uses `window.confirm` — but that is outside Phase 32 scope (no change needed here).
- **Hardcoded colors in feedback components:** Always use `text-error`, `text-amber-accent`, `bg-grey-800` CSS variable tokens — never `text-red-500` etc. (some existing components still use hardcoded colors; fix during migration).
- **Custom toast implementations:** Sonner is already configured. Never create a custom toast/snackbar system.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated progress bar | Custom canvas/SVG animation | CSS `transition-all duration-500` on a `width` style | The existing `ScanProgressOverlay` already does this correctly |
| Skeleton loader component | Import a skeleton library | `<div className="animate-pulse rounded bg-grey-800">` wrapped in `Skeleton` primitive | Tailwind's `animate-pulse` is sufficient; no added library needed |
| Toast system | Custom portal + state machine | `sonner` (already installed) | Handles queueing, stacking, persistence, dark mode |
| Spinner animation | Custom CSS keyframes | `animate-spin` Tailwind utility + border trick | Already in use throughout codebase |

**Key insight:** This entire phase is achievable without any new npm dependencies. The design system and infrastructure are already in place — the work is standardization and gap-filling.

---

## Common Pitfalls

### Pitfall 1: Skeleton Flicker on Fast Loads
**What goes wrong:** Skeleton appears briefly and flashes off, creating visual jitter worse than no skeleton.
**Why it happens:** Network is fast (localhost) or React suspense boundary resolves quickly.
**How to avoid:** Add a minimum display time OR (simpler) just accept the flicker — production network latency makes skeletons meaningful. Do not add artificial delays.
**Warning signs:** Not a production concern — test on real API with real latency.

### Pitfall 2: ScanProgressOverlay Token Violations
**What goes wrong:** `ScanProgressOverlay` was not migrated in Phase 31 — it still uses hardcoded `bg-white`, `text-blue-500`, `text-green-500`, `text-red-500`, `bg-gray-200` (glassmorphism-era colors).
**Why it happens:** The component was excluded from Phase 31's migration scope.
**How to avoid:** Replace all hardcoded colors with Industrial Amber tokens in Phase 32 as part of FB-05/FB-06 refactor.
**Warning signs:** `bg-white`, `text-gray-*`, `bg-gray-*`, `text-blue-*`, `text-green-*` in ScanProgressOverlay.tsx.

### Pitfall 3: Missing `Toaster` Context
**What goes wrong:** `toast.success()` calls do nothing because `<Toaster>` isn't mounted.
**Why it happens:** New page/route doesn't have Toaster in scope.
**How to avoid:** Toaster is already in `main.tsx` at root level — it covers all routes. This is not a risk.
**Warning signs:** N/A — already handled.

### Pitfall 4: Empty State vs. Loading State Confusion
**What goes wrong:** Component shows EmptyState while data is still loading, creating a flash of "no data" before content appears.
**Why it happens:** Wrong condition ordering: checking `data.length === 0` before checking `isLoading`.
**How to avoid:** Always check states in order: `if (isLoading) return <Skeleton />` → `if (error) return <ErrorState />` → `if (data.length === 0) return <EmptyState />` → render data.
**Warning signs:** `ResultsTable` already does this correctly — use it as the reference.

### Pitfall 5: Toast Duplication on Re-Render
**What goes wrong:** `useEffect` watching `scanStatus.data` fires multiple times, showing duplicate "Scan voltooid" toasts.
**Why it happens:** TanStack Query refetches can re-deliver the same status data.
**How to avoid:** Use a `useRef` to track whether a terminal-state toast has been shown for a given scan ID. Already partially handled in `map.tsx` by the `setActiveScanId(null)` guard — ensure it's robust in the refactored version.
**Warning signs:** Multiple identical toasts appearing in quick succession.

### Pitfall 6: ProgressStepper Phase Mapping
**What goes wrong:** Scan reports `current_phase: null` initially (before ARQ job starts) or during transition between phases, causing stepper to show no active step.
**Why it happens:** Backend sets `current_phase` only after work begins. `null` is valid for "scan is queued/pending."
**How to avoid:** Map `null` to "Scan starten..." as a pre-step-0 state. The `phaseLabel()` function in `ScanProgressOverlay` already handles this with a `default` case.
**Warning signs:** Stepper showing blank/broken state when `current_phase === null`.

---

## Code Examples

Verified patterns from existing codebase:

### Skeleton Pattern (from PropertyDetailPanel.tsx)
```typescript
// Source: frontend/src/components/property/PropertyDetailPanel.tsx:126-148
function LoadingState() {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <div className="h-5 bg-grey-800 animate-pulse rounded w-3/4" />
        <div className="h-4 bg-grey-800 animate-pulse rounded w-1/2" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="h-16 bg-grey-800 animate-pulse rounded-lg" />
        <div className="h-16 bg-grey-800 animate-pulse rounded-lg" />
        <div className="h-16 bg-grey-800 animate-pulse rounded-lg" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-grey-800 animate-pulse rounded" />
      ))}
    </div>
  )
}
```

### Table Row Skeleton (from ResultsTable.tsx)
```typescript
// Source: frontend/src/components/results/ResultsTable.tsx:188-200
if (isLoading) {
  return (
    <div className="h-full w-full p-6">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-grey-800 rounded animate-pulse" />
        ))}
      </div>
    </div>
  )
}
```

### Error State with Recovery (from ResultsTable.tsx — needs upgrade)
```typescript
// Source: frontend/src/components/results/ResultsTable.tsx:176-185
// CURRENT — no recovery action:
if (error) {
  return (
    <div className="h-full w-full flex items-center justify-center text-grey-400">
      <div className="text-center">
        <p className="text-lg mb-2">Fout bij laden van resultaten</p>
        <p className="text-sm">{error.message}</p>
      </div>
    </div>
  )
}
// PHASE 32: Add retry action button
```

### Toast Usage (from map.tsx)
```typescript
// Source: frontend/src/routes/_authenticated/map.tsx:249-256
if (scanStatus.data.status === 'completed') {
  toast.success(`Scan voltooid: ${scanStatus.data.results_count} percelen gevonden`)
} else if (scanStatus.data.status === 'failed') {
  toast.error('Scan mislukt')
}
```

### Scan Phase Labels (from ScanProgressOverlay.tsx)
```typescript
// Source: frontend/src/components/map/ScanProgressOverlay.tsx:12-23
// Three phases map to three stepper steps:
const SCAN_STEPS = [
  { id: 'fetching_parcels',        label: 'Kadaster ophalen',     sublabel: 'Percelen van Kadaster WFS' },
  { id: 'cross_referencing_bag',   label: 'BAG controleren',      sublabel: 'Gebouwen cross-refereren' },
  { id: 'querying_bestemmingen',   label: 'Bestemmingen',         sublabel: 'DSO API opvragen' },
]
```

### Toaster Config (from main.tsx)
```typescript
// Source: frontend/src/main.tsx:59-70
<Toaster
  position="bottom-right"
  theme="dark"
  toastOptions={{
    style: {
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.15)',
      color: 'white',
    },
  }}
/>
```

---

## Current State Audit

This is critical for planning: what already exists vs. what needs to be built or upgraded.

### FB-01: Loading Spinners and Skeleton Screens

| Component | Current State | Phase 32 Action |
|-----------|--------------|-----------------|
| `PropertyDetailPanel` | Has `LoadingState()` with proper skeletons | Extract to `Skeleton` primitive — LOW priority |
| `ResultsTable` | Has row skeletons with `animate-pulse` | Extract to `Skeleton` primitive — LOW priority |
| `PropertyQuickCard` | Has single line skeleton | Already minimal — fine |
| `ProjectList` | Shows plain `"Laden..."` text | UPGRADE to skeleton rows |
| `ChangeTimeline` | Shows plain `"Wijzigingen laden..."` | UPGRADE to skeleton rows |
| `ReportDetailPage` | Needs investigation | CHECK and fix |
| Route-level loading | No skeleton during initial auth/route load | `AuthLoadingScreen` exists — adequate |

### FB-02: Empty States with Guidance

| Component | Current State | Phase 32 Action |
|-----------|--------------|-----------------|
| `ResultsTable` | Shows `"Geen resultaten gevonden"` — no action | UPGRADE with EmptyState + guidance copy |
| `resultaten.tsx` (no scan_id) | Shows `"Selecteer een scan op de kaart"` | UPGRADE to EmptyState with icon |
| `ProjectList` | Has a decent empty state with CTA button | UPGRADE to use `EmptyState` primitive |
| `ChangeTimeline` | Shows `"Geen wijzigingen gedetecteerd"` | UPGRADE to EmptyState |
| `reports/EmptyState.tsx` | Exists as onboarding guide (3-step) | Refactor to use EmptyState primitive |

### FB-03: Error States with Recovery Actions

| Component | Current State | Phase 32 Action |
|-----------|--------------|-----------------|
| `ResultsTable` | Has error text only — no retry | ADD retry button → `onRetry` callback |
| `PropertyDetailPanel` | Has error icon + message — no retry | ADD retry action |
| `ChangeTimeline` | Shows plain red error text | UPGRADE to ErrorState primitive |
| `PropertyDetailDrawer` | Passes `error` prop — check rendering | CHECK and standardize |

### FB-04: Toast Notifications for Success Confirmations

| Action | Current State | Phase 32 Action |
|--------|--------------|-----------------|
| Scan started | `toast.success()` in map.tsx | Already good |
| Scan completed | `toast.success()` in map.tsx | Already good |
| Scan failed | `toast.error()` in map.tsx | Already good |
| Report saved | `toast.success()` in SaveReportFlow | Already good |
| Project created | Uses `toast.success()` | Already good |
| Project deleted | Uses `toast.success()` | Already good |
| Filters applied | NO TOAST | ADD `toast.info('Filters toegepast')` |
| Project edited | CHECK EditModal | CHECK and add if missing |
| Force refresh | `toast.success()` in map.tsx | Already good |

### FB-05: Step-Based Progress Indicator

| Component | Current State | Phase 32 Action |
|-----------|--------------|-----------------|
| `ScanProgressOverlay` | Linear progress bar + phase text | REDESIGN: add step stepper UI + migrate to Industrial Amber tokens |

### FB-06: Real-Time Scan Progress Details

| Component | Current State | Phase 32 Action |
|-----------|--------------|-----------------|
| `ScanProgressOverlay` | Shows `parcels_processed / parcels_total` | Already has data — ENHANCE display, migrate tokens |

---

## State of the Art

| Old Approach | Current Approach | Status |
|--------------|------------------|--------|
| Custom toast system | `sonner` 2.x | Already in use — no change |
| `react-loading-skeleton` library | `animate-pulse` Tailwind utility | Current standard |
| `nprogress` page-level loader | Route-level + component-level skeletons | Current standard |
| Glassmorphism colors (Phase 30/31 legacy) | Industrial Amber tokens | Phase 31 migrated most; `ScanProgressOverlay` still needs migration |

**Deprecated/outdated in this codebase:**
- `bg-white`, `text-gray-*`, `bg-gray-*` in feedback components: replace with `bg-grey-900`, `text-grey-*`
- `text-blue-500`, `text-green-500` for state indicators: replace with `text-info`, `text-success` CSS variables
- Plain text loading/error/empty messages: replace with structured feedback primitives

---

## Open Questions

1. **Should `ResultsFilterPanel` show a toast when filters are applied?**
   - What we know: The component calls `onChange` callback which triggers a re-query. No toast currently.
   - What's unclear: Is this a meaningful user action that warrants a toast, or is the re-rendered table sufficient feedback?
   - Recommendation: Add `toast.info('Filters toegepast — N percelen')` where N is the new result count. Keep it subtle (`duration: 2000`).

2. **Should the scan `ProgressStepper` be inside `ScanProgressOverlay` or extracted separately?**
   - What we know: `ScanProgressOverlay` is already a dedicated file. The stepper is scan-specific.
   - What's unclear: Whether the stepper concept will be reused elsewhere.
   - Recommendation: Keep stepper inside `ScanProgressOverlay` for now. Extract `ProgressStepper` as a shared primitive only if reuse is confirmed.

3. **How should the `PropertyDetailDrawer` (full-page detail) handle scan errors vs. data-unavailable states?**
   - What we know: It receives `error` prop and passes to `PropertyDetailPanel` internally. The panel has error display.
   - What's unclear: Whether the drawer properly surfaces partial data + partial errors (the backend can return partial data with `errors` array).
   - Recommendation: Investigate `PropertyDetailDrawer.tsx` during planning; ensure it handles `data.errors[]` gracefully (show warning banner, not full error state).

---

## Sources

### Primary (HIGH confidence)
- Codebase audit — direct Read of all relevant TSX files
  - `frontend/src/components/map/ScanProgressOverlay.tsx` — existing progress overlay, token violations
  - `frontend/src/components/property/PropertyDetailPanel.tsx` — skeleton pattern reference
  - `frontend/src/components/results/ResultsTable.tsx` — table skeleton pattern, error/empty state reference
  - `frontend/src/components/projects/ProjectList.tsx` — loading/empty state gaps
  - `frontend/src/components/notifications/ChangeTimeline.tsx` — loading/error/empty state gaps
  - `frontend/src/lib/types/scan.ts` — `ScanStatusResponse` with `current_phase`, `parcels_processed`, `parcels_total`
  - `frontend/src/main.tsx` — `Toaster` configuration (sonner 2.0.7, dark, glassmorphism)
  - `frontend/src/styles/index.css` — Industrial Amber tokens: `--color-grey-*`, `--color-error`, `--color-success`, `--color-warning`, `--color-info`, `--color-amber-accent`
  - `frontend/src/components/primitives/Button.tsx` — CVA pattern reference
  - `frontend/src/routes/_authenticated/map.tsx` — toast usage patterns

### Secondary (MEDIUM confidence)
- Sonner 2.0.7 installed version verified via `node_modules/sonner/package.json`
- Tailwind 4.x `animate-pulse` utility verified via multiple instances in codebase

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in active use
- Architecture: HIGH — patterns already established in codebase; this phase extends them
- Pitfalls: HIGH — identified from direct codebase reading, not speculation

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (stable stack; no fast-moving dependencies)
