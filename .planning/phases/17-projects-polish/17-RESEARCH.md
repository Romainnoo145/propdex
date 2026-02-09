# Phase 17: Projects & Polish - Research

**Researched:** 2026-02-09
**Domain:** React UI patterns (CRUD, mobile, badges, cache control)
**Confidence:** HIGH

## Summary

Phase 17 implements project folder management for organizing saved reports, adds mobile-friendly bottom sheet patterns, displays monument badges and AI zoning confidence indicators, and provides force refresh controls for power users. The backend already provides complete project CRUD endpoints (`/api/projects`) and report-to-project assignment capabilities via `project_id` field in reports.

The technical challenge is threefold: (1) build a lightweight project folder UI without complex tree libraries, (2) adapt the existing desktop drawer pattern to mobile with touch-safe scrolling, and (3) display AI-generated zoning data with appropriate confidence indicators to manage user expectations about data accuracy.

**Primary recommendation:** Use existing patterns from the codebase (TanStack Query mutations with cache invalidation, glassmorphism UI, accordion sections) and avoid adding heavyweight dependencies. Projects are a flat list (no nesting), bottom sheets use pure CSS with touch event `stopPropagation` on scrollable content, and confidence indicators use simple color-coded badges (green/yellow/red) matching the existing SourceBadge pattern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Query | ^5.90.20 | Mutations + cache invalidation | Already used for all data fetching; mutation pattern established in useReports.ts |
| React 19 | ^19.2.0 | UI framework | Project standard; concurrent features not required for this phase |
| TypeScript strict | ~5.9.3 | Type safety | Enforced in codebase; helps prevent runtime errors in CRUD operations |
| MapLibre GL JS | ^5.17.0 | Touch event handling | Already integrated; handles pan/zoom conflicts with `touchZoomRotate` handlers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-focus-lock | ^2.13.7 | Focus trap for modals | Already used in Drawer component; reuse for bottom sheet |
| Tailwind v4 | ^4.1.18 | Responsive styles | All styling; mobile breakpoints (md:) for bottom sheet |
| None (Pure CSS) | - | Bottom sheet animation | Avoid react-modal-sheet (adds 40KB); use CSS translate + touch handlers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure CSS bottom sheet | react-modal-sheet | Library adds keyboard avoidance + snap points, but +40KB bundle size and Phase 17 doesn't need multi-snap-point complexity |
| Flat project list | React Complex Tree | Tree library enables nested folders but Phase 17 spec shows flat structure; YAGNI principle |
| Simple color badges | Recharts confidence bars | Visual data viz impressive but overkill for 3-level indicator (HIGH/MEDIUM/LOW) |

**Installation:**
```bash
# No new dependencies required — all features use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── components/
│   ├── projects/
│   │   ├── ProjectList.tsx          # Flat list with edit/delete actions
│   │   ├── ProjectCreateModal.tsx   # Modal with name + description form
│   │   └── ProjectEditModal.tsx     # Edit existing project
│   ├── layout/
│   │   └── ReportSidebar.tsx        # MODIFY: Add project filter + create button
│   └── property/
│       ├── PropertyDetailDrawer.tsx # Desktop drawer (existing)
│       ├── PropertyBottomSheet.tsx  # NEW: Mobile variant
│       └── ConfidenceBadge.tsx      # NEW: AI confidence indicator
├── hooks/
│   └── useProjects.ts               # NEW: TanStack Query hooks for project CRUD
└── lib/
    └── api.ts                       # ADD: Project API functions
```

### Pattern 1: TanStack Query Mutation with Cache Invalidation
**What:** useMutation for create/update/delete operations, onSuccess invalidates relevant query keys
**When to use:** All write operations (project CRUD, report assignment)
**Example:**
```typescript
// Source: frontend/src/hooks/useReports.ts (lines 79-90)
export function useSaveReport() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ReportDetailResponse, Error, ReportSaveRequest>({
    mutationFn: (request: ReportSaveRequest) => saveReport(request, accessToken),
    onSuccess: () => {
      // Invalidate all report lists (filters may vary)
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
  })
}
```

