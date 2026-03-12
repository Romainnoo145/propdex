# Phase 107: Due Diligence Dashboard — Research

**Researched:** 2026-03-12
**Domain:** Frontend dashboard rebuild — ReportDetailPage → interactive due diligence workspace
**Confidence:** HIGH

---

## Summary

Phase 107 rebuilds `ReportDetailPage.tsx` (currently 2197 lines, a single monolithic scroll) into an interactive due diligence **werkdashboard** organized around the same 7 dossier sections that Phase 104's PDF template established. The page becomes the primary work screen for vastgoedontwikkelaars: they can view structured data per section, add per-parcel notes and uploaded documents (Phase 106 infrastructure already exists), and export the section as a PDF snapshot.

The key architectural shift is from a scrollable report view to a **sectioned tab workspace** with persistent side navigation. Each of the 7 sections (Locatiegegevens, Kadaster & Eigendom, Bestemmingsplan, Risicoprofiel, Potentie & Risico, Vergunningen, Bronvermelding) becomes a full-panel view with its own status indicator, contextual actions (notes, upload, export), and data completeness badge. The visual language is the Aura design system (Plus Jakarta Sans, Morning Mist canvas, glass pods, obsidian CTAs).

The page lives at `/rapport/$id` (existing route). No new backend endpoints are required — all data is already in `PropertyReportResponse` (extended by Phase 104 with 13 enrichment fields + v3.0 scores). The Phase 106 document upload infrastructure (`useParcelDocuments`, `useUploadDocument`, `useDeleteDocument`) is already functional and can be embedded directly into each section.

**Primary recommendation:** Replace `ReportDetailPage.tsx` with a `DueDiligenceDashboard` component that has a left-side section nav (7 items) + main content pane. Split each of the 7 sections into its own `*Section.tsx` component in `frontend/src/components/reports/sections/`. Reuse all existing data display logic — the rebuild is structural (layout + interactivity), not a data layer change.

---

## Standard Stack

### Core (all already in project — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | existing | Component framework | Project-wide |
| Tailwind CSS | existing | Layout and styling | Aura design system |
| Framer Motion | existing | Animated tab transitions, section reveal | Used throughout Aura components |
| TanStack Query | existing | Data fetching hooks (useReport, useParcelDocuments) | Project-wide query layer |
| Lucide React | existing | Section icons | Used in BronnenLayer, all parcel panels |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-router` | existing | Route params + search params | `useParams` for report ID, `useSearch` for active section |
| `createPortal` (React DOM) | stdlib | Modal overlays | Notes modal, upload confirm dialogs |
| `useRef` | React | Scroll restoration, section jump anchors | Section nav click → scroll-to |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Left-side section nav (7 items) | Top tab bar | Left nav scales better to 7+ items without overflow; top tabs clip at 5-6 |
| URL search param `?section=N` for active section | Local useState only | URL param allows deep links + browser back to return to section |
| Per-section notes as textarea in main panel | Separate notes modal | Inline textarea keeps workflow in context; modal adds friction |

---

## Architecture Patterns

### Recommended File Structure

```
frontend/src/components/reports/
├── DueDiligenceDashboard.tsx     # NEW — root component, replaces ReportDetailPage
├── ReportDetailPage.tsx           # KEEP — thin wrapper calling DueDiligenceDashboard
├── ReportHeader.tsx               # KEEP — reused as dashboard header bar
├── SatelliteThumbnail.tsx         # KEEP — reused in Locatiegegevens section
├── sections/                      # NEW — one file per section
│   ├── S1Locatiegegevens.tsx
│   ├── S2KadasterEigendom.tsx
│   ├── S3BestemmingsplanBouwmogelijkheden.tsx
│   ├── S4Risicoprofiel.tsx
│   ├── S5PotentieRisicoAnalyse.tsx
│   ├── S6VergunningenPrecedenten.tsx
│   └── S7Bronvermelding.tsx
└── components/                    # NEW — shared dashboard primitives
    ├── SectionNav.tsx             # Left rail 7-item navigator
    ├── SectionShell.tsx           # Wrapper: header + content + action bar
    ├── SectionNotesPanel.tsx      # Per-section notes textarea + save
    ├── SectionUploadPanel.tsx     # Per-section upload (reuses BronnenLayer patterns)
    └── SectionStatusBadge.tsx     # Data completeness badge per section
