# Phase 67: Wkb Classification Engine - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver Wkb gevolgklasse classification and asbest risk assessment in property reports. Includes correct exclusions for rijksmonumenten and verbouwingen. Backend classification services + schema extension + frontend report sections.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation decisions deferred to Claude based on completed research and clear success criteria:

- **Wkb section layout** — Follow existing report section patterns. Show gevolgklasse result (GK1 or "Niet van toepassing") with "Indicatief" label. Include reasoning factors from wkb_precheck scoring where available.
- **Asbest risk presentation** — Color-coded risk level (Hoog/Geen) following existing report visual patterns. NEN 2991 reference as inline text, not external link. Match severity tone to existing report section styling.
- **Indicatief disclaimer positioning** — Section-level subtitle label, consistent with how other data-confidence indicators appear in reports. Not a modal or banner — subtle but always visible.
- **Exclusion state rendering** — When wkb_applicable is false (monument or verbouwing), replace the classification content with the specific exclusion message from success criteria. Keep the section present but with distinct "niet van toepassing" styling rather than hiding it entirely.
- **Service architecture** — Extend existing wkb_precheck.py pattern. Asbest indicator as separate function/module given distinct logic (bouwjaar-based) vs gevolgklasse (building-type-based).
- **Schema extension** — Add wkb fields to PropertyReportResponse following established Pydantic model patterns with Optional fields for graceful degradation.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Research identified:
- Gevolgklasse 1 boundary: ground-level single-family dwellings only
- Asbest cutoff: January 1, 1994 (buildings 1963-1993 = Hoog risk)
- Existing wkb_precheck.py provides rule-based scoring foundation
- December 2024 verbouwing ruling as exclusion trigger

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 67-wkb-classification-engine*
*Context gathered: 2026-03-01*