### Pattern 2: Bottom Sheet with Touch-Safe Scrolling
**What:** Fixed-position panel from bottom with CSS transform animation, stopPropagation on content scroll to prevent map pan conflicts
**When to use:** Mobile viewports (below md breakpoint) for property details
**Example:**
```tsx
// Source: Existing drawer pattern + mobile adaptations from research
<div className="fixed inset-x-0 bottom-0 md:hidden">
  <div
    className="bg-black/40 backdrop-blur-xl border-t border-white/10"
    style={{ maxHeight: '70vh', zIndex: 'var(--z-property-panel)' }}
  >
    {/* Header with drag handle */}
    <div className="flex justify-center py-2">
      <div className="w-10 h-1 bg-white/30 rounded-full" />
    </div>

    {/* Scrollable content with stopPropagation */}
    <div
      className="overflow-y-auto"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
</div>
```

### Pattern 3: Accordion Project Groups
**What:** Collapsible sections with chevron icon, controlled via useState Set
**When to use:** Grouping reports by project in sidebar
**Example:**
```typescript
// Source: frontend/src/components/layout/ReportSidebar.tsx (lines 37-52)
const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
  new Set(['Geen project'])
)

const toggleProject = (projectId: string) => {
  setExpandedProjects((prev) => {
    const next = new Set(prev)
    if (next.has(projectId)) {
      next.delete(projectId)
    } else {
      next.add(projectId)
    }
    return next
  })
}
```

