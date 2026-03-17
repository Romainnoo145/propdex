---
status: complete
started: 2026-03-17T14:10:00+07:00
completed: 2026-03-17T14:30:00+07:00
---

# S05 Summary: Enriched Opgeslagen + Pipeline

## Result

/opgeslagen shows favorited parcels grouped by gemeente with full pipeline stage management.

## What Was Delivered

- Pipeline stage pills (color-coded) on each parcel row
- Click pill → dropdown to change stage (5 stages)
- Afgerond captures reason (Gekocht/Afgewezen) via modal + optional note
- Stage filter bar (URL-persisted via search params)
- Search + stage filter combinable
- useUpdatePipelineStage hook wired with optimistic cache updates

## Forward Intelligence

- Completeness indicators not added — FavoriteResponse doesn't carry data coverage info. Would need a new backend field.
- FAV-04 (favorite count badge on gemeente/wijk cards) is already implemented in the projects components from M001.
