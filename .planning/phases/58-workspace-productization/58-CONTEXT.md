# Phase 58: Workspace Productization - Context

**Gathered:** 2026-02-27  
**Status:** Ready for execution

<domain>
## Phase Boundary

Build a dedicated, scalable workspace model for professionals using Propdex at municipality and wijk scale.

Focus areas:
- role-aware workspace shell (vastgoedontwikkelaar first)
- project-first information architecture for 30+ gemeenten
- consistent interaction model between projecten, rapporten, meldingen, and map
- clear split between dataset navigation and execution actions

Out of scope:
- full second product clone for particulieren
- real-time monitoring for all municipalities by default
- scoring-model redesign logic itself (handled in follow-up intelligence phases)

</domain>

<decisions>
## Implementation Decisions

- Keep one codebase and introduce workspace modes/personas instead of duplicating the entire app.
- Treat gemeentelijke scale as the primary container; wijk, percelen, rapporten, and meldingen are nested scopes.
- Monitoring intake must remain opt-in per gemeente to avoid SRU/ops overcapacity.
- UX changes are delivered in small migration-safe slices so existing routes keep functioning.
- New workspace features must reuse shared foundations introduced in Phase 57.

</decisions>

<specifics>
## Specific Scope from Current Product Direction

1. User needs to manage high volume municipality portfolios without losing focus.
2. Existing tabs contain the right data but still feel fragmented under scale.
3. Map interaction should become a primary workflow surface, not a secondary viewer.
4. Report generation must stay idempotent and traceable per parcel to support future map coloring and pipeline automation.
5. Commercial direction needs room for multiple buyer profiles later (developers, borgers, consumer funnel), but rollout starts with developer workspace.

</specifics>

<deferred>
## Deferred to Next Milestones

- Subsidie intelligence per gemeente
- End-to-end borger dossier exports and billing flows
- Consumer-facing onboarding journey and marketplace monetization

</deferred>

---

*Phase: 58-workspace-productization*  
*Prepared for GSD execution waves*
