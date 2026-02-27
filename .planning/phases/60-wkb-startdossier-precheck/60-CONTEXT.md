# Phase 60: Wkb Startdossier Precheck - Context

**Gathered:** 2026-02-27  
**Status:** Ready for execution after Phase 59

<domain>
## Phase Boundary

Provide a practical Wkb-oriented precheck in reports without forcing a wizard-first flow.

Focus areas:
- Layer A automatic precheck from existing dossier data
- explainable result (`likely|required/uncertain/not_likely`) with rule hits
- optional Layer B refinement contract for higher certainty

Out of scope:
- full legal adjudication engine
- end-to-end borger assignment marketplace
- replacing expert review by certified kwaliteitsborgers

</domain>

<decisions>
## Implementation Decisions

- Default path is **Layer A** (automatic) to avoid mandatory questionnaire friction.
- **Layer B** exists as optional refinement: small input block for extra certainty when needed.
- Output is a decision aid with explicit uncertainty reasons, not a legal guarantee.
- Buildability delta and permit context from prior phases feed Wkb precheck confidence.

</decisions>

---

*Phase: 60-wkb-startdossier-precheck*  
*Prepared for GSD execution*

