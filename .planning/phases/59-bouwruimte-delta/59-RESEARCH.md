# Phase 59: Bouwruimte Delta - Research

**Researched:** 2026-02-27  
**Domain:** parcel utilization + zoning dimensional limits  
**Confidence:** HIGH

---

## Summary

The platform already has the ingredients for a meaningful buildability delta:
- perceel geometriën/oppervlak
- gebouwcontext (BAG)
- bestemmingsplan building dimensions (partial, location-dependent)

The value gap is not missing UI polish; it is missing normalized output that compares
**huidig** vs **toegestaan** in one defensible block.

---

## Core Findings

### 1) Decision speed needs one normalized envelope

Users should not reverse-engineer plan text.  
Delta must state:
- how much is already built,
- how much appears allowed,
- what space remains.

### 2) Coverage is heterogeneous by municipality/plan

FAR/TAR and bebouwingspercentage are not always present.  
Therefore confidence + missing fields are mandatory in output.

### 3) Report and map must share the same contract

No separate logic per view.  
One backend block powers both:
- report detail section,
- map quick view card.

---

## Recommended Execution

1. Create a `buildability_delta` backend schema block and calculator.
2. Populate from existing parcel + building + zoning dimensions.
3. Add confidence strategy (`high|medium|low`) based on available dimensional fields.
4. Render in report section with direct numbers and explanatory notes.
5. Surface condensed version in map detail panel for rapid triage.