### Pattern 4: Confidence Badge Component
**What:** Color-coded badge showing AI confidence (HIGH=green, MEDIUM=yellow, LOW=red) with optional tooltip
**When to use:** Displaying AI-parsed zoning data confidence
**Example:**
```tsx
// Pattern from research + existing SourceBadge component style
type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

interface ConfidenceBadgeProps {
  confidence: Confidence
  label?: string
}

export function ConfidenceBadge({ confidence, label }: ConfidenceBadgeProps) {
  const colors = {
    HIGH: 'bg-green-500/20 border-green-500/40 text-green-100',
    MEDIUM: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-100',
    LOW: 'bg-red-500/20 border-red-500/40 text-red-100'
  }

  const labels = {
    HIGH: 'Hoog vertrouwen',
    MEDIUM: 'Gemiddeld vertrouwen',
    LOW: 'Laag vertrouwen'
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-medium ${colors[confidence]}`}>
      {label || labels[confidence]}
    </span>
  )
}
```

### Anti-Patterns to Avoid
- **Nested project folders:** Backend model supports flat structure only (no parent_id field); adding nesting would require migration and tree UI complexity
- **Optimistic updates without rollback:** Always implement onError handler to revert cache on mutation failure (prevent ghost items in UI)
- **Global stopPropagation on bottom sheet:** Only stop propagation on scrollable content div, not entire sheet — allows close on backdrop click
- **Hardcoded confidence colors:** Use Tailwind utilities matching existing badge pattern (green/yellow/red with opacity/20 backgrounds)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validators | react-hook-form + zod | Already in package.json; handles validation, errors, submission state |
| Toast notifications | Custom toast component | sonner | Already used (import { toast } from 'sonner'); consistent UX |
| Modal focus management | Manual focus trap | react-focus-lock | Already in Drawer; prevents keyboard navigation escaping modal |
| API error handling | Try/catch per component | Centralized apiFetch error parsing | Existing pattern in lib/api.ts extracts error.detail from backend |
| Mobile touch detection | navigator.userAgent parsing | CSS media queries (md:) | More reliable; handles tablet landscape, browser DevTools |

**Key insight:** React's ecosystem solved these problems years ago. Custom solutions introduce bugs (focus traps are notoriously hard to implement correctly) and maintenance burden. The codebase already has proven solutions — reuse them.

## Common Pitfalls

### Pitfall 1: Bottom Sheet Scroll-Pan Conflict
**What goes wrong:** User tries to scroll property details on mobile, but map pans/zooms instead
**Why it happens:** MapLibre captures touch events globally; default touchZoomRotate handler conflicts with scrollable content
**How to avoid:** Call `stopPropagation()` on touchStart/touchMove for scrollable container; MapLibre won't receive these events
**Warning signs:** User complaints about "map moving while reading details" on mobile devices
**Source verification:** MapLibre docs confirm TwoFingersTouchZoomRotateHandler can conflict with single-finger scroll ([MapLibre GL JS Touch Events](https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/))

### Pitfall 2: Cache Invalidation Too Broad
**What goes wrong:** Updating project name causes all reports to refetch unnecessarily
**Why it happens:** `invalidateQueries({ queryKey: ['reports'] })` matches ALL report queries regardless of filters
**How to avoid:** Invalidate specific keys when possible (`['reports', { project_id: 'uuid' }]`), or accept slight over-fetching for simplicity (5min stale time mitigates)
**Warning signs:** Network tab shows multiple identical report list requests after project update
**Decision:** Phase 17 prioritizes simplicity — broad invalidation acceptable given 5-minute stale time on report lists

### Pitfall 3: Deleting Project with Reports
**What goes wrong:** User deletes project, reports disappear or become inaccessible
**Why it happens:** Misunderstanding FK behavior — backend sets `project_id = NULL` on cascade (not DELETE)
**How to avoid:** Test deletion flow explicitly; verify reports move to "Geen project" section after deletion
**Warning signs:** Empty sidebar after project deletion; user panic about "lost reports"
**Backend behavior:** FK constraint `ondelete=SET NULL` documented in backend/app/projects/router.py line 348

### Pitfall 4: Monument Badge Missing When False
**What goes wrong:** Properties without monument status show no badge, users assume no data checked
**Why it happens:** Only rendering badge when `is_monument === true` creates ambiguity
**How to avoid:** Always show monument badge with two states: "Rijksmonument" (amber) or "Geen monument" (green/neutral)
**Warning signs:** User questions "Was monument status checked for this property?"
**Existing pattern:** PropertyDetailDrawer already shows both states (lines 524-547)

### Pitfall 5: Confidence Indicator Without Explanation
**What goes wrong:** User sees "LOW" confidence badge but doesn't understand what it means or what to do
**Why it happens:** Showing confidence level without context about data source or implications
**How to avoid:** Add hover tooltip or info icon explaining "LOW = verifieer handmatig, mogelijk onvolledig"
**Warning signs:** Support questions "What does LOW confidence mean?" or users ignoring warnings
**Best practice:** AI UX patterns emphasize explaining what drives confidence and suggesting user action ([Confidence Visualization UI Patterns](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns))

## Code Examples

Verified patterns from official sources and existing codebase:

### Project CRUD Hooks (TanStack Query Pattern)
```typescript
// Based on: frontend/src/hooks/useReports.ts mutation pattern
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/useAuth'

export function useProjects() {
  const { accessToken } = useAuth()

  return useQuery({
    queryKey: ['projects'],
    queryFn: () => fetchProjects(accessToken),
    staleTime: 10 * 60 * 1000, // 10 minutes — projects change rarely
    enabled: !!accessToken,
  })
}

export function useCreateProject() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: ProjectCreate) => createProject(data, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] }) // Update report counts
    },
  })
}

export function useDeleteProject() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] }) // Reports now have project_id = null
    },
  })
}
```

### Assign Report to Project
```typescript
// New mutation hook for updating report's project_id
export function useAssignReportToProject() {
  const { accessToken } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ reportId, projectId }: { reportId: string, projectId: string | null }) =>
      assignReportToProject(reportId, projectId, accessToken),
    onSuccess: (_data, { reportId }) => {
      queryClient.invalidateQueries({ queryKey: ['report', reportId] })
      queryClient.invalidateQueries({ queryKey: ['reports'] }) // Sidebar grouping changes
      queryClient.invalidateQueries({ queryKey: ['projects'] }) // Report counts change
    },
  })
}
```

### Force Refresh Button
```typescript
// Add force_refresh param to existing property lookup
// Backend: POST /api/properties/lookup already supports force_refresh query param

interface LookupOptions {
  forceRefresh?: boolean
}

