# Phase 66: Results Table Noise Reduction - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Filter the results table so it surfaces genuine development opportunities by default, not the full undifferentiated parcel list from a scan. Default sort places highest-value parcels at the top. Users can toggle the filter off to see all parcels.

</domain>

<decisions>
## Implementation Decisions

### Default filter preset
- Score threshold approach — hide parcels below a score cutoff
- Null-score parcels are hidden by default (treated as noise)
- Filter is applied server-side (API returns fewer results when filter is active)
- Exact score cutoff: Claude's discretion based on Venlo data distribution

### Sort behavior
- Default sort: score descending, applied server-side so page 1 always shows top opportunities
- User can change sort via column headers, but sort resets to score desc on page navigation/reload
- Null-score parcels always sort to the bottom regardless of sort direction

### Filter toggle UX
- Toggle switch in the table UI (not a chip or banner) — labeled, ON by default
- Toggle label shows count of hidden parcels (e.g., "Top kansen (12 verborgen)")
- Toggle always resets to ON (filtered) when opening results — no persistence per scan
- When filter would result in 0 visible rows, auto-disable with notice: "Filter uitgeschakeld — geen percelen boven drempel"

### Result counts
- Show both filtered and total counts: "23 van 87 percelen"
- Both counts available from server-side response (filtered_count + total_count)

### Map independence
- Map always shows all parcels regardless of table filter state
- Table and map filter independently — map provides full geographic context

### Claude's Discretion
- Exact score cutoff value (analyze Venlo data distribution to find natural break)
- Toggle placement within the existing results table layout
- Sort reset behavior when toggling filter on/off
- In-progress scan handling (filter during scoring or wait until complete)

</decisions>

<specifics>
## Specific Ideas

- Toggle label uses Dutch: "Top kansen" with hidden count in parentheses
- Empty filtered state auto-disables rather than showing empty state — less friction
- "23 van 87 percelen" format for count display

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 66-results-table-noise-reduction*
*Context gathered: 2026-03-02*
