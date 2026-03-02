# Phase 65: Report Polish - Research

**Researched:** 2026-03-02
**Domain:** React report layout, CSS @media print PDF export, actionable warnings UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Section layout & visual consistency:**
- Card-based layout: each section (WOZ, BRK, BAG, etc.) is a distinct card with bold header, subtle border, consistent padding
- Section ordering by developer relevance: Actie vereist → Bestemmingsplan → BRK/Kadaster → BAG → WOZ → Energielabel → Buildability → Wkb → Permits
- Empty/unavailable sections shown with greyed-out card and "Geen data beschikbaar" message — makes clear what was checked
- Data density: Claude's discretion per section type (some may suit key-value pairs, others summary + details)

**PDF export:**
- Browser print-to-PDF approach: CSS `@media print` rules + `window.print()`. No server-side generation, no extra dependencies
- White-label ready: client's organization name/logo in header, Propdex subtle in footer
- Static map snapshot included at top of PDF — aerial/satellite view of the property location
- Page break strategy: Claude's discretion — optimize for readability

**"Actie vereist" warnings:**
- Placement: top of report, immediately after header — first thing developers see
- Scope: all warnings derivable from existing data — Wkb-plichtig, asbestrisico (bouwjaar <1994), vergunningsstatus, monumentstatus, bestemmingsplan conflicts
- Severity visualization: color-coded with icons — red for blocking issues (Wkb-plichtig, asbest), amber for attention items (vergunningsstatus), info blue for awareness (monumentstatus)
- Tone: direct professional Dutch, factual, no softening. E.g., "Dit pand is Wkb-plichtig. Een kwaliteitsborger is verplicht bij verbouwing."
- Section absent (or empty) for parcels with no actionable warnings

**Report header & metadata:**
- Address prominently displayed + key property stats below (oppervlakte, bestemming, bouwjaar, WOZ-waarde)
- Kadaster perceel ID shown prominently next to address (developers reference this in their own systems)
- Satellite thumbnail from map included in header for visual context
- Single report generation date — no per-section data freshness indicators

### Claude's Discretion
- Data density per section (key-value vs summary+details — choose what fits each section)
- Page break optimization for PDF
- Loading skeleton design
- Exact spacing, typography, card styling details
- How to capture static map snapshot for PDF

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 65 is a pure frontend polish phase targeting `ReportDetailPage.tsx` (2145 lines). The file already contains all section components for WOZ, energielabel, BRK, buildability delta, Wkb precheck, and permit precedents — added in v7.x phases. The work is (1) restructuring the section render order, (2) standardizing the "Geen data beschikbaar" empty states (some are `italic text-grey-600`, some are missing entirely), (3) implementing CSS `@media print` rules + `window.print()` PDF export with white-label header/footer, (4) capturing a static satellite map thumbnail for the PDF header, and (5) building the new "Actie vereist" warning section that derives all its content from already-present data fields.

The print approach is the right call for this phase. Browser print-to-PDF handles pagination, font rendering, and Dutch locale automatically. The only tricky part is the static map snapshot: the live MapLibre instance is not accessible from the report view (it lives in the route layout behind MapContext, and the report page may be opened from a saved report without a live map). The safe approach is to use ESRI's static map tile service to build a fixed image URL from `map_data.center_wgs84` coordinates — no new dependencies needed. Alternatively, `maplibre-gl`'s `map.getCanvas().toDataURL()` can capture a snapshot if a hidden map instance is briefly rendered; this is feasible but heavier than a simple static tile URL.

The "Actie vereist" section is pure derivation logic: read existing fields from `PropertyReportResponse` and apply rule conditions. The existing `STATUS_EXPLANATIONS` map and `WkbPrecheck.status` already encode severity. No new API calls or backend changes are required.

