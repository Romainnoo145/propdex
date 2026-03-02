# Phase 65: Report Polish - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Make property reports presentable for client demonstration. Clean layout with consistent visual hierarchy, working PDF export via browser print, and an "Actie vereist" section surfacing actionable warnings from existing data. The report page (ReportDetailPage.tsx, 2145 lines) is the primary target. No new data sources — polish what's already collected.

</domain>

<decisions>
## Implementation Decisions

### Section layout & visual consistency
- Card-based layout: each section (WOZ, BRK, BAG, etc.) is a distinct card with bold header, subtle border, consistent padding
- Section ordering by developer relevance: Actie vereist → Bestemmingsplan → BRK/Kadaster → BAG → WOZ → Energielabel → Buildability → Wkb → Permits
- Empty/unavailable sections shown with greyed-out card and "Geen data beschikbaar" message — makes clear what was checked
- Data density: Claude's discretion per section type (some may suit key-value pairs, others summary + details)

### PDF export
- Browser print-to-PDF approach: CSS `@media print` rules + `window.print()`. No server-side generation, no extra dependencies
- White-label ready: client's organization name/logo in header, Propdex subtle in footer
- Static map snapshot included at top of PDF — aerial/satellite view of the property location
- Page break strategy: Claude's discretion — optimize for readability

### "Actie vereist" warnings
- Placement: top of report, immediately after header — first thing developers see
- Scope: all warnings derivable from existing data — Wkb-plichtig, asbestrisico (bouwjaar <1994), vergunningsstatus, monumentstatus, bestemmingsplan conflicts
- Severity visualization: color-coded with icons — red for blocking issues (Wkb-plichtig, asbest), amber for attention items (vergunningsstatus), info blue for awareness (monumentstatus)
- Tone: direct professional Dutch, factual, no softening. E.g., "Dit pand is Wkb-plichtig. Een kwaliteitsborger is verplicht bij verbouwing."
- Section absent (or empty) for parcels with no actionable warnings

### Report header & metadata
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

</decisions>

<specifics>
## Specific Ideas

- White-label: organization name from the multi-tenant context should appear in PDF header. Propdex branding subtle in footer only.
- Warning tone reference: "Dit pand is Wkb-plichtig. Een kwaliteitsborger is verplicht bij verbouwing." — factual, actionable, no advisory language.
- The existing STATUS_EXPLANATIONS map in ReportDetailPage.tsx already has severity levels (high/medium/low) — reuse this pattern for Actie vereist.
- Map snapshot should be satellite/aerial view, not the data layer view.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 65-report-polish*
*Context gathered: 2026-03-02*
