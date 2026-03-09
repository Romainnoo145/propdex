# Phase 85: Explorer UI - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Standalone `/jurisprudentie` page (new route in side rail) where developers can search and filter court rulings to find strategic ammunition for vergunningsaanvragen and bezwaar/beroep. Works on cached data from ruling_cache (no live API calls). Includes AI-classification of rechtsgronden (5 gouden gronden) to power meaningful filters.

This is NOT a gemeente-scoped feature — it's a cross-gemeente search tool for the entire ruling_cache.

</domain>

<decisions>
## Implementation Decisions

### Navigation & routing
- New `/jurisprudentie` route added to side rail (SideRailNav.tsx), between Rapporten and Instellingen
- Standalone page — not nested inside gemeente detail view
- Scale icon (lucide) for the nav item

### Layout
- Filter sidebar left, results panel right (classic search pattern)
- Sidebar contains: Gemeente dropdown, Vergunningstype, Uitkomst, Rechtsgrond, Rechtbank-niveau, Tijdsperiode
- Each filter shows result count before applying (prevents empty-result frustration)
- Infinite scroll for results (useInfiniteQuery pattern)

### Data source
- Queries ruling_cache table only (cached rulings from previously scanned gemeenten)
- Gemeente dropdown populated from distinct gemeenten in ruling_cache
- No live Rechtspraak API calls — fast, reliable, pre-analyzed data
- All rulings already have AI summaries from Phase 84 pipeline

### AI rechtsgrond classification (new in this phase)
- Extend AI parsing pipeline to classify each ruling into 1+ of 5 rechtsgronden:
  1. Procedurefout (procedural error by gemeente)
  2. Motiveringsgebrek (inadequate reasoning)
  3. Gelijkheidsbeginsel (equal treatment violated)
  4. Disproportioneel (disproportionate refusal)
  5. ETFAL/Ruimtelijke ordening (balanced allocation of functions)
- Store classifications in ruling_cache (new JSONB column or similar)
- Enables the "Rechtsgrond" filter dimension in the Explorer

### Ruling cards
- Show: ECLI, rechtbank, datum, gemeente
- AI-samenvatting (already exists from Phase 84)
- Vergunningstype + uitkomst badges
- Rechtsgrond tags (from new AI classification)
- Doorlooptijd
- Expand/collapse for full details

### Empty & sparse results
- When results < 3: "Verbreed uw zoekopdracht" with actionable suggestions
- Suggestions based on which filters are narrowing most (e.g., "Verwijder filter 'Raad van State' voor 12 meer resultaten")

### MVP mindset
- This is an MVP that demonstrates the platform's potential to investors
- Must look polished and show the strategic value of jurisprudence search
- Keep it lean — no project-context coupling, no argument builder, no map markers yet

### Claude's Discretion
- Exact filter component implementation (select, checkbox, combobox)
- Backend query optimization and pagination strategy
- Ruling card typography and spacing
- How to handle the rechtsgrond classifier prompt engineering
- Mobile responsiveness approach for sidebar collapse

</decisions>

<specifics>
## Specific Ideas

- The tool serves vastgoedontwikkelaars preparing vergunningsaanvragen or bezwaar/beroep
- Use case: "Toon mij alle zaken in regio Utrecht waar een weigering voor woningbouw werd vernietigd wegens motiveringsgebrek" — this is the exact ammunition a lawyer needs
- Dutch administrative law has no stare decisis, but gelijkheidsbeginsel + motiveringsplicht mean gemeenten must justify different decisions for similar cases
- Success rates by rechtsgrond (from research): Procedurefout 80%, Motiveringsgebrek 75%, Gelijkheid 70%, Disproportioneel 55%, ETFAL 45%

</specifics>

<deferred>
## Deferred Ideas

- **Bruikbaarheid/Propdex Score** — Hybrid relevance score (context-match + AI feiten-match + strategic value). Requires project-context coupling where user defines their doel. Own phase.
- **Argument Builder** — AI generates concept-onderbouwing from selected rulings for direct use in vergunningsaanvraag/bezwaarschrift. Major AI feature, own phase. High monetization potential.
- **Geo-Jurisprudentie Mapping** — Court ruling markers on the map tied to physical locations. Own phase.
- **Beslisboom-Trend** — Already Phase 86 (Trend & Statistics) in roadmap. Win-rate trends per gemeente/type.
- **Live Rechtspraak API search** — Expand beyond cached data to search full Rechtspraak database in real-time. Future enhancement.
- **Opslaan/exporteren** — Save rulings to a collection or export for use in legal documents. Own phase.

</deferred>

---

*Phase: 85-explorer-ui*
*Context gathered: 2026-03-09*