**Primary recommendation:** Implement in three plans — Plan 01: section reorder + empty state audit + header polish; Plan 02: `@media print` + `window.print()` + static map thumbnail; Plan 03: `ActieVereistSection` component with derived warnings.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RPT-01 | Opening a property report shows all sections in a consistent, visually clean layout with no rendering artifacts or layout breaks in v7.x sections | Audit of ReportDetailPage.tsx confirms sections exist but render order is not developer-oriented; Section component (`rounded-2xl border border-overlay/[0.08] bg-grey-900`) is the established card pattern — extend consistently |
| RPT-02 | Clicking "Download PDF" generates a PDF with all report sections in readable format with correct Dutch typography | CSS `@media print` rules are the right approach; existing `PDFExportModal.tsx` uses a server-side `useExportPDF` hook that must be replaced or supplemented with `window.print()`; Inter font loads from system/CDN and will render correctly in print |
| RPT-03 | Wkb-plichtige properties show an "Actie vereist" section listing concrete warnings | All source data is already in `PropertyReportResponse` — `wkb_precheck.status`, `building.bouwjaar`, `building.status`, `monuments.is_monument`; new component derives warnings, no new API needed |
| RPT-04 | "Actie vereist" section is absent (or empty) for parcels with no actionable warnings | Implemented via a `computeWarnings(data)` helper that returns an empty array when no conditions fire; the section renders `null` when warnings array is empty |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (existing) | 19.2.0 | Component rendering | Already used throughout project |
| Tailwind CSS v4 (existing) | 4.x | Utility styling | Project standard; `@media print` utilities available via arbitrary variant `print:` |
| MapLibre GL (existing) | 5.17.0 | Map canvas for optional snapshot | Already installed; `map.getCanvas().toDataURL()` is the snapshot API |
| `window.print()` (browser built-in) | — | Trigger print dialog | No dependency needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ESRI World Imagery static tiles | — | Static map thumbnail for PDF | Use when no live map instance is accessible |
| CSS `@media print` | — | Print-specific styles | Hides interactive elements, forces white background, controls page breaks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `window.print()` + `@media print` | Puppeteer / WeasyPrint server-side | Server-side is more reliable across browsers but requires a new dependency and infrastructure; browser print is zero-dep and acceptable for demo use |
| ESRI static tile URL | MapLibre `map.getCanvas().toDataURL()` | Canvas snapshot requires a live Map instance; ESRI static URL is a simple `<img>` requiring only lat/lng — simpler but image quality is fixed-zoom tiles |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure (changes only)
```
frontend/src/
├── components/reports/
│   ├── ReportDetailPage.tsx       # Primary file — section reorder, layout polish, print styles
│   └── PDFExportModal.tsx         # May be simplified or replaced with inline print button
└── styles/
    └── index.css                  # Add @media print rules here (global print stylesheet)
```

### Pattern 1: Section Render Order
**What:** Reorder section components in `ReportDetailPage` main body to match the developer-relevance sequence.

**Current order** (lines 270–298):
```
GebouwSection → KadasterSection → BuildabilityDeltaSection → WkbPrecheckSection → PermitPrecedentsSection → MarketSignalsSection → WOZSection → EnergyLabelSection → BRKOwnershipSection → BestemmingSection → AIInterpretatieSection/PDFUploadSection
```

**New order** (locked decision):
```
ActieVereistSection (new) → BestemmingSection → KadasterSection → BRKOwnershipSection → GebouwSection → WOZSection → EnergyLabelSection → BuildabilityDeltaSection → WkbPrecheckSection → PermitPrecedentsSection → AIInterpretatieSection/PDFUploadSection
```

Aside sections (right column):
```
ReportMetaCard → MonumentSection → BronnenSection
```

### Pattern 2: Consistent Empty State
**What:** Every section must render a card with "Geen data beschikbaar" when the data field is null/empty.

**Established pattern** (already used in WOZSection, KadasterSection):
```tsx
if (!woz) {
  return (
    <Section title="WOZ" icon={<ChartIcon />}>
      <p className="text-sm italic text-grey-600">Geen WOZ-gegevens beschikbaar</p>
    </Section>
  )
}
```

**Check each section:**
- `GebouwSection` — never returns empty (BAG always has some data)
- `KadasterSection` — has empty state ("Geen kadastrale gegevens beschikbaar") ✓
- `BuildabilityDeltaSection` — has empty state ("Nog geen berekende bouwruimte beschikbaar") ✓
- `WkbPrecheckSection` — has empty state ("Nog geen Wkb precheck beschikbaar") ✓
- `PermitPrecedentsSection` — has empty state ("Nog geen precedentbenchmark beschikbaar") ✓
- `MarketSignalsSection` — has empty state ("Nog geen Funda-signalen beschikbaar") ✓
- `WOZSection` — has empty state ✓
- `EnergyLabelSection` — has empty state ✓
- `BRKOwnershipSection` — has special handling (compliance note) ✓
- `BestemmingSection` — has empty state ✓
- `MonumentSection` — has empty state ✓