export async function lookupProperty(
  input: AddressInput,
  accessToken: string | null,
  options: LookupOptions = {}
): Promise<PropertyReportResponse> {
  const params = new URLSearchParams()
  if (options.forceRefresh) {
    params.set('force_refresh', 'true')
  }

  const url = `${API_BASE}/lookup${params.toString() ? `?${params}` : ''}`

  return apiFetch<PropertyReportResponse>(url, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(input),
  })
}

// Usage in component
function ForceRefreshButton({ addressInput }: { addressInput: AddressInput }) {
  const lookupMutation = usePropertyLookup()

  const handleForceRefresh = () => {
    lookupMutation.mutate(
      { ...addressInput, forceRefresh: true },
      {
        onSuccess: () => {
          toast.success('Gegevens bijgewerkt met laatste bronnen')
        }
      }
    )
  }

  return (
    <button
      onClick={handleForceRefresh}
      disabled={lookupMutation.isPending}
      className="text-xs text-white/50 hover:text-white"
      title="Cache negeren en ophalen met laatste data"
    >
      {lookupMutation.isPending ? 'Bezig...' : 'Geforceerde refresh'}
    </button>
  )
}
```

### Mobile Bottom Sheet Component
```tsx
// Responsive variant of existing Drawer component
// Desktop: Drawer slides from right (existing)
// Mobile: Bottom sheet slides from bottom (new)

interface PropertyBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function PropertyBottomSheet({ isOpen, onClose, children }: PropertyBottomSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  useEscapeKey(onClose, isOpen)

  if (!isOpen) return null

  return (
    <FocusLock>
      <div className="fixed inset-0 md:hidden" style={{ zIndex: 'var(--z-property-panel)' }}>
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Bottom sheet */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col bg-black/40 backdrop-blur-xl border-t border-white/10 rounded-t-2xl max-h-[85vh] animate-slide-up">
          {/* Drag handle */}
          <div className="flex justify-center py-3 flex-shrink-0">
            <div className="w-10 h-1 bg-white/30 rounded-full" />
          </div>

          {/* Scrollable content — stopPropagation prevents map pan */}
          <div
            ref={contentRef}
            className="overflow-y-auto flex-1"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </div>
      </div>
    </FocusLock>
  )
}

// CSS animation (add to index.css)
// @keyframes slide-up {
//   from { transform: translateY(100%); }
//   to { transform: translateY(0); }
// }
// .animate-slide-up { animation: slide-up 0.3s ease-out; }
```

### AI Zoning Display with Confidence
```tsx
// Display AI-parsed zoning with confidence indicator
// Source: backend returns zoning.ai_parsed with confidence field

