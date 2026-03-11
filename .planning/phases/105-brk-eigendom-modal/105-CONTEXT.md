# Phase 105: BRK Eigendom Modal - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

One adaptive modal triggered from the parcel detail panel, serving both leeg perceel and pand-in-gebruik scenarios. Purpose: on-demand BRK ownership lookup via Kadaster API so vastgoedontwikkelaars can identify who owns a parcel and determine their acquisition approach. Data is fetched on-demand and NOT stored (Kadaster license restriction).

</domain>

<decisions>
## Implementation Decisions

### Trigger mechanism
- The existing "Leeg perceel" / "Pand in gebruik" status indicator in ParcelBentoOverview.tsx (line 236) becomes clickable
- No new buttons — enhance the existing status element
- Click opens the eigendom/acquisition modal on top of the parcel detail panel

### Single adaptive modal
- One modal for both parcel states, with content adapting based on leeg/in-gebruik
- Leeg perceel framing: "grondpositie" — who owns this land? Gemeente grondzaken path highlighted
- Pand in gebruik framing: "herontwikkeling" — who owns this building? Eigenaar type routing
- Same BRK data section in both, different contextual framing above it

### BRK data display
- Show everything the Kadaster API returns — all available fields
- Build first with real data, iterate on layout after seeing actual API responses
- Multiple zakelijk gerechtigden: Claude decides layout based on Aura aesthetic

### Eigenaar type routing
- Based on eigenaar type, show contextual tips:
  - Gemeente grond → grondzaken afdeling contact (auto-lookup from gemeente code)
  - Woningcorporatie → asset manager approach
  - Particulier → direct approach or via makelaar
  - Institutioneel → portfolio-level contact

### Confirmation before API call
- "Eigendom opvragen" button shows a warning popup BEFORE making the Kadaster API call
- Warning text combines cost + data ephemerality: "Kost 1 credit. Data wordt niet opgeslagen en is eenmalig zichtbaar."
- User must confirm before the API call fires

### No data persistence
- BRK data is purely ephemeral — fetch, display, discard on modal close
- No database storage, no caching of Kadaster ownership data
- This is a hard Kadaster license constraint

### Monetization alignment
- Modal shows teaser sections (locked/blurred) for data that's in the full rapport
  - E.g., "Bodemrisico", "Bouwpotentieel" section headers visible but content blurred
  - Prominent "Genereer Rapport" CTA to drive conversion
- The eigendom lookup itself is the free hook; the full dossier is behind the rapport paywall

### Claude's Discretion
- All UI layout and styling decisions (Aura aesthetic)
- Modal animation and transitions
- Exact placement and design of locked/blurred teaser sections
- Component architecture (shared BRK component vs inline)
- Loading states, error handling, empty states
- Gemeente grondzaken auto-lookup implementation approach

</decisions>

<specifics>
## Specific Ideas

- The vastgoedontwikkelaar workflow: signalering → eigendom opvragen → eerste haalbaarheidscheck → verwerving. This modal covers step 2 (eigendom) with a teaser of step 3 (haalbaarheid via locked rapport sections)
- Gemeente grondzaken contact should be auto-derived from gemeente code where possible
- The "build and iterate" approach: get real Kadaster data flowing first, refine UI after seeing actual responses

</specifics>

<deferred>
## Deferred Ideas

- Full dossier/deal-sheet compilation — belongs in rapport v2 (Phase 104)
- Checklist-style acquisition workflow (eigendom → bodemonderzoek → planologie → bod) — future phase
- Caching BRK data for repeat lookups — blocked by Kadaster license terms

</deferred>

---

*Phase: 105-brk-eigendom-modal*
*Context gathered: 2026-03-12*
