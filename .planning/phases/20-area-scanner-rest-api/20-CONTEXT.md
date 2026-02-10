# Phase 20: Area Scanner + REST API - Context

**Gathered:** 2026-02-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A complete scan pipeline that runs as an ARQ background job -- from gemeente bbox to filtered parcel list -- with REST endpoints for triggering scans, polling progress, browsing/filtering/sorting paginated results, and exporting to Excel. The scan orchestrates Phase 19's API clients (BAG WFS, SRU, BRK, DSO) against Phase 18's spatial database.

</domain>

<decisions>
## Implementation Decisions

### Scan lifecycle
- Show existing scan results when a gemeente was already scanned, with an option to re-scan
- Re-scan overwrites parcel data in-place on the same scan record (not a new record)
- Scans are per-organization (shared with all team members, avoids duplicate work)
- Show scan date on results, and after 30 days nudge the user to re-scan

### Partial results & error handling
- Results stream in during scan -- users can see parcels as they're processed (table grows live)
- Users can cancel a running scan -- parcels processed so far are kept as results
- Summary line for scan quality: "Scanned 4,832 parcels (23 failed)" -- no detailed failure report
- Claude's Discretion: error tolerance strategy (retry policy, skip behavior for failed individual parcels)

### Scoring
- Score-based default sort (most promising parcels first)
- Claude's Discretion: scoring formula design based on available data factors (size, vacancy, zoning, permits)
- Score display: category label (High/Medium/Low) at a glance, expandable breakdown showing per-factor contribution
- Fixed scoring formula for all organizations (tunable per-org weights deferred to future phase)
- Internal documentation of scoring methodology for client-facing conversations

### Result defaults
- "No parcels match your filters" with a clear-all-filters reset button for empty states
- Claude's Discretion: filter application mode (live vs apply button) based on expected result set sizes

### Export
- Excel (.xlsx) export, not CSV -- NL/BE real estate developers work in Excel
- Export respects active filters (exports what the user sees, not all results)
- Claude's Discretion: whether to include score column in Excel export

</decisions>

<specifics>
## Specific Ideas

- "How is the score based?" is the #1 client question -- score transparency is critical for trust
- The REST API itself is the integration point for future automated workflows (lead scoring, CRM push, notifications)
- Real estate developers need to be able to explain to their own clients why a parcel is promising

</specifics>

<deferred>
## Deferred Ideas

- Per-organization customizable score weights -- future phase if clients request it
- Automated downstream workflows (CRM integration, lead notifications, outreach) -- future phase
- PDF report export for stakeholder presentations -- future phase

</deferred>

---

*Phase: 20-area-scanner-rest-api*
*Context gathered: 2026-02-10*