**Action needed:** Standardize wording to "Geen [X] beschikbaar" (not italic, consistent with new section card styling).

### Pattern 3: Actie Vereist Warning Derivation
**What:** A pure function that reads `PropertyReportResponse` and returns a typed warnings array.

```typescript
type WarningSeverity = 'blocking' | 'attention' | 'awareness'

interface ActionWarning {
  id: string
  severity: WarningSeverity
  title: string
  description: string
}

function computeWarnings(data: PropertyReportResponse): ActionWarning[] {
  const warnings: ActionWarning[] = []

  // Wkb-plichtig (blocking — red)
  if (data.wkb_precheck?.status === 'likely_required') {
    warnings.push({
      id: 'wkb-required',
      severity: 'blocking',
      title: 'Wkb-plichtig',
      description: 'Dit pand is Wkb-plichtig. Een kwaliteitsborger is verplicht bij verbouwing.',
    })
  }

  // Asbestrisico: bouwjaar < 1994 (blocking — red)
  const bouwjaar = data.building?.bouwjaar
  if (bouwjaar != null && bouwjaar < 1994) {
    warnings.push({
      id: 'asbest-risk',
      severity: 'blocking',
      title: 'Asbestrisico',
      description: `Bouwjaar ${bouwjaar} — asbesthoudende materialen kunnen aanwezig zijn. Asbestinventarisatie vereist voor sloop of ingrijpende verbouwing.`,
    })
  }

  // Actionable building status (attention — amber)
  const status = data.building?.status
  if (status && ['Sloopvergunning verleend', 'Bouwvergunning verleend', 'Bouw gestart', 'Pand buiten gebruik'].includes(status)) {
    warnings.push({
      id: 'bag-status',
      severity: 'attention',
      title: STATUS_EXPLANATIONS[status]?.label ?? status,
      description: STATUS_EXPLANATIONS[status]?.description ?? '',
    })
  }

  // Monumentstatus (awareness — info blue)
  if (data.monuments?.is_monument) {
    warnings.push({
      id: 'monument',
      severity: 'awareness',
      title: 'Rijksmonument',
      description: 'Dit pand is aangewezen als rijksmonument. Verbouw- en sloopvergunning vereist bij nagenoeg alle wijzigingen.',
    })
  }

  return warnings
}
```

**Key insight:** The `STATUS_EXPLANATIONS` map already exists in `ReportDetailPage.tsx` with `severity: 'high' | 'medium' | 'low'` — reuse it rather than duplicating conditions.

### Pattern 4: CSS @media print + window.print()
**What:** Print-specific CSS rules that transform the screen report into a clean PDF layout.

**Approach:**
- Add a `@media print` block in `index.css` (global, not component-scoped)
- The rules hide interactive UI elements (nav, sidebars, back buttons, map controls)
- Force white backgrounds and dark text (PDF readers expect light backgrounds)
- Add page-break hints before each section card
- `window.print()` triggers the browser dialog with the print-styled DOM

**Key print CSS patterns for this project:**
```css
@media print {
  /* Force light background for all cards (CSS variables invert in html.light) */
  body { background: white !important; color: #111 !important; }

  /* Hide navigation and non-report chrome */
  nav, .print-hide { display: none !important; }

  /* Expand single-column for print (no sidebar) */
  .print-single-col { display: block !important; }

  /* Page break before each section card */
  .section-card { break-inside: avoid; break-before: auto; }

  /* Force card borders to be visible on white */
  .section-card { border: 1px solid #ddd !important; }

  /* Remove decorative gradients */
  [class*="blur-3xl"] { display: none !important; }
}
```

**Tailwind print variant:** Tailwind v4 supports `print:` variant natively for inline class usage (e.g., `print:hidden`, `print:block`). Use this for component-level show/hide, and the global `index.css` `@media print` block for structural overrides.

