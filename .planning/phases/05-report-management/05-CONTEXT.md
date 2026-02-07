# Phase 5: Report Management - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can save, list, and revisit property intelligence reports. This includes report persistence (save/delete), report listing with search and filtering, project-based organization, PDF export, and data freshness indicators. Creating reports (property lookup) is handled by existing phases. This phase adds persistence, management, and export on top of the existing lookup flow.

</domain>

<decisions>
## Implementation Decisions

### Report Lifecycle
- Explicit save action — user clicks "Save" after reviewing a lookup. Unsaved lookups are ephemeral
- Update in place on refresh — no versioning. Saved report gets fresh data, "last updated" timestamp changes
- Report name auto-generated from address (e.g., "Keizersgracht 123, Amsterdam") — not user-editable
- Delete behavior: Claude's discretion (confirm dialog or soft-delete with undo toast)

### Report List & Organization
- Sort by date saved, last updated, or address
- Filter by city/gemeente
- Search box to find reports by address
- Project folders: user creates explicitly, names them, assigns reports. Reports can also exist outside projects (unassigned)
- List layout: Claude's discretion (table vs cards)

### Report Content & Freshness
- Full snapshot storage — all report data (kadaster, zoning, monuments, AI parsing) stored as JSON at save time
- Age indicator on reports: "Data from 3 days ago" style, subtle but transparent
- Free-text notes field on saved reports for internal observations
- On re-open: show saved snapshot immediately, background check for newer cache data, show "Update available" indicator if fresher data exists

### Report Sharing & Export
- Shared by default within organization — all org members can see all saved reports
- PDF export: clean professional report with branded header, structured sections, confidence indicators, source citations
- PDF only for MVP — no CSV/Excel export

### Claude's Discretion
- Delete UX pattern (confirm dialog vs soft-delete with undo)
- Report list layout (table vs cards — pick what suits a professional real estate tool)
- PDF generation library/approach
- Exact staleness threshold for "Update available" indicator
- Project list/management UI details

</decisions>

<specifics>
## Specific Ideas

- PDF should look like a professional due diligence document — the kind you'd hand to a notaris, bank, or investor
- Reports are collaborative within an organization — everyone sees everything (fits the real estate team workflow)
- Project folders map to real estate development projects (e.g., "Due Diligence Centrum", "Portfolio Review Q1")
- Notes field is for internal team observations ("Check monument status with gemeente", "Owner willing to sell")

</specifics>

<deferred>
## Deferred Ideas

- CSV/Excel data export — add if users request it
- Report versioning / history — could be valuable for tracking changes over time
- Private reports (per-user visibility) — current model is org-shared
- User-editable report names — currently auto-generated from address

</deferred>

---

*Phase: 05-report-management*
*Context gathered: 2026-02-07*