```

### Pattern 1: Section Navigation with URL State

**What:** 7-item left nav synced to URL search param `?section=locatiegegevens`.
**When to use:** Enables deep links and browser back/forward between sections.

```typescript
// Source: existing pattern in rapporten.tsx + rapport.$id.tsx
import { useNavigate, useSearch } from '@tanstack/react-router'

const SECTIONS = [
  { key: 'locatiegegevens', label: '1. Locatiegegevens', icon: MapPin },
  { key: 'kadaster', label: '2. Kadaster & Eigendom', icon: Gavel },
  { key: 'bestemmingsplan', label: '3. Bestemmingsplan', icon: LandPlot },
  { key: 'risicoprofiel', label: '4. Risicoprofiel', icon: ShieldAlert },
  { key: 'analyse', label: '5. Potentie & Risico', icon: BarChart3 },
  { key: 'vergunningen', label: '6. Vergunningen', icon: ScrollText },
  { key: 'bronnen', label: '7. Bronvermelding', icon: Database },
] as const

type SectionKey = typeof SECTIONS[number]['key']
```

### Pattern 2: SectionShell — Consistent Section Wrapper

**What:** Each section gets a consistent shell: title bar + data status badge + content area + action footer (notes + upload + export snippet).
**When to use:** Guarantees uniform UX across all 7 sections.

```typescript
// Pattern: similar to Section() in existing ReportDetailPage.tsx
interface SectionShellProps {
  title: string
  icon: React.ReactNode
  status: 'complete' | 'partial' | 'empty'
  parcelId: string | null   // for document upload
  children: React.ReactNode
}
```

Status mapping:
- `complete` — all key fields present (green badge)
- `partial` — some data present (amber badge)
- `empty` — no data / all null (neutral badge)

### Pattern 3: Per-Section Notes

**What:** Free-text notes textarea per section, persisted via `PATCH /api/reports/{id}/notes` (existing endpoint — single `notes` field on the report).
**Alternative:** Since the backend only has ONE `notes` field (string | null) on the report, per-section notes must be stored as structured JSON within that field: `{ section_key: string }` object. This is zero backend change.

```typescript
// notes stored as JSON string in report.notes:
// {"locatiegegevens": "text", "kadaster": "text", ...}
function parseNotes(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}
```

**Pitfall:** `PATCH /api/reports/{id}/notes` sends `{ notes: string | null }`. The full JSON string for all sections is sent on each save. Section-level save button reads existing notes, merges the changed section, and sends the full blob. This is correct — the notes field is intentionally unstructured.

### Pattern 4: Per-Section Upload Integration

**What:** Each section has an upload zone for documents matching that section's document_type keys from Phase 106.

Section → document_type mapping:
- S1 Locatiegegevens → `perceeldata`
- S2 Kadaster & Eigendom → `kadaster`, `eigendom`, `erfpacht`
- S3 Bestemmingsplan → `bestemmingsplan`, `bestemmingscheck`, `milieuzones`
- S4 Risicoprofiel → `bodem`, `fundering`, `asbest`, `geluid`, `stikstof`
- S5 Potentie & Risico → `quickscan`
- S6 Vergunningen → `vergunninghistorie`
- S7 Bronvermelding → `documenten`, `correspondentie`

**Hook pattern (already exists from Phase 106):**
```typescript
// Source: frontend/src/hooks/useDocuments.ts
const docs = useParcelDocuments(sourceParcelId)
const upload = useUploadDocument()
// sourceParcelId comes from ReportDetailResponse.source_parcel_id
```

**Critical:** `useParcelDocuments` needs `sourceParcelId` (the parcel UUID), NOT the report ID. This comes from `savedReport.data?.source_parcel_id`. When `source_parcel_id` is null (report generated from address, not parcel scan), upload UI should be disabled or show a "Not linked to scan parcel" message.

### Pattern 5: Data Completeness per Section

**What:** Each section computes a completeness signal from the `PropertyReportResponse` fields it renders.

```typescript
// Example: S4 Risicoprofiel completeness
function risicoprofielStatus(data: PropertyReportResponse): 'complete' | 'partial' | 'empty' {
  const signals = [
    data.bodem_data != null,            // existing field
    data.asbest_indicator != null,      // existing field
    data.scores_v3 != null,             // Phase 104 field
    data.funderingsrisico_flags != null, // Phase 104 field
    data.natura2000_flags != null,      // Phase 104 field
  ]
  const filled = signals.filter(Boolean).length
  if (filled === signals.length) return 'complete'
  if (filled > 0) return 'partial'
  return 'empty'
}
```

### Pattern 6: PDF Export per Section (deferred/locked)

**What:** A "Exporteer sectie als PDF" button in the section action bar. This calls the existing `GET /api/reports/{id}/export/pdf` endpoint (full dossier PDF from Phase 104-02) rather than a per-section PDF. Per-section PDF is complex and out of scope — the CTA triggers the full PDF download but is contextually placed in each section footer.

**Decision:** Do NOT add a per-section PDF endpoint. The full dossier PDF already contains the section. The button label can say "Exporteer volledig dossier als PDF".

### Anti-Patterns to Avoid

- **Do NOT keep the 2197-line monolith.** The file violates the 300-line limit. Each section goes in its own file.
- **Do NOT add new backend endpoints.** All data is in `PropertyReportResponse` (report_data JSONB). No new API routes needed.
- **Do NOT use window.print() for the dashboard.** The existing `onPrint` / `handlePrint` in ReportHeader uses `window.print()` which uses browser CSS print. For Phase 107, the PDF export button should call `exportReportPDF` (the WeasyPrint due diligence PDF from Phase 104). Remove the `window.print()` path entirely.
- **Do NOT break the route.** `/rapport/$id` must continue to work. `ReportDetailPage` stays as the route component — it becomes a thin wrapper or is renamed in-place.
- **Do NOT use `useEffect` for section selection sync.** Use URL search params directly via `useSearch()` / `useNavigate()`. Derived state pattern (as established in Phase 93).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File upload | Custom fetch | `useUploadDocument` from Phase 106 | Already handles multipart, invalidation, error states |
| Document list | Re-implement | `useParcelDocuments` from Phase 106 | Already typed, paginated, query-keyed |
| PDF export | Custom blob fetch | `useExportPDF` mutation from `useReports.ts` | Already implemented with Blob + createObjectURL pattern |
| Section notes | Custom PATCH hook | `PATCH /api/reports/{id}/notes` via existing `updateReportNotes` API function | Already in API layer |
| Animated tab transitions | CSS transitions | Framer Motion `AnimatePresence` + `layoutId` | Already used in CategoryTabs, ParcelDetailPanel |
| Status badges | Custom styling system | Reuse `SectionStatusBadge` pattern from this phase | Consistent across sections |

---

## Common Pitfalls

### Pitfall 1: source_parcel_id May Be Null

**What goes wrong:** Phase 106 upload buttons use `parcelId` (from `source_parcel_id` on the report). Reports generated from `/from-address` endpoint do NOT have a `source_parcel_id`. Upload UI breaks silently when this is null.
**Why it happens:** Not all reports have a linked scan parcel. Address-based reports pre-date parcel scans.
**How to avoid:** Guard all upload-related UI with `sourceParcelId != null`. Show "Upload niet beschikbaar — rapport niet gekoppeld aan perceelscan" when null.
**Warning signs:** `useParcelDocuments(undefined)` is disabled by the `enabled: !!parcelId` guard — so no crash, but upload buttons would silently do nothing.

### Pitfall 2: PropertyReportResponse Fields from Phase 104 May Be Null on Old Reports

**What goes wrong:** Old reports saved before Phase 104 have `scores_v3 = null`, `funderingsrisico_flags = null`, etc. Section completeness logic must handle null gracefully.
**Why it happens:** Phase 104 added 13 optional fields with `default=None`. Old JSONB rows don't have them.
**How to avoid:** All new Phase 104 fields default to null when absent from stored JSONB. Section completeness should count them as "empty" not errors. Already handled if completeness uses `data.field ?? null` checks.

### Pitfall 3: notes Field JSON Parsing on First Load

**What goes wrong:** If `report.notes` is a plain string (pre-107 note) rather than a JSON object string, `JSON.parse` throws, wiping out the existing note.
**Why it happens:** Phase 107 is the first to use notes as structured JSON. Previous notes were plain text.
**How to avoid:** `parseNotes` function must detect non-JSON strings and migrate them:
```typescript
function parseNotes(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    // Old plain string note: preserve under a 'general' key
    return { general: raw }
  } catch {
    return { general: raw }
  }
}
```

### Pitfall 4: File Size — 300-Line Limit Per File

**What goes wrong:** Rebuilding all 7 sections in a single file recreates the monolith problem.
**Why it happens:** It's tempting to co-locate all section code.
**How to avoid:** Each section is its own file in `sections/`. Each section file should be ~100-200 lines. Shared display primitives (Row, KV, StatusBadge) go in `components/`.

### Pitfall 5: Section Nav vs Existing Route Back Button

**What goes wrong:** The left section nav visually replaces the old `onBack` / back-button flow. Users expect to be able to navigate back to the rapport list.
**Why it happens:** Dashboard takes up full viewport; back button must be preserved.
**How to avoid:** Keep the `onBack` handler in the top bar (header area). The left section nav is WITHIN the page, not a replacement for the route back button. ReportHeader's back button stays.

### Pitfall 6: TypeScript — PropertyReportResponse Missing Phase 104 Fields

**What goes wrong:** If the frontend `PropertyReportResponse` type in `lib/types/property.ts` hasn't been updated to include the 13 Phase 104 fields, TypeScript will error on `data.scores_v3`, `data.funderingsrisico_flags`, etc.
**Why it happens:** Phase 104 backend changes may not have been reflected in the frontend types.
**How to avoid:** Read the current `lib/types/property.ts` before implementing Section 4 and 5 — add any missing fields from Phase 104. The fields are all optional (`| null`).

---

## Code Examples

### Section component pattern (derived from existing ReportDetailPage Section wrapper)

```typescript
// Source: existing Section() function in ReportDetailPage.tsx
// New SectionShell matches this pattern but adds action bar
export function SectionShell({
  title,
  icon,
  status,
  children,
  actionBar,
}: {
  title: string
  icon: React.ReactNode
  status: 'complete' | 'partial' | 'empty'
  children: React.ReactNode
  actionBar?: React.ReactNode
}) {
  const statusColors = {
    complete: 'bg-green-500/10 text-green-600 border-green-500/20',
    partial: 'bg-aura-amber/10 text-aura-amber border-aura-amber/20',
    empty: 'bg-neutral-100 text-neutral-500 border-neutral-200',
  }
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-neutral-200">
        <span className="text-neutral-500">{icon}</span>
        <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            className="text-sm font-bold tracking-wide text-aura-ink flex-1">
          {title}
        </h2>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusColors[status]}`}>
          {status === 'complete' ? 'Compleet' : status === 'partial' ? 'Gedeeltelijk' : 'Leeg'}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {children}
      </div>
      {actionBar && (
        <div className="border-t border-neutral-200 px-6 py-4">
          {actionBar}
        </div>
      )}
    </div>
  )
}
```

