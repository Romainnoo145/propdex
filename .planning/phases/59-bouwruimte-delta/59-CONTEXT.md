# Phase 59: Bouwruimte Delta - Context

**Gathered:** 2026-02-27  
**Status:** Ready for execution

<domain>
## Phase Boundary

Deliver a deterministic **Bouwruimte Delta** section for each perceel/report:
- huidige benutting (bebouwd oppervlak / perceeloppervlak),
- maximaal toegestaan (bestemmingsplan where available),
- resterende bouwruimte (m² en %),
- confidence + missing-data explanation.

Focus areas:
- backend data contract and calculation logic
- report section for decision-grade interpretation
- map quick-view integration for fast triage

Out of scope:
- full feasibility/financial model
- legal advice replacement
- automated vergunning aanvraag flow

</domain>

<decisions>
## Implementation Decisions

- This phase is priority #1 in v7.2; it answers the primary developer question directly.
- No separate "opportunity mode": output becomes part of base dossier/report contract.
- FAR/TAR values are exposed when available, but phase success does not depend on universal FAR coverage.
- Unknown values are explicit and explainable (`confidence`, `missing_fields`, `notes`) — never silently defaulted.

</decisions>

<specifics>
## Required Output Shape (v1)

`buildability_delta` should provide at least:
- `parcel_area_m2`
- `current_built_area_m2`
- `current_built_ratio_pct`
- `max_bebouwingspercentage_pct` (nullable)
- `max_buildable_area_m2` (nullable)
- `remaining_buildable_area_m2` (nullable)
- `current_far` (nullable)
- `max_far` (nullable)
- `remaining_far` (nullable)
- `confidence` (`high|medium|low`)
- `missing_fields[]`
- `notes[]`

</specifics>

---

*Phase: 59-bouwruimte-delta*  
*Prepared for GSD execution*

