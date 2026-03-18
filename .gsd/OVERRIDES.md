# Overrides

## OVR-001: Bestemming filter as map color mode (S04 scope addition)

**Added:** 2026-03-17
**Source:** User request during S03→S04 transition

Add a **bestemming-based color/filter mode** to the map in S04. When active:
- Parcels are colored by their primary bestemming type (e.g. Wonen, Gemengd, Bedrijventerrein, Maatschappelijk, etc.)
- A dropdown/pill filter lets the user isolate a single bestemming type — e.g. select "Wonen" and only parcels with Wonen bestemming light up
- Filtered parcels remain clickable (open parcel detail as usual)

**Implementation path:**
- Backend: Extract primary bestemming type from `parcel_cache.bestemmingen` JSONB into a new MVT tile property (e.g. `bestemming_type`)
- Frontend: Add bestemming as a color mode in LayerToggle alongside Score. When selected, apply MapLibre `filter` + categorical color paint by bestemming type. Add dropdown to isolate a single type.

**This expands S04 scope.** The reassess-roadmap agent should incorporate this into S04 planning.