### Pattern 5: Static Map Thumbnail
**What:** A satellite image of the property location included in the report header, visible on screen and in print.

**Decision area:** Two approaches available:

**Option A — ESRI static tile URL** (recommended for simplicity):
```
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export
  ?bbox={lng-delta},{lat-delta},{lng+delta},{lat+delta}
  &bboxSR=4326&imageSR=4326&size=400,300
  &format=png32&f=image
```
- Renders directly as `<img>` tag — no JS map initialization
- Works in print because it is a regular image
- Requires `center_wgs84` from `PropertyReportResponse.map_data`
- No API key (ESRI World Imagery is free for browser access)

**Option B — MapLibre canvas snapshot**:
- Mount a hidden `<MapView>` pointing at the property coordinates
- On `map.idle`, call `map.getCanvas().toDataURL('image/png')` and store as state
- Render the data URL as `<img>`
- More complex, requires careful unmounting, but gives better zoom control

**Recommendation:** Use Option A (ESRI static export endpoint) — it's a URL construction from known lat/lng data, zero JS overhead, and renders identically on screen and in print. The ESRI export API accepts a `bbox` parameter as `minx,miny,maxx,maxy` in WGS84.

**URL construction:**
```typescript
function buildStaticMapUrl(center: number[], deltaKm = 0.3): string | null {
  if (!center || center.length < 2) return null
  const [lng, lat] = center
  // 0.3km ≈ 0.0027 degrees lat, adjust lng for NL latitude
  const latDelta = 0.003
  const lngDelta = 0.005
  const bbox = `${lng - lngDelta},${lat - latDelta},${lng + lngDelta},${lat + latDelta}`
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=4326&size=400,300&format=png32&f=image`
}
```

### Pattern 6: Organization Name in PDF Header
**What:** The white-label PDF header should show the client's organization name.

**Current state:** `UserResponse` (backend schema, line 20–31 of `schemas.py`) does NOT include `organization_name` — only `organization_id`. The `User` frontend type also lacks this field.

**Options:**
1. Add `organization_name` to `UserResponse` in the backend (requires backend change + migration-free join at auth layer) — cleanest long-term
2. Accept `user.full_name` as the PDF header name for now (simplest, demo-acceptable)
3. Add a `/api/auth/me/organization` endpoint returning org name

**Recommendation:** For Phase 65 (demo polish), use `user.full_name` in the PDF header as the "prepared by" name, and the org's name remains the report title label. This requires zero backend changes. If the org name needs to appear, add it to `UserResponse` (one-line addition to backend schema + frontend type).

### Anti-Patterns to Avoid
- **Hardcoding brand colors in print CSS:** Use CSS variables or white/black — the `html.light` vars already produce readable colors on white backgrounds.
- **Using fixed pixel widths in print:** Use `max-width: 100%` and avoid the sidebar two-column layout for print — it makes PDFs narrow.
- **Mounting a full MapLibre instance for the snapshot:** WebGL context initialization is slow and may fail in print mode. Use the ESRI static URL instead.
- **Hiding sections rather than showing empty state:** The user decided empty sections show "Geen data beschikbaar" — don't conditionally remove sections from print.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | WeasyPrint integration, html2canvas, jsPDF | `window.print()` + `@media print` CSS | Zero dependency, correct Dutch typography from system fonts, handles page breaks natively |
| Static map image | Custom tile stitching | ESRI export endpoint URL | Free, no API key, single `<img>` tag, ESRI terms allow browser display |
| Warning condition logic | Complex rule engine | Simple `computeWarnings()` helper with if-statements | All conditions are 1-3 field checks on existing data |

**Key insight:** The browser print pipeline already handles everything that custom PDF libraries try to replicate — pagination, typography, font embedding. The only thing it cannot do is generate PDFs server-side without user interaction, which is not a requirement here.

---

## Common Pitfalls

### Pitfall 1: Dark Mode Colors in Print
**What goes wrong:** The CSS variables are tuned for dark mode (`grey-950 ≈ #111`, `grey-100 ≈ white`). Print output on white paper will show light text on a near-black background card — illegible.
**Why it happens:** `@media print` doesn't override CSS custom properties automatically.
**How to avoid:** In the `@media print` block, either (a) apply `html.light` class via JS before calling `window.print()` and restore after, or (b) override the CSS variables directly in the print media query, or (c) add explicit `color: #111 !important; background: white !important` overrides to the Section card element.
**Warning signs:** Solid black rectangles in the PDF preview.

