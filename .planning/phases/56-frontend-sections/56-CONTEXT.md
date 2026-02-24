# Phase 56: Frontend Sections - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Display the 4 new enriched data sections (EnergieLabelSection, WOZSection, EigendomSection, enhanced MonumentSection) in the property report UI. Backend already returns all data from Phases 52-55. This phase is purely frontend presentation — no backend changes.

Requirements: NRG-02, NRG-04, NRG-05, WOZ-02, WOZ-03, WOZ-05, BRK-02, BRK-03, BRK-06, RCE-02

</domain>

<decisions>
## Implementation Decisions

### Section ordering & prominence
- Reorder sections by theme: Gebouw → Energielabel → WOZ → Kadaster → Eigendom → Bestemming → Monument → AI Interpretatie → Bronnen
- Groups: physical property data together, then legal/ownership, then zoning/heritage
- Quick metrics grid expands from 4 to 6 cards: Bouwjaar, Vloeroppervlak, Gebruiksdoel, Energielabel badge, WOZ-waarde, Compleetheid
- PropertyDetailPanel (side panel on map) gets condensed versions of all new sections, consistent with existing Kadaster/Bestemming/Monument pattern

### Energielabel presentation
- EU arrow diagram style (stacked colored arrows with pointer highlighting the property's class)
- Compact size (~200px wide), inline within section — not full-width hero
- Standard EU colors: A++=dark green through G=red
- No label state: amber/warning styled call-to-action — "Geen energielabel geregistreerd" with context about when one is required (bij verkoop/verhuur)
- Monument without label: prominent amber alert banner within EnergieLabelSection — "Monumenten moeten vóór mei 2026 een energielabel hebben." Time-sensitive, actionable for developers
- Expired label: show registratiedatum and 10-year validity status (valid/expired)

### BRK eigendom presentation
- Detailed cards per owner: type, zakelijk recht type, aandeel (share)
- Natural persons show "Particulier eigenaar" — NEVER show personal names (BRK Tier 3 privacy)
- Rechtspersoon names ARE shown (public info)
- Hypotheek: simple boolean badge per perceel ("Hypotheek: Ja/Nee")
- Live-data indicator: subtle timestamp badge in section header ("Actueel opgevraagd om 14:32") plus brief note that data is not stored — clear but minimal
- When BRK unconfigured: section visible but greyed out with explanation "Eigendomsgegevens niet beschikbaar — BRK-koppeling wordt geconfigureerd"

### WOZ presentation
- WOZ-waarde always displayed with waardepeildatum (mandatory context pair)
- Per-m² calculation shown when building oppervlakte data available
- Low-confidence disclaimer when using unofficial waardeloket endpoint

### Monument detail depth
- Non-monument properties: keep existing minimal green "Geen monument" badge
- Monument properties: metadata grid (status badge + bouwperiode + functie) as compact 3-column row
- Below grid: existing restrictions list
- Below restrictions: collapsible redengevende omschrijving — first ~150 words visible, "Lees meer" expand button for full text
- RCE added as source row in verification table: "Rijksdienst Cultureel Erfgoed" with status badge

### Claude's Discretion
- Exact Tailwind styling, spacing, and responsive breakpoints
- How the EU arrow diagram is implemented (SVG vs CSS)
- WOZ section layout (follows existing section patterns)
- Loading states and skeleton patterns for sections
- Error state handling per section
- Side panel condensed layout specifics

</decisions>

<specifics>
## Specific Ideas

- EU energy arrow diagram should be compact (~200px) like a mini version of the official label — the stacked colored arrows with a pointer at the property's class
- Eigendom section: as detailed as possible per owner — user wants maximum info for future development workflows
- Live data note on eigendom should be clear but not alarming: the user knows BRK data is ephemeral by design

</specifics>

<deferred>
## Deferred Ideas

- **Eigenaar brief-automatisering**: User wants to build automation to send letters to property owners using BRK ownership data. This is a new capability requiring its own phase (involves storing/processing personal data, letter templates, mailing integration). Noted for future milestone.

</deferred>

---

*Phase: 56-frontend-sections*
*Context gathered: 2026-02-24*
