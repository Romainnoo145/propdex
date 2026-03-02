# Phase 70: Professional Directory - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Platform-wide directory of kwaliteitsborgers that admins can manage and all tenants can browse. Filterable by gemeente and gevolgklasse. Each listing links to the TloKB public register. Cross-tenant visibility via NULL organization_id pattern.

NOT in scope: Lead capture, CTA buttons, contact forms, email routing (Phase 71). NOT in scope: Kwaliteitsborger self-registration or onboarding flow.

</domain>

<decisions>
## Implementation Decisions

### Directory presentation
- Card grid layout — consistent with existing GemeenteCard/WijkCard patterns in the codebase
- Each card shows: naam, bedrijfsnaam, werkgebied (as gemeente tags/chips), gevolgklassen (GK1/GK2/GK3 badges), TloKB verification link
- Responsive grid: 3 columns desktop, 2 tablet, 1 mobile
- Cards are read-only for tenant users — no edit actions visible

### Admin management flow
- Admin-only CRUD endpoints (role-gated, not tenant-scoped)
- Simple form-based add/edit — no bulk import needed for initial launch (small number of kwaliteitsborgers)
- Admin can set: naam, bedrijfsnaam, werkgebied (multi-select gemeenten), gevolgklassen (multi-select GK1/GK2/GK3), email, telefoon, website, tlokb_url
- Admin interface can be API-only for now — frontend admin UI is optional (can use API directly or add later)

### Filtering & discovery
- Gemeente filter as primary filter — dropdown or search input matching the werkgebied field
- Gevolgklasse filter as secondary filter — checkbox or toggle for GK1/GK2/GK3
- Auto-filter from property context when navigating from a property report: pre-fill gemeente from parcel's gemeente + gevolgklasse from Wkb classification
- Show count of matching professionals in filter header
- Empty state: "Geen kwaliteitsborgers gevonden voor [gemeente/gevolgklasse]"

### Professional profile depth
- No separate detail page — all relevant info visible on the card itself
- TloKB link opens in new tab with external link icon
- Werkgebied shown as compact gemeente chips (max 5 visible, "+N meer" overflow)
- Gevolgklasse shown as colored badges matching the GK badge pattern used in Wkb sections

### Claude's Discretion
- Exact card styling and spacing
- Filter component implementation (combobox vs dropdown)
- Loading states and skeleton patterns
- Pagination vs show-all approach (depends on data volume)
- Sort order (alphabetical by naam vs relevance when filtered)

</decisions>

<specifics>
## Specific Ideas

- NULL organization_id is the key architectural pattern — professionals are platform resources, not org-scoped
- TloKB (Toelatingsorganisatie Kwaliteitsborging Bouw) register URL format should be linkable per professional
- The directory should feel like a reference resource, not a marketplace — clean, informational, no promotional language
- GIN indexes on werkgebied (gemeente array) and gevolgklassen (array) for efficient filtering

</specifics>

<deferred>
## Deferred Ideas

- Kwaliteitsborger self-registration portal — future phase
- Professional ratings/reviews — not appropriate for MVP
- Bulk import from CSV/Excel — add when directory grows beyond manual management
- Professional availability/calendar integration — future marketplace feature

</deferred>

---

*Phase: 70-professional-directory*
*Context gathered: 2026-03-02*