### Pitfall 2: Two-Column Layout Breaks in PDF
**What goes wrong:** The `xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]` grid (main + aside) renders side-by-side in print, making both columns too narrow to read.
**Why it happens:** CSS grid doesn't collapse for print without explicit `@media print` override.
**How to avoid:** In print, force `display: block` on the grid container so sections stack vertically. Use `print:block` Tailwind variant or a `.report-layout` CSS class with `@media print { .report-layout { display: block; } }`.
**Warning signs:** PDF shows two narrow columns.

### Pitfall 3: Sticky Aside in Print
**What goes wrong:** The aside uses `xl:sticky xl:top-5 xl:self-start` — sticky positioning can cause the aside to be hidden or overlap in print.
**Why it happens:** `position: sticky` behaves like `position: static` in print, but the stacking context may differ from expected.
**How to avoid:** Add `print:static` or `position: static !important` to the aside in print CSS.

### Pitfall 4: Window.print() Before Print CSS Is Applied
**What goes wrong:** If `window.print()` is called during a React re-render cycle, the DOM may not yet reflect the print class changes.
**How to avoid:** If using a JS class change (e.g., adding `html.light`), wrap in `setTimeout(() => window.print(), 50)` to allow the style to settle.

### Pitfall 5: ESRI Static Map URL Missing center_wgs84
**What goes wrong:** Some parcels may not have `map_data.center_wgs84` (returns `null` from the backend when geocoding fails or parcel has no geometry).
**How to avoid:** Render the map thumbnail conditionally: `{mapData?.center_wgs84 && <img src={buildStaticMapUrl(mapData.center_wgs84)} />}`. Graceful fallback is no image, not a broken `<img>`.

### Pitfall 6: Actie Vereist Logic Duplication with STATUS_EXPLANATIONS
**What goes wrong:** Building a parallel conditions map for Actie vereist instead of reusing `STATUS_EXPLANATIONS` which already has severity-keyed entries.
**How to avoid:** `computeWarnings()` should call `getStatusInfo(building?.status)` (already defined) and only generate an attention warning when `statusInfo.severity !== 'low'`. This keeps the two concerns in sync.

### Pitfall 7: ReportDetailPage.tsx Already at 2145 Lines
**What goes wrong:** Adding more inline components will push the file past 300 lines per the global CLAUDE.md rule.
**Why it happens:** The file was already over the limit before this phase.
**How to avoid:** Extract `ActieVereistSection` and any new print-related helpers into `frontend/src/components/reports/ActieVereistSection.tsx` (and `PrintButton.tsx` if the print trigger is non-trivial). Import them back into `ReportDetailPage.tsx`.

---

## Code Examples

### Print Button Trigger Pattern
```typescript
// In ReportDetailPage.tsx (or PrintButton component)
function handlePrint() {
  // Temporarily switch to light mode for readable PDF
  document.documentElement.classList.add('light')
  setTimeout(() => {
    window.print()
    // Restore theme after dialog closes (print is synchronous-ish)
    document.documentElement.classList.remove('light')
  }, 50)
}
```

### Print CSS in index.css
```css
@media print {
  /* Structural overrides */
  .report-grid { display: block !important; }
  .report-aside { display: block !important; position: static !important; }
  .print-hide { display: none !important; }

  /* Force readable colors */
  body { background: white !important; color: #111 !important; }
  .section-card {
    background: white !important;
    border: 1px solid #ccc !important;
    color: #111 !important;
    break-inside: avoid;
    margin-bottom: 1rem;
  }

  /* Page breaks */
  .actie-vereist-section { break-after: page; }

  /* PDF header */
  .pdf-header { display: block !important; }
  .pdf-footer { display: block !important; }
}

/* Screen: hide print-only elements */
.pdf-header, .pdf-footer { display: none; }
```