function AIZoningDisplay({ zoning }: { zoning: ZoningData }) {
  if (!zoning.ai_parsed) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-white/70 text-xs uppercase">AI Interpretatie</h4>
        <ConfidenceBadge confidence={zoning.ai_parsed.confidence} />
      </div>

      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <p className="text-white/80 text-sm">{zoning.ai_parsed.summary}</p>

        {zoning.ai_parsed.confidence === 'LOW' && (
          <div className="mt-2 flex items-start gap-2 text-yellow-200/80 text-xs">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Verifieer handmatig — AI interpretatie mogelijk onvolledig</span>
          </div>
        )}
      </div>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-modal-sheet library | Pure CSS + touch handlers | 2025-2026 | Modern CSS (scroll-snap, backdrop-filter) enables native-like sheets with minimal JS; research shows pure-web-bottom-sheet approach |
| Nested folder trees | Flat project lists | Industry shift 2023+ | Notion, Linear, Height all moved away from deep hierarchies; users prefer tags/filters over folders |
| Percentage confidence (0-100%) | Categorical (HIGH/MEDIUM/LOW) | AI UX patterns 2025 | Precise percentages create false precision; categorical levels easier for users to interpret and act on |
| Desktop-first mobile adapt | Mobile-first responsive | Tailwind v4 philosophy | Use `md:` prefix for desktop enhancements, not mobile overrides; bottom sheet default, drawer at md+ |

**Deprecated/outdated:**
- **react-sortable-tree:** No longer maintained; use react-complex-tree if nested folders needed (but Phase 17 uses flat structure)
- **Mapbox GL JS:** Propdex migrated to MapLibre GL JS (open source fork); API largely compatible but check docs for breaking changes
- **TanStack Query v4 syntax:** v5 removed `useQuery` enabled: false default; now must explicitly set enabled: !!dependency

## Open Questions

1. **Bottom sheet snap points?**
   - What we know: Research shows react-modal-sheet supports multi-snap (25%, 50%, 75% heights)
   - What's unclear: Does Phase 17 require this complexity, or is fixed max-height adequate?
   - Recommendation: Start with fixed `max-h-[85vh]` — YAGNI principle; add snap points in Phase 18 if user feedback demands it

2. **Project folder icons/colors?**
   - What we know: Backend ProjectResponse has name + description, no color/icon fields
   - What's unclear: Should projects have visual distinction beyond name?
   - Recommendation: Skip for Phase 17 — database migration required; evaluate in user testing first

3. **Parcel click/highlight on map?**
   - What we know: Phase 16 notes state "not possible with WMS raster tiles, deferred to Phase 17"
   - What's unclear: Phase 17 description doesn't mention this requirement — was it re-deferred?
   - Recommendation: Clarify with user — if required, needs WFS vector layer or GeoJSON overlay (research shows MapLibre clickable features require vector source)

4. **Confidence indicator placement?**
   - What we know: AI zoning data exists in backend (zoning.ai_parsed field implied by requirements)
   - What's unclear: Backend PropertyReportResponse schema doesn't show ai_parsed field — is this new?
   - Recommendation: Verify backend schema; if missing, Phase 17 must add ai_parsed to zoning response with confidence enum

## Sources

### Primary (HIGH confidence)
- **TanStack Query v5 mutations:** [Optimistic Updates | TanStack Query React Docs](https://tanstack.com/query/v5/docs/react/guides/optimistic-updates)
- **MapLibre GL JS touch handlers:** [TwoFingersTouchZoomRotateHandler](https://maplibre.org/maplibre-gl-js/docs/API/classes/TwoFingersTouchZoomRotateHandler/)
- **Existing codebase patterns:** frontend/src/hooks/useReports.ts (mutation + cache invalidation), frontend/src/components/layout/ReportSidebar.tsx (accordion pattern)
- **Backend project API:** backend/app/projects/router.py (complete CRUD endpoints with rate limiting)

### Secondary (MEDIUM confidence)
- **Bottom sheet patterns:** [Native-like bottom sheets on the web](https://viliket.github.io/posts/native-like-bottom-sheets-on-the-web/) — demonstrates pure CSS approach
- **AI confidence visualization:** [Confidence Visualization UI Patterns](https://agentic-design.ai/patterns/ui-ux-patterns/confidence-visualization-patterns) — categorical levels + color coding
- **Progressive disclosure:** [Progressive Disclosure - NN/G](https://www.nngroup.com/articles/progressive-disclosure/) — accordion best practices
- **React badge accessibility:** [PatternFly Badge Accessibility](https://www.patternfly.org/components/badge/accessibility/) — aria-label guidance

### Tertiary (LOW confidence)
- **React folder tree libraries:** [7 Best React Tree View Components](https://reactscript.com/best-tree-view/) — overview of options (but Phase 17 uses flat structure, not needed)
- **Cache invalidation UX:** [Caching in 2026](https://lukasniessen.medium.com/caching-in-2026-fundamentals-invalidation-and-why-it-matters-more-than-ever-867fee46e98b) — general strategies, not React-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in package.json, verified versions
- Architecture: HIGH — Patterns extracted from existing codebase (useReports, ReportSidebar, Drawer)
- Pitfalls: MEDIUM — Bottom sheet scroll conflict well-documented, but confidence indicator placement needs backend schema verification
- Backend integration: HIGH — Project router fully implemented, endpoints tested in v1.1 milestone

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days) — React/TanStack Query patterns stable, Tailwind v4 mature, MapLibre GL JS v5 current LTS
