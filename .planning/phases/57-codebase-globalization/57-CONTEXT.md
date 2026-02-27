# Phase 57: Codebase Globalization - Context

**Gathered:** 2026-02-26  
**Status:** Ready for execution

<domain>
## Phase Boundary

Globalize duplicated frontend logic into shared, reusable building blocks before continuing workspace UX expansion.

Focus areas:
- shared domain helpers (`normalizeAreaName`, `normalizeGemeenteCode`, `resolveWijkBbox`)
- shared map deep-link/navigation builders
- shared metric chips, icons, and search-input behavior
- shared GeoJSON data hooks and municipality/workspace selectors

Out of scope:
- New end-user features
- Scoring model changes
- Backend schema/API redesign

</domain>

<decisions>
## Implementation Decisions

- This phase is mandatory before further UX expansion to prevent duplicated behavior across `projecten`, `meldingen`, and `map`.
- Keep refactors incremental and low-risk: replace one duplicated pattern at a time with strong type checks.
- Prefer `lib/` + `components/primitives/` + `hooks/` for shared modules.
- Keep existing route URLs and UX behavior unchanged while internals are consolidated.
- Add lightweight verification guardrails (lint/script checks) to prevent reintroducing known duplication patterns.

</decisions>

<specifics>
## Specific Scope from Current Audit

1. Domain normalizers duplicated in:
- `frontend/src/components/projects/ProjectList.tsx`
- `frontend/src/components/projects/WijkDetailView.tsx`
- `frontend/src/components/projects/GemeenteDetailView.tsx`
- `frontend/src/routes/_authenticated/map.tsx`

2. `resolveWijkBbox` duplicated in:
- `frontend/src/components/projects/ProjectList.tsx`
- `frontend/src/components/projects/WijkDetailView.tsx`

3. Metric-chip styling duplicated in:
- `frontend/src/components/projects/GemeenteCard.tsx`
- `frontend/src/components/projects/WijkCard.tsx`
- `frontend/src/components/projects/ProjectList.tsx`

4. Map navigation param construction duplicated in:
- `frontend/src/components/notifications/ChangeTimeline.tsx`
- `frontend/src/routes/_authenticated/meldingen.tsx`
- `frontend/src/components/projects/ProjectList.tsx`

5. GeoJSON fetch/caching duplicated in:
- `frontend/src/routes/_authenticated/map.tsx`
- `frontend/src/components/projects/ProjectList.tsx`

6. Search-input anti-password-manager attributes duplicated in:
- `frontend/src/components/reports/ReportSearch.tsx`
- `frontend/src/components/projects/WijkDetailView.tsx`
- `frontend/src/routes/_authenticated/rapporten.tsx`

</specifics>

<deferred>
## Deferred to Next Milestone

- Dedicated vastgoedontwikkelaar workspace UX expansion (master-detail workflow hardening)
- Opportunity score model redesign / explainability improvements
- New monetization data products (subsidies, bundles, exports)

</deferred>

---

*Phase: 57-codebase-globalization*  
*Prepared for GSD execution waves*