### Warning Section Component Skeleton
```typescript
// frontend/src/components/reports/ActieVereistSection.tsx
import type { PropertyReportResponse } from '@/lib/types/property'

type WarningSeverity = 'blocking' | 'attention' | 'awareness'

interface ActionWarning {
  id: string
  severity: WarningSeverity
  title: string
  description: string
}

export function computeWarnings(data: PropertyReportResponse): ActionWarning[] {
  const warnings: ActionWarning[] = []
  // ... (see Architecture Patterns section above)
  return warnings
}

export function ActieVereistSection({ data }: { data: PropertyReportResponse }) {
  const warnings = computeWarnings(data)
  if (warnings.length === 0) return null

  return (
    <div className="rounded-2xl border border-error/30 bg-error/[0.04] p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-error">Actie vereist</h2>
      <div className="mt-3 space-y-3">
        {warnings.map((w) => (
          <WarningRow key={w.id} warning={w} />
        ))}
      </div>
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-side PDF via WeasyPrint | Browser `window.print()` + `@media print` | This phase decision | Zero dependency, better font rendering, user controls output |
| No warning section | Derived `ActieVereist` from existing data | This phase | Developers see actionable items first |

---

## Open Questions

1. **Organization name in PDF header**
   - What we know: `UserResponse` includes `organization_id` but not `organization_name`. The `Organization` model has a `name` field in the database.
   - What's unclear: Whether adding `organization_name` to `UserResponse` (a backend-only change) is in scope for this phase or should use `user.full_name` as a proxy.
   - Recommendation: Use `user.full_name` for Phase 65 demo. Add `organization_name` to `UserResponse` if the backend change is approved — it's a 2-line change (schema + join at `/me` endpoint, no migration needed since it's a SELECT join, not a column add).

2. **ReportDetailPage.tsx file size**
   - What we know: File is 2145 lines — already over the 300-line project limit.
   - What's unclear: Whether to refactor the entire file or just extract new additions.
   - Recommendation: Extract `ActieVereistSection` and `PrintButton` to new files. Leave existing section components in place (refactoring all 2145 lines is out of scope for a polish phase).

3. **Print button placement**
   - What we know: The existing `PDFExportModal.tsx` calls `useExportPDF` which hits a server-side endpoint — this will be replaced with `window.print()`.
   - What's unclear: Whether the existing modal should be repurposed or a new "Download PDF" button added inline in the report header.
   - Recommendation: Replace the modal with an inline "Download PDF" button in the report header (same area as the existing controls). The modal flow (save first → export) was tied to server-side generation which is being dropped.

---

## Validation Architecture

*Note: `workflow.nyquist_validation` is not set in `.planning/config.json` (key absent). Treating as disabled — skipping automated test mapping.*

The phase is UI-only with no new backend endpoints or data transformations that warrant unit tests beyond existing coverage. Manual verification is appropriate:
- Open a report for a Wkb-plichtige property → confirm Actie vereist appears
- Open a report for a clean property → confirm section is absent
- Click "Download PDF" → confirm browser print dialog opens with readable layout

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `/frontend/src/components/reports/ReportDetailPage.tsx` (2145 lines) — complete understanding of current section components, patterns, and data bindings
- Direct code inspection of `/frontend/src/styles/index.css` — CSS variable system, dark/light mode, existing media query patterns
- Direct code inspection of `/frontend/src/lib/types/property.ts` — `PropertyReportResponse` type with all data fields available for warning derivation
- Direct code inspection of `/frontend/src/lib/auth/types.ts` — `User` type; confirmed `organization_name` absent
- `/frontend/package.json` — confirmed no PDF library dependencies, MapLibre 5.17.0 available

### Secondary (MEDIUM confidence)
- CSS `@media print` and Tailwind v4 `print:` variant — standard browser behavior, well-established patterns
- ESRI World Imagery export endpoint URL pattern — derived from existing `ESRI_SATELLITE_TILES` constant pattern in project; ESRI export REST API is a public, documented endpoint

### Tertiary (LOW confidence)
- None — all findings are verified against actual project code.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — code inspected directly, no external dependencies needed
- Architecture: HIGH — existing patterns in ReportDetailPage.tsx are clear, section structure is well-understood
- Pitfalls: HIGH — dark mode / print CSS interaction is a known browser behavior, verified against CSS variable system in index.css

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (stable domain — CSS print behavior and MapLibre APIs are stable)