### Section nav item pattern (derived from CategoryTabs.tsx)

```typescript
// Source: frontend/src/components/map/panels/parcel/CategoryTabs.tsx
// SectionNav uses same layoutId animation pattern but vertical
function SectionNavItem({ item, isActive, onClick }: ...) {
  return (
    <button onClick={onClick} className="relative w-full flex items-center gap-3 px-4 py-3 text-left">
      {isActive && (
        <motion.div
          layoutId="section-nav-active"
          className="absolute inset-0 rounded-[16px] bg-aura-obsidian/[0.06]"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <span className={`relative z-10 ${isActive ? 'text-aura-ink' : 'text-neutral-400'}`}>
        <item.Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
      </span>
      <span className="relative z-10 text-[12px] font-semibold tracking-wide"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif",
                     color: isActive ? '#0E1111' : '#94a3b8' }}>
        {item.label}
      </span>
    </button>
  )
}
```

### Notes save pattern (PATCH /api/reports/{id}/notes)

```typescript
// Source: useReports.ts — uses existing useUpdateNotes mutation via api.ts
async function saveNotes(
  reportId: string,
  section: string,
  text: string,
  currentNotesRaw: string | null,
  accessToken: string,
) {
  const allNotes = parseNotes(currentNotesRaw)
  allNotes[section] = text
  await updateReportNotes(reportId, JSON.stringify(allNotes), accessToken)
}
```

