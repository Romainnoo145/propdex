# Phase 3: Zoning & Monument Intelligence - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrich property intelligence reports with bestemmingsplan (zoning) summaries and monument/heritage status from Dutch government sources. Users get aggregated zoning rules, monument status from multiple sources with conflict detection, source attribution per section, and freshness timestamps. Map data is prepared for future frontend rendering.

This phase delivers the "aggregation value" — one address, all government sources, one report. Phase 4 adds the differentiator (AI PDF parsing).

</domain>

<decisions>
## Implementation Decisions

### Zoning data presentation
- Claude's discretion on layout structure (grouped sections vs summary card)
- **Priority fields:** Permitted function (bestemming) and building dimensions (max height, coverage, floor area ratio) are the headline data — these are the deal-makers for developers
- Show what's available, mark gaps explicitly ("Not specified in plan") — gaps become actionable items (e.g., future auto-mailing to perceel owner)
- **API strategy: Both DSO (Omgevingswet) and Ruimtelijkeplannen.nl with fallback** — try new DSO first, fall back to legacy Ruimtelijkeplannen.nl to cover the transition period

### Monument status & conflicts
- **Sources: RCE + BAG + Kadaster** — check all three for comprehensive coverage
- **Conflict handling:** Show each source's answer side-by-side, note discrepancy — not a hard warning, but clear enough that users see the disagreement
- Claude's discretion on restriction presentation format (plain language vs structured checklist)
- Claude's discretion on visual distinction between rijksmonument and gemeentelijk monument

### Map interaction
- **Tile provider: PDOK tiles (BRT Achtergrondkaart)** — official Dutch government tiles, free, no API key
- Claude's discretion on map approach — likely prepare coordinates + geometry data in API response for future frontend rendering rather than server-side image generation
- Claude's discretion on interactivity level

### Confidence & source display
- **Source attribution at section level** — each report section (zoning, monuments, kadaster) gets a "Sources" footer, not per-field labels
- **Freshness timestamps per section** — "Laatst bijgewerkt: 3 uur geleden" so users see exactly how fresh each data source is
- Claude's discretion on whether Phase 3 API data shows confidence indicators (to prepare for Phase 4's mandatory LOW/MEDIUM/HIGH)
- **Full report refresh** — one "Vernieuwen" button to re-fetch everything from government APIs, bypassing cache

### Claude's Discretion
- Zoning data layout structure
- Monument restriction display format (plain language vs checklist)
- Rijksmonument vs gemeentelijk visual treatment
- Map rendering approach (data-only API vs static image)
- Map interactivity level
- Whether to show confidence indicators on API-sourced data in Phase 3

</decisions>

<specifics>
## Specific Ideas

- Zoning data gaps should be explicitly marked — the vision is that gaps become actionable items for follow-up (potentially auto-mailing perceel owners in a future phase)
- The map is NOT a Kadaster viewer replacement — it's an embedded spatial context component within the report
- The real product differentiator comes in Phase 4 (AI parsing); Phase 3 establishes the aggregation value
- Government APIs are structured and accessible — this is real data automation, not screen scraping

</specifics>

<deferred>
## Deferred Ideas

- Auto-mailing perceel owners for missing data — future phase after aggregation proves the gap detection works
- Per-section refresh buttons (currently: full report refresh only)

</deferred>

---

*Phase: 03-zoning-monument-intelligence*
*Context gathered: 2026-02-07*