### Per-section document upload trigger (Phase 106 pattern)

```typescript
// Source: BronnenLayer.tsx lines 716-739
// Same upload pattern — just trigger for specific document_types
const upload = useUploadDocument()

const handleSectionUpload = async (file: File, documentType: string) => {
  await upload.mutateAsync({
    parcelId: sourceParcelId,
    documentType,
    file,
  })
}
```

### URL-based section navigation (TanStack Router pattern)

```typescript
// Source: rapporten.tsx setProjectFilter pattern
const navigate = useNavigate()
const search = Route.useSearch()
const activeSection = search.section ?? 'locatiegegevens'

const handleSectionSelect = (key: SectionKey) => {
  navigate({ to: '/rapport/$id', params: { id }, search: { ...search, section: key } })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Monolithic 2197-line scrollable page | 7-section nav dashboard | Phase 107 | Primary work screen with persistent context |
| Notes: single freetext per report | Notes: per-section JSON within same field | Phase 107 | Section-level context without backend changes |
| Upload: only in parcel detail panel (BronnenLayer) | Upload: also in report dashboard per section | Phase 107 | Documents accessible from both contexts |
| PDF: window.print() CSS | PDF: WeasyPrint due diligence dossier (Phase 104) | Phase 104 already done | Professional A4 output |
| Score display: parcel panel only | Score display: full per-factor analysis in S5 | Phase 107 | Analyst-grade data in work screen |

---

## Open Questions

1. **Dashboard layout: full-page replacement or embedded in existing shell?**
   - What we know: `/rapport/$id` uses `RapportPage` which renders `ReportDetailPage`. The page sits inside `_authenticated` layout with `ResultsShell` or similar wrapper.
   - What's unclear: Does the dashboard need a full-viewport layout (like the map), or does it inherit the standard content frame?
   - Recommendation: Use the existing content frame (same as current ReportDetailPage with `bg-aura-canvas` + max-width). The section nav is a LEFT SIDEBAR within the content area, NOT a full-screen layout. This keeps the report header visible and avoids layout conflicts with `_authenticated` wrapper.

2. **Should the section nav state persist across report visits?**
   - What we know: URL param approach auto-persists via browser history.
   - Recommendation: Yes, URL param `?section=locatiegegevens` — first visit defaults to locatiegegevens. Browser back restores previous section.

3. **Update notes via `updateReportNotes` — does this API function already exist?**
   - What we know: `PATCH /api/reports/{id}/notes` endpoint exists in `reports/router.py` line 849. The frontend `useReports.ts` does NOT yet have a `useUpdateNotes` mutation hook.
   - Recommendation: Add `useUpdateNotes` mutation to `useReports.ts` in Plan 107-01. Minimal addition (~15 lines matching the existing mutation pattern).

4. **Type completeness for Phase 104 fields in frontend types?**
   - What we know: `lib/types/property.ts` needs verification. Phase 104-01 extended `PropertyReportResponse` backend schema with 13 fields. The frontend type may not reflect all of them.
   - Recommendation: Read `lib/types/property.ts` fully at start of implementation. Add missing fields (all optional). This is a Plan 107-01 task.

---

## Derived Phase Requirements (no explicit IDs — derived from goal)

| ID | Description | Research Support |
|----|-------------|-----------------|
| DD107-01 | Section nav with 7 items, URL-synced active state, animated selection indicator | TanStack Router search params + Framer Motion layoutId pattern confirmed |
| DD107-02 | Each section renders data from PropertyReportResponse with completeness status badge | All data already in PropertyReportResponse (Phase 104 extended it) |
| DD107-03 | Per-section notes: textarea saved via PATCH /api/reports/{id}/notes as JSON string | Backend endpoint exists; frontend needs `useUpdateNotes` hook |
| DD107-04 | Per-section document upload: embedded upload zone linked to section's document_type keys | `useUploadDocument` + `useParcelDocuments` from Phase 106 ready to use |
| DD107-05 | PDF export button in section footer triggers full due diligence PDF (Phase 104 template) | `useExportPDF` mutation already in `useReports.ts` |
| DD107-06 | Dashboard stays within existing `/rapport/$id` route — no route changes | `RapportPage` wrapper kept; `ReportDetailPage` rebuilt in place |
| DD107-07 | 300-line limit enforced: 7 section files + shared components in sections/ subdirectory | Split architecture documented above |

---

## Validation Architecture

Nyquist validation: `workflow.nyquist_validation` not present in `.planning/config.json` — skip this section.

---

## Sources

### Primary (HIGH confidence)

- Codebase read: `frontend/src/components/reports/ReportDetailPage.tsx` (2197 lines) — full section inventory, existing data display logic
- Codebase read: `frontend/src/components/map/panels/parcel/layers/BronnenLayer.tsx` — Phase 106 upload/document pattern
- Codebase read: `frontend/src/components/map/panels/parcel/CategoryTabs.tsx` — Framer Motion section nav pattern
- Codebase read: `frontend/src/hooks/useReports.ts` — confirmed `useExportPDF` + existing hooks; identified missing `useUpdateNotes`
- Codebase read: `frontend/src/hooks/useDocuments.ts` — `useParcelDocuments` / `useUploadDocument` confirmed
- Codebase read: `frontend/src/routes/_authenticated/rapport.$id.tsx` — route structure, `source_parcel_id` usage
- Codebase read: `backend/app/reports/router.py` (route list) — confirmed `PATCH /{id}/notes` at line 849
- Codebase read: `.planning/phases/104-locatie-due-diligence-dossier/104-02-SUMMARY.md` — confirmed 7 section structure from due_diligence.html template
- Codebase read: `.planning/STATE.md` — Aura design decisions, existing patterns

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — RPT-01 requirement confirms report page needs Aura bento treatment
- `.planning/ROADMAP.md` — Phase 107 goal statement confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed present in project, no new dependencies needed
- Architecture: HIGH — section structure derived directly from Phase 104 due_diligence.html 7-section template; data layer already built
- Pitfalls: HIGH — based on direct code analysis of existing patterns (null handling, notes format, upload guards)
- Section content: MEDIUM — exact section completeness formulas are implementation choices, not verified against specific requirements

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable domain — React/TanStack Router/Tailwind don't change fast)
